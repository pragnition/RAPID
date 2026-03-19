# Wave 2 PLAN: add-set CLI Command with DAG Recalculation

**Set:** quick-and-addset
**Wave:** 2 of 3
**Objective:** Implement the `state add-set` CLI subcommand in `src/commands/state.cjs` that atomically adds a new set to a milestone via `withStateTransaction`, then recalculates and persists DAG.json and OWNERSHIP.json. Write unit tests for the recalculation logic.

## File Ownership

| File | Action |
|------|--------|
| `src/commands/state.cjs` | **Modify** (add `add-set` case) |
| `src/lib/add-set.cjs` | **Create** (core add-set logic) |
| `src/lib/add-set.test.cjs` | **Create** (unit tests) |

---

## Task 1: Create `src/lib/add-set.cjs` -- Core Add-Set Logic

### Action

Create a new module at `src/lib/add-set.cjs` that provides two functions:

1. **`addSetToMilestone(cwd, milestoneId, setId, setName, deps)`** -- Add a set and recalculate DAG
   - Use `withStateTransaction(cwd, mutationFn)` from `state-machine.cjs` for atomic STATE.json mutation
   - Inside `mutationFn(state)`:
     - Find the milestone using `findMilestone(state, milestoneId)` from `state-machine.cjs`
     - Check for duplicate set ID: if `milestone.sets.some(s => s.id === setId)`, throw `Error('Set "X" already exists in milestone "Y"')`
     - If `deps` is provided (comma-separated string or array), validate each dependency exists in the milestone's set list. For each dep, check `milestone.sets.some(s => s.id === dep)`. If any dep is not found, throw `Error('Dependency "X" not found in milestone "Y". Available sets: ...')`
     - Push new set object: `milestone.sets.push({ id: setId, status: 'pending', waves: [] })`
   - After transaction completes (STATE.json is written), call `recalculateDAG(cwd, milestoneId)`
   - Return `{ setId, milestoneId, depsValidated: deps || [] }`

2. **`recalculateDAG(cwd, milestoneId)`** -- Rebuild DAG.json and OWNERSHIP.json from current state
   - Read STATE.json via `readState(cwd)` from `state-machine.cjs`
   - Find the milestone via `findMilestone(state, milestoneId)`
   - Build DAG nodes from all sets in the milestone: `milestone.sets.map(s => ({ id: s.id }))`
   - Build DAG edges from dependency declarations. To determine dependencies, read each set's `.planning/sets/{setId}/CONTRACT.json` if it exists. Parse the `imports.fromSets` array (if present) to extract edges: `{ from: imp.set, to: setId }`. If CONTRACT.json does not exist for a set, skip it gracefully (no edges for that set).
   - Additionally, if the set was just added with `--deps`, those deps should already be reflected in the CONTRACT.json or passed through. However, since `add-set` creates a minimal CONTRACT.json (via the SKILL.md), the deps may not be in CONTRACT.json yet. Handle this by: reading the DAG.json if it exists, extracting its existing edges, and merging in any new deps. Actually, simpler approach: store deps as a `dependencies` field in the CONTRACT.json `imports` section during the SKILL.md step. For the CLI command itself, just use CONTRACT.json as the source of truth for edges. The `--deps` flag is validated but not persisted by the CLI -- that is the SKILL.md's responsibility to write into CONTRACT.json.
   - **Revised approach for edges:** Read every set's CONTRACT.json. For each set that has `imports` with a `fromSets` array, create edges. For sets without CONTRACT.json or without imports, create no edges. This is the canonical approach -- CONTRACT.json is the source of truth for dependencies.
   - Call `createDAG(nodes, edges)` from `dag.cjs` -- this handles toposort, wave assignment, cycle detection
   - Call `writeDAG(cwd, dagObj)` from `plan.cjs` to persist `.planning/sets/DAG.json`
   - Build ownership map: for each set, read its CONTRACT.json and extract `fileOwnership` array if present. Call `createOwnershipMap(sets)` from `contract.cjs` where each set has `{ name: setId, ownedFiles: fileOwnership || [] }`. If CONTRACT.json is missing or has no fileOwnership, use empty array.
   - Call `writeOwnership(cwd, ownershipObj)` from `plan.cjs` to persist `.planning/sets/OWNERSHIP.json`
   - Return `{ dag: dagObj, ownership: ownershipObj }`

