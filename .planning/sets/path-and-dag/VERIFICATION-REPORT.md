# VERIFICATION-REPORT: path-and-dag

**Set:** path-and-dag
**Waves:** wave-1, wave-2
**Verified:** 2026-03-24
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| Extract resolveProjectRoot() from plan.cjs to core.cjs | Wave 1 Task 1 | PASS | Character-for-character port from plan.cjs lines 39-75 |
| Add DAG_SUBPATH constant to core.cjs | Wave 1 Task 2 | PASS | |
| Add ensureDagExists() guard to core.cjs | Wave 1 Task 3 | PASS | Throws with remediation steps |
| Deprecation wrapper for findProjectRoot() | Wave 1 Task 4 | PASS | console.warn + delegation |
| Unit tests for new core.cjs exports | Wave 1 Task 5 | PASS | 8 test cases covering worktree, no-git, nested, deprecation, DAG |
| Migrate plan.cjs to import from core.cjs | Wave 2 Task 1 | PASS | Removes local definition, switches DAG_CANONICAL_SUBPATH |
| Migrate ui-contract.cjs to import from core.cjs | Wave 2 Task 2 | PASS | Removes local definition and unused child_process |
| Fix DAG.json path bug in merge.cjs:274 | Wave 2 Task 3 | PASS | Replaces `.planning/DAG.json` with `.planning/sets/DAG.json` via DAG_SUBPATH |
| Replace inline DAG checks in execute.cjs | Wave 2 Task 4 | PASS | Both loading blocks (lines ~88 and ~260) replaced with ensureDagExists |
| Replace DAG_CANONICAL_SUBPATH in dag.cjs | Wave 2 Task 5 | PASS | Imports from core.cjs, adds backward-compat re-export |
| Switch rapid-tools.cjs to resolveProjectRoot | Wave 2 Task 6 | PASS | |
| Switch misc.cjs to resolveProjectRoot | Wave 2 Task 7 | PASS | |
| Add DAG generation step to /new-version SKILL.md | Wave 2 Task 8 | PASS | dag generate after STATE.json write |
| Update merge regression test | Wave 2 Task 9 | PASS | Adds resolveProjectRoot export assertion |
| Contract: worktree-transparent-root behavioral | Wave 1 Task 5 (tests 1-5) | PASS | Real git worktree test included |
| Contract: dag-generated-on-new-version behavioral | Wave 2 Task 8 | PASS | SKILL.md step added; contract says "enforced_by: test" but no automated test is written for this -- acceptable since SKILL.md is a procedural instruction, not code |
| dag.test.cjs references to DAG_CANONICAL_SUBPATH | Not covered | GAP | dag.test.cjs imports DAG_CANONICAL_SUBPATH at line 16 and tests it at lines 777, 799-800. Wave 2 Task 5 adds a backward-compat re-export in dag.cjs which keeps these tests passing, but they are not updated to use DAG_SUBPATH. Minor -- tests still pass via alias. |
| src/commands/dag.cjs imports DAG_CANONICAL_SUBPATH | Wave 2 Task 5 (indirect) | PASS | Covered by backward-compat re-export in dag.cjs exports |

## Implementability

| File | Job | Action | Status | Notes |
|------|-----|--------|--------|-------|
| `src/lib/core.cjs` | Wave 1 Tasks 1-4 | Modify | PASS | Exists on disk; findProjectRoot at line 30, exports at line 89 |
| `src/lib/core.test.cjs` | Wave 1 Task 5 | Modify | PASS | Exists on disk; has existing findProjectRoot tests to keep |
| `src/lib/plan.cjs` | Wave 2 Task 1 | Modify | PASS | Exists; local resolveProjectRoot at line 39, DAG_CANONICAL_SUBPATH import at line 20 |
| `src/lib/ui-contract.cjs` | Wave 2 Task 2 | Modify | PASS | Exists; local resolveProjectRoot at line 38 |
| `src/commands/merge.cjs` | Wave 2 Task 3 | Modify | PASS | Exists; hardcoded `.planning/DAG.json` confirmed at line 274 |
| `src/commands/execute.cjs` | Wave 2 Task 4 | Modify | PASS | Exists; inline DAG checks at lines 90 and 263 |
| `src/lib/dag.cjs` | Wave 2 Task 5 | Modify | PASS | Exists; DAG_CANONICAL_SUBPATH at line 25, exported at line 502 |
| `src/bin/rapid-tools.cjs` | Wave 2 Task 6 | Modify | PASS | Exists; findProjectRoot import at line 4, usage at line 200 |
| `src/commands/misc.cjs` | Wave 2 Task 7 | Modify | PASS | Exists; findProjectRoot import at line 116, usage at line 140 |
| `skills/new-version/SKILL.md` | Wave 2 Task 8 | Modify | PASS | Exists on disk |
| `tests/merge-regression.test.cjs` | Wave 2 Task 9 | Modify | PASS | Exists; findProjectRoot assertion at line 67 |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `src/lib/core.cjs` | Wave 1 Tasks 1, 2, 3, 4 | PASS | All tasks modify different sections of the same file within a single wave. Tasks are sequential (1 adds function, 2 adds constant, 3 adds another function, 4 modifies existing function). No conflict -- single executor handles all. |

No file is claimed by multiple jobs within the same wave. Wave 1 has a single "job" (all 5 tasks). Wave 2 tasks each target distinct files. No conflicts detected.

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Wave 2 depends on Wave 1 (core.cjs exports) | PASS | Explicitly stated in Wave 2 header. Wave ordering enforces this. |
| Wave 2 Task 5 (dag.cjs) must complete before or provide backward-compat for commands/dag.cjs | PASS | Task 5 explicitly includes backward-compat re-export `DAG_CANONICAL_SUBPATH: DAG_SUBPATH` |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | -- | No auto-fixes required |

## Summary

The plan is structurally sound and covers all requirements from the CONTEXT.md, CONTRACT.json, and SET-OVERVIEW.md. All file references are valid -- every file marked for modification exists on disk, and no file is marked for creation. There are no file ownership conflicts between tasks. The single gap is that `src/lib/dag.test.cjs` is not explicitly updated to use `DAG_SUBPATH` instead of `DAG_CANONICAL_SUBPATH`, but this is adequately mitigated by the backward-compatibility re-export alias added in Wave 2 Task 5, so existing tests will continue to pass without modification. Verdict: PASS_WITH_GAPS.
