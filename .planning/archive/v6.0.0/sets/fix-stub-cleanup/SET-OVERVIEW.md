# SET-OVERVIEW: fix-stub-cleanup

## Approach

This set closes three actionable gaps identified in the v6.0.0 audit report. All three are localized, low-risk fixes that do not introduce new features -- they correct omissions and stale metadata from the scaffold-overhaul, dag-central-grouping, and init-enhancements sets.

The primary fix (medium severity) wires the existing `cleanupStubSidecars()` function from `stub.cjs` into the merge pipeline's post-resolution flow in `merge.cjs`. The function already exists, is tested, and `merge.cjs` already imports the `stub` module at line 35 -- the gap is simply that the cleanup call was never added after conflict resolution completes. The remaining two fixes are CONTRACT.json metadata corrections: updating a stale export name and a mismatched behavioral invariant value.

The strategy is straightforward: make the three targeted edits, verify existing tests still pass, and add a focused test for the new `cleanupStubSidecars()` call site in the merge flow.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/merge.cjs` | Wire `cleanupStubSidecars()` into post-resolution flow | Existing (add call) |
| `src/lib/stub.cjs` | Provides `cleanupStubSidecars()` (already exported) | Existing (no changes) |
| `.planning/sets/dag-central-grouping/CONTRACT.json` | Fix export name `migrateDAGv1toV2` -> `migrateDAGv1toV3` | Existing (metadata fix) |
| `.planning/sets/init-enhancements/CONTRACT.json` | Fix `claudeMdTokenBudget` from 15 to 45 lines | Existing (metadata fix) |

## Integration Points

- **Exports:** None -- this set provides no new functions or types to other sets.
- **Imports:** None -- all dependencies (stub.cjs, merge.cjs) are already merged and available.
- **Side Effects:** After this set, the merge pipeline will automatically clean up `.rapid-stub.*.bak` sidecar files following conflict resolution. This eliminates the need for manual `scaffold verify-stubs` cleanup post-merge.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `cleanupStubSidecars()` called at wrong point in merge flow, removing files prematurely | Medium | Call must be placed strictly after all conflict resolution (T0-T4) completes and the merge commit is created; verify with existing merge integration tests |
| CONTRACT.json edits break downstream tooling that reads contract metadata | Low | These are metadata-only fixes -- no runtime code reads `migrateDAGv1toV2` or the 15-line budget from CONTRACT.json at runtime |

## Wave Breakdown (Preliminary)

- **Wave 1:** All three fixes can be executed in parallel since they touch independent files:
  - Task A: Wire `cleanupStubSidecars()` into `merge.cjs` post-resolution flow + add test coverage
  - Task B: Fix `migrateDAGv1toV2` -> `migrateDAGv1toV3` in dag-central-grouping CONTRACT.json (line 45)
  - Task C: Fix `claudeMdTokenBudget` 15 -> 45 in init-enhancements CONTRACT.json (line 33)

Note: This is a preliminary breakdown. Given the narrow scope, this set may complete in a single wave. Detailed wave/job planning happens during /discuss and /plan.
