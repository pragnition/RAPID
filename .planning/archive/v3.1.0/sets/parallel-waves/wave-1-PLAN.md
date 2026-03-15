# Wave 1 PLAN: Schema, Transitions, and State Machine Extensions

## Objective

Add wave-level and job-level state tracking to the RAPID state machine. This wave delivers: (1) Zod schemas for WaveStatus, WaveState, JobStatus, JobState; (2) WAVE_TRANSITIONS and JOB_TRANSITIONS maps; (3) findWave(), findJob(), transitionWave(), transitionJob() functions; (4) detectIndependentWaves() utility; and (5) comprehensive tests for all of the above. This fixes the pre-existing bug where rapid-tools.cjs calls transitionWave/transitionJob/findWave/findJob but state-machine.cjs does not export them.

**Dependency:** This wave MUST be implemented on top of the status-rename set's changes. The SetStatus enum uses past-tense values: `['pending', 'discussed', 'planned', 'executed', 'complete', 'merged']`. The SET_TRANSITIONS map uses these past-tense keys. All new code must align with these values.

## Files Modified

| File | Action |
|------|--------|
| `src/lib/state-schemas.cjs` | Add WaveStatus, WaveState, JobStatus, JobState; extend SetState with optional waves array |
| `src/lib/state-schemas.test.cjs` | Add tests for new schemas; update "Removed exports" tests; update export count assertion |
| `src/lib/state-transitions.cjs` | Add WAVE_TRANSITIONS, JOB_TRANSITIONS maps; extend validateTransition to accept optional 3rd arg |
| `src/lib/state-transitions.test.cjs` | Add tests for new transition maps; update "Removed exports" tests; update export count assertion |
| `src/lib/state-machine.cjs` | Add findWave, findJob, transitionWave, transitionJob, detectIndependentWaves; export all |
| `src/lib/state-machine.test.cjs` | Invert 6 "removed exports" tests to assert defined; add full test suites for new functions |

## Tasks

### Task 1: Extend state-schemas.cjs with Wave and Job Zod schemas

**File:** `src/lib/state-schemas.cjs`

Add the following schemas after the existing `SetStatus` definition:

1. `WaveStatus` -- `z.enum(['pending', 'executing', 'complete'])`. These are wave-level statuses (not set-level), so they keep present-participle `executing` which is intentional and distinct from the set-level `executed`.

2. `JobStatus` -- `z.enum(['pending', 'executing', 'complete'])`. Same status set as waves.

3. `JobState` -- `z.object({ id: z.string(), status: JobStatus.default('pending') })`

4. `WaveState` -- `z.object({ id: z.string(), status: WaveStatus.default('pending'), jobs: z.array(JobState).default([]) })`

5. Extend `SetState` to include an optional waves array:
   ```
   SetState = z.object({
     id: z.string(),
     status: SetStatus.default('pending'),
     waves: z.array(WaveState).default([]),
   })
   ```

6. Update `module.exports` to include all 8 schemas: `SetStatus, SetState, MilestoneState, ProjectState, WaveStatus, WaveState, JobStatus, JobState`

**Important:** The `waves` array on SetState must use `.default([])` for backward compatibility -- existing STATE.json files without waves must still parse successfully.

**What NOT to do:**
- Do NOT change the SetStatus enum values (those are owned by status-rename set)
- Do NOT make waves required on SetState -- it MUST default to empty array

**Verification:**
```bash
node -e "const s = require('./src/lib/state-schemas.cjs'); console.log(Object.keys(s).sort().join(', '))"
# Expected: JobState, JobStatus, MilestoneState, ProjectState, SetState, SetStatus, WaveState, WaveStatus

node -e "const {SetState} = require('./src/lib/state-schemas.cjs'); const r = SetState.parse({id:'test'}); console.log(r.waves)"
# Expected: [] (empty array default)

node -e "const {WaveState} = require('./src/lib/state-schemas.cjs'); const r = WaveState.parse({id:'w1'}); console.log(JSON.stringify(r))"
# Expected: {"id":"w1","status":"pending","jobs":[]}
```

---

### Task 2: Update state-schemas.test.cjs

**File:** `src/lib/state-schemas.test.cjs`

1. **Invert "Removed exports" tests** -- The existing tests at the bottom of the file assert that WaveStatus, WaveState, JobStatus, JobState are `undefined`. These must be changed to assert they ARE defined and are Zod schemas (not undefined).

