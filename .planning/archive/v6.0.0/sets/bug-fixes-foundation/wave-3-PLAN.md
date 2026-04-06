# PLAN: bug-fixes-foundation -- Wave 3

## Objective

Migrate `worktree.cjs` from `execSync` with shell-interpolated template strings to `execFileSync` with argument arrays to eliminate the shell injection vector. This is the highest-risk change in the set because it modifies the central `gitExec()` function that all git operations flow through, and it requires fixing quoting in two callers (`createWorktree`, `removeWorktree`).

## Tasks

### Task 1: Replace `execSync` with `execFileSync` in `gitExec()`

**File:** `src/lib/worktree.cjs`

**Context:** The `gitExec()` function (lines 19-35) currently uses `execSync('git ${args.join(' ')}')` which passes user-controlled set/branch names through a shell. This is a shell injection vulnerability. The fix is to switch to `execFileSync('git', args)` which bypasses the shell entirely.

**Step 1: Update the import.** At line 3, add `execFileSync` to the `child_process` import. Keep `execSync` because it is used elsewhere in the file (line 113 for dependency installation, line 395 for autoMergeSolo retry sleep, line 417 for state transition).

**Before (line 3):**
```js
const { execSync } = require('child_process');
```

**After:**
```js
const { execSync, execFileSync } = require('child_process');
```

**Step 2: Modify `gitExec()` internals.** Replace the `execSync` call with `execFileSync`.

**Before (lines 19-35):**
```js
function gitExec(args, cwd) {
  try {
    const result = execSync(`git ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return { ok: true, stdout: result.trim() };
  } catch (err) {
    return {
      ok: false,
      exitCode: err.status,
      stderr: (err.stderr || '').toString().trim(),
    };
  }
}
```

**After:**
```js
function gitExec(args, cwd) {
  try {
    const result = execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return { ok: true, stdout: result.trim() };
  } catch (err) {
    return {
      ok: false,
      exitCode: err.status,
      stderr: (err.stderr || '').toString().trim(),
    };
  }
}
```

**What NOT to do:**
- Do not remove `execSync` from the import -- it is still used by `installDeps` (line 113), `autoMergeSolo` (lines 395, 417-419), and other non-gitExec callsites.
- Do not create a new function or deprecate `gitExec` -- modify it in-place per the CONTEXT.md decision.
- Do not touch `autoMergeSolo` or the dependency installation code -- those are out of scope (deferred to a future set).

---

### Task 2: Fix quoting in `createWorktree()` call

**File:** `src/lib/worktree.cjs` (line 97)

**Context:** `createWorktree()` passes `'"${worktreePath}"'` with embedded shell quotes in the argument. With `execFileSync`, arguments are passed directly without shell interpretation, so the embedded quotes become literal characters in the path, causing the git command to fail.

**Before (lines 96-99):**
```js
  const result = gitExec(
    ['worktree', 'add', '-b', branch, `"${worktreePath}"`, 'HEAD'],
    projectRoot
  );
```

**After:**
```js
  const result = gitExec(
    ['worktree', 'add', '-b', branch, worktreePath, 'HEAD'],
    projectRoot
  );
```

**What NOT to do:**
- Do not add any shell-escaping or quoting -- `execFileSync` handles spaces in paths natively through OS-level argument passing.

---

### Task 3: Fix quoting in `removeWorktree()` call

**File:** `src/lib/worktree.cjs` (line 132)

**Context:** Same issue as `createWorktree()` -- embedded shell quotes in the path argument.

**Before (line 132):**
```js
  const result = gitExec(['worktree', 'remove', `"${worktreePath}"`], projectRoot);
```

**After:**
```js
  const result = gitExec(['worktree', 'remove', worktreePath], projectRoot);
