# Quick Task 25: Autopilot Agent Completed Tag

## Objective

When an autopilot-dispatched agent run finishes, the kanban card's `agent_status` should transition from `"running"` to `"completed"` (on success) or `"blocked"` (on failure/error). Currently, `autopilot_worker.py` sets `agent_status = "running"` at dispatch time, but nothing updates it when the run ends. The `_run_session` method in `session_manager.py` is the natural place for this -- it already extracts `card_id` from `skill_args` and has access to both the run outcome and the DB engine.

## Analysis

**Current flow:**
1. `autopilot_worker._dispatch_card()` calls `session_manager.start_run()`, locks the card, sets `agent_status = "running"`.
2. `session_manager._run_session()` runs the agent session to completion.
3. `session.py` records run outcome (`completed`, `failed`, `interrupted`) in the `AgentRun` row.
4. `_run_session()` finally-block cleans up session dict and releases set lock.
5. **Gap:** Card `agent_status` is never set to `"completed"` -- it stays as `"running"` forever.

**Fix location:** The `finally` block of `_run_session()` in `session_manager.py`. After the session ends, read back the `AgentRun.status` from the DB and map it to the appropriate card `agent_status`:
- `completed` -> card `agent_status = "completed"`, set `completed_by_run_id`
- `failed` / `interrupted` -> card `agent_status = "blocked"`, increment `retry_count`

**Why session_manager and not autopilot_worker:** The autopilot worker fires-and-forgets via `start_run()`. It has no callback for when the run finishes. The session manager's `_run_session` is the async task that wraps the entire run lifecycle, so it's the correct place to add post-run card cleanup.

---

## Task 1: Update card agent_status on run completion in session_manager

**Files to modify:**
- `web/backend/app/agents/session_manager.py`

**Action:**
In the `finally` block of `_run_session()` (after line 307), add logic to update the kanban card's `agent_status` when the run had an associated `card_id` in its `skill_args`:

1. Extract `card_id` from `row.skill_args` (same pattern already used at line 282 for `bind_card_id`). Parse it once before the `try` block so it's available in `finally`.
2. In the `finally` block, after the existing cleanup:
   - If `card_id` is not None, read the `AgentRun` row's final `status` from the DB.
   - Map the run status to card agent_status:
     - Run `status == "completed"` -> call `kanban_service.set_card_agent_status(s, card_id, "completed", run_id)` and set `completed_by_run_id = run_id`.
     - Run `status in ("failed", "interrupted")` -> call `kanban_service.set_card_agent_status(s, card_id, "blocked", run_id)` and increment `retry_count`.  Also clear `locked_by_run_id` so the autopilot worker can re-dispatch the card on its next cycle (if retry_count < 3).
   - Wrap the entire card-update block in a try/except so a failure here never prevents session cleanup.
3. Import `kanban_service` at the top of the file: `from app.services import kanban_service`.

**What NOT to do:**
- Do not change the autopilot_worker.py -- it is fire-and-forget by design.
- Do not change the card status inside `session.py` -- that file should remain DB-model-agnostic regarding kanban cards.
- Do not remove the existing `bind_card_id` context variable logic -- it's still needed for git trailer injection during the run.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && uv run python -m pytest web/backend/tests/test_autopilot_worker.py web/backend/tests/agents/test_session_manager.py -x -q 2>&1 | tail -20
```

**Done criteria:** The `_run_session` finally-block includes a card status update that transitions `agent_status` from `"running"` to `"completed"` or `"blocked"` depending on the run outcome, with the card lock cleared on failure.

---

## Task 2: Add unit tests for card status transitions on run completion

**Files to modify:**
- `web/backend/tests/agents/test_session_manager.py`

**Action:**
Add tests that verify the card status update logic added in Task 1. These tests should use the existing test patterns in `test_session_manager.py` (mock `AgentSession`, seed project/card/column via `_seed_project` helper).

Write 3 tests:

1. **`test_run_session_sets_card_completed_on_success`**: Create a project, column, card (with `agent_status="running"`, `locked_by_run_id=run_id`). Start a run with `skill_args={"card_id": card_id}`. Mock `AgentSession.run()` to return successfully. After `_run_session` completes, verify the card's `agent_status == "completed"` and `completed_by_run_id == run_id`.

2. **`test_run_session_sets_card_blocked_on_failure`**: Same setup, but mock `AgentSession.run()` to raise an exception (simulating a failed run). Verify card's `agent_status == "blocked"`, `retry_count == 1`, and `locked_by_run_id is None` (lock cleared for re-dispatch).

3. **`test_run_session_skips_card_update_when_no_card_id`**: Start a run with `skill_args={}` (no card_id -- non-autopilot run). Verify no card-related DB queries are made and the session completes normally.

Follow the existing test patterns: use `_patch_session()` helper, `_seed_project()`, and `@pytest.mark.asyncio(loop_scope="function")`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && uv run python -m pytest web/backend/tests/agents/test_session_manager.py -x -q -v 2>&1 | tail -30
```

**Done criteria:** All 3 new tests pass. Existing tests in the file continue to pass.

---

## Success Criteria

1. When an autopilot-dispatched agent run completes successfully, the kanban card shows `agent_status = "completed"` (rendering as the "Agent completed" badge in `AgentStatusBadge.tsx`).
2. When an autopilot-dispatched agent run fails or is interrupted, the card shows `agent_status = "blocked"` and the lock is cleared so autopilot can retry.
3. Non-autopilot runs (no `card_id` in `skill_args`) are unaffected.
4. All existing tests continue to pass.
