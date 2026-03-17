# Stack Research: hooks-system

## Core Stack Assessment

### Node.js Runtime
- **Detected version:** v25.8.0 (current environment)
- **Project target:** No `.nvmrc` or `engines` field; runs on whatever the user has
- **Relevant features:** Built-in `node:test` runner used for all tests (no external test framework). Built-in `node:assert/strict` for assertions. `node --test 'src/**/*.test.cjs'` glob-based discovery via npm test script.
- **Limitation:** The project uses CommonJS (`.cjs` files) exclusively, not ESM. All new files must follow this convention (`'use strict'` + `require()`/`module.exports`).

### Language: JavaScript (CommonJS)
- **No TypeScript** -- the entire codebase is plain JS `.cjs` files
- **JSDoc for type annotations** -- functions document params/returns via JSDoc comments
- **Zod for runtime validation** -- used for schemas instead of TypeScript types (e.g., `ProjectState`, `SetStatus`, `ReturnSchemas`)

## Dependency Health

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| zod | 3.25.76 | ~3.25.x | Active | Used for state schemas and return validation. No breaking changes expected. |
| proper-lockfile | 4.1.2 | 4.1.2 | Stable | mkdir-based file locking. Mature, no recent updates needed. |
| ajv | 8.18.0 | 8.18.x | Active | JSON Schema validator. Not directly relevant to hooks-system. |
| ajv-formats | 3.0.1 | 3.0.1 | Stable | AJV format extensions. Not relevant to hooks-system. |

**No new dependencies required for hooks-system.** The set uses only existing project dependencies (zod, fs, path, child_process) and Node.js built-ins.

## Compatibility Matrix

No compatibility issues identified for hooks-system. The set:
- Uses only existing internal APIs (`readState`, `parseReturn`, `validateReturn`, `findProjectRoot`)
- Requires no new npm packages
- Uses `node:test` and `node:assert/strict` (both built-in, consistent with project convention)
- All files are CommonJS (`.cjs`), consistent with codebase

## Integration Points Analysis

### 1. `src/lib/state-machine.cjs` -- readState() (Lock-Free Read)

**Critical finding:** `readState()` (line 47-67) is an async function that reads STATE.json WITHOUT acquiring any lock. It uses `fs.readFileSync` for the actual read (synchronous I/O inside an async function). This is the designated read-only path that hooks must use.

The function returns:
- `null` -- if STATE.json does not exist
- `{ valid: true, state: <parsed> }` -- if valid
- `{ valid: false, errors: <zodIssues> }` -- if invalid JSON or schema validation fails

**Key detail:** The state object uses `.passthrough()` on all Zod schemas, meaning extra fields are preserved. The hooks module should not rely on the absence of unknown fields.

**State hierarchy for verification:**
```
ProjectState -> milestones[] -> MilestoneState
  -> sets[] -> SetState { id, status, waves[] }
    -> WaveState { id, status, jobs[] }
      -> JobState { id, status }
```

Valid set statuses: `pending | discussed | planned | executed | complete | merged`
Valid wave/job statuses: `pending | executing | complete`

### 2. `src/lib/returns.cjs` -- parseReturn() and validateReturn()

**parseReturn(agentOutput)** extracts JSON from `<!-- RAPID:RETURN {...} -->` markers. Returns `{ parsed: boolean, data?: object, error?: string }`.

**validateReturn(data)** checks structural validity for status-specific required fields:
- COMPLETE requires: `artifacts` (array), `tasks_completed` (number), `tasks_total` (number)
- CHECKPOINT requires: `handoff_done`, `handoff_remaining`, `handoff_resume` (all strings)
- BLOCKED requires: `blocker_category` (enum), `blocker` (string), `resolution` (string)

**validateHandoff(agentOutput)** -- combines parse + Zod validation. Returns `{ valid, data }` or `{ valid: false, error }`.

The hooks module should accept already-parsed return data (the `data` field after parsing), not raw agent output, to avoid re-parsing.

### 3. `src/lib/verify.cjs` -- Existing Verification