```

---

### Task 4: Audit all other `gitExec()` callers

**File:** `src/lib/worktree.cjs`

**Context:** After switching `gitExec` to `execFileSync`, verify that all other callers pass clean argument arrays (no embedded shell quoting or shell metacharacters).

**Callers to audit (all should be safe already):**

1. **`detectMainBranch`** (line 45): `gitExec(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)` -- SAFE, no interpolation.

2. **`deleteBranch`** (line 161): `gitExec(['branch', flag, branchName], cwd)` -- SAFE. The `branchName` validation at line 156 rejects empty strings and strings with spaces. The `flag` is computed from a boolean. No embedded quotes.

3. **`listWorktrees`** (line 190): `gitExec(['worktree', 'list', '--porcelain'], projectRoot)` -- SAFE, static args.

No changes needed for these callers.

---

### Task 5: Add regression tests for shell injection safety

**File:** `src/lib/worktree.test.cjs`

**Action:** Add tests that verify `gitExec` uses `execFileSync` (source-level assertion) and that special characters in set names are handled safely.

```js
describe('shell injection safety', () => {
  it('gitExec uses execFileSync, not execSync with template string', () => {
    const src = fs.readFileSync(path.join(__dirname, 'worktree.cjs'), 'utf-8');
    // gitExec function body should contain execFileSync('git', args
    assert.ok(
      src.includes("execFileSync('git', args"),
      'gitExec must use execFileSync with argument array'
    );
    // gitExec function body should NOT contain execSync(`git ${
    assert.ok(
      !src.includes('execSync(`git ${'),
      'gitExec must not use execSync with template string interpolation'
    );
  });

  it('createWorktree does not embed shell quotes in path arguments', () => {
    const src = fs.readFileSync(path.join(__dirname, 'worktree.cjs'), 'utf-8');
    // Check that the createWorktree gitExec call does not use `"${worktreePath}"`
    // It should use just worktreePath
    assert.ok(
      !src.includes('`"${worktreePath}"`'),
      'createWorktree must not embed shell quotes in worktree path'
    );
  });

  it('removeWorktree does not embed shell quotes in path arguments', () => {
    const src = fs.readFileSync(path.join(__dirname, 'worktree.cjs'), 'utf-8');
    assert.ok(
      !src.includes("['worktree', 'remove', `\"${"),
      'removeWorktree must not embed shell quotes in worktree path'
    );
  });
});
```

Additionally, add a functional test that verifies worktree creation works with the new `execFileSync` path (this tests the integration end-to-end):

```js
describe('createWorktree with execFileSync', () => {
  let repoDir;

  before(() => {
    repoDir = createTempRepo();
  });

  after(() => {
    cleanupRepo(repoDir);
  });

  it('creates a worktree successfully', () => {
    const result = worktree.createWorktree(repoDir, 'test-set');
    assert.ok(result.branch === 'rapid/test-set');
    assert.ok(fs.existsSync(result.path));
  });
});
```

Note: The existing test file likely already has functional worktree tests. The executor should verify they still pass after the migration and add the source-level safety assertions shown above.

**Verification:**
```bash
node --test src/lib/worktree.test.cjs
```

Run the full test suite to verify no regressions:
```bash
node --test 'src/**/*.test.cjs'
```

---

## File Ownership (Wave 3)

| File | Action |
|------|--------|
| `src/lib/worktree.cjs` | Replace execSync with execFileSync in gitExec, fix quoting in createWorktree and removeWorktree |
| `src/lib/worktree.test.cjs` | Add shell injection safety assertions and verify functional behavior |

## Success Criteria

1. `gitExec()` uses `execFileSync('git', args, ...)` -- no `execSync` with template string interpolation
2. `createWorktree()` passes `worktreePath` directly, not `'"${worktreePath}"'`
3. `removeWorktree()` passes `worktreePath` directly, not `'"${worktreePath}"'`
4. All existing worktree tests pass unchanged (functional behavior is identical)
5. Source-level assertions confirm no `execSync(\`git ${` pattern exists in gitExec
6. `node --test src/lib/worktree.test.cjs` passes
7. `node --test 'src/**/*.test.cjs'` passes (full suite, no regressions)
