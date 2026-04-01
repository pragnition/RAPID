# PLAN: dag-central-grouping -- Wave 2

## Objective

Build the group partitioning algorithm in a new `group.cjs` module and add DAG status synchronization to `dag.cjs`. The group algorithm partitions sets into N developer groups using a conflict-minimization strategy based on file ownership data from contracts. The status sync reads set statuses from STATE.json and writes them into DAG.json node statuses.

## Prerequisites

- Wave 1 complete: `createDAGv3`, `validateDAGv3`, `migrateDAGv1toV3`, `migrateDAGv2toV3`, updated `tryLoadDAG`, fixed `getExecutionOrder` all available.

## Files Modified

| File | Action |
|------|--------|
| `src/lib/group.cjs` | New -- partitionIntoGroups, annotateDAGWithGroups, generateGroupReport |
| `src/lib/group.test.cjs` | New -- comprehensive tests for grouping algorithm |
| `src/lib/dag.cjs` | Extend with syncDAGStatus |
| `src/lib/dag.test.cjs` | Extend with syncDAGStatus tests |

## Tasks

### Task 1: Implement `partitionIntoGroups()` in group.cjs

**What:** Create `src/lib/group.cjs` with the core group partitioning algorithm.

**Function signature:** `partitionIntoGroups(dag, contracts, numDevelopers)`

**Parameters:**
- `dag` -- v3 DAG object (has `nodes` array with `{ id, ... }`)
- `contracts` -- Map or object of `setId -> { fileOwnership?: string[], definition?: { ownedFiles?: string[] } }` (contract data per set)
- `numDevelopers` -- integer >= 1, the number of groups to create

**Algorithm (deterministic, conflict-first with balance tiebreaker):**

1. **Build file-to-set ownership map:** For each set in the DAG, look up its contract and extract file ownership from `contracts[setId].fileOwnership` or `contracts[setId].definition.ownedFiles`. Build `Map<filePath, Set<setId>>`.

2. **Build conflict graph:** For each file owned by 2+ sets, create conflict edges between all pairs. Store as `Map<setId, Map<setId, conflictCount>>` (count = number of shared files).

3. **Initialize groups:** Create `numDevelopers` empty groups: `Array<{ id: string, sets: string[], fileSet: Set<string> }>`. Group IDs are `"G1"`, `"G2"`, ..., `"GN"`.

4. **Sort sets for assignment:** Sort all set IDs alphabetically (determinism).

5. **Greedy assignment:** For each set (sorted):
   a. For each group, compute `conflictScore` = number of files this set owns that are already in this group's `fileSet`.
   b. Find the minimum `conflictScore` across all groups.
   c. Among groups with the minimum conflictScore, pick the one with the smallest `sets.length` (balance tiebreaker).
   d. If still tied, pick the group with the smallest group ID (alphabetical tiebreaker for determinism).
   e. Add set to chosen group. Add set's owned files to group's `fileSet`.

6. **Build cross-group edges:** For each edge in `dag.edges`, check if `from` and `to` are in different groups. Collect as `Array<{ from, to, fromGroup, toGroup }>`.

7. **Return:** `{ groups: Record<string, { sets: string[], description?: string }>, crossGroupEdges, assignments: Record<setId, groupId> }`.

**Edge cases:**
- If `numDevelopers >= dag.nodes.length`, each set gets its own group (extras are empty).
- If `numDevelopers === 1`, all sets go to G1.
- If a set has no contract or no file ownership, it has no conflict constraints (purely balanced).

**What NOT to do:**
- Do NOT use randomness or Date.now() for any ordering -- algorithm must be fully deterministic.
- Do NOT read files from disk -- contracts are passed in as a parameter.

**Verification:**
```bash
node --test src/lib/group.test.cjs 2>&1 | grep -E '(pass|fail|partitionIntoGroups)'
```

### Task 2: Implement `annotateDAGWithGroups()` in group.cjs

**What:** Add function that returns a new DAG with group fields populated.

**Function signature:** `annotateDAGWithGroups(dag, groupResult)`

**Parameters:**
- `dag` -- v3 DAG object
- `groupResult` -- return value from `partitionIntoGroups()` (has `groups` and `assignments`)

**Behavior:**
- Deep-clone the DAG (do not mutate input).
- For each node in the cloned DAG, set `node.group = groupResult.assignments[node.id] || null`.
- Set `dag.groups = groupResult.groups`.
- Return the cloned DAG.

**What NOT to do:**
- Do NOT mutate the input DAG.
- Do NOT validate the DAG (caller is responsible for passing a valid v3 DAG).

**Verification:**
```bash
node --test src/lib/group.test.cjs 2>&1 | grep -E '(pass|fail|annotateDAGWithGroups)'
```

### Task 3: Implement `generateGroupReport()` in group.cjs

**What:** Add function that returns a markdown summary of group assignments.

**Function signature:** `generateGroupReport(groupResult)`

**Parameters:**
- `groupResult` -- return value from `partitionIntoGroups()` (has `groups`, `crossGroupEdges`, `assignments`)

