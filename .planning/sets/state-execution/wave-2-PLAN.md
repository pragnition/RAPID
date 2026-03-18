# PLAN: state-execution / Wave 2

## Objective

Address two remaining deliverables: (1) prevent merge failures caused by untracked planning artifacts on main by adding a pre-merge cleanup step to `mergeSet()`, and (2) create the new `/rapid:bug-fix` skill that lets users describe a bug and have the model investigate and fix it using the executor agent.

## Tasks

### Task 1: Add pre-merge cleanup of untracked `.planning/` files in `mergeSet()`

**Files:**
- `src/lib/merge.cjs`

**Action:**
In `src/lib/merge.cjs`, inside the `mergeSet()` function (starts at line 1578), insert a pre-merge cleanup step AFTER the `git checkout` (line 1592-1599) and BEFORE the `git merge --no-ff` (line 1607). The cleanup step should:

1. After the successful checkout of `baseBranch` (after line 1599), detect untracked files under `.planning/`:
   ```js
   // Pre-merge cleanup: commit untracked planning artifacts on main
   const untrackedResult = worktree.gitExec(
     ['ls-files', '--others', '--exclude-standard', '.planning/'],
     projectRoot
   );
   if (untrackedResult.ok && untrackedResult.stdout.trim()) {
     // Stage all untracked planning artifacts
     worktree.gitExec(['add', '.planning/'], projectRoot);
     // Commit them so merge --no-ff does not fail
     worktree.gitExec(
       ['commit', '-m', `chore: stage untracked planning artifacts before merge`],
       projectRoot
     );
   }
   ```

2. This must run only in the non-solo path (the solo early-return at line 1582-1590 already exits before this code). No additional guard needed.

3. If the `git add` or `git commit` fails (e.g., nothing to commit), that is harmless -- `gitExec` returns `{ ok: false }` and execution continues to the merge step.

