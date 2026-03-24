# PLAN: state-reliability / Wave 1

**Objective:** Harden `withStateTransaction()` with granular error diagnostics, orphan `.tmp` cleanup, `onCompromised: 'abort'` default, PID update on lock acquisition, and unit tests for all new behavior.

**Owned Files:**
- `src/lib/state-machine.cjs` (modify)
- `src/lib/lock.cjs` (modify)
- `src/lib/state-machine.test.cjs` (modify)

---

## Task 1: Add error constants and `createStateError` helper

**File:** `src/lib/state-machine.cjs`

**Action:** After the existing `const` declarations (lines 6-12), add:

1. Export three error code constants:
   ```
   STATE_FILE_MISSING = 'STATE_FILE_MISSING'
   STATE_PARSE_ERROR = 'STATE_PARSE_ERROR'
   STATE_VALIDATION_ERROR = 'STATE_VALIDATION_ERROR'
   ```

2. A `createStateError(code, message, details)` factory function that:
   - Creates a new `Error(message)`
   - Sets `.code = code`
   - If `details` is provided, sets `.details = details`
   - Appends a remediation hint to the message based on code:
     - `STATE_FILE_MISSING` -> `'\nRemediation: Run /rapid:init'`
     - `STATE_PARSE_ERROR` -> `'\nRemediation: Run \`git checkout HEAD -- .planning/STATE.json\`'`
     - `STATE_VALIDATION_ERROR` -> `'\nRemediation: Run /rapid:health'`
   - Returns the error

3. Add `STATE_FILE_MISSING`, `STATE_PARSE_ERROR`, `STATE_VALIDATION_ERROR`, and `createStateError` to the `module.exports` block.

**What NOT to do:**
- Do NOT create custom Error subclasses (no `class StateError extends Error`). Use plain `Error` with `.code` property.
- Do NOT change `readState` -- it keeps its existing return-value pattern.

**Verification:**
```bash
node -e "const sm = require('./src/lib/state-machine.cjs'); console.log(sm.STATE_FILE_MISSING, sm.STATE_PARSE_ERROR, sm.STATE_VALIDATION_ERROR, typeof sm.createStateError)"
```
Expected output: `STATE_FILE_MISSING STATE_PARSE_ERROR STATE_VALIDATION_ERROR function`

---

## Task 2: Implement granular error classification in `withStateTransaction`

**File:** `src/lib/state-machine.cjs`

**Action:** Replace the current error handling inside `withStateTransaction` (lines 157-181). The new implementation must:

1. **Before lock acquisition** (before `acquireLock` call): run orphan cleanup (Task 3 adds this, but structure the function to have a clear insertion point).

2. **After reading state** (after `readState` call), replace the single `'Cannot mutate: STATE.json is missing or invalid'` error with three distinct paths:
   - If `readResult === null` (file missing): throw `createStateError(STATE_FILE_MISSING, 'STATE.json not found at <path>')`
   - If `readResult.valid === false` and the first error message starts with `'Invalid JSON'`: throw `createStateError(STATE_PARSE_ERROR, 'STATE.json contains invalid JSON: <detail>')`
   - If `readResult.valid === false` (schema validation failed): throw `createStateError(STATE_VALIDATION_ERROR, 'STATE.json failed schema validation', readResult.errors)`

3. **After mutation** (after `mutationFn(state)` call), wrap `ProjectState.parse(state)` in try/catch. If it throws a ZodError, throw `createStateError(STATE_VALIDATION_ERROR, 'Mutation produced invalid state: <zod message>', zodError.issues)` instead of letting the raw ZodError escape.

4. Accept an optional third parameter `options` with shape `{ onCompromised?: 'abort' | 'continue' }`, defaulting to `{ onCompromised: 'abort' }`. Pass `options.onCompromised` to `acquireLock` (see Task 4).

**Updated signature:**
```
async function withStateTransaction(cwd, mutationFn, options = {})
```

**What NOT to do:**
- Do NOT change the return value on success -- still returns the validated state object.
- Do NOT change how `writeState` works (it is a separate function).
- Do NOT add error classification to `readState` -- only `withStateTransaction` gets the new error types.

**Verification:**
```bash
node --test --test-name-pattern="throws STATE_FILE_MISSING" src/lib/state-machine.test.cjs
node --test --test-name-pattern="throws STATE_PARSE_ERROR" src/lib/state-machine.test.cjs
node --test --test-name-pattern="throws STATE_VALIDATION_ERROR" src/lib/state-machine.test.cjs
```

---

## Task 3: Add orphaned `.tmp` file cleanup

**File:** `src/lib/state-machine.cjs`

**Action:** Add a `cleanOrphanedTmpFiles(cwd)` function and call it at the start of `withStateTransaction`, BEFORE lock acquisition.

