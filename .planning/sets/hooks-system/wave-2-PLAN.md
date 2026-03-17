# Wave 2: CLI Commands, Shell Script, and Integration

## Objective

Wire the hooks system into the RAPID CLI and Claude Code hook infrastructure. After this wave, users can run `rapid-tools hooks list|run|enable|disable` from the command line, the companion shell script `rapid-verify.sh` is available for Claude Code hook integration, and the tool registry documents all new commands.

## Prerequisites

- Wave 1 complete: `src/lib/hooks.cjs` exports `runPostTaskHooks`, `loadHooksConfig`, `saveHooksConfig`, `verifyStateUpdated`

## Files

| File | Purpose | Status |
|------|---------|--------|
| `src/commands/hooks.cjs` | CLI handler for `hooks` subcommands | New |
| `src/commands/hooks.test.cjs` | Tests for CLI handler | New |
| `src/hooks/rapid-verify.sh` | Companion Claude Code hook script | New |
| `src/bin/rapid-tools.cjs` | Add `hooks` case to command router | Modify |
| `src/lib/tool-docs.cjs` | Add hook entries to TOOL_REGISTRY and ROLE_TOOL_MAP | Modify |

## Task 1: Implement src/commands/hooks.cjs

**File:** `src/commands/hooks.cjs`

Create the CLI command handler following the exact pattern used by `src/commands/memory.cjs`. Export a single function `handleHooks(cwd, subcommand, args)`.

### Subcommand: `list`

```
hooks list
```

- Call `loadHooksConfig(cwd)` from `src/lib/hooks.cjs`
- Output JSON to stdout: `{ checks: [...] }` where each check has `{ id, enabled }`
- Example output: `{"checks":[{"id":"state-verify","enabled":true},{"id":"artifact-verify","enabled":true},{"id":"commit-verify","enabled":true}]}`

### Subcommand: `run`

```
hooks run [--dry-run]
```

- Parse args with `parseArgs(args, { 'dry-run': 'boolean' })`
- Read return data from stdin as JSON (use `fs.readFileSync('/dev/stdin', 'utf-8')` then `JSON.parse`)
- If stdin is empty or invalid JSON, throw `CliError('hooks run expects RAPID:RETURN JSON on stdin')`
- If `--dry-run`:
  - Load config, list which checks would run, output `{ dryRun: true, enabledChecks: [...ids] }`
  - Do NOT execute any checks
- Otherwise:
  - Call `await runPostTaskHooks(cwd, returnData)`
  - Output the result as JSON to stdout
- Handle errors: wrap in try/catch, throw CliError on failure

### Subcommand: `enable`

```
hooks enable <id>
```

- Get check ID from `args[0]`
- If no ID provided, throw `CliError('Usage: hooks enable <check-id>')`
- Call `loadHooksConfig(cwd)`
- Find the check by `id` in `config.checks`
- If not found, throw `CliError('Unknown check: <id>. Available: state-verify, artifact-verify, commit-verify')`
- Set `check.enabled = true`
- Call `saveHooksConfig(cwd, config)`
- Output JSON: `{ id, enabled: true }`

### Subcommand: `disable`

```
hooks disable <id>
```

- Same as `enable` but sets `check.enabled = false`
- Output JSON: `{ id, enabled: false }`

### Default (unknown subcommand)

- Throw `CliError` with usage message listing all subcommands (follow memory.cjs pattern)

### Imports

```js
const { CliError } = require('../lib/errors.cjs');
const { parseArgs } = require('../lib/args.cjs');
// Lazy-load hooks module inside each case to avoid circular deps:
// const hooks = require('../lib/hooks.cjs');
```

### Module export

```js
module.exports = { handleHooks };
```

**What NOT to do:**
- Do NOT read STATE.json directly -- delegate to hooks.cjs functions
- Do NOT import hooks.cjs at the top level -- lazy-import inside each case (matches existing pattern in misc.cjs and memory.cjs where modules are required inside functions)

**Verification:**
```bash
node -e "const { handleHooks } = require('./src/commands/hooks.cjs'); console.assert(typeof handleHooks === 'function'); console.log('PASS')"
```

## Task 2: Register hooks command in rapid-tools.cjs

**File:** `src/bin/rapid-tools.cjs`

Two modifications:

