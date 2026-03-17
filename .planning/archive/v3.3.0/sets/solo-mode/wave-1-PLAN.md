# Wave 1: Solo Mode Core Library Functions

## Objective

Implement the foundational solo mode logic in the library layer: helper functions for detecting solo sets, computing diff bases, the solo path in `setInit()`, the solo guard in `reconcileRegistry()`, and the solo early-return in `mergeSet()`. This wave modifies only library files (`src/lib/`) and their tests. Wave 2 builds on these exports to update command handlers, skills, and status formatting.

## Task 1: Add `isSoloMode()` and `getSetDiffBase()` helpers to `src/lib/worktree.cjs`

**Files:** `src/lib/worktree.cjs`

**Actions:**

1. Add a new function `isSoloMode(cwd, setId)`:
   - Load the registry via `loadRegistry(cwd)`
   - Look up `registry.worktrees[setId]`
   - Return `true` if the entry exists and `entry.solo === true`, else `false`

2. Add a new function `getSetDiffBase(cwd, setId)`:
   - Load the registry via `loadRegistry(cwd)`
   - Look up `registry.worktrees[setId]`
   - If `entry.solo === true` and `entry.startCommit` exists, return `entry.startCommit`
   - Otherwise, return the result of `detectMainBranch(cwd)` (the base branch name, typically `'main'`)

3. Export both functions from the module's `module.exports`.

**What NOT to do:**
- Do not read from config.json or any project-level config -- solo is per-set via registry only
- Do not modify any existing function signatures

**Verification:**
```bash
node -e "const wt = require('./src/lib/worktree.cjs'); console.log(typeof wt.isSoloMode, typeof wt.getSetDiffBase)"
# Should print: function function
```

---

## Task 2: Add `setInitSolo()` function to `src/lib/worktree.cjs`

**Files:** `src/lib/worktree.cjs`

**Actions:**

1. Add a new async function `setInitSolo(cwd, setName)`:
   - Do NOT call `createWorktree()` -- no git worktree or branch is created
   - Do NOT call `generateScopedClaudeMd()` -- no scoped CLAUDE.md needed
   - Capture the current commit hash: `gitExec(['rev-parse', 'HEAD'], cwd)` -> `startCommit`
   - Detect the current branch: `detectMainBranch(cwd)` -> `branch`
   - Register in REGISTRY.json via `registryUpdate()`:
     ```javascript
     {
       setName,
       branch,          // e.g., 'main'
       path: '.',       // virtual: current directory
       phase: 'Created',
       status: 'active',
       solo: true,
       startCommit,     // commit hash at init time
       wave: null,
       createdAt: new Date().toISOString(),
     }
     ```
   - Return:
     ```javascript
     {
       created: true,
       branch,
       worktreePath: cwd,  // the project root itself
       setName,
       solo: true,
       startCommit,
       claudeMdGenerated: false,
       claudeMdError: null,
     }
     ```

2. Export `setInitSolo` from `module.exports`.

**What NOT to do:**
- Do not modify the existing `setInit()` function
- Do not call `ensureWorktreeDir()` -- no `.rapid-worktrees/` directory needed for solo

**Verification:**
```bash
node -e "const wt = require('./src/lib/worktree.cjs'); console.log(typeof wt.setInitSolo)"
# Should print: function
```

---

## Task 3: Guard solo entries in `reconcileRegistry()`

**Files:** `src/lib/worktree.cjs`

**Actions:**

1. In the `reconcileRegistry()` function, find the loop that marks orphaned entries (around line 270-275):
   ```javascript
   for (const [setName, entry] of Object.entries(registry.worktrees)) {
     const expectedBranch = entry.branch || `rapid/${setName}`;
     if (!gitBranches.has(expectedBranch)) {
       entry.status = 'orphaned';
     }
   }
   ```

2. Add a guard at the top of the loop body to skip solo entries:
   ```javascript
   if (entry.solo === true) continue;
   ```

   This prevents solo entries from being marked orphaned. Solo entries have `branch: 'main'` and `path: '.'`, which would confuse the orphan detection logic (main branch is the main worktree, not a rapid/ branch).

