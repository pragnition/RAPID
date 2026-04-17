# VERIFICATION-REPORT: Quick Task 29 (Do Not Disconnect Agents While ask_user Pending)

**Quick Task:** 29-dont-disconnect-agents-on-pending-questions
**Verified:** 2026-04-17
**Verdict:** PASS

## Summary

All structural assumptions in the plan were verified against the live codebase. Every line-number reference, function name, fixture, model, DB index, and event object cited in the plan exists exactly as described. The design is implementable with no changes: the plan correctly identifies the single editable region (the final interrupt branch of `_idle_timeout_task`, session_manager.py:492-506), reuses the already-written `get_pending_prompt` facade, and leans on the partial unique index as the source of truth. The three Task 2 tests can be written using the existing `_seed_run`, `_make_session`, and `tables` helpers. No blockers were found.

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| Skip idle-timeout interrupt when a pending `AgentPrompt` exists | Task 1 | PASS | Plan specifies the exact pseudocode patch to the interrupt branch at session_manager.py:492-506 and requires `continue` to re-arm the loop. |
| Re-arm idle timer when prompt pending (no session leak, no permanent defer) | Task 1 | PASS | Plan uses `continue` inside `while True` so the loop falls back to `await session._idle.wait()`, which is correct -- `_idle` stays set while idle, so `wait()` returns immediately and another `_IDLE_TIMEOUT_S` sleep begins. |
| Resume normal interrupt after prompt resolved | Task 1 | PASS | `resolve_prompt` marks row `answered` (session_manager.py:548); next loop iteration sees `get_pending_prompt -> None` and falls through to the existing interrupt branch. Verified against session_manager.py:527-580. |
| Log "idle timeout deferred -- prompt pending" with run_id + prompt_id | Task 1 | PASS | Pseudocode includes the INFO log with `extra={"run_id": ..., "prompt_id": ...}`. |
| Leave `_IDLE_TIMEOUT_S`, `_start_idle_timeout`, `continue_session`, `session.py`, tool bodies untouched | Task 1 (out-of-scope guard) | PASS | Plan "Out of scope" section is explicit and the pseudocode is narrowly scoped. |
| Unit test: timeout fires with no pending prompt | Task 2a | PASS | Existing helpers (`_seed_run`, `_make_session`, `tables`) support this flow; `session.interrupt = AsyncMock()` is a clean stub -- no SDK client needed since the test only exercises the idle-timeout task. |
| Unit test: timeout deferred while pending, resumes after answered | Task 2b | PASS | Plan correctly specifies inserting an `AgentPrompt` directly via `Session(engine)` and updating `status='answered'`. This exercises `get_pending_prompt` against the real DB. |
| Unit test: timeout deferred repeatedly across multiple cycles until resolved | Task 2c | PASS | With `_IDLE_TIMEOUT_S` patched to e.g. 0.05, 3x sleep = 0.15s is ample to see two loop iterations; plan explicitly notes cancelling the task at teardown. |
| Monkeypatch target `app.agents.session_manager._IDLE_TIMEOUT_S` | Task 2 | PASS | Constant is a module-level `_IDLE_TIMEOUT_S = 900.0` at session_manager.py:57 -- monkeypatch.setattr works as written. |

## Implementability

| File | Task | Action | Status | Notes |
|------|------|--------|--------|-------|
| `web/backend/app/agents/session_manager.py` | 1 | Modify | PASS | File exists. `_idle_timeout_task` at lines 475-508 matches plan exactly. `get_pending_prompt` at 582-596 matches exactly. `_IDLE_TIMEOUT_S = 900.0` at line 57. The pseudocode replacement cleanly maps onto lines 492-506. |
| `web/backend/tests/agents/test_persistent_session.py` | 2 | Modify (append tests) | PASS | File exists. `_seed_run` defined at line 30, `_make_session` at line 50, both have signatures matching the plan's usage. No existing tests named `test_idle_timeout_*` -- no conflicts. |
| `web/backend/app/models/agent_prompt.py` | (read-only, referenced) | n/a | PASS | `AgentPrompt` class has all fields the plan touches: `id` (str, PK), `run_id` (UUID, FK), `payload` (str), `status` (str, default 'pending'), `answer`, `created_at`, `answered_at`. Partial unique index `uq_agent_prompt_run_pending` (line 56-61) confirmed. |
| `web/backend/app/agents/session.py` | (read-only, referenced) | n/a | PASS | `self._idle = asyncio.Event()` at session.py:123. `is_idle` property at session.py:431 returns `self._persistent and self._idle.is_set()`. Set at line 216, cleared at line 238, exactly as plan's background section describes. |
| `web/backend/tests/conftest.py` | (read-only, referenced) | n/a | PASS | `tables` fixture defined at conftest.py:32 returns the engine after `SQLModel.metadata.create_all`. All models, including `AgentPrompt`, are therefore migrated in-test. |

### Cross-job / cross-task dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Task 2 tests depend on Task 1's code change | PASS | Plan states "tests must pass against the modified `_idle_timeout_task`" -- ordering is explicit. Tests can be written before the code change but will fail until Task 1 lands; this is the standard TDD shape the plan asks for. |
| Task 1 depends on `get_pending_prompt` (session_manager.py:582-596) | PASS | Already exists in the file; no cross-wave dependency. Uses `asyncio.to_thread` off the hot path -- plan's note at line 101-103 is correct. |
| Task 1 depends on `resolve_prompt` marking rows `answered` (session_manager.py:527-580) | PASS | Verified: line 548 sets `row.status = "answered"` under the prompt lock before committing. Plan's claim that "the next check sees `pending is None`" is correct because `get_pending_prompt` filters `WHERE status == 'pending'` (line 590). |

