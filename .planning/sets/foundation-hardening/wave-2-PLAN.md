# PLAN: foundation-hardening / Wave 2 -- Atomic Writes, Version Sync, npm test

## Objective

Make `writeRegistry()` in `worktree.cjs` use atomic tmp+rename writes (mirroring `writeState()`). Synchronize version numbers across `package.json` and `plugin.json`. Add an `npm test` script. Write a version sync test to prevent future drift.

## File Ownership

| File | Action |
|------|--------|
| `src/lib/worktree.cjs` | Modify |
| `src/lib/worktree.test.cjs` | Modify |
| `src/lib/version.test.cjs` | Modify |
| `package.json` | Modify |
| `.claude-plugin/plugin.json` | Modify |

## Tasks

### Task 1: Make `writeRegistry()` use atomic tmp+rename pattern

**File:** `src/lib/worktree.cjs`

**Actions:**

Replace the `writeRegistry` function (lines 225-233) with an atomic version that mirrors the pattern used in `writeState()` at `state-machine.cjs` lines 82-85.

Current implementation:
```js
function writeRegistry(cwd, registry) {
  const regDir = path.join(cwd, REGISTRY_DIR);
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(
    path.join(regDir, REGISTRY_FILE),
    JSON.stringify(registry, null, 2) + '\n',
    'utf-8'
  );
}
```

New implementation:
```js
function writeRegistry(cwd, registry) {
  const regDir = path.join(cwd, REGISTRY_DIR);
  fs.mkdirSync(regDir, { recursive: true });
  const regFile = path.join(regDir, REGISTRY_FILE);
  const tmpFile = regFile + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpFile, regFile);
}
```

The key change: write to `REGISTRY.json.tmp` first, then atomically rename to `REGISTRY.json`. This prevents corruption if the process is killed mid-write.

**What NOT to do:**
- Do NOT change the function signature or parameters
- Do NOT change the `mkdirSync` call -- it is still needed
- Do NOT change the JSON formatting (keep `null, 2` and trailing newline)
- Do NOT modify `registryUpdate()` or `reconcileRegistry()` -- they call `writeRegistry()` internally and will automatically benefit

### Task 2: Add atomic write test for `writeRegistry`

**File:** `src/lib/worktree.test.cjs`

**Actions:**

Add a new `describe('writeRegistry atomic writes')` block. The test should verify that `writeRegistry` uses atomic write by checking that:

1. **No `.tmp` file is left behind after successful write:**
   - Create a temp directory with the `.planning/worktrees/` structure
   - Call `writeRegistry(tmpDir, { version: 1, worktrees: {} })`
   - Assert `REGISTRY.json` exists
   - Assert `REGISTRY.json.tmp` does NOT exist
   - Assert the content of `REGISTRY.json` matches the input

2. **Content integrity:**
   - Write a registry object with `{ version: 1, worktrees: { 'test-set': { setName: 'test-set', branch: 'rapid/test-set' } } }`
   - Read back `REGISTRY.json` and parse it
   - Assert the content matches exactly

Note: The `writeRegistry` function is not currently exported from `worktree.cjs`. You will need to check if it is accessible. If it is only called internally by `registryUpdate` and `reconcileRegistry`, test the atomic behavior indirectly through `registryUpdate` OR add `writeRegistry` to the module exports.

**Decision: Export `writeRegistry` from `worktree.cjs`** -- add it to the `module.exports` object at the bottom of the file. This is needed for direct testing and aligns with CONTRACT.json which lists `atomicWriteRegistry` as an export.

### Task 3: Sync version in `package.json` to 3.2.0

**File:** `package.json`

**Actions:**

Change the `version` field from `"3.0.0"` to `"3.2.0"`. The canonical version is 3.2.0 as reflected in `plugin.json`.

Before:
```json
"version": "3.0.0",
```

After:
```json
"version": "3.2.0",
```

No other fields in `package.json` should be changed.

### Task 4: Verify `plugin.json` version matches

**File:** `.claude-plugin/plugin.json`

**Actions:**

Verify that `plugin.json` has `"version": "3.2.0"`. It currently does (confirmed during research). No change needed unless it has drifted.

This is a verification-only task. If the version is already `3.2.0`, no edit is required.

### Task 5: Add `npm test` script to `package.json`

**File:** `package.json`

**Actions:**

Add a `scripts` section with a `test` command:

```json
{
  "name": "rapid",
  "version": "3.2.0",
  "description": "RAPID - Multi-agent orchestration plugin for Claude Code",
  "private": true,
  "scripts": {
    "test": "node --test 'src/**/*.test.cjs'"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "proper-lockfile": "^4.1.2",
    "zod": "^3.25.76"
  }
}
```

The glob `'src/**/*.test.cjs'` (with single quotes to prevent shell expansion) will discover all test files recursively. This matches the 27+ existing test files.

**What NOT to do:**
- Do NOT add `--experimental-test-coverage` or other flags -- keep it minimal
- Do NOT change any existing fields in `package.json` beyond adding `scripts.test` and updating `version`
- Do NOT use `npx` or any test runner -- use Node.js built-in `node --test`

### Task 6: Add version sync test to `version.test.cjs`

**File:** `src/lib/version.test.cjs`

**Actions:**

Add a new `describe('version sync')` block with tests:

1. **`package.json` and `plugin.json` have the same version:**
   ```js
   it('package.json and plugin.json versions match', () => {
     const pkgPath = path.resolve(__dirname, '../../package.json');
     const pluginPath = path.resolve(__dirname, '../../.claude-plugin/plugin.json');
     const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
     const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
     assert.equal(pkg.version, plugin.version,
       `package.json version (${pkg.version}) !== plugin.json version (${plugin.version})`);
   });
   ```

2. **`getVersion()` returns the same version as `plugin.json`:**
   ```js
   it('getVersion() matches plugin.json version', () => {
     const pluginPath = path.resolve(__dirname, '../../.claude-plugin/plugin.json');
     const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
     assert.equal(getVersion(), plugin.version);
   });
   ```

These tests act as a regression guard -- if anyone bumps one file without the other, CI will catch it.

## Verification

```bash
# Run worktree tests (includes new atomic write test)
node --test src/lib/worktree.test.cjs

# Run version tests (includes new sync test)
node --test src/lib/version.test.cjs

# Verify npm test script works
npm test

# Verify versions match
node -e "
const pkg = require('./package.json');
const plugin = require('./.claude-plugin/plugin.json');
if (pkg.version !== plugin.version) {
  console.error('FAIL: version mismatch', pkg.version, '!=', plugin.version);
  process.exit(1);
}
console.log('OK: versions in sync at', pkg.version);
"
```

## Success Criteria

- [ ] `writeRegistry()` uses atomic tmp+rename pattern (write to `.tmp`, then `renameSync`)
- [ ] No `.tmp` file remains after successful `writeRegistry()` call
- [ ] `writeRegistry` is exported from `worktree.cjs` for direct testing
- [ ] `package.json` version is `3.2.0`
- [ ] `plugin.json` version is `3.2.0`
- [ ] `package.json` has `scripts.test` set to `node --test 'src/**/*.test.cjs'`
- [ ] `npm test` runs all test files and exits successfully
- [ ] Version sync test asserts `package.json` and `plugin.json` versions match
- [ ] Version sync test asserts `getVersion()` returns the same value as `plugin.json`
- [ ] All existing worktree tests still pass
- [ ] All existing version tests still pass
