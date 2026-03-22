---
description: Initialize a set for development -- creates isolated worktree (or solo mode without worktree) and generates scoped CLAUDE.md
allowed-tools: Bash(rapid-tools:*), Read, AskUserQuestion, Agent
---

# /rapid:start-set -- Set Initialization

You are the RAPID set initializer. This skill claims a set for development by creating a git worktree, generating a scoped CLAUDE.md, and running a lightweight set planner to produce SET-OVERVIEW.md.

Follow these steps IN ORDER. Do not skip steps. Use AskUserQuestion at every decision point.

## Environment Setup

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

## Display Stage Banner

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner start-set
```

---

## Step 1: Determine Set to Initialize

Check if the user provided a set name as an argument (e.g., `/start-set auth-system` or `/start-set 1`).

### Resolve Set Reference

If the user provided a set argument, resolve it through the numeric ID resolver before any other operations:

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
SET_NAME=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
```

Use `SET_NAME` for all subsequent operations. The numeric input has been resolved to a string ID. For example, `/start-set 1` resolves to the first set alphabetically.

**If set name was provided:** Resolve it (above), then use the resolved `SET_NAME`. Skip to Step 2.

### Check for --solo Flag

Parse the user's invocation for a `--solo` flag (e.g., `/rapid:start-set 6 --solo`).

If `--solo` is present, set `SOLO_MODE=true`. Solo mode skips worktree creation, branch creation, and scoped CLAUDE.md generation. Work happens directly on the current branch.

### Check project config for solo mode

If `--solo` was NOT explicitly passed by the user, check the project config for a solo mode setting:

1. Read `.planning/config.json` using the Read tool
2. Parse the JSON and check for `solo: true`
3. If `solo: true` in config, set `SOLO_MODE=true` (same effect as `--solo` flag)
4. Log: "Solo mode enabled from project config (.planning/config.json)"

The `--solo` flag is the explicit override. If config says `solo: true` and the user did NOT pass `--solo`, the skill still enters solo mode from the config. If `.planning/config.json` does not exist or cannot be parsed, proceed without solo mode (graceful fallback).

**If no set name was provided:** List available (pending) sets:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" set-init list-available
```

Parse the JSON output:

- **If `available` array is empty:** Inform the user: "All sets have been initialized or are in progress. Use /rapid:status to see current set states." Then STOP.
- **If pending sets exist:** Present them using AskUserQuestion:

```
Use AskUserQuestion to ask "Which set would you like to initialize?" with one option per pending set:
- Option name: the set ID (e.g., "auth-system")
- Option description: "Milestone: {milestone}, Status: pending"
```

Record the selected set name for the remaining steps.

---

## Step 2: Validate Set Eligibility

Before creating the worktree, validate:

1. **Check set status in STATE.json** -- the set must have status 'pending'. If not pending, inform the user and STOP.

2. **Check if worktree already exists** -- look up the set in the available list output. If it was not in the list, it already has a worktree.

**If SOLO_MODE is true:** Skip the branch existence check entirely (solo mode does not create a branch). Skip to Step 3.

3. **Check if branch already exists** -- run:

```bash
# (env preamble here)
git branch --list "rapid/{set-name}"
```

If the branch exists, use AskUserQuestion:

```
"Branch rapid/{set-name} already exists. What would you like to do?"
Options:
- "Use existing branch" -- proceed with existing branch (may need manual worktree creation)
- "Delete and recreate" -- delete the branch and create fresh
- "Cancel" -- abort set initialization
```

If "Delete and recreate" is selected:
```bash
# (env preamble here)
git branch -D "rapid/{set-name}"
```

If "Cancel" is selected, STOP.

---

## Step 3: Create Worktree and Scoped CLAUDE.md

**If SOLO_MODE is true:**

Display progress: "Initializing set in solo mode: {set-name}..."

Run the solo set-init command:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" set-init create {set-name} --solo
```

Parse the JSON output:
- On success (`created: true`, `solo: true`): Display:
  - "Solo set initialized on branch {branch} at commit {startCommit}"
  - "No worktree or branch created -- working directly on {branch}"
- On error: Display error and suggest fixes. Then STOP.

Skip to Step 4.

**If SOLO_MODE is false:**

Display progress: "Creating worktree for set: {set-name}..."

Run the set-init create command:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" set-init create {set-name}
```

Parse the JSON output:
- **On success** (`created: true`): Display:
  - "Worktree created at {worktreePath} on branch {branch}"
  - "Scoped CLAUDE.md generated with contracts, style guide, and deny list" (if claudeMdGenerated is true)
  - If claudeMdGenerated is false: "Warning: Scoped CLAUDE.md could not be generated (missing CONTRACT.json or DEFINITION.md). You may need to generate it manually with: `rapid-tools worktree generate-claude-md {set-name}`"

- **On error** (`created: false`): Display the error message and suggest fixes:
  - If "already exists": "The branch or worktree already exists. Run /rapid:start-set again and choose 'Delete and recreate' option."
  - If other error: "Failed to create worktree: {error}. Check git status and try again."
  Then STOP.

---

## Step 4: Run Set Planner Agent

Display progress: "Generating SET-OVERVIEW.md..."

Spawn the **rapid-set-planner** agent with this task:

```
Generate SET-OVERVIEW.md for set '{set-name}'.

## Context Files to Read
- .planning/sets/{set-name}/CONTRACT.json
- .planning/sets/{set-name}/DEFINITION.md
- .planning/sets/OWNERSHIP.json (if exists)

## Working Directory
{worktreePath}

## Output
Write SET-OVERVIEW.md to .planning/sets/{set-name}/SET-OVERVIEW.md
```

After the agent completes:
- Read the generated SET-OVERVIEW.md
- Display a brief summary of the overview (Approach section, first paragraph)
- If the agent failed, warn the user but do not fail the entire init -- the overview can be written manually

---

## Step 5: Next Step

Display:

> **Next step:** `/rapid:discuss-set {setIndex}`
> *(Discuss set {setId})*

Where `{setIndex}` is the numeric index of the set just initialized (obtained from the resolve step earlier in this skill).

Display the suggestion and stop. The user will invoke discuss-set when ready.

---

## Step 6: Progress Breadcrumb

After the next-step suggestion, render the progress breadcrumb:

```
init [done] > start-set [done] > discuss-set > plan-set > execute-set > review > merge
```

"init" and "start-set" are marked as done. All others are pending (no marker).

---

## Error Handling

- If RAPID_TOOLS is not set: Show error and suggest running `/rapid:install`
- If STATE.json is missing: Show error and suggest running `/rapid:init` first
- If git is not available: Show error and suggest installing git
- All errors should be descriptive with clear next steps for the user

**Error breadcrumb:** On any error, show the breadcrumb with the failure point:

```
init [done] > start-set [FAILED] > discuss-set > plan-set > execute-set > review > merge
Error: {error message}
Next: Fix the issue and re-run /rapid:start-set {setIndex}
```

Show what is done, what failed, and what to run next.
