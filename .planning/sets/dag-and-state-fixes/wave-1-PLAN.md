# PLAN: dag-and-state-fixes / Wave 1

## Objective

Create the centralized `tryLoadDAG(cwd)` function in `dag.cjs` and its full test suite. This is the foundation for all subsequent work -- every DAG consumer migration depends on this function existing with a stable API.

## Background

Currently, `dag.cjs` is pure logic with zero I/O (no `fs` or `path` imports). All DAG file loading is done inline by consumers (merge.cjs, execute.cjs, worktree.cjs) with inconsistent paths. This wave adds the canonical loader function.

The canonical DAG path is `.planning/sets/DAG.json`. The path `.planning/DAG.json` is wrong (used by merge.cjs `detectCascadeImpact` and `src/commands/merge.cjs` line 274).

## Tasks

### Task 1: Add `tryLoadDAG(cwd)` to dag.cjs

**File:** `/home/kek/Projects/RAPID/src/lib/dag.cjs`

**Actions:**
1. Add `require('fs')` and `require('path')` at the top of the file (below the `'use strict'` directive, before the existing JSDoc block comment).
2. Add a new exported function `tryLoadDAG(cwd)` after the existing `getExecutionOrder` function (before `VALID_NODE_TYPES`).
3. The function signature and behavior:

```
tryLoadDAG(cwd: string): { dag: object|null, path: string }
```

- Compute the canonical path: `path.join(cwd, '.planning', 'sets', 'DAG.json')`
- Always return `{ dag, path: canonicalPath }` (path is always populated for logging/errors)
- On `ENOENT` (file does not exist): return `{ dag: null, path: canonicalPath }`
- On successful read and parse: return `{ dag: parsedObject, path: canonicalPath }`
- On `JSON.parse` failure (malformed file): **throw** the parse error (corrupt file is not the same as missing file -- callers need to know about corruption)
- On other `fs.readFileSync` errors (e.g., permission denied): **throw** the original error

4. Add `tryLoadDAG` to the `module.exports` object.

**What NOT to do:**
- Do NOT add schema validation inside tryLoadDAG. It is a loader, not a validator.
- Do NOT add caching. Always read from disk.
- Do NOT auto-regenerate inside tryLoadDAG. Return null and let callers decide.
- Do NOT handle the old `.planning/DAG.json` path. That path is simply wrong.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "const d = require('./src/lib/dag.cjs'); console.log(typeof d.tryLoadDAG)"
```
Expected output: `function`

---

### Task 2: Add `DAG_CANONICAL_PATH` constant to dag.cjs

**File:** `/home/kek/Projects/RAPID/src/lib/dag.cjs`

**Actions:**
1. Add a constant near the top (after the requires, before `toposort`):
   ```
   const DAG_CANONICAL_SUBPATH = path.join('.planning', 'sets', 'DAG.json');
   ```
2. Use this constant inside `tryLoadDAG` instead of inline path construction.
3. Export it from `module.exports` so consumers can reference the canonical path if needed.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "const d = require('./src/lib/dag.cjs'); console.log(d.DAG_CANONICAL_SUBPATH)"
```
Expected output: `.planning/sets/DAG.json`

---

### Task 3: Write tests for tryLoadDAG in dag.test.cjs

**File:** `/home/kek/Projects/RAPID/src/lib/dag.test.cjs`

**Actions:**
1. Add `require('fs')`, `require('path')`, and `require('os')` at the top alongside existing requires.
2. Add `tryLoadDAG` and `DAG_CANONICAL_SUBPATH` to the destructured imports from `./dag.cjs`.
3. Add a new `describe('tryLoadDAG', ...)` block at the end of the file (before the closing of the file, after all existing describe blocks).
4. Use `beforeEach`/`afterEach` to create and clean up a temp directory via `os.mkdtemp` and `fs.rmSync`.
5. Write the following test cases:

**Test 3a: Returns null dag when DAG.json does not exist**
- Create a tmpdir with `.planning/sets/` directory but no DAG.json
- Call `tryLoadDAG(tmpDir)`
- Assert `result.dag` is `null`
- Assert `result.path` ends with `.planning/sets/DAG.json`

**Test 3b: Returns parsed DAG when file exists and is valid JSON**
- Create tmpdir with `.planning/sets/DAG.json` containing a valid DAG object (use `createDAG` to generate one)
- Call `tryLoadDAG(tmpDir)`
- Assert `result.dag` is not null
- Assert `result.dag.nodes` is an array
- Assert `result.path` ends with the canonical subpath

**Test 3c: Throws on malformed JSON (not ENOENT)**
- Create tmpdir with `.planning/sets/DAG.json` containing `"{ broken json"`
- Call `tryLoadDAG(tmpDir)` in a try/catch or `assert.throws`
- Assert the error is a SyntaxError (JSON parse error)
- Assert it does NOT return `{ dag: null }` (corruption != missing)

**Test 3d: Returns canonical path string even on ENOENT**
- Call `tryLoadDAG(tmpDir)` where `.planning/sets/` directory exists but no file
- Assert `result.path === path.join(tmpDir, '.planning', 'sets', 'DAG.json')`

**Test 3e: DAG_CANONICAL_SUBPATH is the expected value**
- Assert `DAG_CANONICAL_SUBPATH === path.join('.planning', 'sets', 'DAG.json')`

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/dag.test.cjs 2>&1 | tail -5
```
All tests should pass.

---

## Success Criteria

1. `tryLoadDAG` function exists in dag.cjs and is exported
2. `DAG_CANONICAL_SUBPATH` constant is exported
3. All existing dag.test.cjs tests still pass
4. New tryLoadDAG tests pass (ENOENT returns null, valid JSON returns parsed, malformed throws)
5. No changes to any consumer files (merge.cjs, plan.cjs, add-set.cjs) in this wave

## Files Modified

| File | Change Type |
|------|-------------|
| `src/lib/dag.cjs` | Add `fs`/`path` requires, `DAG_CANONICAL_SUBPATH`, `tryLoadDAG()`, update exports |
| `src/lib/dag.test.cjs` | Add `tryLoadDAG` describe block with 5 test cases |