**Imports needed:**
```javascript
const fs = require('fs');
const path = require('path');
const { readState, withStateTransaction, findMilestone } = require('./state-machine.cjs');
const { createDAG } = require('./dag.cjs');
const { createOwnershipMap } = require('./contract.cjs');
const { writeDAG, writeOwnership } = require('./plan.cjs');
```

**Export:** `module.exports = { addSetToMilestone, recalculateDAG };`

### What NOT to Do
- Do NOT call `writeState` inside the `mutationFn` -- that would deadlock (the `withStateTransaction` docs explicitly warn about this)
- Do NOT store `--deps` in STATE.json -- deps live in CONTRACT.json, not state. The CLI validates deps exist but does not persist them.
- Do NOT create CONTRACT.json or DEFINITION.md from this module -- that is the SKILL.md's responsibility in Step 4
- Do NOT throw on missing CONTRACT.json during DAG recalculation -- skip gracefully (new sets may not have CONTRACT.json yet)

### Verification

```bash
node -e "const a = require('./src/lib/add-set.cjs'); console.log(Object.keys(a));"
# Expected: [ 'addSetToMilestone', 'recalculateDAG' ]
```

### Done Criteria
- Module exports `addSetToMilestone` and `recalculateDAG`
- `addSetToMilestone` uses `withStateTransaction` for atomic mutation
- `recalculateDAG` rebuilds DAG.json and OWNERSHIP.json from CONTRACT.json files
- Duplicate set ID detection throws descriptive error
- Dependency validation checks existing sets before proceeding

---

## Task 2: Create `src/lib/add-set.test.cjs` -- Unit Tests

### Action

Create comprehensive unit tests at `src/lib/add-set.test.cjs` using `node:test` with `node:assert/strict`.

**Test setup:**
- Create a temp dir with `.planning/` and `.planning/sets/` directories
- Initialize a minimal STATE.json using `createInitialState` from `state-machine.cjs`, then call `writeState` to persist it
- The initial state should have a milestone with 1-2 existing sets for testing

**Helper to create a valid state with existing sets:**
```javascript
function createTestState(tmpDir) {
  // Write a STATE.json with milestone "v1" containing sets "set-a" and "set-b"
  const state = {
    version: 1,
    projectName: 'test-project',
    currentMilestone: 'v1',
    milestones: [{
      id: 'v1',
      name: 'Version 1',
      sets: [
        { id: 'set-a', status: 'pending', waves: [] },
        { id: 'set-b', status: 'pending', waves: [] },
      ],
    }],
    lastUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.json'),
    JSON.stringify(state, null, 2)
  );
  return state;
}
```

**Test cases for `addSetToMilestone`:**

1. "adds a new set to the specified milestone" -- add "set-c" to "v1", read STATE.json, verify set-c exists with status "pending" and empty waves array
2. "throws on duplicate set ID" -- add "set-a" (already exists), assert.throws with message matching /already exists/
3. "throws on non-existent milestone" -- add set to "v99", assert.throws with message matching /not found/
4. "validates dependencies exist" -- add "set-c" with deps=["set-a"], should succeed
5. "throws on non-existent dependency" -- add "set-c" with deps=["nonexistent"], assert.throws with message matching /not found/
6. "recalculates DAG.json after adding set" -- add "set-c", verify `.planning/sets/DAG.json` exists and contains node "set-c"
7. "recalculates OWNERSHIP.json after adding set" -- add "set-c", verify `.planning/sets/OWNERSHIP.json` exists

**Test cases for `recalculateDAG`:**

8. "builds DAG from all sets in milestone" -- create state with 3 sets, call recalculateDAG, verify DAG has 3 nodes
9. "reads edges from CONTRACT.json imports" -- create CONTRACT.json for set-b with `imports: { fromSets: [{ set: 'set-a' }] }`, call recalculateDAG, verify DAG has edge from set-a to set-b
10. "handles sets without CONTRACT.json gracefully" -- do not create any CONTRACT.json files, call recalculateDAG, verify DAG has nodes but no edges (no crash)
11. "writes OWNERSHIP.json based on CONTRACT.json fileOwnership" -- create CONTRACT.json with fileOwnership for set-a, call recalculateDAG, verify OWNERSHIP.json maps those files to set-a

**Important:** For test cases that check DAG.json, read the file from disk and parse it. Verify `dag.nodes` array contains the expected set IDs. For edge tests, verify `dag.edges` contains the expected `{ from, to }` entries.

