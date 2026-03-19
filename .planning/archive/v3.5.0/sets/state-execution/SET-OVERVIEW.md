# SET-OVERVIEW: state-execution

## Approach

This set addresses three tightly coupled failures in the execute-review-merge pipeline. The core problem is that the `executed` status creates a dead zone: sets that finish execution but fail the `executed -> complete` transition are rejected by the review skill, with no recovery path except re-running execute-set. The fix relaxes the review skill to accept `executed` in addition to `complete`, and adds a self-transition (`executed -> executed`) for idempotent re-entry.

The second problem is that planning artifacts (WAVE-COMPLETE.md, PLAN-DIGEST.md) created during execution end up as untracked files on main, which blocks `git merge --no-ff` from the worktree branch. The fix adds a pre-merge cleanup step in the merge skill that handles stale untracked planning artifacts before attempting the merge, preventing the hard failure.

The third deliverable is a new `/rapid:bug-fix` user-facing skill. Today, the `rapid-bugfix` agent exists but is only reachable from within the review pipeline's internal bug-hunt cycle. The new skill provides a top-level entry point: it reads review artifacts (REVIEW-UNIT.md, REVIEW-SCOPE.md, REVIEW-UAT.md, and any REVIEW-ISSUES.json), presents findings to the user, and dispatches the existing `rapid-bugfix` agent. After fixes are applied, the skill updates REVIEW-ISSUES.json to mark findings as fixed.

Sequencing: the state transition fix (F5) is foundational and should land first, since F6 (merge cleanup) operates in the same pipeline and benefits from F5 being in place. The bug-fix skill (F10) is independent and can be built in parallel.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/state-transitions.cjs` | SET_TRANSITIONS map -- add `executed` self-loop | Existing (modify) |
| `src/lib/state-transitions.test.cjs` | Tests for transition map changes | Existing (modify) |
| `skills/review/SKILL.md` | Step 0c status validation -- accept `executed` | Existing (modify) |
| `skills/merge/SKILL.md` | Pre-merge cleanup step for untracked artifacts | Existing (modify) |
| `src/commands/merge.cjs` | `mergeSet()` -- add untracked file handling | Existing (modify) |
| `skills/bug-fix/SKILL.md` | New user-facing bug-fix skill definition | New |
| `src/lib/review.cjs` | `readReviewArtifacts()` helper function | Existing (modify) |
| `agents/rapid-bugfix.md` | Existing bugfix agent (no changes expected) | Existing (reference) |

## Integration Points

- **Exports:**
  - `relaxed-review-status-check`: Review skill accepts sets in both `complete` and `executed` status at Step 0c.
  - `state-transition-self-loop`: `SET_TRANSITIONS.executed` gains `executed` as an allowed target (in addition to `complete`) for idempotent re-entry.
  - `merge-artifact-cleanup`: Merge skill adds a pre-merge cleanup step that commits or removes untracked planning artifacts on main before `git merge --no-ff`.
  - `bug-fix-skill`: New `/rapid:bug-fix` skill registered under `skills/bug-fix/SKILL.md`.
  - `bug-fix-artifact-reader`: Library function `readReviewArtifacts(projectRoot, setId, postMerge?)` that reads and parses all review artifacts for a set.

- **Imports:** None. This set is fully independent with no dependencies on other v3.5.0 sets.

- **Side Effects:**
  - Sets stuck in `executed` status can now proceed to review without re-running execute-set.
  - Merge operations no longer fail due to untracked `.planning/` files on main.
  - Users can invoke `/rapid:bug-fix <set-id>` after review to fix identified issues.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Self-loop `executed -> executed` allows infinite re-entry without progress | Low | The self-loop is intentional for idempotency; execute-set already has wave-completion markers to track actual progress |
| Pre-merge cleanup accidentally removes legitimate untracked files | Medium | Scope cleanup to `.planning/sets/{setId}/` paths only; never touch files outside the set's planning directory |
| `readReviewArtifacts()` path resolution differs between standard and post-merge modes | Medium | Test both paths explicitly; accept optional `postMerge` parameter that switches between `.planning/sets/` and `.planning/post-merge/` |
| Bug-fix skill dispatches agent on wrong branch (main vs. worktree) | High | Detect worktree context from registry before dispatching; pass explicit working directory to agent |
| Review skill change creates ambiguity about whether a set was actually verified | Low | The `complete` status still means "verified"; `executed` means "waves ran, verification may be incomplete" -- document this distinction in the skill |

## Wave Breakdown (Preliminary)

- **Wave 1:** State transition and review fixes -- modify `SET_TRANSITIONS` to add `executed` self-loop, update review skill Step 0c to accept `executed`, add tests for the new transition paths.
- **Wave 2:** Merge pre-cleanup and artifact handling -- add untracked file detection and cleanup step to merge skill and `mergeSet()`, test with scenarios involving stale planning artifacts.
- **Wave 3:** Bug-fix skill and artifact reader -- create `skills/bug-fix/SKILL.md`, implement `readReviewArtifacts()` in `review.cjs`, wire the skill to dispatch `rapid-bugfix` agent and update REVIEW-ISSUES.json afterward.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
