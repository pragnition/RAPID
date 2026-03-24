# PLAN: path-and-dag / Wave 1

**Objective:** Extract the canonical `resolveProjectRoot()` into `core.cjs`, add the `DAG_SUBPATH` constant and `ensureDagExists()` guard, create a deprecation wrapper for `findProjectRoot()`, and write comprehensive tests for all new functionality.

This wave establishes the foundation. Wave 2 propagates these exports to all consumers.

---

## Task 1: Add `resolveProjectRoot()` to core.cjs

**File:** `src/lib/core.cjs`

**Action:**
1. Add `const { execSync } = require('child_process');` to the imports at the top of the file (after line 4).
2. Add a new function `resolveProjectRoot(cwd)` ABOVE the existing `findProjectRoot()` (before line 22). Port the implementation character-for-character from `src/lib/plan.cjs` lines 39-75. The function:
   - Calls `git rev-parse --path-format=absolute --git-common-dir` with `{ cwd: cwd || process.cwd(), encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }`
   - Strips `/.git` suffix to derive project root
   - Validates `.planning/sets/` exists at the resolved root
   - Falls back to `cwd || process.cwd()` on any failure
3. Export `resolveProjectRoot` in `module.exports`.

**What NOT to do:**
- Do NOT remove `findProjectRoot` yet -- that happens in the same task below.
- Do NOT change the `resolveProjectRoot` logic from plan.cjs. Port it exactly.

**Verification:**
```bash
node -e "const c = require('./src/lib/core.cjs'); console.log(typeof c.resolveProjectRoot)"
# Should print: function
```

---

## Task 2: Add `DAG_SUBPATH` constant to core.cjs

**File:** `src/lib/core.cjs`

**Action:**
1. Add a module-level constant after the imports:
   ```
   const DAG_SUBPATH = path.join('.planning', 'sets', 'DAG.json');
   ```
2. Export `DAG_SUBPATH` in `module.exports`.

**Verification:**
```bash
node -e "const c = require('./src/lib/core.cjs'); console.log(c.DAG_SUBPATH)"
# Should print: .planning/sets/DAG.json
```

---

## Task 3: Add `ensureDagExists()` to core.cjs

**File:** `src/lib/core.cjs`

**Action:**
1. Add a new function `ensureDagExists(projectRoot)` that:
   - Constructs the full path: `path.join(projectRoot, DAG_SUBPATH)`
   - Checks `fs.existsSync(fullPath)`
   - If missing, throws: `new Error('DAG.json not found at ' + fullPath + '. Run "dag generate" or /rapid:plan-set to create it.')`
   - If present, returns the full path (convenience for callers)
2. Export `ensureDagExists` in `module.exports`.

**Verification:**
```bash
node -e "const c = require('./src/lib/core.cjs'); try { c.ensureDagExists('/tmp/nonexistent'); } catch(e) { console.log(e.message); }"
# Should print error message mentioning DAG.json not found
```

---

## Task 4: Convert `findProjectRoot()` to deprecation wrapper

**File:** `src/lib/core.cjs`

**Action:**
1. Replace the body of `findProjectRoot(startDir)` with:
   ```javascript
   function findProjectRoot(startDir) {
     console.warn('[RAPID DEPRECATION] findProjectRoot() is deprecated, use resolveProjectRoot() from core.cjs');
     return resolveProjectRoot(startDir);
   }
   ```
2. Keep `findProjectRoot` in `module.exports` (backward compatibility).

**What NOT to do:**
- Do NOT remove `findProjectRoot` from exports. External code may depend on it.
- Do NOT change the function signature.

**Verification:**
```bash
node -e "const c = require('./src/lib/core.cjs'); c.findProjectRoot('.')" 2>&1 | grep DEPRECATION
# Should print the deprecation warning to stderr
```

---

## Task 5: Write tests for all new core.cjs exports

**File:** `src/lib/core.test.cjs`

**Action:** Add 3 new `describe` blocks after the existing `resolveRapidDir()` tests (before the closing `});` of the top-level describe):

### 5a: `resolveProjectRoot()` tests

