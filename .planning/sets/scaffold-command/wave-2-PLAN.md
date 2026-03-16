# Wave 2 Plan: CLI Integration and Skill Wiring

## Objective

Wire the scaffold engine into the RAPID CLI by creating the command handler (`src/commands/scaffold.cjs`), adding the router entry in `rapid-tools.cjs`, registering scaffold commands in `tool-docs.cjs`, adding the display banner stage, and creating the skill definition (`skills/scaffold/SKILL.md`). After this wave, users can invoke `/rapid:scaffold` from Claude Code and `node rapid-tools.cjs scaffold run` from the command line.

## Prerequisites

Wave 1 must be complete. The following exports from `src/lib/scaffold.cjs` are consumed:
- `scaffold(cwd, options)` -- main entry point
- `readScaffoldReport(cwd)` -- for status subcommand
- `classifyProjectType(codebaseInfo, cwd)` -- used indirectly through `scaffold()`

---

## Task 1: Command Handler

**File:** `src/commands/scaffold.cjs`

### Implementation

1. Create a new command handler module following the established pattern (see `src/commands/init.cjs` as reference).

2. Implement `handleScaffold(cwd, subcommand, args)` with two subcommands:

   **`scaffold run [--type <type>]`:**
   - Parse `--type` from args (optional override).
   - Call `scaffold(cwd, { projectType: type })` from `../lib/scaffold.cjs`.
   - If the result has `needsUserInput: true`, output the JSON response so the skill can prompt the user. Shape: `{ needsUserInput: true, candidates: [...], classification: {...} }`.
   - If the result is a `ScaffoldReport`, output it as JSON to stdout.
   - Throw `CliError` if scaffold fails unexpectedly.

   **`scaffold status`:**
   - Call `readScaffoldReport(cwd)` from `../lib/scaffold.cjs`.
   - If report exists, output it as JSON.
   - If no report, output `{ "scaffolded": false }`.

   **No subcommand or unknown subcommand:**
   - Throw `CliError` with usage message: `'Usage: rapid-tools scaffold <run|status> [--type <type>]'`

3. Export `{ handleScaffold }`.

### What NOT to do
- Do NOT put any scaffold logic in the handler -- all logic lives in `src/lib/scaffold.cjs`.
- Do NOT call `process.exit()` directly -- throw `CliError` for errors.
- Do NOT perform git operations in the handler -- the SKILL.md orchestrates git.

### Verification
```bash
node -e "const { handleScaffold } = require('./src/commands/scaffold.cjs'); console.log(typeof handleScaffold)"
```
Expected: `function`

---

## Task 2: CLI Router Wiring

**File:** `src/bin/rapid-tools.cjs`

### Implementation

1. Add the import at the top of the file, after the existing imports (line ~19, after the `handleMerge` import):
   ```javascript
   const { handleScaffold } = require('../commands/scaffold.cjs');
   ```

2. Add `scaffold` to the USAGE string. Insert after the `build-agents` line (around line 101):
   ```
   scaffold run [--type <type>]  Generate project-type-aware foundation files
   scaffold status               Show scaffold report (if scaffold has been run)
   ```

3. Add the scaffold case in the `switch(command)` block, after the `build-agents` case (around line 221). Scaffold requires project root, so it goes in the switch block after `findProjectRoot()`:
   ```javascript
   case 'scaffold':
     handleScaffold(cwd, subcommand, args.slice(2));
     break;
   ```

### What NOT to do
- Do NOT make the scaffold handler async (the library functions are synchronous).
- Do NOT add scaffold before `findProjectRoot()` -- scaffold needs the project root.

### Verification
```bash
node src/bin/rapid-tools.cjs scaffold --help 2>&1 || true
# Should show usage or an error indicating the command is recognized
node src/bin/rapid-tools.cjs --help 2>&1 | grep -c scaffold
```
Expected: At least 1 match for "scaffold" in help output.

---

## Task 3: Tool Documentation Registration

**File:** `src/lib/tool-docs.cjs`

### Implementation

1. Add two entries to `TOOL_REGISTRY` (after the `display-banner` entry, around line 94):
   ```javascript
   'scaffold-run':     'scaffold run [--type <type:str>] -- Generate project foundation files',
   'scaffold-status':  'scaffold status -- Show scaffold report',
   ```

2. No changes to `ROLE_TOOL_MAP` needed initially -- the scaffold command is invoked directly by the skill, not by an agent role.

