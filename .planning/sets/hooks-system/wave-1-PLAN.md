# Wave 1: Hook Engine and Verification Checks

## Objective

Build the complete hook system core: config schema, runner engine, and all three built-in verification checks (state, artifacts, commits). After this wave, `runPostTaskHooks()` and `verifyStateUpdated()` are fully functional and tested, including the three CONTRACT.json behavioral invariants (readOnlyStateAccess, nonBlocking, idempotent).

## Files (all new)

| File | Purpose |
|------|---------|
| `src/lib/hooks.cjs` | Config loading, verification runner, all 3 built-in checks, result aggregation |
| `src/lib/hooks.test.cjs` | Unit tests for hooks module |
| `.planning/hooks-config.json` | Default verification config (created during init, but shipped as template) |

## Task 1: Create the hooks-config.json schema and default file

**File:** `.planning/hooks-config.json`

Create the default verification config file at `.planning/hooks-config.json`. This file controls which built-in checks are active.

**Schema:**
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

**Implementation details:**
- The file lives in `.planning/` because it is project-specific state, not source code
- Three built-in check IDs: `state-verify`, `artifact-verify`, `commit-verify`
- All enabled by default
- `version: 1` for future schema evolution
- This is NOT a hook registry -- it is a toggle config for built-in checks

**What NOT to do:**
- Do NOT create a `hooks/hooks.json` at the project root (CONTEXT.md overrides CONTRACT.json on this)
- Do NOT add custom hook support -- built-in checks only

**Verification:**
```bash
node -e "const c = require('./.planning/hooks-config.json'); console.assert(c.version === 1); console.assert(c.checks.length === 3); console.assert(c.checks.every(ch => typeof ch.id === 'string' && typeof ch.enabled === 'boolean')); console.log('PASS')"
```

## Task 2: Implement src/lib/hooks.cjs -- config loading and check runner

**File:** `src/lib/hooks.cjs`

Implement the core hooks module with these exports:

### 2a. Config loading

```
loadHooksConfig(cwd: string): { version: number, checks: Array<{id: string, enabled: boolean}> }
```

- Read `.planning/hooks-config.json` from `cwd`
- If file does not exist, return a default config with all 3 checks enabled (same as the template)
- Validate with a Zod schema: `version` must be a number, `checks` must be an array of `{id: string, enabled: boolean}` objects
- Throw `Error` with descriptive message if JSON is malformed or schema fails

```
saveHooksConfig(cwd: string, config: object): void
```

- Write the config object to `.planning/hooks-config.json` with `JSON.stringify(config, null, 2)`
- Used by the CLI enable/disable commands (Wave 2)

### 2b. Built-in check: state-verify

```
checkStateConsistency(cwd: string, returnData: object): { id: 'state-verify', passed: boolean, issues: Array<{type: string, message: string}> }
```

- Use `readState(cwd)` from `state-machine.cjs` (the lock-free read path, line 47-67)
- If `readState` returns null (no STATE.json), return `{ id: 'state-verify', passed: true, issues: [] }` -- no state to verify against
- If `readState` returns `{ valid: false }`, return a single issue: `{ type: 'error', message: 'STATE.json is invalid or corrupt' }`
- For a valid state, perform these consistency checks against `returnData`:
  1. **Status field present:** `returnData.status` must be one of `COMPLETE`, `CHECKPOINT`, `BLOCKED`
  2. **tasks_completed/tasks_total consistency:** If both are numbers, `tasks_completed <= tasks_total`
  3. **COMPLETE status cross-check:** If `returnData.status === 'COMPLETE'`, check that `returnData.tasks_completed === returnData.tasks_total`
- Each failed check produces an issue `{ type: 'warning', message: '...' }`
- Return `{ id: 'state-verify', passed: issues.length === 0, issues }`

**Import:** `const { readState } = require('./state-machine.cjs');`

**Critical behavioral constraint:** This function must NEVER call `writeState`, `withStateTransaction`, `acquireLock`, or any other write/lock function. It reads state only via `readState()`. Test this invariant explicitly.

### 2c. Built-in check: artifact-verify

```
checkArtifacts(cwd: string, returnData: object): { id: 'artifact-verify', passed: boolean, issues: Array<{type: string, message: string}> }
```

- If `returnData.artifacts` is not an array or is empty, return `{ id: 'artifact-verify', passed: true, issues: [] }` -- nothing to verify
- Use `verifyLight(artifacts, [])` from `verify.cjs` to check file existence
- For each item in `results.failed`, produce an issue: `{ type: 'warning', message: 'Artifact not found: <path>' }`
- Resolve artifact paths relative to `cwd` using `path.resolve(cwd, artifact)` before checking

**Import:** `const { verifyLight } = require('./verify.cjs');`

### 2d. Built-in check: commit-verify

```
checkCommits(cwd: string, returnData: object): { id: 'commit-verify', passed: boolean, issues: Array<{type: string, message: string}> }
```

- If `returnData.commits` is not an array or is empty, return `{ id: 'commit-verify', passed: true, issues: [] }` -- nothing to verify
- Use `verifyLight([], commits)` from `verify.cjs` to check commit hashes in git log
- For each item in `results.failed`, produce an issue: `{ type: 'warning', message: 'Commit not found in git log: <hash>' }`

**Import:** `const { verifyLight } = require('./verify.cjs');`

### 2e. Runner: runPostTaskHooks

```
runPostTaskHooks(cwd: string, returnData: object): { passed: boolean, issues: Array<{check: string, type: string, message: string}>, remediation?: string }
```

