# PLAN: resolve-fix / Wave 2

## Objective

Update `resolve.test.cjs` to work with the STATE.json-based resolution introduced in Wave 1. Existing tests must create STATE.json files alongside mock set directories (for the disk-fallback path). Add new tests for archive-resilient resolution, explicit state parameter, and milestone-context error messages.

## Files Modified

| File | Action |
|------|--------|
| `src/lib/resolve.test.cjs` | Modify -- update existing tests, add new test groups |

## Prerequisite

Wave 1 must be complete. `resolve.cjs` must have the updated `resolveSet(input, cwd, state?)` signature and `resolveWave` must no longer call `plan.listSets()`.

## Tasks

### Task 1: Add createMockState helper and update createMockSets

**File:** `src/lib/resolve.test.cjs`

**Actions:**
1. Add a new helper function `createMockState(cwd, setNames)` that:
   - Creates a `.planning/STATE.json` file at `cwd` with a valid ProjectState structure.
   - Uses `currentMilestone: 'v1.0'` and a single milestone with sets derived from `setNames`.
   - Each set gets `status: 'pending'` and `waves: []`.
   - Uses `JSON.stringify` with 2-space indent.
   - Example:
     ```javascript
     function createMockState(cwd, setNames) {
       const stateFile = path.join(cwd, '.planning', 'STATE.json');
       fs.mkdirSync(path.join(cwd, '.planning'), { recursive: true });
       const state = {
         version: 1,
         projectName: 'test-project',
         currentMilestone: 'v1.0',
         milestones: [{
           id: 'v1.0',
           name: 'v1.0',
           sets: setNames.map(name => ({ id: name, status: 'pending', waves: [] })),
         }],
         lastUpdatedAt: new Date().toISOString(),
         createdAt: new Date().toISOString(),
       };
       fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
     }
     ```
2. Place this helper after the existing `createMockSets` helper (around line 28).
3. Do NOT modify or remove `createMockSets` -- it is still needed for some edge case tests.

**Verification:**
```bash
node -c src/lib/resolve.test.cjs && echo "Syntax OK"
```

### Task 2: Update existing resolveSet disk-fallback tests

**File:** `src/lib/resolve.test.cjs`

**Actions:**
1. In every existing `resolveSet` test that calls `createMockSets(tmpDir, [...])`, add a corresponding `createMockState(tmpDir, [...])` call immediately after it (with the same set names). This creates the STATE.json that the disk-fallback path now reads.
2. Update the test descriptions where they say "alphabetically-sorted" to say "milestone-ordered" (e.g., line 64: `'resolves "1" to first milestone-ordered set'`).
3. For the tests in the "error cases" group:
   - **"throws when no sets exist"** (line 168): Instead of just creating `.planning/sets/`, create a STATE.json with an empty sets array: `createMockState(tmpDir, [])`. Update the expected error message to include milestone context: `"No sets found in current milestone 'v1.0'. Run /rapid:init first."`
   - **"throws when .planning/sets/ directory does not exist"** (line 177): This test should now verify that with NO STATE.json file, the error is: `"No STATE.json found. Run /rapid:init first to initialize the project."` Remove the `createMockSets` setup (there was none anyway). Just ensure no STATE.json exists in tmpDir.
   - **"throws on nonexistent string ID"** (line 184): Add `createMockState(tmpDir, [...])` with the same set names. The error message stays the same since it lists available sets from the state.

**What NOT to do:**
- Do NOT change the actual assertion values for numeric/string resolution results -- the resolvedId, numericIndex, and wasNumeric fields remain the same. Only the ordering source changed (STATE.json insertion order vs filesystem alphabetical), and in these tests the order is the same.

**Verification:**
```bash
node --test src/lib/resolve.test.cjs 2>&1 | tail -20
```

### Task 3: Update existing resolveWave tests that use createMockSets

**File:** `src/lib/resolve.test.cjs`

**Actions:**
1. In the `resolveWave -- numeric dot notation (UX-02)` describe block (line 196), the `beforeEach` at line 224 calls `createMockSets`. Add `createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui'])` alongside it.
2. In the `resolveWave -- string ID backward compat (UX-03)` describe block (line 276), the `beforeEach` at line 295 calls `createMockSets`. Add `createMockState(tmpDir, ['set-01-api', 'set-02-data'])` alongside it.
3. In the `resolveWave -- error cases` describe block (line 312), the `beforeEach` at line 324 calls `createMockSets`. Add `createMockState(tmpDir, ['set-01-api'])` alongside it.
4. In the `resolveWave -- edge cases` describe block (line 381):
   - The `'handles single set with single wave'` test (line 382) calls `createMockSets` inline. Add `createMockState(tmpDir, ['only-set'])` after it.
   - The `'resolveWave with set not in state throws descriptive error'` test (line 403) calls `createMockSets`. Add `createMockState(tmpDir, ['set-01-api'])` after it. This test verifies that when the set IS in STATE.json but NOT in the milestone's sets within state (the `emptyState` variable), the error fires. The mock STATE.json on disk is only for the disk-fallback in `resolveSet` -- the test passes `emptyState` explicitly to `resolveWave`.
