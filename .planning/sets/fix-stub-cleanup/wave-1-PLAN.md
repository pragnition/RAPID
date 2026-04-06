# PLAN: fix-stub-cleanup / Wave 1

**Objective:** Close all three actionable gaps from the v6.0.0 audit report -- wire `cleanupStubSidecars()` into the merge pipeline, and fix two stale CONTRACT.json metadata values.

**Wave:** 1 of 1

---

## Task 1: Wire `cleanupStubSidecars()` into merge pipeline

**File:** `src/lib/merge.cjs`

**Why:** The `cleanupStubSidecars()` function exists and is tested, but was never called from the merge pipeline. After conflict resolution completes, `.rapid-stub.*.bak` sidecar files can remain in the project tree. This wires the existing function into both the solo-mode and normal-mode return paths of `mergeSet()`.

**Implementation:**

1. **Solo-mode path (line 1742-1749).** Insert a cleanup block between the `gitExec(['rev-parse', 'HEAD'])` call (line 1743) and the `return` statement (line 1744). The block should:
   - Call `stub.cleanupStubSidecars(projectRoot)` inside a try/catch
   - On success, capture the `cleaned` count from the return value `{ cleaned: number, files: string[] }`
   - On failure, set `stubsCleanedUp = 0` and log a warning: `console.warn('[merge] stub sidecar cleanup failed (non-fatal):', err.message, '-- run scaffold verify-stubs manually');`
   - Add `stubsCleanedUp` to the solo-mode return object (alongside `merged`, `branch`, `commitHash`, `solo`)

2. **Normal-mode path (line 1832-1834).** Insert the same cleanup block after the regression check's closing brace (line 1832) and before the `return { merged: true, branch, commitHash };` (line 1834). Same pattern:
   - Call `stub.cleanupStubSidecars(projectRoot)` inside a try/catch
   - On success, capture the `cleaned` count
   - On failure, set `stubsCleanedUp = 0` and log a warning with the same message format
   - Add `stubsCleanedUp` to the normal-mode return object

3. **Implementation pattern.** Use a local helper to avoid duplicating the try/catch logic. Define it just before the solo-mode check (after line 1738, inside `mergeSet()`):
   ```
   let stubsCleanedUp = 0;
   function doStubCleanup() {
     try {
       const cleanup = stub.cleanupStubSidecars(projectRoot);
       stubsCleanedUp = cleanup.cleaned;
     } catch (err) {
       console.warn('[merge] stub sidecar cleanup failed (non-fatal):', err.message, '-- run scaffold verify-stubs manually');
       stubsCleanedUp = 0;
     }
   }
   ```
   Then call `doStubCleanup()` before each return path and include `stubsCleanedUp` in the return object.

4. **What NOT to do:**
   - Do NOT call cleanup before the regression check -- the merge could still be reverted at that point
   - Do NOT throw on cleanup failure -- stub sidecars are cosmetic, not functional
   - Do NOT change the return object shape for error/failure returns (only success returns get `stubsCleanedUp`)
   - Do NOT add a new import -- `stub` is already imported at line 35

**Verification:**
```bash
node -e "const m = require('./src/lib/merge.cjs'); console.log(typeof m.mergeSet)"
```
Confirm it prints `function` (no syntax errors introduced).

---

## Task 2: Add merge pipeline stub cleanup tests

**File:** `src/lib/merge.test.cjs`

**Why:** `mergeSet()` has zero direct test coverage. The new cleanup wiring needs at least focused tests confirming it calls `cleanupStubSidecars()` at the correct points.

**Implementation:**

1. **Add a new describe block** at the end of `merge.test.cjs` titled `'mergeSet stub cleanup wiring'`.

2. **Test approach: integration with a real temp git repo.** Since `mergeSet()` operates on real git repos (checkout, merge), the most reliable approach is to:
   - Create a temp directory with `fs.mkdtempSync(path.join(os.tmpdir(), 'merge-stub-test-'))`
   - Initialize a git repo with `execSync('git init && git commit --allow-empty -m "init"', { cwd: tmpDir })`
   - Create the necessary `.planning/` structure (worktree REGISTRY.json) for merge to read
   - Create a feature branch `rapid/test-set` with a commit
   - Place `.rapid-stub` sidecar files in the repo
   - Call `mergeSet(tmpDir, 'test-set', 'main')` (or whatever the default branch is)
   - Assert the return object includes `stubsCleanedUp` as a number

