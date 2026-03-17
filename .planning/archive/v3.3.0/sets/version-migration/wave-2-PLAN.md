# PLAN: version-migration Wave 2 -- CLI Integration and Skill

## Objective

Wire the migration infrastructure from Wave 1 into the CLI router and create the `/rapid:migrate` skill definition. This wave creates the CLI command handler (`src/commands/migrate.cjs`), adds the `migrate` case to the router (`src/bin/rapid-tools.cjs`), and defines the skill that orchestrates the agent-driven migration flow (`skills/migrate/SKILL.md`).

## File Ownership

| File | Action |
|------|--------|
| `src/commands/migrate.cjs` | Create |
| `src/bin/rapid-tools.cjs` | Modify (add import + switch case) |
| `skills/migrate/SKILL.md` | Create |

## Prerequisites

- Wave 1 complete: `src/lib/migrate.cjs` exports `detectVersion`, `isLatestVersion`, `createBackup`, `restoreBackup`, `cleanupBackup`

---

## Task 1: Create `src/commands/migrate.cjs` -- CLI Handler

### What to Build

Create the CLI handler for the `migrate` command following the established pattern in `src/commands/*.cjs`. The handler dispatches subcommands to the `src/lib/migrate.cjs` library functions.

### Implementation Details

**File structure:**
```
'use strict';
const { CliError } = require('../lib/errors.cjs');

function handleMigrate(cwd, subcommand, args) {
  const migrate = require('../lib/migrate.cjs');
  // subcommand dispatch
}

module.exports = { handleMigrate };
```

**Subcommands:**

1. **`detect`** -- `rapid-tools migrate detect`
   - Calls `migrate.detectVersion(cwd)`
   - Outputs JSON result to stdout: `process.stdout.write(JSON.stringify(result) + '\n')`
   - No additional args needed

2. **`is-latest`** -- `rapid-tools migrate is-latest`
   - Calls `migrate.detectVersion(cwd)` first
   - If `detected` is null, throw `CliError('Cannot detect current version. No state files found.')`
   - Calls `migrate.isLatestVersion(detected)` with the detected version
   - Outputs JSON: `{ isLatest: boolean, detected: string, current: string }` where `current` comes from `require('../lib/version.cjs').getVersion()`

3. **`backup`** -- `rapid-tools migrate backup`
   - Calls `migrate.createBackup(cwd)`
   - Outputs JSON result to stdout

4. **`restore`** -- `rapid-tools migrate restore`
   - Calls `migrate.restoreBackup(cwd)`
   - Outputs JSON result to stdout

5. **`cleanup`** -- `rapid-tools migrate cleanup`
   - Calls `migrate.cleanupBackup(cwd)`
   - Outputs JSON result to stdout

**Error handling:**
- If no subcommand provided, throw `CliError('Usage: rapid-tools migrate <detect|is-latest|backup|restore|cleanup>')`
- If unknown subcommand, throw `CliError('Unknown migrate subcommand: ${subcommand}. Valid: detect, is-latest, backup, restore, cleanup')`
- Let errors from `migrate.cjs` propagate (they should already be descriptive)

### What NOT to Do
- Do not implement any migration transformation logic in the CLI handler -- that is the skill/agent's job
- Do not add async operations -- all migrate.cjs functions are synchronous
- Do not read stdin -- migrate commands use positional args and flags only

### Verification
```bash
node -e "const { handleMigrate } = require('./src/commands/migrate.cjs'); console.log(typeof handleMigrate);"
```
Expected: `function`

---

## Task 2: Wire `handleMigrate` into `src/bin/rapid-tools.cjs`

### What to Modify

Add the `migrate` command to the CLI router in `src/bin/rapid-tools.cjs`. This requires two changes:

### Change 1: Add Import (near top of file, with other handler imports)

Add after the existing import line for `handleMerge`:
```javascript
const { handleMigrate } = require('../commands/migrate.cjs');
```

### Change 2: Add USAGE Text

In the `USAGE` string, after the `display banner` line and before the closing backtick, add:
```
  migrate detect                   Detect current RAPID version from .planning/ state
  migrate is-latest                Check if .planning/ state is at the latest version
  migrate backup                   Create pre-migration backup of .planning/
  migrate restore                  Restore .planning/ from pre-migration backup
  migrate cleanup                  Remove pre-migration backup
```

### Change 3: Add Switch Case

In the `switch (command)` block (around line 167-228), add a new case before the `default` case:
```javascript
      case 'migrate':
        handleMigrate(cwd, subcommand, args.slice(2));
        break;
```

Note: `handleMigrate` is synchronous (no `await` needed) since all underlying `migrate.cjs` functions use synchronous fs operations.

### What NOT to Do
- Do not modify the `module.exports` at the bottom of the file
- Do not change any existing switch cases
- Do not modify the `migrateStateVersion` function

### Verification
```bash
node src/bin/rapid-tools.cjs migrate detect
```
Expected: JSON output with version detection result (when run from RAPID project root).

```bash
node src/bin/rapid-tools.cjs --help 2>&1 | grep migrate
```
Expected: migrate commands appear in help output.

---

## Task 3: Create `skills/migrate/SKILL.md` -- Skill Definition

### What to Build

Create the skill definition for `/rapid:migrate`. This skill orchestrates the full migration flow: detect version, confirm with user, backup, spawn an agent to analyze and propose changes, show changes, confirm, apply, and report.

### Implementation Details