- Load config via `loadHooksConfig(cwd)`
- Build a map of check ID to check function: `{ 'state-verify': checkStateConsistency, 'artifact-verify': checkArtifacts, 'commit-verify': checkCommits }`
- For each enabled check in config, call the check function with `(cwd, returnData)`
- If a check function throws, catch the error and produce an issue `{ check: id, type: 'error', message: 'Check threw: <err.message>' }` -- never propagate exceptions (non-blocking invariant)
- Aggregate all issues, prefixing each with `check: id`
- Set `passed = true` if no issues exist
- If there are issues, generate a `remediation` string: a bullet list of the issues formatted as `- [check-id] message`
- Return `{ passed, issues, remediation }`

### 2f. Convenience: verifyStateUpdated

```
verifyStateUpdated(cwd: string, returnData: object): { stateConsistent: boolean, missingTransitions: string[] }
```

- Call `checkStateConsistency(cwd, returnData)` directly
- Map result: `stateConsistent = result.passed`, `missingTransitions = result.issues.map(i => i.message)`
- This is the CONTRACT.json `stateVerificationHook` export, callable independently from the hook framework

### Module exports

```js
module.exports = {
  loadHooksConfig,
  saveHooksConfig,
  checkStateConsistency,
  checkArtifacts,
  checkCommits,
  runPostTaskHooks,
  verifyStateUpdated,
};
```

**What NOT to do:**
- Do NOT import from `execute.cjs`, `plan.cjs`, or any orchestration module (circular dependency risk)
- Do NOT acquire any write locks
- Do NOT modify STATE.json or any project files
- Do NOT make checks async unless absolutely necessary (prefer sync for simplicity; `readState` is async so the state check must be async, which means `runPostTaskHooks` must be async too)
- Note: Since `readState()` is async, `checkStateConsistency` must be async, `runPostTaskHooks` must be async, and `verifyStateUpdated` must be async

**Verification:**
```bash
node -e "const h = require('./src/lib/hooks.cjs'); console.assert(typeof h.runPostTaskHooks === 'function'); console.assert(typeof h.verifyStateUpdated === 'function'); console.assert(typeof h.loadHooksConfig === 'function'); console.log('PASS')"
```

## Task 3: Write unit tests -- src/lib/hooks.test.cjs

**File:** `src/lib/hooks.test.cjs`

Use `node:test` + `node:assert/strict`. Create temp directories for isolation. Follow existing test patterns from `commands.test.cjs` and `compact.test.cjs`.

### Test structure

```
describe('hooks module')
  describe('loadHooksConfig')
    it('returns default config when file does not exist')
    it('loads valid config from disk')
    it('throws on malformed JSON')
    it('throws on invalid schema (missing version)')

  describe('saveHooksConfig')
    it('writes config to disk')
    it('saved config can be loaded back')

  describe('checkStateConsistency')
    it('returns passed when no STATE.json exists')
    it('returns issue when STATE.json is invalid')
    it('returns passed for valid COMPLETE return with matching task counts')
    it('returns issue when tasks_completed > tasks_total')
    it('returns issue when COMPLETE but tasks_completed != tasks_total')

  describe('checkArtifacts')
    it('returns passed when no artifacts in return data')
    it('returns passed when all artifacts exist')
    it('returns issues for missing artifacts')

  describe('checkCommits')
    it('returns passed when no commits in return data')
    -- (commit checks require git, test with mocking or skip in CI)

  describe('runPostTaskHooks')
    it('runs all enabled checks and aggregates results')
    it('skips disabled checks')
    it('catches check errors without propagating (non-blocking)')
    it('generates remediation string when issues found')
    it('returns passed:true when all checks pass')

  describe('verifyStateUpdated')
    it('returns stateConsistent true when state is valid')
    it('returns missingTransitions array for issues')

  describe('CONTRACT.json behavioral invariants')
    it('readOnlyStateAccess: hooks never call writeState or acquireLock')
      -- Verify by checking that the module source does not contain
      -- 'writeState', 'acquireLock', or 'withStateTransaction' calls
      -- (static analysis approach: read the file and check)
    it('nonBlocking: runPostTaskHooks never throws, even with broken checks')
      -- Pass a returnData that would cause a check to throw internally
      -- Verify the runner catches it and returns an issue instead
    it('idempotent: running hooks twice with same input produces same output')
      -- Call runPostTaskHooks twice with identical inputs
      -- Assert deep equality of results
```

### Test helpers needed

- `createTempProject(stateData?)`: Create a temp directory with `.planning/` structure and optional STATE.json
- `captureStdout(fn)`: Capture stdout during async function execution (copy from compact.test.cjs)

**What NOT to do:**
- Do NOT test the CLI commands (that is Wave 2)
- Do NOT test the shell script (that is Wave 2)
- Do NOT use `sinon` or external mocking libraries -- use temp directories and real files

**Verification:**
```bash
node --test src/lib/hooks.test.cjs
```

## Success Criteria

1. `node -e "require('./src/lib/hooks.cjs')"` loads without error
2. `node --test src/lib/hooks.test.cjs` -- all tests pass
3. `.planning/hooks-config.json` exists with valid schema
4. `runPostTaskHooks()` never throws (always returns a result object)
5. `verifyStateUpdated()` returns `{ stateConsistent, missingTransitions }` matching CONTRACT.json signature
6. No write calls to STATE.json from hooks module (verified by test)
7. Idempotent: same input, same output (verified by test)