2. **Update export count assertion** -- Change `'module exports exactly 4 keys'` to assert exactly 8 keys: `['JobState', 'JobStatus', 'MilestoneState', 'ProjectState', 'SetState', 'SetStatus', 'WaveState', 'WaveStatus']`.

3. **Update SetState tests** -- The existing test `'has no extra fields on parsed result'` asserts `Object.keys(set).sort()` equals `['id', 'status']`. Update to `['id', 'status', 'waves']`. The test `'strips unknown "waves" key silently'` must be replaced with a test that verifies waves array IS parsed (no longer stripped).

4. **Add WaveStatus test suite:**
   - Accepts 'pending', 'executing', 'complete'
   - Rejects 'discussed', 'planned', 'executed' (set-level statuses)
   - Rejects arbitrary strings

5. **Add JobStatus test suite:**
   - Same acceptance/rejection pattern as WaveStatus

6. **Add WaveState test suite:**
   - Parses `{id: 'w1'}` with defaults (status='pending', jobs=[])
   - Parses with explicit status and jobs array
   - Rejects missing id
   - Rejects invalid status

7. **Add JobState test suite:**
   - Parses `{id: 'j1'}` with defaults (status='pending')
   - Rejects missing id
   - Rejects invalid status

8. **Add SetState backward compatibility tests:**
   - `SetState.parse({id: 'test', status: 'pending'})` produces `waves: []`
   - `SetState.parse({id: 'test', status: 'pending', waves: [{id: 'w1'}]})` succeeds with wave parsed
   - Round-trip JSON.parse(JSON.stringify(parsed)) preserves waves

**Verification:**
```bash
node --test src/lib/state-schemas.test.cjs
```

---

### Task 3: Add WAVE_TRANSITIONS and JOB_TRANSITIONS to state-transitions.cjs

**File:** `src/lib/state-transitions.cjs`

1. Add `WAVE_TRANSITIONS` map:
   ```javascript
   const WAVE_TRANSITIONS = {
     pending:   ['executing'],
     executing: ['complete'],
     complete:  [],
   };
   ```

2. Add `JOB_TRANSITIONS` map (same structure):
   ```javascript
   const JOB_TRANSITIONS = {
     pending:   ['executing'],
     executing: ['complete'],
     complete:  [],
   };
   ```

3. **Extend `validateTransition`** to accept an optional 3rd argument `transitionMap`:
   ```javascript
   function validateTransition(currentStatus, nextStatus, transitionMap) {
     const map = transitionMap || SET_TRANSITIONS;
     const allowed = map[currentStatus];
     // ... rest of function uses `allowed` (unchanged logic)
   }
   ```
   This is backward compatible -- existing callers pass 2 args and get SET_TRANSITIONS by default.

4. Update `module.exports` to include all 4 exports: `SET_TRANSITIONS, WAVE_TRANSITIONS, JOB_TRANSITIONS, validateTransition`

**What NOT to do:**
- Do NOT change the existing SET_TRANSITIONS values (owned by status-rename)
- Do NOT change the existing validateTransition logic, only add the optional 3rd param

**Verification:**
```bash
node -e "const t = require('./src/lib/state-transitions.cjs'); console.log(Object.keys(t).sort().join(', '))"
# Expected: JOB_TRANSITIONS, SET_TRANSITIONS, WAVE_TRANSITIONS, validateTransition

node -e "const {validateTransition, WAVE_TRANSITIONS} = require('./src/lib/state-transitions.cjs'); validateTransition('pending', 'executing', WAVE_TRANSITIONS); console.log('OK')"
# Expected: OK
```

---

### Task 4: Update state-transitions.test.cjs

**File:** `src/lib/state-transitions.test.cjs`

1. **Invert "Removed exports" tests** -- Change assertions for WAVE_TRANSITIONS and JOB_TRANSITIONS from `undefined` to defined. Update the export count from 2 to 4 keys: `['JOB_TRANSITIONS', 'SET_TRANSITIONS', 'WAVE_TRANSITIONS', 'validateTransition']`.

2. **Add WAVE_TRANSITIONS test suite:**
   - Has exactly 3 keys: pending, executing, complete
   - pending -> executing only
   - executing -> complete only
   - complete is terminal (empty array)

3. **Add JOB_TRANSITIONS test suite:**
   - Same structure as WAVE_TRANSITIONS tests

