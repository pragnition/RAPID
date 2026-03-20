"""Integration tests for the projects API endpoints."""

import json
import time
from uuid import uuid4

import httpx
import pytest
from sqlmodel import SQLModel, create_engine

from app.main import create_app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def test_engine(tmp_path):
    """SQLite engine with all tables created."""
    db_path = tmp_path / "test.db"
    eng = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    SQLModel.metadata.create_all(eng)
    return eng


@pytest.fixture()
def test_app(test_engine):
    """FastAPI app with engine set on state."""
    app = create_app()
    app.state.engine = test_engine
    app.state.start_time = time.time()
    return app


@pytest.fixture()
def async_client(test_app):
    """httpx AsyncClient wired to the test app."""
    transport = httpx.ASGITransport(app=test_app, raise_app_exceptions=False)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


@pytest.fixture()
def project_dir(tmp_path):
    """Create a temporary directory with .planning/STATE.json."""
    planning = tmp_path / "myproject" / ".planning"
    planning.mkdir(parents=True)
    state = {
        "projectName": "TestProject",
        "milestones": [
            {
                "id": "m1",
                "name": "MVP",
                "sets": [
                    {"id": "s1", "status": "active"},
                    {"id": "s2", "status": "complete"},
                ],
            }
        ],
    }
    (planning / "STATE.json").write_text(json.dumps(state))
    return tmp_path / "myproject"


def _make_project_dir(base_path, name="proj", state_data=None):
    """Helper to create additional project directories."""
    proj = base_path / name
    planning = proj / ".planning"
    planning.mkdir(parents=True, exist_ok=True)
    state = state_data or {
        "projectName": name,
        "milestones": [],
    }
    (planning / "STATE.json").write_text(json.dumps(state))
    return proj


# ---------------------------------------------------------------------------
# Registration tests
# ---------------------------------------------------------------------------


class TestRegisterProject:
    @pytest.mark.asyncio
    async def test_register_project_201(self, async_client, project_dir):
        resp = await async_client.post(
            "/api/projects", json={"path": str(project_dir)}
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["status"] == "active"
        assert data["message"] == "registered"

    @pytest.mark.asyncio
    async def test_register_project_422_no_state_json(self, async_client, tmp_path):
        empty_dir = tmp_path / "empty_project"
        empty_dir.mkdir()
        resp = await async_client.post(
            "/api/projects", json={"path": str(empty_dir)}
        )
        assert resp.status_code == 422
        assert "STATE.json" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_register_project_idempotent(self, async_client, project_dir):
        resp1 = await async_client.post(
            "/api/projects", json={"path": str(project_dir)}
        )
        resp2 = await async_client.post(
            "/api/projects", json={"path": str(project_dir)}
        )
        assert resp1.status_code == 201
        assert resp2.status_code == 201
        assert resp1.json()["id"] == resp2.json()["id"]

    @pytest.mark.asyncio
    async def test_register_project_custom_name(self, async_client, project_dir):
        resp = await async_client.post(
            "/api/projects",
            json={"path": str(project_dir), "name": "CustomName"},
        )
        assert resp.status_code == 201
        # Verify name via detail endpoint
        pid = resp.json()["id"]
        detail = await async_client.get(f"/api/projects/{pid}")
        assert detail.json()["name"] == "CustomName"


# ---------------------------------------------------------------------------
# Listing tests
# ---------------------------------------------------------------------------


class TestListProjects:
    @pytest.mark.asyncio
    async def test_list_projects_empty(self, async_client):
        resp = await async_client.get("/api/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_projects_returns_registered(
        self, async_client, project_dir
    ):
        await async_client.post(
            "/api/projects", json={"path": str(project_dir)}
        )
        resp = await async_client.get("/api/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == "TestProject"

    @pytest.mark.asyncio
    async def test_list_projects_pagination(self, async_client, tmp_path):
        for i in range(3):
            d = _make_project_dir(tmp_path, f"proj{i}")
            await async_client.post("/api/projects", json={"path": str(d)})

        resp = await async_client.get("/api/projects?page=1&per_page=2")
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3

    @pytest.mark.asyncio
    async def test_list_projects_page_2(self, async_client, tmp_path):
        for i in range(3):
            d = _make_project_dir(tmp_path, f"proj{i}")
            await async_client.post("/api/projects", json={"path": str(d)})

        resp = await async_client.get("/api/projects?page=2&per_page=2")
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["total"] == 3


# ---------------------------------------------------------------------------
# Detail tests
# ---------------------------------------------------------------------------


class TestGetProjectDetail:
    @pytest.mark.asyncio
    async def test_get_project_detail(self, async_client, project_dir):
        reg = await async_client.post(
            "/api/projects", json={"path": str(project_dir)}
        )
        pid = reg.json()["id"]
        resp = await async_client.get(f"/api/projects/{pid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == pid
        assert data["name"] == "TestProject"
        assert data["path"] == str(project_dir)
        assert isinstance(data["milestones"], list)
        assert len(data["milestones"]) == 1
        assert data["milestones"][0]["id"] == "m1"

    @pytest.mark.asyncio
    async def test_get_project_not_found_404(self, async_client):
        fake_id = str(uuid4())
        resp = await async_client.get(f"/api/projects/{fake_id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Deregistration tests
# ---------------------------------------------------------------------------


class TestDeregisterProject:
    @pytest.mark.asyncio
    async def test_deregister_project_200(self, async_client, project_dir):
        reg = await async_client.post(
            "/api/projects", json={"path": str(project_dir)}
        )
        pid = reg.json()["id"]
        resp = await async_client.delete(f"/api/projects/{pid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "deregistered"
        assert data["message"] == "deregistered"

    @pytest.mark.asyncio
    async def test_deregister_project_not_found_404(self, async_client):
        fake_id = str(uuid4())
        resp = await async_client.delete(f"/api/projects/{fake_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_deregister_then_list_empty(self, async_client, project_dir):
        reg = await async_client.post(
            "/api/projects", json={"path": str(project_dir)}
        )
        pid = reg.json()["id"]
        await async_client.delete(f"/api/projects/{pid}")
        resp = await async_client.get("/api/projects")
        assert resp.json()["total"] == 0
        assert resp.json()["items"] == []