Create `skills/migrate/SKILL.md` with YAML frontmatter and step-by-step instructions.

**Frontmatter:**
```yaml
---
description: Migrate .planning/ state from older RAPID versions to current version
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
---
```

**Skill content should define these sequential steps:**

**Step 1: Load Environment**
Standard RAPID environment loading block (same as other skills):
```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

**Step 2: Detect Current Version**
Run `node "${RAPID_TOOLS}" migrate detect` and parse the JSON output. Extract `detected`, `confidence`, and `signals` fields.

- If `detected` is `null`: display "Could not detect current RAPID version. No state files found in `.planning/`." and end the skill.
- If detection succeeds: display the detected version, confidence level, and signals to the user.

**Step 3: Check if Already Latest**
Run `node "${RAPID_TOOLS}" migrate is-latest` and parse the JSON output.

- If `isLatest` is `true`: display "Already at latest version ({current}). No migration needed." and end the skill.
- If not latest: display "Migration available: {detected} -> {current}" and continue.

**Step 4: Confirm Detected Version**
Use `AskUserQuestion` to ask the user to confirm the detected version is correct:
- Option 1: "Yes, {detected} is correct" -- proceed with migration
- Option 2: "No, the version is different" -- ask the user to specify the correct version via a follow-up AskUserQuestion, then continue
- Option 3: "Cancel migration" -- end the skill

**Step 5: Check for --dry-run**
If the user's original invocation included `--dry-run` (check skill arguments), set a `DRY_RUN` flag. The skill should note at the top of the instructions that if the user says "dry run" or includes "--dry-run" in their invocation, this flag is active.

**Step 6: Create Backup**
Run `node "${RAPID_TOOLS}" migrate backup` to create the pre-migration backup. Display the backup location and file count.

If backup fails (e.g., backup already exists), display the error and offer:
- Option: "Remove existing backup and retry" -- run `node "${RAPID_TOOLS}" migrate cleanup` then retry backup
- Option: "Cancel migration" -- end skill

**Step 7: Analyze and Propose Changes (Agent-Driven)**
This is the core migration logic. The skill instructs the agent (which IS running this skill) to:

1. Read the current `.planning/` state files (STATE.json, ROADMAP.md, config.json, set definitions, etc.)
2. Read the RAPID codebase to understand the current version's expected format:
   - Read `src/lib/state-schemas.cjs` for the current Zod schemas
   - Read `src/lib/state-machine.cjs` for state management patterns
   - Read `src/lib/init.cjs` to see how a fresh project is scaffolded (the "target" format)
   - Read any relevant migration history in the codebase
3. Compare the existing `.planning/` state against what the current RAPID version expects
4. Build a list of proposed changes as a structured list:
   - Each change: `{ file, action: 'modify'|'create'|'delete', description, before?, after? }`
   - Common migrations to look for:
     - Missing `rapidVersion` field in STATE.json -> add it with current version
     - Old milestone ID formats -> update to current conventions
     - Missing `.planning/context/` directory -> create it
     - Old set status values (present-tense -> past-tense)
     - Schema shape changes (missing fields, deprecated fields)
     - Missing `config.json` or outdated config structure

**Step 8: Show Proposed Changes**
Display all proposed changes in a human-readable diff-style format. For each change:
- File path
- Action (modify/create/delete)
- Description of the change
- Before/after snippets for modifications

If `DRY_RUN` is active: display the changes and end the skill with "Dry run complete. No changes written."

**Step 9: Confirm and Apply**
If not dry run, use `AskUserQuestion`:
- Option: "Apply all changes" -- proceed to apply
- Option: "Cancel and restore backup" -- run `node "${RAPID_TOOLS}" migrate restore` and end

If confirmed, apply each proposed change using the appropriate tool (Edit for modifications, Write for creates, Bash for deletions).

After applying all changes, stamp `rapidVersion` in STATE.json with the current RAPID version if not already done by the changes.

**Step 10: Cleanup and Report**
Run `node "${RAPID_TOOLS}" migrate cleanup` to remove the backup.

Print a migration report to stdout:
```
## Migration Report
- **From:** {detectedVersion}
- **To:** {currentVersion}
- **Changes applied:** {count}
- **Backup:** Cleaned up
- **Status:** Success
```

List each change that was applied.

Do NOT write the report as a file -- stdout only.

### What NOT to Do
- Do not write the report to a file -- print to stdout only
- Do not skip the backup step -- it is mandatory before any changes
- Do not skip user confirmation -- always ask before applying changes
- Do not hardcode migration transformations -- the agent dynamically analyzes what needs to change
- Do not modify files outside `.planning/` during migration

### Verification
```bash
test -f skills/migrate/SKILL.md && echo "SKILL.md exists"
```
Expected: `SKILL.md exists`

Verify the YAML frontmatter is valid:
```bash
head -4 skills/migrate/SKILL.md
```
Expected: YAML frontmatter with `description` and `allowed-tools` fields.

---

## Success Criteria

1. `src/commands/migrate.cjs` exports `handleMigrate` and handles all 5 subcommands
2. `src/bin/rapid-tools.cjs` routes `migrate` command to `handleMigrate`
3. `node src/bin/rapid-tools.cjs migrate detect` outputs valid JSON
4. `node src/bin/rapid-tools.cjs --help` includes migrate commands
5. `skills/migrate/SKILL.md` exists with valid frontmatter and complete step-by-step instructions
6. All existing tests continue to pass: `node --test 'src/**/*.test.cjs'`
