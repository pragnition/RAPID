# Quick Task 29: Do Not Disconnect Agents While an ask_user Question Is Pending

## Objective

When a persistent agent session is awaiting a user answer (`ask_user` / AUQ
via the web bridge), the 15-minute idle-timeout sweeper must not interrupt
the session. Today's `_idle_timeout_task` only checks `session.is_idle` --
it has no awareness of pending prompts -- so the agent can be killed out
from under a user who is still composing an answer. Once the prompt is
answered (or explicitly cancelled / made stale), normal idle rules resume.

**Design approach picked:** skip the interrupt in `_idle_timeout_task` when
there is a pending `AgentPrompt` for the run, and re-arm the timer. This is
the minimal change -- we reuse the existing `get_pending_prompt()` facade
(`session_manager.py:582-596`) and the existing `uq_agent_prompt_run_pending`
partial unique index as the source of truth. No session-side flag is
introduced, no changes to the tool body. The alternative (resetting the
idle clock inside `_enter_waiting` / `_leave_waiting` on the session) would
duplicate state and require threading lifecycle hooks into ask_user paths.

### Why this bug is reachable today

Although `_idle` is only set after a `ResultMessage` (session.py:216), there
is a window where the sequence looks like:

1. Persistent session completes turn N -> `_idle.set()` -> 15 min timer
   starts.
2. Agent re-armed by a new user query via `continue_session` (manager
   cancels old timer, calls `send_input`, starts a fresh timer at
   session_manager.py:463).
3. The agent calls `ask_user` during turn N+1 and awaits the user's answer.
4. Some turn-ending path (e.g. an SDK `ResultMessage` that arrives because
   the tool-call branch closed early, or a partial pump completion) causes
   `_idle.set()` again -- and the 15-min timer is now racing a human
   typing an answer.

Even if the exact sequence above is hard to trigger on purpose, the
defensive check makes the idle sweeper correct regardless: a session with
a `status='pending'` `AgentPrompt` row is semantically waiting-on-user,
not waiting-on-activity, and must not be interrupted.

---

## Task 1 -- Skip idle-timeout interrupt while a prompt is pending

### Files to modify

- `web/backend/app/agents/session_manager.py` -- teach
  `_idle_timeout_task` to poll for a pending `AgentPrompt` before
  interrupting, and re-arm instead of killing the session.

### Action

Edit `_idle_timeout_task` (`session_manager.py:475-508`). The current body
waits for `_idle`, sleeps `_IDLE_TIMEOUT_S`, then interrupts if
`session.is_idle` is still true. Change the final interrupt branch to:

1. Re-read the session from `self._sessions` as today (line 493).
2. If the session is still idle, call `self.get_pending_prompt(run_id)`.
   - If it returns a non-None row (i.e. there is a `pending` prompt),
     **do not interrupt**. Log at INFO with
     `extra={"run_id": str(run_id), "prompt_id": row.id}` and
     `continue` the outer `while True` loop so the task loops back to
     `await session._idle.wait()` and re-arms for the next tick.
   - If it returns None, proceed to the existing interrupt path.
3. Keep the existing `try/except Exception: logger.exception(...)` guard
   around `session.interrupt()` untouched.

Pseudocode replacement for lines 492-506 (inside the existing `while True`):

```python
session = self._sessions.get(run_id)
if session is not None and session.is_idle:
    # Do not disconnect a session that is waiting on a user answer.
    pending = await self.get_pending_prompt(run_id)
    if pending is not None:
        logger.info(
            "idle timeout deferred -- prompt pending",
            extra={"run_id": str(run_id), "prompt_id": pending.id},
        )
        continue  # re-arm: loop back to await session._idle.wait()
    logger.info(
        "idle timeout -- interrupting persistent session",
        extra={"run_id": str(run_id)},
    )
    try:
        await session.interrupt()
    except Exception:
        logger.exception(
            "error interrupting idle session",
            extra={"run_id": str(run_id)},
        )
    return
```

Do NOT modify `_IDLE_TIMEOUT_S`, `_start_idle_timeout`, `continue_session`,
`session.py`, or any tool body -- all the information we need is already
available via `get_pending_prompt`.

Implementation notes:
- `get_pending_prompt` runs a `SELECT` via `asyncio.to_thread`; that is
  fine -- this is already off the event loop hot path because we just
  slept 15 minutes.
- The `continue` skips the `return` so the task keeps running. The next
  loop iteration immediately re-enters `await session._idle.wait()`; if
  `_idle` is still set (it will be), `wait()` returns immediately and we
  sleep another `_IDLE_TIMEOUT_S`, checking again. This means the sweeper
  will recheck every 15 minutes for as long as the prompt remains
  pending -- a negligible cost and a correct bound.
- When the user answers, `resolve_prompt` marks the row `answered`, so
  the next check sees `pending is None` and the normal timeout behavior
  resumes from the next idle window. If the agent's turn resumes first
  (`_idle.clear()` at session.py:238), the loop keeps working as today.

