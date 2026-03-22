# PLAN: dag-readdition -- Wave 1

## Objective

Create the `dag` CLI command with `generate` and `show` subcommands, and register it in `rapid-tools.cjs`. This is the foundation -- all other integration work depends on being able to generate and display the DAG from the command line.

## Tasks

### Task 1: Create `src/commands/dag.cjs`

**File:** `src/commands/dag.cjs` (NEW)

**Action:** Create a new command module following the same pattern as `src/commands/docs.cjs`. Export a single `handleDag(cwd, subcommand, args)` function with two subcommands: `generate` and `show`.

**Subcommand: `generate`**

1. Import `recalculateDAG` from `../lib/add-set.cjs` and `readState` + `findMilestone` from `../lib/state-machine.cjs`.
2. Call `readState(cwd)` to get current state. If null or invalid, throw a `CliError` with message "STATE.json is missing or invalid. Run init first."
3. Extract `currentMilestone` from `state.currentMilestone`.
4. Call `await recalculateDAG(cwd, currentMilestone)`.
5. On success, write to stdout: `JSON.stringify({ path: dagPath, message: "DAG.json generated" })` where `dagPath` is the canonical path from `DAG_CANONICAL_SUBPATH`.
6. On failure, write error to stderr and exit with code 1.
7. The function must be `async` since `recalculateDAG` returns a Promise.

**Subcommand: `show`**

1. Import `tryLoadDAG` and `getExecutionOrder` from `../lib/dag.cjs`.
2. Call `tryLoadDAG(cwd)`. If `dag` is null, throw a `CliError` with message "No DAG.json found. Run `dag generate` first."
3. Call `getExecutionOrder(dag)` to get wave groups (array of arrays of set IDs).
4. Optionally load STATE.json via `readState(cwd)` to get set statuses. Build a map of setId -> status. If state loading fails, use "unknown" as fallback status.
5. Format output as a wave-grouped table using ANSI colors:
   - Header line: `"DAG: {totalSets} sets, {totalWaves} waves"` (bold)
   - For each wave group: print `"\nWave {N}:"` as a header (bold)
   - Under each wave, print each set name with its status in parentheses, colored:
     - `pending` -> gray (ANSI `\x1b[90m`)
     - `discussed` -> yellow (ANSI `\x1b[33m`)
     - `planned` -> blue (ANSI `\x1b[34m`)
     - `executing` / `executed` -> bright green (ANSI `\x1b[92m`)
     - `complete` -> green (ANSI `\x1b[32m`)
     - `merged` -> dim/dark gray (ANSI `\x1b[2m`)
     - unknown/other -> default (no color)
   - Each set line: `"  {setId}  ({status})"` with status colored
   - End with reset `\x1b[0m`
6. Write formatted output to stdout.

**Unknown subcommand:** Throw `CliError` with message listing valid subcommands: `generate`, `show`.

**No subcommand:** Throw `CliError` with usage message: `"Usage: dag <generate|show>"`.

**Verification:**
```bash
node ~/Projects/RAPID/src/bin/rapid-tools.cjs dag --help 2>&1 | head -5
# Should show usage error (no subcommand)
node ~/Projects/RAPID/src/bin/rapid-tools.cjs dag show 2>&1
# Should either show DAG or report no DAG.json found
```

### Task 2: Register `dag` command in `rapid-tools.cjs`

**File:** `src/bin/rapid-tools.cjs` (MODIFY)

**Action:**

1. Add import at top (after the `handleDocs` import on line 27):
   ```js
   const { handleDag } = require('../commands/dag.cjs');
   ```

2. Add to USAGE string (after the `docs` entries around line 133):
   ```
   dag generate                     Generate DAG.json from set dependencies
   dag show                         Display DAG with wave grouping and status colors
   ```

3. Add case in the switch block (after the `case 'docs':` block, before `default:`):
   ```js
   case 'dag':
     await handleDag(cwd, subcommand, args.slice(2));
     break;
   ```

**Verification:**
```bash
node ~/Projects/RAPID/src/bin/rapid-tools.cjs --help 2>&1 | grep dag
# Should show dag generate and dag show in usage
```

## Success Criteria

- `node rapid-tools.cjs dag generate` reads STATE.json, calls `recalculateDAG`, writes DAG.json, outputs JSON result to stdout
- `node rapid-tools.cjs dag show` loads DAG.json, displays wave-grouped table with ANSI-colored statuses
- `node rapid-tools.cjs dag` (no subcommand) shows usage error
- `node rapid-tools.cjs --help` lists `dag` command

## Files Modified

| File | Action |
|------|--------|
| `src/commands/dag.cjs` | CREATE |
| `src/bin/rapid-tools.cjs` | MODIFY (import + USAGE + switch case) |
