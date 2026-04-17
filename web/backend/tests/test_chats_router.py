"""Router tests for ``/api/chats/*`` endpoints.

Mirrors the structure of ``tests/agents/test_agents_router.py``.
"""

from __future__ import annotations

import time
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from app.database import Project
from app.main import create_app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_sse_starlette_event():
    """Reset sse-starlette module-level event to avoid cross-test loop binding."""
    from sse_starlette import sse as _sse

    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None
    yield
    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None


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
    """Create a test project and return its UUID string."""
    with Session(test_engine) as session:
        proj = Project(name="test-proj", path=f"/tmp/test-chats-router-{uuid4().hex[:8]}")
        session.add(proj)
        session.commit()
        session.refresh(proj)
        return str(proj.id)


@pytest.fixture()
def chat_id(client, project_id) -> str:
    """Create a chat and return its UUID string."""
    resp = client.post(
        "/api/chats",
        json={"project_id": project_id, "skill_name": "test-skill"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# POST /api/chats
# ---------------------------------------------------------------------------


def test_create_chat_201(client, project_id):
    resp = client.post(
        "/api/chats",
        json={"project_id": project_id, "skill_name": "test-skill", "title": "My Chat"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["project_id"] == project_id
    assert data["skill_name"] == "test-skill"
    assert data["title"] == "My Chat"
    assert data["session_status"] == "active"
    assert data["archived_at"] is None


def test_create_chat_missing_skill_400(client, project_id):
    resp = client.post(
        "/api/chats",
        json={"project_id": project_id, "skill_name": ""},
    )
    assert resp.status_code == 422  # Pydantic validation


def test_create_chat_unknown_project_409(client):
    resp = client.post(
        "/api/chats",
        json={"project_id": str(uuid4()), "skill_name": "test-skill"},
    )
    # StateError(error_code='project_not_found') -> 409 via to_http_exception
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# GET /api/chats
# ---------------------------------------------------------------------------


def test_list_chats_200(client, project_id, chat_id):
    resp = client.get(f"/api/chats?project_id={project_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    assert any(c["id"] == chat_id for c in data["items"])


def test_list_chats_excludes_archived_by_default(client, project_id, test_engine):
    # Create 2 chats, archive 1
    client.post("/api/chats", json={"project_id": project_id, "skill_name": "s1"})
    r2 = client.post("/api/chats", json={"project_id": project_id, "skill_name": "s2"})
    chat2_id = r2.json()["id"]

    # Archive second chat
    client.post(f"/api/chats/{chat2_id}/archive")

    resp = client.get(f"/api/chats?project_id={project_id}")
    data = resp.json()
    ids = [c["id"] for c in data["items"]]
    assert chat2_id not in ids


def test_list_chats_with_include_archived_flag(client, project_id):
    client.post("/api/chats", json={"project_id": project_id, "skill_name": "s1"})
    r2 = client.post("/api/chats", json={"project_id": project_id, "skill_name": "s2"})
    chat2_id = r2.json()["id"]

    client.post(f"/api/chats/{chat2_id}/archive")

    resp = client.get(f"/api/chats?project_id={project_id}&include_archived=true")
    data = resp.json()
    ids = [c["id"] for c in data["items"]]
    assert chat2_id in ids


# ---------------------------------------------------------------------------
# GET /api/chats/{chat_id}
# ---------------------------------------------------------------------------


def test_get_chat_404(client):
    resp = client.get(f"/api/chats/{uuid4()}")
    assert resp.status_code == 404


def test_get_chat_200(client, chat_id):
    resp = client.get(f"/api/chats/{chat_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == chat_id


# ---------------------------------------------------------------------------
# POST /api/chats/{chat_id}/messages
# ---------------------------------------------------------------------------


def test_post_message_201(client, chat_id):
    temp = str(uuid4())
    resp = client.post(
        f"/api/chats/{chat_id}/messages",
        json={"content": "Hello!", "temp_id": temp},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "Hello!"
    assert data["role"] == "user"
    assert data["seq"] == 1
    assert data["temp_id"] == temp


def test_post_message_archived_thread_409(client, chat_id):
    client.post(f"/api/chats/{chat_id}/archive")
    resp = client.post(
        f"/api/chats/{chat_id}/messages",
        json={"content": "should fail"},
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# GET /api/chats/{chat_id}/messages
# ---------------------------------------------------------------------------


def test_list_messages_since_seq(client, chat_id):
    # Send 3 messages
    for i in range(3):
        client.post(f"/api/chats/{chat_id}/messages", json={"content": f"msg{i+1}"})

    resp = client.get(f"/api/chats/{chat_id}/messages?since_seq=1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["seq"] == 2
    assert data[1]["seq"] == 3


# ---------------------------------------------------------------------------
# POST /api/chats/{chat_id}/archive
# ---------------------------------------------------------------------------


def test_archive_chat_200(client, chat_id):
    resp = client.post(f"/api/chats/{chat_id}/archive")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_status"] == "archived"
    assert data["archived_at"] is not None


# ---------------------------------------------------------------------------
# GET /api/chats/{chat_id}/events (SSE)
# ---------------------------------------------------------------------------


def test_sse_events_endpoint_no_active_run_returns_empty_stream(client, chat_id):
    """SSE connection should close cleanly when the thread has no bound run."""
    resp = client.get(f"/api/chats/{chat_id}/events")
    assert resp.status_code == 200


def test_sse_events_endpoint_headers(client, chat_id):
    """SSE endpoint must include cache-control and proxy-buffering headers."""
    resp = client.get(f"/api/chats/{chat_id}/events")
    assert resp.headers.get("cache-control") == "no-cache"
    assert resp.headers.get("x-accel-buffering") == "no"
