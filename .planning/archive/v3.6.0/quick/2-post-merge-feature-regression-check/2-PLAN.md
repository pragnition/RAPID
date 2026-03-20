# Quick Plan: Post-Merge Feature Regression Check

## Objective

Add automatic exported-symbol regression detection to the merge pipeline. After `git merge --no-ff` succeeds in `mergeSet()`, compare the union of exported symbols from both the base branch and set branch against the merged result. If any symbols present in EITHER parent disappeared after the merge, revert the merge and return a `feature_regression` failure -- preventing silent feature loss from bad conflict resolution or clobbered files.

---

## Task 1: Implement regression check functions and wire into mergeSet()

**Files:** `src/lib/merge.cjs`

### Action

#### 1a: Add `snapshotExports(cwd, ref, files)` helper (insert before `mergeSet()`, around line 1590)

Create a function that extracts exports from multiple code files at a given git ref. It should:
- Accept `cwd` (string), `ref` (string), `files` (string[])
- Filter files to code extensions only: `.js`, `.cjs`, `.mjs`, `.ts`, `.tsx`, `.jsx`, `.py`, `.go`, `.rs`
- For each matching file, call `getFileContent(cwd, ref, filePath)` and then `extractExports(content)` on the result
- Return a Map<string, string[]> where keys are file paths and values are arrays of exported symbol names
- If `getFileContent` returns null (file does not exist at that ref, e.g. newly created), return an empty array for that file

```javascript
const CODE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs']);

function snapshotExports(cwd, ref, files) {
  const path = require('path');
  const result = new Map();
  for (const file of files) {
    const ext = path.extname(file);
    if (!CODE_EXTENSIONS.has(ext)) continue;
    const content = getFileContent(cwd, ref, file);
    result.set(file, content ? extractExports(content) : []);
  }
  return result;
}
```

#### 1b: Add `checkFeatureRegression(cwd, preMergeRef, setBranch, postMergeRef, changedFiles)` function (insert after `snapshotExports`)

This function computes the expected export union and compares against the merged result:
- `preMergeRef` is the base branch HEAD before the merge
- `setBranch` is the set branch name (e.g. `rapid/my-set`)
- `postMergeRef` is HEAD after the merge
- `changedFiles` is the list of files changed by the merge (diff between preMergeRef and postMergeRef)
- Steps:
  1. Snapshot exports at `preMergeRef` for all `changedFiles` -> `baseExports`
  2. Snapshot exports at `setBranch` for all `changedFiles` -> `setExports`
  3. Snapshot exports at `postMergeRef` for all `changedFiles` -> `mergedExports`
  4. For each file that appears in any snapshot:
     - Compute `expectedExports` = union of `baseExports[file]` and `setExports[file]`
     - Compute `missingExports` = symbols in `expectedExports` but NOT in `mergedExports[file]`
     - If `missingExports` is non-empty, record a regression entry: `{ file, missing: [...missingExports], base: [...baseExports], set: [...setExports], merged: [...mergedExports] }`
  5. Return `{ hasRegression: boolean, regressions: [...] }`

```javascript
function checkFeatureRegression(cwd, preMergeRef, setBranch, postMergeRef, changedFiles) {
  const baseExports = snapshotExports(cwd, preMergeRef, changedFiles);
  const setExports = snapshotExports(cwd, setBranch, changedFiles);
  const mergedExports = snapshotExports(cwd, postMergeRef, changedFiles);

  const regressions = [];
  const allFiles = new Set([...baseExports.keys(), ...setExports.keys()]);

  for (const file of allFiles) {
    const baseSymbols = baseExports.get(file) || [];
    const setSymbols = setExports.get(file) || [];
    const mergedSymbols = mergedExports.get(file) || [];

    const expected = new Set([...baseSymbols, ...setSymbols]);
    const merged = new Set(mergedSymbols);
    const missing = [...expected].filter(s => !merged.has(s));

    if (missing.length > 0) {
      regressions.push({
        file,
        missing,
        base: baseSymbols,
        set: setSymbols,
        merged: mergedSymbols,
      });
    }
  }

  return { hasRegression: regressions.length > 0, regressions };
}
```

#### 1c: Modify `mergeSet()` to capture pre-merge HEAD and run regression check

In `mergeSet()` (lines 1597-1664):

1. **Capture pre-merge HEAD** -- add a line BEFORE the `git merge` call (before line 1640, after line 1635 `const branch = ...`):
   ```javascript
   const preMergeResult = worktree.gitExec(['rev-parse', 'HEAD'], projectRoot);
   const preMergeHead = preMergeResult.ok ? preMergeResult.stdout : '';
   ```

