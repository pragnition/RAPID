"""Tests for ``app.agents.session.AgentSession`` (mock-heavy).

Wave 4 owns end-to-end SDK smoke tests; this file exercises the in-process
state-machine logic without spawning a real SDK subprocess.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
import sqlalchemy
from sqlmodel import Session

from app.agents.budget import RunBudget
from app.agents.event_bus import EventBus
from app.agents.session import AgentSession
from app.database import Project
from app.models.agent_run import AgentRun


# ---------- helpers ----------


def _seed_run(engine: sqlalchemy.Engine, run_id: UUID) -> UUID:
    with Session(engine) as s:
        project = Project(name="test-project", path=f"/tmp/test-{run_id}")
        s.add(project)
        s.commit()
        s.refresh(project)
        s.add(
            AgentRun(
                id=run_id,
                project_id=project.id,
                skill_name="execute-set",
                skill_args="{}",
                status="pending",
                max_turns=40,
            )
        )
        s.commit()
        return project.id


def _make_session(
    engine: sqlalchemy.Engine, run_id: UUID, event_bus: EventBus
) -> AgentSession:
    return AgentSession(
        run_id=run_id,
        project_root=Path("/tmp"),
        worktree=None,
        skill_name="execute-set",
        skill_args={},
        prompt="hello",
        event_bus=event_bus,
        engine=engine,
        budget=RunBudget(max_turns=40),
    )


def _fake_text_block(text: str) -> object:
    block = SimpleNamespace(text=text)
    return block


def _fake_tool_use_block(name: str, tool_id: str, inp: dict) -> object:
    return SimpleNamespace(name=name, id=tool_id, input=inp)


async def _drain_channel(bus: EventBus, run_id: UUID) -> list:
    """Snapshot the live ring buffer for assertions without attaching a subscriber."""
    ch = await bus.get_or_create_channel(run_id)
    return list(ch._ring)  # type: ignore[attr-defined]


# ---------- tests ----------


@pytest.mark.asyncio
async def test_handle_text_block_emits_assistant_text(
    tables: sqlalchemy.Engine,
) -> None:
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    try:
        session = _make_session(tables, run_id, bus)
        from claude_agent_sdk import AssistantMessage, TextBlock

        block = TextBlock(text="hello world")
        am = AssistantMessage(content=[block], model="claude-sonnet-4-5")

        await session._handle_message(am)
        events = await _drain_channel(bus, run_id)
        assert any(
            getattr(e, "kind", None) == "assistant_text"
            and getattr(e, "text", "") == "hello world"
            for e in events
        )
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_handle_tool_use_emits_tool_use(tables: sqlalchemy.Engine) -> None:
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    try:
        session = _make_session(tables, run_id, bus)
        from claude_agent_sdk import AssistantMessage, ToolUseBlock

        tu = ToolUseBlock(id="tu-1", name="Bash", input={"command": "ls"})
        am = AssistantMessage(content=[tu], model="claude-sonnet-4-5")

        await session._handle_message(am)
        events = await _drain_channel(bus, run_id)
        use_events = [e for e in events if getattr(e, "kind", None) == "tool_use"]
        assert use_events
        assert use_events[0].tool_name == "Bash"
        assert use_events[0].tool_use_id == "tu-1"
        assert use_events[0].input == {"command": "ls"}
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_handle_result_updates_db(tables: sqlalchemy.Engine) -> None:
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    try:
        session = _make_session(tables, run_id, bus)
        session._started_ts_mono = time.monotonic() - 1.5
        from claude_agent_sdk import ResultMessage

        result = ResultMessage(
            subtype="success",
            duration_ms=1500,
            duration_api_ms=1000,
            is_error=False,
            num_turns=5,
            session_id="sess-1",
            total_cost_usd=0.12,
            usage=None,
            result=None,
        )
        await session._handle_message(result)

        with Session(tables) as s:
            row = s.get(AgentRun, run_id)
            assert row is not None
            assert row.total_cost_usd == pytest.approx(0.12)
            assert row.turn_count == 5
            assert row.status == "completed"
            assert row.total_wall_clock_s >= 0
            assert row.active_duration_s >= 0
            assert row.total_wall_clock_s >= row.active_duration_s

        events = await _drain_channel(bus, run_id)
        complete = [e for e in events if getattr(e, "kind", None) == "run_complete"]
        assert complete
        assert complete[0].status == "completed"
        assert complete[0].turn_count == 5
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_handle_result_is_error_marks_failed(tables: sqlalchemy.Engine) -> None:
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    try:
        session = _make_session(tables, run_id, bus)
        session._started_ts_mono = time.monotonic()
        from claude_agent_sdk import ResultMessage

        result = ResultMessage(
            subtype="error",
            duration_ms=100,
            duration_api_ms=50,
            is_error=True,
            num_turns=1,
            session_id="sess-2",
            total_cost_usd=0.01,
            usage=None,
            result=None,
        )
        await session._handle_message(result)
        with Session(tables) as s:
            row = s.get(AgentRun, run_id)
            assert row is not None
            assert row.status == "failed"
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_interrupt_timeout_synthesizes_run_complete(
    tables: sqlalchemy.Engine,
) -> None:
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    try:
        session = _make_session(tables, run_id, bus)
        session._started_ts_mono = time.monotonic()

        class _HangingClient:
            async def interrupt(self) -> None:
                # Sleep longer than the 10s timeout; the session should bail.
                await asyncio.sleep(30.0)

            async def disconnect(self) -> None:
                return None

        session._client = _HangingClient()

        # Patch the 10s wait to something tight for the test.
        orig_wait_for = asyncio.wait_for

        async def _fast_wait_for(coro, timeout):
            return await orig_wait_for(coro, timeout=0.05)

        with patch("app.agents.session.asyncio.wait_for", side_effect=_fast_wait_for):
            await session.interrupt()

        events = await _drain_channel(bus, run_id)
        complete = [e for e in events if getattr(e, "kind", None) == "run_complete"]
        assert complete, "interrupt should synthesize a run_complete"
        assert complete[0].status == "interrupted"
        assert complete[0].error_code == "interrupt_timeout"
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_wall_clock_ge_active_duration(tables: sqlalchemy.Engine) -> None:
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    try:
        session = _make_session(tables, run_id, bus)
        session._started_ts_mono = time.monotonic()
        # Simulate a 200ms waiting window.
        session._enter_waiting()
        await asyncio.sleep(0.2)
        session._leave_waiting()
        # Another 50ms of active time.
        await asyncio.sleep(0.05)

        await session._emit_run_complete(status_text="completed")

        with Session(tables) as s:
            row = s.get(AgentRun, run_id)
            assert row is not None
            assert row.total_wall_clock_s >= row.active_duration_s >= 0.0
            # Waiting window should have been subtracted from active time.
            assert row.total_wall_clock_s - row.active_duration_s >= 0.15
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_run_complete_idempotent(tables: sqlalchemy.Engine) -> None:
    """Calling ``_emit_run_complete`` twice should emit only once."""
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    try:
        session = _make_session(tables, run_id, bus)
        session._started_ts_mono = time.monotonic()
        await session._emit_run_complete(status_text="completed")
        await session._emit_run_complete(status_text="interrupted")
        events = await _drain_channel(bus, run_id)
        complete = [e for e in events if getattr(e, "kind", None) == "run_complete"]
        assert len(complete) == 1
        assert complete[0].status == "completed"
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_send_input_without_client_raises(tables: sqlalchemy.Engine) -> None:
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    try:
        session = _make_session(tables, run_id, bus)
        from app.agents.errors import RunError

        with pytest.raises(RunError):
            await session.send_input("hello")
    finally:
        await bus.close()


@pytest.mark.asyncio
async def test_enter_status_event_via_fake_connect(tables: sqlalchemy.Engine) -> None:
    """Verify ``__aenter__`` emits a ``StatusEvent(status='running')``."""
    import os

    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)

    class _FakeClient:
        def __init__(self, options=None) -> None:  # noqa: D401
            self._process = SimpleNamespace(pid=os.getpid())

        async def connect(self) -> None:
            return None

        async def disconnect(self) -> None:
            return None

    try:
        with patch("app.agents.session.ClaudeSDKClient", _FakeClient):
            session = _make_session(tables, run_id, bus)
            # Enter manually so we can snapshot the ring before __aexit__
            # closes the channel.
            await session.__aenter__()
            events = await _drain_channel(bus, run_id)
            await session.__aexit__(None, None, None)
        statuses = [e for e in events if getattr(e, "kind", None) == "status"]
        assert any(s.status == "running" for s in statuses)
        # DB row should be in 'running' status.
        with Session(tables) as s:
            row = s.get(AgentRun, run_id)
            assert row is not None
            assert row.status == "running"
            assert row.pid == os.getpid()
    finally:
        await bus.close()
