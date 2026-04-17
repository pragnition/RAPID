"""End-to-end integration test: tool body emits prompt → HTTP /pending-prompt
discovers it → HTTP /answer resolves → tool body returns.

Drives the real :class:`AgentSessionManager` against an in-memory SQLite engine.
Uses :class:`fastapi.testclient.TestClient` with the manager wired into
``app.state.agent_manager`` so the HTTP path runs through the real router.

This avoids spawning a full ``ClaudeSDKClient`` (the plan's "fake SDK client"
shorthand): instead we exercise the same code path the SDK would walk —
``webui_ask_user`` tool body emit → SSE event published → DB row persisted →
HTTP /pending-prompt + /answer round-trip → future resolved → tool result
returned to the caller.
"""

from __future__ import annotations

import asyncio
import json
import threading
import time
from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
import sqlalchemy
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.agents.session_manager import AgentSessionManager
from app.agents.tools.ask_user import build_ask_user_tools
from app.database import Project
from app.main import create_app
from app.models.agent_prompt import AgentPrompt
from app.models.agent_run import AgentRun


@pytest.fixture(autouse=True)
def _reset_sse_starlette_event():
    from sse_starlette import sse as _sse

    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None
    yield
    _sse.AppStatus.should_exit = False
    _sse.AppStatus.should_exit_event = None


def _seed_run(engine: sqlalchemy.Engine) -> UUID:
    suffix = uuid4().hex
    with Session(engine) as s:
        p = Project(name=f"e2e-{suffix}", path=f"/tmp/e2e-{suffix}")
        s.add(p)
        s.commit()
        s.refresh(p)
        run = AgentRun(
            id=uuid4(),
            project_id=p.id,
            skill_name="execute-set",
            skill_args="{}",
            status="running",
            max_turns=40,
        )
        s.add(run)
        s.commit()
        return run.id


@pytest.mark.asyncio
async def test_full_round_trip_emit_answer_consume(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    """Tool emits → HTTP /pending-prompt + /answer → tool returns "yes"."""
    run_id = _seed_run(tables)

    # Wire a real FastAPI app with our test manager so the router endpoints
    # operate against the same DB and futures.
    app = create_app()
    app.state.engine = tables
    app.state.agent_manager = manager

    # Build the tool using our manager + run_id — same closure the SDK would
    # produce inside AgentSession.__aenter__.
    tools = build_ask_user_tools(run_id=run_id, manager=manager)
    handler = tools[0].handler  # webui_ask_user

    # Spawn the tool body — it will block on the prompt future until /answer.
    tool_call = asyncio.create_task(
        handler(
            {
                "question": "ready?",
                "options": None,
                "allow_free_text": True,
            }
        )
    )

    # Drive the HTTP endpoints from a thread (TestClient is sync). We use a
    # thread + an asyncio.Event signal to bridge.
    answer_landed = threading.Event()
    discovered_prompt_id: dict[str, str] = {}

    def _drive_http() -> None:
        # Bypass lifespan (which would build a separate manager and miss
        # our in-memory futures). The fixture-built manager + tables are
        # already wired into app.state above.
        client = TestClient(app)
        # Poll /pending-prompt until the tool body has persisted the row.
        deadline = time.monotonic() + 3.0
        prompt_id: str | None = None
        while time.monotonic() < deadline and prompt_id is None:
            resp = client.get(f"/api/agents/runs/{run_id}/pending-prompt")
            if resp.status_code == 200:
                prompt_id = resp.json()["prompt_id"]
                break
            time.sleep(0.01)
        assert prompt_id is not None, "no pending prompt appeared"
        discovered_prompt_id["id"] = prompt_id

        # POST /answer with the discovered prompt_id.
        r2 = client.post(
            f"/api/agents/runs/{run_id}/answer",
            json={
                "tool_use_id": "tu_e2e",
                "answer": "yes",
                "prompt_id": prompt_id,
            },
        )
        assert r2.status_code == 204, r2.text
        answer_landed.set()

    http_thread = threading.Thread(target=_drive_http, daemon=True)
    http_thread.start()

    # Wait for the tool body to return — it should unblock once /answer fires.
    result = await asyncio.wait_for(tool_call, timeout=5.0)
    http_thread.join(timeout=2.0)
    assert not http_thread.is_alive(), "HTTP driver thread did not finish"

    # Tool result delivered to the (simulated) SDK.
    assert result == {
        "content": [{"type": "text", "text": "yes"}],
        "is_error": False,
    }

    # Final DB state: status=answered, consumed_at IS NOT NULL.
    prompt_id = discovered_prompt_id["id"]
    with Session(tables) as s:
        row = s.get(AgentPrompt, prompt_id)
        assert row is not None
        assert row.status == "answered"
        assert row.answer == "yes"
        assert row.answered_at is not None
        assert row.consumed_at is not None


@pytest.mark.asyncio
async def test_round_trip_persists_prompt_payload_for_pending_endpoint(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    """Pending-prompt endpoint sees the same question/options the tool emitted."""
    run_id = _seed_run(tables)

    app = create_app()
    app.state.engine = tables
    app.state.agent_manager = manager

    tools = build_ask_user_tools(run_id=run_id, manager=manager)
    handler = tools[0].handler

    tool_call = asyncio.create_task(
        handler(
            {
                "question": "pick one",
                "options": ["red", "green", "blue"],
                "allow_free_text": False,
            }
        )
    )

    fetched: dict = {}

    def _fetch_then_answer() -> None:
        client = TestClient(app)
        deadline = time.monotonic() + 3.0
        while time.monotonic() < deadline:
            resp = client.get(f"/api/agents/runs/{run_id}/pending-prompt")
            if resp.status_code == 200:
                fetched.update(resp.json())
                client.post(
                    f"/api/agents/runs/{run_id}/answer",
                    json={
                        "tool_use_id": "tu_e2e2",
                        "answer": "green",
                        "prompt_id": fetched["prompt_id"],
                    },
                )
                return
            time.sleep(0.01)
        raise AssertionError("no pending prompt appeared")

    t = threading.Thread(target=_fetch_then_answer, daemon=True)
    t.start()
    result = await asyncio.wait_for(tool_call, timeout=5.0)
    t.join(timeout=2.0)

    assert result["content"][0]["text"] == "green"
    assert fetched["question"] == "pick one"
    assert fetched["options"] == ["red", "green", "blue"]
    assert fetched["allow_free_text"] is False
