# PLAN: path-and-dag / Wave 2

**Objective:** Propagate the new `resolveProjectRoot()`, `DAG_SUBPATH`, and `ensureDagExists()` exports from core.cjs to all consumers. Fix the DAG.json path bug in commands/merge.cjs. Add DAG generation step to `/new-version` SKILL.md. Update the regression test for the new export name.

This wave depends on Wave 1 being complete (core.cjs exports must exist).

---

## Task 1: Migrate plan.cjs to import from core.cjs

**File:** `src/lib/plan.cjs`

**Action:**
1. Add `const { resolveProjectRoot } = require('./core.cjs');` to the imports (near line 18, after the existing requires).
2. Remove the entire local `resolveProjectRoot()` function definition (lines 27-75, including the section comment block above it starting at line 23).
3. Replace `const { DAG_CANONICAL_SUBPATH } = require('./dag.cjs');` (line 20) with `const { DAG_SUBPATH } = require('./core.cjs');` -- but FIRST check if `DAG_CANONICAL_SUBPATH` is used elsewhere in plan.cjs and replace all references with `DAG_SUBPATH`.

**What NOT to do:**
- Do NOT change any function signatures or behavior in plan.cjs beyond the import swap.
- Do NOT remove `resolveProjectRoot` usage -- only change where it comes from.

**Verification:**
```bash
node -e "const p = require('./src/lib/plan.cjs'); console.log('plan.cjs loads OK')"
```

---

## Task 2: Migrate ui-contract.cjs to import from core.cjs

**File:** `src/lib/ui-contract.cjs`

**Action:**
1. Add `const { resolveProjectRoot } = require('./core.cjs');` to the imports (after line 18).
2. Remove the entire local `resolveProjectRoot()` function definition (lines 25-67, including the section comment block starting at line 21).
3. Remove `const { execSync } = require('child_process');` from line 17 IF it is no longer used anywhere else in the file. Search the file for other `execSync` calls first.

**What NOT to do:**
- Do NOT change the call sites at lines ~132 and ~337 that pass `cwd` to `resolveProjectRoot(cwd)`. The new core.cjs signature is compatible.

**Verification:**
```bash
node -e "const u = require('./src/lib/ui-contract.cjs'); console.log('ui-contract.cjs loads OK')"
```

---

## Task 3: Fix DAG.json path bug in commands/merge.cjs

**File:** `src/commands/merge.cjs`

**Action:**
1. Add `const { DAG_SUBPATH } = require('../lib/core.cjs');` to the imports at the top.
2. At line 274, replace:
   ```javascript
   const dagPath = path.join(cwd, '.planning', 'DAG.json');
   ```
   with:
   ```javascript
   const dagPath = path.join(cwd, DAG_SUBPATH);
   ```
   This fixes the bug where `sets/` segment was missing from the path.

**Verification:**
```bash
node -e "const { DAG_SUBPATH } = require('./src/lib/core.cjs'); console.log(DAG_SUBPATH)"
# Should show .planning/sets/DAG.json
grep -n "DAG_SUBPATH" src/commands/merge.cjs
# Should show the import and the usage
grep -n "planning.*DAG" src/commands/merge.cjs
# Should NOT show any hardcoded .planning/DAG.json (without sets)
```

---

## Task 4: Replace DAG path construction in commands/execute.cjs with ensureDagExists

**File:** `src/commands/execute.cjs`

**Action:**
1. Add `const { ensureDagExists, DAG_SUBPATH } = require('../lib/core.cjs');` to the imports.
2. At line ~88-93 (the `wave-status` DAG loading block), replace:
   ```javascript
   let dagJson = null;
   try {
     const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
     dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
   } catch (err) {
     throw new CliError('No DAG.json found. Run /rapid:plan first to create sets and DAG.');
   }
   ```
   with:
   ```javascript
   let dagJson = null;
   try {
     const dagPath = ensureDagExists(cwd);
     dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
   } catch (err) {
     throw new CliError(err.message);
   }
   ```
3. At line ~260-266 (the `reconcile` DAG loading block), apply the same pattern:
   ```javascript
   let dagJson;
   try {
     const dagPath = ensureDagExists(cwd);
     dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
   } catch (err) {
     throw new CliError(err.message);
   }
   ```

**Verification:**
```bash
node -e "require('./src/commands/execute.cjs'); console.log('execute.cjs loads OK')"
```

---

## Task 5: Replace DAG_CANONICAL_SUBPATH in dag.cjs with core.cjs import

**File:** `src/lib/dag.cjs`

**Action:**
1. Add `const { DAG_SUBPATH } = require('./core.cjs');` to the imports (after line 4).
2. Remove the local `DAG_CANONICAL_SUBPATH` constant at line 25.
3. Replace ALL references to `DAG_CANONICAL_SUBPATH` with `DAG_SUBPATH` throughout the file.
4. Update the `module.exports` to export `DAG_SUBPATH` instead of `DAG_CANONICAL_SUBPATH` (or add `DAG_CANONICAL_SUBPATH: DAG_SUBPATH` as an alias for backward compatibility if other files import it).
5. Check if any other file imports `DAG_CANONICAL_SUBPATH` from dag.cjs. If so, add a re-export alias: `DAG_CANONICAL_SUBPATH: DAG_SUBPATH` in dag.cjs exports. The plan.cjs import was already switched in Task 1.

