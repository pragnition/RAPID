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
