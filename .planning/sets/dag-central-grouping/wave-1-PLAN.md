# PLAN: dag-central-grouping -- Wave 1

## Objective

Evolve the DAG module from v1/v2 to a v3 schema with developer group annotations. Implement DAGv3 creation, validation, migration from v1 and v2, update `tryLoadDAG()` to auto-detect and migrate with a `migrated` flag, and fix `getExecutionOrder()` to handle all DAG versions. All changes are backward compatible -- existing v1 consumers continue working.

## Files Modified

| File | Action |
|------|--------|
| `src/lib/dag.cjs` | Extend with createDAGv3, validateDAGv3, migrateDAGv1toV3, migrateDAGv2toV3, update tryLoadDAG, fix getExecutionOrder |
| `src/lib/dag.test.cjs` | Add comprehensive tests for all new functions and backward compat |

## Tasks

### Task 1: Implement `createDAGv3()` in dag.cjs

**What:** Add a `createDAGv3(nodes, edges, options?)` function that produces a v3 DAG.

**Behavior:**
- Accepts nodes array (each node: `{ id, type?, ... }`) and edges array (`{ from, to }`).
- Optional `options` parameter: `{ groups?: Record<string, { sets: string[], description?: string }> }`.
- Reuses existing `toposort()` for cycle detection and `assignWaves()` for wave computation.
- Validates duplicate node IDs (like createDAG/createDAGv2).
- Node type defaults to `'set'` when not provided (unlike v2 which requires type).
- Does NOT enforce same-type edge restriction (unlike v2 -- v3 is more permissive since it defaults type).
- Builds DAG nodes with: `{ ...node, type: node.type || 'set', wave, status: 'pending', group: null, priority: null, description: null }`.
- Waves use `nodes` key (never `sets`): `{ waves: { "1": { nodes: ["a", "b"] } } }`.
- Metadata uses `totalNodes` (not `totalSets`).
- Top-level fields: `{ version: 3, nodes, edges, waves, groups: options?.groups || {}, metadata }`.
- Metadata: `{ created, totalNodes, totalWaves, maxParallelism }`.

**What NOT to do:**
- Do NOT remove createDAG or createDAGv2 -- they must remain for backward compat.
- Do NOT add a checkpoint object to waves (that is v1-only).

**Verification:**
```bash
node --test src/lib/dag.test.cjs 2>&1 | grep -E '(pass|fail|createDAGv3)'
```

### Task 2: Implement `validateDAGv3()` in dag.cjs

**What:** Add a `validateDAGv3(dag)` function that validates a v3 DAG structure.

**Behavior:**
- Returns `{ valid: true }` or `{ valid: false, errors: string[] }`.
- Checks: `version === 3`, `nodes` is array, `edges` is array, `waves` is non-array object, `metadata` is non-array object, `groups` is non-array object.
- Each node must have: `id`, `wave` (not null/undefined), `status`.
- Node `type` is optional in v3 validation (defaults were applied at creation time, but loaded DAGs might lack it).
- Each edge must have: `from`, `to`.
- Metadata must have: `totalNodes`, `totalWaves`.
- `groups` field must be present (can be `{}`).

**What NOT to do:**
- Do NOT modify validateDAG or validateDAGv2.

**Verification:**
```bash
node --test src/lib/dag.test.cjs 2>&1 | grep -E '(pass|fail|validateDAGv3)'
```

### Task 3: Implement migration functions

**What:** Add `migrateDAGv1toV3(dagV1)` and `migrateDAGv2toV3(dagV2)` as separate pure functions.

**migrateDAGv1toV3 behavior:**
1. Set `version: 3`.
2. For each node: add `type: 'set'`, `group: null`, `priority: null`, `description: null` (preserve existing id, wave, status and any extra properties).
3. Convert each wave: rename `waves[N].sets` to `waves[N].nodes`, remove `checkpoint` property.
4. In metadata: rename `totalSets` to `totalNodes` (copy the value), preserve all other metadata fields.
5. Add `groups: {}` at top level.
6. Return a new object (do not mutate input).

**migrateDAGv2toV3 behavior:**
1. Change `version: 2` to `version: 3`.
2. For each node: add `group: null`, `priority: null`, `description: null` (preserve existing type, id, wave, status).
3. Waves already use `nodes` key -- no conversion needed.
4. Add `groups: {}` at top level.
5. Return a new object (do not mutate input).

**Detection logic (used by tryLoadDAG in Task 4):**
- No `version` field AND `waves[N].sets` exists = v1.
- `version === 2` = v2.
- `version === 3` = v3 (no migration needed).

**What NOT to do:**
- Do NOT chain v1 -> v2 -> v3. Each migration goes directly to v3.
- Do NOT mutate the input DAG object.

**Verification:**
```bash
node --test src/lib/dag.test.cjs 2>&1 | grep -E '(pass|fail|migrate)'
```

### Task 4: Update `tryLoadDAG()` to auto-detect version and return `migrated` flag

**What:** Modify `tryLoadDAG(cwd)` to return `{ dag, path, migrated }`.

