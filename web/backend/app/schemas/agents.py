"""Request/response schemas for the ``/api/agents`` router.

These shapes are frozen as part of the Wave 4 contract freeze -- changes must
be additive only (new optional fields, new enum values), never breaking.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StartRunRequest(BaseModel):
    project_id: UUID
    skill_name: str = Field(min_length=1, max_length=128)
    skill_args: dict[str, Any] = Field(default_factory=dict)
    prompt: str = Field(min_length=1)
    set_id: str | None = Field(default=None, max_length=128)
    worktree: str | None = Field(default=None)  # absolute path if provided


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    set_id: str | None
    skill_name: str
    status: Literal[
        "pending", "running", "waiting", "interrupted", "failed", "completed"
    ]
    pid: int | None
    started_at: datetime
    ended_at: datetime | None
    active_duration_s: float
    total_wall_clock_s: float
    total_cost_usd: float
    max_turns: int
    turn_count: int
    error_code: str | None
    last_seq: int


class SendInputRequest(BaseModel):
    text: str = Field(min_length=1)


class AnswerRequest(BaseModel):
    """POST /{id}/answer body -- used only by the ask_user MCP tool path (Set 2)."""

    tool_use_id: str
    answer: str


class InterruptResponse(BaseModel):
    ok: bool = True