**What NOT to do:**
- Do not change the discovery logic for unregistered worktrees (the second loop) -- solo entries are never discovered via git worktree list
- Do not change the lock acquisition or write logic

**Verification:**
```bash
node -e "
const wt = require('./src/lib/worktree.cjs');
// Source inspection -- reconcileRegistry should have solo guard
const src = require('fs').readFileSync('src/lib/worktree.cjs', 'utf-8');
console.log(src.includes('entry.solo') ? 'PASS: solo guard found' : 'FAIL: no solo guard');
"
```

---

## Task 4: Solo early-return in `mergeSet()` in `src/lib/merge.cjs`

**Files:** `src/lib/merge.cjs`

**Actions:**

1. At the top of `mergeSet(projectRoot, setName, baseBranch)` (line 1573), before the git checkout, add a solo detection check:
   ```javascript
   // Solo mode: no merge needed -- work is already on main
   const registry = worktree.loadRegistry(projectRoot);
   const entry = registry.worktrees[setName];
   if (entry && entry.solo === true) {
     const headResult = worktree.gitExec(['rev-parse', 'HEAD'], projectRoot);
     return {
       merged: true,
       branch: entry.branch || baseBranch,
       commitHash: headResult.ok ? headResult.stdout : '',
       solo: true,
     };
   }
   ```

   This returns success immediately without any git merge operations. The `solo: true` flag on the return lets callers know this was a no-op merge.

**What NOT to do:**
- Do not modify the existing non-solo merge path
- Do not change the function signature

**Verification:**
```bash
node -e "
const src = require('fs').readFileSync('src/lib/merge.cjs', 'utf-8');
console.log(src.includes('entry.solo') ? 'PASS: solo check in mergeSet' : 'FAIL');
"
```

---

## Task 5: Solo-aware diff functions in `src/lib/execute.cjs`

**Files:** `src/lib/execute.cjs`

**Actions:**

1. Modify `getChangedFiles(worktreePath, baseBranch)` to accept an optional third parameter `startCommit`:
   ```javascript
   function getChangedFiles(worktreePath, baseBranch, startCommit) {
     const ref = startCommit || baseBranch;
     const result = worktree.gitExec(['diff', '--name-only', `${ref}...HEAD`], worktreePath);
     if (!result.ok) return [];
     return result.stdout.split('\n').filter(line => line.trim().length > 0);
   }
   ```

2. Modify `getCommitCount(worktreePath, baseBranch, startCommit)` similarly:
   ```javascript
   function getCommitCount(worktreePath, baseBranch, startCommit) {
     const ref = startCommit || baseBranch;
     const result = worktree.gitExec(['rev-list', '--count', `${ref}..HEAD`], worktreePath);
     if (!result.ok) return 0;
     return parseInt(result.stdout, 10) || 0;
   }
   ```

3. Modify `getCommitMessages(worktreePath, baseBranch, startCommit)` similarly:
   ```javascript
   function getCommitMessages(worktreePath, baseBranch, startCommit) {
     const ref = startCommit || baseBranch;
     const result = worktree.gitExec(['log', '--format=%s', `${ref}..HEAD`], worktreePath);
     if (!result.ok) return [];
     return result.stdout.split('\n').filter(line => line.trim().length > 0);
   }
   ```

   These changes are backward-compatible: existing callers that pass only two arguments continue to work unchanged (the third parameter defaults to undefined, so `ref` falls back to `baseBranch`).

4. Modify `verifySetExecution()` to detect solo sets and use `startCommit`:
   - Load the registry: `const registry = worktree.loadRegistry(cwd);`
   - Look up: `const entry = registry.worktrees[setName];`
   - If `entry && entry.solo && entry.startCommit`, use `entry.startCommit` as the effective base for `getCommitCount`, `getCommitMessages`, `getChangedFiles` calls within that function (pass as 3rd arg)