2. **Run regression check** -- add after line 1661 (`const commitHash = ...`) but BEFORE line 1663 (`return { merged: true, ... }`):
   ```javascript
   // Post-merge feature regression check
   if (preMergeHead) {
     try {
       const changedFilesResult = execFileSync(
         'git', ['diff', '--name-only', preMergeHead, 'HEAD'],
         { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe' }
       ).trim();
       const changedFiles = changedFilesResult ? changedFilesResult.split('\n').filter(l => l.trim()) : [];

       if (changedFiles.length > 0) {
         const regression = checkFeatureRegression(projectRoot, preMergeHead, branch, 'HEAD', changedFiles);
         if (regression.hasRegression) {
           // Revert the merge
           worktree.gitExec(['reset', '--hard', preMergeHead], projectRoot);
           return {
             merged: false,
             reason: 'feature_regression',
             detail: `Exported symbols lost after merge: ${regression.regressions.map(r => `${r.file} lost [${r.missing.join(', ')}]`).join('; ')}`,
             regressions: regression.regressions,
           };
         }
       }
     } catch (err) {
       // Regression check failure should not block the merge -- log and continue
       // The check is best-effort
     }
   }
   ```

3. **Do NOT change the return type for success.** The existing `return { merged: true, branch, commitHash }` remains untouched -- regression check only gates on failure.

#### 1d: Export the new functions

Add `snapshotExports` and `checkFeatureRegression` to `module.exports` (after `mergeSet` on line 2089):

```javascript
  // v3.6 Post-Merge Regression Check
  snapshotExports,
  checkFeatureRegression,
```

### Verification

```bash
cd /home/kek/Projects/RAPID && node -e "
const m = require('./src/lib/merge.cjs');

// Test 1: snapshotExports filters non-code files
console.assert(typeof m.snapshotExports === 'function', 'snapshotExports exported');
console.assert(typeof m.checkFeatureRegression === 'function', 'checkFeatureRegression exported');

// Test 2: extractExports still works (regression-safe)
const cjsExports = m.extractExports('module.exports = { foo, bar, baz };');
console.assert(cjsExports.includes('foo'), 'extracts foo');
console.assert(cjsExports.includes('bar'), 'extracts bar');
console.assert(cjsExports.length === 3, 'extracts 3 symbols');

// Test 3: snapshotExports skips non-code files
const snapshot = m.snapshotExports('.', 'HEAD', ['README.md', 'package.json']);
console.assert(snapshot.size === 0, 'non-code files skipped');

// Test 4: snapshotExports handles code files (use merge.cjs itself)
const snapshot2 = m.snapshotExports('.', 'HEAD', ['src/lib/merge.cjs']);
console.assert(snapshot2.size === 1, 'code file included');
const exports = snapshot2.get('src/lib/merge.cjs');
console.assert(exports.includes('mergeSet'), 'finds mergeSet export');
console.assert(exports.includes('snapshotExports'), 'finds snapshotExports export');

console.log('All Task 1 assertions passed');
"
```

### Done Criteria

- `snapshotExports()` filters to code extensions and returns a Map of file -> export names
- `checkFeatureRegression()` computes the union of exports from both parents, flags missing symbols
- `mergeSet()` captures preMergeHead before the merge command
- `mergeSet()` runs regression check after merge success, reverts and returns `feature_regression` if symbols are lost
- Both new functions are exported from `module.exports`
- Regression check failure (error in the check itself) does NOT block the merge

---

## Task 2: Handle feature_regression in the command handler and update agent/skill docs

**Files:** `src/commands/merge.cjs`, `skills/merge/SKILL.md`, `agents/rapid-set-merger.md`

### Action

#### 2a: Update `src/commands/merge.cjs` execute handler (lines 38-63)

After the existing `if (result.merged)` block (line 45), add an `else if` clause for feature regression:

```javascript
else if (result.reason === 'feature_regression') {
  // Write regression details to MERGE-STATE for agent consumption
  await merge.ensureMergeState(cwd, setName, {
    status: 'regression_detected',
    regressionDetail: result.detail,
    regressions: result.regressions || [],
    detectedAt: new Date().toISOString(),
  });
}
```

This goes between the `if (result.merged)` block's closing brace (around line 61) and the `output(JSON.stringify(result))` call (line 62). The output call remains last -- it always emits the result JSON.

#### 2b: Update `skills/merge/SKILL.md` Step 6

After the existing `merged: false, reason: 'conflict'` handling block (around line 393), add a new handler block for feature regression:

