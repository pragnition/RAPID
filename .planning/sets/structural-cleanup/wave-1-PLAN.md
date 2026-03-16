# Wave 1: Registry Function Rename

## Objective

Rename `loadRegistry` to `readRegistry` and `registryUpdate` to `withRegistryUpdate` across the entire codebase. This improves API naming clarity: `readRegistry` signals read-only intent, `withRegistryUpdate` signals the callback-based mutation pattern. All 57 call sites across 11 source files plus test files and markdown references must be updated atomically.

The CONTRACT specifies that `readRegistry` returns `Readonly<RegistryData>` (frozen). Since internal functions (`reconcileRegistry`, `registryUpdate` itself, `isSoloMode`, `getSetDiffBase`, `setInit`, `setInitSolo`) call `loadRegistry` and some mutate the result, the implementation must keep a private `_loadRegistryRaw()` for internal mutable access and expose `readRegistry` as a frozen public API wrapper.

## Tasks

### Task 1: Rename core definitions in `src/lib/worktree.cjs`

**Files:** `src/lib/worktree.cjs`

**Actions:**
1. Rename the function at line 206 from `function loadRegistry(cwd)` to `function _loadRegistryRaw(cwd)`. Keep it private (not exported).
2. Add a new public `readRegistry(cwd)` function immediately after `_loadRegistryRaw` that calls `_loadRegistryRaw(cwd)` and returns `Object.freeze(result)` (shallow freeze is sufficient).
3. Update the JSDoc for `readRegistry` to document the frozen return: `@returns {Readonly<{version: number, worktrees: Object}>}`.
4. Rename `registryUpdate` at line 241 to `withRegistryUpdate`. Update its JSDoc to reflect the new name.
5. Inside `withRegistryUpdate`, change the internal call from `loadRegistry(cwd)` to `_loadRegistryRaw(cwd)` (line 244) since the mutation callback needs a mutable copy.
6. Inside `reconcileRegistry` (line 263), change `loadRegistry(cwd)` to `_loadRegistryRaw(cwd)` since it mutates entries directly.
7. Inside `isSoloMode` (line 317), change `loadRegistry(cwd)` to `readRegistry(cwd)` since it only reads.
8. Inside `getSetDiffBase` (line 331), change `loadRegistry(cwd)` to `readRegistry(cwd)` since it only reads.
9. Inside `setInit` (line 371), change `registryUpdate` to `withRegistryUpdate`.
10. Inside `setInitSolo` (line 415), change `registryUpdate` to `withRegistryUpdate`.
11. Update `module.exports` (lines 945-947): replace `loadRegistry` with `readRegistry`, replace `registryUpdate` with `withRegistryUpdate`.

**What NOT to do:**
- Do NOT export `_loadRegistryRaw`. It is private.
- Do NOT deep-freeze the registry. Shallow `Object.freeze()` is sufficient since callers only read top-level properties and `.worktrees[setId]` properties.
- Do NOT change `writeRegistry` -- it remains internal and unchanged.

**Verification:**
```bash
node -e "const w = require('./src/lib/worktree.cjs'); console.log(typeof w.readRegistry, typeof w.withRegistryUpdate, typeof w.loadRegistry)"
# Expected: function function undefined
```

### Task 2: Propagate renames to command handler files

**Files:** `src/commands/worktree.cjs`, `src/commands/execute.cjs`, `src/commands/merge.cjs`, `src/commands/review.cjs`, `src/commands/set-init.cjs`

**Actions:**
1. In `src/commands/worktree.cjs` (7 occurrences):
   - Line 19: `wt.registryUpdate` -> `wt.withRegistryUpdate`
   - Line 51: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 59: `wt.registryUpdate` -> `wt.withRegistryUpdate`
   - Line 72: `wt.registryUpdate` -> `wt.withRegistryUpdate`
   - Line 86: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 167: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 194: `wt.loadRegistry` -> `wt.readRegistry`

2. In `src/commands/execute.cjs` (7 occurrences):
   - Line 40: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 74: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 138: `wt.registryUpdate` -> `wt.withRegistryUpdate`
   - Line 197: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 225: `wt.registryUpdate` -> `wt.withRegistryUpdate`
   - Line 267: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 315: `wt.loadRegistry` -> `wt.readRegistry`

3. In `src/commands/merge.cjs` (7 occurrences):
   - Line 47: `wt.registryUpdate` -> `wt.withRegistryUpdate`
   - Line 67: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 126: `wt.registryUpdate` -> `wt.withRegistryUpdate`
   - Line 177: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 220: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 385: `wt.registryUpdate` -> `wt.withRegistryUpdate`
   - Line 420: `wt.loadRegistry` -> `wt.readRegistry`

4. In `src/commands/review.cjs` (2 occurrences):
   - Line 38: `wt.loadRegistry` -> `wt.readRegistry`
   - Line 142: `wt.loadRegistry` -> `wt.readRegistry`

5. In `src/commands/set-init.cjs` (1 occurrence):
   - Line 40: `wt.loadRegistry` -> `wt.readRegistry`

**What NOT to do:**
- Do NOT change the destructuring/import patterns. These files use `const wt = require('../lib/worktree.cjs')` and call via `wt.loadRegistry()` -- just change the method name after the dot.
- Do NOT modify any logic or behavior. This is a pure rename.

