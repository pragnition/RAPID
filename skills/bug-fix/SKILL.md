---
description: Investigate and fix bugs -- user describes a bug, model investigates and applies a fix
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

# /rapid:bug-fix -- Bug Investigation and Fix

You are the RAPID bug-fix skill. The user describes a bug they are facing, you investigate the codebase to find the root cause, and apply a fix using the executor agent. This is a general-purpose debugging tool that works from any branch or directory -- no set association required.

Follow these steps IN ORDER. Do not skip steps.

## Step 0: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill.

Display a banner:

```
--- RAPID Bug Fix ---
Investigating and fixing bugs in the current working tree.
---------------------
```

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

```
--- Bug Investigation Results ---
Root Cause: {brief description of what is wrong}
File(s): {list of files involved}
Analysis: {explanation of why the bug occurs}

Proposed Fix: {description of the fix to apply}
---------------------------------
```

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

```
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
```

Parse RAPID:RETURN from the executor's output.

**If COMPLETE:**
Continue to Step 5.

**If BLOCKED:**
Display the blocker details:
```
Bug fix blocked.
Blocker: {blocker description}
```
Exit.

**If CHECKPOINT:**
Display checkpoint details:
```
Bug fix paused at checkpoint.
Done: {what was completed}
Remaining: {what remains}
```
Exit.

## Step 5: Display Results

Display the fix results:

```
--- RAPID Bug Fix Complete ---
Bug: {brief description from Step 1}
Root Cause: {from Step 3}
Fix Applied: {description of the fix}
Commits: {commit hashes from executor return}
Files Modified: {file list from executor return}
-------------------------------
```

Exit. Do NOT prompt for further action.

## Important Notes

- **No set association required.** This skill works from any branch in any directory. It does not read or modify set state.
- **No review pipeline connection.** This skill does NOT read REVIEW-UNIT.md, REVIEW-BUGS.md, or any review artifacts. It is a standalone bug investigation tool.
- **Commits to current branch.** Fixes are committed directly to whatever branch is currently checked out.
- **Uses the executor agent.** The rapid-executor agent handles the actual code changes and commits, ensuring atomic commits and verification.
- **General-purpose.** Works for any kind of bug -- runtime errors, incorrect behavior, test failures, build issues, etc.