## Consistency

| File | Task(s) | Status | Resolution |
|------|---------|--------|------------|
| `web/backend/app/agents/session_manager.py` | 1 | PASS | Single task owns this file. |
| `web/backend/tests/agents/test_persistent_session.py` | 2 | PASS | Single task owns this file. Tests are additive (no edits to existing tests per the "Done criteria" in Task 2). |

No ownership conflicts -- each task touches a distinct file.

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | (none) | No auto-fixes required. All line references, function signatures, and fixture names verified on first read. |

## Detailed Verification of Focus Points

1. **`_idle_timeout_task` at session_manager.py:475-508** -- CONFIRMED. The function body matches the plan's description: `while True` loop, `await session._idle.wait()`, `await asyncio.sleep(_IDLE_TIMEOUT_S)`, then the interrupt branch at lines 492-506 that the plan replaces.
2. **`get_pending_prompt` at session_manager.py:582-596** -- CONFIRMED. Signature `async def get_pending_prompt(self, run_id: UUID) -> AgentPrompt | None`, runs `SELECT ... WHERE run_id == run_id AND status == 'pending' ORDER BY created_at DESC LIMIT 1` via `asyncio.to_thread`.
3. **`_IDLE_TIMEOUT_S` constant** -- CONFIRMED at session_manager.py:57, value `900.0` (15 minutes). Module-level, so `monkeypatch.setattr("app.agents.session_manager._IDLE_TIMEOUT_S", 0.05)` is the correct patch target.
4. **`_seed_run`, `_make_session`, `tables` fixture** -- CONFIRMED. `_seed_run` at test_persistent_session.py:30 inserts a Project + AgentRun row; `_make_session` at :50 constructs an `AgentSession` without connecting; `tables` fixture at tests/conftest.py:32 returns the engine with all tables created. Other tests in the file (e.g., line 90, 101, 111) use the same pattern the plan proposes.
5. **`AgentPrompt.status='pending'` + `uq_agent_prompt_run_pending`** -- CONFIRMED. Model at app/models/agent_prompt.py:25-69. The partial unique index at lines 56-61 enforces "at most one pending prompt per run" with `sqlite_where=text("status = 'pending'")`. This is what makes `get_pending_prompt` deterministic.
6. **`session._idle` on the session class** -- CONFIRMED at session.py:123 (`self._idle = asyncio.Event()`). Set at session.py:216 after `ResultMessage`, cleared at session.py:238 when a new query arrives. The `is_idle` property at :431 gates on both `_persistent` and `_idle.is_set()` -- consistent with the plan's reasoning about the bug's reachability.
7. **`resolve_prompt` marks rows `answered`** -- CONFIRMED at session_manager.py:548. Under the per-run prompt lock, `row.status = "answered"` is set before commit; this is what trips the next `get_pending_prompt` call to return None and allow the idle timeout to fire normally.

## Potential concerns / notes (non-blocking)

- **Log text mismatch**: the plan's pseudocode has `"idle timeout -- interrupting persistent session"` (two hyphens) but the existing code at line 496 uses an em-dash: `"idle timeout — interrupting persistent session"`. The executor should preserve the existing em-dash when keeping the interrupt log line unchanged, or the plan's Task 1 "diff is scoped to the interrupt branch" constraint is technically violated by a whitespace/punctuation swap. Non-blocking; just a style note.
- **Task 2c timing margin**: with `_IDLE_TIMEOUT_S = 0.05s`, a 3x sleep (0.15s) gives two full cycles but is tight on CI. Using `0.1s` + `0.35s` waits would be safer but is not a correctness issue -- plan's pacing is defensible.
- **AsyncMock interrupt**: `session.interrupt = AsyncMock()` replaces the bound method on an `AgentSession` instance produced by `_make_session`. Since the tests never call `__aenter__` (no SDK client), this works -- the idle-timeout task only calls `session.interrupt()` and reads `session._idle` / `session.is_idle`, all of which are already initialized in `__init__`. Plan is correct that "no real SDK client" is needed.
- **`session.is_idle` requires `self._persistent`**: the tests must construct sessions with `persistent=True` (as `_make_session(..., persistent=True)`) and manually `session._idle.set()` before starting the idle task, otherwise `is_idle` returns False and the interrupt branch is skipped regardless of pending-prompt state. The plan implies persistent=True (since idle-timeout is a persistent-only concept) but doesn't spell it out -- executor should be careful here. Non-blocking.

## Verdict Justification

PASS. Every structural claim in the plan is accurate against the current codebase: the target function, helper, constant, model, index, fixture, and session attribute all exist exactly where the plan says they do. The pseudocode patch is minimal and surgical, Task 2's test strategy is fully supported by existing fixtures and helpers, and no auto-fixes were required. The executor can proceed to implement Task 1 and Task 2 as written.

<!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["VERIFICATION-REPORT.md"],"verdict":"PASS","failingJobs":[],"tasks_completed":3,"tasks_total":3,"notes":["Coverage: PASS","Implementability: PASS","Consistency: PASS"]} -->