### 2a. Add import at the top (after the existing handleMerge import)

Add this line in the import block (after line 20 `const { handleMerge } = require('../commands/merge.cjs');`):

```js
const { handleHooks } = require('../commands/hooks.cjs');
```

### 2b. Add switch case in the main router

Add a new case in the `switch (command)` block (before the `default:` case, after the `compact` case around line 257):

```js
case 'hooks':
  await handleHooks(cwd, subcommand, args.slice(2));
  break;
```

### 2c. Add to USAGE string

Add these lines to the USAGE string after the `compact context` entry:

```
  hooks list                     List all verification checks and their status
  hooks run [--dry-run]          Run post-task hooks (reads RAPID:RETURN JSON from stdin)
  hooks enable <id>              Enable a verification check
  hooks disable <id>             Disable a verification check
```

**What NOT to do:**
- Do NOT reorder existing cases
- Do NOT modify any existing case logic
- Do NOT remove any existing imports

**Verification:**
```bash
node ~/Projects/RAPID/src/bin/rapid-tools.cjs hooks list 2>/dev/null || echo "Expected: output or CliError about project root"
node ~/Projects/RAPID/src/bin/rapid-tools.cjs --help 2>&1 | grep -q "hooks" && echo "PASS: hooks in help" || echo "FAIL: hooks not in help"
```

## Task 3: Register hooks in TOOL_REGISTRY and ROLE_TOOL_MAP

**File:** `src/lib/tool-docs.cjs`

### 3a. Add to TOOL_REGISTRY

Add these entries after the `'prereqs-check'` entry (around line 107, before the closing `};`):

```js
// Hooks
'hooks-list':           'hooks list -- List verification checks and status',
'hooks-run':            'hooks run [--dry-run] -- Run post-task verification hooks',
'hooks-enable':         'hooks enable <id:str> -- Enable a verification check',
'hooks-disable':        'hooks disable <id:str> -- Disable a verification check',
```

### 3b. Add to ROLE_TOOL_MAP

Add hooks commands to the `executor` role (since hooks verify executor task output):

In the `'executor'` array, append `'hooks-run', 'hooks-list'`:

```js
'executor': ['state-get', 'state-transition-set', 'verify-light', 'memory-log-decision', 'memory-log-correction', 'hooks-run', 'hooks-list'],
```

Add a `'hooks-manager'` role for the full suite (not strictly required, but keeps it clean):

Do NOT add a new role. Instead, add `'hooks-list', 'hooks-enable', 'hooks-disable'` to the existing `'verifier'` role:

```js
'verifier': ['state-get', 'verify-light', 'verify-heavy', 'hooks-list', 'hooks-enable', 'hooks-disable'],
```

**What NOT to do:**
- Do NOT remove existing entries
- Do NOT reorder existing entries
- Do NOT create a new role just for hooks (use existing roles)

**Verification:**
```bash
node -e "const { TOOL_REGISTRY, ROLE_TOOL_MAP } = require('./src/lib/tool-docs.cjs'); console.assert(TOOL_REGISTRY['hooks-list']); console.assert(TOOL_REGISTRY['hooks-run']); console.assert(ROLE_TOOL_MAP['executor'].includes('hooks-run')); console.assert(ROLE_TOOL_MAP['verifier'].includes('hooks-list')); console.log('PASS')"
```

## Task 4: Create companion shell script src/hooks/rapid-verify.sh

**File:** `src/hooks/rapid-verify.sh`

Create a companion hook script for Claude Code integration. This script is separate from `rapid-task-completed.sh` (which handles task tracking). This one runs the hooks verification system.

