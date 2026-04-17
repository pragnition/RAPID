"""Chat persistence models — Chat, ChatMessage, ChatAttachment tables."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Index
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    # Local copy to avoid the app.models <-> app.database circular import.
    # Mirrors app.database._utcnow.
    return datetime.now(timezone.utc)


class Chat(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id", index=True)
    skill_name: str
    title: str = Field(default="")  # auto-filled from first user message if empty
    session_status: str = Field(default="active", index=True)  # active | idle | archived
    active_run_id: UUID | None = Field(default=None, foreign_key="agentrun.id", index=True)
    created_at: datetime = Field(default_factory=_utcnow, index=True)
    last_message_at: datetime = Field(default_factory=_utcnow, index=True)
    archived_at: datetime | None = Field(default=None)


class ChatMessage(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    chat_id: UUID = Field(foreign_key="chat.id", index=True)
    seq: int = Field(index=True)  # monotonic within chat_id
    role: str = Field(index=True)  # user | assistant | tool
    content: str = Field(default="")  # rendered markdown text
    tool_calls: str = Field(default="[]")  # JSON array of {tool_use_id, tool_name, input, ...}
    tool_use_id: str | None = Field(default=None)  # set for role='tool' messages
    agent_run_id: UUID | None = Field(default=None, foreign_key="agentrun.id", index=True)
    temp_id: str | None = Field(default=None, index=True)  # client-gen UUID for optimistic reconciliation
    created_at: datetime = Field(default_factory=_utcnow, index=True)

    __table_args__ = (
        Index("uq_chat_message_chat_seq", "chat_id", "seq", unique=True),
    )


class AttachmentKind(str, Enum):
    FILE = "file"
    IMAGE = "image"
    CODE = "code"


class ChatAttachment(SQLModel, table=True):
    """Stub table for v7.1 -- all non-PK fields nullable so v7.1 can tighten constraints."""
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    chat_id: UUID | None = Field(default=None, foreign_key="chat.id", index=True)
    message_id: UUID | None = Field(default=None, foreign_key="chatmessage.id", index=True)
    kind: str | None = Field(default=None)  # AttachmentKind value
    payload: str | None = Field(default=None)  # JSON
