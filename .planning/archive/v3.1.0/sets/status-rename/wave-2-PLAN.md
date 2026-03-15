# Wave 2: Runtime Consumers, All Remaining Tests, and Grep Verification

## Objective

Update all runtime code that uses old set status string literals (state-machine.cjs consumer code, worktree.cjs), update every remaining test file, and add a permanent grep-based verification test that ensures no old status literals survive in the codebase. After this wave, the full test suite passes and the rename is complete.

## Prerequisites

Wave 1 must be complete: `SetStatus` enum, `SET_TRANSITIONS`, and `migrateState()` must already use past-tense values.

## Tasks

### Task 1: Update status literals in state-machine.cjs (validateDiskArtifacts)

**File:** `src/lib/state-machine.cjs`

**Action:** Update the two `.includes()` arrays in `validateDiskArtifacts()`:

1. Line 243 -- Change:
   ```js
   if (['planning', 'executing', 'complete', 'merged'].includes(set.status)) {
   ```
   to:
   ```js
   if (['planned', 'executed', 'complete', 'merged'].includes(set.status)) {
   ```

2. Line 254 -- Change:
   ```js
   if (['executing', 'complete', 'merged'].includes(set.status)) {
   ```
   to:
   ```js
   if (['executed', 'complete', 'merged'].includes(set.status)) {
   ```

3. Update the JSDoc comment on lines 219-220:
   - `planning/executing/complete/merged` -> `planned/executed/complete/merged`
   - `executing/complete/merged` -> `executed/complete/merged`

**What NOT to do:** Do not touch `readState()`, `writeState()`, or `migrateState()` -- those were handled in Wave 1.

**Verification:** `node -e "const sm = require('./src/lib/state-machine.cjs'); console.log('OK')"`

---

### Task 2: Update status literals in worktree.cjs (STATUS_SORT_ORDER and deriveNextActions)

**File:** `src/lib/worktree.cjs`

**Action:**

1. **STATUS_SORT_ORDER** (line 681-688): Update the keys that are set-level status values:
   ```js
   const STATUS_SORT_ORDER = {
     executed: 0,
     reviewing: 1,    // leave as-is (dead code from v2, out of scope)
     merging: 2,      // leave as-is (dead code from v2, out of scope)
     planned: 3,
     pending: 4,
     complete: 5,
   };
   ```
   Rename `executing` -> `executed` and `planning` -> `planned`. Leave `reviewing` and `merging` as-is per research finding #6 (dead code, out of scope).

2. **deriveNextActions()** (line 804): Update the switch case:
   ```js
   case 'executed':
     actions.push({
       action: `/execute ${set.id}`,
       setName: set.id,
       description: `Continue executing ${set.id}`,
     });
     break;
   ```
   Change the `case 'executing':` to `case 'executed':`. The description text `Continue executing` is general prose (not a status literal) and may remain as-is.

**What NOT to do:**
- Do NOT rename `PHASE_DISPLAY` keys (`Discussing`, `Planning`, `Executing`) -- these are worktree registry phase values, NOT set status values. Research finding #3 confirmed these are distinct.
- Do NOT rename the `formatWaveSummary()` counters/switch cases (`'Discussing'`, `'Planning'`, `'Executing'`) -- these match on worktree registry `phase` values (capitalized), not `SetStatus` enum values.
- Do NOT rename the `formatWaveSummary()` output strings (`'discussing'`, `'planning'`, `'executing'` in the `parts.push()` calls) -- these are display labels for worktree phase counts, not set status values.

**Verification:** `node -e "const wt = require('./src/lib/worktree.cjs'); console.log('OK')"`

---

### Task 3: Update state-machine.test.cjs (remaining tests)

**File:** `src/lib/state-machine.test.cjs`

**Action:** Update all set-level status string literals in tests OTHER than the migrateState tests (which were added in Wave 1).

Specific changes:

1. **transitionSet tests** (around line 297-326):
   - Line 301: `'discussing'` -> `'discussed'`
   - Line 304: `'discussing'` -> `'discussed'`
   - Line 321 (comment): `skip discussing` -> `skip discussed`
   - Line 322: `'planning'` -> `'planned'`
   - Line 324: `'planning'` -> `'planned'`

2. **validateDiskArtifacts tests** (around line 368-439):
   - Line 381 (test name): `'planning status'` -> `'planned status'`
   - Line 383: `state.milestones[0].sets[0].status = 'planning'` -> `'planned'`
   - Line 392 (test name): `'executing status'` -> `'executed status'`
   - Line 394: `state.milestones[0].sets[0].status = 'executing'` -> `'executed'`
   - Line 412 (test name): `'executing status'` -> `'executed status'`
   - Line 414: `state.milestones[0].sets[0].status = 'executing'` -> `'executed'`
   - Line 427: `state.milestones[0].sets[0].status = 'planning'` -> `'planned'`

