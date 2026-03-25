# SET-OVERVIEW: state-reliability

## Approach

This set hardens the `withStateTransaction()` function in `src/lib/state-machine.cjs` -- the single choke point through which all STATE.json mutations flow. Today, failures during a transaction produce a generic "Cannot mutate: STATE.json is missing or invalid" message that gives no indication of whether the file is missing, unparseable, or schema-invalid. The first goal is to replace that single error path with three distinct error types (STATE_FILE_MISSING, STATE_PARSE_ERROR, STATE_VALIDATION_ERROR), each carrying actionable remediation guidance.

The second goal addresses operational hygiene: orphaned `.tmp` files left behind by crashed transactions. On every transaction start, the function will scan `.planning/` for `.tmp` files older than 30 seconds and remove them with a warning log. This prevents stale temp files from accumulating and confusing operators.

The third and fourth goals address lock safety. The current `onCompromised` handler in `lock.cjs` logs a warning but lets the transaction proceed with potentially stale state. The new default behavior (`onCompromised: 'abort'`) will cause the transaction to throw immediately when the lock is compromised. Additionally, the lock target file's PID must be updated on every acquisition (currently it is only written on first creation, meaning stale PID detection can reference a long-dead process). Finally, concurrency tests will prove that two simultaneous `withStateTransaction` calls never corrupt STATE.json.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/state-machine.cjs` | Core transaction logic, `withStateTransaction()` | Existing -- modify |
| `src/lib/state-machine.test.cjs` | Unit tests for state machine | Existing -- extend |
| `src/commands/state.test.cjs` | Integration tests for state CLI commands | Existing -- extend |

## Integration Points

- **Exports:** `withStateTransaction(projectRoot, mutator, options?)` -- enhanced with optional `onCompromised` parameter. Signature is backward-compatible; existing callers that pass no options get the new abort-by-default behavior.
- **Imports:** None. This set has zero external dependencies on other sets.
- **Side Effects:** (1) Orphaned `.tmp` files in `.planning/` are deleted on transaction start. (2) Compromised locks now throw by default instead of logging and continuing. Callers that previously relied on silent continuation must pass `{ onCompromised: 'continue' }` to preserve old behavior.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Abort-by-default breaks existing callers that silently survived compromised locks | Medium | Default change is intentional; audit all `withStateTransaction` call sites during implementation to confirm none depend on continue behavior |
| Orphan cleanup races with an in-flight transaction's legitimate `.tmp` file | High | Only clean files older than 30 seconds; active transactions complete well within that window |
| PID update on lock target changes file content, possibly confusing `proper-lockfile` stale detection | Medium | Write PID after lock acquisition (inside the lock), not before; verify with concurrency tests |
| Concurrency tests are timing-sensitive and may flake in CI | Low | Use deterministic lock contention patterns rather than `setTimeout` races; keep retries generous |

## Wave Breakdown (Preliminary)

- **Wave 1:** Granular error classification in `withStateTransaction` (replace single error path with STATE_FILE_MISSING / STATE_PARSE_ERROR / STATE_VALIDATION_ERROR) and orphan `.tmp` cleanup logic. These are independent code paths within the same function.
- **Wave 2:** Lock behavior changes -- `onCompromised: 'abort'` default, PID update on acquisition, and the concurrency safety tests that validate both waves.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
