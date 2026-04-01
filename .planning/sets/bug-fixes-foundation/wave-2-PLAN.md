# PLAN: bug-fixes-foundation -- Wave 2

## Objective

Fix the three core bugs -- REQUIREMENTS.md overwrite by scaffold, roadmapper STATE.json overwrite (via new `mergeStatePartial()`), and `recalculateDAG()` annotation stripping -- and update the init SKILL.md to reference the new merge function. These are moderate-complexity changes that each touch a distinct function in a distinct file.

## Tasks

### Task 1: Fix REQUIREMENTS.md overwrite in `scaffoldProject()`

**File:** `src/lib/init.cjs` (lines 300-307, the fresh-mode loop)

**Context:** In fresh mode, `scaffoldProject()` iterates over `fileGenerators` and writes every file unconditionally. This overwrites REQUIREMENTS.md even when it already contains user-approved encoded criteria. The upgrade mode (line 289) already skips existing files. The reinitialize mode backs up first, so overwriting is intentional there. Only fresh mode needs fixing.

**Action:** In the fresh-mode loop (lines 304-306), add a guard before writing REQUIREMENTS.md. If the file already exists and has non-empty trimmed content, skip it and add the filename to a `skipped` array instead of `created`.

Modify the fresh-mode block (lines 300-309):

**Before:**
```js
  // Default: fresh mode
  fs.mkdirSync(planningDir, { recursive: true });
  ensureResearchDir();
  const created = [];
  for (const [filename, generator] of Object.entries(fileGenerators)) {
    fs.writeFileSync(path.join(planningDir, filename), generator());
    created.push(filename);
  }

  return { created, skipped: [] };
```

**After:**
```js
  // Default: fresh mode
  fs.mkdirSync(planningDir, { recursive: true });
  ensureResearchDir();
  const created = [];
  const skipped = [];
  for (const [filename, generator] of Object.entries(fileGenerators)) {
    const filePath = path.join(planningDir, filename);
    // Protect REQUIREMENTS.md if it already has user content
    if (filename === 'REQUIREMENTS.md' && fs.existsSync(filePath)) {
      try {
        const existing = fs.readFileSync(filePath, 'utf-8');
        if (existing.trim().length > 0) {
          skipped.push(filename);
          continue;
        }
      } catch {
        // Unreadable file -- protect it, log warning
        process.stderr.write(`[RAPID] Warning: could not read existing ${filename}, skipping overwrite\n`);
        skipped.push(filename);
        continue;
      }
    }
    fs.writeFileSync(filePath, generator());
    created.push(filename);
  }

  return { created, skipped };
```

**What NOT to do:**
- Do not change the reinitialize mode behavior -- it intentionally backs up and overwrites.
- Do not change the upgrade mode -- it already skips existing files.
- Do not remove REQUIREMENTS.md from `fileGenerators` -- it should still be generated for truly fresh projects.
- Do not use a regex pattern check -- a simple `trim().length > 0` is the correct heuristic per CONTEXT.md decisions.

**Test file:** `src/lib/init.test.cjs`

**Action:** Add a regression test describe block:

```js
describe('REQUIREMENTS.md preservation in fresh mode', () => {
  it('does not overwrite REQUIREMENTS.md with existing content', () => {
    // First scaffold creates REQUIREMENTS.md
    scaffoldProject(tmpDir, { name: 'TestProject', description: 'Test', teamSize: 1 }, 'fresh');
    
    // Write user content to REQUIREMENTS.md
    const reqPath = path.join(tmpDir, '.planning', 'REQUIREMENTS.md');
    fs.writeFileSync(reqPath, '# My Requirements\n\n- Feature A must do X\n');
    
    // Second fresh scaffold should NOT overwrite
    const result = scaffoldProject(tmpDir, { name: 'TestProject', description: 'Test', teamSize: 1 }, 'fresh');
    
    const content = fs.readFileSync(reqPath, 'utf-8');
    assert.ok(content.includes('Feature A must do X'), 'User content should be preserved');
    assert.ok(result.skipped.includes('REQUIREMENTS.md'), 'REQUIREMENTS.md should be in skipped list');
  });
  
  it('overwrites empty REQUIREMENTS.md in fresh mode', () => {
    // Create empty REQUIREMENTS.md
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'REQUIREMENTS.md'), '');
    
    const result = scaffoldProject(tmpDir, { name: 'TestProject', description: 'Test', teamSize: 1 }, 'fresh');
    
    assert.ok(result.created.includes('REQUIREMENTS.md'), 'Empty REQUIREMENTS.md should be overwritten');
  });
  
  it('still creates REQUIREMENTS.md on truly fresh project', () => {
    const result = scaffoldProject(tmpDir, { name: 'TestProject', description: 'Test', teamSize: 1 }, 'fresh');
    
    assert.ok(result.created.includes('REQUIREMENTS.md'), 'REQUIREMENTS.md should be created');
    const reqPath = path.join(tmpDir, '.planning', 'REQUIREMENTS.md');
    assert.ok(fs.existsSync(reqPath), 'REQUIREMENTS.md file should exist');
  });
});
```

