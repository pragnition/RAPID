# PLAN: resolve-fix / Wave 1

## Objective

Switch `resolveSet()` and `resolveWave()` from filesystem-based resolution (`plan.listSets()`) to STATE.json-based resolution (`milestone.sets[]` array). Update the CLI handler in `rapid-tools.cjs` to load STATE.json before calling `resolveSet`. After this wave, resolve.cjs has zero calls to `plan.listSets()`.

## Files Modified

| File | Action |
|------|--------|
| `src/lib/resolve.cjs` | Modify -- rewrite both functions to use STATE.json |
| `src/bin/rapid-tools.cjs` | Modify -- update `resolve set` CLI handler |

## Tasks

### Task 1: Update imports in resolve.cjs

**File:** `src/lib/resolve.cjs`

**Actions:**
1. Remove the `const plan = require('./plan.cjs');` import (line 3).
2. Add `const fs = require('fs');` and `const path = require('path');` imports at the top (needed for disk-fallback path to read STATE.json synchronously).
3. Keep both regex constants (`NUMERIC_SET_PATTERN`, `NUMERIC_WAVE_PATTERN`) unchanged.

**Verification:**
```bash
node -e "require('./src/lib/resolve.cjs')" && echo "Module loads OK"
```

### Task 2: Add internal helper to load state from disk

**File:** `src/lib/resolve.cjs`

**Actions:**
1. Add a private helper function `_loadStateFromDisk(cwd)` that:
   - Reads `.planning/STATE.json` from `cwd` using `fs.readFileSync` (keeps the function synchronous -- important because `resolveSet` is synchronous).
   - Parses the JSON.
   - Returns the parsed state object.
   - Throws a user-friendly error if the file does not exist: `"No STATE.json found. Run /rapid:init first to initialize the project."`
   - Throws a user-friendly error if the JSON is malformed: `"STATE.json is corrupted. Re-run /rapid:init to reinitialize."`
2. Place this helper between the constants and `resolveSet`.

**What NOT to do:**
- Do NOT use `state-machine.cjs`'s `readState()` -- it is async and uses Zod validation. The resolve functions are synchronous and must stay that way.
- Do NOT export this helper -- it is internal only.

**Verification:**
```bash
node -e "require('./src/lib/resolve.cjs')" && echo "Module loads OK"
```

### Task 3: Rewrite resolveSet to use STATE.json

**File:** `src/lib/resolve.cjs`

**Actions:**
1. Change the function signature from `resolveSet(input, cwd)` to `resolveSet(input, cwd, state)` where `state` is an optional third parameter.
2. Replace the body with this logic:
   - If `state` is not provided, call `state = _loadStateFromDisk(cwd)`.
   - Find the current milestone: `const milestone = state.milestones.find(m => m.id === state.currentMilestone)`.
   - If milestone not found, throw: `"Current milestone '${state.currentMilestone}' not found in state."`
   - Extract set IDs: `const sets = milestone.sets.map(s => s.id)`.
   - If `sets.length === 0`, throw: `"No sets found in current milestone '${state.currentMilestone}'. Run /rapid:init first."` (note: milestone context added per CONTEXT.md decision).
   - Numeric path (when `NUMERIC_SET_PATTERN.test(input)`): Parse the index, validate > 0, validate <= sets.length, return `{ resolvedId: sets[index - 1], numericIndex: index, wasNumeric: true }`. Error messages remain the same as current (keep "Use /rapid:status to see available sets.").
   - String path: Find index with `sets.indexOf(input)`. If -1, throw: `"Set '${input}' not found. Available sets: ${sets.join(', ')}"`. Otherwise return `{ resolvedId: input, numericIndex: idx + 1, wasNumeric: false }`.
3. Update the JSDoc to document the new `state` parameter as optional.

**Key behavioral change:** Numeric indices now resolve against milestone ordering (insertion order in STATE.json), NOT alphabetical filesystem ordering. This is intentional and the whole point of the fix.

