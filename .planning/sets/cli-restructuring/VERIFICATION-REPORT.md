# VERIFICATION-REPORT: cli-restructuring

**Set:** cli-restructuring
**Waves:** wave-1, wave-2, wave-3
**Verified:** 2026-03-16
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| Split rapid-tools.cjs into router + 13 command modules | Wave 2 (Tasks 1-19) | PASS | Plan creates 14 command files (display and prereqs get own files instead of going in misc); aligns with CONTEXT.md "tiny command groups get their own dedicated files" |
| Create parseArgs() utility | Wave 1 Task 1 | PASS | Full spec with schema types including multi:N |
| Create readAndValidateStdin() utility | Wave 1 Task 5 | PASS | Covers sync, async, and Zod validation paths |
| Create exitWithError() utility | Wave 1 Task 3 | PASS | Plus CliError class for throw-based pattern |
| Contract test harness for JSON output shapes | Wave 1 Task 7 | PASS | Covers all 13+ command groups with structural assertions |
| Extract handlers verbatim (Wave 2) | Wave 2 Tasks 1-18 | PASS | All 18 handlers extracted one-by-one in ascending size order |
| Router under 300 lines | Wave 2 Task 19 | PASS | Explicit `wc -l` verification step included |
| Migrate all 10 args.indexOf() to parseArgs() | Wave 3 Tasks 2-5 | PASS | All 10 sites mapped: review(2), execute(4), merge(2), misc+resolve(2) |
| Migrate process.exit(1) to throw CliError | Wave 3 Tasks 6-7 | PASS | ~91 exits across all handlers (24 small + 67 large) |
| Wire readAndValidateStdin() into stdin handlers | Wave 3 Task 8 | PASS | 5 sync sites (plan, review, execute) + 1 async site (state) |
| Router-level CliError catch | Wave 3 Task 1 | PASS | Wraps dispatch in try/catch for CliError |
| Handler unit tests for throw behavior | Wave 3 Task 9 | PASS | New commands.test.cjs verifies CliError throws |
| JSON output preserved (behavioral contract) | Wave 1 Task 7 + all waves | PASS | Contract tests run after every extraction and migration step |
| Consistent error format via exitWithError() | Wave 3 Tasks 1,6,7 | PASS | Router catches CliError, calls exitWithError |
| Import structure: direct require, no barrel | All waves | PASS | Plan uses explicit `require('../lib/foo.cjs')` throughout |
| migrateStateVersion stays in router | Wave 2 Task 19 | PASS | Explicitly listed as router-retained function |
| Error handling: throw + catch pattern | Wave 3 | PASS | Handlers throw CliError, router catches |
| CONTEXT.md: "6 sync stdin sites" | Wave 3 Task 8 | GAP | Only 5 sync `readFileSync(0)` sites found in codebase (lines 1006, 1016, 1025, 1432, 1848), not 6. All 5 are covered by the plan. |
| USAGE constant access from extracted handlers | Wave 2 | GAP | 8 handlers reference `USAGE` (lock, state, plan, worktree, set-init, review, execute, merge). After extraction to src/commands/, USAGE will be undefined. Plan says "exact copy" but does not address how USAGE will be made available to command modules. |

## Implementability

