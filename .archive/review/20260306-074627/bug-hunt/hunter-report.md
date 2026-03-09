# Hunter Report - Phase 16

## Summary
Total findings: 15
By risk: 2 Critical, 5 High, 5 Medium, 3 Low
By confidence: 7 High, 5 Medium, 3 Low

## Findings

### BUG-001: Command injection in commitState via unsanitized commit message
- **Risk**: Critical
- **Confidence**: High
- **File**: src/lib/state-machine.cjs
- **Line**: 358
- **Category**: Security
- **Description**: The `commitState` function interpolates the `message` parameter directly into a shell command using double quotes: `git commit -m "${message}"`. If `message` contains shell metacharacters (e.g., `"; rm -rf /; echo "`), they will be interpreted by the shell. This is a command injection vulnerability.
- **Evidence**:
  ```js
  function commitState(cwd, message) {
    try {
      execSync('git add .planning/STATE.json', { cwd, stdio: 'pipe' });
      execSync(`git commit -m "${message}"`, { cwd, stdio: 'pipe' });
  ```
- **Impact**: Arbitrary command execution if any caller passes user-controlled or agent-generated text as the commit message. Since this is a CLI tool designed for agent orchestration, agent output is a plausible attack vector.
- **Fix Guidance**: Use `execSync` with an array-based approach via `child_process.execFileSync('git', ['commit', '-m', message], ...)` to avoid shell interpretation, or at minimum sanitize the message by escaping shell metacharacters.

