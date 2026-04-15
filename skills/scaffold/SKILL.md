---
description: Generate project-type-aware foundation files for the target codebase
allowed-tools: Bash(rapid-tools:*), AskUserQuestion, mcp__rapid__webui_ask_user, Read
---

# /rapid:scaffold -- Project Scaffolding

You are the RAPID project scaffolder. This skill generates foundation files (directory structure, entry points, tooling configs) based on the detected project type. Scaffold is additive-only -- existing files are never overwritten.

**Dual-mode operation:** Every interactive prompt below checks `$RAPID_RUN_MODE`. When `RAPID_RUN_MODE=sdk`, the prompt is routed through the web bridge; otherwise the built-in tool is used. The if/else branches at each call site make both modes explicit.

Subcommands:
  scaffold run [--type <type>]  -- Generate project foundation files
  scaffold status               -- Show scaffold report
  scaffold verify-stubs         -- Check which stubs have been replaced by real implementations

Follow these steps IN ORDER. Do not skip steps.

## Environment Setup

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill.

## Display Stage Banner

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
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

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "Scaffold has already been run for this project."
  #   options: ["Re-run scaffold", "View report", "Cancel"]
  #   allow_free_text: false
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion with:
  # - question: "Scaffold has already been run for this project."
  # - Options:
  #   - "Re-run scaffold" -- "Run scaffold again. Existing files will be skipped (additive-only)."
  #   - "View report" -- "Show the full scaffold report with all created and skipped files."
  #   - "Cancel" -- "Exit without changes."
fi
```

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

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "Project type is ambiguous. Multiple types detected."
  #   options: [one option per candidate in the `candidates` array, e.g. "{candidate}"]
  #   allow_free_text: false
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion with:
  # - question: "Project type is ambiguous. Multiple types detected."
  # - Options: One option per candidate in the `candidates` array. For each candidate:
  #   - "{candidate}" -- "Scaffold as a {candidate} project"
fi
```

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

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:start-set"
```

## Stub Verification

The `verify-stubs` subcommand checks all known stub files and reports which ones have been
replaced by real implementations and which remain as stubs.

```bash
# (env preamble)
node "${RAPID_TOOLS}" scaffold verify-stubs
```

Parse the JSON output:
- `total`: Total number of stub files found
- `replaced`: Array of relative paths to stubs that have been replaced (no longer contain RAPID-STUB marker)
- `remaining`: Array of relative paths to stubs that still contain the RAPID-STUB marker

**Stub Detection:** A file is considered a stub if its first line is exactly `// RAPID-STUB`.
When a developer replaces a stub with real implementation code, the RAPID-STUB marker on
line 1 is naturally overwritten, and `verify-stubs` will report it as replaced.

**Sidecar Files:** Each stub has a zero-byte `.rapid-stub` sidecar file alongside it.
These sidecars are used by the merge pipeline for language-agnostic stub detection.
They are automatically cleaned up during merge.

## Scaffold Report v2

When running scaffold on a multi-developer project with group partitioning, the scaffold
report includes additional fields:

- `groups`: Group assignments from DAG (Record<groupId, {sets: string[]}>)
- `stubs`: Array of stub file paths generated during scaffolding
- `foundationSet`: Name of the foundation set (if one was created), or null

These fields are optional and additive -- v1 report consumers will ignore them.

## Important Constraints

- Scaffold is additive-only. It NEVER overwrites existing files.
- Scaffold commits to the current branch (usually main) before any set branches exist.
- The lib module does NOT perform git operations -- this skill handles all git.
- If active worktrees exist, warn the user but do not block (scaffold may still be useful for adding missing files).
