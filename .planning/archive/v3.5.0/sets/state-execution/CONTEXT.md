# CONTEXT: state-execution

**Set:** state-execution
**Generated:** 2026-03-18
**Mode:** interactive

<domain>
## Set Boundary
This set addresses three tightly coupled failures in the execute-review-merge pipeline:

1. **F5: State transition fix** — The `executed` status is a dead zone. Sets that finish execution but fail the `executed -> complete` transition are rejected by the review skill with no recovery path. Fix: relax review to accept `executed`, add `executed -> executed` self-loop for idempotent re-entry.

2. **F6: Merge untracked file handling** — Planning artifacts (WAVE-COMPLETE.md, PLAN-DIGEST.md) created during execution end up as untracked files on main, blocking `git merge --no-ff`. Fix: pre-merge cleanup step that handles stale untracked planning artifacts.

3. **F10: `/rapid:bug-fix` skill** — New user-facing skill for investigating and fixing bugs. The user describes a bug, the model investigates the codebase to find the source, and applies a fix using the executor agent.
</domain>

<decisions>
## Implementation Decisions

### Review Status Acceptance

- Silent acceptance: treat `executed` identically to `complete` in the review skill. No warning banner. The review itself is the verification step, so the distinction is irrelevant.
- The `executed -> executed` self-loop is unconditional. No progress checks required — wave-completion markers already track actual progress internally.

### Pre-merge Cleanup Strategy

- Auto-commit untracked `.planning/` files on main before attempting `git merge --no-ff`. These are legitimate artifacts from execution and belong in history.
- Scope: clean up ALL untracked files under `.planning/` (not just the merging set's directory). This prevents future merge failures from stale artifacts of any set.

### Bug-fix Interaction Model

- `/rapid:bug-fix` is a user-described bug investigation tool. The user describes the bug they're facing, the model investigates the codebase to find the root cause, and applies a patch.
- This is NOT connected to review pipeline artifacts. No reading of REVIEW-UNIT.md, REVIEW-BUGS.md, etc.
- Re-use the executor agent for applying fixes. The executor makes atomic commits per fix.
- Auto-commit after fixes are applied (the executor already handles this).

### Bug-fix Branch Context

- General-purpose: works from any branch/directory, no set association required. Investigates the bug in the current working tree.
- Commit directly to the current branch. No dedicated fix branch — fits the "quick fix" mental model.

### Claude's Discretion

- None — all areas discussed with user input.
</decisions>

<specifics>
## Specific Ideas
- The bug-fix skill should re-use the existing executor agent for applying patches
- The pre-merge cleanup should handle all untracked `.planning/` files, not just the current set, to be more robust
</specifics>

<code_context>
## Existing Code Insights

- `SET_TRANSITIONS` in `src/lib/state-transitions.cjs` currently has `executed: ['complete']` — needs `'executed'` added to the array
- Review skill at `skills/review/SKILL.md` line 122 explicitly rejects `executed` status — needs to accept it alongside `complete`
- `src/lib/review.cjs` already has `logIssue()`, `loadIssues()`, `updateIssueStatus()`, `logIssuePostMerge()`, `loadPostMergeIssues()` — these are for the review pipeline and NOT needed for the new bug-fix skill
- `skills/bug-fix/` directory does not exist yet — needs to be created
- Merge skill at `skills/merge/SKILL.md` has no pre-merge cleanup step currently
- The `rapid-bugfix` agent exists at `agents/rapid-bugfix.md` but is review-pipeline-specific; the new bug-fix skill should use the executor agent instead
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion
</deferred>