### Verification

Automated unit test covering the pending-prompt guard:

```bash
cd ~/Projects/RAPID/web/backend
uv run pytest tests/agents/test_persistent_session.py -xvs -k "idle_timeout"
```

The test added in Task 2 MUST appear and pass under that selector.

Also run the full persistent-session + ask_user suites to guard against
regressions:

```bash
cd ~/Projects/RAPID/web/backend
uv run pytest tests/agents/test_persistent_session.py tests/agents/test_ask_user_tool.py tests/agents/test_session_manager.py -xvs
```

### Done criteria

- `_idle_timeout_task` calls `get_pending_prompt` only after it has slept
  `_IDLE_TIMEOUT_S` and re-confirmed `session.is_idle` (not before --
  avoid wasted DB queries while the session is active).
- When `get_pending_prompt` returns a row, the task logs
  `"idle timeout deferred -- prompt pending"` and does not call
  `session.interrupt()`.
- When the pending prompt is resolved (status moves off `pending`), the
  next loop iteration no longer defers and the interrupt fires normally
  after the next idle window.
- No other behavior in `session_manager.py` changes; diff is scoped to
  the interrupt branch of `_idle_timeout_task`.

---

## Task 2 -- Unit tests for the pending-prompt guard

### Files to modify

- `web/backend/tests/agents/test_persistent_session.py` -- add three
  focused tests for `_idle_timeout_task`.

### Action

Add the following tests to `test_persistent_session.py`. They should use
the existing helpers (`_seed_run`, `_make_session`) and the real
`AgentSessionManager` wired against the `tables` fixture, with
`_IDLE_TIMEOUT_S` monkeypatched to a small value (e.g. `0.05`) so the
task fires quickly. Use `monkeypatch.setattr` on
`app.agents.session_manager._IDLE_TIMEOUT_S` inside each test.

The tests must interact ONLY with public/manager-level state for the
prompt row (insert/update via the real DB through `manager.engine`) so
they exercise `get_pending_prompt` for real rather than mocking it.

**2a. `test_idle_timeout_fires_when_no_pending_prompt`**

- Seed a run and register a persistent session in `manager._sessions`.
- Set `session._idle` to simulate idle state.
- Patch `_IDLE_TIMEOUT_S` to a small number.
- Spy on `session.interrupt` (AsyncMock) and start `_idle_timeout_task`
  manually (`asyncio.create_task(manager._idle_timeout_task(run_id))`).
- Wait up to ~1s for `session.interrupt` to be awaited, assert it was
  called once.

**2b. `test_idle_timeout_deferred_while_prompt_pending`**

- Same setup as 2a.
- Insert an `AgentPrompt` row with `status='pending'` for `run_id` before
  starting the idle task.
- Start the task; after the patched timeout elapses, assert
  `session.interrupt` was NOT called.
- Update the prompt row to `status='answered'` (or delete it) via a
  direct `Session(engine)` write.
- Wait for the next cycle (~2x the patched timeout) and assert
  `session.interrupt` IS called exactly once.
- Cancel the task at the end and await cancellation to avoid pending-task
  warnings.

**2c. `test_idle_timeout_deferred_repeatedly_until_resolved`**

- Same setup as 2b but with a longer pending window.
- Insert a pending `AgentPrompt`.
- Let the timer fire twice (sleep ~3x the patched timeout) -- assert
  `session.interrupt` still NOT called, confirming the loop re-arms.
- Resolve the prompt, wait one more cycle, assert interrupt is called.

All three tests should mark `session.interrupt` via:
```python
session.interrupt = AsyncMock()
```
to avoid needing a real SDK client.

### Verification

```bash
cd ~/Projects/RAPID/web/backend
uv run pytest tests/agents/test_persistent_session.py::test_idle_timeout_fires_when_no_pending_prompt \
  tests/agents/test_persistent_session.py::test_idle_timeout_deferred_while_prompt_pending \
  tests/agents/test_persistent_session.py::test_idle_timeout_deferred_repeatedly_until_resolved \
  -xvs
```

### Done criteria

- All three tests pass against the modified `_idle_timeout_task`.
- Each test monkeypatches `_IDLE_TIMEOUT_S` (no real 15-minute waits).
- Tests clean up by cancelling the idle-timeout task and awaiting
  cancellation.
- No changes to existing tests; only new tests are added.

---

## Out of scope (do NOT do in this task)

- Do not change `session.py`, `ask_user.py`, or `permission_hooks.py`.
- Do not introduce a new session-level flag (e.g. `_has_pending_prompt`)
  -- the DB row is already the source of truth.
- Do not change `_IDLE_TIMEOUT_S` or add new settings.
- Do not refactor `continue_session`, `resolve_prompt`, or the prompt
  lifecycle -- they are correct.
- Do not touch the frontend; this is a backend-only fix.
