---
name: set-init
description: Initialize a set for development -- creates isolated worktree, generates scoped CLAUDE.md, and runs set planner
allowed-tools: Bash(rapid-tools:*), Read, AskUserQuestion, Agent
---

# /rapid:set-init -- Set Initialization

You are the RAPID set initializer. This skill claims a set for development by creating a git worktree, generating a scoped CLAUDE.md, and running a lightweight set planner to produce SET-OVERVIEW.md.

Follow these steps IN ORDER. Do not skip steps. Use AskUserQuestion at every decision point.

## Environment Setup

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

---

## Step 1: Determine Set to Initialize

Check if the user provided a set name as an argument (e.g., `/set-init auth-system`).

**If set name was provided:** Use it directly. Skip to Step 2.

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
  - If "already exists": "The branch or worktree already exists. Run /rapid:set-init again and choose 'Delete and recreate' option."
  - If other error: "Failed to create worktree: {error}. Check git status and try again."
  Then STOP.

---

## Step 4: Run Set Planner Agent

Display progress: "Generating SET-OVERVIEW.md..."

Use the Agent tool to spawn a subagent with the `role-set-planner` role:

```
Agent tool call:
- Role: role-set-planner
- Task: "Generate SET-OVERVIEW.md for set '{set-name}'"
- Context to provide:
  - Read .planning/sets/{set-name}/CONTRACT.json
  - Read .planning/sets/{set-name}/DEFINITION.md
  - Read .planning/sets/OWNERSHIP.json (if exists)
- Output: Write SET-OVERVIEW.md to .planning/sets/{set-name}/SET-OVERVIEW.md
```

After the agent completes:
- Read the generated SET-OVERVIEW.md
- Display a brief summary of the overview (Approach section, first paragraph)
- If the agent failed, warn the user but do not fail the entire init -- the overview can be written manually

---

## Step 5: Present Next Steps

Use AskUserQuestion to present options:

```
"Set '{set-name}' is ready for development. Worktree at {worktreePath} on branch {branch}. What would you like to do next?"
Options:
- "Run /rapid:discuss to start wave planning" -- begin the discuss phase for this set
- "Run /rapid:status to see all sets" -- view the full project dashboard
- "Initialize another set" -- run /rapid:set-init again for a different set
```

Based on selection:
- "/rapid:discuss": Inform the user to run `/rapid:discuss {set-name}`
- "/rapid:status": Inform the user to run `/rapid:status`
- "Initialize another set": Inform the user to run `/rapid:set-init`

---

## Error Handling

- If RAPID_TOOLS is not set: Show error and suggest running `/rapid:install`
- If STATE.json is missing: Show error and suggest running `/rapid:init` first
- If git is not available: Show error and suggest installing git
- All errors should be descriptive with clear next steps for the user
