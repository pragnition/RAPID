"""Integration tests for the read-only view endpoints."""

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
    """Create a temporary project directory with all planning files."""
    proj = tmp_path / "testproject"
    planning = proj / ".planning"
    planning.mkdir(parents=True)

    # STATE.json
    state = {
        "version": 1,
        "projectName": "TestProject",
        "currentMilestone": "v1.0",
        "milestones": [
            {
                "id": "v1.0",
                "name": "MVP",
                "sets": [
                    {"id": "set-a", "status": "executing", "waves": [{"id": "w1"}]},
                    {"id": "set-b", "status": "complete", "waves": []},
                ],
            }
        ],
    }
    (planning / "STATE.json").write_text(json.dumps(state))

    # REGISTRY.json
    worktrees_dir = planning / "worktrees"
    worktrees_dir.mkdir()
    registry = {
        "version": 1,
        "worktrees": {
            "set-a": {
                "setName": "set-a",
                "branch": "rapid/set-a",
                "path": ".rapid-worktrees/set-a",
                "phase": "Created",
                "status": "active",
                "wave": 1,
                "createdAt": "2026-01-01T00:00:00Z",
                "solo": False,
                "mergeStatus": None,
                "mergedAt": None,
                "mergeCommit": None,
            },
            "set-b": {
                "setName": "set-b",
                "branch": "rapid/set-b",
                "path": ".rapid-worktrees/set-b",
                "phase": "Created",
                "status": "orphaned",
                "createdAt": "2026-01-02T00:00:00Z",
                "solo": True,
                "mergeStatus": "merged",
                "mergedAt": "2026-01-03T00:00:00Z",
                "mergeCommit": "abc123",
            },
        },
    }
    (worktrees_dir / "REGISTRY.json").write_text(json.dumps(registry))

    # DAG.json
    sets_dir = planning / "sets"
    sets_dir.mkdir()
    dag = {
        "nodes": [
            {"id": "set-a", "wave": 0, "status": "executing"},
            {"id": "set-b", "wave": 1, "status": "complete"},
        ],
        "edges": [
            {"from": "set-a", "to": "set-b"},
        ],
        "waves": {
            "0": {"sets": ["set-a"], "checkpoint": {}},
            "1": {"sets": ["set-b"], "checkpoint": {}},
        },
        "metadata": {"totalSets": 2},
    }
    (sets_dir / "DAG.json").write_text(json.dumps(dag))

    # Sample Python file for codebase endpoint
    (proj / "sample.py").write_text("def hello():\n    pass\n\nclass Foo:\n    def bar(self):\n        pass\n")

    return proj


async def _register_project(client, path: str) -> str:
    """Helper to register a project and return its UUID."""
    resp = await client.post("/api/projects", json={"path": path})
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# State endpoint tests
# ---------------------------------------------------------------------------


class TestStateEndpoint:
    @pytest.mark.asyncio
    async def test_state_200(self, async_client, project_dir):
        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.get(f"/api/projects/{pid}/state")
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == 1
        assert data["project_name"] == "TestProject"
        assert data["current_milestone"] == "v1.0"
        assert len(data["milestones"]) == 1
        assert len(data["milestones"][0]["sets"]) == 2

    @pytest.mark.asyncio
    async def test_state_404_no_project(self, async_client):
        fake_id = str(uuid4())
        resp = await async_client.get(f"/api/projects/{fake_id}/state")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_state_404_missing_file(self, async_client, tmp_path):
        # Create a project dir WITH STATE.json (for registration), then delete it
        proj = tmp_path / "vanishing"
        planning = proj / ".planning"
        planning.mkdir(parents=True)
        (planning / "STATE.json").write_text(json.dumps({
            "projectName": "vanishing",
            "milestones": [],
        }))
        pid = await _register_project(async_client, str(proj))
        # Now remove STATE.json
        (planning / "STATE.json").unlink()
        resp = await async_client.get(f"/api/projects/{pid}/state")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Worktree endpoint tests
# ---------------------------------------------------------------------------