4. **Add validateTransition with custom map tests:**
   - `validateTransition('pending', 'executing', WAVE_TRANSITIONS)` succeeds
   - `validateTransition('pending', 'discussed', WAVE_TRANSITIONS)` throws (not a valid wave transition)
   - `validateTransition('pending', 'discussed')` still succeeds (backward compat with SET_TRANSITIONS default) -- note: this uses the post-status-rename value `discussed`
   - Verify function.length is still 2 (optional params do not change .length in JS, but verify the 3rd arg works)

**Verification:**
```bash
node --test src/lib/state-transitions.test.cjs
```

---

### Task 5: Add findWave, findJob, transitionWave, transitionJob, detectIndependentWaves to state-machine.cjs

**File:** `src/lib/state-machine.cjs`

**5a: Import updates**

Add to the existing require at the top:
```javascript
const { validateTransition, WAVE_TRANSITIONS, JOB_TRANSITIONS } = require('./state-transitions.cjs');
```
(Currently only `validateTransition` is destructured -- add the two new maps.)

Also add:
```javascript
const { assignWaves } = require('./dag.cjs');
```

**5b: Add findWave helper**

```javascript
/**
 * Find a wave by id within a set. Throws if not found.
 */
function findWave(state, milestoneId, setId, waveId) {
  const set = findSet(state, milestoneId, setId);
  const wave = set.waves.find(w => w.id === waveId);
  if (!wave) {
    throw new Error(`Wave '${waveId}' not found in set '${setId}'`);
  }
  return wave;
}
```

**5c: Add findJob helper**

```javascript
/**
 * Find a job by id within a wave. Throws if not found.
 */
function findJob(state, milestoneId, setId, waveId, jobId) {
  const wave = findWave(state, milestoneId, setId, waveId);
  const job = wave.jobs.find(j => j.id === jobId);
  if (!job) {
    throw new Error(`Job '${jobId}' not found in wave '${waveId}'`);
  }
  return job;
}
```

**5d: Add transitionWave**

Follow the exact pattern of `transitionSet` but use `WAVE_TRANSITIONS`:

```javascript
async function transitionWave(cwd, milestoneId, setId, waveId, newStatus) {
  return withStateTransaction(cwd, (state) => {
    const wave = findWave(state, milestoneId, setId, waveId);
    validateTransition(wave.status, newStatus, WAVE_TRANSITIONS);
    wave.status = newStatus;
  });
}
```

**5e: Add transitionJob**

```javascript
async function transitionJob(cwd, milestoneId, setId, waveId, jobId, newStatus) {
  return withStateTransaction(cwd, (state) => {
    const job = findJob(state, milestoneId, setId, waveId, jobId);
    validateTransition(job.status, newStatus, JOB_TRANSITIONS);
    job.status = newStatus;
  });
}
```

**5f: Add detectIndependentWaves**

This function groups waves into parallelizable batches. It takes a waves array (from PLAN.md file parsing or from STATE.json) and optional edges, and returns `Wave[][]`. It uses `assignWaves` from dag.cjs.

```javascript
/**
 * Groups waves into parallelizable batches using DAG BFS level analysis.
 * Waves with no inter-wave dependencies are grouped together.
 * If no edges are provided, all waves are considered independent (single batch).
 *
 * @param {Array<{id: string}>} waves - Wave objects with at least an id property
 * @param {Array<{from: string, to: string}>} [edges=[]] - Inter-wave dependency edges
 * @returns {Array<Array<{id: string}>>} Array of parallel batches
 */
function detectIndependentWaves(waves, edges = []) {
  if (waves.length === 0) return [];
  if (edges.length === 0) {
    // No dependencies -- all waves are independent, single batch
    return [waves];
  }

  const waveMap = assignWaves(waves, edges);

  // Group waves by their assigned wave number
  const groups = {};
  for (const wave of waves) {
    const level = waveMap[wave.id];
    if (!groups[level]) groups[level] = [];
    groups[level].push(wave);
  }

  // Return groups sorted by level number
  return Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
    .map(level => groups[level]);
}
```

**5g: Update module.exports**

Add all new functions to the exports object:
```javascript
module.exports = {
  migrateState,          // from status-rename
  createInitialState,
  readState,
  writeState,
  withStateTransaction,
  findMilestone,
  findSet,
  findWave,              // NEW
  findJob,               // NEW
  transitionSet,
  transitionWave,        // NEW
  transitionJob,         // NEW
  detectIndependentWaves, // NEW
  addMilestone,
  validateDiskArtifacts,
  detectCorruption,
  recoverFromGit,
  commitState,
};
```

