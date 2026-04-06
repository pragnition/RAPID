# Set: fix-stub-cleanup

**Created:** 2026-04-06 (via /add-set)
**Milestone:** v6.0.0

## Scope
Close the 3 actionable gaps identified in the v6.0.0 audit report:
1. Wire `cleanupStubSidecars()` into the merge pipeline post-resolution flow in merge.cjs (medium severity)
2. Fix stale CONTRACT.json export name `migrateDAGv1toV2` -> `migrateDAGv1toV3` in dag-central-grouping (low severity)
3. Fix CONTRACT.json `claudeMdTokenBudget` from 15 to 45 lines in init-enhancements (low severity)

## Key Deliverables
- merge.cjs calls `cleanupStubSidecars()` after conflict resolution completes
- dag-central-grouping CONTRACT.json export name matches implementation
- init-enhancements CONTRACT.json behavioral invariant matches implementation

## Dependencies
Builds on scaffold-overhaul (stub primitives) and dag-central-grouping (DAG migration), but both are already merged.

## Files and Areas
- `src/merge.cjs` — wire cleanupStubSidecars() into post-resolution flow
- `.planning/sets/dag-central-grouping/CONTRACT.json` — fix export name migrateDAGv1toV2 -> migrateDAGv1toV3
- `.planning/sets/init-enhancements/CONTRACT.json` — fix claudeMdTokenBudget 15 -> 45