**Verification:**
```bash
node --test src/lib/init.test.cjs
```

---

### Task 2: Implement `mergeStatePartial()` in state-machine.cjs

**File:** `src/lib/state-machine.cjs`

**Context:** The roadmapper in init SKILL.md Step 9 currently overwrites the entire STATE.json, destroying the `version`, `projectName`, `createdAt`, and `rapidVersion` envelope fields. A new `mergeStatePartial()` function is needed that merges only the specified fields into the existing state within a transaction.

**Action:** Add a new `mergeStatePartial` function after `withStateTransaction` (after line 268). Then export it from `module.exports` (line 523).

**Insert after line 268 (after the closing brace of `withStateTransaction`):**

```js
/**
 * Merge a partial state update into existing STATE.json within a transaction.
 * Preserves all existing fields not included in the partial update.
 * 
 * Supported partial fields:
 * - milestones: Wholesale replacement of the milestones array
 * - currentMilestone: Direct assignment
 * 
 * lastUpdatedAt is auto-set by the transaction wrapper.
 * The merged result is validated against ProjectState schema.
 *
 * @param {string} cwd - Project root directory
 * @param {Object} partial - Fields to merge (milestones, currentMilestone)
 * @returns {Promise<object>} The validated state after merge
 * @throws {Error} If merged state fails Zod validation
 */
async function mergeStatePartial(cwd, partial) {
  return withStateTransaction(cwd, (state) => {
    if (partial.milestones !== undefined) {
      state.milestones = partial.milestones;
    }
    if (partial.currentMilestone !== undefined) {
      state.currentMilestone = partial.currentMilestone;
    }
  });
}
```

**Export:** Add `mergeStatePartial` to the `module.exports` object at line 523:

**Before:**
```js
module.exports = {
  createInitialState,
  readState,
  writeState,
  withStateTransaction,
```

**After:**
```js
module.exports = {
  createInitialState,
  readState,
  writeState,
  withStateTransaction,
  mergeStatePartial,
```

**What NOT to do:**
- Do not validate the partial object itself against Zod -- partials are inherently incomplete. Only the merged result is validated (handled by `withStateTransaction`).
- Do not manually set `lastUpdatedAt` -- `withStateTransaction` already does this at line 258.
- Do not bypass `withStateTransaction` -- the function must use it for locking and atomic writes.
- Do not spread the entire partial onto state -- only merge the known fields explicitly to avoid accidental overwrite of `version`, `createdAt`, etc.

**Test file:** `src/lib/state-machine.test.cjs`

**Action:** Add tests for `mergeStatePartial`. Import it from the module. Create a test fixture with a valid STATE.json on disk.

```js
describe('mergeStatePartial', () => {
  it('replaces milestones while preserving envelope fields', async () => {
    // Setup: create a valid STATE.json with known envelope fields
    // ... (use createInitialState + writeState, or write JSON directly)
    
    const newMilestones = [
      { id: 'v2.0', name: 'Version 2', sets: [] },
    ];
    
    await mergeStatePartial(tmpDir, { milestones: newMilestones });
    
    const result = await readState(tmpDir);
    assert.ok(result.valid);
    assert.equal(result.state.milestones.length, 1);
    assert.equal(result.state.milestones[0].id, 'v2.0');
    // Envelope fields preserved
    assert.equal(result.state.version, 1);
    assert.equal(result.state.projectName, 'TestProject');
    assert.ok(result.state.createdAt); // still present
  });

  it('updates currentMilestone without touching milestones', async () => {
    await mergeStatePartial(tmpDir, { currentMilestone: 'v2.0' });
    
    const result = await readState(tmpDir);
    assert.ok(result.valid);
    assert.equal(result.state.currentMilestone, 'v2.0');
  });

  it('throws on invalid merged state', async () => {
    // Pass milestones with invalid structure to trigger Zod error
    await assert.rejects(
      () => mergeStatePartial(tmpDir, { milestones: 'not-an-array' }),
      /validation/i
    );
  });
});
```

