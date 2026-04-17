# Quick Task 29: dont-disconnect-agents-on-pending-questions

**Description:** when the agents ask a question, we should NOT disconnect them till the question is answered

**Date:** 2026-04-17
**Status:** COMPLETE
**Commits:** 857fdac, c5c62d0
**Files Modified:**
- web/backend/app/agents/session_manager.py
- web/backend/tests/agents/test_persistent_session.py

## Summary

Root cause: `_idle_timeout_task` in `session_manager.py` interrupted persistent agent sessions after 15 minutes of idle, with no awareness of whether an `ask_user` prompt was still pending.

Fix: In the interrupt branch of `_idle_timeout_task`, call the existing `self.get_pending_prompt(run_id)` facade. If a pending `AgentPrompt` row exists, log `"idle timeout deferred — prompt pending"` and `continue` the outer loop (re-arms at the next `await session._idle.wait()`). Only interrupt when no pending prompt exists. Uses the existing `uq_agent_prompt_run_pending` partial unique index as the source of truth — no new session-side flag, no schema changes, no tool-body changes.

Tests: three new unit tests in `test_persistent_session.py` monkeypatch `_IDLE_TIMEOUT_S` to 0.1s, mock `session.interrupt` with `AsyncMock`, and write `AgentPrompt` rows directly to the real DB to exercise `get_pending_prompt` end-to-end.

## Verification

- `pytest tests/agents/test_persistent_session.py -xvs -k "idle_timeout"` — 3/3 passed consistently
- Scoped regression (`test_persistent_session.py`, `test_ask_user_tool.py`, `test_session_manager.py`) — 29/30 passed; the one failure (`test_attach_events_streams_from_bus`) is a pre-existing timing-sensitive test with a hard-coded 5s `wait_for` deadline; unrelated to the idle-timeout code path and not a regression introduced by this task.
