"""Pydantic v2 discriminated-union SSE event schema.

Evolution policy: additive-only. Never add a ``version`` field — forward-compat
is achieved by ``extra="allow"`` on the base class and new event ``kind``s.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class _BaseEvent(BaseModel):
    model_config = ConfigDict(extra="allow")  # forward-compat: additive-only schema
    seq: int
    ts: datetime
    run_id: UUID


class AssistantTextEvent(_BaseEvent):
    kind: Literal["assistant_text"] = "assistant_text"
    text: str


class ThinkingEvent(_BaseEvent):
    kind: Literal["thinking"] = "thinking"
    text: str


class ToolUseEvent(_BaseEvent):
    kind: Literal["tool_use"] = "tool_use"
    tool_name: str
    tool_use_id: str
    input: dict


class ToolResultEvent(_BaseEvent):
    kind: Literal["tool_result"] = "tool_result"
    tool_use_id: str
    output: dict | list | str | None
    is_error: bool = False


class QuestionOption(BaseModel):
    """Rich option for a question: label + optional description and preview."""
    label: str
    description: str | None = None
    preview: str | None = None


class QuestionDef(BaseModel):
    """Single question definition within a multi-question prompt."""
    question: str
    header: str | None = None  # max 12 chars, displayed as chip/tag
    options: list[QuestionOption] | None = None
    multi_select: bool = False
    allow_free_text: bool = True


class AskUserEvent(_BaseEvent):
    kind: Literal["ask_user"] = "ask_user"
    # Server-minted prompt id (web-tool-bridge). Frontend echoes this back in
    # POST /runs/{id}/answer so the backend can reject stale answers (409).
    prompt_id: str
    tool_use_id: str
    question: str
    options: list[str] | None = None
    allow_free_text: bool = True
    # Multi-question support: when present, supersedes question/options/allow_free_text.
    questions: list[QuestionDef] | None = None


class PermissionReqEvent(_BaseEvent):
    kind: Literal["permission_req"] = "permission_req"
    tool_name: str
    tool_use_id: str
    reason: str
    blocked: bool


class StatusEvent(_BaseEvent):
    kind: Literal["status"] = "status"
    status: Literal["pending", "running", "waiting", "idle", "interrupted", "failed", "completed"]
    detail: str | None = None


class RunCompleteEvent(_BaseEvent):
    kind: Literal["run_complete"] = "run_complete"
    status: Literal["completed", "failed", "interrupted"]
    total_cost_usd: float
    turn_count: int
    duration_s: float
    error_code: str | None = None
    error_detail: dict | None = None


class ReplayTruncatedEvent(_BaseEvent):
    kind: Literal["replay_truncated"] = "replay_truncated"
    oldest_available_seq: int
    requested_since_seq: int
    reason: Literal["retention_cap", "archived"]


class RetentionWarningEvent(_BaseEvent):
    kind: Literal["retention_warning"] = "retention_warning"
    event_count: int
    cap: int


SseEvent = Annotated[
    Union[
        AssistantTextEvent,
        ThinkingEvent,
        ToolUseEvent,
        ToolResultEvent,
        AskUserEvent,
        PermissionReqEvent,
        StatusEvent,
        RunCompleteEvent,
        ReplayTruncatedEvent,
        RetentionWarningEvent,
    ],
    Field(discriminator="kind"),
]


def serialize_event(evt: "SseEvent") -> dict:
    return evt.model_dump(mode="json")


EVENT_KINDS: frozenset[str] = frozenset(
    {
        "assistant_text",
        "thinking",
        "tool_use",
        "tool_result",
        "ask_user",
        "permission_req",
        "status",
        "run_complete",
        "replay_truncated",
        "retention_warning",
    }
)