The test setup should create a temp directory with `.planning/STATE.json` containing a valid initial state (using `createInitialState` + `fs.writeFileSync`). Pattern from existing tests: use `beforeEach` to create tmpDir, write STATE.json, and `afterEach` to clean up.

**Verification:**
```bash
node --test src/lib/state-machine.test.cjs
```

---

### Task 3: Fix `recalculateDAG()` annotation preservation

**File:** `src/lib/add-set.cjs` (line 99)

**Context:** Currently, `recalculateDAG()` builds DAG nodes as bare `{ id: s.id }` objects, stripping any existing annotations (group, priority, description) from DAG.json. The `createDAG()` function in dag.cjs already uses object spread (`{ ...node, wave, status }`) so annotations on the input nodes are preserved through the pipeline.

**Action:** Before building nodes, load the existing DAG.json from disk using `tryLoadDAG()` from `dag.cjs`. Build a lookup map of existing nodes by ID. When constructing nodes, spread the existing node properties onto each new node.

**Step 1: Add import.** At the top of the file (line 17), add `tryLoadDAG` to the `dag.cjs` import:

**Before:**
```js
const { createDAG } = require('./dag.cjs');
```

**After:**
```js
const { createDAG, tryLoadDAG } = require('./dag.cjs');
```

**Step 2: Modify node construction.** Replace line 99:

**Before (line 98-99):**
```js
  // Build DAG nodes from all sets in the milestone
  const nodes = milestone.sets.map(s => ({ id: s.id }));
```

**After:**
```js
  // Load existing DAG.json to preserve annotations (group, priority, description, etc.)
  const existingDAG = tryLoadDAG(cwd);
  const existingNodeMap = {};
  if (existingDAG.dag && Array.isArray(existingDAG.dag.nodes)) {
    for (const node of existingDAG.dag.nodes) {
      existingNodeMap[node.id] = node;
    }
  }

  // Build DAG nodes from all sets in the milestone, preserving existing annotations
  const nodes = milestone.sets.map(s => {
    const existing = existingNodeMap[s.id];
    if (existing) {
      // Spread preserves all existing properties (group, priority, description, etc.)
      // The id field is set explicitly to ensure correctness
      return { ...existing, id: s.id };
    }
    return { id: s.id };
  });
```

**What NOT to do:**
- Do not selectively copy known properties (group, priority, description) -- use object spread to carry forward all properties, including unknown future ones.
- Do not throw or fail if DAG.json does not exist -- `tryLoadDAG` returns `{ dag: null }` gracefully for first-time recalculations.
- Do not preserve `wave` or `status` from existing nodes -- `createDAG()` recalculates these and they should be recomputed. Actually, `createDAG()` uses `{ ...node, wave, status }` which will override them, so spreading the existing node (which may include stale wave/status) is safe because createDAG overwrites them.

**Test file:** `src/lib/add-set.test.cjs`

**Action:** Add a test that verifies annotations are preserved during recalculation.

```js
describe('recalculateDAG annotation preservation', () => {
  it('preserves existing node annotations during recalculation', async () => {
    // Setup: create STATE.json with a milestone containing sets
    // Write a DAG.json with annotated nodes (group, priority, description)
    // Call recalculateDAG()
    // Verify the returned DAG nodes still have the annotations
    
    // 1. Write STATE.json with sets
    // 2. Write DAG.json with annotations:
    //    { nodes: [{ id: 'set-a', group: 'core', priority: 1, description: 'Core set' }], edges: [], ... }
    // 3. Call recalculateDAG(tmpDir, milestoneId)
    // 4. Read the written DAG.json and verify annotations survive
    
    // The key assertion:
    const dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
    const nodeA = dagJson.nodes.find(n => n.id === 'set-a');
    assert.equal(nodeA.group, 'core');
    assert.equal(nodeA.priority, 1);
    assert.equal(nodeA.description, 'Core set');
  });

  it('handles missing DAG.json gracefully (first recalculation)', async () => {
    // Setup: STATE.json with sets, but NO DAG.json on disk
    // Call recalculateDAG() -- should succeed and create DAG.json with bare nodes
    // Verify nodes have id, wave, status but no annotations
  });
});
```

The test requires a valid STATE.json on disk. Use the existing test patterns in `add-set.test.cjs` to set up the test fixture (temp directory with `.planning/STATE.json` and `.planning/sets/` structure).

