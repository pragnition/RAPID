"""Tests for the AUQ bridge-success is_error override.

Bug context: ``can_use_tool_hook_bound`` intercepts the built-in
``AskUserQuestion`` tool and routes it through the web bridge. On success
it has to deliver the answers payload back to the SDK via
``PermissionResultDeny(message=json.dumps(...))`` — there's no "allow but
override output" mode — and the SDK in turn materializes that as a
``ToolResultBlock`` with ``is_error=True``. Without the fix the UI would
render a ✗ on every successful AUQ call.

The fix records the ``tool_use_id`` on
``AgentSessionManager._auq_success_tool_use_ids`` at the moment the bridge
succeeds, and the session pump consults that set to flip ``is_error=False``
on the emitted ``ToolResultEvent``. These tests exercise both sides of
that contract.
"""

from __future__ import annotations

import json
import types
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.agents.permission_hooks import can_use_tool_hook_bound
from app.agents.session import _consume_auq_success
from app.agents.session_manager import AgentSessionManager


# ---------- helpers ----------


def _make_manager() -> AgentSessionManager:
    """Construct a manager with a mocked engine — we only poke its in-memory
    state, never its DB paths."""
    engine = MagicMock()
    return AgentSessionManager(engine)


def _ctx(tool_use_id: str = "tid-123"):
    return types.SimpleNamespace(tool_use_id=tool_use_id, suggestions=[])


# ---------- manager attribute ----------


def test_manager_initializes_auq_success_set_empty():
    """Regression: the new dict must exist on every fresh manager."""
    mgr = _make_manager()
    assert hasattr(mgr, "_auq_success_tool_use_ids")
    assert mgr._auq_success_tool_use_ids == {}


# ---------- _consume_auq_success helper ----------


def test_consume_auq_success_flips_and_consumes():
    mgr = _make_manager()
    run_id = uuid4()
    mgr._auq_success_tool_use_ids[run_id] = {"tid-123"}

    assert _consume_auq_success(mgr, run_id, "tid-123") is True
    # Entry consumed; run_id key collapses when the set empties.
    assert run_id not in mgr._auq_success_tool_use_ids


def test_consume_auq_success_leaves_other_ids_intact():
    mgr = _make_manager()
    run_id = uuid4()
    mgr._auq_success_tool_use_ids[run_id] = {"tid-123", "tid-456"}

    assert _consume_auq_success(mgr, run_id, "tid-123") is True
    assert mgr._auq_success_tool_use_ids[run_id] == {"tid-456"}


def test_consume_auq_success_returns_false_for_missing_id():
    mgr = _make_manager()
    run_id = uuid4()
    mgr._auq_success_tool_use_ids[run_id] = {"tid-456"}

    assert _consume_auq_success(mgr, run_id, "tid-123") is False
    # Nothing was mutated — the set is unchanged.
    assert mgr._auq_success_tool_use_ids[run_id] == {"tid-456"}


def test_consume_auq_success_returns_false_when_run_absent():
    mgr = _make_manager()
    run_id = uuid4()
    assert _consume_auq_success(mgr, run_id, "tid-123") is False
    assert mgr._auq_success_tool_use_ids == {}


# ---------- can_use_tool_hook_bound integration ----------


@pytest.mark.asyncio
async def test_auq_hook_registers_tool_use_id_on_success(monkeypatch):
    """A successful bridge call records the tool_use_id under the run_id."""
    mgr = _make_manager()
    run_id = uuid4()

    async def fake_route(_run_id, _manager, questions):
        return ["yes"] * len(questions)

    monkeypatch.setattr(
        "app.agents.permission_hooks._route_auq_through_bridge", fake_route
    )

    result = await can_use_tool_hook_bound(
        "AskUserQuestion",
        {"questions": [{"question": "ok?"}]},
        _ctx("tid-success"),
        run_id=run_id,
        manager=mgr,
    )

    # Success path still returns Deny-with-payload — that part is unchanged.
    assert result.behavior == "deny"
    payload = json.loads(result.message)
    assert payload == {"answers": ["yes"]}

    # The tool_use_id must have landed in the override set.
    assert mgr._auq_success_tool_use_ids[run_id] == {"tid-success"}


@pytest.mark.asyncio
async def test_auq_hook_does_not_register_on_bridge_failure(monkeypatch):
    """The auq_bridge_failed path must still render as an error — it must
    NOT register the tool_use_id (otherwise the UI would silently swallow
    genuine failures)."""
    mgr = _make_manager()
    run_id = uuid4()

    async def fake_route(_run_id, _manager, _questions):
        raise RuntimeError("bridge exploded")

    monkeypatch.setattr(
        "app.agents.permission_hooks._route_auq_through_bridge", fake_route
    )

    result = await can_use_tool_hook_bound(
        "AskUserQuestion",
        {"questions": [{"question": "ok?"}]},
        _ctx("tid-fail"),
        run_id=run_id,
        manager=mgr,
    )

    assert result.behavior == "deny"
    payload = json.loads(result.message)
    assert payload == {"error": "auq_bridge_failed"}

    # No registration on the failure path.
    assert run_id not in mgr._auq_success_tool_use_ids


@pytest.mark.asyncio
async def test_auq_hook_accumulates_multiple_tool_use_ids(monkeypatch):
    """Sequential successful AUQ calls on the same run accumulate until
    consumed by the session pump."""
    mgr = _make_manager()
    run_id = uuid4()

    async def fake_route(_run_id, _manager, questions):
        return [""] * len(questions)

    monkeypatch.setattr(
        "app.agents.permission_hooks._route_auq_through_bridge", fake_route
    )

    for tid in ("tid-1", "tid-2", "tid-3"):
        await can_use_tool_hook_bound(
            "AskUserQuestion",
            {"questions": [{"question": "?"}]},
            _ctx(tid),
            run_id=run_id,
            manager=mgr,
        )

    assert mgr._auq_success_tool_use_ids[run_id] == {"tid-1", "tid-2", "tid-3"}

    # Consuming one does not disturb the others.
    assert _consume_auq_success(mgr, run_id, "tid-2") is True
    assert mgr._auq_success_tool_use_ids[run_id] == {"tid-1", "tid-3"}
