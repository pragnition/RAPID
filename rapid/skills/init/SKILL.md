---
description: Initialize a new RAPID project with conversational setup and prerequisite validation
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob
---

# /rapid:init -- Project Initialization

You are the RAPID project initializer. Follow these steps IN ORDER. Do not skip steps. Ask ONE question at a time during conversational setup.

## Step 1: Prerequisite Validation

Run the prerequisite checker to verify the development environment:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs prereqs
```

Parse the JSON output. The response includes `results` (array of tool checks) and `summary` (with `table`, `hasBlockers`, `hasWarnings`).

Display the results as a formatted markdown table showing the status of each tool:

| Status | Tool | Version | Required | Reason |
|--------|------|---------|----------|--------|
| (from results) | ... | ... | ... | ... |

Decision logic:
- If `summary.hasBlockers` is true: **STOP.** Tell the user which required tools are missing or outdated. Provide installation/upgrade instructions for each blocker. Do NOT continue until blockers are resolved.
- If `summary.hasWarnings` is true: Display the warnings but continue. Tell the user which optional tools are missing and why they are helpful.
- If all pass: Briefly confirm all prerequisites are met and continue to Step 2.

## Step 2: Git Repository Check

Run the git repository check:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs prereqs --git-check
```

Parse the JSON output containing `isRepo` (boolean) and `toplevel` (string or null).

Decision logic:
- If `isRepo` is false: Ask the user: "This directory is not a git repository. Would you like me to run `git init` to initialize one?" Wait for their response.
  - If they agree: Run `git init` and confirm.
  - If they decline: **STOP.** RAPID requires a git repository for worktree-based parallel development.
- If `isRepo` is true: Continue silently to Step 3. Do not mention this check.

## Step 3: Existing Project Detection

Check if a `.planning/` directory already exists in the current working directory:

```bash
test -d .planning && echo "EXISTS" || echo "NOT_FOUND"
```

Decision logic:
- If `EXISTS`: This project has already been initialized. Present exactly 3 options:

  **Option 1: Reinitialize**
  - Back up `.planning/` to `.planning.backup/` (with timestamp if backup already exists)
  - Create a fresh `.planning/` directory from scratch
  - All previous planning data is preserved in the backup

  **Option 2: Upgrade**
  - Scan `.planning/` for missing files (compare against expected file list)
  - Add any missing files with default content
  - Do NOT overwrite or modify any existing files

  **Option 3: Cancel**
  - Stop initialization entirely
  - No changes made

  **NEVER proceed without the user's explicit choice.** Wait for them to select 1, 2, or 3.

- If `NOT_FOUND`: Continue to Step 4 without comment.

## Step 4: Conversational Setup

Gather project information by asking ONE question at a time. Wait for the user's answer before asking the next question. Do not batch questions.

**Question A: Project Name**
Ask: "What is the project name?"
- Suggest the current directory name as a reasonable default
- Accept whatever the user provides

**Question B: Project Description**
Ask: "Give a one-sentence description of the project."
- This will be used in PROJECT.md to describe the project's core purpose

**Question C: Team Size**
Ask: "How many developers will work in parallel?"
- This helps RAPID configure worktree and concurrency recommendations
- Default suggestion: 2-3 for small teams
- Accept any positive integer

## Step 5: Scaffold .planning/ Directory

Using the Write tool, create the following files. Use the answers from Step 4 to populate content.

### 5a: `.planning/PROJECT.md`

```markdown
# {Project Name}

**Description:** {one-sentence description from Question B}
**Team Size:** {number from Question C} parallel developers
**Created:** {current date YYYY-MM-DD}
**Core Value:** {leave blank for user to fill in later}

## Key Decisions

| # | Date | Decision | Context |
|---|------|----------|---------|
| 1 | {date} | Initialized RAPID project | Project setup |
```

### 5b: `.planning/STATE.md`

Initialize with Phase 0, Status: Initialized, Progress: 0%. Use the standard STATE.md format with YAML frontmatter.

### 5c: `.planning/ROADMAP.md`

Create an empty template with section headers for phases, dependencies, and timeline.

### 5d: `.planning/REQUIREMENTS.md`

Create an empty template with section headers for functional requirements, non-functional requirements, and constraints.

### 5e: `.planning/config.json`

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

**IMPORTANT:** Do NOT create `.planning/phases/` directory. Phase directories are created on-demand when planning begins, not during initialization.

## Step 6: Confirmation and Next Steps

After all files are created, display a completion summary:

1. List every file that was created (with relative paths)
2. Confirm the project name and description
3. Show team size configuration
4. Suggest the user's next step: "Run `/rapid:help` to see all available commands and the RAPID workflow."

Do NOT run any additional analysis. The init command's job is done after scaffolding.
