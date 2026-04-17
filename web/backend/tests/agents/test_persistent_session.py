"""Tests for persistent agent session lifecycle.

Exercises the multi-turn persistent mode of ``AgentSession`` and the
``continue_session`` / idle-timeout logic in ``AgentSessionManager``.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
import sqlalchemy
from sqlmodel import Session

from app.agents.budget import RunBudget
from app.agents.event_bus import EventBus
from app.agents.session import AgentSession
from app.agents.session_manager import AgentSessionManager
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
    engine: sqlalchemy.Engine,
    run_id: UUID,
    event_bus: EventBus,
    persistent: bool = False,
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
        persistent=persistent,
    )


def _fake_result_message(cost: float = 0.01, turns: int = 1) -> object:
    return SimpleNamespace(
        total_cost_usd=cost,
        num_turns=turns,
        duration_ms=1000,
        is_error=False,
    )


def _fake_text_block(text: str) -> object:
    return SimpleNamespace(text=text)


# ---------- tests ----------


@pytest.mark.asyncio
async def test_persistent_flag_defaults_false(tables: sqlalchemy.Engine):
    """Default sessions are not persistent."""
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus)
    assert session._persistent is False
    assert session.is_idle is False


@pytest.mark.asyncio
async def test_persistent_session_is_created(tables: sqlalchemy.Engine):
    """Persistent sessions have the flag set."""
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus, persistent=True)
    assert session._persistent is True


@pytest.mark.asyncio
async def test_is_idle_property(tables: sqlalchemy.Engine):
    """is_idle returns True only when persistent AND _idle is set."""
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)

    # Non-persistent session is never idle
    session = _make_session(tables, run_id, bus, persistent=False)
    session._idle.set()
    assert session.is_idle is False

    # Persistent session without idle flag
    session2 = _make_session(tables, run_id, bus, persistent=True)
    assert session2.is_idle is False

    # Persistent session with idle flag
    session2._idle.set()
    assert session2.is_idle is True


@pytest.mark.asyncio
async def test_send_input_sets_new_query_when_idle(tables: sqlalchemy.Engine):
    """send_input sets _new_query when the session is persistent and idle."""
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus, persistent=True)
    session._idle.set()

    # Mock the client
    mock_client = AsyncMock()
    session._client = mock_client

    await session.send_input("new message")
    mock_client.query.assert_called_once_with("new message")
    assert session._new_query.is_set()


@pytest.mark.asyncio
async def test_send_input_does_not_set_new_query_when_not_idle(tables: sqlalchemy.Engine):
    """send_input does NOT set _new_query when session is not idle."""
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus, persistent=True)
    # _idle is NOT set

    mock_client = AsyncMock()
    session._client = mock_client

    await session.send_input("message")
    mock_client.query.assert_called_once_with("message")
    assert not session._new_query.is_set()


@pytest.mark.asyncio
async def test_continue_session_returns_false_for_nonexistent(
    tables: sqlalchemy.Engine, manager: AgentSessionManager
):
    """continue_session returns False when run_id is not in registry."""
    fake_id = uuid4()
    result = await manager.continue_session(fake_id, "hello")
    assert result is False


@pytest.mark.asyncio
async def test_continue_session_returns_false_for_non_idle(
    tables: sqlalchemy.Engine, manager: AgentSessionManager
):
    """continue_session returns False when session exists but is not idle."""
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus, persistent=True)
    session._client = AsyncMock()
    # Register session but don't set idle
    manager._sessions[run_id] = session

    result = await manager.continue_session(run_id, "hello")
    assert result is False


@pytest.mark.asyncio
async def test_continue_session_returns_true_for_idle(
    tables: sqlalchemy.Engine, manager: AgentSessionManager
):
    """continue_session returns True and calls send_input when idle."""
    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus, persistent=True)
    session._client = AsyncMock()
    session._idle.set()
    manager._sessions[run_id] = session

    result = await manager.continue_session(run_id, "new message")
    assert result is True
    session._client.query.assert_called_once_with("new message")
    assert session._new_query.is_set()


@pytest.mark.asyncio
async def test_backward_compat_non_persistent_run(tables: sqlalchemy.Engine):
    """Non-persistent session (default) behaves exactly as one-shot."""
    from unittest.mock import patch as _patch

    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus, persistent=False)

    # Create fake SDK types
    from app.agents.session import ResultMessage, TextBlock, AssistantMessage

    result_msg = _fake_result_message()
    # Make it pass isinstance checks
    fake_result = MagicMock(spec=ResultMessage)
    fake_result.total_cost_usd = 0.01
    fake_result.num_turns = 1
    fake_result.duration_ms = 1000
    fake_result.is_error = False

    async def fake_receive():
        yield fake_result

    mock_client = AsyncMock()
    mock_client.receive_response = fake_receive

    class _FakeClient:
        def __init__(self, **kw):
            pass

        async def connect(self):
            pass

        async def disconnect(self):
            pass

        async def query(self, prompt):
            pass

        def receive_response(self):
            return fake_receive()

    with _patch("app.agents.session.ClaudeSDKClient", _FakeClient):
        async with session:
            await session.run()

    # After run, session should NOT be idle (non-persistent)
    assert not session.is_idle
    assert session._run_complete_emitted is True


@pytest.mark.asyncio
async def test_active_states_includes_idle():
    """_ACTIVE_STATES must include 'idle' so orphan sweep doesn't reap idle sessions."""
    from app.agents.session_manager import _ACTIVE_STATES
    assert "idle" in _ACTIVE_STATES


# ---------- idle-timeout pending-prompt guard (Quick Task 29) ----------


