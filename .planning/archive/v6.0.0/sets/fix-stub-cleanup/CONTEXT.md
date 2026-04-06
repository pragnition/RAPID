# CONTEXT: fix-stub-cleanup

**Set:** fix-stub-cleanup
**Generated:** 2026-04-06
**Mode:** interactive

<domain>
## Set Boundary
Close the 3 actionable gaps identified in the v6.0.0 audit report: wire `cleanupStubSidecars()` into the merge pipeline post-resolution flow in merge.cjs, fix stale CONTRACT.json export name in dag-central-grouping, and fix CONTRACT.json behavioral invariant value in init-enhancements. All three are localized, low-risk fixes that correct omissions and stale metadata from already-merged sets.
</domain>

<decisions>
## Implementation Decisions

### Merge Pipeline Insertion Point
- Place `cleanupStubSidecars(projectRoot)` call **after the feature regression check passes**, immediately before the successful return statement in `mergeSet()` (after line 1832 in merge.cjs).
- Also wire cleanup into the **solo-mode early return path** (around line 1742), since solo-mode sets can still have stub sidecars from scaffold operations.
- **Rationale:** Placing cleanup after the regression check ensures we only clean up when the merge is fully confirmed safe. Including solo mode prevents stub sidecar leaks regardless of merge strategy.

### Cleanup Failure Behavior
- Wrap the `cleanupStubSidecars()` call in a **try/catch that logs a warning and continues**. The merge must not fail due to cosmetic cleanup issues.
- Add a `stubsCleanedUp` numeric field to the `mergeSet()` return object to give callers visibility into cleanup results. Set to 0 on failure.
- **Rationale:** Stub sidecars are cosmetic artifacts, not functional code. Failing a successful merge over cleanup errors is disproportionate. The soft-warn pattern matches the existing regression check's catch-and-continue approach. The return field gives the skill layer visibility without breaking the established return contract.

### CONTRACT.json Audit Breadth
- Fix **only the 2 named items**: `migrateDAGv1toV2` -> `migrateDAGv1toV3` in dag-central-grouping and `claudeMdTokenBudget` 15 -> 45 in init-enhancements.
- **Verify each fix against the actual implementation** before applying: grep for the real function name in dag.cjs and check the actual line budget in the implementation.
- **Rationale:** The audit was comprehensive — if other CONTRACT.json issues existed, they would have been caught. Strict scope avoids scope creep on a set designed to be minimal and surgical. Verification confirms the audit report is accurate rather than blindly applying fixes.

### Test Coverage Strategy
- Add a **unit test with mocked stub module** to verify `cleanupStubSidecars()` is called at the correct point in the merge flow, consistent with existing merge.test.cjs patterns.
- Add a **separate test case for the solo-mode cleanup path** since it's a distinct code branch (early return at line 1742).
- **Rationale:** The function itself is already tested in stub.test.cjs — what needs coverage is the wiring. Unit tests with mocks are fast, deterministic, and consistent with merge.test.cjs conventions. Solo mode is a separate code path that should be independently verified to prevent silent regression.
</decisions>

<specifics>
## Specific Ideas
- The cleanup call should use `projectRoot` as the `targetDir` argument (same value available throughout `mergeSet()`)
- On cleanup failure, the warning message should mention `scaffold verify-stubs` as the manual fallback
- The `stubsCleanedUp` field should be 0 for both the failure case and the case where no sidecars exist
</specifics>

<code_context>
## Existing Code Insights
- `stub.cjs` already exports `cleanupStubSidecars()` at line 449; `merge.cjs` already imports `stub` at line 35 — no new imports needed
- `cleanupStubSidecars(targetDir)` returns `{ cleaned: number, files: string[] }` — the `cleaned` count maps directly to the proposed `stubsCleanedUp` return field
- `mergeSet()` solo-mode early return is at line 1742; the successful merge return is at line 1834
- The regression check (lines 1807-1832) uses the same try/catch-and-continue pattern proposed for cleanup failure handling
- dag-central-grouping CONTRACT.json has the stale export at line 45 (`migrateDAGv1toV2`)
- init-enhancements CONTRACT.json has the wrong value at line 34 (`claudeMdTokenBudget: 15`)
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