3. **Test cases:**

   a. **`mergeSet normal mode returns stubsCleanedUp field`**
      - Set up temp git repo with main branch and a `rapid/test-set` branch
      - Place a `.rapid-stub` sidecar file in the project root (e.g., `foo.cjs` + `foo.cjs.rapid-stub`)
      - Create a `.planning/worktrees/REGISTRY.json` with an entry for `test-set` that is NOT solo mode
      - Call `mergeSet(tmpDir, 'test-set', mainBranch)`
      - Assert `result.merged === true`
      - Assert `result.stubsCleanedUp` is a number (>= 0)

   b. **`mergeSet solo mode returns stubsCleanedUp field`**
      - Set up temp git repo
      - Create a `.planning/worktrees/REGISTRY.json` with `{ worktrees: { 'test-set': { solo: true, branch: 'main' } } }`
      - Call `mergeSet(tmpDir, 'test-set', mainBranch)`
      - Assert `result.merged === true`
      - Assert `result.solo === true`
      - Assert `result.stubsCleanedUp` is a number (>= 0)

   c. **`mergeSet continues when cleanupStubSidecars throws`**
      - This test validates the catch-and-continue behavior. Place a `.rapid-stub` sidecar inside a directory with restricted permissions (or use `node:test` mock to make `cleanupStubSidecars` throw)
      - Assert `result.merged === true` (merge still succeeds)
      - Assert `result.stubsCleanedUp === 0`

4. **Required imports to add at the top of merge.test.cjs:**
   - `const { execSync } = require('child_process');` (for git setup in tests)
   - `mergeSet` must already be imported (it is, at line 18 in the existing destructured import -- verify and add if missing)

5. **Cleanup:** Use `afterEach` to remove the temp directory with `fs.rmSync(tmpDir, { recursive: true, force: true })`.

6. **What NOT to do:**
   - Do NOT modify existing test cases -- only add new ones
   - Do NOT use `mock.module()` for the primary tests -- real git integration tests are more reliable for merge operations
   - Do NOT test `cleanupStubSidecars` behavior itself -- that is already covered in `stub.test.cjs`

**Verification:**
```bash
node --test src/lib/merge.test.cjs 2>&1 | tail -20
```
All existing and new tests must pass.

---

## Task 3: Fix dag-central-grouping CONTRACT.json export name

**File:** `.planning/sets/dag-central-grouping/CONTRACT.json`

**Why:** The CONTRACT.json says the export is named `migrateDAGv1toV2` (line 45), but the actual implementation in `dag.cjs` exports `migrateDAGv1toV3` (confirmed at lines 657, 784 of dag.cjs). The function migrates v1 directly to v3, not v1 to v2.

**Implementation:**

1. On line 45, change `"migrateDAGv1toV2"` to `"migrateDAGv1toV3"`
2. On line 47, change the signature from `"migrateDAGv1toV2(dagV1: object): DAGv2"` to `"migrateDAGv1toV3(dagV1: object): DAGv3"`
3. On line 48, change the description from `"Auto-migrates a v1 DAG to v2 format, preserving all existing data"` to `"Auto-migrates a v1 DAG to v3 format, preserving all existing data"`

**What NOT to do:**
- Do NOT change any other exports or fields in this file
- Do NOT modify the `migrateDAGv2toV3` entry (line 50-53) -- that one is correct

**Verification:**
```bash
node -e "const c = JSON.parse(require('fs').readFileSync('.planning/sets/dag-central-grouping/CONTRACT.json', 'utf-8')); console.log(Object.keys(c.exports).includes('migrateDAGv1toV3') && !Object.keys(c.exports).includes('migrateDAGv1toV2') ? 'PASS' : 'FAIL')"
```

---

## Task 4: Fix init-enhancements CONTRACT.json behavioral invariant

**File:** `.planning/sets/init-enhancements/CONTRACT.json`

**Why:** The CONTRACT.json says `claudeMdTokenBudget` must not exceed `15 lines` (line 34), but `principles.cjs` line 18 defines `CLAUDE_MD_LINE_BUDGET = 45`. The implementation uses 45 lines, not 15.

**Implementation:**

1. On line 34, change `"15 lines"` to `"45 lines"` in the description string

**What NOT to do:**
- Do NOT change any other fields in this file
- Do NOT modify the `enforced_by` value

**Verification:**
```bash
node -e "const c = JSON.parse(require('fs').readFileSync('.planning/sets/init-enhancements/CONTRACT.json', 'utf-8')); console.log(c.behavioral.claudeMdTokenBudget.description.includes('45 lines') ? 'PASS' : 'FAIL')"
```

---

## Success Criteria

1. `mergeSet()` calls `cleanupStubSidecars(projectRoot)` in both solo-mode and normal-mode success paths
2. Cleanup failures are caught and do not fail the merge
3. Both success return objects include `stubsCleanedUp: number`
4. All new tests pass: `node --test src/lib/merge.test.cjs`
5. All existing tests still pass: `node --test src/lib/merge.test.cjs`
6. dag-central-grouping CONTRACT.json exports key is `migrateDAGv1toV3` with matching signature/description
7. init-enhancements CONTRACT.json `claudeMdTokenBudget` description says `45 lines`
8. No other files modified

## File Ownership

| File | Action |
|------|--------|
| `src/lib/merge.cjs` | Modify (add cleanup wiring) |
| `src/lib/merge.test.cjs` | Modify (add test cases) |
| `.planning/sets/dag-central-grouping/CONTRACT.json` | Modify (fix export name) |
| `.planning/sets/init-enhancements/CONTRACT.json` | Modify (fix budget value) |