**Important:** Initialize the `.planning/locks/` directory in the temp dir so that `withStateTransaction` can acquire locks: `fs.mkdirSync(path.join(tmpDir, '.planning', 'locks'), { recursive: true })`. Actually, check if `acquireLock` creates the directory -- it likely does via `mkdirSync` with `recursive: true` in `lock.cjs`. Verify by reading `lock.cjs` behavior. If not, create it in the test setup.

### Verification

```bash
node --test src/lib/add-set.test.cjs
# Expected: all tests pass
```

### Done Criteria
- All 11 test cases pass
- Tests use isolated temp directories
- Tests verify both STATE.json mutation and DAG.json/OWNERSHIP.json persistence

---

## Task 3: Wire `add-set` Subcommand into `src/commands/state.cjs`

### Action

Add a new case `'add-set'` to the `switch(subcommand)` block in `handleState` function in `src/commands/state.cjs`.

**Insert the new case before the `default:` case** (around line 163, before `default: throw new CliError(...)`).

**Implementation:**

```javascript
case 'add-set': {
  const { parseArgs } = require('../lib/args.cjs');
  const { flags } = parseArgs(args, {
    milestone: 'string',
    'set-id': 'string',
    'set-name': 'string',
    deps: 'string',
  });

  if (!flags.milestone || !flags['set-id'] || !flags['set-name']) {
    throw new CliError(
      'Usage: state add-set --milestone <id> --set-id <id> --set-name <name> [--deps <dep1,dep2>]'
    );
  }

  const deps = flags.deps ? flags.deps.split(',').map(d => d.trim()).filter(Boolean) : [];

  const { addSetToMilestone } = require('../lib/add-set.cjs');
  const result = await addSetToMilestone(
    cwd,
    flags.milestone,
    flags['set-id'],
    flags['set-name'],
    deps
  );
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  break;
}
```

**Key details:**
- `parseArgs` is imported lazily inside the case block (matching the pattern used elsewhere -- `parseArgs` is not imported at the top of state.cjs)
- `--deps` is a comma-separated string that gets split into an array
- `--set-name` is passed to `addSetToMilestone` but currently unused in the state mutation (sets in STATE.json only have `id`, `status`, `waves`). The name parameter is reserved for DEFINITION.md creation by the SKILL.md. However, it is still required by the CLI for validation and future use.
- `addSetToMilestone` is imported lazily inside the case block

**Also update the USAGE string** in `src/bin/rapid-tools.cjs` to include the `add-set` command. Add this line after the existing `state add-milestone` line (around line 39):

```
  state add-set --milestone <id> --set-id <id> --set-name <name> [--deps <dep1,dep2>]  Add new set to milestone
```

### What NOT to Do
- Do NOT modify the `handleState` function signature
- Do NOT change the error handling pattern (CliError wrapping in the catch block)
- Do NOT add `readStdinAsync` -- this command uses flags only, no stdin

### Verification

```bash
node src/bin/rapid-tools.cjs --help 2>&1 | grep "add-set"
# Expected: two lines (add-milestone and add-set)
```

Test with a real invocation (will fail if no STATE.json exists, but the error should be from the add-set logic, not a routing error):
```bash
node src/bin/rapid-tools.cjs state add-set --milestone v1 --set-id test-set --set-name "Test Set" 2>&1
# Expected: either success JSON or a CliError about STATE.json not found -- NOT "Unknown state subcommand"
```

### Done Criteria
- `state add-set` subcommand is recognized and routed correctly
- Flag parsing validates required flags and provides usage message
- USAGE help includes the `state add-set` line
- The command calls `addSetToMilestone` and outputs JSON result

---

## Success Criteria (Wave 2 Complete)

1. `src/lib/add-set.cjs` exports `addSetToMilestone` and `recalculateDAG`
2. All 11 unit tests in `src/lib/add-set.test.cjs` pass
3. `rapid-tools state add-set --milestone <id> --set-id <id> --set-name <name>` atomically adds a set to STATE.json
4. After `add-set`, DAG.json is regenerated with all sets from the milestone
5. After `add-set`, OWNERSHIP.json is regenerated from CONTRACT.json files
6. Duplicate set ID and invalid dependency are rejected with descriptive errors
7. USAGE help includes the `state add-set` line
