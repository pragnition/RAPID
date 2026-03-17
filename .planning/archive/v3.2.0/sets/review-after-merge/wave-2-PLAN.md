# PLAN: review-after-merge / Wave 2

**Objective:** Update the review and merge skill markdown files to integrate post-merge review as a user-facing feature. The review SKILL.md gets a `--post-merge` conditional path that bypasses status validation, uses merge-commit scoping, and writes artifacts to the post-merge directory. The merge SKILL.md gets a post-merge review suggestion after successful merge.

**Depends on:** Wave 1 (library functions and CLI commands must exist before the skill files reference them).

---

## Task 1: Update review SKILL.md with `--post-merge` conditional path

**File:** `skills/review/SKILL.md` (Modify)

**What to implement:**

Add conditional branches at specific steps to handle the `--post-merge` flag. The post-merge path differs from the standard path in these ways:
- No status validation (merged is terminal, no `complete` or `reviewing` check)
- No status transition (no `reviewing` state change)
- Scoping via merge-commit diff instead of worktree branch diff
- Artifacts written to `.planning/post-merge/{setId}/` instead of `.planning/waves/{setId}/`
- Working directory is `cwd` (project root on main branch), not a worktree path
- No wave attribution (job plans are irrelevant after merge)

Here are the specific modifications by step:

### Step 0b: Parse arguments

After the existing argument parsing section, add detection of `--post-merge`:

```markdown
#### Detect `--post-merge` flag

Check if the user invoked with `--post-merge` flag: `/rapid:review <set-id> --post-merge`

If `--post-merge` is present, set `POST_MERGE=true`. The post-merge review path bypasses status validation and state transitions entirely. All review operations run against the project root (`cwd`) on the main branch, not a worktree.
```

### Step 0c: Validate set status

Add a conditional skip at the top of step 0c:

```markdown
**If `POST_MERGE=true`:** Skip this step entirely. Post-merge review does not require any specific set status -- it operates on already-merged sets. Proceed directly to Step 1.
```

### Step 0d: Transition set to 'reviewing'

Add a conditional skip at the top of step 0d:

```markdown
**If `POST_MERGE=true`:** Skip this step entirely. Post-merge review does NOT transition set status. The `merged` status is terminal and must not be modified.
```

### Step 2: Scope Set Files

Add a conditional branch for scoping:

```markdown
**If `POST_MERGE=true`:**

Scope changed files from the set's merge commit:

\```bash
SCOPE_RESULT=$(node "${RAPID_TOOLS}" review scope <set-id> --post-merge)
\```

Parse the JSON output: `{ changedFiles, dependentFiles, totalFiles, chunks, postMerge }`.

- `changedFiles` -- files changed in the set's merge commit (from merge commit diff)
- `dependentFiles` -- files that import changed files (one-hop dependents)
- `totalFiles` -- total count
- `chunks` -- directory groups (same chunking logic)
- `postMerge` -- boolean `true` confirming post-merge mode

Note: No `waveAttribution` is available in post-merge mode. Wave attribution tags in subsequent stages will be set to `"unattributed"`.

Set the working directory for all subagents to `cwd` (the project root on main branch). Do NOT attempt to resolve a worktree path.
```

The standard path (when `POST_MERGE` is not set) remains unchanged.

### Step 2.5: Concern-Based Scoping

Add a note at the top:

```markdown
**If `POST_MERGE=true`:** The working directory for the scoper agent is `cwd` (project root), not a worktree path. All other scoper behavior is identical.
```

### Step 3: Load Acceptance Criteria

Add a note:

```markdown
**If `POST_MERGE=true`:** Acceptance criteria loading uses the same approach (reading JOB-PLAN.md files from `.planning/waves/{setId}/`). These files still exist after merge -- they are planning artifacts, not code artifacts.
```

### Step 4a.5: Write REVIEW-UNIT.md

Add conditional artifact path:

```markdown
**If `POST_MERGE=true`:** Write to `.planning/post-merge/{setId}/REVIEW-UNIT.md` instead of `.planning/waves/{setId}/REVIEW-UNIT.md`.
```

### Step 4a.6: Log test failures as issues

Add conditional:

```markdown
**If `POST_MERGE=true`:** Use `--post-merge` flag when logging issues:
\```bash
echo '{...issue JSON...}' | node "${RAPID_TOOLS}" review log-issue <set-id> --post-merge
\```
This writes issues to `.planning/post-merge/{setId}/REVIEW-ISSUES.json`.
```

### Step 4b.7: Write REVIEW-BUGS.md

Add conditional artifact path:

```markdown
**If `POST_MERGE=true`:** Write to `.planning/post-merge/{setId}/REVIEW-BUGS.md` instead of `.planning/waves/{setId}/REVIEW-BUGS.md`.
```

### Step 4b.8: Log accepted bugs and bugfix agent

Add two conditionals:

For issue logging:
```markdown
**If `POST_MERGE=true`:** Use `--post-merge` flag when logging issues (same as Step 4a.6).
```

For the bugfix agent working directory:
```markdown
**If `POST_MERGE=true`:** The bugfix agent operates on `cwd` (main branch) and commits fixes directly to main. The commit message format is: `fix({setId}): {description} (post-merge review)`.
```

### Step 4c.6: Write REVIEW-UAT.md

Add conditional artifact path:

