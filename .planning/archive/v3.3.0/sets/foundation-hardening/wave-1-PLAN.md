# PLAN: foundation-hardening / Wave 1 -- Schema Hardening

## Objective

Harden all Zod object schemas in `state-schemas.cjs` with `.passthrough()` to prevent silent field stripping during `ProjectState.parse()`. Add the `rapidVersion` optional field to `ProjectState`. Change `version` from `z.literal(1)` to `z.number().int().min(1)` for forward-compatible schema evolution. Update all affected tests.

This is the foundational wave -- every other set that reads/writes STATE.json depends on fields not being silently stripped.

## File Ownership

| File | Action |
|------|--------|
| `src/lib/state-schemas.cjs` | Modify |
| `src/lib/state-schemas.test.cjs` | Modify |
| `src/lib/state-machine.cjs` | Modify |
| `src/lib/state-machine.test.cjs` | Modify |
| `src/lib/init.cjs` | Modify |

## Tasks

### Task 1: Add `.passthrough()` to all 5 Zod object schemas

**File:** `src/lib/state-schemas.cjs`

**Actions:**
1. Add `.passthrough()` to `JobState` (line 10-13): `z.object({ ... }).passthrough()`
2. Add `.passthrough()` to `WaveState` (line 15-19): `z.object({ ... }).passthrough()`
3. Add `.passthrough()` to `SetState` (line 21-25): `z.object({ ... }).passthrough()`
4. Add `.passthrough()` to `MilestoneState` (line 27-31): `z.object({ ... }).passthrough()`
5. Add `.passthrough()` to `ProjectState` (line 33-40): `z.object({ ... }).passthrough()`

CRITICAL: `.passthrough()` does NOT propagate to nested schemas. Each of the 5 object schemas must get its own `.passthrough()` call. The order of chaining matters: `.passthrough()` goes AFTER `.default()` if present, but here it goes on the `z.object()` call itself since defaults are on individual fields.

**What NOT to do:**
- Do NOT add `.passthrough()` to enum schemas (`SetStatus`, `WaveStatus`, `JobStatus`) -- they are `z.enum()`, not `z.object()`
- Do NOT change any existing field definitions -- only add `.passthrough()`

### Task 2: Change `version` field from `z.literal(1)` to `z.number().int().min(1)`

**File:** `src/lib/state-schemas.cjs`

**Actions:**
1. In `ProjectState` (line 34), change `version: z.literal(1)` to `version: z.number().int().min(1)`

This allows future schema version bumps (e.g., version: 2) without needing code changes. Existing STATE.json files with `version: 1` continue to validate.

### Task 3: Add `rapidVersion` field to `ProjectState`

**File:** `src/lib/state-schemas.cjs`

**Actions:**
1. Add `rapidVersion: z.string().optional()` to the `ProjectState` object schema, after `version`

This field stores the RAPID tool version (e.g., "3.2.0") that created the project. It is optional so existing STATE.json files without it continue to validate.

### Task 4: Wire `rapidVersion` into `createInitialState`

**File:** `src/lib/state-machine.cjs`

**Actions:**
1. Add optional `rapidVersion` parameter to `createInitialState(projectName, milestoneName, rapidVersion)`
2. In the returned object, add `rapidVersion` field (only if the parameter is provided -- use conditional spread or simple assignment)
3. Update the JSDoc to document the new parameter

The function signature becomes:
```
function createInitialState(projectName, milestoneName, rapidVersion)
```

The returned object should include `rapidVersion` only when passed:
```js
const state = {
  version: 1,
  projectName,
  currentMilestone: milestoneName,
  milestones: [{ id: milestoneName, name: milestoneName, sets: [] }],
  lastUpdatedAt: now,
  createdAt: now,
};
if (rapidVersion) state.rapidVersion = rapidVersion;
return state;
```

### Task 5: Pass `rapidVersion` from `scaffoldProject` in `init.cjs`

**File:** `src/lib/init.cjs`

**Actions:**
1. Add `const { getVersion } = require('./version.cjs');` import at the top
2. In the `fileGenerators` object (line 236), change the `STATE.json` entry to pass `getVersion()` as the third argument:
   ```js
   'STATE.json': () => JSON.stringify(createInitialState(opts.name, 'v1.0', getVersion()), null, 2),
   ```