class TestWorktreeEndpoint:
    @pytest.mark.asyncio
    async def test_worktrees_200(self, async_client, project_dir):
        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.get(f"/api/projects/{pid}/worktrees")
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] == 1
        assert isinstance(data["worktrees"], list)
        assert len(data["worktrees"]) == 2
        names = {w["set_name"] for w in data["worktrees"]}
        assert names == {"set-a", "set-b"}

    @pytest.mark.asyncio
    async def test_worktrees_snake_case_fields(self, async_client, project_dir):
        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.get(f"/api/projects/{pid}/worktrees")
        wt = resp.json()["worktrees"]
        merged = next(w for w in wt if w["set_name"] == "set-b")
        assert merged["merge_status"] == "merged"
        assert merged["merged_at"] == "2026-01-03T00:00:00Z"
        assert merged["merge_commit"] == "abc123"
        assert merged["solo"] is True

    @pytest.mark.asyncio
    async def test_worktrees_404_no_registry(self, async_client, tmp_path):
        proj = tmp_path / "no_registry"
        planning = proj / ".planning"
        planning.mkdir(parents=True)
        (planning / "STATE.json").write_text(json.dumps({
            "projectName": "no_registry",
            "milestones": [],
        }))
        pid = await _register_project(async_client, str(proj))
        resp = await async_client.get(f"/api/projects/{pid}/worktrees")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DAG endpoint tests
# ---------------------------------------------------------------------------


class TestDagEndpoint:
    @pytest.mark.asyncio
    async def test_dag_200(self, async_client, project_dir):
        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.get(f"/api/projects/{pid}/dag")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 1
        assert data["edges"][0]["source"] == "set-a"
        assert data["edges"][0]["target"] == "set-b"
        assert "0" in data["waves"]
        assert "1" in data["waves"]

    @pytest.mark.asyncio
    async def test_dag_404_no_dag_file(self, async_client, tmp_path):
        proj = tmp_path / "no_dag"
        planning = proj / ".planning"
        planning.mkdir(parents=True)
        (planning / "STATE.json").write_text(json.dumps({
            "projectName": "no_dag",
            "milestones": [],
        }))
        pid = await _register_project(async_client, str(proj))
        resp = await async_client.get(f"/api/projects/{pid}/dag")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Codebase endpoint tests
# ---------------------------------------------------------------------------


class TestCodebaseEndpoint:
    @pytest.mark.asyncio
    async def test_codebase_200(self, async_client, project_dir):
        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.get(f"/api/projects/{pid}/codebase")
        assert resp.status_code == 200
        data = resp.json()
        assert "files" in data
        assert "languages" in data
        assert "total_files" in data
        assert data["total_files"] >= 1
        assert "python" in data["languages"]

    @pytest.mark.asyncio
    async def test_codebase_max_files_param(self, async_client, project_dir):
        # Create multiple Python files
        for i in range(5):
            (project_dir / f"mod{i}.py").write_text(f"def func{i}(): pass\n")

        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.get(f"/api/projects/{pid}/codebase?max_files=2")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_files"] <= 2

    @pytest.mark.asyncio
    async def test_codebase_symbols_structure(self, async_client, project_dir):
        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.get(f"/api/projects/{pid}/codebase")
        data = resp.json()
        # Find sample.py in the response
        sample_files = [f for f in data["files"] if f["path"] == "sample.py"]
        assert len(sample_files) == 1
        symbols = sample_files[0]["symbols"]
        names = [s["name"] for s in symbols]
        assert "hello" in names
        assert "Foo" in names
        # Foo should have a child method
        foo = next(s for s in symbols if s["name"] == "Foo")
        assert len(foo["children"]) == 1
        assert foo["children"][0]["name"] == "bar"


# ---------------------------------------------------------------------------
# Read-only enforcement tests
# ---------------------------------------------------------------------------


class TestViewsReadOnly:
    @pytest.mark.asyncio
    async def test_no_post_on_state(self, async_client, project_dir):
        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.post(f"/api/projects/{pid}/state", json={})
        assert resp.status_code == 405

    @pytest.mark.asyncio
    async def test_no_put_on_worktrees(self, async_client, project_dir):
        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.put(f"/api/projects/{pid}/worktrees", json={})
        assert resp.status_code == 405

    @pytest.mark.asyncio
    async def test_no_delete_on_dag(self, async_client, project_dir):
        pid = await _register_project(async_client, str(project_dir))
        resp = await async_client.delete(f"/api/projects/{pid}/dag")
        assert resp.status_code == 405