Implementation:
1. Scan `.planning/` directory (non-recursive) for files ending in `.tmp`
2. For each `.tmp` file, check if `mtime` is older than 30 seconds (`Date.now() - stat.mtimeMs > 30000`)
3. If stale, delete the file with `fs.unlinkSync` wrapped in try/catch (handle ENOENT for concurrent delete)
4. Write a warning to stderr for each deleted file: `[RAPID] Cleaned orphaned tmp file: <filename>\n`
5. Do NOT export this function -- it is internal to `withStateTransaction`

**What NOT to do:**
- Do NOT scan recursively -- only the `.planning/` directory itself
- Do NOT delete `.tmp` files younger than 30 seconds (they may be from an active write)
- Do NOT throw if cleanup fails -- log and continue

**Verification:**
```bash
node --test --test-name-pattern="orphan" src/lib/state-machine.test.cjs
```

---

## Task 4: Add options bag to `acquireLock` and implement `onCompromised: 'abort'`

**File:** `src/lib/lock.cjs`

**Action:** Modify `acquireLock` to accept an optional third parameter `options`:

1. Change signature from `acquireLock(cwd, lockName)` to `acquireLock(cwd, lockName, options = {})`
2. Destructure `{ onCompromised = 'continue' }` from options
3. When `onCompromised === 'abort'`:
   - Set a local flag `let compromised = false`
   - In the `onCompromised` callback passed to `proper-lockfile`, set `compromised = true` AND still log the warning to stderr
   - Wrap the returned release function: before returning, return a new async function that checks `compromised` -- if true, throw `createLockCompromisedError()` before calling the real release
   - Actually, the compromised callback fires asynchronously. The correct approach: return a wrapper release function that checks the flag. Also, after `lockfile.lock()` resolves, immediately check if compromised was already set (race condition where compromise happens during lock acquisition).
4. When `onCompromised === 'continue'` (default): keep existing behavior (log only).

For the error: create it inline -- `const err = new Error('Lock compromised during state transaction'); err.code = 'LOCK_COMPROMISED'; throw err;`

**Important:** Do NOT add new exports to `lock.cjs`. The lock.test.cjs asserts exactly 4 exports (`acquireLock`, `isLocked`, `ensureLocksDir`, `cleanStaleLocks`). The options bag is additive to the existing `acquireLock` signature.

**What NOT to do:**
- Do NOT change the default behavior of `acquireLock` -- existing callers that pass 2 args still get `onCompromised: 'continue'`
- Do NOT change `isLocked`, `ensureLocksDir`, or `cleanStaleLocks`

**Verification:**
```bash
node --test src/lib/lock.test.cjs
```
All existing lock tests must still pass (especially the "exports exactly 4 keys" test).

---

## Task 5: Add PID update on lock acquisition

**File:** `src/lib/lock.cjs`

**Action:** In `acquireLock`, AFTER the `lockfile.lock()` call resolves successfully, rewrite the lock target file with the current process PID:

```js
fs.writeFileSync(lockTarget, JSON.stringify({
  pid: process.pid,
  timestamp: Date.now(),
}), 'utf-8');
```