### BUG-002: Double lock acquisition causes deadlock in transitionJob/transitionWave/transitionSet
- **Risk**: Critical
- **Confidence**: High
- **File**: src/lib/state-machine.cjs
- **Lines**: 197-241, 249-276, 282-305
- **Category**: Concurrency
- **Description**: `transitionJob` (line 197), `transitionWave` (line 249), and `transitionSet` (line 282) each acquire the `'state-machine'` lock, then call `readState(cwd)`. The `readState` function itself does NOT acquire a lock (it's a plain read), so that's fine. However, the code comments say "skip lock since we already hold it" and inline the write logic. The real problem is that `writeState` also acquires the `'state-machine'` lock (line 78). If any code path were to call `writeState` from within a transition function, it would deadlock. Currently the transition functions avoid calling `writeState` by inlining the write, but this is fragile -- any refactoring that replaces the inlined write with `writeState()` will cause a deadlock. More importantly, `proper-lockfile` is not reentrant by default, so if any of these functions are accidentally called recursively or if the lock name is shared with other code paths, a deadlock will occur.
- **Evidence**:
  ```js
  // transitionJob acquires lock on line 197
  const release = await acquireLock(cwd, 'state-machine');
  // ...then inlines write logic instead of calling writeState which would deadlock
  // Write state directly (skip lock since we already hold it)
  ```
- **Impact**: Deadlock if code is refactored to use `writeState` inside transition functions. The inlined write also means validation/write logic is duplicated 3 times, increasing maintenance risk.
- **Fix Guidance**: Extract the write logic into an internal `_writeStateUnlocked(cwd, state)` helper that both `writeState` and the transition functions can call. `writeState` would acquire the lock then call `_writeStateUnlocked`; transition functions would call `_writeStateUnlocked` directly since they already hold the lock.

### BUG-003: deriveWaveStatus returns 'failed' which is not a valid WaveStatus enum value
- **Risk**: High
- **Confidence**: High
- **File**: src/lib/state-machine.cjs
- **Lines**: 151-166, 220-230
- **Category**: Logic
- **Description**: `deriveWaveStatus()` can return `'failed'` (line 163) when jobs have failed and none are executing. However, `WaveStatus` in `state-schemas.cjs` is defined as `z.enum(['pending', 'discussing', 'planning', 'executing', 'reconciling', 'complete'])` -- there is no `'failed'` status. The `transitionJob` function handles this by only applying the derived status for 'executing', 'complete', and 'pending' (lines 223-229), silently ignoring 'failed'. This means when all jobs in a wave fail, the wave status stays wherever it was (likely 'executing'), which is semantically incorrect -- the wave appears to still be executing when it's actually stuck.
- **Evidence**:
  ```js
  // deriveWaveStatus returns 'failed' on line 163
  if (anyFailed && !anyExecuting) return 'failed';
  
  // But WaveStatus enum has no 'failed':
  const WaveStatus = z.enum(['pending', 'discussing', 'planning', 'executing', 'reconciling', 'complete']);
  
  // transitionJob silently ignores the 'failed' case:
  // 'failed' is not a valid WaveStatus, so we leave wave status as-is for that case
  ```
- **Impact**: When all jobs in a wave fail, the wave remains in an incorrect status (e.g., 'executing'). Downstream consumers checking wave status will think work is still in progress. There's no way to detect that a wave has failed.
- **Fix Guidance**: Either add 'failed' to `WaveStatus` enum (and update the transition map), or add explicit handling for the failed-wave case (e.g., transition to a distinct error recovery state).

### BUG-004: deriveSetStatus returns only 'pending', 'complete', or 'executing' but SetStatus has 6 valid values
- **Risk**: High
- **Confidence**: High
- **File**: src/lib/state-machine.cjs
- **Lines**: 177-188, 264
- **Category**: Logic
- **Description**: `deriveSetStatus()` only returns three statuses: 'pending', 'complete', or 'executing'. However, the `SetStatus` enum has 6 values: `['pending', 'planning', 'executing', 'reviewing', 'merging', 'complete']`. When `transitionWave` calls `deriveSetStatus` and writes the result directly to `set.status` (line 264), it can overwrite a manually-transitioned set status. For example, if a set is in 'reviewing' status and a wave status changes, `deriveSetStatus` would return 'executing' (since not all waves are complete), overwriting 'reviewing' with 'executing'. This would violate the transition rules ('reviewing' -> 'executing' is not a valid transition per `SET_TRANSITIONS`).
- **Evidence**:
  ```js
  // deriveSetStatus only returns 3 of 6 possible statuses
  function deriveSetStatus(waves) {
    if (waves.length === 0) return 'pending';
    const allPending = waves.every(w => w.status === 'pending');
    if (allPending) return 'pending';
    const allComplete = waves.every(w => w.status === 'complete');
    if (allComplete) return 'complete';
    return 'executing';
  }
  
  // transitionWave unconditionally sets derived status
  set.status = deriveSetStatus(set.waves);
  ```
- **Impact**: Set status can be silently overwritten and regressed to a previous state, bypassing transition validation. This undermines the entire state machine guarantee that "attempting to skip states produces a clear error."
- **Fix Guidance**: Only derive set status for a limited subset of cases (e.g., auto-advance from 'pending' to 'executing' when first wave starts, and from 'executing' to next stage when all waves complete). Do not overwrite manually-set statuses like 'reviewing' or 'merging'. Alternatively, validate the derived transition before applying it.

### BUG-005: transitionWave bypasses transition validation for derived set status
- **Risk**: High
- **Confidence**: High
- **File**: src/lib/state-machine.cjs
- **Lines**: 262-264
- **Category**: Validation
- **Description**: In `transitionWave`, the wave transition is validated via `validateTransition('wave', wave.status, newStatus)` (line 258), but the derived set status is written directly without validation: `set.status = deriveSetStatus(set.waves)` (line 264). This means the set can be moved to a status that violates the transition rules without any error being thrown. The same issue exists in `transitionJob` where `wave.status` is set without calling `validateTransition('wave', ...)` on the derived value (lines 223-229).
- **Evidence**:
  ```js
  // Wave transition is validated
  validateTransition('wave', wave.status, newStatus);
  wave.status = newStatus;
  
  // But derived set status is NOT validated
  const set = findSet(state, milestoneId, setId);
  set.status = deriveSetStatus(set.waves);  // No validateTransition call!
  ```
- **Impact**: State machine invariants can be violated silently. The success criterion "State transitions are validated -- attempting to skip states produces a clear error" is not fully met.
- **Fix Guidance**: Call `validateTransition('set', set.status, derivedStatus)` before applying the derived status, or skip the update if the transition would be invalid.

### BUG-006: MilestoneState schema missing status field
- **Risk**: High
- **Confidence**: Medium
- **File**: src/lib/state-schemas.cjs
- **Lines**: 36-40
- **Category**: Validation
- **Description**: `MilestoneState` only has `id`, `name`, and `sets` fields -- there is no `status` field. Yet milestones are part of the hierarchical state model and are referenced by `currentMilestone` in `ProjectState`. Without a status field, there's no way to track whether a milestone is in progress, complete, or blocked. This is an incomplete data model compared to the other hierarchy levels (sets, waves, jobs all have status).
- **Evidence**:
  ```js
  const MilestoneState = z.object({
    id: z.string(),
    name: z.string(),
    sets: z.array(SetState).default([]),
  });
  ```
- **Impact**: Cannot track milestone lifecycle status. The success criterion about hierarchical state (project > milestone > set > wave > job) is partially met but milestones lack status tracking.
- **Fix Guidance**: Add a `status` field to `MilestoneState` with an appropriate enum (e.g., `['pending', 'active', 'complete']`) and a corresponding transition map in `state-transitions.cjs`.

### BUG-007: writeState validates then mutates lastUpdatedAt after validation
- **Risk**: High
- **Confidence**: Medium
- **File**: src/lib/state-machine.cjs
- **Lines**: 75-77
- **Category**: Validation
- **Description**: `writeState` calls `ProjectState.parse(state)` for validation, then mutates the validated result by setting `validated.lastUpdatedAt = new Date().toISOString()`. The mutation itself is fine (it's setting a valid ISO string), but the pattern of "validate then mutate" means the final written state has NOT been validated in its final form. If `lastUpdatedAt` had stricter validation (e.g., a specific date format regex), the mutation could produce invalid state. The same pattern is repeated in all three transition functions (lines 234, 268, 299).
- **Evidence**:
  ```js
  const validated = ProjectState.parse(state);
  validated.lastUpdatedAt = new Date().toISOString();
  // Writes the mutated object without re-validation
  ```
- **Impact**: Minor for current schema since `lastUpdatedAt` is just `z.string()`, but this is a validation gap that could become a real bug if the schema is tightened. The pattern is also duplicated 4 times, increasing maintenance risk.
- **Fix Guidance**: Set `lastUpdatedAt` before validation, or validate after mutation.

### BUG-008: createDAG and createDAGv2 crash with -Infinity on empty node list
- **Risk**: Medium
- **Confidence**: High
- **File**: src/lib/dag.cjs
- **Lines**: 178-179, 357-359
- **Category**: Error Handling
- **Description**: When `nodes` is an empty array, `waveGroups` will be empty. `Object.values(waveGroups).map(s => s.length)` produces an empty array. `Math.max(...[])` returns `-Infinity` in JavaScript. The `maxParallelism` field in the returned DAG metadata will be `-Infinity`, which is a nonsensical value that could cause issues for downstream consumers doing numeric comparisons or serialization.
- **Evidence**:
  ```js
  const maxParallelism = Math.max(
    ...Object.values(waveGroups).map((s) => s.length)
  );
  // When waveGroups is empty: Math.max() === -Infinity
  ```
- **Impact**: DAG metadata contains `-Infinity` for `maxParallelism` when created with zero nodes. This could cause JSON serialization to produce `null` (since `-Infinity` is not valid JSON) or unexpected behavior in consumers that check `maxParallelism > 0`.
- **Fix Guidance**: Add a guard: `const maxParallelism = Object.keys(waveGroups).length === 0 ? 0 : Math.max(...)`.

### BUG-009: CLI parse-return --validate uses legacy validateReturn instead of Zod-based validateHandoff
- **Risk**: Medium
- **Confidence**: High
- **File**: src/bin/rapid-tools.cjs
- **Lines**: 304, 324-326
- **Category**: Integration
- **Description**: The `handleParseReturn` function imports `validateReturn` from `returns.cjs` and uses it for the `--validate` flag. However, Phase 16 added a new `validateHandoff` function that uses Zod schemas for stricter validation. The CLI tool still uses the older, less strict manual validation function. This means the CLI `parse-return --validate` command won't benefit from the new Zod schema validation, and there's no CLI exposure for `validateHandoff` at all.
- **Evidence**:
  ```js
  // rapid-tools.cjs line 304
  const { parseReturn, validateReturn } = require('../lib/returns.cjs');
  // Uses validateReturn (manual validation) instead of validateHandoff (Zod-based)
  ```
- **Impact**: CLI users get weaker validation than the programmatic API. The success criterion "All inter-agent outputs use structured format with schema validation at every handoff point" is not fully met at the CLI level.
- **Fix Guidance**: Add a `--strict` or `--handoff` flag that uses `validateHandoff`, or replace the `validateReturn` usage with `validateHandoff` for the `--validate` flag.

### BUG-010: rapid-tools.cjs state command still imports state.cjs (STATE.md) not state-machine.cjs (STATE.json)
- **Risk**: Medium
- **Confidence**: Medium
- **File**: src/bin/rapid-tools.cjs
- **Line**: 194
- **Category**: Integration
- **Description**: The `handleState` command in `rapid-tools.cjs` imports `require('../lib/state.cjs')` which works with `STATE.md` (markdown-based state). Phase 16 introduces `state-machine.cjs` which works with `STATE.json` (hierarchical JSON state). The CLI has no commands to interact with the new `STATE.json` state machine (read state, transition, detect corruption, recover). This means the new state machine is not exposed via the CLI at all.
- **Evidence**:
  ```js
  // rapid-tools.cjs line 194
  stateModule = require('../lib/state.cjs');
  // This is the old STATE.md module, not the new state-machine.cjs
  ```
- **Impact**: No CLI interface for the new hierarchical state machine. Users and agents cannot read/write STATE.json via CLI commands.
- **Fix Guidance**: Add new CLI subcommands (e.g., `state-machine read`, `state-machine transition`, `state-machine init`, `state-machine recover`) that use `state-machine.cjs`.

### BUG-011: readState uses sync I/O but is declared async
- **Risk**: Medium
- **Confidence**: High
- **File**: src/lib/state-machine.cjs
- **Lines**: 43-63
- **Category**: Logic
- **Description**: `readState` is declared as `async function readState(cwd)` but contains only synchronous operations (`fs.existsSync`, `fs.readFileSync`, `JSON.parse`). The function never `await`s anything. While this works (the sync return values are wrapped in a resolved promise), it creates a misleading API contract. Callers must `await` it unnecessarily, and the function signature suggests I/O is async when it's actually blocking the event loop with `readFileSync`.
- **Evidence**:
  ```js
  async function readState(cwd) {
    const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);
    if (!fs.existsSync(stateFile)) {
      return null;
    }
    const raw = fs.readFileSync(stateFile, 'utf-8');
    // ... all sync operations
  ```
- **Impact**: Minor performance concern -- the event loop is blocked during reads, which could matter if called in a concurrent context. More importantly, the `async` declaration is misleading for API consumers.
- **Fix Guidance**: Either make the function truly async using `fs.promises.readFile`, or remove the `async` keyword and update callers.

### BUG-012: commitState swallows all git errors including actual failures
- **Risk**: Medium
- **Confidence**: High
- **File**: src/lib/state-machine.cjs
- **Lines**: 355-364
- **Category**: Error Handling
- **Description**: The `commitState` function catches all errors from both `git add` and `git commit` and returns `{ committed: false }`. The comment says "Exit code 1 from git commit means nothing to commit", but the catch block also swallows genuine errors like permission denied, corrupt git repository, disk full, or git add failures. There's no way for the caller to distinguish "nothing to commit" from "git is broken".
- **Evidence**:
  ```js
  function commitState(cwd, message) {
    try {
      execSync('git add .planning/STATE.json', { cwd, stdio: 'pipe' });
      execSync(`git commit -m "${message}"`, { cwd, stdio: 'pipe' });
      return { committed: true };
    } catch (err) {
      // Exit code 1 from git commit means nothing to commit
      return { committed: false };
    }
  }
  ```
- **Impact**: Silent failure on real git errors. Callers will think "nothing to commit" when git may actually be broken. State corruption could go undetected.
- **Fix Guidance**: Check `err.status` (exit code) -- exit code 1 for `git commit` means nothing to commit, but other exit codes indicate real errors. Also separate the `git add` and `git commit` try/catch blocks since a `git add` failure is always an error.

### BUG-013: recoverFromGit has no error handling
- **Risk**: Medium
- **Confidence**: High
- **File**: src/lib/state-machine.cjs
- **Lines**: 344-346
- **Category**: Error Handling
- **Description**: `recoverFromGit` calls `execSync('git checkout HEAD -- .planning/STATE.json')` with no try/catch. If the file doesn't exist in git history, or the git repo is in a detached HEAD state, or there are other git issues, this will throw an unhandled `execSync` error with a raw error message. For a recovery function, this is particularly problematic -- it should handle its own errors gracefully.
- **Evidence**:
  ```js
  function recoverFromGit(cwd) {
    execSync('git checkout HEAD -- .planning/STATE.json', { cwd, stdio: 'pipe' });
  }
  ```
- **Impact**: Recovery from corruption can itself crash with an unhelpful error message if STATE.json has never been committed to git.
- **Fix Guidance**: Wrap in try/catch and return a result object like `{ recovered: true }` or `{ recovered: false, reason: '...' }`.

### BUG-014: createDAGv2 cross-type edge validation skips unknown node references
- **Risk**: Low
- **Confidence**: High
- **File**: src/lib/dag.cjs
- **Lines**: 317-325
- **Category**: Validation
- **Description**: The cross-type edge validation in `createDAGv2` only checks `if (fromNode && toNode && fromNode.type !== toNode.type)`. If either `fromNode` or `toNode` is undefined (edge references a non-existent node), the cross-type check is silently skipped. The subsequent `toposort` call will catch unknown node references, but the error message will be about "Unknown node IDs" rather than the more specific "Cross-type edge" error. This is a validation ordering issue rather than a missed check, but it means error messages are less helpful.
- **Evidence**:
  ```js
  for (const edge of edges) {
    const fromNode = nodeMap[edge.from];
    const toNode = nodeMap[edge.to];
    if (fromNode && toNode && fromNode.type !== toNode.type) {
      // Only reached if BOTH nodes exist AND types differ
    }
  }
  ```
- **Impact**: Error messages for invalid edges may be less specific than expected. Not a correctness bug since toposort will still catch it.
- **Fix Guidance**: Validate edge endpoint existence before the cross-type check, or move cross-type validation after toposort.

### BUG-015: plan.cjs writeGates assumes v1 DAG format (waveData.sets) which breaks with v2 DAG (waveData.nodes)
- **Risk**: Low
- **Confidence**: Medium
- **File**: src/lib/plan.cjs
- **Lines**: 231-254
- **Category**: Integration
- **Description**: `writeGates` in `plan.cjs` accesses `waveData.sets` (line 237) for each wave in the DAG. This works for v1 DAGs (created by `createDAG`) where each wave has a `sets` array, but v2 DAGs (created by `createDAGv2`) use `waveData.nodes` instead of `waveData.sets`. If `writeGates` is ever called with a v2 DAG, it will create gates with `undefined` required arrays, corrupting the GATES.json file.
- **Evidence**:
  ```js
  // plan.cjs writeGates line 237
  for (const [waveNum, waveData] of Object.entries(dagObj.waves)) {
    gates[`wave-${waveNum}`] = {
      planning: {
        required: [...waveData.sets],  // v2 DAGs have .nodes, not .sets
  ```
- **Impact**: GATES.json corruption if v2 DAGs are used with the existing plan pipeline. Currently only v1 DAGs are used in `decomposeIntoSets`, so this is a latent bug.
- **Fix Guidance**: Add v2 support: `required: [...(waveData.sets || waveData.nodes || [])]`, or check the DAG version first.