**Verification:**
```bash
grep -rn 'loadRegistry\|registryUpdate' src/commands/ | grep -v node_modules
# Expected: zero matches
```

### Task 3: Propagate renames to library files

**Files:** `src/lib/stub.cjs`, `src/lib/merge.cjs`, `src/lib/execute.cjs`

**Actions:**
1. In `src/lib/stub.cjs` (2 occurrences):
   - Line 15 (JSDoc comment): `loadRegistry` -> `readRegistry`
   - Line 108: `worktree.loadRegistry` -> `worktree.readRegistry`

2. In `src/lib/merge.cjs` (4 occurrences):
   - Line 18 (JSDoc comment): `loadRegistry` -> `readRegistry`
   - Line 1250: `worktree.loadRegistry` -> `worktree.readRegistry`
   - Line 1331: `worktree.loadRegistry` -> `worktree.readRegistry`
   - Line 1575: `worktree.loadRegistry` -> `worktree.readRegistry`

3. In `src/lib/execute.cjs` (4 occurrences):
   - Line 12 (JSDoc comment): `loadRegistry` -> `readRegistry`
   - Line 236: `worktree.loadRegistry` -> `worktree.readRegistry`
   - Line 460: `worktree.loadRegistry` -> `worktree.readRegistry`
   - Line 496: `worktree.registryUpdate` -> `worktree.withRegistryUpdate`

**What NOT to do:**
- Do NOT rename `registryUpdate` references that do not exist in these files. Only `execute.cjs` has one at line 496.

**Verification:**
```bash
grep -rn 'loadRegistry\|registryUpdate' src/lib/stub.cjs src/lib/merge.cjs src/lib/execute.cjs
# Expected: zero matches
```

### Task 4: Propagate renames to test files

**Files:** `src/lib/worktree.test.cjs`, `src/bin/rapid-tools.test.cjs`

**Actions:**
1. In `src/lib/worktree.test.cjs` (12 occurrences):
   - Line 222 (section comment): `loadRegistry` -> `readRegistry`
   - Line 224 (describe block): `'loadRegistry'` -> `'readRegistry'`
   - Line 237: `worktree.loadRegistry` -> `worktree.readRegistry`
   - Line 247: `worktree.loadRegistry` -> `worktree.readRegistry`
   - Line 253 (section comment): `registryUpdate` -> `withRegistryUpdate`
   - Line 255 (describe block): `'registryUpdate'` -> `'withRegistryUpdate'`
   - Line 268: `worktree.registryUpdate` -> `worktree.withRegistryUpdate`
   - Line 275: `worktree.loadRegistry` -> `worktree.readRegistry`
   - Line 280: `worktree.registryUpdate` -> `worktree.withRegistryUpdate`
   - Line 946: `worktree.loadRegistry` -> `worktree.readRegistry`
   - Line 1493: `worktree.loadRegistry` -> `worktree.readRegistry`
   - Line 1539: `worktree.loadRegistry` -> `worktree.readRegistry`

2. In `src/bin/rapid-tools.test.cjs` (1 occurrence):
   - Line 1539 (comment): `loadRegistry` -> `readRegistry`

3. The `registryUpdate` tests currently check the return value (line 272: `assert.equal(result.worktrees['my-set'].status, 'active')`). The CONTRACT says `withRegistryUpdate` returns `Promise<void>`. However, the current implementation returns `updated` -- do NOT change the return type in this wave. The behavioral contract can be tightened later. Just rename the function calls.

**What NOT to do:**
- Do NOT change test logic or assertions beyond the rename.
- Do NOT change test descriptions beyond the function name.

**Verification:**
```bash
grep -rn 'loadRegistry\|registryUpdate' src/lib/worktree.test.cjs src/bin/rapid-tools.test.cjs
# Expected: zero matches
```

### Task 5: Final exhaustive verification

**Files:** None modified (verification only)

**Actions:**
1. Run exhaustive grep across entire `src/` directory for any remaining `loadRegistry` or `registryUpdate` references:
   ```bash
   grep -rn 'loadRegistry\|registryUpdate' src/
   ```
   Expected: zero matches.

2. Run the full test suite:
   ```bash
   node --test src/lib/worktree.test.cjs
   node --test src/bin/rapid-tools.test.cjs
   ```
   Both must pass with zero failures.

3. Verify the module exports are correct:
   ```bash
   node -e "const w = require('./src/lib/worktree.cjs'); console.log(Object.keys(w).sort().join(', '))"
   ```
   Must include `readRegistry` and `withRegistryUpdate`, must NOT include `loadRegistry` or `registryUpdate`.

## Success Criteria

- Zero occurrences of `loadRegistry` or `registryUpdate` in `src/` (source, test, or comment)
- `readRegistry` returns a frozen object (`Object.isFrozen(result) === true`)
- Internal functions (`reconcileRegistry`, `withRegistryUpdate`) use `_loadRegistryRaw` for mutable access
- All existing tests pass after rename (no behavioral changes)
- `module.exports` exposes `readRegistry` and `withRegistryUpdate` but not `_loadRegistryRaw`