Do NOT use `git add -A` or `git add .`. The scope is strictly `.planning/` directory. This handles ALL untracked `.planning/` files (not just the current set's), as decided in CONTEXT.md.

**What NOT to do:**
- Do not add a new function -- this is inline in `mergeSet()`.
- Do not modify the solo-set early return path.
- Do not change the merge command itself.
- Do not use `execSync` directly -- use the existing `worktree.gitExec()` helper for consistency.

**Verification:**
```bash
node -e "
const src = require('fs').readFileSync('src/lib/merge.cjs', 'utf-8');
const hasLsFiles = src.includes('ls-files') && src.includes('--others') && src.includes('.planning/');
const hasAddPlanning = src.includes(\"['add', '.planning/']\") || src.includes(\"['add', '.planning/']\");
console.log('ls-files check:', hasLsFiles);
console.log('add .planning/ check:', hasAddPlanning);
if (!hasLsFiles || !hasAddPlanning) process.exit(1);
console.log('PASS');
"
```

**Done when:** `mergeSet()` detects and commits untracked `.planning/` files before running `git merge --no-ff`, and verification prints `PASS`.

---

### Task 2: Document pre-merge cleanup in merge SKILL.md

**Files:**
- `skills/merge/SKILL.md`

**Action:**
In `skills/merge/SKILL.md`, add documentation about the pre-merge cleanup behavior. Insert a new bullet point in the "Important Notes" section at the end of the file (before the closing of the document). Add after the last existing bullet:

```markdown
- **Pre-merge artifact cleanup.** Before running `git merge --no-ff`, the `mergeSet()` function automatically detects and commits any untracked files under `.planning/` on the base branch. This prevents merge failures caused by stale planning artifacts (WAVE-COMPLETE.md, PLAN-DIGEST.md, etc.) that were created during execution and landed on main as untracked files. The cleanup scopes to `.planning/` only and handles artifacts from ALL sets, not just the merging set.
```

Do NOT modify any step instructions or merge flow logic. This is documentation only.

**Verification:**
```bash
grep -c 'Pre-merge artifact cleanup' skills/merge/SKILL.md
```

Should output `1`.

**Done when:** The merge skill documents the pre-merge cleanup behavior in Important Notes.

---

### Task 3: Create the `/rapid:bug-fix` skill

**Files:**
- `skills/bug-fix/SKILL.md` (NEW)

**Action:**
Create `skills/bug-fix/SKILL.md` following the established skill pattern (see `skills/quick/SKILL.md` for reference). The skill definition should be:

```markdown
---
description: Investigate and fix bugs -- user describes a bug, model investigates and applies a fix
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

# /rapid:bug-fix -- Bug Investigation and Fix

You are the RAPID bug-fix skill. The user describes a bug they are facing, you investigate the codebase to find the root cause, and apply a fix using the executor agent. This is a general-purpose debugging tool that works from any branch or directory -- no set association required.

Follow these steps IN ORDER. Do not skip steps.

## Step 0: Environment Setup + Banner

Load environment variables before any CLI calls:

\```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
\```

Use this environment preamble in ALL subsequent Bash commands within this skill.

Display a banner:

\```
--- RAPID Bug Fix ---
Investigating and fixing bugs in the current working tree.
---------------------
\```

## Step 1: Gather Bug Description

If the user provided a bug description inline with the command (e.g., `/rapid:bug-fix the merge command fails when .planning/ has untracked files`), use that description directly.

Otherwise, use AskUserQuestion (freeform):

> "Describe the bug you are experiencing. Include any error messages, reproduction steps, or symptoms."

Record the user's bug description verbatim. This is the primary input.

## Step 2: Investigate the Codebase

Using the bug description, investigate the codebase to find the root cause:

1. **Search for relevant code:** Use Grep and Glob to find files related to the bug description. Search for error messages, function names, module names mentioned in the description.

2. **Read relevant files:** Read the files that are most likely to contain the bug. Focus on:
   - Files mentioned in error messages or stack traces
   - Entry points for the failing functionality
   - Recently modified files (use `git log --oneline -10` to check recent changes)

3. **Trace the execution path:** Follow the code path from the entry point to understand where the failure occurs.

4. **Identify the root cause:** Determine exactly what is wrong -- is it a missing check, incorrect logic, wrong type, missing import, etc.

## Step 3: Present Findings

Present the investigation results to the user:

\```
--- Bug Investigation Results ---
Root Cause: {brief description of what is wrong}
File(s): {list of files involved}
Analysis: {explanation of why the bug occurs}

Proposed Fix: {description of the fix to apply}
---------------------------------
\```

Use AskUserQuestion:
- **question:** "Apply the proposed fix?"
- **options:**
  - "Apply fix" -- description: "Dispatch executor agent to apply the fix and commit"
  - "Investigate further" -- description: "Continue investigating with additional context"
  - "Cancel" -- description: "Exit without making changes"

If "Cancel": Display "Bug fix cancelled." and exit.

If "Investigate further": Return to Step 2 with the user's additional context. Repeat investigation with broader or different search terms.

If "Apply fix": Continue to Step 4.

## Step 4: Dispatch Executor Agent

Build a plan for the fix. The plan should be a concise description of exactly what needs to change, in which files, and how to verify the fix.

Spawn the **rapid-executor** agent with this task:

\```
Fix a bug in the codebase.

## Your PLAN
### Task 1: {fix description}

**Files:**
- {file1}
- {file2}

**Action:**
{detailed description of what to change}

**Verification:**
{command to verify the fix works}

**Done when:** {success criteria}

## Commit Convention
After applying the fix, commit with: fix(bug-fix): {brief description}

## Working Directory
{current working directory}
\```

Parse RAPID:RETURN from the executor's output.

**If COMPLETE:**
Continue to Step 5.

**If BLOCKED:**
Display the blocker details:
\```
Bug fix blocked.
Blocker: {blocker description}
\```
Exit.

**If CHECKPOINT:**
Display checkpoint details:
\```
Bug fix paused at checkpoint.
Done: {what was completed}
Remaining: {what remains}
\```
Exit.

## Step 5: Display Results

Display the fix results:

\```
--- RAPID Bug Fix Complete ---
Bug: {brief description from Step 1}
Root Cause: {from Step 3}
Fix Applied: {description of the fix}
Commits: {commit hashes from executor return}
Files Modified: {file list from executor return}
-------------------------------
\```

Exit. Do NOT prompt for further action.

## Important Notes

- **No set association required.** This skill works from any branch in any directory. It does not read or modify set state.
- **No review pipeline connection.** This skill does NOT read REVIEW-UNIT.md, REVIEW-BUGS.md, or any review artifacts. It is a standalone bug investigation tool.
- **Commits to current branch.** Fixes are committed directly to whatever branch is currently checked out.
- **Uses the executor agent.** The rapid-executor agent handles the actual code changes and commits, ensuring atomic commits and verification.
- **General-purpose.** Works for any kind of bug -- runtime errors, incorrect behavior, test failures, build issues, etc.
```

Note: The backslash-escaped triple backticks above (`\`\`\``) should be written as actual triple backticks in the file. They are escaped here only because this plan is inside a markdown document.

**What NOT to do:**
- Do not connect this to the review pipeline (no reading REVIEW-ISSUES.json, no `readReviewArtifacts()`)
- Do not require a set name or set state
- Do not use the `rapid-bugfix` agent -- use `rapid-executor` instead
- Do not create a branch -- commit directly to current branch

**Verification:**
```bash
test -f skills/bug-fix/SKILL.md && echo "PASS: skill file exists" || echo "FAIL: skill file missing"
grep -c 'rapid-executor' skills/bug-fix/SKILL.md
```

Should output `PASS: skill file exists` and a count >= 1.

**Done when:** `skills/bug-fix/SKILL.md` exists, follows the standard skill pattern (frontmatter, step-by-step flow, env setup), dispatches the executor agent, and has no connection to the review pipeline.

---

## Success Criteria

1. `mergeSet()` in `src/lib/merge.cjs` detects untracked `.planning/` files and commits them before running `git merge --no-ff`
2. The merge skill documents the pre-merge cleanup in its Important Notes
3. `skills/bug-fix/SKILL.md` exists and follows the standard skill pattern
4. The bug-fix skill dispatches `rapid-executor` (not `rapid-bugfix`)
5. The bug-fix skill has no connection to the review pipeline or set state
6. `node --test src/lib/state-transitions.test.cjs` still passes (no regression from Wave 1)