**Important overlap:** `verify.cjs` already provides:
- `verifyLight(artifacts, commits)` -- checks file existence + git commit hash validity
- `verifyHeavy(artifacts, testCommand)` -- adds test execution + stub content detection

The state verification hook should reuse `verifyLight()` for artifact and commit checking rather than reimplementing these checks. This avoids duplication and ensures consistent behavior.

### 4. `src/lib/state-machine.cjs` -- validateDiskArtifacts()

**Another overlap:** `validateDiskArtifacts(cwd, milestoneId, setId)` already checks:
- CONTEXT.md existence for sets in `planned`/`executed`/`complete`/`merged` status
- Wave plan directories for sets in `executed`/`complete`/`merged` status

The state verification hook performs a different kind of verification (cross-checking RAPID:RETURN data against STATE.json), but should be aware of this existing function to avoid confusion. The hooks system verifies *agent-reported data matches state*, while `validateDiskArtifacts` verifies *disk layout matches state*.

### 5. `src/hooks/rapid-task-completed.sh` -- Existing Shell Hook

**Current behavior:**
- Reads hook input from stdin as JSON (fields: `task_id`, `task_subject`, `teammate_name`, `team_name`)
- Only processes tasks from teams matching `rapid-wave-*` pattern
- Writes JSONL records to `.planning/teams/{team}-completions.jsonl`
- Always exits 0 (non-blocking)

**CONTEXT.md decision:** Build on Claude Code's native hook system, using this script as the integration point. Two options:
1. Extend `rapid-task-completed.sh` to call a Node.js verification script
2. Add a companion hook script alongside it

Option 2 (companion script) is cleaner -- keeps team tracking separate from state verification, maintains backward compatibility, and avoids shell-to-Node bridging complexity within a single script.

### 6. `src/bin/rapid-tools.cjs` -- CLI Router

**Command registration pattern:**
1. Import handler at top: `const { handleHooks } = require('../commands/hooks.cjs');`
2. Add `case 'hooks':` to the switch statement (line 186-263)
3. Call handler: `await handleHooks(cwd, subcommand, args.slice(2));`
4. Add usage description to USAGE string

The command falls under "commands that need project root" (requires `findProjectRoot()`).

### 7. `src/lib/tool-docs.cjs` -- TOOL_REGISTRY and ROLE_TOOL_MAP

**Registration pattern:**
```javascript
// In TOOL_REGISTRY:
'hooks-run':     'hooks run [--dry-run] -- Run post-task hooks',
'hooks-list':    'hooks list -- List registered hooks',
'hooks-enable':  'hooks enable <id:str> -- Enable a hook',
'hooks-disable': 'hooks disable <id:str> -- Disable a hook',

// In ROLE_TOOL_MAP (add to relevant roles):
'executor': [...existing, 'hooks-run'],
```

### 8. `src/lib/args.cjs` -- parseArgs()

The CLI argument parser supports:
- `'string'` -- flag that consumes next token as value
- `'boolean'` -- flag presence means true
- `'multi:N'` -- consumes N tokens as array

Schema is declared inline: `const { flags } = parseArgs(args, { 'dry-run': 'boolean', id: 'string' });`

### 9. `src/lib/errors.cjs` -- CliError

All command handlers throw `CliError` for user-facing errors. The router catches these and calls `exitWithError()` which writes JSON to stdout and human message to stderr.

## Test Conventions

Tests use Node.js built-in `node:test` with `node:assert/strict`:

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
```

**Key patterns observed across test files:**
- Temp directory creation: `fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-<module>-test-'))`
- Cleanup in afterEach: `fs.rmSync(tmpDir, { recursive: true, force: true })`
- `.planning/` directory created inside tmpDir for tests needing project root
- Tests are co-located: `src/lib/hooks.test.cjs` alongside `src/lib/hooks.cjs`
- Command tests in `src/commands/commands.test.cjs` (single file for all commands)
- JSON output assertions: parse stdout output and assert structure
- Run via: `node --test 'src/**/*.test.cjs'`

