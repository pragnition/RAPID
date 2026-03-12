---
description: Migrate an existing project from another planning framework to RAPID conventions
allowed-tools: Bash(rapid-tools:*), Read, Write, AskUserQuestion, Glob, Grep
---

# /rapid:migrate -- Project Migration

You are the RAPID migration assistant. This skill helps migrate existing projects from other planning frameworks (GSD, openspec, or custom structures) to RAPID conventions. It uses heuristic detection to identify the source framework, backs up existing files, and restructures with user confirmation at each step.

Follow these steps IN ORDER. Do not skip steps.

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
node "${RAPID_TOOLS}" display banner migrate
```

---

## Step 2: Detect Framework

Run the framework detection heuristic to identify any existing planning structure:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
DETECT_RESULT=$(node "${RAPID_TOOLS}" migrate detect 2>&1)
echo "$DETECT_RESULT"
```

Parse the JSON result. The response includes `{ type, confidence, artifacts, details }`.

Display findings to the user:

```
Framework detected: {type} (confidence: {confidence})

Artifacts found:
- {artifact.path}: {artifact.description}
- ...

Details: {details}
```

**If type is "none":**

Display: "No existing planning structure detected. Nothing to migrate. Consider running `/rapid:init` instead."

Then STOP. End the skill.

---

## Step 3: User Confirmation for Detection

Use AskUserQuestion to confirm the detection results before proceeding:

- question: "Framework detection complete. Review the results above."
- Options:
  - "Proceed" -- "Looks correct, continue with migration"
  - "Cancel" -- "Don't migrate, exit"

**If Cancel:** Display "Migration cancelled." and STOP. End the skill.

**If Proceed:** Continue to Step 4.

---

## Step 4: Backup

Display: "Creating backup of .planning/ to .planning.bak/..."

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
BACKUP_RESULT=$(node "${RAPID_TOOLS}" migrate backup 2>&1)
echo "$BACKUP_RESULT"
```

Parse the result JSON.

**If backup fails** (e.g., `.planning.bak/` already exists):

Display the error message. Inform the user: "Backup failed. A previous backup already exists at `.planning.bak/`. Remove or rename the existing backup and try again."

Then STOP. End the skill.

**If backup succeeds:**

Display: "Backup created at `.planning.bak/`"

Continue to Step 5.

---

## Step 5: User Confirmation for Transform

Use AskUserQuestion to confirm before applying the transformation:

- question: "Backup created successfully. Ready to transform files to RAPID conventions."
- Options:
  - "Transform" -- "Restructure files to RAPID conventions"
  - "Cancel" -- "Keep backup only, don't transform"

**If Cancel:** Display "Backup created but no transformation applied. Your original files are at `.planning.bak/`" and STOP. End the skill.

**If Transform:** Continue to Step 6.

---

## Step 6: Transform

Pass the detection result to the transform command to restructure files:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
echo '${DETECT_RESULT}' | node "${RAPID_TOOLS}" migrate transform 2>&1
```

Where `${DETECT_RESULT}` is the JSON output captured in Step 2. Parse the result JSON containing `{ transformed, skipped, errors }`.

Display the transformation results:

```
Files transformed:
- {file}: {description}
- ...

Files skipped:
- {file}: {reason}
- ...
```

**If errors occurred:**

Display warnings for each error:

```
Warnings:
- {error description}
- ...
```

Warn the user but do NOT fail. The backup at `.planning.bak/` is available for manual recovery if needed.

Continue to Step 7.

---

## Step 7: Verification

Display: "Migration complete. Running `/rapid:status` to verify..."

Automatically run the status display command to show the project in RAPID format:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner migrate "Migration Complete"
```

After the status output, display:

```
> **Migration complete.**
> Backup: .planning.bak/
> Run `/rapid:init` if you need to set up state tracking from scratch.
```

---

## Important Notes

- **Backup is mandatory** before any transformation. The skill will not transform without a successful backup.
- **User confirmation required** at each step: after detection (Step 3) and before transformation (Step 5).
- **No double-migrate:** If `.planning.bak/` already exists, migration refuses to proceed. This prevents accidental overwrite of a previous backup. Remove or rename the existing backup first.
- **Framework-agnostic:** Detection uses filesystem heuristics (scanning for GSD markers, openspec patterns, generic planning files), not hard-coded framework knowledge.
- **Content preservation:** The migration restructures directory layout and file naming, but does NOT rewrite content. Decisions, roadmaps, research, and other planning content are preserved as-is.
- **Automatic status check:** After migration, `/rapid:status` runs automatically to verify the result. This is not a manual suggestion -- it is an automatic verification step.