### Task 6: Update `state-schemas.test.cjs` for passthrough and schema changes

**File:** `src/lib/state-schemas.test.cjs`

**Actions:**

1. **Update the test at line 137 ("rejects version !== 1")**: This test currently asserts `version: 2` is rejected. With the schema change to `z.number().int().min(1)`, `version: 2` is now valid. Rename the test and update it to:
   - Assert `version: 2` IS accepted (parse succeeds)
   - Assert `version: 0` IS rejected (below min)
   - Assert `version: -1` IS rejected
   - Assert `version: 1.5` IS rejected (not integer)
   - Assert `version: "1"` IS rejected (not a number)

2. **Add passthrough tests for each schema**: Add a new `describe('passthrough behavior')` block with tests:
   - `JobState.parse({ id: 'j1', status: 'pending', customField: 'hello' })` preserves `customField`
   - `WaveState.parse({ id: 'w1', jobs: [], futureField: 42 })` preserves `futureField`
   - `SetState.parse({ id: 's1', extraData: true })` preserves `extraData`
   - `MilestoneState.parse({ id: 'm1', name: 'M1', metadata: {} })` preserves `metadata`
   - `ProjectState.parse({ ...validProject, unknownKey: 'preserved' })` preserves `unknownKey`

3. **Add `rapidVersion` field tests**: Within the `ProjectState` describe block:
   - `ProjectState.parse({ ...validProject })` succeeds without `rapidVersion` (field is optional)
   - `ProjectState.parse({ ...validProject, rapidVersion: '3.2.0' })` preserves the value
   - `ProjectState.safeParse({ ...validProject, rapidVersion: 123 })` fails (not a string)

4. **Update the "has no extra fields" test (line 51-53)**: The test asserts `Object.keys(set).sort()` equals `['id', 'status', 'waves']`. With `.passthrough()`, this test remains valid because it passes no extra fields -- but add a companion test that verifies extra fields ARE kept when present.

5. **Update the "module exports exactly 8 keys" test (line 184-187)**: This test should still pass unchanged since no new schema exports are added.

### Task 7: Update `state-machine.test.cjs` for createInitialState changes

**File:** `src/lib/state-machine.test.cjs`

**Actions:**

1. In the `createInitialState` describe block, add a test:
   - `createInitialState('proj', 'v1.0', '3.2.0')` includes `rapidVersion: '3.2.0'` in the output
   - `createInitialState('proj', 'v1.0')` does NOT include `rapidVersion` in the output (or it is undefined)

2. Add a test verifying that `writeState` + `readState` round-trip preserves unknown fields:
   - Create a state with `createInitialState`, add a custom field like `state.customExtension = 'test'`
   - Write it with `writeState`, read it back with `readState`
   - Assert `state.customExtension === 'test'` (proving passthrough works end-to-end)

## Verification

```bash
# Run schema tests
node --test src/lib/state-schemas.test.cjs

# Run state-machine tests
node --test src/lib/state-machine.test.cjs

# Quick smoke: passthrough works
node -e "
const { ProjectState } = require('./src/lib/state-schemas.cjs');
const result = ProjectState.parse({
  version: 1, projectName: 'test', currentMilestone: 'v1',
  milestones: [], lastUpdatedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z', futureField: 'preserved'
});
if (result.futureField !== 'preserved') { console.error('FAIL: passthrough not working'); process.exit(1); }
console.log('OK: passthrough preserves unknown fields');
"
```

## Success Criteria

- [ ] All 5 Zod object schemas have `.passthrough()` -- unknown fields are preserved through parse()
- [ ] `version` field accepts any positive integer (1, 2, 3...) but rejects 0, negatives, floats, strings
- [ ] `rapidVersion` field is optional string in ProjectState
- [ ] `createInitialState` accepts optional `rapidVersion` parameter
- [ ] `scaffoldProject` passes `getVersion()` as `rapidVersion` during init
- [ ] All existing tests pass (with the noted update to the version rejection test)
- [ ] New passthrough tests verify unknown field preservation for all 5 schemas
- [ ] Round-trip test proves writeState/readState preserves unknown fields
