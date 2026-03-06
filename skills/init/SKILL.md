---
description: Initialize a new RAPID project with conversational setup and prerequisite validation
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Glob, AskUserQuestion
---

# /rapid:init -- Project Initialization

You are the RAPID project initializer. Follow these steps IN ORDER. Do not skip steps. Ask ONE question at a time during conversational setup.

## Step 1: Prerequisite Validation

Run the prerequisite checker to verify the development environment:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" prereqs
```

Parse the JSON output. The response includes `results` (array of tool checks) and `summary` (with `table`, `hasBlockers`, `hasWarnings`).

Display the results as a formatted markdown table showing the status of each tool:

| Status | Tool | Version | Required | Reason |
|--------|------|---------|----------|--------|
| (from results) | ... | ... | ... | ... |

Decision logic:
- If `summary.hasBlockers` is true: Display the blocker table as above, then use AskUserQuestion with:
  - question: "Prerequisites missing"
  - Options:
    - "Retry check" -- "Re-run prerequisite validation after installing missing tools"
    - "View install guide" -- "Show install commands for each missing tool (e.g., git: brew install git / apt install git / winget install Git.Git)"
    - "Cancel init" -- "Exit initialization. No changes made."
  - If the user picks "Retry check": Loop back to the prerequisite command at the top of Step 1 and re-run validation.
  - If the user picks "View install guide": Display install commands for each blocker, then re-prompt with the same AskUserQuestion (the user may retry after installing).
  - If the user picks "Cancel init": Print "Cancelled. No changes made." and end the skill.
- If `summary.hasWarnings` is true: Display the warnings but continue. Tell the user which optional tools are missing and why they are helpful.
- If all pass: Briefly confirm all prerequisites are met and continue to Step 2.

## Step 2: Git Repository Check

Run the git repository check:

```bash
node "${RAPID_TOOLS}" prereqs --git-check
```

Parse the JSON output containing `isRepo` (boolean) and `toplevel` (string or null).

Decision logic:
- If `isRepo` is false: Ask the user: "This directory is not a git repository. Would you like me to run `git init` to initialize one?" Wait for their response.
  - If they agree: Run `git init` and confirm.
  - If they decline: Print "RAPID requires a git repository for worktree-based parallel development. Run `git init` when ready, then `/rapid:init` again." and end the skill.
- If `isRepo` is true: Continue silently to Step 3. Do not mention this check.

## Step 3: Existing Project Detection

Run the existing project detector:

```bash
node "${RAPID_TOOLS}" init detect
```

Parse the JSON output containing `exists` (boolean) and `files` (string array of existing planning files).

Decision logic:
- If `exists` is true: This project has already been initialized. Show the user the list of existing files from the `files` array, then use AskUserQuestion to present the options:

  Use AskUserQuestion with:
  - question: "Existing project detected"
  - Options:
    - "Reinitialize" -- "Back up .planning/ to .planning.backup.{timestamp}/ and create fresh. All previous planning data is preserved in the backup."
    - "Upgrade" -- "Add any missing files to existing .planning/ without overwriting existing content. Your current state is preserved."
    - "Cancel" -- "Exit initialization. No changes will be made."

  Store the user's selection. Map it to the `--mode` argument for the scaffold command:
  - "Reinitialize" -> `--mode reinitialize`
  - "Upgrade" -> `--mode upgrade`
  - "Cancel" -> `--mode cancel`

  **NEVER proceed without the user's explicit choice.**

- If `exists` is false: Continue to Step 3.5 without comment.

## Step 3.5: Brownfield Detection

Detect whether the project directory contains existing source code:

```bash
node "${RAPID_TOOLS}" context detect
```

Parse the JSON output for the `hasSourceCode` field.

Decision logic:
- If `hasSourceCode` is true: Use AskUserQuestion to present the options:

  Use AskUserQuestion with:
  - question: "Codebase detected"
  - Options:
    - "Brownfield (analyze existing code)" -- "After init completes, RAPID will automatically analyze your codebase and generate context files (CLAUDE.md, style guide, conventions). No separate command needed."
    - "Greenfield (start fresh)" -- "Skip codebase analysis. You can run /rapid:context later after adding code."

  Store the user's selection. If the user selects "Brownfield", remember this choice -- after Step 5 scaffold completes, context generation will be auto-triggered seamlessly.

- If `hasSourceCode` is false: Display a brief text note: "No source code detected. You can run `/rapid:context` later after adding code to generate project context." Do NOT show an AskUserQuestion prompt.

## Step 4: Conversational Setup

Gather project information by asking ONE question at a time. Wait for the user's answer before asking the next question. Do not batch questions.

**Question A: Project Name**

First, detect the current directory name:

```bash
basename "$(pwd)"
```

Then use AskUserQuestion with:
- question: "Project name"
- Options:
  - "{detected directory name}" -- "Use the current directory name"
  - "Other" -- "Enter a custom project name"

If the user selects "Other", ask them freeform: "What would you like to name the project?" and accept whatever they provide.

**Question B: Project Description**
Ask: "Give a one-sentence description of the project."
- This will be used in PROJECT.md to describe the project's core purpose

**Question C: Team Size**

Use AskUserQuestion with:
- question: "Team size"
- Options:
  - "Solo (1 developer)" -- "Single developer workflow. Simpler worktree management."
  - "Small team (2-3 developers)" -- "Recommended for most projects. Balanced parallelism."
  - "Medium team (4-5 developers)" -- "Higher parallelism. More worktrees and sets."
  - "Large team (6+ developers)" -- "Maximum parallelism. Complex merge coordination."

Map the selection to an integer for the `--team-size` argument:
- "Solo (1 developer)" -> 1
- "Small team (2-3 developers)" -> 3
- "Medium team (4-5 developers)" -> 5
- "Large team (6+ developers)" -> 6

## Step 5: Scaffold .planning/ Directory

Run the scaffold command using the answers from Step 4. The CLI creates all `.planning/` files from the single-source-of-truth templates in `init.cjs`.

**For fresh scaffolding** (default, when `.planning/` does not exist):

```bash
node "${RAPID_TOOLS}" init scaffold --name "{project name}" --desc "{description}" --team-size {N}
```

**For reinitialize** (user chose Reinitialize in Step 3):

```bash
node "${RAPID_TOOLS}" init scaffold --name "{project name}" --desc "{description}" --team-size {N} --mode reinitialize
```

**For upgrade** (user chose Upgrade in Step 3):

```bash
node "${RAPID_TOOLS}" init scaffold --name "{project name}" --desc "{description}" --team-size {N} --mode upgrade
```

**For cancel** (user chose Cancel in Step 3):

```bash
node "${RAPID_TOOLS}" init scaffold --mode cancel
```

Parse the JSON result:
- For fresh/reinitialize: The `created` array lists every file that was created.
- For reinitialize: The `backed_up_to` field shows where the backup was saved.
- For upgrade: The `created` array lists newly added files, `skipped` lists files that were preserved.
- For cancel: The `cancelled` field confirms no changes were made.

Replace `{project name}`, `{description}`, and `{N}` with the actual values from Step 4. Quote `--name` and `--desc` values with double quotes since they contain user input. `--team-size` is a bare integer.

**IMPORTANT:** Do NOT create `.planning/phases/` directory. Phase directories are created on-demand when planning begins, not during initialization.

**Brownfield auto-trigger:** If the user chose "Brownfield (analyze existing code)" in Step 3.5, proceed to run `/rapid:context` automatically after scaffold completes. The user already consented to codebase analysis -- do not ask for confirmation again. This means the context skill should skip its Step 4 confirmation when auto-triggered from init. The transition should feel seamless: init scaffolding completes, then context generation starts as part of the same flow.

## Step 6: Confirmation and Next Steps

Using the JSON output from the Step 5 scaffold command, display a completion summary:

1. List the files from the `created` array (with relative paths)
2. If reinitialize mode: Note the backup location from `backed_up_to`
3. If upgrade mode: List `created` (new files added) and `skipped` (existing files preserved) separately
4. If cancel mode: Confirm no changes were made and end here
5. Confirm the project name and description
6. Show team size configuration
7. If brownfield auto-trigger occurred: Include the context generation summary as part of init completion. Show what context files were generated alongside the scaffold results.
8. Suggest the user's next step: "Run `/rapid:help` to see all available commands and the RAPID workflow."

Do NOT run any additional analysis unless brownfield was selected (in which case context generation is already handled above).
