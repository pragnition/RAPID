# Wave 1: Schema, Transitions, and Migration Foundation

## Objective

Update the canonical definitions of set status values (`SetStatus` enum, `SET_TRANSITIONS` map) from present-participle to past-tense forms, add an idempotent `migrateState()` function, and update all corresponding test files. After this wave, the schema and transition definitions will use the new values and all schema/transition tests will pass.

## Critical Constraint

The `SetStatus` enum, `SET_TRANSITIONS` map, and their test files must ALL be updated in a single atomic commit. A partial rename will cause Zod validation crashes because the schema and transitions must agree on the exact status strings.

## Tasks

### Task 1: Update SetStatus Zod enum in state-schemas.cjs

**File:** `src/lib/state-schemas.cjs`

**Action:** Change the `SetStatus` enum on line 4 from:
```js
const SetStatus = z.enum(['pending', 'discussing', 'planning', 'executing', 'complete', 'merged']);
```
to:
```js
const SetStatus = z.enum(['pending', 'discussed', 'planned', 'executed', 'complete', 'merged']);
```

**What NOT to do:** Do not change `SetState`, `MilestoneState`, or `ProjectState` -- only the enum values change.

**Verification:** `node -e "const s = require('./src/lib/state-schemas.cjs'); s.SetStatus.parse('discussed'); s.SetStatus.parse('planned'); s.SetStatus.parse('executed'); console.log('OK')"`

---

### Task 2: Update SET_TRANSITIONS map in state-transitions.cjs

**File:** `src/lib/state-transitions.cjs`

**Action:** Replace the `SET_TRANSITIONS` object (lines 3-10) with:
```js
const SET_TRANSITIONS = {
  pending:    ['discussed', 'planned'],
  discussed:  ['planned'],
  planned:    ['executed'],
  executed:   ['complete'],
  complete:   ['merged'],
  merged:     [],
};
```

**What NOT to do:** Do not change `validateTransition()` -- its logic is string-agnostic and works with any values.

**Verification:** `node -e "const t = require('./src/lib/state-transitions.cjs'); t.validateTransition('pending', 'discussed'); t.validateTransition('planned', 'executed'); console.log('OK')"`

---

### Task 3: Add migrateState() to state-machine.cjs

**File:** `src/lib/state-machine.cjs`

**Action:** Add the following function BEFORE the `readState()` function (after line 11):

```js
/**
 * Migrate old present-participle status values to past-tense equivalents.
 * Walks ALL milestones and all sets within each milestone.
 * Idempotent -- safe to call multiple times on the same state object.
 * Operates in-memory only; does NOT write to disk.
 *
 * @param {object} stateObj - Raw parsed STATE.json (before Zod validation)
 * @returns {object} The same object, mutated in-place with migrated status values
 */
function migrateState(stateObj) {
  const STATUS_MAP = {
    discussing: 'discussed',
    planning: 'planned',
    executing: 'executed',
  };

  if (stateObj && Array.isArray(stateObj.milestones)) {
    for (const milestone of stateObj.milestones) {
      if (Array.isArray(milestone.sets)) {
        for (const set of milestone.sets) {
          if (set.status && STATUS_MAP[set.status]) {
            set.status = STATUS_MAP[set.status];
          }
        }
      }
    }
  }

  return stateObj;
}
```

Then wire `migrateState()` into `readState()`. In the `readState()` function, add a call to `migrateState(parsed)` BEFORE `ProjectState.safeParse(parsed)`:

Change:
```js
  const result = ProjectState.safeParse(parsed);
```
to:
```js
  migrateState(parsed);
  const result = ProjectState.safeParse(parsed);
```

Also add `migrateState` to the `module.exports` at the bottom of the file.

**What NOT to do:**
- Do NOT acquire a lock in migrateState() -- it operates in-memory only.
- Do NOT write to disk from migrateState() -- the first `withStateTransaction()` that reads migrated state will persist through its existing write path.
- Do NOT migrate wave-level or job-level status values (out of scope for this set).

**Verification:** `node -e "const sm = require('./src/lib/state-machine.cjs'); console.log(typeof sm.migrateState === 'function' ? 'OK' : 'FAIL')"`

---

### Task 4: Update state-schemas.test.cjs

**File:** `src/lib/state-schemas.test.cjs`

**Actions (all literal replacements):**

1. Line 16-17: Change test for `'discussing'` to `'discussed'`:
   - Test name: `'accepts "discussed"'`
   - Assert: `SetStatus.parse('discussed'), 'discussed'`

2. Line 25: Change `validStatuses` array:
   - From: `['pending', 'discussing', 'planning', 'executing', 'complete', 'merged']`
   - To: `['pending', 'discussed', 'planned', 'executed', 'complete', 'merged']`

3. Lines 31-36: Add tests that the OLD values are now rejected:
   - Keep existing `'reviewing'` and `'merging'` rejection tests
   - Add new test: `it('rejects "discussing" (renamed to discussed)', ...)` that asserts `SetStatus.parse('discussing')` throws ZodError
   - Add new test: `it('rejects "planning" (renamed to planned)', ...)` that asserts `SetStatus.parse('planning')` throws ZodError
   - Add new test: `it('rejects "executing" (renamed to executed)', ...)` that asserts `SetStatus.parse('executing')` throws ZodError

4. Lines 85 and 90: Change MilestoneState test data from `'discussing'` to `'discussed'`:
   - `sets: [{ id: 's1', status: 'discussed' }]`
   - `assert.equal(ms.sets[0].status, 'discussed')`

