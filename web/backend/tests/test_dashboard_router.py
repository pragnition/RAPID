"""Tests for the consolidated ``GET /api/dashboard`` endpoint.

Pattern follows ``tests/test_projects_api.py``.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.database import KanbanCard, KanbanColumn, Project
from app.main import create_app
from app.models.agent_run import AgentRun
from app.models.chat import Chat
from app.routers.dashboard import _clear_cache


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _clear_dashboard_cache():
    """Ensure the dashboard cache is clear between tests."""
    _clear_cache()
    yield
    _clear_cache()


@pytest.fixture()
def test_engine(tmp_path):
    db_path = tmp_path / "test.db"
    eng = create_engine(
        f"sqlite:///{db_path}", connect_args={"check_same_thread": False}
    )
    SQLModel.metadata.create_all(eng)
    return eng


@pytest.fixture()
def app(test_engine):
    app = create_app()
    app.state.engine = test_engine
    app.state.start_time = time.time()
    app.state.agent_manager = SimpleNamespace()
    return app


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def project_id(test_engine) -> str:
    with Session(test_engine) as session:
        proj = Project(name="test-proj", path=f"/tmp/test-dash-{uuid4().hex[:8]}")
        session.add(proj)
        session.commit()
        session.refresh(proj)
        return str(proj.id)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _insert_runs(engine, project_id: str, statuses: list[str]):
    """Insert agent runs with given statuses."""
    from uuid import UUID

    pid = UUID(project_id)
    with Session(engine) as session:
        for s in statuses:
            run = AgentRun(
                project_id=pid,
                skill_name="test-skill",
                status=s,
            )
            session.add(run)
        session.commit()


def _insert_chats(engine, project_id: str, statuses: list[str], archive_indices: list[int] | None = None):
    """Insert chats with given session_statuses. archive_indices marks which to archive."""
    from uuid import UUID

    pid = UUID(project_id)
    archive_indices = archive_indices or []
    with Session(engine) as session:
        for i, s in enumerate(statuses):
            chat = Chat(
                project_id=pid,
                skill_name=f"skill-{i}",
                session_status=s,
                archived_at=datetime.now(timezone.utc) if i in archive_indices else None,
            )
            session.add(chat)
        session.commit()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_dashboard_returns_zero_counts_on_empty_db(client, project_id):
    resp = client.get(f"/api/dashboard?project_id={project_id}")
    assert resp.status_code == 200
    data = resp.json()

    assert data["runs_summary"]["running"] == 0
    assert data["runs_summary"]["waiting"] == 0
    assert data["runs_summary"]["failed"] == 0
    assert data["runs_summary"]["completed"] == 0
    assert data["runs_summary"]["recent"] == []

    assert data["chats_summary"]["active"] == 0
    assert data["chats_summary"]["idle"] == 0
    assert data["chats_summary"]["archived"] == 0

    assert data["kanban_summary"]["total"] == 0

    assert data["budget_remaining"]["spent_today"] == 0.0
    assert data["budget_remaining"]["remaining"] > 0

    assert data["recent_activity"] == []


def test_dashboard_runs_summary_counts_by_status(client, project_id, test_engine):
    _insert_runs(test_engine, project_id, ["running", "running", "completed", "failed", "waiting"])

    resp = client.get(f"/api/dashboard?project_id={project_id}")
    data = resp.json()

    assert data["runs_summary"]["running"] == 2
    assert data["runs_summary"]["completed"] == 1
    assert data["runs_summary"]["failed"] == 1
    assert data["runs_summary"]["waiting"] == 1


def test_dashboard_chats_summary_counts_active_idle_archived(client, project_id, test_engine):
    _insert_chats(
        test_engine,
        project_id,
        ["active", "active", "idle", "archived"],
        archive_indices=[3],
    )

    resp = client.get(f"/api/dashboard?project_id={project_id}")
    data = resp.json()

    assert data["chats_summary"]["active"] == 2
    assert data["chats_summary"]["idle"] == 1
    assert data["chats_summary"]["archived"] == 1


def test_dashboard_recent_runs_limited_to_5(client, project_id, test_engine):
    _insert_runs(test_engine, project_id, ["completed"] * 7)

    resp = client.get(f"/api/dashboard?project_id={project_id}")
    data = resp.json()

    assert len(data["runs_summary"]["recent"]) == 5


def test_dashboard_recent_activity_merges_and_sorts(client, project_id, test_engine):
    # Insert a mix of runs and chats
    _insert_runs(test_engine, project_id, ["completed"] * 3)
    _insert_chats(test_engine, project_id, ["active"] * 3)

    resp = client.get(f"/api/dashboard?project_id={project_id}")
    data = resp.json()

    activity = data["recent_activity"]
    assert len(activity) <= 10
    # Should have both runs and chats
    kinds = {a["kind"] for a in activity}
    assert "run" in kinds
    assert "chat" in kinds

    # Should be sorted by ts descending
    timestamps = [a["ts"] for a in activity]
    assert timestamps == sorted(timestamps, reverse=True)


def test_dashboard_budget_remaining_uses_settings_cap(client, project_id, monkeypatch):
    from app import config

    monkeypatch.setattr(config.settings, "rapid_agent_daily_cap_usd", 42.0)

    resp = client.get(f"/api/dashboard?project_id={project_id}")
    data = resp.json()

    assert data["budget_remaining"]["daily_cap"] == 42.0
    assert data["budget_remaining"]["remaining"] == 42.0


def test_dashboard_caches_within_1_second(client, project_id, test_engine):
    """Two rapid calls should return the same data (cache hit)."""
    # First call -- populates cache
    resp1 = client.get(f"/api/dashboard?project_id={project_id}")
    assert resp1.status_code == 200

    # Insert a run between the two calls
    _insert_runs(test_engine, project_id, ["completed"])

    # Second call -- should still hit cache (within 1s)
    resp2 = client.get(f"/api/dashboard?project_id={project_id}")
    assert resp2.status_code == 200

    # Cached: completed count should be 0 (the insert isn't reflected)
    assert resp2.json()["runs_summary"]["completed"] == 0


def test_dashboard_cache_invalidates_after_1_second(client, project_id, test_engine, monkeypatch):
    """After 1 second, the cache should be stale and recompute."""
    import app.routers.dashboard as dash_mod

    # First call
    resp1 = client.get(f"/api/dashboard?project_id={project_id}")
    assert resp1.status_code == 200

    # Insert a run
    _insert_runs(test_engine, project_id, ["completed"])

    # Advance the monotonic clock past TTL by manipulating the cache entry
    from uuid import UUID

    pid = UUID(project_id)
    if pid in dash_mod._cache:
        resp_obj, ts = dash_mod._cache[pid]
        # Set the timestamp to 2 seconds ago (past TTL)
        dash_mod._cache[pid] = (resp_obj, time.monotonic() - 2.0)

    # This call should recompute
    resp2 = client.get(f"/api/dashboard?project_id={project_id}")
    assert resp2.status_code == 200
    assert resp2.json()["runs_summary"]["completed"] == 1


def test_dashboard_kanban_summary(client, project_id, test_engine):
    """Kanban summary should count cards across project columns."""
    from uuid import UUID

    pid = UUID(project_id)
    with Session(test_engine) as session:
        col = KanbanColumn(
            project_id=pid,
            title="Backlog",
            position=0,
        )
        session.add(col)
        session.commit()
        session.refresh(col)

        for i in range(3):
            card = KanbanCard(column_id=col.id, title=f"Card {i}", position=i)
            session.add(card)
        session.commit()

    resp = client.get(f"/api/dashboard?project_id={project_id}")
    data = resp.json()
    assert data["kanban_summary"]["total"] == 3
