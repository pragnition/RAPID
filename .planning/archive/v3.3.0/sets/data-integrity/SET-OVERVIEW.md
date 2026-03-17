# SET-OVERVIEW: data-integrity

## Approach

This set fixes three data integrity issues that create active corruption and race condition risks in the RAPID execution pipeline. The core problem is duplicated and unguarded state mutation code paths: the resume command exists in two near-identical implementations (`handleResume()` at line 1613 and `execute resume` at line 1917 of `rapid-tools.cjs`), the `execute update-phase` command mutates registry state without routing through `withStateTransaction()` for STATE.json validation, and MERGE-STATE.json writes use raw `fs.writeFileSync()` without transactional guarantees.

The implementation strategy is: (1) extract a single `resumeSet()` function into `execute.cjs` that both CLI entry points delegate to, eliminating the duplicated validation/parsing/registry-update logic; (2) audit the `execute update-phase` handler to ensure it uses `withStateTransaction()` for any STATE.json mutations rather than bypassing the state machine; (3) create a `withMergeStateTransaction()` wrapper in `merge.cjs` following the same lock-read-validate-mutate-validate-write-release pattern as `withStateTransaction()`, then migrate all `writeMergeState()` / `updateMergeState()` call sites to use it.

All three fixes are independent of each other and can be developed in any order. They share no file ownership conflicts. Tests enforce the behavioral invariants via grep-based audits (no direct `fs.writeFileSync` for MERGE-STATE, no duplicate resume logic) and functional tests for the new transaction wrapper.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/execute.cjs | Execution engine -- will host `resumeSet()` | Existing (modify) |
| src/bin/rapid-tools.cjs | CLI router -- `handleResume()` + `execute resume` dedup, `update-phase` fix | Existing (modify) |
| src/lib/merge.cjs | Merge pipeline -- will host `withMergeStateTransaction()` | Existing (modify) |
| src/lib/execute.test.cjs | Tests for `resumeSet()` | Existing (modify) |
| src/lib/merge.test.cjs | Tests for `withMergeStateTransaction()` | Existing (modify) |
| src/bin/rapid-tools.test.cjs | CLI integration tests for resume dedup | Existing (modify) |

## Integration Points

- **Exports:**
  - `resumeSet(cwd, setId, options?)` -- single resume entry point replacing both `handleResume()` and `execute resume` code paths in `rapid-tools.cjs`
  - `withMergeStateTransaction(cwd, setId, mutationFn)` -- atomic read-validate-mutate-write wrapper for MERGE-STATE.json, mirrors `withStateTransaction()` from `state-machine.cjs`
- **Imports:** None -- this set has zero external dependencies on other sets
- **Side Effects:**
  - `writeMergeState()` and `updateMergeState()` in `merge.cjs` may become internal-only (wrapped by the transaction function)
  - `handleResume()` and the `execute resume` case in `rapid-tools.cjs` will both delegate to `resumeSet()` rather than containing their own logic
  - The `execute update-phase` handler will acquire a state lock during mutation

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Resume dedup changes JSON output shape, breaking skills/agents that parse it | High | Write contract tests capturing exact output JSON before refactoring; ensure `resumeSet()` returns identical structure |
| `withMergeStateTransaction()` lock contention with existing `withStateTransaction()` | Medium | Use a separate lock file (`merge-state.lock`) rather than reusing the state lock; proper-lockfile supports multiple named locks |
| `execute update-phase` currently only touches registry, not STATE.json -- adding STATE.json mutation changes semantics | Medium | Audit all callers of `update-phase` to confirm they expect STATE.json side effects; if not, keep registry-only but add validation guard |
| Merge.cjs call sites that do `writeMergeState()` after manual reads will need rewriting | Low | Systematic grep for `writeMergeState` and `updateMergeState` to identify all call sites; convert each to use transaction wrapper |

## Wave Breakdown (Preliminary)

- **Wave 1:** Resume deduplication -- extract `resumeSet()` into `execute.cjs`, rewrite both CLI entry points to delegate, add contract tests for output shape preservation
- **Wave 2:** State mutation hardening -- create `withMergeStateTransaction()` in `merge.cjs`, migrate all MERGE-STATE write sites, audit `execute update-phase` for STATE.json bypass
- **Wave 3:** Behavioral enforcement tests -- grep-based invariant tests ensuring no direct `fs.writeFileSync` for MERGE-STATE outside the transaction wrapper, and no duplicate resume logic

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
