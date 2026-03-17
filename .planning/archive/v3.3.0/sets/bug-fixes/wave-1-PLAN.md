# Wave 1 PLAN: DEFINITION.md Path Resolution Fix

## Objective

Fix `loadSet()` in `src/lib/plan.cjs` so it always resolves set files (DEFINITION.md, CONTRACT.json, CONTRIBUTIONS.json) relative to the true project root, not relative to `cwd`. When called from a worktree context (where `cwd` is `.rapid-worktrees/<set>/`), the current code builds `path.join(cwd, '.planning', 'sets', setName)` which points to a non-existent `.planning/` inside the worktree. The fix uses `git rev-parse --path-format=absolute --git-common-dir` to discover the real project root and resolves set paths from there.

## Why This Matters

Every caller of `loadSet()` -- `generateScopedClaudeMd()`, `prepareSetContext()`, `runProgrammaticGate()`, `prepareReviewContext()`, stub generation -- fails silently or throws when invoked from a worktree context. This blocks the entire execute and review pipeline from worktree-based execution.

## Tasks

### Task 1: Add `resolveProjectRoot()` helper to `src/lib/plan.cjs`

**File:** `src/lib/plan.cjs`

**Action:** Add a new private function `resolveProjectRoot(cwd)` that:

1. Attempts `git rev-parse --path-format=absolute --git-common-dir` with `cwd` as the working directory (use `child_process.execSync` directly, not worktree.cjs's `gitExec`, to avoid circular dependencies).
2. The git-common-dir result points to the `.git` directory (or the `.git/worktrees/<name>` entry for worktrees). From the result:
   - If the result ends with `/.git`, strip `/.git` to get the project root.
   - If the result IS `.git` (bare relative), resolve it against `cwd`.
   - Otherwise (e.g., `/path/to/project/.git`), strip the trailing `/.git`.
3. Verify the resolved root contains `.planning/sets/` directory. If not, fall back to `cwd`.
4. If the `git rev-parse` command fails (non-zero exit, e.g., no git repo -- important for unit tests with temp dirs), fall back to `cwd` unchanged. This ensures backward compatibility with non-git test environments.
5. Return the resolved project root path.

**Key edge case:** The `--path-format=absolute` flag is critical. Without it, `git-common-dir` returns a relative path (just `.git`) when run from the main repo but an absolute path when run from a worktree. Using `--path-format=absolute` normalizes the output.

**What NOT to do:**
- Do NOT use `core.cjs`'s `findProjectRoot()` -- it walks up looking for `.planning/` which would find the worktree's `.planning/` symlink or copy before finding the real one. The git-based approach is authoritative.
- Do NOT import `worktree.cjs` from `plan.cjs` -- this would create a circular dependency (`worktree.cjs` already requires `plan.cjs`).
- Do NOT change the `loadSet()` function signature -- `cwd` parameter stays.

### Task 2: Update `loadSet()` to use `resolveProjectRoot()`

**File:** `src/lib/plan.cjs`

**Action:** Modify `loadSet()` (line 139) to resolve the project root before building paths:

1. At the start of `loadSet()`, call `const projectRoot = resolveProjectRoot(cwd);`.
2. Replace `const setDir = path.join(cwd, '.planning', 'sets', setName);` with `const setDir = path.join(projectRoot, '.planning', 'sets', setName);`.
3. Update the error message in the `!fs.existsSync(setDir)` check to include diagnostic info: both the original `cwd` and the resolved `projectRoot`, so the user can tell whether the issue is path resolution or a genuinely missing set. Example: `Set "${setName}" does not exist at ${setDir} (cwd: ${cwd}, resolved root: ${projectRoot})`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const plan = require('./src/lib/plan.cjs');
// Should work from project root
const result = plan.loadSet(process.cwd(), 'bug-fixes');
console.log('contract keys:', Object.keys(result.contract));
console.log('PASS: loadSet from project root');
"
```

### Task 3: Update other path-dependent functions in `plan.cjs`

**File:** `src/lib/plan.cjs`

**Action:** Apply the same `resolveProjectRoot()` fix to `listSets()` (line 169) and `surfaceAssumptions()` (line 303, which calls `loadSet` so it gets the fix transitively). The `listSets()` function also builds a path from `cwd` that would fail in worktree context:

1. In `listSets()`, replace `const setsDir = path.join(cwd, '.planning', 'sets');` with `const setsDir = path.join(resolveProjectRoot(cwd), '.planning', 'sets');`.

**Note:** `createSet()`, `writeDAG()`, `writeOwnership()`, `writeManifest()`, and `decomposeIntoSets()` do NOT need this fix. They are only called during planning from the project root context, never from worktrees.

### Task 4: Unit tests for `resolveProjectRoot()` and updated `loadSet()`

**File:** `src/lib/plan.test.cjs`

**Action:** Add a new `describe('resolveProjectRoot and worktree-aware loadSet')` block with these tests:

1. **`resolveProjectRoot falls back to cwd when no git repo`**: Create a temp dir (no git init), call the exported or indirectly tested function. Verify `loadSet(tmpDir, setName)` still works when `.planning/sets/<name>/` exists in `tmpDir` -- the fallback path is exercised.

2. **`loadSet error message includes cwd and resolved root`**: Call `loadSet(tmpDir, 'nonexistent-set')` from a temp dir and assert the error message contains both `cwd` and `resolved root` strings.

3. **`listSets works from project root context`**: Existing test coverage should still pass (regression).

**Note:** Testing the actual git worktree path resolution requires a real git repo with a worktree -- that is covered in Task 5 (integration test in `worktree.test.cjs`).

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/plan.test.cjs
```

### Task 5: Integration test for worktree-context path resolution

**File:** `src/lib/worktree.test.cjs`

**Action:** Add a new `describe('DEFINITION.md path resolution from worktree context')` block within the existing test file. This test creates a real git repo with a worktree and verifies the behavioral invariant `definitionMdAlwaysFound`:

1. Create a temp git repo using the existing `createTempRepo()` helper.
2. Create `.planning/sets/test-set/` with DEFINITION.md and CONTRACT.json (minimal valid content).
3. Create a git worktree: `git worktree add -b rapid/test-set .rapid-worktrees/test-set HEAD`.
4. Call `worktree.generateScopedClaudeMd(worktreePath, 'test-set')` where `worktreePath` is the worktree's path (simulating what `setInit` does when it passes `cwd` as the worktree).
5. Assert the result contains `# Set: test-set` -- proving DEFINITION.md was found and read.
6. Clean up: remove worktree, remove temp dir.

Add a second test case:
7. **`loadSet works when called with worktree path as cwd`**: Directly call `plan.loadSet(worktreePath, 'test-set')` and assert it returns the definition content.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/worktree.test.cjs --test-name-pattern "DEFINITION.md"
```

## Success Criteria

- [ ] `node --test src/lib/plan.test.cjs` passes (all existing + new tests)
- [ ] `node --test src/lib/worktree.test.cjs` passes (all existing + new tests)
- [ ] `loadSet()` called with a worktree path as `cwd` finds DEFINITION.md at the project root
- [ ] `loadSet()` called with the project root as `cwd` continues to work (no regression)
- [ ] `loadSet()` called from a non-git temp dir (unit test context) still works via fallback
- [ ] Error messages for missing sets include diagnostic `cwd` and `resolved root` info

## Files Modified

| File | Action |
|------|--------|
| `src/lib/plan.cjs` | Add `resolveProjectRoot()`, update `loadSet()` and `listSets()` |
| `src/lib/plan.test.cjs` | Add unit tests for path resolution fallback and error messages |
| `src/lib/worktree.test.cjs` | Add integration test for worktree-context DEFINITION.md resolution |
