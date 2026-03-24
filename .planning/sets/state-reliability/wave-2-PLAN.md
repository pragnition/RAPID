# PLAN: state-reliability / Wave 2

**Objective:** Add concurrency safety integration tests that prove two simultaneous `withStateTransaction` calls on the same STATE.json never corrupt the file. Uses `child_process.fork` for true parallel execution.

**Owned Files:**
- `src/commands/state.test.cjs` (modify)

**Depends on:** Wave 1 (granular errors, orphan cleanup, onCompromised abort must be in place)

---

## Task 1: Create fork helper script for concurrent transaction testing

**File:** `src/commands/state.test.cjs`

**Action:** This test file currently contains CLI integration tests for `state add-set`. Add a new `describe` block at the bottom for concurrency safety tests.

The concurrency test strategy:
1. Create a temp project with valid STATE.json containing a numeric counter field (use a custom passthrough field like `counter: 0`)
2. Fork two child processes that each run `withStateTransaction` to increment the counter
3. Wait for both to complete
4. Assert: STATE.json is valid JSON, passes schema validation, and the counter reflects correct behavior (either both succeeded = counter 2, or one failed cleanly = counter 1 + error captured)

**Implementation details:**

1. Add a helper function `createConcurrencyTestWorker(tmpDir)` that returns a string of JavaScript code (to be written to a temp `.cjs` file and forked). The worker code:
   ```
   - Requires state-machine.cjs
   - Reads process.argv[2] as the project root
   - Calls withStateTransaction(root, (state) => { state.counter = (state.counter || 0) + 1; })
   - On success: process.send({ ok: true })
   - On error: process.send({ ok: false, code: err.code, message: err.message })
   ```

2. Add a helper `forkWorker(scriptPath, tmpDir)` that returns a Promise:
   ```
   - Uses child_process.fork(scriptPath, [tmpDir], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] })
   - Resolves with the message from process.send
   - Rejects if the child exits with non-zero and no message was received
   - Has a 15-second timeout
   ```

3. Add these tests:

   **Test: `concurrent withStateTransaction calls do not corrupt STATE.json`**
   - Setup: `setupTestProject('m1', ['set-1'])` (reuse existing helper)
   - Write the worker script to a temp file
   - Fork two workers in parallel: `Promise.all([forkWorker(...), forkWorker(...)])`
   - Wait for both to complete
   - Read STATE.json and parse it
   - Assert: `JSON.parse` succeeds (not corrupted)
   - Assert: `ProjectState.safeParse` succeeds (schema valid)
   - Count successes: `results.filter(r => r.ok).length`
   - If both succeeded: assert `state.counter === 2`
   - If one failed: assert `state.counter === 1` AND the failure has `.code` (clean error, not corruption)

   **Test: `concurrent transactions both produce valid error codes on failure`**
   - Setup: Do NOT create STATE.json (missing file)
   - Fork two workers
   - Both should fail with `STATE_FILE_MISSING` code
   - Assert both results have `ok: false` and `code === 'STATE_FILE_MISSING'`

   **Test: `sequential transactions increment counter correctly`**
   - Setup: valid STATE.json with `counter: 0`
   - Fork worker 1, wait for completion
   - Fork worker 2, wait for completion
   - Assert both succeeded and `counter === 2`
   - This test validates the basic mechanism without race conditions

4. Cleanup: delete the temp worker script and temp project in `afterEach`.

**What NOT to do:**
- Do NOT use `worker_threads` -- use `child_process.fork` for true process isolation (separate V8 instances, separate file descriptors)
- Do NOT assert exact ordering of concurrent results -- the order is nondeterministic
- Do NOT set test timeout below 15 seconds -- lock contention with retries can take several seconds
- Do NOT modify existing `handleState add-set` tests in this file

**Verification:**
```bash
node --test src/commands/state.test.cjs
```
All tests must pass -- both the existing CLI integration tests and the new concurrency tests.

---

## Success Criteria
1. `node --test src/commands/state.test.cjs` -- all pass, 0 failures
2. Concurrent fork test proves STATE.json is never corrupted (valid JSON + valid schema after parallel writes)
3. Error codes propagate correctly through forked processes
4. Sequential test proves counter increments correctly as a baseline
5. Existing `handleState add-set` tests remain untouched and passing