5. Line 127: Change ProjectState round-trip test data from `'discussing'` to `'discussed'`:
   - `sets: [{ id: 's1', status: 'discussed' }]`

**Verification:** `node --test src/lib/state-schemas.test.cjs`

---

### Task 5: Update state-transitions.test.cjs

**File:** `src/lib/state-transitions.test.cjs`

**Actions (all literal replacements):**

1. Line 12: Update sorted keys assertion:
   - From: `['complete', 'discussing', 'executing', 'merged', 'pending', 'planning']`
   - To: `['complete', 'discussed', 'executed', 'merged', 'pending', 'planned']`

2. Lines 15-16: Update branch point test:
   - Name: `'pending has two targets: discussed and planned (branch point)'`
   - Assert: `SET_TRANSITIONS.pending, ['discussed', 'planned']`

3. Lines 19-20: `'discussed -> planned only'`, `SET_TRANSITIONS.discussed, ['planned']`

4. Lines 23-24: `'planned -> executed only'`, `SET_TRANSITIONS.planned, ['executed']`

5. Lines 27-28: `'executed -> complete only'`, `SET_TRANSITIONS.executed, ['complete']`

6. Lines 41-42: `'pending -> discussed succeeds'`, `validateTransition('pending', 'discussed')`

7. Line 46: `validateTransition('pending', 'planned')`

8. Lines 49-50: `'discussed -> planned succeeds'`, `validateTransition('discussed', 'planned')`

9. Lines 53-54: `'planned -> executed succeeds'`, `validateTransition('planned', 'executed')`

10. Lines 57-58: `'executed -> complete succeeds'`, `validateTransition('executed', 'complete')`

11. Lines 65-66: Full chain: `['pending', 'discussed', 'planned', 'executed', 'complete', 'merged']`

12. Lines 72-73: Skip chain: `['pending', 'planned', 'executed', 'complete', 'merged']`

13. Lines 91-93: `'pending -> executed throws'`, `validateTransition('pending', 'executed')`

14. Lines 101-102: `'discussed -> pending throws'`, `validateTransition('discussed', 'pending')`

15. Lines 105-106: `'complete -> executed throws'`, `validateTransition('complete', 'executed')`

16. Lines 109-110: `'planned -> pending throws'`, `validateTransition('planned', 'pending')`

17. Lines 113-114: `'executed -> planned throws'`, `validateTransition('executed', 'planned')`

18. Lines 117-118: `'discussed -> executed throws (cannot skip planned)'`, `validateTransition('discussed', 'executed')`

19. Lines 121-122: `'planned -> complete throws (cannot skip executed)'`, `validateTransition('planned', 'complete')`

20. Line 129: Keep `validateTransition('bogus', 'planned')` (update `'planning'` to `'planned'`)

**Verification:** `node --test src/lib/state-transitions.test.cjs`

---

### Task 6: Add migrateState() unit tests in state-machine.test.cjs

**File:** `src/lib/state-machine.test.cjs`

**Action:** Add a new `describe('migrateState', ...)` block (import `migrateState` at the top). Tests to add:

1. `'migrates discussing -> discussed in all milestones'` -- Create state with two milestones, each having a set with `status: 'discussing'`. Call `migrateState()`. Assert all sets now have `'discussed'`.

2. `'migrates planning -> planned'` -- Create state with a set at `'planning'`. Call `migrateState()`. Assert `'planned'`.

3. `'migrates executing -> executed'` -- Create state with a set at `'executing'`. Call `migrateState()`. Assert `'executed'`.

4. `'is idempotent (safe to call twice)'` -- Create state, migrate once, migrate again. Assert result is identical.

5. `'does not change pending, complete, or merged'` -- Create state with sets at `'pending'`, `'complete'`, `'merged'`. Call `migrateState()`. Assert all unchanged.

6. `'handles null/undefined gracefully'` -- Call `migrateState(null)`. Assert returns null without throwing. Call `migrateState({})`. Assert returns `{}`.

7. `'handles milestones with empty sets array'` -- Create state with empty sets array. Assert no error.

Also add `migrateState` to the destructured import at the top of the file.

**What NOT to do:** Do not add disk-based migration tests here -- those belong in Wave 2 where `readState()` is tested with old-format STATE.json files.

**Verification:** `node --test src/lib/state-machine.test.cjs`

---

## File Ownership (Wave 1)

| File | Action |
|------|--------|
| src/lib/state-schemas.cjs | Modify (enum values) |
| src/lib/state-transitions.cjs | Modify (map keys/values) |
| src/lib/state-machine.cjs | Modify (add migrateState, wire into readState, export) |
| src/lib/state-schemas.test.cjs | Modify (update all status literals) |
| src/lib/state-transitions.test.cjs | Modify (update all status literals) |
| src/lib/state-machine.test.cjs | Modify (add migrateState tests only -- DO NOT update other tests yet, that is Wave 2) |

## Success Criteria

1. `node --test src/lib/state-schemas.test.cjs` -- all tests pass
2. `node --test src/lib/state-transitions.test.cjs` -- all tests pass
3. `node --test src/lib/state-machine.test.cjs` -- migrateState tests pass (other tests may fail until Wave 2 updates them)
4. `migrateState()` is exported from state-machine.cjs
5. `readState()` calls `migrateState()` before Zod validation

## Commit Strategy

Single atomic commit containing all 6 files. Message: `refactor(status-rename): rename set status values to past-tense and add migrateState`
