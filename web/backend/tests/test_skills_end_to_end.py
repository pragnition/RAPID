"""End-to-end integration test covering the skills dispatch path.

Sets up a real skill catalog, a temporary project with planning artifacts,
then exercises: precondition check -> sanitize -> build_prompt in sequence.
"""

import json
from pathlib import Path
from uuid import uuid4

import pytest
import sqlalchemy
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.database import Project, _set_sqlite_pragmas
from app.services.skill_args_sanitizer import sanitize_skill_args
from app.services.skill_catalog_service import SkillCatalogService, load_catalog
from app.services.skill_runner import build_prompt


def _find_project_root() -> Path:
    """Walk up from this file to find the directory containing .claude-plugin/plugin.json."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / ".claude-plugin" / "plugin.json").is_file():
            return parent
    raise RuntimeError("Cannot find project root (no .claude-plugin/plugin.json found)")


@pytest.fixture
def skills_root() -> Path:
    root = _find_project_root()
    sr = root / "skills"
    assert sr.is_dir(), f"skills/ directory not found at {sr}"
    return sr


@pytest.fixture
def catalog_service(skills_root: Path) -> SkillCatalogService:
    service = SkillCatalogService()
    service.load_initial(skills_root)
    return service


@pytest.fixture
def project_dir(tmp_path: Path) -> Path:
    """Build a minimal project tree so execute-set preconditions pass."""
    planning = tmp_path / ".planning"
    planning.mkdir()

    state = {
        "projectName": "test-project",
        "milestones": [
            {
                "id": "v1",
                "name": "Version 1",
                "sets": [
                    {"id": "foo", "status": "active"},
                ],
            }
        ],
    }
    (planning / "STATE.json").write_text(json.dumps(state), encoding="utf-8")

    set_dir = planning / "sets" / "foo"
    set_dir.mkdir(parents=True)
    (set_dir / "CONTEXT.md").write_text("# Context for foo\n", encoding="utf-8")
    (set_dir / "wave-1-PLAN.md").write_text("# Plan for foo\n", encoding="utf-8")

    return tmp_path


@pytest.fixture
def db_engine(tmp_path: Path) -> sqlalchemy.Engine:
    """Create a fresh in-memory-like SQLite engine."""
    db_file = tmp_path / "test.db"
    eng = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
    event.listen(eng, "connect", _set_sqlite_pragmas)
    SQLModel.metadata.create_all(eng)
    return eng


@pytest.fixture
def app(skills_root: Path, db_engine: sqlalchemy.Engine):
    """Create a FastAPI app wired to a real catalog and a test database."""
    from app.main import create_app

    application = create_app()

    # Skill catalog
    service = SkillCatalogService()
    service.load_initial(skills_root)
    application.state.skill_catalog_service = service

    # Database engine for precondition resolver (resolve_context needs Project lookup)
    application.state.engine = db_engine

    return application


@pytest.fixture
def project_id(db_engine: sqlalchemy.Engine, project_dir: Path) -> str:
    """Insert a Project row and return its UUID string."""
    pid = uuid4()
    with Session(db_engine) as session:
        session.add(Project(id=pid, name="test-project", path=str(project_dir)))
        session.commit()
    return str(pid)


class TestExecuteSetEndToEnd:
    """Full dispatch path: precondition check -> sanitize -> build_prompt."""

    def test_precondition_check_passes_for_valid_project(
        self, app, project_id: str
    ):
        from fastapi.testclient import TestClient

        client = TestClient(app)
        response = client.post(
            "/api/skills/execute-set/check-preconditions",
            json={
                "project_id": project_id,
                "set_id": "foo",
                "skill_args": {"set": "foo"},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["blockers"] == []

    def test_sanitize_produces_wrapped_output(self, catalog_service: SkillCatalogService):
        catalog = catalog_service.current
        meta = catalog.get("execute-set")
        assert meta is not None, "execute-set skill not found in catalog"

        sanitized = sanitize_skill_args(meta, {"set": "foo"})
        assert "set" in sanitized
        assert sanitized["set"] == "<user_input>foo</user_input>"

    def test_build_prompt_contains_slash_command_and_user_input(
        self, catalog_service: SkillCatalogService
    ):
        catalog = catalog_service.current
        meta = catalog.get("execute-set")
        assert meta is not None

        sanitized = sanitize_skill_args(meta, {"set": "foo"})
        prompt = build_prompt("execute-set", sanitized)

        assert "/rapid:execute-set" in prompt
        assert "<user_input>foo</user_input>" in prompt

    def test_precondition_check_blocks_for_missing_set(
        self, app, project_id: str
    ):
        """Verify that a missing set directory produces a blocker."""
        from fastapi.testclient import TestClient

        client = TestClient(app)
        response = client.post(
            "/api/skills/execute-set/check-preconditions",
            json={
                "project_id": project_id,
                "set_id": "nonexistent-set",
                "skill_args": {"set": "nonexistent-set"},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is False
        codes = [b["code"] for b in data["blockers"]]
        assert "SET_DIR_MISSING" in codes
