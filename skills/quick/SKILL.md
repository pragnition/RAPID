---
description: Run a quick task on the current branch with automatic state tracking and commit
allowed-tools: Bash(rapid-tools:*), Read, Write, Edit, AskUserQuestion, Glob, Grep
---

# /rapid:quick -- Quick Task

You are the RAPID quick task executor. This skill handles ad-hoc tasks that developers want to complete without the full set/wave/job ceremony. Quick tasks work directly on the current branch, are tracked in project state, and auto-commit when done. There are no guardrails on task size -- trust the developer.

Follow these steps IN ORDER.

## Step 1: Load Environment

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

## Display Stage Banner

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner quick
```

---

## Step 2: Get Task Description

The user provides the task description as an argument to the command invocation, e.g.:

```
/rapid:quick Fix the login button alignment
```

Extract the task description from everything after `/rapid:quick `.

**If no description was provided** (the user just ran `/rapid:quick` with no arguments):

Use AskUserQuestion with freeform input:
- question: "What quick task would you like to complete?"

Store the description for use in subsequent steps.

---

## Step 3: Get Next Task ID

Retrieve the next available quick task ID:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
NEXT_ID=$(node "${RAPID_TOOLS}" quick next-id 2>&1)
echo "Next task ID: $NEXT_ID"
```

Parse the numeric ID from the output. This will be used for tracking and commit messages.

---

## Step 4: Execute the Task

This is the core of the skill. Actually perform the requested work:

1. Read the relevant parts of the codebase to understand the context
2. Understand the request and determine what changes are needed
3. Make the changes using all available tools (Read, Write, Edit, Bash, Glob, Grep)
4. Verify the changes work correctly

This step has no rigid structure -- adapt to whatever the task requires. The skill trusts the developer's judgment on task scope. Use as many or as few tools as the task demands.

**If the task fails partway through** (e.g., build error that cannot be resolved, missing dependency that cannot be installed, fundamental issue with the approach):

Do NOT auto-commit. Inform the user of the failure:

```
Quick task failed: {description of what went wrong}

No changes have been committed. You can:
- Fix the issue and retry with /rapid:quick
- Manually commit any partial changes you want to keep
```

Then STOP. End the skill.

---

## Step 5: Auto-Commit

After the task is complete and verified:

1. Stage all changed files:
   ```bash
   git add -A
   ```

2. Create a descriptive commit message based on what was actually done. The message should be concise but meaningful -- describe the change, not the process.

3. Commit:
   ```bash
   git commit -m "{descriptive message}"
   ```

4. Capture the commit hash:
   ```bash
   COMMIT_HASH=$(git rev-parse HEAD)
   echo "Commit: $COMMIT_HASH"
   ```

---

## Step 6: Track in State

Register the completed quick task in project state:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" quick add "{description}"
```

The quick add command records the task in STATE.json's quickTasks array with the task ID, description, date, commit hash, and directory slug.

If the CLI accepts additional flags for commit hash and directory:

```bash
node "${RAPID_TOOLS}" quick add "{description}" --commit "{COMMIT_HASH}" --dir "{quick-task-dir}"
```

Where `quick-task-dir` is a slugified version of the task description: first 50 characters, lowercased, spaces replaced with hyphens, non-alphanumeric characters removed.

If the CLI only accepts the description string, pass the full info as a structured description: `"{id}-{slug}: {description}"`.

---

## Step 7: Summary

Display the task completion summary:

```
--- Quick Task Complete ---
Task #{id}: {description}
Commit: {commit_hash}
Branch: {current_branch}
---------------------------
```

Then display the next step suggestion:

```
> **Next step:** `/rapid:status` to view project state
```

---

## Important Notes

- **Current branch only:** Quick tasks work on the CURRENT branch. No worktree isolation, no branch creation. This is by design for fast ad-hoc work.
- **No size guardrails:** The developer decides what constitutes a "quick" task. Could be a one-line fix or a multi-file refactor. Trust the developer.
- **Auto-commit is mandatory:** Every successfully completed quick task produces exactly one commit. This ensures all work is tracked and recoverable.
- **State tracking:** Tasks are tracked in STATE.json via the quickTasks array, providing a history of ad-hoc work alongside the formal set/wave/job structure.
- **Anytime execution:** Quick tasks can be run between sets, during sets, or anytime. They are independent of the formal RAPID lifecycle.
- **Failure handling:** If the task fails partway through, do NOT auto-commit. Inform the user and let them decide how to proceed. Partial work remains unstaged.