3. **Set independence tests** (around line 479-514):
   - Line 490 (comment): `Transition set-A to discussing` -> `Transition set-A to discussed`
   - Line 491: `'discussing'` -> `'discussed'`
   - Line 497: `'discussing'` -> `'discussed'`
   - Line 505: `'planning'` -> `'planned'`
   - Line 506: `'discussing'` -> `'discussed'`
   - Line 511: `'planning'` -> `'planned'`
   - Line 512: `'discussing'` -> `'discussed'`

**Verification:** `node --test src/lib/state-machine.test.cjs`

---

### Task 4: Update state-machine.lifecycle.test.cjs

**File:** `src/lib/state-machine.lifecycle.test.cjs`

**Action:** Update all set status string literals:

1. **Full lifecycle test** (lines 77-90):
   - Line 77 (test name): Update to `'pending -> discussed -> planned -> executed -> complete -> merged'`
   - Line 81: `['discussing', 'planning', 'executing', 'complete', 'merged']` -> `['discussed', 'planned', 'executed', 'complete', 'merged']`

2. **Skip lifecycle test** (lines 93-107):
   - Line 93 (test name): Update to `'pending -> planned -> executed -> complete -> merged'`
   - Line 97: `['planning', 'executing', 'complete', 'merged']` -> `['planned', 'executed', 'complete', 'merged']`

3. **Invalid forward skip** (lines 109-118):
   - Line 113 (comment): `pending -> executing` -> `pending -> executed`
   - Line 115: `'executing'` -> `'executed'`

4. **Backward transition** (lines 120-129):
   - Line 122: `state.milestones[0].sets[0].status = 'planning'` -> `'planned'`

5. **Set independence** (lines 141-173):
   - Line 145 (comment): `full path with discussing` -> `full path with discussed`
   - Line 146: `'discussing'` -> `'discussed'`
   - Line 147: `'planning'` -> `'planned'`
   - Line 149 (comment): `skip discussing` -> `skip discussed`
   - Line 150: `'planning'` -> `'planned'`
   - Line 151: `'executing'` -> `'executed'`
   - Line 157: `'planning'` -> `'planned'`
   - Line 158: `'executing'` -> `'executed'`
   - Line 161 (test name): `'executing'` -> `'executed'`
   - Line 165: `'planning'` -> `'planned'`
   - Line 166: `'executing'` -> `'executed'`
   - Line 171: `'executing'` -> `'executed'`

6. **Atomic write test** (line 262):
   - `'discussing'` -> `'discussed'`

**Verification:** `node --test src/lib/state-machine.lifecycle.test.cjs`

---

### Task 5: Update worktree.test.cjs (Mark II status dashboard tests)

**File:** `src/lib/worktree.test.cjs`

**Action:** Update only the test data that passes set-level status values. The worktree phase values (`'Discussing'`, `'Planning'`, `'Executing'` -- capitalized) are NOT set status and must NOT be changed.

Changes to make (set-level status in test data objects):

1. **formatMarkIIStatus tests** -- update `status:` fields in test data:
   - Line 1014: `status: 'executing'` -> `status: 'executed'`
   - Line 1041: `status: 'executing'` -> `status: 'executed'`
   - Line 1081: `status: 'executing'` -> `status: 'executed'`
   - Line 1082: `status: 'planning'` -> `status: 'planned'`
   - Line 1088: `table.includes('executing')` -> `table.includes('executed')`
   - Line 1089: `table.includes('planning')` -> `table.includes('planned')`
   - Line 1097: `status: 'executing'` -> `status: 'executed'`
   - Line 1121 (test name): Update to `'sorts sets: executed first, then planned, then pending, then complete'`
   - Line 1127: `status: 'executing'` -> `status: 'executed'`; set id `'set-executing'` -> `'set-executed'`
   - Line 1128: `status: 'planning'` -> `status: 'planned'`; set id `'set-planning'` -> `'set-planned'`
   - Line 1135: `dataLines[0].includes('set-executing')` -> `dataLines[0].includes('set-executed')`
   - Line 1136 (if present): `dataLines[1].includes('set-planning')` -> `dataLines[1].includes('set-planned')`

2. **deriveNextActions tests** -- update `status:` fields:
   - Line 1178 (test name): `'executing state'` -> `'executed state'`
   - Line 1182: `status: 'executing'` -> `status: 'executed'`
   - Line 1188 (assertion message): `'executing set'` -> `'executed set'`

**What NOT to do:**
- Do NOT change worktree phase references (`'Discussing'`, `'Planning'`, `'Executing'` -- capitalized) in `formatWaveSummary` tests. These are registry phase values, not `SetStatus` values.
- Do NOT change the `formatWaveSummary` assertion strings like `'1 executing'` or `'1 discussing'` -- these test the display output of worktree phase counts, not set status values.
- Do NOT change wave/job-level `status: 'executing'` values in test data (lines 1015, 1017, 1042) -- these are wave/job statuses, not set-level statuses. Only change the top-level set `status:` field.

**Verification:** `node --test src/lib/worktree.test.cjs`

---

### Task 6: Add backward-compatible readState migration test

**File:** `src/lib/state-machine.test.cjs`

**Action:** Add a new `describe('readState migration', ...)` block within the existing `readState` describe section. This tests that STATE.json files with OLD status values load transparently:

