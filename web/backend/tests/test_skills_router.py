"""Tests for the skills router endpoints using FastAPI TestClient."""

import json
from pathlib import Path
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import sqlalchemy
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine
from fastapi.testclient import TestClient

from app.database import Project, _set_sqlite_pragmas
from app.schemas.skill_frontmatter import SkillArg, SkillArgType, SkillCategory
from app.services.skill_catalog_service import (
    SkillCatalog,
    SkillCatalogService,
    SkillMeta,
    load_catalog,
)


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
def app(skills_root: Path):
    """Create a FastAPI app with the skill catalog loaded (no database needed for catalog tests)."""
    from app.main import create_app

    application = create_app()

    # Load skill catalog onto app state
    service = SkillCatalogService()
    service.load_initial(skills_root)
    application.state.skill_catalog_service = service

    return application


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


class TestListSkills:
    def test_list_skills_returns_all(self, client: TestClient):
        response = client.get("/api/skills")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 29, f"Expected at least 29 skills, got {len(data)}"
        # Verify sorted by name
        names = [s["name"] for s in data]
        assert names == sorted(names), "Skills should be sorted alphabetically"

    def test_list_skills_has_expected_fields(self, client: TestClient):
        response = client.get("/api/skills")
        data = response.json()
        first = data[0]
        assert "name" in first
        assert "description" in first
        assert "args" in first
        assert "categories" in first
        assert "allowedTools" in first
        assert "sourcePath" in first


class TestGetSkill:
    def test_get_unknown_skill_404(self, client: TestClient):
        response = client.get("/api/skills/does-not-exist")
        assert response.status_code == 404

    def test_get_known_skill(self, client: TestClient):
        # First get the list to find a valid skill name
        skills = client.get("/api/skills").json()
        name = skills[0]["name"]
        response = client.get(f"/api/skills/{name}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == name


class TestHealthEndpoint:
    def test_health_endpoint(self, client: TestClient):
        response = client.get("/api/skills/_health")
        assert response.status_code == 200
        data = response.json()
        assert "skills" in data
        assert isinstance(data["skills"], int)
        assert data["skills"] >= 29
        assert "parse_errors" in data
        assert isinstance(data["parse_errors"], list)


class TestCheckPreconditionsWithInvalidArgs:
    """Behavioral regression: sanitizer errors fold into the blocker list (200, not 400)."""

    @pytest.fixture
    def db_engine(self, tmp_path: Path) -> sqlalchemy.Engine:
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
    def project_dir(self, tmp_path: Path) -> Path:
        planning = tmp_path / ".planning"
        planning.mkdir()
        state = {
            "projectName": "test-project",
            "milestones": [
                {"id": "v1", "name": "V1", "sets": [{"id": "foo", "status": "active"}]}
            ],
        }
        (planning / "STATE.json").write_text(json.dumps(state), encoding="utf-8")
        set_dir = planning / "sets" / "foo"
        set_dir.mkdir(parents=True)
        (set_dir / "CONTEXT.md").write_text("# Context\n", encoding="utf-8")
        (set_dir / "wave-1-PLAN.md").write_text("# Plan\n", encoding="utf-8")
        return tmp_path

    @pytest.fixture
    def precondition_client(
        self, skills_root: Path, db_engine: sqlalchemy.Engine, project_dir: Path
    ) -> tuple[TestClient, str]:
        from app.main import create_app

        application = create_app()
        service = SkillCatalogService()
        service.load_initial(skills_root)
        application.state.skill_catalog_service = service
        application.state.engine = db_engine

        pid = uuid4()
        with Session(db_engine) as session:
            session.add(Project(id=pid, name="test", path=str(project_dir)))
            session.commit()

        return TestClient(application), str(pid)

    def test_check_preconditions_with_invalid_args_returns_blocker(
        self, precondition_client: tuple[TestClient, str]
    ):
        """Invalid arg name should produce 200 with ok=false and an ARG_UNKNOWN blocker."""
        client, project_id = precondition_client
        response = client.post(
            "/api/skills/execute-set/check-preconditions",
            json={
                "project_id": project_id,
                "set_id": "foo",
                "skill_args": {"set": "foo", "bogus_arg": "bad_value"},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is False
        codes = [b["code"] for b in data["blockers"]]
        assert "ARG_UNKNOWN" in codes
        # The blocker should reference the invalid arg name
        arg_blocker = next(b for b in data["blockers"] if b["code"] == "ARG_UNKNOWN")
        assert arg_blocker["arg"] == "bogus_arg"
        assert "unknown" in arg_blocker["message"].lower()