**Verification:**
```bash
node --test src/lib/add-set.test.cjs
```

---

### Task 4: Update init SKILL.md Step 9 to use `mergeStatePartial`

**File:** `skills/init/SKILL.md` (around lines 894-896)

**Context:** Step 9c currently instructs the agent to write STATE.json directly with the roadmapper's `state` content, which overwrites the envelope fields. It should instead instruct the agent to use `mergeStatePartial()` via the CLI.

**Action:** Replace the Step 9c instruction that says to write STATE.json directly. Instead, instruct the agent to use `mergeStatePartial` semantics -- extract `milestones` and `currentMilestone` from the roadmapper output and merge them into the existing STATE.json.

**Before (lines 894-896):**
```
c) Write STATE.json with the project > milestone > sets structure:
   Use the Write tool to write `.planning/STATE.json` with the roadmapper's `state` content.
   The state structure is: `{ milestones: [{ id, name, status, sets: [{ id, status: "pending" }] }], currentMilestone }`
   Each set has only `{ id, name, status: "pending", branch }` -- no waves or jobs arrays.
```

**After:**
```
c) Merge the roadmapper's milestone/set data into STATE.json (preserving envelope fields):
   Extract `milestones` and `currentMilestone` from the roadmapper's `state` output.
   Use the CLI to merge these fields into the existing STATE.json:

   ```bash
   if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
   echo '{"milestones": <MILESTONES_JSON>, "currentMilestone": "<MILESTONE_ID>"}' | node "${RAPID_TOOLS}" state merge-partial
   ```

   Where `<MILESTONES_JSON>` is the milestones array from the roadmapper output and `<MILESTONE_ID>` is the current milestone ID.
   This preserves `version`, `projectName`, `createdAt`, `rapidVersion` in STATE.json while updating only the milestone/set structure.
   Each set has only `{ id, name, status: "pending", branch }` -- no waves or jobs arrays.
```

**What NOT to do:**
- Do not remove the existing DAG generation step (Step 9d) -- it is still needed after the state merge.
- Do not change the contract/definition file generation steps.

**Note:** The `state merge-partial` CLI command may not exist yet in rapid-tools.cjs. The executor should check if the CLI routing exists, and if not, the SKILL.md update should reference calling `mergeStatePartial` via a Node.js one-liner instead:

```bash
node -e "const {mergeStatePartial} = require('${RAPID_TOOLS}/../lib/state-machine.cjs'); mergeStatePartial(process.cwd(), JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'))).then(() => console.log('merged'));" <<< '{"milestones": [...], "currentMilestone": "..."}'
```

The executor should choose whichever approach integrates cleanly with the existing CLI routing pattern.

**Verification:**
```bash
grep -c "merge" skills/init/SKILL.md
```
Verify the word "merge" appears in Step 9 context, confirming the instruction was updated.

---

## File Ownership (Wave 2)

| File | Action |
|------|--------|
| `src/lib/init.cjs` | Add REQUIREMENTS.md content guard in fresh mode |
| `src/lib/init.test.cjs` | Add REQUIREMENTS.md preservation regression tests |
| `src/lib/state-machine.cjs` | Add `mergeStatePartial()` function + export |
| `src/lib/state-machine.test.cjs` | Add mergeStatePartial tests |
| `src/lib/add-set.cjs` | Fix `recalculateDAG()` to preserve node annotations |
| `src/lib/add-set.test.cjs` | Add annotation preservation tests |
| `skills/init/SKILL.md` | Update Step 9c to use mergeStatePartial |

## Success Criteria

1. `scaffoldProject()` in fresh mode does NOT overwrite REQUIREMENTS.md when it contains non-empty content
2. `scaffoldProject()` in fresh mode DOES write REQUIREMENTS.md when the file is empty or does not exist
3. `mergeStatePartial(cwd, { milestones })` replaces milestones while preserving `version`, `projectName`, `createdAt`, `rapidVersion`
4. `mergeStatePartial(cwd, { currentMilestone })` updates only that field
5. `mergeStatePartial` throws when the merged state fails Zod validation
6. `recalculateDAG()` preserves existing node annotations (group, priority, description) after recalculation
7. `recalculateDAG()` works correctly when no DAG.json exists yet
8. SKILL.md Step 9c references `mergeStatePartial` or `state merge-partial` instead of direct STATE.json overwrite
9. `node --test src/lib/init.test.cjs` passes
10. `node --test src/lib/state-machine.test.cjs` passes
11. `node --test src/lib/add-set.test.cjs` passes
