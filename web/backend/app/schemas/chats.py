"""Request/response schemas for the ``/api/chats`` router."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatCreateRequest(BaseModel):
    project_id: UUID
    skill_name: str = Field(min_length=1, max_length=128)
    title: str | None = Field(default=None, max_length=255)


class ChatMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1)
    temp_id: str | None = Field(default=None)


class ChatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    skill_name: str
    title: str
    session_status: Literal["active", "idle", "archived"]
    active_run_id: UUID | None
    created_at: datetime
    last_message_at: datetime
    archived_at: datetime | None


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    chat_id: UUID
    seq: int
    role: Literal["user", "assistant", "tool"]
    content: str
    tool_calls: list[dict[str, Any]]  # JSON-decoded
    tool_use_id: str | None
    agent_run_id: UUID | None
    temp_id: str | None
    created_at: datetime


class ChatListResponse(BaseModel):
    items: list[ChatResponse]
    total: int