```bash
#!/bin/bash
# rapid-verify.sh -- Post-task hook that runs RAPID verification checks
# Companion to rapid-task-completed.sh. Invokes the hooks system via rapid-tools CLI.
# Non-blocking: exits 0 even if verification finds issues (warnings only).

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract team name to filter RAPID tasks only
TEAM=$(echo "$INPUT" | jq -r '.team_name // "unknown"')

# Only process RAPID team tasks
if echo "$TEAM" | grep -q "^rapid-wave-"; then
  # Find rapid-tools.cjs
  RAPID_TOOLS="${RAPID_TOOLS:-}"
  if [ -z "$RAPID_TOOLS" ]; then
    # Try common locations
    if [ -f "$HOME/.claude/plugins/cache/joey-plugins/rapid/*/src/bin/rapid-tools.cjs" ]; then
      RAPID_TOOLS=$(ls -1 "$HOME/.claude/plugins/cache/joey-plugins/rapid"/*/src/bin/rapid-tools.cjs 2>/dev/null | tail -1)
    fi
  fi

  if [ -n "$RAPID_TOOLS" ] && [ -f "$RAPID_TOOLS" ]; then
    # Extract the task output for RAPID:RETURN parsing
    TASK_OUTPUT=$(echo "$INPUT" | jq -r '.task_output // ""')

    if echo "$TASK_OUTPUT" | grep -q "RAPID:RETURN"; then
      # Parse the return data and feed to hooks runner
      RETURN_JSON=$(echo "$TASK_OUTPUT" | node -e "
        const { parseReturn } = require('$(dirname "$RAPID_TOOLS")/../lib/returns.cjs');
        let input = '';
        process.stdin.on('data', d => input += d);
        process.stdin.on('end', () => {
          const result = parseReturn(input);
          if (result.parsed) {
            process.stdout.write(JSON.stringify(result.data));
          }
        });
      " 2>/dev/null)

      if [ -n "$RETURN_JSON" ]; then
        # Run hooks -- capture output but never fail
        echo "$RETURN_JSON" | node "$RAPID_TOOLS" hooks run 2>/dev/null || true
      fi
    fi
  fi
fi

# Always exit 0 -- hooks are non-blocking
exit 0
```

Make the script executable.

**What NOT to do:**
- Do NOT modify `rapid-task-completed.sh` (that handles task tracking, this handles verification)
- Do NOT make the script exit non-zero on verification failures (non-blocking invariant)

**Verification:**
```bash
test -x src/hooks/rapid-verify.sh && echo "PASS: executable" || echo "FAIL: not executable"
head -1 src/hooks/rapid-verify.sh | grep -q "#!/bin/bash" && echo "PASS: shebang" || echo "FAIL: no shebang"
```

## Task 5: Write CLI tests -- src/commands/hooks.test.cjs

**File:** `src/commands/hooks.test.cjs`

Use `node:test` + `node:assert/strict`. Follow the patterns from `compact.test.cjs`.

### Test structure

```
describe('handleHooks')
  describe('list subcommand')
    it('outputs default config when no hooks-config.json exists')
    it('outputs config from disk when file exists')

  describe('enable subcommand')
    it('enables a check and writes config')
    it('throws CliError for unknown check id')
    it('throws CliError when no id provided')

  describe('disable subcommand')
    it('disables a check and writes config')
    it('throws CliError for unknown check id')

  describe('run subcommand')
    it('throws CliError when stdin is empty') -- may need to mock stdin
    it('runs hooks and outputs JSON result')

  describe('unknown subcommand')
    it('throws CliError with usage message')
```

### Test helpers

- `createTempProject()`: Create temp dir with `.planning/` structure
- `captureStdout(fn)`: Capture stdout (same as compact.test.cjs)
- For stdin mocking in `run` tests, create a temp file with return data and use the library function directly rather than stdin

**What NOT to do:**
- Do NOT test the shell script in Node tests (it requires bash)
- Do NOT test hooks.cjs internals here (those are covered in Wave 1 tests)

**Verification:**
```bash
node --test src/commands/hooks.test.cjs
```

## Success Criteria

1. `node ~/Projects/RAPID/src/bin/rapid-tools.cjs hooks list` outputs JSON with 3 checks
2. `node ~/Projects/RAPID/src/bin/rapid-tools.cjs --help` includes hooks commands
3. `node --test src/commands/hooks.test.cjs` -- all tests pass
4. `src/hooks/rapid-verify.sh` is executable and has correct shebang
5. TOOL_REGISTRY contains `hooks-list`, `hooks-run`, `hooks-enable`, `hooks-disable`
6. ROLE_TOOL_MAP `executor` role includes `hooks-run`
7. ROLE_TOOL_MAP `verifier` role includes `hooks-list`, `hooks-enable`, `hooks-disable`
8. No existing tests broken: `node --test src/lib/hooks.test.cjs && node --test src/commands/hooks.test.cjs`
