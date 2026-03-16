---
description: Generate project-type-aware foundation files for the target codebase
allowed-tools: Bash(rapid-tools:*), AskUserQuestion, Read
---

# /rapid:scaffold -- Project Scaffolding

You are the RAPID project scaffolder. This skill generates foundation files (directory structure, entry points, tooling configs) based on the detected project type. Scaffold is additive-only -- existing files are never overwritten.

Follow these steps IN ORDER. Do not skip steps.

## Environment Setup

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill.

## Display Stage Banner

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner scaffold
```

---

## Step 1: Check Existing Scaffold

Check if scaffold has already been run:

```bash
# (env preamble)
node "${RAPID_TOOLS}" scaffold status
```

Parse the JSON output.

**If `scaffolded` is not false (report exists):**

Display the existing report summary: project type, files created count, timestamp.

Use AskUserQuestion with:
- question: "Scaffold has already been run for this project."
- Options:
  - "Re-run scaffold" -- "Run scaffold again. Existing files will be skipped (additive-only)."
  - "View report" -- "Show the full scaffold report with all created and skipped files."
  - "Cancel" -- "Exit without changes."

If "View report": Display the full report, then re-prompt with the same options (minus "View report").
If "Cancel": Print "Cancelled. No changes made." and end the skill.
If "Re-run scaffold": Continue to Step 2.

**If no existing report:** Continue to Step 2.

---

## Step 2: Run Scaffold

```bash
# (env preamble)
node "${RAPID_TOOLS}" scaffold run
```

Parse the JSON output.

**If `needsUserInput` is true (ambiguous project type):**

Use AskUserQuestion with:
- question: "Project type is ambiguous. Multiple types detected."
- Options: One option per candidate in the `candidates` array. For each candidate:
  - "{candidate}" -- "Scaffold as a {candidate} project"

Store the selected type.

Re-run scaffold with the type override:

```bash
# (env preamble)
node "${RAPID_TOOLS}" scaffold run --type "{selected_type}"
```

**If result is a ScaffoldReport:**

Display a summary:
- Project type detected
- Language used for templates
- Number of files created
- Number of files skipped (with reasons if any)

---

## Step 3: Git Commit

Scaffold output should be committed to the current branch (main) before any set branches are created.

```bash
git add -A
git status --short
```

If there are changes to commit:

```bash
git commit -m "scaffold: generate foundation files for {projectType} project"
```

If no changes (all files were skipped): inform the user that no new files were generated.

---

## Step 4: Completion

Display:

> **Scaffold complete.** {N} files generated for {projectType} ({language}) project.
>
> The scaffold report has been saved to `.planning/scaffold-report.json`. The roadmapper will use this to establish baseline file awareness when planning sets.
>
> **Next step:** Continue with `/rapid:start-set` to begin set development.

## Important Constraints

- Scaffold is additive-only. It NEVER overwrites existing files.
- Scaffold commits to the current branch (usually main) before any set branches exist.
- The lib module does NOT perform git operations -- this skill handles all git.
- If active worktrees exist, warn the user but do not block (scaffold may still be useful for adding missing files).