**Behavior:**
- After parsing JSON, detect version using the detection logic from Task 3.
- If v1: run `migrateDAGv1toV3()`, set `migrated = true`.
- If v2: run `migrateDAGv2toV3()`, set `migrated = true`.
- If v3 (or null): set `migrated = false`.
- Return `{ dag, path, migrated }`.
- `tryLoadDAG` remains synchronous. It does NOT write the migrated DAG back to disk (caller decides).
- When `dag` is null (ENOENT), return `{ dag: null, path, migrated: false }`.

**Breaking change awareness:** All existing callers destructure `{ dag, path }` which still works since `migrated` is a new field. No callers break.

**What NOT to do:**
- Do NOT make tryLoadDAG async.
- Do NOT persist the migrated DAG from within tryLoadDAG.

**Verification:**
```bash
node --test src/lib/dag.test.cjs 2>&1 | grep -E '(pass|fail|tryLoadDAG)'
```

### Task 5: Fix `getExecutionOrder()` for v2/v3 compatibility

**What:** Update `getExecutionOrder()` to handle all DAG versions.

**Current code (broken for v2/v3):**
```js
return waveNumbers.map((waveNum) => dag.waves[waveNum].sets);
```

**New code:**
```js
return waveNumbers.map((waveNum) => dag.waves[waveNum].nodes || dag.waves[waveNum].sets);
```

This single change fixes v2 and v3 DAGs (which use `.nodes`) while preserving v1 compat (which uses `.sets`).

**Verification:**
```bash
node --test src/lib/dag.test.cjs 2>&1 | grep -E '(pass|fail|getExecutionOrder)'
```

### Task 6: Add exports to module.exports

**What:** Add all new functions to the `module.exports` block at the bottom of `dag.cjs`.

**New exports to add:**
- `createDAGv3`
- `validateDAGv3`
- `migrateDAGv1toV3`
- `migrateDAGv2toV3`

**Verification:**
```bash
node -e "const d = require('./src/lib/dag.cjs'); console.log(Object.keys(d).sort().join(', '))"
```

### Task 7: Write comprehensive tests in dag.test.cjs

**What:** Add test suites for all new functionality. Tests should be appended after the existing `tryLoadDAG` describe block.

**Test suites to add:**

**`describe('createDAGv3')`:**
- Returns version:3 DAG with group fields on nodes.
- Nodes default to type 'set' when type not provided.
- Preserves explicit node type when provided.
- Groups default to `{}` when no options passed.
- Groups populated when options.groups is provided.
- Nodes have `group: null`, `priority: null`, `description: null` by default.
- Waves use `nodes` key (not `sets`).
- Metadata has `totalNodes` (not `totalSets`).
- Rejects duplicate node IDs.
- Rejects cycles.
- Preserves extra node properties.

**`describe('validateDAGv3')`:**
- Returns `{ valid: true }` for well-formed v3 DAG.
- Returns `{ valid: false }` when version is not 3.
- Returns `{ valid: false }` for missing nodes/edges/waves/metadata/groups.
- Validates node required fields (id, wave, status).
- Validates edge required fields (from, to).
- Validates metadata required fields (totalNodes, totalWaves).

**`describe('migrateDAGv1toV3')`:**
- Converts v1 DAG to v3 with correct version.
- Converts `waves[N].sets` to `waves[N].nodes`.
- Removes `checkpoint` from waves.
- Adds group/priority/description to nodes.
- Renames metadata.totalSets to metadata.totalNodes.
- Adds `groups: {}`.
- Does not mutate input.
- Result passes validateDAGv3.

**`describe('migrateDAGv2toV3')`:**
- Converts v2 DAG to v3 with correct version.
- Adds group/priority/description to nodes.
- Preserves existing node type.
- Waves already use `nodes` -- preserved.
- Adds `groups: {}`.
- Does not mutate input.
- Result passes validateDAGv3.

**`describe('tryLoadDAG - migration')`:**
- Returns `migrated: false` when DAG.json does not exist.
- Returns `migrated: true` for v1 DAG (and dag is now v3).
- Returns `migrated: true` for v2 DAG (and dag is now v3).
- Returns `migrated: false` for v3 DAG.
- Migrated v1 DAG passes validateDAGv3.

**`describe('getExecutionOrder - v2/v3 compat')`:**
- Works with v2 DAG (waves use `.nodes`).
- Works with v3 DAG (waves use `.nodes`).
- Still works with v1 DAG (waves use `.sets`).

**Verification:**
```bash
node --test src/lib/dag.test.cjs
```

## Success Criteria

1. All existing tests pass unchanged (backward compat).
2. All new tests pass.
3. `createDAGv3` produces valid v3 DAGs that pass `validateDAGv3`.
4. `migrateDAGv1toV3` converts v1 to valid v3 without mutating input.
5. `migrateDAGv2toV3` converts v2 to valid v3 without mutating input.
6. `tryLoadDAG` returns `{ dag, path, migrated }` with correct `migrated` flag.
7. `getExecutionOrder` works with v1, v2, and v3 DAGs.
8. No existing module.exports removed.
9. Full test suite: `node --test src/lib/dag.test.cjs` exits 0.