```markdown
- If `merged: false, reason: 'feature_regression'`:
  > **Feature regression detected** in set '{setName}'
  > The merge was automatically reverted because exported symbols were lost.
  > Detail: {detail}
  >
  > **Regressions:**
  > {for each regression in regressions: "- `{file}`: lost exports [{missing joined by ', '}]"}

  Use AskUserQuestion:
  - **question:** "Feature regression in {setName}"
  - **options:**
    - "Investigate" -- description: "View file diffs and exported symbols for the regressed files"
    - "Re-dispatch resolver" -- description: "Send back to set-merger for semantic re-analysis of affected files"
    - "Force merge" -- description: "Override regression check and merge anyway (not recommended)"
    - "Abort pipeline" -- description: "Exit merge pipeline"

  If "Investigate": display the regression details (base exports, set exports, merged exports for each file) and show `git diff` for affected files between preMergeHead and the set branch. Then present resolve/abort options.
  If "Re-dispatch resolver": re-run Step 3c for this set with the regression data included in the launch briefing.
  If "Force merge": re-run `node "${RAPID_TOOLS}" merge execute {setName}` -- but note the regression check will fire again. To truly force, the user must resolve the export loss first.
  If "Abort pipeline": exit.
```

#### 2c: Update `agents/rapid-set-merger.md` awareness

Add a note at the end of the Rules section (after line 283 "Preserve both sets' intent where possible..."):

```markdown
- **Post-merge regression check exists.** After the orchestrator runs `merge execute`, `mergeSet()` automatically verifies that no exported symbols from either branch are lost in the merged result. If the check fails, the merge is reverted and returns `feature_regression`. If this happens after your resolution work, the orchestrator may re-dispatch you with regression data -- focus on the affected files and ensure your conflict resolutions preserve all exports from both branches.
```

### Verification

```bash
cd /home/kek/Projects/RAPID && grep -c "feature_regression" src/commands/merge.cjs && grep -c "feature_regression" skills/merge/SKILL.md && grep -c "regression" agents/rapid-set-merger.md
```

Expected: at least 1 match in each file.

```bash
cd /home/kek/Projects/RAPID && node -e "
// Verify merge.cjs command handler loads without errors
const handler = require('./src/commands/merge.cjs');
console.assert(typeof handler.handleMerge === 'function', 'handleMerge exported');
console.log('Command handler loads OK');
"
```

### Done Criteria

- `src/commands/merge.cjs` writes regression details to MERGE-STATE when `feature_regression` is returned
- `skills/merge/SKILL.md` Step 6 includes handling for `feature_regression` reason with user decision options
- `agents/rapid-set-merger.md` Rules section includes awareness of the post-merge regression check
- All files parse/load without errors

---

## Task 3: Add unit tests for the regression check

**Files:** `tests/merge-regression.test.cjs` (new file)

### Action

Create a focused test file that validates the regression check logic in isolation (without requiring actual git merges). Tests should:

1. **Test `snapshotExports` extension filtering:**
   - Pass a list of mixed files (`.js`, `.md`, `.json`, `.cjs`, `.py`)
   - Assert only code files are processed
   - Assert non-code files are skipped (not in the returned Map)

2. **Test `snapshotExports` with real repo files:**
   - Call `snapshotExports('.', 'HEAD', ['src/lib/merge.cjs'])`
   - Assert the result contains known exports like `mergeSet`, `extractExports`

3. **Test `checkFeatureRegression` with synthetic content:**
   - Create a temporary git repo with:
     - A base branch with a file exporting `[foo, bar, baz]`
     - A feature branch with the same file exporting `[foo, bar, baz, newFeature]`
     - A simulated "bad merge" commit where the file only exports `[foo, bar]` (lost `baz` and `newFeature`)
   - Run `checkFeatureRegression` and assert:
     - `hasRegression` is true
     - `regressions[0].missing` contains `baz` and `newFeature`
     - `regressions[0].file` is the correct path

4. **Test `checkFeatureRegression` clean merge scenario:**
   - Same setup but the "merge" commit preserves all exports `[foo, bar, baz, newFeature]`
   - Assert `hasRegression` is false

5. **Test that `extractExports` handles the union correctly:**
   - Base has `module.exports = { a, b, c }`
   - Set has `module.exports = { b, c, d }`
   - Merged has `module.exports = { a, b, c, d }` -> no regression
   - Merged has `module.exports = { a, b, d }` -> regression (lost `c`)

Use Node's built-in `node:test` runner (`describe`, `it`, `assert`). Use `execFileSync` to set up temporary git repos in `os.tmpdir()`. Clean up temp dirs in `after()`.

### Verification

```bash
cd /home/kek/Projects/RAPID && node --test tests/merge-regression.test.cjs
```

All tests should pass.

### Done Criteria

- Test file covers extension filtering, real repo snapshot, regression detection (positive and negative cases)
- Tests use temporary git repos for integration scenarios
- All tests pass with `node --test`
- Tests clean up temporary directories
