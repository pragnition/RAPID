"""Tests for chat_service — thread CRUD, message persistence, and lifecycle."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlmodel import Session

from app.agents.errors import StateError
from app.database import Project
from app.services import chat_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture()
def project(session: Session) -> Project:
    """Create and return a test project."""
    proj = Project(name="test-proj", path=f"/tmp/test-chat-svc-{uuid4().hex[:8]}")
    session.add(proj)
    session.commit()
    session.refresh(proj)
    return proj


@pytest.fixture()
def mock_mgr() -> MagicMock:
    """Mock AgentSessionManager (we don't need a real one for unit tests)."""
    return MagicMock()


# ---------------------------------------------------------------------------
# create_thread
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_thread_returns_row_with_defaults(session: Session, project: Project):
    chat = await chat_service.create_thread(session, project.id, "test-skill")
    assert chat.session_status == "active"
    assert chat.title == ""
    assert chat.archived_at is None
    assert chat.project_id == project.id
    assert chat.skill_name == "test-skill"


@pytest.mark.asyncio
async def test_create_thread_with_title(session: Session, project: Project):
    chat = await chat_service.create_thread(session, project.id, "test-skill", title="My Chat")
    assert chat.title == "My Chat"


@pytest.mark.asyncio
async def test_create_thread_unknown_project_raises_state_error(session: Session):
    with pytest.raises(StateError) as exc_info:
        await chat_service.create_thread(session, uuid4(), "test-skill")
    assert exc_info.value.error_code == "project_not_found"


# ---------------------------------------------------------------------------
# list_threads
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_threads_filters_archived_by_default(session: Session, project: Project):
    # Create 2 active + 1 archived
    c1 = await chat_service.create_thread(session, project.id, "s1")
    c2 = await chat_service.create_thread(session, project.id, "s2")
    c3 = await chat_service.create_thread(session, project.id, "s3")
    await chat_service.archive_thread(session, c3.id)

    items, total = await chat_service.list_threads(session, project.id)
    assert total == 2
    assert len(items) == 2
    ids = {c.id for c in items}
    assert c1.id in ids
    assert c2.id in ids
    assert c3.id not in ids


@pytest.mark.asyncio
async def test_list_threads_includes_archived_when_flag_set(session: Session, project: Project):
    await chat_service.create_thread(session, project.id, "s1")
    await chat_service.create_thread(session, project.id, "s2")
    c3 = await chat_service.create_thread(session, project.id, "s3")
    await chat_service.archive_thread(session, c3.id)

    items, total = await chat_service.list_threads(session, project.id, include_archived=True)
    assert total == 3
    assert len(items) == 3


@pytest.mark.asyncio
async def test_list_threads_orders_by_last_message_at_desc(session: Session, project: Project, mock_mgr):
    c1 = await chat_service.create_thread(session, project.id, "s1")
    await chat_service.create_thread(session, project.id, "s2")

    # Send a message to c1 so its last_message_at is updated (later than c2)
    await chat_service.send_message(session, mock_mgr, c1.id, "hello")

    items, _ = await chat_service.list_threads(session, project.id)
    # c1 should be first (newest last_message_at)
    assert items[0].id == c1.id


# ---------------------------------------------------------------------------
# send_message
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_send_message_persists_user_message_with_seq_1(
    session: Session, project: Project, mock_mgr
):
    chat = await chat_service.create_thread(session, project.id, "s1")
    msg = await chat_service.send_message(session, mock_mgr, chat.id, "hello world")
    assert msg.seq == 1
    assert msg.role == "user"
    assert msg.content == "hello world"
    assert msg.chat_id == chat.id


@pytest.mark.asyncio
async def test_send_message_monotonic_seq(session: Session, project: Project, mock_mgr):
    chat = await chat_service.create_thread(session, project.id, "s1")
    m1 = await chat_service.send_message(session, mock_mgr, chat.id, "first")
    m2 = await chat_service.send_message(session, mock_mgr, chat.id, "second")
    assert m1.seq == 1
    assert m2.seq == 2


@pytest.mark.asyncio
async def test_send_message_sets_temp_id_when_provided(
    session: Session, project: Project, mock_mgr
):
    chat = await chat_service.create_thread(session, project.id, "s1")
    temp = str(uuid4())
    msg = await chat_service.send_message(session, mock_mgr, chat.id, "hello", temp_id=temp)
    assert msg.temp_id == temp


@pytest.mark.asyncio
async def test_send_message_auto_fills_title_from_first_message(
    session: Session, project: Project, mock_mgr
):
    chat = await chat_service.create_thread(session, project.id, "s1")
    assert chat.title == ""
    await chat_service.send_message(session, mock_mgr, chat.id, "My first message")
    # Refresh the chat to see the updated title
    session.refresh(chat)
    assert chat.title == "My first message"


# ---------------------------------------------------------------------------
# archive_thread
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_archive_thread_sets_archived_at(session: Session, project: Project):
    chat = await chat_service.create_thread(session, project.id, "s1")
    archived = await chat_service.archive_thread(session, chat.id)
    assert archived.archived_at is not None
    assert archived.session_status == "archived"


@pytest.mark.asyncio
async def test_archive_thread_rejects_send_message(
    session: Session, project: Project, mock_mgr
):
    chat = await chat_service.create_thread(session, project.id, "s1")
    await chat_service.archive_thread(session, chat.id)

    with pytest.raises(StateError) as exc_info:
        await chat_service.send_message(session, mock_mgr, chat.id, "should fail")
    assert exc_info.value.error_code == "thread_archived"


# ---------------------------------------------------------------------------
# list_messages
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_messages_returns_in_seq_order(
    session: Session, project: Project, mock_mgr
):
    chat = await chat_service.create_thread(session, project.id, "s1")
    await chat_service.send_message(session, mock_mgr, chat.id, "first")
    await chat_service.send_message(session, mock_mgr, chat.id, "second")
    await chat_service.send_message(session, mock_mgr, chat.id, "third")

    messages = await chat_service.list_messages(session, chat.id)
    assert len(messages) == 3
    assert [m.seq for m in messages] == [1, 2, 3]


@pytest.mark.asyncio
async def test_list_messages_since_seq(session: Session, project: Project, mock_mgr):
    chat = await chat_service.create_thread(session, project.id, "s1")
    await chat_service.send_message(session, mock_mgr, chat.id, "m1")
    await chat_service.send_message(session, mock_mgr, chat.id, "m2")
    await chat_service.send_message(session, mock_mgr, chat.id, "m3")

    messages = await chat_service.list_messages(session, chat.id, since_seq=1)
    assert len(messages) == 2
    assert [m.seq for m in messages] == [2, 3]


# ---------------------------------------------------------------------------
# materialize_assistant_turn
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_materialize_assistant_turn_accumulates_text_and_tool_calls(
    session: Session, project: Project, mock_mgr
):
    chat = await chat_service.create_thread(session, project.id, "s1")
    # First send a user message
    await chat_service.send_message(session, mock_mgr, chat.id, "hello")

    run_id = uuid4()
    # We need an actual agent run for the FK
    from app.models.agent_run import AgentRun

    run = AgentRun(id=run_id, project_id=project.id, skill_name="test")
    session.add(run)
    session.commit()

    tool_calls = [{"tool_use_id": "tu_1", "tool_name": "Bash", "input": {"cmd": "ls"}}]
    msg = await chat_service.materialize_assistant_turn(
        session, chat.id, run_id, "Here is the output:", tool_calls=tool_calls
    )

    assert msg.role == "assistant"
    assert msg.content == "Here is the output:"
    assert msg.agent_run_id == run_id
    assert msg.seq == 2  # user message was seq=1

    import json

    decoded = json.loads(msg.tool_calls)
    assert len(decoded) == 1
    assert decoded[0]["tool_name"] == "Bash"


# ---------------------------------------------------------------------------
# Idle lifecycle -- stub test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_idle_thread_accepts_messages(session: Session, project: Project, mock_mgr):
    """Idle threads should still accept messages (idle -> active on next send)."""
    chat = await chat_service.create_thread(session, project.id, "s1")
    # Manually set to idle
    chat.session_status = "idle"
    session.add(chat)
    session.commit()

    # Should NOT raise
    msg = await chat_service.send_message(session, mock_mgr, chat.id, "wake up")
    assert msg.seq == 1