**Behavioral invariant tests (required by CONTRACT.json):**
1. **readOnlyStateAccess** -- verify hooks never call `writeState()`, `acquireLock()`, or `withStateTransaction()`
2. **nonBlocking** -- verify hook failures return result objects (never throw/reject in a way that halts the pipeline)
3. **idempotent** -- verify calling verification twice with same inputs produces identical outputs

## Hook Configuration Design

**CONTEXT.md decision: No separate hooks.json registry.** Instead, a RAPID verification config file.

Based on the codebase patterns, the config should:
- Live at `.planning/hooks-config.json` (within the planning directory, consistent with STATE.json location)
- Use a simple schema:

```json
{
  "version": 1,
  "checks": [
    { "id": "state-verify", "enabled": true },
    { "id": "artifact-verify", "enabled": true },
    { "id": "commit-verify", "enabled": true }
  ]
}
```

This differs from CONTRACT.json's `hooks/hooks.json` spec (which references `{ id, type, script, enabled }`). The CONTEXT.md explicitly overrides this: "No separate hooks.json registry... use a RAPID verification config file." Since CONTEXT.md decisions take precedence over the original CONTRACT.json spec, the implementation should use the simpler config approach.

**Note:** The CONTRACT.json export signature for `hooksConfig` references `hooks/hooks.json`, but the CONTEXT.md explicitly says "No separate hooks.json registry." The implementation should reconcile this by using the CONTEXT.md decision (simpler config file) while still exporting a `loadHooksConfig()` / `saveHooksConfig()` API that the CLI commands use.

## File Organization

Based on codebase conventions:

| File | Purpose |
|------|---------|
| `src/lib/hooks.cjs` | Core module: config loading, verification runner, result aggregation |
| `src/lib/hooks.test.cjs` | Unit tests for hooks module |
| `src/commands/hooks.cjs` | CLI handler for `hooks run/list/enable/disable` |
| `src/bin/rapid-tools.cjs` | Modified: add `hooks` command case |
| `src/lib/tool-docs.cjs` | Modified: add TOOL_REGISTRY and ROLE_TOOL_MAP entries |

The CONTEXT.md leaves open whether to use `src/lib/hooks/state-verify.cjs` (subdirectory) or a single `src/lib/hooks.cjs`. Given the decision for "built-in checks only" and keeping things simple, a single `src/lib/hooks.cjs` file containing all verification logic is cleaner and matches the flat structure of the rest of `src/lib/`.

## Stack Risks

1. **Race condition on state reads:** Hooks read STATE.json without locks, so a concurrent `writeState()` could produce a torn read. **Impact:** Low -- `readFileSync` is atomic for reasonable file sizes; JSON parse would fail on corruption, and hooks are advisory only.

2. **Shell-to-Node bridging:** If the hook fires via a bash script that calls `node`, there is startup latency (~100-300ms for Node process). **Impact:** Low -- hooks run after task completion, not in the critical path.

3. **Config file location ambiguity:** CONTRACT.json says `hooks/hooks.json` at project root; CONTEXT.md says within `.planning/` or `src/hooks/`. **Impact:** Must be resolved at implementation time. **Recommendation:** Use `.planning/hooks-config.json` since it keeps all RAPID project state in `.planning/`.

## Recommendations

1. **Reuse `verifyLight()` from `verify.cjs`** for artifact existence and commit hash checks rather than reimplementing. Priority: high.

2. **Single `src/lib/hooks.cjs` module** rather than a subdirectory structure. The "built-in checks only" decision means there is no need for a plugin-style directory layout. Priority: high.

3. **Config at `.planning/hooks-config.json`** to keep all project state co-located. Include in `.gitignore` only if per-user preferences differ (unlikely -- recommend committing). Priority: medium.

4. **Companion hook script** (`src/hooks/rapid-verify.sh` or similar) rather than modifying `rapid-task-completed.sh`. Keeps team tracking and state verification as separate concerns. Priority: medium.

5. **Do not use `acquireLock()` from hooks** -- behavioral contract requires read-only access. This is already enforced by using `readState()` directly rather than `withStateTransaction()`. Priority: critical (behavioral contract).
