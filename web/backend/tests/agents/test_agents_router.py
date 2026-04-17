"""Router tests for ``/api/agents/*`` endpoints.

Mocks :class:`AgentSessionManager` so no real SDK subprocesses are spawned.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.agents import StateError
from app.main import create_app
from app.models.agent_run import AgentRun


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_sse_starlette_event():
    """sse-starlette stashes a module-level anyio.Event bound to the first
    event loop it sees. Each TestClient call uses a fresh loop, so we must
    reset this before every test or SSE tests past the first crash with
    'bound to a different event loop'.
    """
    from sse_starlette import sse as _sse

    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None
    yield
    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None


@pytest.fixture
def app(tables):
    """Create a FastAPI app wired to the in-test engine (lifespan skipped)."""
    app = create_app()
    app.state.engine = tables
    # lifespan does not run under TestClient's simple context manager path
    # unless we use `with TestClient(app)`; for unit tests we bypass lifespan
    # and inject a mock manager directly.
    app.state.agent_manager = SimpleNamespace()
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


def _mk_run(**overrides) -> AgentRun:
    defaults = dict(
        id=uuid4(),
        project_id=uuid4(),
        set_id=None,
        skill_name="status",
        skill_args="{}",
        status="pending",
        pid=None,
        started_at=datetime.now(timezone.utc),
        ended_at=None,
        active_duration_s=0.0,
        total_wall_clock_s=0.0,
        total_cost_usd=0.0,
        max_turns=40,
        turn_count=0,
        error_code=None,
        error_detail="{}",
        last_seq=0,
    )
    defaults.update(overrides)
    return AgentRun(**defaults)


# ---------------------------------------------------------------------------
# POST /api/agents/runs
# ---------------------------------------------------------------------------


def test_post_runs_dispatches_and_returns_201(app, client):
    row = _mk_run()

    async def _fake_start_run(**kwargs):
        return row

    app.state.agent_manager.start_run = _fake_start_run  # type: ignore[attr-defined]

    body = {
        "project_id": str(row.project_id),
        "skill_name": "status",
        "skill_args": {},
        "prompt": "hi",
    }
    resp = client.post("/api/agents/runs", json=body)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["id"] == str(row.id)
    assert data["status"] == "pending"
    assert data["skill_name"] == "status"


def test_post_runs_409_on_state_error(app, client):
    async def _boom(**kwargs):
        raise StateError("already running", detail={"set_id": "x"})

    app.state.agent_manager.start_run = _boom  # type: ignore[attr-defined]

    body = {
        "project_id": str(uuid4()),
        "skill_name": "status",
        "skill_args": {},
        "prompt": "hi",
    }
    resp = client.post("/api/agents/runs", json=body)
    assert resp.status_code == 409
    data = resp.json()
    # The HTTPException is rendered via the existing http_exception_handler
    # which wraps it as {"detail": {...}}; the envelope lives inside detail.
    envelope = data.get("detail") or data
    assert envelope["error_code"] == "state_error"
    assert envelope["message"] == "already running"


def test_post_runs_missing_project_fields_422(client):
    resp = client.post("/api/agents/runs", json={})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/agents/runs/{id}
# ---------------------------------------------------------------------------


def test_get_run_returns_200(app, client):
    row = _mk_run()

    async def _get_run(run_id):
        assert run_id == row.id
        return row

    app.state.agent_manager.get_run = _get_run  # type: ignore[attr-defined]

    resp = client.get(f"/api/agents/runs/{row.id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == str(row.id)


def test_get_run_404_on_state_error(app, client):
    async def _boom(run_id):
        raise StateError("Run not found", detail={"run_id": str(run_id)})

    app.state.agent_manager.get_run = _boom  # type: ignore[attr-defined]

    resp = client.get(f"/api/agents/runs/{uuid4()}")
    # Taxonomy says StateError -> 409 (documented in CONTEXT/CONTRACT).
    assert resp.status_code == 409
    envelope = resp.json().get("detail") or resp.json()
    assert envelope["error_code"] == "state_error"


# ---------------------------------------------------------------------------
# POST /interrupt and /input
# ---------------------------------------------------------------------------


def test_post_interrupt_returns_200(app, client):
    called: dict = {}

    async def _interrupt(run_id):
        called["run_id"] = run_id

    app.state.agent_manager.interrupt = _interrupt  # type: ignore[attr-defined]

    run_id = uuid4()
    resp = client.post(f"/api/agents/runs/{run_id}/interrupt")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert called["run_id"] == run_id


def test_post_input_returns_204(app, client):
    captured: dict = {}

    async def _send_input(run_id, text):
        captured["text"] = text

    app.state.agent_manager.send_input = _send_input  # type: ignore[attr-defined]

    run_id = uuid4()
    resp = client.post(f"/api/agents/runs/{run_id}/input", json={"text": "hello"})
    assert resp.status_code == 204
    assert captured["text"] == "hello"


def test_post_input_missing_text_422(client):
    resp = client.post(f"/api/agents/runs/{uuid4()}/input", json={})
    assert resp.status_code == 422


def test_post_input_state_error_returns_409(app, client):
    async def _boom(run_id, text):
        raise StateError("Run not active", detail={"run_id": str(run_id)})

    app.state.agent_manager.send_input = _boom  # type: ignore[attr-defined]

    resp = client.post(
        f"/api/agents/runs/{uuid4()}/input", json={"text": "hello"}
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# POST /answer — web-tool-bridge Wave 1 (no longer a 501 stub)
# ---------------------------------------------------------------------------


def test_post_answer_without_prompt_id_returns_400(client):
    """Missing prompt_id in body should surface a 400 missing_prompt_id."""
    resp = client.post(
        f"/api/agents/runs/{uuid4()}/answer",
        json={"tool_use_id": "tu_1", "answer": "yes"},
    )
    assert resp.status_code == 400
    envelope = resp.json().get("detail") or resp.json()
    assert envelope["error_code"] == "missing_prompt_id"


def test_post_answer_unknown_prompt_returns_404(client):
    """Unknown prompt_id yields 404 prompt_not_found."""
    from app.agents.errors import StateError

    app = client.app

    async def _resolve(run_id, prompt_id, answer):  # noqa: ARG001
        raise StateError(
            "Prompt not found",
            detail={"prompt_id": prompt_id},
            error_code="prompt_not_found",
            http_status=404,
        )

    app.state.agent_manager.resolve_prompt = _resolve  # type: ignore[attr-defined]

    resp = client.post(
        f"/api/agents/runs/{uuid4()}/answer",
        json={
            "tool_use_id": "tu_1",
            "answer": "yes",
            "prompt_id": "p-nonexistent",
        },
    )
    assert resp.status_code == 404
    envelope = resp.json().get("detail") or resp.json()
    assert envelope["error_code"] == "prompt_not_found"


# ---------------------------------------------------------------------------
# SSE endpoint
# ---------------------------------------------------------------------------


def _mk_event(seq: int, kind: str = "assistant_text", run_id=None):
    from app.schemas.sse_events import (
        AssistantTextEvent,
        RunCompleteEvent,
    )

    if run_id is None:
        run_id = uuid4()
    if kind == "assistant_text":
        return AssistantTextEvent(
            seq=seq,
            ts=datetime.now(timezone.utc),
            run_id=run_id,
            text=f"hello {seq}",
        )
    if kind == "run_complete":
        return RunCompleteEvent(
            seq=seq,
            ts=datetime.now(timezone.utc),
            run_id=run_id,
            status="completed",
            total_cost_usd=0.01,
            turn_count=1,
            duration_s=0.1,
        )
    raise ValueError(kind)


def test_sse_endpoint_replays_backfill(app, client):
    run_id = uuid4()
    events = [
        _mk_event(1, "assistant_text", run_id),
        _mk_event(2, "assistant_text", run_id),
        _mk_event(3, "run_complete", run_id),
    ]

    async def _attach(run_id_arg, since=0):
        for e in events:
            yield e

    app.state.agent_manager.attach_events = _attach  # type: ignore[attr-defined]

    with client.stream("GET", f"/api/agents/runs/{run_id}/events") as resp:
        assert resp.status_code == 200
        assert resp.headers["cache-control"].lower().startswith("no-cache")
        assert resp.headers["x-accel-buffering"] == "no"
        body = b"".join(resp.iter_bytes())
    text = body.decode("utf-8")
    assert "id: 1" in text
    assert "event: assistant_text" in text
    assert "id: 2" in text
    assert "event: run_complete" in text
    assert "id: 3" in text


def test_sse_endpoint_accepts_since_query(app, client):
    captured: dict = {}

    async def _attach(run_id_arg, since=0):
        captured["since"] = since
        if False:
            yield  # make this an async generator

    app.state.agent_manager.attach_events = _attach  # type: ignore[attr-defined]

    run_id = uuid4()
    with client.stream(
        "GET", f"/api/agents/runs/{run_id}/events", params={"since": 42}
    ) as resp:
        assert resp.status_code == 200
        b"".join(resp.iter_bytes())
    assert captured["since"] == 42


def test_sse_endpoint_accepts_last_event_id_header(app, client):
    captured: dict = {}

    async def _attach(run_id_arg, since=0):
        captured["since"] = since
        if False:
            yield

    app.state.agent_manager.attach_events = _attach  # type: ignore[attr-defined]

    run_id = uuid4()
    with client.stream(
        "GET",
        f"/api/agents/runs/{run_id}/events",
        headers={"Last-Event-ID": "17"},
    ) as resp:
        assert resp.status_code == 200
        b"".join(resp.iter_bytes())
    assert captured["since"] == 17


def test_sse_query_wins_over_last_event_id(app, client):
    captured: dict = {}

    async def _attach(run_id_arg, since=0):
        captured["since"] = since
        if False:
            yield

    app.state.agent_manager.attach_events = _attach  # type: ignore[attr-defined]

    run_id = uuid4()
    with client.stream(
        "GET",
        f"/api/agents/runs/{run_id}/events",
        params={"since": 5},
        headers={"Last-Event-ID": "17"},
    ) as resp:
        assert resp.status_code == 200
        b"".join(resp.iter_bytes())
    assert captured["since"] == 5