| File | Wave | Action | Status | Notes |
|------|------|--------|--------|-------|
| `src/lib/args.cjs` | wave-1 | Create | PASS | Does not exist |
| `src/lib/args.test.cjs` | wave-1 | Create | PASS | Does not exist |
| `src/lib/errors.cjs` | wave-1 | Create | PASS | Does not exist |
| `src/lib/errors.test.cjs` | wave-1 | Create | PASS | Does not exist |
| `src/lib/stdin.cjs` | wave-1 | Create | PASS | Does not exist |
| `src/lib/stdin.test.cjs` | wave-1 | Create | PASS | Does not exist |
| `src/commands/.gitkeep` | wave-1 | Create | PASS | Directory does not exist |
| `src/bin/contract.test.cjs` | wave-1 | Create | PASS | Does not exist |
| `src/bin/rapid-tools.cjs` | wave-2 | Modify | PASS | Exists, 2580 lines |
| `src/commands/display.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/prereqs.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/misc.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/lock.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/resolve.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/plan.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/set-init.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/init.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/state.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/worktree.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/review.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/build-agents.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/execute.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/commands/merge.cjs` | wave-2 | Create | PASS | Does not exist |
| `src/bin/rapid-tools.cjs` | wave-3 | Modify | PASS | Will exist after wave-2 |
| `src/commands/review.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/execute.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/merge.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/misc.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/resolve.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/state.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/worktree.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/build-agents.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/display.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/prereqs.cjs` | wave-3 | Modify | PASS | Created in wave-2 (plan notes "no changes") |
| `src/commands/lock.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/plan.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/set-init.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/init.cjs` | wave-3 | Modify | PASS | Created in wave-2 |
| `src/commands/commands.test.cjs` | wave-3 | Create | PASS | Does not exist |
| All `src/lib/*.cjs` dependencies | all | Reference | PASS | All 18 referenced lib modules exist on disk |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `src/bin/rapid-tools.cjs` | wave-2 (Modify), wave-3 (Modify) | PASS | Sequential waves; wave-2 reduces to router, wave-3 adds CliError catch. Different sections modified. |
| `src/commands/misc.cjs` | wave-2 Tasks 3,4,5,6,8 (Create+Modify x4) | PASS | Task 3 creates; Tasks 4,5,6,8 add handlers. Sequential by plan ordering. |
| `src/commands/misc.cjs` | wave-2 (Create), wave-3 Tasks 5,6 (Modify) | PASS | Wave-2 creates, wave-3 migrates. Task 5 changes args.indexOf in handleVerifyArtifacts; Task 6 changes process.exit in all misc handlers. Different code patterns, but same functions. |
| `src/commands/resolve.cjs` | wave-2 (Create), wave-3 Tasks 5,6 (Modify) | PASS | Task 5 migrates args.indexOf; Task 6 migrates process.exit. Different patterns in same handler. |
| `src/commands/review.cjs` | wave-2 (Create), wave-3 Tasks 2,7,8 (Modify) | PASS | Task 2: parseArgs migration. Task 7: CliError migration. Task 8: stdin migration. Three different concerns, all modify different parts of the handler. |
| `src/commands/execute.cjs` | wave-2 (Create), wave-3 Tasks 3,7,8 (Modify) | PASS | Task 3: parseArgs migration. Task 7: CliError migration. Task 8: stdin migration. Same pattern as review. |
| `src/commands/merge.cjs` | wave-2 (Create), wave-3 Tasks 4,7 (Modify) | PASS | Task 4: parseArgs migration (--agent-phase/--agent-phase2). Task 7: CliError migration. |
| All other command files | wave-2 (Create), wave-3 (Modify) | PASS | Each file created in wave-2, modified in wave-3 for CliError migration. No within-wave conflicts. |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Wave 1 must complete before Wave 2 | PASS | Wave 2 relies on src/commands/ directory and contract tests from Wave 1 |
| Wave 2 must complete before Wave 3 | PASS | Wave 3 modifies command files created in Wave 2 |
| Wave 2 Tasks are sequential (misc.cjs) | PASS_WITH_GAPS | Tasks 3->4->5->6->8 must execute in order for misc.cjs. Plan's task numbering enforces this. |
| Wave 2 Tasks 1-18 are sequential (rapid-tools.cjs) | PASS_WITH_GAPS | Each task modifies rapid-tools.cjs to remove a handler. Sequential execution required. Plan's task numbering enforces this. |
| Wave 3 Task 1 before Tasks 6-7 | PASS | Router catch must be in place before handlers throw CliError. Plan orders this correctly. |
| Wave 3 Tasks 2-5 independent of Tasks 6-7 | PASS | parseArgs migration and CliError migration touch different code patterns |
| Wave 1 errors.cjs before Wave 3 Task 1 | PASS | CliError class defined in Wave 1, used in Wave 3. Cross-wave dependency correctly ordered. |
| Wave 1 args.cjs before Wave 3 Tasks 2-5 | PASS | parseArgs defined in Wave 1, used in Wave 3. Cross-wave dependency correctly ordered. |
| Wave 1 stdin.cjs before Wave 3 Task 8 | PASS | readAndValidateStdin defined in Wave 1, used in Wave 3. Cross-wave dependency correctly ordered. |
| foundation-hardening set (import) | PASS_WITH_GAPS | CONTRACT.json imports stateSchemas from foundation-hardening. Wave 1 stdin.cjs accepts schemas as parameters (does not import directly). Dependency is deferred to callers. |
| data-integrity set (import) | PASS | CONTRACT.json imports resumeSet and withMergeStateTransaction. These are called within handlers (execute, merge) and will be extracted verbatim. No code changes needed for these imports. |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | -- | No auto-fixes required. The USAGE gap is noted but cannot be auto-fixed without changing plan scope. |

## Summary

**Verdict: PASS_WITH_GAPS**

The three wave plans are structurally sound, correctly sequenced, and cover all CONTRACT.json exports and CONTEXT.md decisions. All file references are valid: files to be created do not exist, files to be modified exist, all library dependencies are present, and all 18 handler line ranges match the actual codebase. No file ownership conflicts exist across or within waves.

Two gaps prevent a clean PASS:

1. **USAGE constant gap (medium risk):** Eight extracted handlers (lock, state, plan, worktree, set-init, review, execute, merge) reference the `USAGE` string from the router's module scope. The Wave 2 plan instructs "exact copy" extraction but does not specify how `USAGE` will be made available to command modules after extraction. The execution agent must either export USAGE from the router and import it in command files, or replace these references with an error-only pattern. This is resolvable during execution without plan changes.

2. **Stdin count discrepancy (low risk):** CONTEXT.md claims "6 sync stdin sites" but only 5 `fs.readFileSync(0)` calls exist in the codebase. All 5 are covered by Wave 3 Task 8. This is a documentation inaccuracy, not a planning gap.