**What NOT to do:**
- Do NOT nest lock acquisitions (transitionWave/Job must use withStateTransaction which acquires the lock once)
- Do NOT call writeState from within withStateTransaction's mutationFn (deadlock)
- Do NOT modify existing functions -- only add new ones and update the import/export lines

**Verification:**
```bash
node -e "const sm = require('./src/lib/state-machine.cjs'); console.log(typeof sm.findWave, typeof sm.findJob, typeof sm.transitionWave, typeof sm.transitionJob, typeof sm.detectIndependentWaves)"
# Expected: function function function function function
```

---

### Task 6: Update state-machine.test.cjs

**File:** `src/lib/state-machine.test.cjs`

**6a: Update imports**

Add `findWave, findJob, transitionWave, transitionJob, detectIndependentWaves` to the destructured require at the top.

**6b: Invert "removed exports" tests**

Change the `describe('removed exports', ...)` block. All 6 tests currently assert `undefined`. Change them to:
- `findWave` -- assert `typeof sm.findWave === 'function'`
- `findJob` -- assert `typeof sm.findJob === 'function'`
- `transitionWave` -- assert `typeof sm.transitionWave === 'function'`
- `transitionJob` -- assert `typeof sm.transitionJob === 'function'`
- `deriveWaveStatus` -- keep asserting `undefined` (not implemented in this set)
- `deriveSetStatus` -- keep asserting `undefined` (not implemented in this set)

Rename the describe block from `'removed exports'` to `'export availability'`.

**6c: Add helper for state with waves**

Add a helper function:
```javascript
function makeStateWithWaves() {
  const state = createInitialState('test-project', 'v1.0');
  state.milestones[0].sets = [{
    id: 'set-1',
    status: 'pending',
    waves: [
      { id: 'wave-1', status: 'pending', jobs: [
        { id: 'job-1', status: 'pending' },
        { id: 'job-2', status: 'pending' },
      ]},
      { id: 'wave-2', status: 'pending', jobs: [] },
    ],
  }];
  return state;
}
```

**6d: Add findWave test suite**

```
describe('findWave', () => {
  - returns the wave when found
  - throws for unknown wave id with descriptive message including wave id and set id
  - throws for unknown set id (bubbles up from findSet)
})
```

**6e: Add findJob test suite**

```
describe('findJob', () => {
  - returns the job when found
  - throws for unknown job id with descriptive message including job id and wave id
  - throws for unknown wave id (bubbles up from findWave)
})
```

**6f: Add transitionWave test suite**

Uses `tmpDir` pattern (beforeEach/afterEach with makeTempProject/cleanTempProject):
```
describe('transitionWave', () => {
  - transitions wave status and persists to STATE.json
  - rejects invalid wave transitions (e.g., pending -> complete)
  - accepts valid chain: pending -> executing -> complete
  - does not affect sibling waves in the same set
  - releases lock after completion
})
```

Write a state with waves to STATE.json, call transitionWave, then readTestState to verify.

**6g: Add transitionJob test suite**

Same pattern:
```
describe('transitionJob', () => {
  - transitions job status and persists to STATE.json
  - rejects invalid job transitions
  - does not affect sibling jobs in the same wave
  - releases lock after completion
})
```

**6h: Add detectIndependentWaves test suite**

```
describe('detectIndependentWaves', () => {
  - returns empty array for empty input
  - returns single batch when no edges provided (all independent)
  - groups dependent waves into sequential batches
  - preserves wave objects in output (not just IDs)
  - handles linear chain: A->B->C produces [[A],[B],[C]]
  - handles diamond: A->{B,C}->D produces [[A],[B,C],[D]]
})
```

**Verification:**
```bash
node --test src/lib/state-machine.test.cjs
```

---

## Success Criteria

1. All 8 Zod schemas exported from state-schemas.cjs (`SetStatus, SetState, MilestoneState, ProjectState, WaveStatus, WaveState, JobStatus, JobState`)
2. WAVE_TRANSITIONS and JOB_TRANSITIONS exported from state-transitions.cjs
3. validateTransition accepts optional 3rd arg for custom transition map
4. findWave, findJob, transitionWave, transitionJob, detectIndependentWaves exported from state-machine.cjs
5. Existing STATE.json files without waves arrays still parse (backward compat via `.default([])`)
6. All tests pass: `node --test src/lib/state-schemas.test.cjs src/lib/state-transitions.test.cjs src/lib/state-machine.test.cjs`
7. The "removed exports" assertions are inverted to confirm functions are now defined
8. No lock reentrancy issues (transitionWave/Job use withStateTransaction, not nested locks)
