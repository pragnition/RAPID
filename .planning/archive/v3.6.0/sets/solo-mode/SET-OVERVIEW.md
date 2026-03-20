# SET-OVERVIEW: solo-mode

## Approach

Solo mode allows sets to execute directly on the main branch without creating a dedicated git worktree or branch. The infrastructure for solo registration (`setInitSolo`), detection (`isSoloMode`), and diff-base resolution (`getSetDiffBase`) already exists in `src/lib/worktree.cjs`. The merge skill (`skills/merge/SKILL.md`) and review skill (`skills/review/SKILL.md`) already contain solo-aware documentation sections. However, the lifecycle is incomplete: when a solo set finishes execution, it transitions to `complete` but never reaches `merged` -- leaving the user to manually run `/rapid:merge` on a set that has no branch to merge.

This set closes that gap by adding an auto-transition from `complete` to `merged` at the end of execute-set for solo sets, updating the merge skill to gracefully skip solo sets with an informational message, updating the review skill to accept solo+merged sets in post-merge review mode, and ensuring the status display correctly reflects the solo merged state.

The approach is conservative: we add solo-awareness checks at specific decision points in the existing pipeline rather than introducing new commands or restructuring the workflow. All changes are guarded by the `isSoloMode()` check from `src/lib/worktree.cjs`, ensuring zero impact on the normal worktree-based set lifecycle.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/worktree.cjs` | Solo mode helpers (`isSoloMode`, `getSetDiffBase`, `setInitSolo`) and status display | Existing -- modify |
| `src/lib/worktree.test.cjs` | Tests for solo auto-merge logic and status display | Existing -- modify |
| `skills/merge/SKILL.md` | Merge skill orchestrator -- needs solo skip path formalized | Existing -- modify |
| `skills/review/SKILL.md` | Review skill -- needs solo+merged acceptance path | Existing -- modify |

## Integration Points

- **Exports:**
  - `autoMergeSolo(cwd, setId)` -- called from execute-set Step 6 when registry entry has `solo: true`; transitions set from `complete` to `merged` without git merge operations
  - `detectSoloAndSkip(cwd, setId)` -- called from merge skill to return informational message instead of attempting merge
  - `adjustReviewForSolo(cwd, setId)` -- called from review skill to switch to post-merge review mode for solo+merged sets
- **Imports:**
  - `transitionSet(cwd, setId, targetStatus)` from `dag-and-state-fixes` -- reliable state transition for the `complete -> merged` auto-transition (already merged into main)
- **Side Effects:**
  - Solo sets will reach `merged` status automatically after execution, bypassing the manual `/rapid:merge` step
  - Running `/rapid:merge` on a solo set produces an informational message instead of an error
  - Running `/rapid:review` on a solo+merged set enters post-merge review mode instead of rejecting

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auto-transition race condition: execute-set completes and transitions to `complete`, then immediately tries `merged` -- lock contention possible | Medium | Use retry logic already present in execute-set Step 6; `transitionSet` handles lock acquisition internally |
| Review skill rejects solo+merged status because validation checks for `complete` or `executed` only | High | Update validation step in review SKILL.md to accept `merged` status when solo flag is set, routing to post-merge path |
| Status display shows solo merged sets inconsistently (e.g., missing `(solo)` annotation or wrong phase) | Low | Verify `formatMarkIIStatus` and `formatStatusTable` both annotate solo entries; add test coverage |
| Merge skill attempts git operations on solo set if fast-path detection fails | Medium | Guard with explicit `isSoloMode()` check before any git merge-tree or subagent dispatch |

## Wave Breakdown (Preliminary)

- **Wave 1:** Core auto-merge logic -- add `autoMergeSolo` function to `worktree.cjs` and wire it into execute-set Step 6; add unit tests for the auto-transition path
- **Wave 2:** Skill updates -- update merge SKILL.md to formalize solo skip path with `detectSoloAndSkip`, update review SKILL.md to accept solo+merged via `adjustReviewForSolo`; verify status display correctness
- **Wave 3:** Integration validation -- end-to-end test of solo lifecycle (init solo -> execute -> auto-merge -> review post-merge), edge case handling (re-entry on already-merged solo set)

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