```javascript
describe('resolveProjectRoot()', () => {
  // Test 1: Normal git repo
  it('resolves project root from a normal git repo', () => {
    // Use the actual RAPID project root
    const result = core.resolveProjectRoot(process.cwd());
    // Should return a directory containing .planning/sets/
    assert.ok(fs.existsSync(path.join(result, '.planning', 'sets')),
      'Resolved root should contain .planning/sets/');
  });

  // Test 2: Real git worktree
  it('resolves project root from a git worktree', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-wt-test-'));
    try {
      // Create a worktree from the current repo
      const { execSync } = require('child_process');
      execSync(`git worktree add "${path.join(tmpDir, 'wt')}" --detach HEAD`,
        { cwd: process.cwd(), stdio: 'pipe' });
      const wtRoot = core.resolveProjectRoot(path.join(tmpDir, 'wt'));
      // Should resolve back to the MAIN repo root, not the worktree
      assert.ok(fs.existsSync(path.join(wtRoot, '.planning', 'sets')),
        'Worktree should resolve to main repo root with .planning/sets/');
      assert.notEqual(wtRoot, path.join(tmpDir, 'wt'),
        'Should NOT return the worktree path itself');
    } finally {
      const { execSync } = require('child_process');
      execSync(`git worktree remove "${path.join(tmpDir, 'wt')}" --force`,
        { cwd: process.cwd(), stdio: 'pipe' });
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // Test 3: No-git fallback
  it('falls back to cwd when not in a git repo', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-nogit-'));
    try {
      const result = core.resolveProjectRoot(tmpDir);
      assert.equal(result, tmpDir, 'Should fall back to cwd when no git repo');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // Test 4: Nested subdirectory within worktree
  it('resolves project root from nested subdirectory', () => {
    const nestedDir = path.join(process.cwd(), 'src', 'lib');
    const result = core.resolveProjectRoot(nestedDir);
    assert.ok(fs.existsSync(path.join(result, '.planning', 'sets')),
      'Nested subdir should resolve to project root');
  });

  // Test 5: Defaults to process.cwd() when no arg given
  it('defaults to process.cwd() when called without arguments', () => {
    const result = core.resolveProjectRoot();
    assert.ok(typeof result === 'string' && result.length > 0);
  });
});
```

### 5b: `findProjectRoot()` deprecation wrapper test

```javascript
describe('findProjectRoot() deprecation', () => {
  it('emits deprecation warning and delegates to resolveProjectRoot', () => {
    const originalWarn = console.warn;
    let warnMsg = '';
    console.warn = (msg) => { warnMsg = msg; };
    try {
      const result = core.findProjectRoot(process.cwd());
      assert.ok(warnMsg.includes('DEPRECATION'), 'Should emit deprecation warning');
      assert.ok(typeof result === 'string' && result.length > 0, 'Should return a path');
    } finally {
      console.warn = originalWarn;
    }
  });
});
```

### 5c: `ensureDagExists()` tests

```javascript
describe('ensureDagExists()', () => {
  it('returns the DAG path when DAG.json exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-dag-'));
    const dagDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(dagDir, { recursive: true });
    fs.writeFileSync(path.join(dagDir, 'DAG.json'), '{}');
    try {
      const result = core.ensureDagExists(tmpDir);
      assert.ok(result.endsWith('DAG.json'), 'Should return path ending in DAG.json');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws with remediation steps when DAG.json is missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-nodag-'));
    try {
      assert.throws(
        () => core.ensureDagExists(tmpDir),
        (err) => {
          assert.ok(err.message.includes('DAG.json not found'), 'Should mention DAG.json');
          assert.ok(err.message.includes('dag generate') || err.message.includes('plan-set'),
            'Should include remediation command');
          return true;
        }
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
```

**Verification:**
```bash
node --test src/lib/core.test.cjs
# All tests should pass
```

---

## Success Criteria

1. `core.resolveProjectRoot()` is exported and works identically to the plan.cjs version
2. `core.DAG_SUBPATH` equals `'.planning/sets/DAG.json'` (platform path separators)
3. `core.ensureDagExists()` throws with remediation message when DAG.json missing, returns path when present
4. `core.findProjectRoot()` emits deprecation warning and delegates to `resolveProjectRoot()`
5. All existing core.test.cjs tests still pass
6. All 5 new test scenarios pass: normal repo, worktree, no-git, nested subdir, deprecation warning

## Files Modified

| File | Action |
|------|--------|
| `src/lib/core.cjs` | Add resolveProjectRoot, DAG_SUBPATH, ensureDagExists; convert findProjectRoot to wrapper |
| `src/lib/core.test.cjs` | Add 3 new describe blocks with 8 test cases |
