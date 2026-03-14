# VERIFICATION-REPORT: review-after-merge

**Set:** review-after-merge
**Waves:** wave-1, wave-2
**Verified:** 2026-03-14
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| `--post-merge` flag on review skill CLI | W1-T3 (CLI wiring), W2-T1 (SKILL.md) | PASS | Flag detection in `review scope`, routing to `scopeSetPostMerge()`, and skill markdown conditional paths all addressed |
| Merge commit identification via MERGE-STATE.json | W1-T1 (scopeSetPostMerge) | PASS | Reads `mergeCommit` from MERGE-STATE via `merge.readMergeState()`, falls back to `git log --grep` |
| Merge commit validation (2 parents) | W1-T1 (scopeSetPostMerge) | PASS | Uses `git cat-file -p` to validate parent count |
| Changed files from merge commit diff | W1-T1 (scopeSetPostMerge) | PASS | Uses `git diff --name-only <commit>^1..<commit>` |
| Filter `.planning/` files from diff | W1-T1 (scopeSetPostMerge) | PASS | Explicitly filters out `.planning/` prefixed files |
| One-hop dependent discovery | W1-T1 (scopeSetPostMerge) | PASS | Calls existing `findDependents(cwd, changedFiles)` |
| Post-merge artifact directory `.planning/post-merge/{setId}/` | W1-T2 (logIssuePostMerge, loadPostMergeIssues, generatePostMergeReviewSummary) | PASS | Three functions handle issue logging, loading, and summary generation to the new directory |
| No status mutation for post-merge path (CONTRACT behavioral) | W1-T1, W1-T3, W2-T1 | PASS | Plan explicitly states no `state transition` calls; W2 SKILL.md skips Steps 0c and 0d for post-merge |
| Scoping correctness from merge commit (CONTRACT behavioral) | W1-T1, W1-T4 | PASS | Dedicated function and test coverage for merge commit diff scoping |
| Merge skill suggests post-merge review after merge | W2-T2 (merge SKILL.md) | PASS | Step 8 and Step 6 updates documented |
| Unit tests for scopeSetPostMerge | W1-T4 | PASS | 7 test cases covering happy path, fallback, error cases, and behavioral contract |
| Unit tests for post-merge artifact functions | W1-T5 | PASS | Tests for logIssuePostMerge, loadPostMergeIssues, generatePostMergeReviewSummary |
| CLI tests for --post-merge flag | W1-T5 | PASS | Tests in rapid-tools.test.cjs |
| USAGE string update | W1-T3 | PASS | Plan specifies updating line 80 USAGE string |
| `--post-merge` on log-issue and summary subcommands | W1-T3 | PASS | Plan covers adding flag to both subcommands |
| Import from state-consistency (canonical status literals) | W2-T1 | GAP | CONTRACT.json imports `canonical-status-literals` from `state-consistency`. The review SKILL.md currently uses `reviewing` as a status. Wave 2 adds conditional branches but does not explicitly address reconciling with the `state-consistency` set's removal of `reviewing`. However, the post-merge path bypasses status validation entirely, so this import is only relevant to the standard path which is out of scope for this set. |

## Implementability

| File | Job | Action | Status | Notes |
|------|-----|--------|--------|-------|
| `src/lib/review.cjs` | W1-T1, W1-T2 | Modify | PASS | File exists at `/home/kek/Projects/RAPID/src/lib/review.cjs` (709 lines). Plan references inserting after `scopeSetForReview` (~line 99) and in exports. Locations verified. |
| `src/bin/rapid-tools.cjs` | W1-T3 | Modify | PASS | File exists. `case 'scope'` handler at line 1373, USAGE string at line 80, `case 'summary'` at line 1560. All references valid. |
| `src/lib/review.test.cjs` | W1-T4, W1-T5 | Modify | PASS | File exists at expected path. |
| `src/bin/rapid-tools.test.cjs` | W1-T5 | Modify | PASS | File exists at expected path. |
| `skills/review/SKILL.md` | W2-T1 | Modify | PASS | File exists. Steps 0b, 0c, 0d, 2, and others referenced in plan are present in the file. |
| `skills/merge/SKILL.md` | W2-T2 | Modify | PASS | File exists. Step 6 at line 351, Step 8 at line 558, Important Notes at line 595. All referenced sections exist. |
| `src/lib/merge.cjs` (dependency) | W1-T1 (import) | N/A | PASS | `readMergeState` is exported from merge.cjs (line 1945). `mergeCommit` field exists in MergeStateSchema (line 106, optional string). Import pattern `const merge = require('./merge.cjs')` is valid. |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `src/lib/review.cjs` | W1-T1, W1-T2 | PASS_WITH_GAPS | Both tasks modify different sections: T1 adds `scopeSetPostMerge()` after `scopeSetForReview` (~line 99), T2 adds `logIssuePostMerge()` and friends in the Issue Management section (~line 377+). Both add to `module.exports` but in different comment sections. No function overlap. T1 must execute before T2 (T2 may reference patterns established by T1), but both are independent additions. |
| `src/lib/review.test.cjs` | W1-T4, W1-T5 | PASS_WITH_GAPS | T4 adds `describe('scopeSetPostMerge', ...)` block. T5 adds separate describe blocks for post-merge artifact functions. Different test sections, no overlap. T4 should execute before T5 (sequential task ordering). |
| `src/bin/rapid-tools.cjs` | W1-T3 (sole owner) | PASS | No conflicts. |
| `src/bin/rapid-tools.test.cjs` | W1-T5 (sole owner) | PASS | No conflicts. |
| `skills/review/SKILL.md` | W2-T1 (sole owner) | PASS | No conflicts. |
| `skills/merge/SKILL.md` | W2-T2 (sole owner) | PASS | No conflicts. |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| W1-T1 before W1-T2 | PASS | T2's `logIssuePostMerge` is independent of T1's `scopeSetPostMerge`, but both modify `review.cjs` and the exports object. Sequential task numbering enforces correct ordering. |
| W1-T1/T2 before W1-T3 | PASS | T3 wires CLI to call `review.scopeSetPostMerge()` and `review.logIssuePostMerge()` which are created by T1 and T2. Sequential ordering is correct. |
| W1-T1/T2/T3 before W1-T4/T5 | PASS | Tests in T4/T5 depend on functions created in T1/T2 and CLI wiring in T3. Sequential ordering is correct. |
| Wave 1 before Wave 2 | PASS | Wave 2 SKILL.md references CLI commands (`review scope --post-merge`) that Wave 1 creates. Explicit wave dependency documented in Wave 2 plan header. |
| `state-consistency` set (external) | PASS_WITH_GAPS | CONTRACT.json imports `canonical-status-literals` from `state-consistency` set. The post-merge path bypasses status validation entirely, so this dependency is non-blocking for the core feature. The standard review path's status references (`complete`, `reviewing`) are out of scope for this set. |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | - | No auto-fixes needed. All plans are structurally sound. |

## Summary

The wave plans for `review-after-merge` are structurally sound and cover all requirements from CONTEXT.md and CONTRACT.json. All six files referenced across both waves exist on disk at their expected paths. The two instances of shared file ownership within Wave 1 (`review.cjs` by Tasks 1+2, `review.test.cjs` by Tasks 4+5) are benign -- each task modifies distinct sections with no function-level overlap. The only gap is the `state-consistency` import dependency: the `reviewing` status literal in the standard review path may be affected by that set's changes, but the post-merge path (this set's core deliverable) bypasses status validation entirely, making this a non-blocking concern. Verdict: **PASS_WITH_GAPS**.
