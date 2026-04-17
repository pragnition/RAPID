---
description: Migrate .planning/ state from older RAPID versions to current version
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
args: []
categories: [autonomous]
---

# /rapid:migrate -- Version Migration

You are the RAPID migration orchestrator. This skill detects the current version of a project's `.planning/` state, compares it against the running RAPID version, and guides an interactive migration to bring state files up to date.

**Dry-run mode:** If the user's invocation includes `--dry-run` or the user says "dry run", set a `DRY_RUN` flag. In dry-run mode, proposed changes are displayed but NOT applied. The skill ends after showing the diff.

Follow these steps IN ORDER. Do not skip steps. Use AskUserQuestion at every decision point.

---

## Step 1: Load Environment

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

---

## Step 2: Detect Current Version

Run version detection:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" migrate detect
```

Parse the JSON output. Extract `detected`, `confidence`, and `signals` fields.

- If `detected` is `null`: display "Could not detect current RAPID version. No state files found in `.planning/`." and **end the skill**.
- If detection succeeds: display the detected version, confidence level, and signals to the user:

```
Detected RAPID version: {detected}
Confidence: {confidence}
Signals:
  - {signal1}
  - {signal2}
  ...
```

---

## Step 3: Check if Already Latest

Run the latest-version check:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" migrate is-latest
```

Parse the JSON output. Extract `isLatest`, `detected`, and `current` fields.

- If `isLatest` is `true`: display "Already at latest version ({current}). No migration needed." and **end the skill**.
- If not latest: display "Migration available: {detected} -> {current}" and continue.

---

## Step 4: Confirm Detected Version

Use `AskUserQuestion` to ask the user to confirm the detected version is correct:

- question: "Is the detected version correct?"
- Options:
  - "Yes, {detected} is correct" -- "Proceed with migration from {detected}"
  - "No, the version is different" -- "Specify the correct source version manually"
  - "Cancel migration" -- "Exit without making changes"

If "No, the version is different": use a follow-up `AskUserQuestion` freeform to ask "What is the correct source version?" and use the user's answer as the detected version for the rest of the flow.

If "Cancel migration": end the skill.

---

## Step 5: Create Backup

Run the backup command:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" migrate backup
```

Parse the JSON output. Display the backup location and file count:

```
Backup created: {backupPath}
Files backed up: {fileCount}
```

If backup fails (e.g., backup already exists), display the error and use `AskUserQuestion`:

- question: "Backup failed"
- Options:
  - "Remove existing backup and retry" -- "Run cleanup, then retry backup creation"
  - "Cancel migration" -- "Exit without making changes"

If "Remove existing backup and retry":

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" migrate cleanup
node "${RAPID_TOOLS}" migrate backup
```

If "Cancel migration": end the skill.

---

## Step 6: Analyze and Propose Changes (Agent-Driven)

This is the core migration logic. You (the agent running this skill) must dynamically analyze the gap between the current `.planning/` state and what the running RAPID version expects.

### 6a: Read Current State Files

Read the following files from `.planning/` (skip any that do not exist):

- `.planning/STATE.json` -- the main state file
- `.planning/ROADMAP.md` -- the roadmap document
- `.planning/config.json` -- project configuration
- `.planning/DAG.json` or `.planning/sets/DAG.json` -- dependency graph
- Any `.planning/sets/*/CONTRACT.json` -- set contracts
- Any `.planning/sets/*/SET-OVERVIEW.md` -- set overviews

### 6b: Read Current RAPID Expected Formats

Read these files from the RAPID codebase to understand the target format:

- `src/lib/state-schemas.cjs` -- Zod schemas defining the expected STATE.json structure
- `src/lib/state-machine.cjs` -- state management patterns and valid transitions
- `src/lib/init.cjs` -- how a fresh project is scaffolded (the "target" format)

### 6c: Compare and Build Change List

Compare the existing `.planning/` state against what the current RAPID version expects. Build a structured list of proposed changes. Each change should have:

