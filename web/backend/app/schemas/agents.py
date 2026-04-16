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
    """POST /{id}/answer body -- used by the ask_user MCP tool path (web-tool-bridge).

    ``prompt_id`` is the real acknowledgement handle (server-minted). ``tool_use_id``
    is preserved for backwards compatibility during the frozen-contract transition.
    """

    tool_use_id: str
    answer: str
    prompt_id: str | None = None


class PendingPromptResponse(BaseModel):
    """Returned by ``GET /runs/{id}/pending-prompt`` when a pending prompt exists."""

    prompt_id: str
    run_id: UUID
    kind: Literal["ask_user"]
    question: str
    options: list[str] | None = None
    allow_free_text: bool = True
    created_at: datetime
    batch_id: str | None = None
    batch_position: int | None = None
    batch_total: int | None = None


class AgentRunListResponse(BaseModel):
    items: list[AgentRunResponse]
    total: int


class InterruptResponse(BaseModel):
    ok: bool = True
