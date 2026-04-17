"""Tests for Chat, ChatMessage, ChatAttachment model metadata and invariants."""

from __future__ import annotations

from uuid import uuid4

import pytest
import sqlalchemy
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel

from app.database import Project
from app.models.chat import AttachmentKind, Chat, ChatMessage


def _make_project(session: Session) -> Project:
    proj = Project(name="test", path=f"/tmp/test-chat-{uuid4()}")
    session.add(proj)
    session.commit()
    session.refresh(proj)
    return proj


def _make_chat(session: Session, project: Project) -> Chat:
    chat = Chat(project_id=project.id, skill_name="test-skill")
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat


def test_chat_model_registers_in_metadata(tables: sqlalchemy.Engine):
    assert "chat" in SQLModel.metadata.tables


def test_chatmessage_model_registers_in_metadata(tables: sqlalchemy.Engine):
    assert "chatmessage" in SQLModel.metadata.tables


def test_chatattachment_model_registers_in_metadata(tables: sqlalchemy.Engine):
    assert "chatattachment" in SQLModel.metadata.tables


def test_chatmessage_has_chat_fk(session: Session):
    """ChatMessage.chat_id must reference chat.id -- inserting with bogus chat_id fails."""
    msg = ChatMessage(chat_id=uuid4(), seq=1, role="user", content="hi")
    session.add(msg)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_chatmessage_unique_seq_per_chat(session: Session):
    """Two messages with same (chat_id, seq) must collide on the unique index."""
    proj = _make_project(session)
    chat = _make_chat(session, proj)

    m1 = ChatMessage(chat_id=chat.id, seq=1, role="user", content="first")
    session.add(m1)
    session.commit()

    m2 = ChatMessage(chat_id=chat.id, seq=1, role="user", content="duplicate")
    session.add(m2)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_chatmessage_different_chats_same_seq(session: Session):
    """Different chats can have the same seq -- the unique index is per-chat."""
    proj = _make_project(session)
    chat_a = _make_chat(session, proj)
    chat_b = _make_chat(session, proj)

    m1 = ChatMessage(chat_id=chat_a.id, seq=1, role="user", content="a")
    m2 = ChatMessage(chat_id=chat_b.id, seq=1, role="user", content="b")
    session.add(m1)
    session.add(m2)
    session.commit()  # no IntegrityError


def test_chatattachment_all_fields_nullable_except_id(tables: sqlalchemy.Engine):
    """ChatAttachment stub: all non-PK fields should be nullable."""
    from sqlalchemy import inspect

    insp = inspect(tables)
    cols = {c["name"]: c for c in insp.get_columns("chatattachment")}

    # PK should NOT be nullable
    assert cols["id"]["nullable"] is False

    # All other columns must be nullable
    for name in ("chat_id", "message_id", "kind", "payload"):
        assert cols[name]["nullable"] is True, f"{name} should be nullable"


def test_attachment_kind_enum_values():
    """AttachmentKind enum must have the exact values file/image/code."""
    assert AttachmentKind.FILE.value == "file"
    assert AttachmentKind.IMAGE.value == "image"
    assert AttachmentKind.CODE.value == "code"
    assert len(AttachmentKind) == 3


def test_chat_defaults(session: Session):
    """Chat row should have expected defaults when created with minimal fields."""
    proj = _make_project(session)
    chat = Chat(project_id=proj.id, skill_name="test-skill")
    session.add(chat)
    session.commit()
    session.refresh(chat)

    assert chat.title == ""
    assert chat.session_status == "active"
    assert chat.archived_at is None
    assert chat.created_at is not None
    assert chat.last_message_at is not None
