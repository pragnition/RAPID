# CONTEXT: state-reliability

**Set:** state-reliability
**Generated:** 2026-03-24
**Mode:** interactive

<domain>
## Set Boundary
Harden `withStateTransaction()` in `src/lib/state-machine.cjs` with granular error diagnostics (3 distinct error types), orphaned `.tmp` file cleanup, `onCompromised: 'abort'` default behavior, lock target PID update on every acquisition, and concurrency safety tests. Also modifies `src/lib/lock.cjs` to accept an options bag on `acquireLock`. Test files: `src/lib/state-machine.test.cjs`, `src/commands/state.test.cjs`.
</domain>

<decisions>
## Implementation Decisions

### Error Classification Taxonomy
- Use **tagged plain Errors** with a `.code` property (e.g., `err.code === 'STATE_FILE_MISSING'`), matching Node.js fs error conventions. No custom Error subclasses.
- Classification applies **only to withStateTransaction** -- `readState` keeps its existing return-value pattern (null for missing, `{valid: false, errors}` for invalid).
- **Rationale:** Tagged errors are lightweight, idiomatic Node.js, and sufficient for 3 error types. readState already distinguishes cases via its return shape, so adding codes there would be a gratuitous API change.

### Orphan Cleanup Trigger Point
- Orphan `.tmp` cleanup runs **inside withStateTransaction**, before the lock acquisition, matching the contract spec.
- Scan scope: **non-recursive `.planning/` directory only** -- `STATE.json.tmp` is the only known `.tmp` producer.
- **Rationale:** Placing cleanup in withStateTransaction keeps lock.cjs focused on locking. Non-recursive scan is fast, targeted, and avoids false positives in archive/ subdirectories.

### onCompromised API Surface
- `acquireLock` gains an **optional options bag** `{ onCompromised }` -- additive, no breaking change. Default for acquireLock remains `'continue'` (backward compatible).
- `withStateTransaction` passes `{ onCompromised: 'abort' }` to acquireLock by default, overridable via its own `options` parameter.
- When abort triggers, throw a tagged Error with `.code = 'LOCK_COMPROMISED'`, including the lock name and original proper-lockfile error message.
- **Rationale:** Options bag on acquireLock is cleanly additive. Keeping acquireLock's default as 'continue' avoids breaking writeState and other direct callers. The LOCK_COMPROMISED error code is consistent with the tagged error pattern used for state errors.

### Lock PID Update Strategy
- **Always rewrite** the lock target file on every acquisition -- negligible cost, fixes stale PID issue.
- PID update happens **after lock acquisition** (inside the lock) -- the PID in the file always represents the actual lock holder.
- **Rationale:** The target file content is only consumed by cleanStaleLocks(), not by proper-lockfile's stale detection. Writing after acquisition ensures accuracy; the cost is a single writeFileSync per lock acquire.

### Concurrency Test Architecture
- Use **child_process.fork** for true parallel execution -- two separate Node processes competing for the same lock and STATE.json.
- Assertion: final STATE.json is valid JSON, passes schema validation, AND either **both transactions succeeded** (counter=2) or **one failed cleanly** (counter=1 + captured error). The invariant is "no corruption."
- **Rationale:** Fork-based tests exercise real OS-level contention, which is the only way to prove proper-lockfile's locking actually works. Async Promise.all may not exercise true contention due to Node's event loop.

### Error Remediation Messages
- Use **RAPID-specific command suggestions**: STATE_FILE_MISSING → 'Run /rapid:init', STATE_PARSE_ERROR → 'Run `git checkout HEAD -- .planning/STATE.json`', STATE_VALIDATION_ERROR → 'Run /rapid:health'.
- Validation error message includes **first Zod issue** in the message text; full issues array attached as `.details` property for programmatic access.
- **Rationale:** RAPID users need actionable next steps, not generic error descriptions. First-issue-plus-details balances concise messages with complete diagnostics.

### Backward Compatibility Boundary
- **Silent upgrade to abort** -- all existing `withStateTransaction(cwd, fn)` callers get abort-by-default. Callers that need old behavior pass `{ onCompromised: 'continue' }`.
- `acquireLock` gains the options bag but **defaults to continue** -- only withStateTransaction changes its default.
- **Rationale:** Any caller that silently survived compromised locks was already in a bad state. The new behavior makes hidden failures visible. acquireLock's continue default avoids breaking writeState and other direct lock consumers.

### Retry vs. Fail-Fast on Lock Contention
- **Keep proper-lockfile's retry behavior** (10 retries, exponential backoff 100ms-2000ms). Transactions are short-lived (~10-50ms), retries reliably succeed.
- Log a **single warning to stderr on first retry attempt** -- 'State lock contention detected, retrying...' -- for visibility without noise.
- **Rationale:** Fail-fast would push retry logic onto callers unnecessarily. The current config is well-tuned for RAPID's usage patterns. A single contention warning helps diagnose parallel execution performance.
</decisions>

<specifics>
## Specific Ideas
- The 3 error codes should be exported as constants for callers to reference without magic strings
- The fork-based concurrency test should use a helper script that both processes run, with a shared temp directory for the test STATE.json
- Consider a `createStateError(code, message, details?)` helper to keep error construction consistent, even if it's not a full factory pattern
</specifics>

<code_context>
## Existing Code Insights
- `withStateTransaction` (state-machine.cjs:157-181) currently has a single error path on line 162: `throw new Error('Cannot mutate: STATE.json is missing or invalid')` -- this collapses null (missing) and `{valid: false}` (parse/validation error) into one message
- `readState` (state-machine.cjs:47-67) already distinguishes missing (returns null) from parse error (`{valid: false, errors: [{message: 'Invalid JSON: ...'}]}`) from validation error (`{valid: false, errors: result.error.issues}`) -- the classification data is available, just not surfaced in withStateTransaction
- `acquireLock` (lock.cjs:42-66) creates the lock target file only on first creation (line 47-52) and hardcodes `onCompromised` callback (line 59-62) that logs but doesn't throw
- `writeState` (state-machine.cjs:77-92) calls `acquireLock` directly -- it will inherit the new options bag but keep continue behavior
- `proper-lockfile` stale detection uses the lock directory mtime, not our target file content -- PID updates are safe
- `cleanStaleLocks` (lock.cjs:110-131) reads target file PID to detect dead owners -- this is the consumer that benefits from PID updates
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