1. `'transparently migrates old discussing status to discussed'` -- Write a STATE.json with `status: 'discussing'` to disk, call `readState()`, assert `result.valid === true` and `result.state.milestones[0].sets[0].status === 'discussed'`.

2. `'transparently migrates old planning status to planned'` -- Same pattern with `'planning'` -> `'planned'`.

3. `'transparently migrates old executing status to executed'` -- Same pattern with `'executing'` -> `'executed'`.

4. `'migration does not write to disk (in-memory only)'` -- Write old-format STATE.json, record mtime, call `readState()`, verify mtime unchanged. This confirms that migration is in-memory only (per the deadlock-avoidance decision).

5. `'withStateTransaction persists migrated values on next write'` -- Write old-format STATE.json with `status: 'discussing'`, call `withStateTransaction()` with a no-op mutation, read the file from disk, assert the status on disk is now `'discussed'`.

**Verification:** `node --test src/lib/state-machine.test.cjs`

---

### Task 7: Add permanent grep verification test

**File:** `src/lib/status-rename.test.cjs` (NEW FILE)

**Action:** Create a dedicated test file that greps the codebase for any surviving old status literals. This is the "belt and suspenders" safety net that becomes a permanent part of the test suite.

The test should:

1. Use `child_process.execSync` to run `grep -rn` across `src/` for each old literal (`discussing`, `planning`, `executing`).
2. Filter results to only `.cjs` files (the code files).
3. Exclude known false positives:
   - `status-rename.test.cjs` itself (this very file)
   - Lines containing `migrateState` or `STATUS_MAP` (the migration code legitimately references old values)
   - Lines containing `PHASE_DISPLAY` or `case 'Discussing'` or `case 'Planning'` or `case 'Executing'` (worktree phase values, not set status)
   - Lines containing `formatWaveSummary` (worktree phase display counts)
   - Lines containing `.planning/` or `.planning` (directory name, not status)
   - For `'planning'`: also exclude lines with `'wave planning'`, `'detailed planning'`, `'planning phase'` and similar general-noun uses
   - For `'executing'`: also exclude lines with `'executing a command'`, `'executing a'`, `'each executing'` and similar verb/gerund uses unrelated to set status
4. If any unfiltered matches remain, fail with a descriptive message listing the file and line.

Test structure:
```js
describe('Status rename verification', () => {
  it('no old set status literals (discussing) remain in .cjs files', () => { ... });
  it('no old set status literals (planning-as-status) remain in .cjs files', () => { ... });
  it('no old set status literals (executing-as-status) remain in .cjs files', () => { ... });
});
```

**Important implementation detail:** The grep should look for the exact patterns `'discussing'`, `"discussing"`, `'planning'`, `"planning"`, `'executing'`, `"executing"` (quoted strings) in `.cjs` files, then filter by context. This avoids matching comments or prose while catching actual string literals.

**Verification:** `node --test src/lib/status-rename.test.cjs`

---

## File Ownership (Wave 2)

| File | Action |
|------|--------|
| src/lib/state-machine.cjs | Modify (validateDiskArtifacts status arrays + JSDoc) |
| src/lib/worktree.cjs | Modify (STATUS_SORT_ORDER keys, deriveNextActions switch) |
| src/lib/state-machine.test.cjs | Modify (update remaining status literals, add migration tests) |
| src/lib/state-machine.lifecycle.test.cjs | Modify (update all status literals) |
| src/lib/worktree.test.cjs | Modify (update set-level status literals in Mark II tests) |
| src/lib/status-rename.test.cjs | Create (permanent grep verification test) |

## File Ownership Boundary Check

- Wave 1 owns: `state-schemas.cjs`, `state-transitions.cjs`, `state-schemas.test.cjs`, `state-transitions.test.cjs`
- Wave 2 owns: `state-machine.cjs` (different sections than Wave 1), `worktree.cjs`, `state-machine.test.cjs` (different sections than Wave 1), `state-machine.lifecycle.test.cjs`, `worktree.test.cjs`, `status-rename.test.cjs`
- **Overlap note:** Both waves touch `state-machine.cjs` and `state-machine.test.cjs`. This is acceptable because they modify non-overlapping sections (Wave 1: migrateState + readState wiring; Wave 2: validateDiskArtifacts + test updates). Since waves are sequential (not parallel), there is no conflict.

## Success Criteria

1. `node --test src/lib/state-schemas.test.cjs` -- all pass
2. `node --test src/lib/state-transitions.test.cjs` -- all pass
3. `node --test src/lib/state-machine.test.cjs` -- all pass (including migration tests)
4. `node --test src/lib/state-machine.lifecycle.test.cjs` -- all pass
5. `node --test src/lib/worktree.test.cjs` -- all pass
6. `node --test src/lib/status-rename.test.cjs` -- all pass (grep verification)
7. Zero occurrences of old set status literals in `.cjs` files (excluding false positives)

## Commit Strategy

Single atomic commit containing all 6 files. Message: `refactor(status-rename): update all runtime consumers and tests to past-tense status values`