**What NOT to do:**
- Do not change the module exports -- all function names stay the same
- Do not break existing 2-arg callers of these functions

**Verification:**
```bash
node -e "
const execute = require('./src/lib/execute.cjs');
console.log(execute.getChangedFiles.length >= 2 ? 'PASS' : 'FAIL');
console.log(execute.getCommitCount.length >= 2 ? 'PASS' : 'FAIL');
console.log(execute.getCommitMessages.length >= 2 ? 'PASS' : 'FAIL');
"
```

---

## Task 6: Unit tests for solo mode library functions

**Files:** `src/lib/worktree.test.cjs`, `src/lib/execute.test.cjs`, `src/lib/merge.test.cjs`

**Actions:**

### In `src/lib/worktree.test.cjs` -- add a new `describe('solo mode')` block:

1. **Test `isSoloMode()`:**
   - Create a temp repo, write a REGISTRY.json with `{ worktrees: { 'test-set': { solo: true, ... } } }`
   - Assert `isSoloMode(tmpDir, 'test-set')` returns `true`
   - Assert `isSoloMode(tmpDir, 'nonexistent')` returns `false`
   - Write a non-solo entry and assert `isSoloMode(tmpDir, 'normal-set')` returns `false`

2. **Test `getSetDiffBase()`:**
   - Create a temp repo with a solo registry entry containing `startCommit: 'abc123'`
   - Assert `getSetDiffBase(tmpDir, 'solo-set')` returns `'abc123'`
   - Assert `getSetDiffBase(tmpDir, 'normal-set')` returns the current branch name (from `detectMainBranch`)

3. **Test `setInitSolo()`:**
   - Create a temp repo
   - Call `await setInitSolo(tmpDir, 'my-solo-set')`
   - Assert result has `created: true`, `solo: true`, `startCommit` is a 40-char hex string
   - Assert registry has the entry with `solo: true`, `path: '.'`, `branch` matches current branch
   - Assert NO `.rapid-worktrees/my-solo-set` directory was created
   - Assert NO `rapid/my-solo-set` branch was created

4. **Test `reconcileRegistry()` solo guard:**
   - Create a temp repo
   - Write a registry with a solo entry (`{ solo: true, branch: 'master', path: '.' }`)
   - Call `reconcileRegistry()`
   - Assert the solo entry's status is NOT 'orphaned'

### In `src/lib/merge.test.cjs` -- add a test for solo merge:

5. **Test `mergeSet()` solo early-return:**
   - Create a temp repo with a solo registry entry
   - Call `mergeSet(tmpDir, 'solo-set', 'master')`
   - Assert result has `merged: true` and `solo: true`
   - Assert no git merge was performed (branch is still on the same commit)

### In `src/lib/execute.test.cjs` -- add tests for updated diff functions:

6. **Test `getChangedFiles()` with startCommit:**
   - Create a temp repo, make an initial commit, record its hash as `startCommit`
   - Create a file, commit it
   - Call `getChangedFiles(tmpDir, 'main', startCommit)` and assert the new file is in the result
   - Call `getChangedFiles(tmpDir, 'main')` for backward compatibility

7. **Test `getCommitCount()` and `getCommitMessages()` with startCommit:**
   - Similar pattern to `getChangedFiles` test

**Verification:**
```bash
node --test src/lib/worktree.test.cjs src/lib/merge.test.cjs src/lib/execute.test.cjs
```

---

## Success Criteria

- `isSoloMode()` correctly reads `solo` flag from registry entries
- `getSetDiffBase()` returns `startCommit` for solo sets, branch name for normal sets
- `setInitSolo()` creates a virtual registry entry without creating any worktree or branch
- `reconcileRegistry()` does not mark solo entries as orphaned
- `mergeSet()` returns immediate success for solo sets without performing git merge
- `getChangedFiles()`, `getCommitCount()`, `getCommitMessages()` accept optional `startCommit` parameter
- `verifySetExecution()` uses `startCommit` from registry for solo sets
- All existing tests continue to pass (backward compatibility)
- All new tests pass