- **file**: the file path relative to project root
- **action**: `modify`, `create`, or `delete`
- **description**: human-readable explanation of what changes and why
- **before**: (for modifications) the current value/snippet
- **after**: (for modifications) the proposed new value/snippet

Common migrations to look for:

1. **Missing `rapidVersion` field in STATE.json** -- add it with the current RAPID version string
2. **Old milestone ID formats** -- update to current conventions if needed
3. **Missing `.planning/context/` directory** -- create it if the current version expects it
4. **Old set status values** -- convert present-tense statuses (discussing, planning, executing, reviewing, merging) to past-tense (discussed, planned, executed, reviewed, merged)
5. **Schema shape changes** -- missing required fields, deprecated fields that should be removed
6. **Missing `config.json`** -- create with default structure if absent
7. **DAG.json location** -- move from `.planning/DAG.json` to `.planning/sets/DAG.json` if needed
8. **Missing CONTRACT.json or SET-OVERVIEW.md** -- create stubs for sets that lack them
9. **Outdated config structure** -- add missing config fields with defaults

---

## Step 7: Show Proposed Changes

Display all proposed changes in a human-readable diff-style format:

```
## Proposed Migration Changes ({count} total)

### 1. {action}: {file}
{description}

Before:
  {before snippet or "N/A"}

After:
  {after snippet or "N/A"}

### 2. {action}: {file}
...
```

If there are NO changes needed (everything already matches), display "No changes needed. State is compatible with current version." and skip to cleanup.

If `DRY_RUN` is active: display the changes and end the skill with:

```
Dry run complete. No changes written.
To apply these changes, run /rapid:migrate without --dry-run.
```

---

## Step 8: Confirm and Apply

If not dry run, use `AskUserQuestion`:

- question: "Apply all {count} changes?"
- Options:
  - "Apply all changes" -- "Write all proposed changes to disk"
  - "Cancel and restore backup" -- "Revert to pre-migration state"

**If "Cancel and restore backup":**

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" migrate restore
```

Display "Backup restored. No changes applied." and end the skill.

**If "Apply all changes":**

Apply each proposed change using the appropriate tool:

- **modify**: Use the Edit tool to make targeted replacements in existing files
- **create**: Use the Write tool to create new files
- **delete**: Use Bash `rm` to remove deprecated files

After applying all changes, ensure `rapidVersion` is stamped in STATE.json with the current RAPID version. If this was not already part of the proposed changes, add it now using Edit.

---

## Step 9: Cleanup and Report

Remove the pre-migration backup:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" migrate cleanup
```

Print the migration report to stdout (do NOT write it as a file):

```
## Migration Report
- **From:** {detectedVersion}
- **To:** {currentVersion}
- **Changes applied:** {count}
- **Backup:** Cleaned up
- **Status:** Success

### Changes Applied
1. {action}: {file} -- {description}
2. {action}: {file} -- {description}
...
```

---

## Important Constraints

- **Never skip the backup step.** A backup must exist before any changes are applied. This is mandatory.
- **Never skip user confirmation.** Always ask before applying changes. The user must explicitly approve.
- **Do not hardcode migration transformations.** The agent dynamically analyzes what needs to change by comparing current state against the RAPID codebase's expected formats.
- **Do not modify files outside `.planning/`.** Migration only touches planning state files.
- **Do not write the migration report to a file.** Print it to stdout only.
- **Do not force a version.** If detection confidence is low, let the user confirm or override.

## Anti-Patterns -- Do NOT Do These

- Do NOT apply changes without creating a backup first.
- Do NOT skip the dry-run check -- if the user requested dry-run, stop after showing changes.
- Do NOT assume a fixed set of migrations -- dynamically analyze the gap each time.
- Do NOT modify source code files -- only `.planning/` state files are in scope.
- Do NOT delete the backup before confirming all changes applied successfully.