**Behavior:**
- Returns a markdown string with:
  - Header: `## Developer Group Assignments`
  - For each group (sorted by group ID):
    - `### G1` (or G2, etc.)
    - Bulleted list of sets in the group (sorted alphabetically)
  - If `crossGroupEdges.length > 0`:
    - `### Cross-Group Dependencies`
    - Table: `| From | To | From Group | To Group |`
    - Rows for each cross-group edge
  - Summary line: `**N groups, M sets, K cross-group dependencies**`

**What NOT to do:**
- Do NOT include ANSI color codes in the output (it is markdown, not terminal output).

**Verification:**
```bash
node --test src/lib/group.test.cjs 2>&1 | grep -E '(pass|fail|generateGroupReport)'
```

### Task 4: Implement `syncDAGStatus()` in dag.cjs

**What:** Add an async function to dag.cjs that reads set statuses from STATE.json and writes them into DAG.json.

**Function signature:** `async syncDAGStatus(cwd)`

**Behavior:**
1. Call `tryLoadDAG(cwd)` to get `{ dag, path, migrated }`.
2. If `dag` is null, return early (no DAG to sync).
3. Call `readState(cwd)` to get state.
4. If state is null or invalid, return early.
5. Find current milestone from `state.currentMilestone`.
6. Build a status map: `setId -> status` from `milestone.sets`.
7. For each node in `dag.nodes`: if `statusMap[node.id]` exists, set `node.status = statusMap[node.id]`.
8. Write the updated DAG back to disk using `fs.writeFileSync(path, JSON.stringify(dag, null, 2))`.
9. If `migrated` was true (from tryLoadDAG), the write also persists the migration.

**Import requirements:** This function needs `readState` from `state-machine.cjs`. Use a lazy require inside the function body to avoid circular dependencies:
```js
const { readState } = require('./state-machine.cjs');
```

**What NOT to do:**
- Do NOT call syncDAGStatus from within tryLoadDAG (tryLoadDAG stays sync).
- Do NOT remove the existing manual statusMap building in `commands/dag.cjs` `show` subcommand -- that will be updated in Wave 3.

**Verification:**
```bash
node --test src/lib/dag.test.cjs 2>&1 | grep -E '(pass|fail|syncDAGStatus)'
```

### Task 5: Export functions from group.cjs

**What:** Set up module.exports for group.cjs.

**Exports:**
```js
module.exports = {
  partitionIntoGroups,
  annotateDAGWithGroups,
  generateGroupReport,
};
```

**Also add syncDAGStatus to dag.cjs module.exports.**

**Verification:**
```bash
node -e "const g = require('./src/lib/group.cjs'); console.log(Object.keys(g).sort().join(', '))"
node -e "const d = require('./src/lib/dag.cjs'); console.log(d.syncDAGStatus ? 'syncDAGStatus exported' : 'MISSING')"
```

### Task 6: Write comprehensive tests

**What:** Create `src/lib/group.test.cjs` and extend `src/lib/dag.test.cjs`.

**group.test.cjs test suites:**

**`describe('partitionIntoGroups')`:**
- Assigns all sets to G1 when numDevelopers is 1.
- Creates N groups when numDevelopers is N.
- Produces deterministic output (run twice with same input, same result).
- Minimizes cross-group file conflicts (sets sharing files end up in same group).
- Balances group sizes when no conflicts exist (4 sets, 2 groups = 2 each).
- Handles sets with no contract data (no file ownership).
- Handles numDevelopers >= number of sets (each set gets own group).
- Cross-group edges are correctly identified.
- Assignments map contains all set IDs.

**`describe('annotateDAGWithGroups')`:**
- Sets group field on each node from assignments.
- Sets top-level groups field from groupResult.groups.
- Does not mutate the input DAG.
- Handles nodes not in assignments (group stays null).

**`describe('generateGroupReport')`:**
- Returns markdown string with group headers.
- Includes cross-group dependencies table when edges exist.
- Omits cross-group section when no cross-group edges.
- Includes summary line with correct counts.

**dag.test.cjs additions:**

**`describe('syncDAGStatus')`:**
- Syncs statuses from STATE.json to DAG.json on disk.
- Handles missing DAG.json gracefully (no throw).
- Handles missing STATE.json gracefully (no throw).
- Does not overwrite nodes not in STATE.json.
- Persists the synced DAG to disk.

**Verification:**
```bash
node --test src/lib/group.test.cjs && node --test src/lib/dag.test.cjs
```

## Success Criteria

1. All Wave 1 tests continue to pass.
2. `partitionIntoGroups` produces deterministic output for identical inputs.
3. Conflict minimization: sets sharing files prefer the same group.
4. Balance: equal-sized groups when no conflicts.
5. `annotateDAGWithGroups` does not mutate input.
6. `generateGroupReport` returns well-formed markdown.
7. `syncDAGStatus` reads STATE.json and writes statuses to DAG.json.
8. Full test suite: `node --test src/lib/group.test.cjs && node --test src/lib/dag.test.cjs` exits 0.
