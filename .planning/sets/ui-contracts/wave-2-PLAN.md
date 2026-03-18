# Wave 2 PLAN: CLI Commands and Execute Integration

## Objective

Wire the core `ui-contract.cjs` module (built in Wave 1) into the CLI and the executor context pipeline. This wave creates the CLI command handler at `src/commands/ui-contract.cjs`, adds routing in `rapid-tools.cjs`, integrates `buildUiContext` into `enrichedPrepareSetContext` in `execute.cjs`, and adds end-to-end tests.

## File Ownership

| File | Action |
|------|--------|
| `src/commands/ui-contract.cjs` | Create |
| `src/commands/ui-contract.test.cjs` | Create |
| `src/bin/rapid-tools.cjs` | Modify (add 2 lines) |
| `src/lib/execute.cjs` | Modify (add ~10 lines) |

## Task 1: Create the CLI command handler

**File:** `src/commands/ui-contract.cjs`
**Action:** Create new file

Follow the existing handler pattern (see `hooks.cjs`, `review.cjs`): export a single `handleUiContract(cwd, subcommand, args)` async function with a switch on `subcommand`.

### Subcommands:

#### `validate`
- Usage: `rapid-tools ui-contract validate <set-name>`
- Parse positional arg `args[0]` as the set name; throw `CliError` if missing
- Read `.planning/sets/<setName>/UI-CONTRACT.json` from disk (use `findProjectRoot` is already done by the router -- `cwd` is the project root)
- If the file does not exist, throw `CliError('UI-CONTRACT.json not found for set "<setName>"')`
- Parse JSON; if parse fails, throw `CliError('UI-CONTRACT.json is not valid JSON for set "<setName>"')`
- Call `validateUiContract(contractObj)` from `../lib/ui-contract.cjs`
- Output JSON to stdout: `{ "valid": true }` or `{ "valid": false, "errors": [...] }`

#### `check-consistency`
- Usage: `rapid-tools ui-contract check-consistency`
- No positional args needed
- Call `checkUiConsistency(cwd, null)` from `../lib/ui-contract.cjs`
- Output JSON to stdout: `{ "consistent": true|false, "conflicts": [...] }`

#### `show`
- Usage: `rapid-tools ui-contract show <set-name>`
- Parse positional arg `args[0]` as the set name; throw `CliError` if missing
- Read `.planning/sets/<setName>/UI-CONTRACT.json` from disk
- If the file does not exist, throw `CliError('UI-CONTRACT.json not found for set "<setName>"')`
- Parse JSON; call `validateUiContract` to verify it is valid
- If invalid, output JSON `{ "valid": false, "errors": [...] }` and return
- Build a formatted summary output as JSON with structure:
  ```json
  {
    "set": "<setName>",
    "valid": true,
    "sections": {
      "guidelines": { "present": true, "tone": "...", "fontCount": N, "ruleCount": N },
      "components": { "present": true, "count": N, "topLevel": ["name1", "name2"] },
      "tokens": { "present": true, "count": N, "keys": ["primary", "spacing-md", ...] },
      "layout": { "present": true, "hasGrid": true, "breakpointCount": N },
      "interactions": { "present": true, "categories": ["stateTransitions", "animations", ...] }
    }
  }
  ```
- For absent sections, `"present": false` with no other fields
- Output to stdout with `process.stdout.write(JSON.stringify(result) + '\n')`

#### Default (unknown subcommand)
- Throw `CliError('Unknown ui-contract subcommand: "<sub>". Use: validate, check-consistency, show')`

### Pattern to follow:
```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const { CliError } = require('../lib/errors.cjs');

async function handleUiContract(cwd, subcommand, args) {
  const uiContract = require('../lib/ui-contract.cjs');

  switch (subcommand) {
    case 'validate': { ... }
    case 'check-consistency': { ... }
    case 'show': { ... }
    default:
      throw new CliError(`Unknown ui-contract subcommand: "${subcommand}". Use: validate, check-consistency, show`);
  }
}

module.exports = { handleUiContract };
```

**Do NOT:**
- Use `parseArgs` unless you need flags -- positional args are sufficient for these subcommands
- Import `output` from core.cjs for JSON output -- use `process.stdout.write` directly (consistent with other JSON-outputting handlers)
- Modify the UI-CONTRACT.json files (read-only operations)

**Verification:** `node -e "const { handleUiContract } = require('./src/commands/ui-contract.cjs'); console.log(typeof handleUiContract);"` should print `function`

## Task 2: Wire the CLI handler into rapid-tools.cjs

**File:** `src/bin/rapid-tools.cjs`
**Action:** Modify (add import + case)

### Change 1: Add import at the top

Add a new require line after the existing imports (after the `handleCompact` line):

```javascript
const { handleUiContract } = require('../commands/ui-contract.cjs');
```

### Change 2: Add case to the switch statement

Add a new case in the `switch (command)` block, before the `default:` case (after the `case 'hooks':` block):