```markdown
**If `POST_MERGE=true`:** Write to `.planning/post-merge/{setId}/REVIEW-UAT.md` instead of `.planning/waves/{setId}/REVIEW-UAT.md`.
```

### Step 4c.7: Log failed UAT steps

Add conditional:

```markdown
**If `POST_MERGE=true`:** Use `--post-merge` flag when logging issues (same as Step 4a.6).
```

### Step 5: Generate Review Summary

Add conditional:

```markdown
**If `POST_MERGE=true`:**

\```bash
node "${RAPID_TOOLS}" review summary <set-id> --post-merge
\```

This writes `REVIEW-SUMMARY.md` to `.planning/post-merge/{setId}/REVIEW-SUMMARY.md`.

Update the completion banner artifact paths to use the post-merge directory:
\```
Review artifacts:
  .planning/post-merge/{setId}/REVIEW-SUMMARY.md
  .planning/post-merge/{setId}/REVIEW-UNIT.md
  .planning/post-merge/{setId}/REVIEW-BUGS.md
  .planning/post-merge/{setId}/REVIEW-UAT.md
\```
```

### Step 6: Next Steps

Add conditional:

```markdown
**If `POST_MERGE=true`:**

> **Next steps:**
> - `/rapid:review {setIndex} --post-merge` -- *Re-run post-merge review on this set*
> - `/rapid:status` -- *View project state*

Do not suggest `/rapid:merge` since the set is already merged.
```

### Important Notes section

Add a new bullet at the end:

```markdown
- **Post-merge review (`--post-merge`):** When invoked with `--post-merge`, the review pipeline operates on an already-merged set. It scopes files from the set's merge commit diff (not a worktree branch diff), skips all status validation and transitions, writes artifacts to `.planning/post-merge/{setId}/` instead of `.planning/waves/{setId}/`, and uses `cwd` (project root on main) as the working directory. The bugfix agent commits fixes directly to main. This is useful for catching integration issues after merge and auditing merged code.
```

**What NOT to do:**
- Do NOT remove or modify any existing standard-path behavior -- all changes are additive conditionals.
- Do NOT add any `state transition` calls in the post-merge path.
- Do NOT reference worktree paths in the post-merge path.

**Verification:**
```bash
# Verify the file is valid markdown and contains the expected sections
grep -c "POST_MERGE" skills/review/SKILL.md
# Should be >= 12 occurrences (one per conditional branch)
grep -c "post-merge" skills/review/SKILL.md
# Should be >= 15 occurrences
```

---

## Task 2: Update merge SKILL.md with post-merge review suggestion

**File:** `skills/merge/SKILL.md` (Modify)

**What to implement:**

Modify Step 8 ("Pipeline Complete") to include a post-merge review suggestion in the "Next steps" section.

Find the existing next steps block (around line 590):

```markdown
> **Next steps:**
> - `/rapid:cleanup` -- *Remove completed worktrees*
> - `/rapid:status` -- *View project state*
> - `/rapid:new-version` -- *Start planning next version (if all sets merged)*
```

Replace it with:

```markdown
> **Next steps:**
> - `/rapid:review {setIndex} --post-merge` -- *Run post-merge review on merged sets (recommended)*
> - `/rapid:cleanup` -- *Remove completed worktrees*
> - `/rapid:status` -- *View project state*
> - `/rapid:new-version` -- *Start planning next version (if all sets merged)*
```

Where `{setIndex}` references the most recently merged set's index (or "N" as a placeholder if multiple sets were merged -- the user picks which one).

Also, add a note to the Important Notes section at the bottom:

```markdown
- **Post-merge review suggestion:** After successful merge, the pipeline suggests running `/rapid:review <set> --post-merge` for post-merge review. This is optional but recommended to catch integration issues and verify merge correctness. Post-merge review scopes files from the merge commit diff and does not require a worktree.
```

Additionally, after each individual set merge in **Step 6** (the success case where `merged: true`), add a per-set suggestion line. After the existing success message:

```markdown
> [{waveNum}/{totalWaves}] {setName}: MERGED and status updated to 'merged' (commit {commitHash})
```

Add:

```markdown
> Tip: Run `/rapid:review {setIndex} --post-merge` to review this set's merged code.
```

**What NOT to do:**
- Do NOT remove any existing next step suggestions.
- Do NOT modify the merge pipeline logic -- only add informational text.

**Verification:**
```bash
grep -c "post-merge" skills/merge/SKILL.md
# Should be >= 3 occurrences (Step 6 tip, Step 8 next steps, Important Notes)
```

---

## Success Criteria

1. `skills/review/SKILL.md` contains conditional `POST_MERGE` branches at Steps 0b, 0c, 0d, 2, 4a.5, 4a.6, 4b.7, 4b.8, 4c.6, 4c.7, 5, and 6.
2. The post-merge path in `review/SKILL.md` never references `state transition` or worktree paths.
3. The post-merge path writes all artifacts to `.planning/post-merge/{setId}/`.
4. `skills/merge/SKILL.md` Step 8 includes `/rapid:review --post-merge` in next steps.
5. `skills/merge/SKILL.md` Step 6 includes per-set post-merge review tip.
6. No existing behavior is changed in either SKILL.md -- all modifications are additive.

## File Ownership

| File | Action |
|------|--------|
| `skills/review/SKILL.md` | Modify |
| `skills/merge/SKILL.md` | Modify |