5. In the `resolveWave -- with setId parameter (FLOW-01)` describe block (line 417), the `beforeEach` at line 438 calls `createMockSets`. Add `createMockState(tmpDir, ['set-01-api', 'set-02-data'])` alongside it.

**Verification:**
```bash
node --test src/lib/resolve.test.cjs 2>&1 | tail -30
```

### Task 4: Add new test group -- resolveSet with explicit state parameter

**File:** `src/lib/resolve.test.cjs`

**Actions:**
1. Add a new describe block `'resolveSet -- explicit state parameter'` after the existing resolveSet error cases (after line 191).
2. Add these tests:
   - **"resolves numeric index from provided state"**: Create a state with `makeState([{id: 'alpha', ...}, {id: 'beta', ...}, {id: 'gamma', ...}])`. Call `resolveSet('2', tmpDir, state)`. Assert result is `{ resolvedId: 'beta', numericIndex: 2, wasNumeric: true }`. No mock dirs or STATE.json needed on disk since state is provided.
   - **"resolves string ID from provided state"**: Same state. Call `resolveSet('gamma', tmpDir, state)`. Assert `{ resolvedId: 'gamma', numericIndex: 3, wasNumeric: false }`.
   - **"uses milestone ordering, not alphabetical"**: Create state with sets in non-alphabetical order: `['zebra', 'apple', 'mango']`. Call `resolveSet('1', tmpDir, state)`. Assert resolvedId is `'zebra'` (first in milestone, not alphabetically first). This is the key behavioral test for the fix.
   - **"throws on out-of-range with state-provided sets"**: State has 2 sets. Call `resolveSet('5', tmpDir, state)`. Assert error with valid range 1-2.

**Verification:**
```bash
node --test --test-name-pattern="explicit state" src/lib/resolve.test.cjs
```

### Task 5: Add new test group -- archive-resilient resolution

**File:** `src/lib/resolve.test.cjs`

**Actions:**
1. Add a new describe block `'resolveSet -- archive-resilient resolution'` after the explicit state parameter tests.
2. Add these tests:
   - **"resolves numeric index when no .planning/sets/ directories exist"**: Create STATE.json via `createMockState(tmpDir, ['set-a', 'set-b', 'set-c'])` but do NOT create any `.planning/sets/` directories. Call `resolveSet('2', tmpDir)` (disk-fallback path). Assert resolvedId is `'set-b'`. This proves resolution works even when set directories have been archived.
   - **"resolves string ID when no .planning/sets/ directories exist"**: Same setup. Call `resolveSet('set-c', tmpDir)`. Assert resolvedId is `'set-c'` and numericIndex is 3.
   - **"ordering matches STATE.json, not filesystem"**: Create STATE.json with sets `['zebra', 'apple', 'mango']`. Also create `.planning/sets/apple/`, `.planning/sets/mango/`, `.planning/sets/zebra/` directories on disk. Call `resolveSet('1', tmpDir)` (disk-fallback). Assert resolvedId is `'zebra'` (STATE.json order), NOT `'apple'` (alphabetical filesystem order).

**Verification:**
```bash
node --test --test-name-pattern="archive-resilient" src/lib/resolve.test.cjs
```

### Task 6: Add new test group -- resolveWave with state-based set indexing

**File:** `src/lib/resolve.test.cjs`

**Actions:**
1. Add a new describe block `'resolveWave -- state-based set indexing'` after the archive-resilient tests.
2. Add these tests:
   - **"string wave ID returns milestone-ordered setIndex"**: Create a state with sets `['zebra-set', 'apple-set']` where `zebra-set` has wave `wave-01`. Also create STATE.json on disk with the same ordering. Call `resolveWave('wave-01', state, tmpDir)`. Assert `setIndex` is 1 (milestone order), proving the string wave ID path now uses `milestone.sets.findIndex()` instead of `plan.listSets()`.
   - **"dot notation resolves set index from milestone order, not filesystem"**: Create STATE.json with sets `['zebra-set', 'apple-set']` (non-alphabetical). Create matching `.planning/sets/` dirs. State has `zebra-set` with `[{ id: 'wave-01', ... }]` and `apple-set` with `[{ id: 'wave-01', ... }]`. Call `resolveWave('1.1', state, tmpDir)`. Assert setId is `'zebra-set'` (index 1 from STATE.json, not alphabetical).

**Verification:**
```bash
node --test --test-name-pattern="state-based set indexing" src/lib/resolve.test.cjs
```

### Task 7: Run full test suite and verify all pass

**Actions:**
1. Run the complete test file.
2. All tests must pass. Zero failures, zero skips.

**Verification:**
```bash
node --test src/lib/resolve.test.cjs
echo "Exit code: $?"
```

## Success Criteria

1. All existing tests pass (updated with STATE.json creation where needed).
2. New "explicit state parameter" tests verify that `resolveSet` correctly uses passed state.
3. New "archive-resilient resolution" tests prove numeric indices resolve from STATE.json even when `.planning/sets/` directories do not exist on disk.
4. New "state-based set indexing" tests prove `resolveWave`'s string ID path uses milestone ordering.
5. The "uses milestone ordering, not alphabetical" test explicitly proves the ordering fix works.
6. Zero test failures, zero skips.
7. Test file passes syntax check.