```javascript
case 'ui-contract':
  await handleUiContract(cwd, subcommand, args.slice(2));
  break;
```

### Change 3: Update USAGE string

Add these lines to the USAGE string, after the `hooks` section and before the `migrate` section:

```
  ui-contract validate <set>        Validate a set's UI-CONTRACT.json against schema
  ui-contract check-consistency     Check cross-set UI consistency
  ui-contract show <set>            Show formatted UI contract summary for a set
```

**Do NOT:**
- Move or reorder existing imports
- Change any other switch cases
- Modify the `migrateStateVersion` function or `main` logic

**Verification:** `node src/bin/rapid-tools.cjs --help 2>&1 | grep ui-contract` should show the 3 subcommands in help output

## Task 3: Integrate buildUiContext into enrichedPrepareSetContext

**File:** `src/lib/execute.cjs`
**Action:** Modify `enrichedPrepareSetContext` function

Add a `uiContext` field to the returned object, following the exact same pattern as `qualityContext`:

After the existing `qualityContext` try/catch block (lines 64-70), add:

```javascript
let uiContext = '';
try {
  const uiContractLib = require('./ui-contract.cjs');
  uiContext = uiContractLib.buildUiContext(cwd, setName);
} catch {
  // Graceful -- UI context is optional
}
```

And update the return statement to include `uiContext`:

```javascript
return {
  ...ctx,
  qualityContext,
  uiContext,
};
```

**Do NOT:**
- Modify `prepareSetContext` (the non-enriched version)
- Change the `qualityContext` logic
- Add any other changes to execute.cjs
- Change the function signature

**Verification:** `node -e "const e = require('./src/lib/execute.cjs'); console.log(typeof e.enrichedPrepareSetContext);"` should print `function` (module still loads)

## Task 4: Create CLI and integration tests

**File:** `src/commands/ui-contract.test.cjs`
**Action:** Create new file

Follow the project test pattern. Tests exercise the CLI handler and the execute.cjs integration.

### Test structure:

**describe('handleUiContract')**

Setup: Create a temp directory with `.planning/sets/<setName>/` structure containing valid and invalid `UI-CONTRACT.json` files. Mock `process.stdout.write` to capture output.

**describe('validate subcommand')**
- `it('outputs valid:true for a valid UI-CONTRACT.json')` -- create temp dir with valid contract, call `handleUiContract(cwd, 'validate', ['test-set'])`, verify stdout JSON has `valid: true`
- `it('outputs valid:false with errors for invalid contract')` -- create temp dir with invalid contract (e.g., unknown property), verify `valid: false` and `errors` array
- `it('throws CliError when set name is missing')` -- call without args, expect CliError
- `it('throws CliError when UI-CONTRACT.json does not exist')` -- set dir exists but no UI-CONTRACT.json

**describe('check-consistency subcommand')**
- `it('outputs consistent:true when no conflicts')` -- two sets with non-overlapping tokens
- `it('detects token conflicts across sets')` -- two sets with conflicting token values

**describe('show subcommand')**
- `it('outputs formatted summary for valid contract')` -- verify JSON structure has `sections` with `present` fields
- `it('throws CliError when set name is missing')`
- `it('outputs valid:false for invalid contract')`

**describe('unknown subcommand')**
- `it('throws CliError for unknown subcommand')` -- call with `handleUiContract(cwd, 'bogus', [])`, expect CliError

**describe('enrichedPrepareSetContext integration')**
- `it('includes uiContext in returned object')` -- This test verifies the execute.cjs change. Since `enrichedPrepareSetContext` requires a real project structure with CLAUDE.md, sets, etc., create a minimal mock. The simplest approach: verify that the function still returns an object, and that calling it does not throw, by checking the key exists. If a full integration test is too fragile, simply verify: `const e = require('../lib/execute.cjs'); assert.ok('enrichedPrepareSetContext' in e)`.

**Testing notes:**
- Capture stdout by temporarily replacing `process.stdout.write` with a spy function in `beforeEach`, restore in `afterEach`
- For `handleUiContract`, the `cwd` must point to the temp dir root (which has `.planning/sets/` inside)
- Use `path.join(tmpDir, '.planning', 'sets', 'test-set')` with `mkdirSync({ recursive: true })` for setup
- Write `UI-CONTRACT.json` with `JSON.stringify()` into the set directory

**Verification:** `node --test src/commands/ui-contract.test.cjs`

## Success Criteria
1. `rapid-tools ui-contract validate <set>` works and outputs JSON
2. `rapid-tools ui-contract check-consistency` works and outputs JSON
3. `rapid-tools ui-contract show <set>` works and outputs JSON summary
4. `enrichedPrepareSetContext` returns object with `uiContext` field
5. All unit tests pass: `node --test src/commands/ui-contract.test.cjs`
6. Existing tests still pass: `node --test src/lib/ui-contract.test.cjs`
7. Only the 4 files listed in File Ownership are created/modified
8. The existing CONTRACT.json validation pipeline is completely untouched