### Verification
```bash
node -e "const { TOOL_REGISTRY } = require('./src/lib/tool-docs.cjs'); console.log(TOOL_REGISTRY['scaffold-run'] ? 'OK' : 'MISSING')"
```
Expected: `OK`

### Test verification
```bash
node --test src/lib/tool-docs.test.cjs
```
Expected: Existing tests still pass (tool-docs tests validate registry key consistency).

---

## Task 4: Display Banner Stage

**File:** `src/lib/display.cjs`

### Implementation

1. Add `'scaffold'` entry to `STAGE_VERBS` (around line 38):
   ```javascript
   'scaffold': 'SCAFFOLDING',
   ```

2. Add `'scaffold'` entry to `STAGE_BG` (around line 64). Scaffold is a planning-adjacent stage, so use bright blue background:
   ```javascript
   'scaffold': '\x1b[104m',     // bright blue (planning stage)
   ```

### Verification
```bash
node -e "const { STAGE_VERBS, STAGE_BG } = require('./src/lib/display.cjs'); console.log(STAGE_VERBS['scaffold'] ? 'OK' : 'MISSING', STAGE_BG['scaffold'] ? 'OK' : 'MISSING')"
```
Expected: `OK OK`

### Test verification
```bash
node --test src/lib/display.test.cjs
```
Expected: Existing tests still pass.

---

## Task 5: Skill Definition

**File:** `skills/scaffold/SKILL.md`

### Implementation

Create the skill file following the established SKILL.md pattern (see `skills/init/SKILL.md` and `skills/start-set/SKILL.md` for reference).

Content:

```markdown
---
description: Generate project-type-aware foundation files for the target codebase
allowed-tools: Bash(rapid-tools:*), AskUserQuestion, Read
---

# /rapid:scaffold -- Project Scaffolding

You are the RAPID project scaffolder. This skill generates foundation files (directory structure, entry points, tooling configs) based on the detected project type. Scaffold is additive-only -- existing files are never overwritten.

Follow these steps IN ORDER. Do not skip steps.

## Environment Setup

Load environment variables before any CLI calls:

\```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
\```

Use this environment preamble in ALL subsequent Bash commands within this skill.

## Display Stage Banner

\```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner scaffold
\```

---

## Step 1: Check Existing Scaffold

Check if scaffold has already been run:

\```bash
# (env preamble)
node "${RAPID_TOOLS}" scaffold status
\```

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

\```bash
# (env preamble)
node "${RAPID_TOOLS}" scaffold run
\```

Parse the JSON output.

**If `needsUserInput` is true (ambiguous project type):**

Use AskUserQuestion with:
- question: "Project type is ambiguous. Multiple types detected."
- Options: One option per candidate in the `candidates` array. For each candidate:
  - "{candidate}" -- "Scaffold as a {candidate} project"

Store the selected type.

Re-run scaffold with the type override:

\```bash
# (env preamble)
node "${RAPID_TOOLS}" scaffold run --type "{selected_type}"
\```

**If result is a ScaffoldReport:**

Display a summary:
- Project type detected
- Language used for templates
- Number of files created
- Number of files skipped (with reasons if any)

---

## Step 3: Git Commit

Scaffold output should be committed to the current branch (main) before any set branches are created.

\```bash
git add -A
git status --short
\```

If there are changes to commit:

\```bash
git commit -m "scaffold: generate foundation files for {projectType} project"
\```

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
```

Note: The backticks in code blocks above need to be unescaped in the actual file. The backslash-backtick notation above is for escaping within this plan only.

### What NOT to do
- Do NOT include `Agent` or `Write` in `allowed-tools` -- the skill uses CLI and AskUserQuestion only.
- Do NOT include complex logic in the skill -- it delegates to the CLI handler.

### Verification
```bash
test -f skills/scaffold/SKILL.md && echo "OK" || echo "MISSING"
```
Expected: `OK`

---

## Success Criteria

1. `node src/bin/rapid-tools.cjs scaffold run` works from a RAPID project directory (outputs ScaffoldReport or needsUserInput JSON)
2. `node src/bin/rapid-tools.cjs scaffold status` works (outputs report or `{ "scaffolded": false }`)
3. `node src/bin/rapid-tools.cjs --help` includes scaffold commands
4. `TOOL_REGISTRY` includes `scaffold-run` and `scaffold-status`
5. `STAGE_VERBS` and `STAGE_BG` include `scaffold`
6. `skills/scaffold/SKILL.md` exists with correct frontmatter and step structure
7. All existing tests still pass: `node --test src/lib/tool-docs.test.cjs && node --test src/lib/display.test.cjs`
