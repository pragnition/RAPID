"""Tests for the SSE event discriminated union."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import TypeAdapter

from app.schemas.sse_events import (
    EVENT_KINDS,
    AskUserEvent,
    AssistantTextEvent,
    PermissionReqEvent,
    ReplayTruncatedEvent,
    RetentionWarningEvent,
    RunCompleteEvent,
    SseEvent,
    StatusEvent,
    ThinkingEvent,
    ToolResultEvent,
    ToolUseEvent,
    _BaseEvent,
    serialize_event,
)


def test_all_event_kinds_present():
    assert EVENT_KINDS == {
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


def test_discriminator_roundtrip():
    now = datetime.now(timezone.utc)
    run = uuid4()
    adapter = TypeAdapter(SseEvent)

    events: list[_BaseEvent] = [
        AssistantTextEvent(seq=1, ts=now, run_id=run, text="hi"),
        ThinkingEvent(seq=2, ts=now, run_id=run, text="hmm"),
        ToolUseEvent(seq=3, ts=now, run_id=run, tool_name="Bash", tool_use_id="t1", input={"cmd": "ls"}),
        ToolResultEvent(seq=4, ts=now, run_id=run, tool_use_id="t1", output="ok", is_error=False),
        AskUserEvent(seq=5, ts=now, run_id=run, prompt_id="p-2", tool_use_id="t2", question="which?"),
        PermissionReqEvent(seq=6, ts=now, run_id=run, tool_name="Bash", tool_use_id="t3", reason="r", blocked=False),
        StatusEvent(seq=7, ts=now, run_id=run, status="running"),
        RunCompleteEvent(seq=8, ts=now, run_id=run, status="completed", total_cost_usd=0.1, turn_count=2, duration_s=3.0),
        ReplayTruncatedEvent(seq=9, ts=now, run_id=run, oldest_available_seq=5, requested_since_seq=0, reason="retention_cap"),
        RetentionWarningEvent(seq=10, ts=now, run_id=run, event_count=1000, cap=500),
    ]
    for ev in events:
        dumped = serialize_event(ev)
        restored = adapter.validate_python(dumped)
        assert type(restored) is type(ev)


def test_extra_fields_allowed():
    now = datetime.now(timezone.utc)
    run = uuid4()
    payload = {
        "kind": "status",
        "seq": 1,
        "ts": now.isoformat(),
        "run_id": str(run),
        "status": "running",
        "future_field": "forward-compat",
    }
    adapter = TypeAdapter(SseEvent)
    evt = adapter.validate_python(payload)
    assert isinstance(evt, StatusEvent)


def test_no_version_field_on_base():
    assert "version" not in _BaseEvent.model_fields
