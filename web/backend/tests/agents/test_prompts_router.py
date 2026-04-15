"""Router tests for the three new prompt endpoints.

Mocks ``AgentSessionManager`` methods (``resolve_prompt``,
``get_pending_prompt``, ``reopen_prompt``) on ``app.state.agent_manager`` so
no real SDK subprocesses are spawned. Mirrors the pattern from
``test_agents_router.py``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.agents import StateError
from app.main import create_app
from app.models.agent_prompt import AgentPrompt


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_sse_starlette_event():
    from sse_starlette import sse as _sse

    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None
    yield
    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None


@pytest.fixture
def app(tables):
    app = create_app()
    app.state.engine = tables
    app.state.agent_manager = SimpleNamespace()
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


def _mk_prompt_row(**overrides) -> AgentPrompt:
    defaults = dict(
        id="p-1",
        run_id=uuid4(),
        kind="ask_user",
        payload='{"question":"pick one","options":["a","b"],"allow_free_text":false}',
        status="pending",
        answer=None,
        created_at=datetime.now(timezone.utc),
        answered_at=None,
        consumed_at=None,
        batch_id=None,
        batch_position=None,
    )
    defaults.update(overrides)
    return AgentPrompt(**defaults)


# ---------------------------------------------------------------------------
# POST /api/agents/runs/{id}/answer
# ---------------------------------------------------------------------------


def test_post_answer_happy_path_returns_204(app, client):
    captured: dict = {}

    async def _resolve(run_id, prompt_id, answer):
        captured["run_id"] = run_id
        captured["prompt_id"] = prompt_id
        captured["answer"] = answer

    app.state.agent_manager.resolve_prompt = _resolve  # type: ignore[attr-defined]

    run_id = uuid4()
    resp = client.post(
        f"/api/agents/runs/{run_id}/answer",
        json={"tool_use_id": "tu_1", "answer": "yes", "prompt_id": "p-1"},
    )
    assert resp.status_code == 204
    assert captured["prompt_id"] == "p-1"
    assert captured["answer"] == "yes"


def test_post_answer_missing_prompt_id_returns_400(app, client):
    resp = client.post(
        f"/api/agents/runs/{uuid4()}/answer",
        json={"tool_use_id": "tu_1", "answer": "yes"},
    )
    assert resp.status_code == 400
    envelope = resp.json().get("detail") or resp.json()
    assert envelope["error_code"] == "missing_prompt_id"


def test_post_answer_unknown_prompt_returns_404(app, client):
    async def _resolve(run_id, prompt_id, answer):
        raise StateError(
            "Prompt not found",
            detail={"prompt_id": prompt_id},
            error_code="prompt_not_found",
            http_status=404,
        )

    app.state.agent_manager.resolve_prompt = _resolve  # type: ignore[attr-defined]

    resp = client.post(
        f"/api/agents/runs/{uuid4()}/answer",
        json={"tool_use_id": "tu_1", "answer": "yes", "prompt_id": "p-x"},
    )
    assert resp.status_code == 404
    envelope = resp.json().get("detail") or resp.json()
    assert envelope["error_code"] == "prompt_not_found"


def test_post_answer_stale_prompt_returns_409(app, client):
    async def _resolve(run_id, prompt_id, answer):
        raise StateError(
            "Prompt is not pending",
            detail={"prompt_id": prompt_id, "status": "stale"},
            error_code="prompt_stale",
            http_status=409,
        )

    app.state.agent_manager.resolve_prompt = _resolve  # type: ignore[attr-defined]

    resp = client.post(
        f"/api/agents/runs/{uuid4()}/answer",
        json={"tool_use_id": "tu_1", "answer": "yes", "prompt_id": "p-stale"},
    )
    assert resp.status_code == 409
    envelope = resp.json().get("detail") or resp.json()
    assert envelope["error_code"] == "prompt_stale"


# ---------------------------------------------------------------------------
# GET /api/agents/runs/{id}/pending-prompt
# ---------------------------------------------------------------------------


def test_get_pending_prompt_returns_200_with_body(app, client):
    run_id = uuid4()
    row = _mk_prompt_row(run_id=run_id, batch_id="b1", batch_position=2)

    async def _get_pending(rid):
        assert rid == run_id
        return row

    app.state.agent_manager.get_pending_prompt = _get_pending  # type: ignore[attr-defined]

    resp = client.get(f"/api/agents/runs/{run_id}/pending-prompt")
    assert resp.status_code == 200
    body = resp.json()
    assert body["prompt_id"] == row.id
    assert body["run_id"] == str(run_id)
    assert body["kind"] == "ask_user"
    assert body["question"] == "pick one"
    assert body["options"] == ["a", "b"]
    assert body["allow_free_text"] is False
    assert body["batch_id"] == "b1"
    assert body["batch_position"] == 2


def test_get_pending_prompt_returns_204_when_none(app, client):
    async def _get_pending(rid):
        return None

    app.state.agent_manager.get_pending_prompt = _get_pending  # type: ignore[attr-defined]

    resp = client.get(f"/api/agents/runs/{uuid4()}/pending-prompt")
    assert resp.status_code == 204


def test_get_pending_prompt_unknown_run_returns_204(app, client):
    """Unknown run_id → manager returns None → 204 (NOT 404).

    The frontend doesn't need to distinguish 'no prompt' from 'no run'.
    """

    async def _get_pending(rid):
        return None

    app.state.agent_manager.get_pending_prompt = _get_pending  # type: ignore[attr-defined]

    resp = client.get(f"/api/agents/runs/{uuid4()}/pending-prompt")
    assert resp.status_code == 204


def test_get_pending_prompt_includes_batch_total_when_n_of_m(app, client):
    """``batch_total`` is decoded from the stored ``n_of_m`` payload field."""
    run_id = uuid4()
    row = _mk_prompt_row(
        run_id=run_id,
        payload='{"question":"q","options":null,"allow_free_text":true,"n_of_m":[2,3]}',
        batch_id="b-multi",
        batch_position=1,
    )

    async def _get_pending(rid):
        return row

    app.state.agent_manager.get_pending_prompt = _get_pending  # type: ignore[attr-defined]

    resp = client.get(f"/api/agents/runs/{run_id}/pending-prompt")
    assert resp.status_code == 200
    body = resp.json()
    assert body["batch_total"] == 3


# ---------------------------------------------------------------------------
# POST /api/agents/runs/{id}/prompts/{prompt_id}/reopen
# ---------------------------------------------------------------------------


def test_post_reopen_happy_path_returns_204(app, client):
    captured: dict = {}

    async def _reopen(run_id, prompt_id):
        captured["run_id"] = run_id
        captured["prompt_id"] = prompt_id

    app.state.agent_manager.reopen_prompt = _reopen  # type: ignore[attr-defined]

    run_id = uuid4()
    resp = client.post(f"/api/agents/runs/{run_id}/prompts/p-1/reopen")
    assert resp.status_code == 204
    assert captured["prompt_id"] == "p-1"


def test_post_reopen_already_pending_returns_400(app, client):
    async def _reopen(run_id, prompt_id):
        raise StateError(
            "Nothing to reopen; prompt is already pending",
            detail={"prompt_id": prompt_id},
            error_code="prompt_already_pending",
            http_status=400,
        )

    app.state.agent_manager.reopen_prompt = _reopen  # type: ignore[attr-defined]

    resp = client.post(
        f"/api/agents/runs/{uuid4()}/prompts/p-x/reopen"
    )
    assert resp.status_code == 400
    envelope = resp.json().get("detail") or resp.json()
    assert envelope["error_code"] == "prompt_already_pending"


def test_post_reopen_unknown_prompt_returns_404(app, client):
    async def _reopen(run_id, prompt_id):
        raise StateError(
            "Prompt not found",
            detail={"prompt_id": prompt_id},
            error_code="prompt_not_found",
            http_status=404,
        )

    app.state.agent_manager.reopen_prompt = _reopen  # type: ignore[attr-defined]

    resp = client.post(
        f"/api/agents/runs/{uuid4()}/prompts/nonexistent/reopen"
    )
    assert resp.status_code == 404
    envelope = resp.json().get("detail") or resp.json()
    assert envelope["error_code"] == "prompt_not_found"


def test_post_reopen_consumed_returns_409(app, client):
    async def _reopen(run_id, prompt_id):
        raise StateError(
            "Answer already consumed; interrupt the run to revise",
            detail={"prompt_id": prompt_id},
            error_code="answer_consumed",
            http_status=409,
        )

    app.state.agent_manager.reopen_prompt = _reopen  # type: ignore[attr-defined]

    resp = client.post(
        f"/api/agents/runs/{uuid4()}/prompts/p-consumed/reopen"
    )
    assert resp.status_code == 409
    envelope = resp.json().get("detail") or resp.json()
    assert envelope["error_code"] == "answer_consumed"
