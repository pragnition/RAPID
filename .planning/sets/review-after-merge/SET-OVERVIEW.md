# SET-OVERVIEW: review-after-merge

## Approach

This set adds a `--post-merge` flag to the existing `/rapid:review` skill, enabling code review of sets that have already been merged into main. Currently, the review pipeline requires a set to be in `complete` status with a live worktree branch, which means review cannot happen after merge. Post-merge review is valuable for catching integration issues, verifying merge correctness, and auditing merged code in production branches.

The core challenge is scoping. The existing review pipeline uses `git diff baseBranch...HEAD` against a worktree branch to discover changed files. After merge, the worktree branch no longer exists. The post-merge path must instead scope files from the set's merge commit by diffing `main~1..main` (or more precisely, by identifying the set's merge commit and diffing it against its first parent). This requires a new code path in `review.cjs` and the `review scope` CLI command.

Critically, the `--post-merge` flag must NOT mutate set status. Merged sets are in a terminal state (`merged`) and the post-merge review operates out-of-band -- it generates review artifacts without touching STATE.json transitions. The merge skill will be updated to suggest running post-merge review as an optional next action after successful merge.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `skills/review/SKILL.md` | Review skill -- add `--post-merge` flag parsing, skip status validation/transition for post-merge path, use merge-commit-based scoping | Existing (modify) |
| `skills/merge/SKILL.md` | Merge skill -- add post-merge review suggestion after successful merge in Step 6 | Existing (modify) |
| `src/lib/review.cjs` | Review library -- add `scopeSetPostMerge()` function that scopes from merge commit diff instead of worktree branch diff | Existing (modify) |
| `src/bin/rapid-tools.cjs` | CLI router -- update `review scope` to accept `--post-merge` flag, route to new scoping function | Existing (modify) |
| `src/bin/rapid-tools.test.cjs` | CLI tests -- add test cases for post-merge scope command | Existing (modify) |
| `src/lib/review.test.cjs` | Review library tests -- add tests for `scopeSetPostMerge()`, verify no status mutation | Existing (modify) |

## Integration Points

- **Exports:**
  - `post-merge-review-flag`: New `--post-merge` flag on `/rapid:review <set-id>`. When set, scopes against the merge commit diff rather than worktree branch diff. Does not require or modify set status.
  - `merge-review-suggestion`: After successful merge, the merge skill suggests running `/rapid:review <set-id> --post-merge` as an optional next action.

- **Imports:**
  - `canonical-status-literals` (from `state-consistency`): The review skill's precondition checks need to reference correct past-tense status values (`complete`, not `reviewing`). The post-merge path bypasses status checks entirely but the standard path still needs correct literals.

- **Side Effects:**
  - Post-merge review generates the same review artifacts (REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md, REVIEW-SUMMARY.md) but writes them to `.planning/waves/{setId}/` without state transitions.
  - No worktree is required for post-merge review -- all operations run against the main branch.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Merge commit identification: finding the correct merge commit for a set after multiple sets have merged | High | Use `git log --oneline --grep="merge(setName)"` to find the set's merge commit by commit message convention. RAPID merge commits follow `merge(set-name): ...` format. |
| Soft dependency on `state-consistency` set: review skill references status literals that may be incorrect | Medium | The post-merge path bypasses status validation entirely (no `complete` or `reviewing` check needed). Only the standard review path is affected. Can proceed in parallel with state-consistency. |
| Worktree path resolution: `review scope` currently resolves a worktree path from the registry. Post-merge sets have no worktree. | Medium | Post-merge path operates against `cwd` (project root on main branch) instead of a worktree path. The scope function accepts `cwd` directly. |
| Scope correctness for merge commits with conflicts: if T3/T4 resolution modified files, the merge commit diff may include resolution changes not in the original branch | Low | This is expected and desirable -- post-merge review should see the final merged state, including any resolution changes. Document this in the review output. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Library and CLI foundation -- add `scopeSetPostMerge()` to `review.cjs`, update `review scope` CLI command to accept `--post-merge` flag, write unit tests verifying no status mutation and correct merge-commit-based scoping.
- **Wave 2:** Skill integration -- update `skills/review/SKILL.md` with `--post-merge` flag parsing, conditional status bypass, and merge-commit scoping path. Update `skills/merge/SKILL.md` to suggest post-merge review after successful merge.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
