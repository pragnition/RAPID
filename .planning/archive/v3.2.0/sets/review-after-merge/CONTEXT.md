# CONTEXT: review-after-merge

**Set:** review-after-merge
**Generated:** 2026-03-14
**Mode:** interactive

<domain>
## Set Boundary
Add a `--post-merge` flag to the `/rapid:review` skill that enables code review of sets that have already been merged into main. The post-merge review scopes changed files from the set's merge commit diff rather than a worktree branch diff. It does NOT mutate set status (merged is terminal). The merge skill will suggest running post-merge review after successful merge.
</domain>

<decisions>
## Implementation Decisions

### Merge Commit Identification
- Use `git log --grep='merge(set-name)'` to find the merge commit at review time
- Take the most recent match to handle re-merge scenarios gracefully
- Validate the found commit is a merge commit (2 parents) as a safety check
- No changes to STATE.json schema or merge skill's state tracking needed

### Review Artifact Output Location
- Write post-merge review artifacts to `.planning/post-merge/{setId}/` directory
- Use standard artifact names (REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md, REVIEW-SUMMARY.md)
- Clean separation from pre-merge artifacts in `.planning/waves/{setId}/`
- No risk of overwriting or conflicting with existing review artifacts

### Claude's Discretion
- **Post-merge scoping implementation:** Claude will design the cleanest approach for the scoping function and CLI integration. Likely a new `scopeSetPostMerge()` function in review.cjs with `--post-merge` flag on the existing `review scope` CLI command. Will determine whether to include one-hop dependents based on what makes sense for merge-commit diffs.

### Available Review Stages
- All 3 stages (unit test, bug hunt, UAT) are available for post-merge review
- Default selection should favor bug hunt (most natural fit for already-merged code)
- Bugfix agent can commit fixes directly to main during post-merge review (same as standard review behavior)
- Stage selection UI is the same as standard review -- user picks which stages to run
</decisions>

<specifics>
## Specific Ideas
- Merge commit convention: `merge(set-name): ...` format used by RAPID merge skill
- Post-merge review operates on `cwd` (project root on main branch) instead of worktree path
- The `--post-merge` flag bypasses status validation entirely -- no `complete` or `reviewing` check needed
- No state transitions occur during post-merge review (merged is terminal)
</specifics>

<code_context>
## Existing Code Insights
- `review.cjs` exports `scopeSetForReview(cwd, worktreePath, baseBranch)` which calls `execute.getChangedFiles(worktreePath, baseBranch)`
- `rapid-tools.cjs` `review scope` command resolves worktree path from registry, defaults baseBranch to 'main'
- `findDependents(cwd, changedFiles)` provides one-hop dependent discovery via import/require pattern matching
- `chunkByDirectory(files)` applies 15-file threshold for parallel review chunking
- Review SKILL.md validates set status must be `complete` or `reviewing` before proceeding
- Merge SKILL.md has a Step 6 for next-step suggestions after successful merge
- Review artifacts currently go to `.planning/waves/{setId}/` directory
</code_context>

<deferred>
## Deferred Ideas
- Future: post-merge review for individual commits (not set-scoped)
- Future: automated post-merge review triggered by CI/CD hooks
- Future: comparison between pre-merge and post-merge review results
</deferred>
