"""Tests for the skills router endpoints using FastAPI TestClient."""

from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

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