**Verification:**
```bash
node -e "const d = require('./src/lib/dag.cjs'); console.log(d.DAG_SUBPATH || d.DAG_CANONICAL_SUBPATH)"
# Should print .planning/sets/DAG.json
```

---

## Task 6: Switch rapid-tools.cjs from findProjectRoot to resolveProjectRoot

**File:** `src/bin/rapid-tools.cjs`

**Action:**
1. At line 4, change the destructured import:
   ```javascript
   const { output, error, findProjectRoot } = require('../lib/core.cjs');
   ```
   to:
   ```javascript
   const { output, error, resolveProjectRoot } = require('../lib/core.cjs');
   ```
2. At line 200, change:
   ```javascript
   cwd = findProjectRoot();
   ```
   to:
   ```javascript
   cwd = resolveProjectRoot();
   ```

**Verification:**
```bash
grep -n "findProjectRoot\|resolveProjectRoot" src/bin/rapid-tools.cjs
# Should show only resolveProjectRoot references
```

---

## Task 7: Switch misc.cjs from findProjectRoot to resolveProjectRoot

**File:** `src/commands/misc.cjs`

**Action:**
1. At line 116, change:
   ```javascript
   const { findProjectRoot } = require('../lib/core.cjs');
   ```
   to:
   ```javascript
   const { resolveProjectRoot } = require('../lib/core.cjs');
   ```
2. At line 140, change:
   ```javascript
   cwd = findProjectRoot();
   ```
   to:
   ```javascript
   cwd = resolveProjectRoot();
   ```

**Verification:**
```bash
grep -n "findProjectRoot\|resolveProjectRoot" src/commands/misc.cjs
# Should show only resolveProjectRoot references
```

---

## Task 8: Add DAG generation step to /new-version SKILL.md

**File:** `skills/new-version/SKILL.md`

**Action:**
1. After the "Accept" branch in Step 8 (after the STATE.json write at step 3, around line 576-578), add a new numbered step **4** (renumber subsequent items):

   ```markdown
   4. Generate DAG.json from the new set definitions:
      ```bash
      node "${RAPID_TOOLS}" dag generate
      ```
      Verify DAG.json was created:
      ```bash
      test -f .planning/sets/DAG.json && echo "DAG.json exists" || echo "WARNING: DAG.json not created"
      ```
      If DAG.json was not created, warn the user: "DAG.json generation failed. You can generate it manually with `dag generate` or during `/rapid:plan-set`."
   ```

2. Update the "Confirm" line after the steps to mention DAG: `Confirm: "Roadmap written, DAG generated, and state updated."`

**What NOT to do:**
- Do NOT modify any other steps in the SKILL.md.
- Do NOT change the research pipeline or roadmap approval flow.

**Verification:**
```bash
grep -n "dag generate\|DAG.json" skills/new-version/SKILL.md
# Should show the new DAG generation step
```

---

## Task 9: Update merge regression test for new exports

**File:** `tests/merge-regression.test.cjs`

**Action:**
1. At line 67, the test checks `exports.includes('findProjectRoot')`. Add an additional assertion for the new export:
   ```javascript
   assert.ok(exports.includes('resolveProjectRoot'), 'should find resolveProjectRoot export');
   ```
   Keep the `findProjectRoot` assertion (it is still exported as a deprecation wrapper).

**Verification:**
```bash
node --test tests/merge-regression.test.cjs
# All tests should pass
```

---

## Success Criteria

1. `plan.cjs` imports `resolveProjectRoot` from `core.cjs` -- no local definition
2. `ui-contract.cjs` imports `resolveProjectRoot` from `core.cjs` -- no local definition
3. `commands/merge.cjs` line 274 uses `DAG_SUBPATH` and resolves to `.planning/sets/DAG.json`
4. `commands/execute.cjs` uses `ensureDagExists()` at both DAG loading sites
5. `dag.cjs` imports `DAG_SUBPATH` from `core.cjs` -- no local `DAG_CANONICAL_SUBPATH` definition
6. `rapid-tools.cjs` and `misc.cjs` use `resolveProjectRoot()` -- zero `findProjectRoot` call sites remain (except the export in core.cjs)
7. `/new-version` SKILL.md includes a DAG generation step after contract/state writes
8. All existing tests pass: `node --test src/lib/core.test.cjs && node --test tests/merge-regression.test.cjs`
9. Zero hardcoded DAG.json path strings remain outside of core.cjs (verify with grep)

## Files Modified

| File | Action |
|------|--------|
| `src/lib/plan.cjs` | Remove local resolveProjectRoot, import from core.cjs; switch DAG_CANONICAL_SUBPATH to DAG_SUBPATH |
| `src/lib/ui-contract.cjs` | Remove local resolveProjectRoot, import from core.cjs |
| `src/commands/merge.cjs` | Fix DAG path bug with DAG_SUBPATH import |
| `src/commands/execute.cjs` | Replace inline DAG checks with ensureDagExists |
| `src/lib/dag.cjs` | Replace local DAG_CANONICAL_SUBPATH with core.cjs import |
| `src/bin/rapid-tools.cjs` | Switch findProjectRoot to resolveProjectRoot |
| `src/commands/misc.cjs` | Switch findProjectRoot to resolveProjectRoot |
| `skills/new-version/SKILL.md` | Add DAG generation step after roadmap acceptance |
| `tests/merge-regression.test.cjs` | Add resolveProjectRoot export assertion |