**Verification:**
```bash
node -e "
const r = require('./src/lib/resolve.cjs');
// Should throw because no STATE.json in /tmp
try { r.resolveSet('1', '/tmp'); } catch(e) { console.log('Expected error:', e.message); }
console.log('Function accepts 3 args:', r.resolveSet.length >= 2);
"
```

### Task 4: Update resolveWave to pass state through to resolveSet

**File:** `src/lib/resolve.cjs`

**Actions:**
1. **Line 77** (--set flag path): Change `resolveSet(setId, cwd)` to `resolveSet(setId, cwd, state)`.
2. **Line 125** (dot notation path): Change `resolveSet(String(setIndex), cwd)` to `resolveSet(String(setIndex), cwd, state)`.
3. **Lines 166-167** (string wave ID path): Replace the `plan.listSets(cwd)` call and `sets.indexOf()` with:
   ```javascript
   const setIndex = milestone.sets.findIndex(s => s.id === setInState.id) + 1;
   ```
   This computes the set index from the milestone's sets array (which is already available via the `milestone` variable on line 156) instead of the filesystem.
4. After these changes, there should be ZERO remaining references to `plan` in resolve.cjs.

**Verification:**
```bash
# Confirm no plan.listSets references remain
grep -c 'plan.listSets' src/lib/resolve.cjs && echo "FAIL: still has plan.listSets" || echo "PASS: no plan.listSets"
grep -c "require.*plan" src/lib/resolve.cjs && echo "FAIL: still imports plan" || echo "PASS: no plan import"
```

### Task 5: Update resolve set CLI handler in rapid-tools.cjs

**File:** `src/bin/rapid-tools.cjs`

**Actions:**
1. In the `handleResolve` function's `case 'set':` block (lines 2614-2626), add STATE.json loading before calling `resolveSet`. Follow the exact same pattern used by the `case 'wave':` block (lines 2635-2638):
   ```javascript
   const sm = require('../lib/state-machine.cjs');
   const stateResult = await sm.readState(cwd);
   if (!stateResult || !stateResult.valid) {
     throw new Error('Cannot read STATE.json. Run /rapid:plan first to initialize state.');
   }
   ```
2. Change the `resolveSet` call from `resolveLib.resolveSet(input, cwd)` to `resolveLib.resolveSet(input, cwd, stateResult.state)`.
3. This ensures the CLI always passes state explicitly, avoiding the disk-fallback path (which is kept for programmatic callers that may not have state handy).

**Verification:**
```bash
# Syntax check on rapid-tools.cjs
node -c src/bin/rapid-tools.cjs && echo "Syntax OK"
```

### Task 6: Run existing tests to verify backward compatibility

**Actions:**
1. Run the existing test suite to confirm that the disk-fallback path works (since existing tests do not pass `state` to `resolveSet`).
2. Existing tests create mock `.planning/sets/` directories on the filesystem. Since the disk-fallback now reads STATE.json instead, **tests will fail** -- this is expected and confirms the tests need updating in Wave 2.
3. The key thing to verify at this stage: `resolve.cjs` and `rapid-tools.cjs` load without errors and the resolve functions have the correct signatures.

**Verification:**
```bash
# Module load check (no runtime errors on require)
node -e "const r = require('./src/lib/resolve.cjs'); console.log('resolveSet params:', r.resolveSet.length); console.log('resolveWave params:', r.resolveWave.length);"
# Syntax check
node -c src/lib/resolve.cjs && echo "resolve.cjs syntax OK"
node -c src/bin/rapid-tools.cjs && echo "rapid-tools.cjs syntax OK"
```

## Success Criteria

1. `resolve.cjs` has zero references to `plan.listSets` or `require('./plan.cjs')`.
2. `resolveSet` accepts an optional third `state` parameter.
3. When `state` is provided, `resolveSet` resolves numeric indices against `milestone.sets[]`.
4. When `state` is omitted, `resolveSet` reads STATE.json from disk synchronously.
5. `resolveWave`'s string ID path (lines 162-176) no longer calls `plan.listSets()`.
6. The `resolve set` CLI handler loads STATE.json and passes it to `resolveSet`.
7. Both files pass syntax checks (`node -c`).
