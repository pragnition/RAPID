---
description: Initialize a new RAPID project with conversational setup and prerequisite validation
allowed-tools: Read, Write, Bash, Glob
---

# /rapid:init -- Project Initialization

You are the RAPID project initializer. Follow these steps IN ORDER. Do not skip steps. Ask ONE question at a time during conversational setup.

## Step 1: Prerequisite Validation

Run the prerequisite checker:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs prereqs
```

Parse the JSON output. Display the results as a formatted table showing pass/fail/warn for each tool.

- If `hasBlockers` is true: STOP. Tell the user which required tools are missing or outdated and how to install/upgrade them. Do NOT continue.
- If `hasWarnings` is true: Note the warnings but continue. Tell the user which optional tools are missing.
- If all pass: Confirm all prerequisites met and continue.

## Step 2: Git Repository Check

Run the git repository check:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs prereqs --git-check
```

Parse the JSON output.

- If `isRepo` is false: Ask the user "This directory is not a git repository. Would you like me to run `git init` to initialize one?" Wait for confirmation before proceeding. If they decline, STOP.
- If `isRepo` is true: Continue silently.

## Step 3: Existing Project Detection

Run the existing project detector:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs init detect
```

Parse the JSON output (`exists` boolean, `files` string array).

- If `exists` is true: Show the existing `files`, then present exactly 3 options:
  1. **Reinitialize** -- Back up `.planning/` to `.planning.backup.{timestamp}/` and create fresh
  2. **Upgrade** -- Add any missing files to existing `.planning/`, keep existing content
  3. **Cancel** -- Stop initialization
  NEVER proceed without the user's explicit choice.
- If `exists` is false: Continue to Step 4.

## Step 4: Conversational Setup

Ask ONE question at a time. Wait for the user's answer before asking the next question.

**Question A:** "What is the project name?" (Suggest the current directory name as default)

**Question B:** "Give a one-sentence description of the project."

**Question C:** "How many developers will work in parallel?" (This helps RAPID configure worktree recommendations)

## Step 5: Scaffold .planning/ Directory

Run the scaffold command with the answers from Step 4:

**Fresh** (default):
```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs init scaffold --name "{project name}" --desc "{description}" --team-size {N}
```

**Reinitialize** (Option 1 from Step 3):
```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs init scaffold --name "{project name}" --desc "{description}" --team-size {N} --mode reinitialize
```

**Upgrade** (Option 2 from Step 3):
```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs init scaffold --name "{project name}" --desc "{description}" --team-size {N} --mode upgrade
```

**Cancel** (Option 3 from Step 3):
```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs init scaffold --mode cancel
```

Parse the JSON result: `created` lists files created, `skipped` lists preserved files, `backed_up_to` shows backup location (reinitialize), `cancelled` confirms no-op (cancel).

Do NOT create `.planning/phases/` -- phase directories are created on-demand during planning.

## Step 6: Confirmation

Using the JSON output from Step 5, display a summary:
- List files from the `created` array
- For reinitialize: note backup location from `backed_up_to`
- For upgrade: list `created` and `skipped` separately
- For cancel: confirm no changes and stop
- Show the project name and description
- Suggest running `/rapid:help` to see available commands and workflow guidance
