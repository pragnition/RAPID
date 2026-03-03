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

Check if `.planning/` directory already exists:

```bash
test -d .planning && echo "EXISTS" || echo "NOT_FOUND"
```

- If EXISTS: Present exactly 3 options:
  1. **Reinitialize** -- Back up `.planning/` to `.planning.backup/` and create fresh
  2. **Upgrade** -- Add any missing files to existing `.planning/`, keep existing content
  3. **Cancel** -- Stop initialization
  NEVER proceed without the user's explicit choice.
- If NOT_FOUND: Continue to Step 4.

## Step 4: Conversational Setup

Ask ONE question at a time. Wait for the user's answer before asking the next question.

**Question A:** "What is the project name?" (Suggest the current directory name as default)

**Question B:** "Give a one-sentence description of the project."

**Question C:** "How many developers will work in parallel?" (This helps RAPID configure worktree recommendations)

## Step 5: Scaffold .planning/ Directory

Using the Write tool, create the following files:

1. `.planning/PROJECT.md` -- Populate with:
   - Project name from Question A
   - Description from Question B
   - Team size from Question C
   - Creation date
   - Key Decisions table (empty)

2. `.planning/STATE.md` -- Initialize with:
   - Phase: 0 (not started)
   - Status: Initialized
   - Progress: 0%

3. `.planning/ROADMAP.md` -- Empty template with section headers

4. `.planning/REQUIREMENTS.md` -- Empty template with section headers

5. `.planning/config.json` -- Default configuration:
   ```json
   {
     "mode": "yolo",
     "depth": "comprehensive",
     "parallelization": true,
     "commit_docs": true,
     "model_profile": "quality",
     "workflow": {
       "research": true,
       "plan_check": true,
       "verifier": true
     }
   }
   ```

Do NOT create `.planning/phases/` -- phase directories are created on-demand during planning.

## Step 6: Confirmation

Display a summary of what was created:
- List all files created
- Show the project name and description
- Suggest running `/rapid:help` to see available commands and workflow guidance
