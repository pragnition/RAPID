"""Unit tests for ``webui_ask_user`` and ``ask_free_text`` SDK MCP tools.

Drives a real :class:`AgentSessionManager` against an in-memory SQLite engine
so the persistence side-effects (insert, mark answered, mark consumed, mark
stale) are visible. Resolves the prompt future via ``manager.resolve_prompt``
to simulate the HTTP /answer round trip without spinning up FastAPI.
"""

from __future__ import annotations

import asyncio
import json
from uuid import UUID, uuid4

import pytest
import sqlalchemy
from sqlmodel import Session, select

from app.agents.session_manager import AgentSessionManager
from app.agents.tools.ask_user import (
    build_ask_user_tools,
    emit_and_await_prompt,
)
from app.database import Project
from app.models.agent_prompt import AgentPrompt
from app.models.agent_run import AgentRun


# ---------- helpers ----------


def _seed_run(engine: sqlalchemy.Engine) -> UUID:
    with Session(engine) as s:
        p = Project(name="tool-test", path="/tmp/ask-user-tool")
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


def _get_pending_prompt_id_sync(
    engine: sqlalchemy.Engine, run_id: UUID
) -> str:
    with Session(engine) as s:
        rows = s.exec(
            select(AgentPrompt)
            .where(AgentPrompt.run_id == run_id)
            .where(AgentPrompt.status == "pending")
        ).all()
        assert rows, "no pending prompt found"
        return rows[0].id


# ---------- tests ----------


@pytest.mark.asyncio
async def test_webui_ask_user_happy_path(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    tools = build_ask_user_tools(run_id=run_id, manager=manager)
    handler = tools[0].handler  # webui_ask_user

    # Fire the tool body but don't await yet — we need the prompt persisted
    # before we can resolve it.
    call = asyncio.create_task(
        handler(
            {
                "question": "pick one",
                "options": ["a", "b"],
                "allow_free_text": False,
            }
        )
    )

    # Poll for the prompt to land in the DB (insert is awaited inside the
    # tool body before the future await).
    prompt_id: str | None = None
    for _ in range(50):
        await asyncio.sleep(0.01)
        try:
            prompt_id = await asyncio.to_thread(
                _get_pending_prompt_id_sync, tables, run_id
            )
            break
        except AssertionError:
            continue
    assert prompt_id is not None, "prompt was never persisted"

    # Resolve via the manager facade — same path the HTTP /answer endpoint uses.
    await manager.resolve_prompt(run_id, prompt_id, "a")

    result = await asyncio.wait_for(call, timeout=2.0)

    assert result == {
        "content": [{"type": "text", "text": "a"}],
        "is_error": False,
    }

    # Post-condition: row is answered + consumed_at populated.
    with Session(tables) as s:
        row = s.get(AgentPrompt, prompt_id)
        assert row is not None
        assert row.status == "answered"
        assert row.answer == "a"
        assert row.answered_at is not None
        assert row.consumed_at is not None

        # Payload should include the structured options.
        payload = json.loads(row.payload)
        assert payload["question"] == "pick one"
        assert payload["options"] == ["a", "b"]
        assert payload["allow_free_text"] is False


@pytest.mark.asyncio
async def test_ask_free_text_forces_free_text_and_no_options(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)
    tools = build_ask_user_tools(run_id=run_id, manager=manager)
    free_text_tool = tools[1]
    assert free_text_tool.name == "ask_free_text"
    handler = free_text_tool.handler

    call = asyncio.create_task(handler({"question": "what's your name?"}))

    prompt_id: str | None = None
    for _ in range(50):
        await asyncio.sleep(0.01)
        try:
            prompt_id = await asyncio.to_thread(
                _get_pending_prompt_id_sync, tables, run_id
            )
            break
        except AssertionError:
            continue
    assert prompt_id is not None

    # Confirm payload was forced to options=None / allow_free_text=True
    # before the user answers.
    with Session(tables) as s:
        row = s.get(AgentPrompt, prompt_id)
        assert row is not None
        payload = json.loads(row.payload)
        assert payload["options"] is None
        assert payload["allow_free_text"] is True

    await manager.resolve_prompt(run_id, prompt_id, "kek")
    result = await asyncio.wait_for(call, timeout=2.0)
    assert result["content"][0]["text"] == "kek"
    assert result["is_error"] is False


@pytest.mark.asyncio
async def test_cancellation_marks_prompt_stale_and_reraises(
    manager: AgentSessionManager, tables: sqlalchemy.Engine
) -> None:
    run_id = _seed_run(tables)

    call = asyncio.create_task(
        emit_and_await_prompt(
            run_id=run_id,
            manager=manager,
            question="will be cancelled",
            options=None,
            allow_free_text=True,
        )
    )

    # Wait for the row to land.
    prompt_id: str | None = None
    for _ in range(50):
        await asyncio.sleep(0.01)
        try:
            prompt_id = await asyncio.to_thread(
                _get_pending_prompt_id_sync, tables, run_id
            )
            break
        except AssertionError:
            continue
    assert prompt_id is not None

    # Cancel — simulates an interrupted run.
    call.cancel()
    with pytest.raises(asyncio.CancelledError):
        await call

    # Post-condition: row marked stale, NOT answered or consumed.
    with Session(tables) as s:
        row = s.get(AgentPrompt, prompt_id)
        assert row is not None
        assert row.status == "stale"
        assert row.answer is None
        assert row.consumed_at is None

    # The future entry should have been cleaned up so subsequent prompts on
    # the same prompt_id can re-register cleanly.
    assert prompt_id not in manager._prompt_futures