This replaces the current conditional write (which only writes if file doesn't exist). The new behavior:
1. Still create the file if it doesn't exist (before lock acquisition, for proper-lockfile to lock against)
2. After lock is acquired, always overwrite with current PID

**Why:** proper-lockfile uses `.lock` directory mtime for stale detection, not the target file content. So rewriting the target file content is safe and ensures `cleanStaleLocks` has accurate PID information.

**What NOT to do:**
- Do NOT remove the initial file creation before `lockfile.lock()` -- proper-lockfile needs the target file to exist
- Do NOT change the `.lock` directory behavior

**Verification:**
```bash
node --test --test-name-pattern="PID" src/lib/state-machine.test.cjs
```

---

## Task 6: Add retry warning log

**File:** `src/lib/lock.cjs`

**Action:** Modify the retry configuration passed to `lockfile.lock()` to log a single warning on first retry attempt.

proper-lockfile's `retries` option can be an object with an `onFailedAttempt` callback. Change the retry config:

```js
const retryOpts = {
  retries: RETRY_CONFIG.retries,
  factor: RETRY_CONFIG.factor,
  minTimeout: RETRY_CONFIG.minTimeout,
  maxTimeout: RETRY_CONFIG.maxTimeout,
  randomize: RETRY_CONFIG.randomize,
};
```

Then in the `lockfile.lock()` call, add a wrapper that logs on first retry. However, `proper-lockfile` uses the `retry` npm package internally. The `retries` option is passed directly to `retry`. To intercept, we need to use `proper-lockfile`'s built-in retry mechanism.

**Revised approach:** Use the `retries` object directly and rely on proper-lockfile's behavior. Since proper-lockfile handles retries internally and does not expose a per-attempt callback, the simplest approach is: **skip this task**. The retry behavior is already correct (10 retries, exponential backoff). Adding a warning log would require monkey-patching or wrapping lockfile.lock, which adds complexity for minimal value.

**Decision: SKIP this task.** The existing retry config is sufficient. Logging on retry would require intercepting proper-lockfile internals, which is fragile.

---

## Task 7: Update existing test for new error behavior

**File:** `src/lib/state-machine.test.cjs`

**Action:** The existing test at line 277-282 asserts `throws /missing or invalid/` for missing STATE.json. This regex will no longer match. Update it:

1. Replace the test `'throws for missing STATE.json'` to assert:
   - Error has `.code === 'STATE_FILE_MISSING'`
   - Error message includes `'STATE.json not found'`
   - Error message includes `'Remediation'`

2. Add NEW tests to the `withStateTransaction` describe block:

   **Test: `throws STATE_FILE_MISSING when STATE.json does not exist`**
   - Call `withStateTransaction(tmpDir, () => {})` with no STATE.json
   - Assert error `.code === 'STATE_FILE_MISSING'`
   - Assert error message contains remediation text

   **Test: `throws STATE_PARSE_ERROR for corrupt JSON`**
   - Write `'{bad json!!!}'` to STATE.json
   - Call `withStateTransaction(tmpDir, () => {})`
   - Assert error `.code === 'STATE_PARSE_ERROR'`
   - Assert error message contains `'invalid JSON'` (case-insensitive)

   **Test: `throws STATE_VALIDATION_ERROR for invalid schema`**
   - Write `'{"version": 999, "bad": true}'` (valid JSON but invalid schema) to STATE.json
   - Call `withStateTransaction(tmpDir, () => {})`
   - Assert error `.code === 'STATE_VALIDATION_ERROR'`
   - Assert error message contains `'schema validation'`

   **Test: `throws STATE_VALIDATION_ERROR when mutation produces invalid state`**
   - Write valid state, then mutate to delete `projectName`
   - Assert error `.code === 'STATE_VALIDATION_ERROR'`
   - Assert error message contains `'Mutation produced invalid state'`

3. Add tests for orphan cleanup:

   **Test: `cleans orphaned .tmp files older than 30s before transaction`**
   - Write valid STATE.json
   - Create a `.tmp` file in `.planning/` with mtime set to 60 seconds ago (use `fs.utimesSync`)
   - Capture stderr (use child_process.fork or execSync with test helper)
   - Call `withStateTransaction(tmpDir, (s) => { s.projectName = 'test'; })`
   - Assert the `.tmp` file no longer exists

   **Test: `does NOT clean .tmp files younger than 30s`**
   - Write valid STATE.json
   - Create a fresh `.tmp` file in `.planning/`
   - Call `withStateTransaction(tmpDir, (s) => { s.projectName = 'test'; })`
   - Assert the `.tmp` file still exists

4. Add test for error constants export:

   **Test: `exports error code constants`**
   - Assert `STATE_FILE_MISSING === 'STATE_FILE_MISSING'`
   - Assert `STATE_PARSE_ERROR === 'STATE_PARSE_ERROR'`
   - Assert `STATE_VALIDATION_ERROR === 'STATE_VALIDATION_ERROR'`
   - Assert `typeof createStateError === 'function'`

5. Add test for PID update:

   **Test: `updates lock target PID on every acquisition`**
   - Write valid STATE.json
   - Write a fake lock target with PID 99999 to `.planning/.locks/state.target`
   - Call `withStateTransaction(tmpDir, (s) => { s.projectName = 'pid-test'; })`
   - Read `.planning/.locks/state.target` and parse JSON
   - Assert `pid === process.pid`

6. Add test for `onCompromised` option passthrough:

   **Test: `accepts onCompromised option without error`**
   - Write valid STATE.json
   - Call `withStateTransaction(tmpDir, (s) => { s.projectName = 'opt-test'; }, { onCompromised: 'continue' })`
   - Assert it succeeds and returns updated state

**What NOT to do:**
- Do NOT delete existing passing tests (other than updating the regex in the one test that breaks)
- Do NOT change test helpers (`makeTempProject`, `cleanTempProject`, etc.)

**Verification:**
```bash
node --test src/lib/state-machine.test.cjs
```
All tests must pass. Expected: existing tests pass (with the one regex update), plus 8+ new tests pass.

---

## Task 8 (SKIP): Lock retry warning
Skipped per Task 6 analysis.

---

## Success Criteria
1. `node --test src/lib/state-machine.test.cjs` -- all pass, 0 failures
2. `node --test src/lib/lock.test.cjs` -- all pass, 0 failures (existing tests unbroken)
3. `withStateTransaction` produces 3 distinct error codes with actionable remediation messages
4. Orphaned `.tmp` files older than 30s are cleaned before transaction
5. `acquireLock` accepts `{ onCompromised: 'abort' }` option
6. Lock target PID is updated on every acquisition
7. New exports: `STATE_FILE_MISSING`, `STATE_PARSE_ERROR`, `STATE_VALIDATION_ERROR`, `createStateError`