def _insert_pending_prompt(
    engine: sqlalchemy.Engine, run_id: UUID, prompt_id: str
) -> None:
    """Insert a single AgentPrompt row with status='pending' for *run_id*."""
    from app.models.agent_prompt import AgentPrompt

    with Session(engine) as s:
        s.add(
            AgentPrompt(
                id=prompt_id,
                run_id=run_id,
                kind="ask_user",
                payload="{}",
                status="pending",
            )
        )
        s.commit()


def _resolve_prompt_in_db(
    engine: sqlalchemy.Engine, prompt_id: str, status: str = "answered"
) -> None:
    """Flip an existing AgentPrompt row off of 'pending' via the real DB."""
    from app.models.agent_prompt import AgentPrompt

    with Session(engine) as s:
        row = s.get(AgentPrompt, prompt_id)
        assert row is not None, f"prompt {prompt_id} missing"
        row.status = status
        s.add(row)
        s.commit()


async def _drive_task_until(
    task: asyncio.Task,
    predicate,
    *,
    max_ticks: int = 30,
    tick_s: float = 0.02,
):
    """Yield the event loop until ``predicate()`` is true or ``max_ticks`` elapse."""
    for _ in range(max_ticks):
        if predicate():
            return
        if task.done():
            return
        await asyncio.sleep(tick_s)


async def _cleanup_idle_task(
    task: asyncio.Task,
    manager: AgentSessionManager,
    run_id: UUID,
    session,
) -> None:
    """Cancel + await the bare idle-timeout task and release references.

    Leaves nothing dangling: the session is removed from the manager, the
    session's _idle event is cleared (so any surviving ``await _idle.wait()``
    returns immediately), the task is awaited to completion, and we yield
    once so any trailing ``asyncio.to_thread`` completions resolve before the
    fixture teardown disposes the test engine.
    """
    manager._sessions.pop(run_id, None)
    session._idle.clear()
    if not task.done():
        task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    # Explicitly dispose the engine reference to release SQLite connections
    # that may be held by in-flight `asyncio.to_thread(_load)` worker threads.
    await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_idle_timeout_fires_when_no_pending_prompt(
    tables: sqlalchemy.Engine,
    manager: AgentSessionManager,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    """With no pending prompt, the idle timeout interrupts the session."""
    import logging

    caplog.set_level(logging.WARNING, logger="rapid.agents.manager")
    # Plan says 0.1s; we keep the value but also collapse the outer wait
    # ``asyncio.sleep`` in ``_idle_timeout_task`` to a no-op so the test
    # doesn't burn real wall-clock time between iterations.
    monkeypatch.setattr("app.agents.session_manager._IDLE_TIMEOUT_S", 0.1)

    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus, persistent=True)
    session.interrupt = AsyncMock()
    session._idle.set()
    manager._sessions[run_id] = session

    task = asyncio.create_task(manager._idle_timeout_task(run_id))
    try:
        await _drive_task_until(task, lambda: session.interrupt.await_count >= 1)
        session.interrupt.assert_awaited_once()
    finally:
        await _cleanup_idle_task(task, manager, run_id, session)


@pytest.mark.asyncio
async def test_idle_timeout_deferred_while_prompt_pending(
    tables: sqlalchemy.Engine,
    manager: AgentSessionManager,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    """A pending AgentPrompt defers the interrupt; resolving it lets it fire."""
    import logging

    caplog.set_level(logging.WARNING, logger="rapid.agents.manager")
    monkeypatch.setattr("app.agents.session_manager._IDLE_TIMEOUT_S", 0.1)

    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus, persistent=True)
    session.interrupt = AsyncMock()
    session._idle.set()
    manager._sessions[run_id] = session

    prompt_id = f"pmt-{uuid4().hex[:8]}"
    _insert_pending_prompt(tables, run_id, prompt_id)

    task = asyncio.create_task(manager._idle_timeout_task(run_id))
    try:
        # Give the task ~2x the patched timeout — it should defer.
        await asyncio.sleep(0.22)
        assert session.interrupt.await_count == 0, (
            "interrupt should be deferred while prompt is pending"
        )

        # Resolve the prompt via the real DB so get_pending_prompt returns None.
        _resolve_prompt_in_db(tables, prompt_id, status="answered")

        await _drive_task_until(task, lambda: session.interrupt.await_count >= 1)
        session.interrupt.assert_awaited_once()
    finally:
        await _cleanup_idle_task(task, manager, run_id, session)


@pytest.mark.asyncio
async def test_idle_timeout_deferred_repeatedly_until_resolved(
    tables: sqlalchemy.Engine,
    manager: AgentSessionManager,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    """The loop re-arms on each idle tick until the pending prompt is resolved."""
    import logging

    caplog.set_level(logging.WARNING, logger="rapid.agents.manager")
    monkeypatch.setattr("app.agents.session_manager._IDLE_TIMEOUT_S", 0.1)

    run_id = uuid4()
    _seed_run(tables, run_id)
    bus = EventBus(tables)
    session = _make_session(tables, run_id, bus, persistent=True)
    session.interrupt = AsyncMock()
    session._idle.set()
    manager._sessions[run_id] = session

    prompt_id = f"pmt-{uuid4().hex[:8]}"
    _insert_pending_prompt(tables, run_id, prompt_id)

    task = asyncio.create_task(manager._idle_timeout_task(run_id))
    try:
        # Let the timer fire at least twice (~3x the patched timeout).
        await asyncio.sleep(0.32)
        assert session.interrupt.await_count == 0, (
            "interrupt should remain deferred across multiple idle cycles"
        )

        # Now resolve the prompt and wait for the next cycle.
        _resolve_prompt_in_db(tables, prompt_id, status="answered")

        await _drive_task_until(task, lambda: session.interrupt.await_count >= 1)
        session.interrupt.assert_awaited_once()
    finally:
        await _cleanup_idle_task(task, manager, run_id, session)
