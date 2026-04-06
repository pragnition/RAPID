# PLAN: scaffold-overhaul / Wave 2

## Objective

Build group-aware stub orchestration, foundation set lifecycle, scaffold-report v2 extensions, and RAPID-STUB auto-resolution in the merge pipeline. This wave consumes the primitives from Wave 1 (`generateStub`, `isRapidStub`, sidecar files) and integrates them with the DAG group system and merge pipeline.

## Files Modified

| File | Action |
|------|--------|
| `src/lib/scaffold.cjs` | Extend with group stubs, foundation set, report v2 |
| `src/lib/scaffold.test.cjs` | Extend with new function tests |
| `src/lib/merge.cjs` | Surgical addition of T0 stub auto-resolution |

---

## Task 1: Implement `generateGroupStubs()` in `scaffold.cjs`

**File:** `src/lib/scaffold.cjs`

**New function to add:**

```
generateGroupStubs(cwd, groupId, allGroups, contracts): Promise<{files: Array<{stub: string, sidecar: string}>, report: string}>
```

This function generates stubs for all cross-group dependencies that a given group needs from other groups. It is the group-aware orchestration layer on top of the per-set `generateStub()` from Wave 1.

**Implementation:**

1. **Add required imports at the top of scaffold.cjs:**
   ```
   const stub = require('./stub.cjs');
   ```

2. **Determine cross-group dependencies:**
   - `allGroups` is `Record<string, {sets: string[]}>` (same format as `dag.groups`).
   - `contracts` is `Array<{setId: string, contract: object}>` or `Record<string, object>`.
   - For each set in the target `groupId`, examine its contract's `imports` to find sets in OTHER groups.
   - Collect unique "provider set" IDs that are in different groups from the target group.

3. **Generate stubs for each cross-group provider set:**
   - For each provider set, call `stub.generateStub(providerContract, providerSetId)` to get the stub source.
   - Write the stub file to a temporary staging directory: `.rapid-stubs/{providerSetId}-stub.cjs` relative to `cwd`.
   - Write a zero-byte `.rapid-stub` sidecar alongside it.

4. **Build a report string** summarizing which stubs were generated:
   ```
   Group {groupId}: generated {N} cross-group stubs
     - {providerSetId} ({M} exports) -> .rapid-stubs/{providerSetId}-stub.cjs
   ```

5. **Return** `{files: [{stub, sidecar}, ...], report}`.

**What NOT to do:**
- Do NOT compute group partitioning here -- consume the pre-computed `allGroups` parameter.
- Do NOT modify DAG.json -- that is handled by `annotateDAGWithGroups()` in group.cjs.
- Do NOT make this function synchronous -- use async/await for future-proofing even if current I/O is sync.

---

## Task 2: Implement `createFoundationSet()` in `scaffold.cjs`

**File:** `src/lib/scaffold.cjs`

**New function to add:**

```
createFoundationSet(cwd, setConfig): Promise<void>
```

Creates a foundational set #0 entry in the planning directory. This is NOT a special lifecycle -- it creates a normal set definition with `foundation: true` annotation for DAG consumption.

**Implementation:**

1. **`setConfig` shape:** `{name?: string, sets: string[], contracts: Record<string, object>}`.
   - `name` defaults to `'foundation'`.
   - `sets` is the list of all set IDs that the foundation covers.
   - `contracts` is the map of setId -> contract data.

2. **Create the set directory:** `.planning/sets/{name}/`

3. **Write `DEFINITION.md`:**
   ```
   # Set: {name}
   ## Scope
   Foundation set containing shared interfaces and stubs for multi-group parallel development.
   This set must not contain feature implementation logic.
   ## Foundation
   true
   ```

4. **Write `CONTRACT.json`:**
   - Merge all exports from all provided contracts into a single contract.
   - Set `definition.scope` to describe the foundation purpose.
   - Add `"foundation": true` to the top-level contract object.

5. **Scope enforcement at creation time:**
   - If any contract function has implementation markers (body content beyond stubs), log a warning but do not block creation. The constraint is "no feature logic" which is enforced by the planner/reviewer, not programmatically at deep level.

**What NOT to do:**
- Do NOT implement ongoing scope enforcement (deferred per CONTEXT.md).
- Do NOT auto-create the foundation set -- this is called explicitly by the roadmapper.
- Do NOT write to DAG.json from this function -- the caller handles DAG annotation.

---

## Task 3: Extend `writeScaffoldReport()` for v2 fields

**File:** `src/lib/scaffold.cjs`

**Current state:** `writeScaffoldReport(cwd, report)` writes a v1 report with fields: `projectType, language, filesCreated, filesSkipped, timestamp, detectedFrameworks, reRun`.

**Required changes:**

1. **The report object shape is extended** with optional v2 fields. The function itself does not change behavior -- it still serializes whatever is passed. The change is in the callers that now pass additional fields.

2. **Add a new function `buildScaffoldReportV2(v1Report, groupData)`** that extends a v1 report with v2 fields:
   ```
   buildScaffoldReportV2(v1Report, groupData): ScaffoldReportV2
   ```
   - `groupData` shape: `{groups?: Record<string, {sets: string[]}>, stubs?: string[], foundationSet?: string}`
   - Returns a new object: `{...v1Report, groups: groupData.groups || null, stubs: groupData.stubs || [], foundationSet: groupData.foundationSet || null}`

3. **All v2 fields are optional** -- missing fields default to null/empty. Existing v1 consumers will ignore unknown fields (additive, no migration needed per CONTEXT.md decision).

4. **Export** `buildScaffoldReportV2`.

**What NOT to do:**
- Do NOT add a version tag to the report format.
- Do NOT break the existing `writeScaffoldReport` / `readScaffoldReport` interface.
- Do NOT require v2 fields on read -- `readScaffoldReport` returns whatever is in the file.

---

## Task 4: Add RAPID-STUB T0 auto-resolution to `merge.cjs`

**File:** `src/lib/merge.cjs`

**This is a surgical addition.** The merge pipeline's resolution cascade currently runs T1 (deterministic) then T2 (heuristic) in `resolveConflicts()`. A new T0 tier must run BEFORE T1.

**Implementation:**

1. **Add `require('./stub.cjs')` at the top of merge.cjs** to access `isRapidStub()`.

2. **Add a new function `tryStubAutoResolve(conflict)`** (internal, not exported initially):

   ```javascript
   function tryStubAutoResolve(conflict) {
     // Requires both sides of the conflict to be available
     if (!conflict.oursContent && !conflict.theirsContent) {
       return { resolved: false, confidence: 0 };
     }

     const oursIsStub = stub.isRapidStub(conflict.oursContent || '');
     const theirsIsStub = stub.isRapidStub(conflict.theirsContent || '');

     // One stub, one real -> real code wins
     if (oursIsStub && !theirsIsStub) {
       return {
         resolved: true,
         confidence: 1.0,
         resolution: 'auto-resolved: theirs is real implementation, ours is RAPID-STUB',
         preferSide: 'theirs',
       };
     }
     if (!oursIsStub && theirsIsStub) {
       return {
         resolved: true,
         confidence: 1.0,
         resolution: 'auto-resolved: ours is real implementation, theirs is RAPID-STUB',
         preferSide: 'ours',
       };
     }

     // Both stubs -> keep either (ours by convention)
     if (oursIsStub && theirsIsStub) {
       return {
         resolved: true,
         confidence: 1.0,
         resolution: 'auto-resolved: both sides are RAPID-STUBs, keeping ours',
         preferSide: 'ours',
       };
     }

     // Neither is a stub -- not our jurisdiction
     return { resolved: false, confidence: 0 };
   }
   ```

3. **Modify `resolveConflicts()`** to run T0 before T1. In the loop over `detectionResults.allConflicts`, add this block BEFORE the T1 block:

   ```javascript
   // Tier 0: RAPID-STUB auto-resolution (highest priority)
   const t0 = tryStubAutoResolve(conflict);
   if (t0.resolved) {
     results.push({
       conflict,
       tier: 0,
       resolved: true,
       confidence: t0.confidence,
       resolution: t0.resolution,
       preferSide: t0.preferSide,
     });
     continue;
   }
   ```

4. **Update `MergeStateSchema`** to include `tier0Count` in the `resolution` object:
   - Add `tier0Count: z.number().default(0)` BEFORE `tier1Count` in the resolution schema.

5. **Update `compressedResult` schema** if it references tier counts. Check the `resolutionCounts` object -- it currently has `T1, T2, T3, escalated`. Add `T0: z.number()` before `T1`.

6. **Export `tryStubAutoResolve`** in `module.exports` for testability.

**What NOT to do:**
- Do NOT modify `tryDeterministicResolve` or `tryHeuristicResolve` -- T0 is a new function.
- Do NOT change the T1/T2/T3 logic -- T0 is prepended, not inserted.
- Do NOT remove any existing resolution signals or confidence values.
- Do NOT add sidecar file checking in the merge resolution -- use `isRapidStub()` content check only. Sidecar cleanup happens post-merge.

---

## Task 5: Write tests for new scaffold.cjs and merge.cjs functions

**File:** `src/lib/scaffold.test.cjs`

**Add new `describe` blocks** for the Wave 2 functions. Keep all existing tests intact.

### `describe('generateGroupStubs')`

1. **`it('generates stubs for cross-group dependencies')`** -- set up 2 groups with contracts where group-A imports from group-B. Assert stubs are generated with RAPID-STUB marker and sidecar files.

2. **`it('returns empty files array when group has no cross-group deps')`** -- group with only intra-group imports. Assert `files: []`.

3. **`it('report string summarizes generated stubs')`** -- assert report includes group ID and provider set names.

### `describe('createFoundationSet')`

1. **`it('creates set directory with DEFINITION.md and CONTRACT.json')`** -- call with setConfig, assert files exist and contain expected content.

2. **`it('marks CONTRACT.json with foundation:true')`** -- assert `foundation` field.

3. **`it('defaults name to foundation when not specified')`**

### `describe('buildScaffoldReportV2')`

1. **`it('extends v1 report with groups, stubs, foundationSet')`** -- pass v1 report + groupData, assert output has all v2 fields.

2. **`it('defaults missing v2 fields to null/empty')`** -- pass empty groupData, assert defaults.

3. **`it('preserves all v1 fields unchanged')`** -- assert all original v1 fields pass through.

**Merge.cjs T0 tests** -- add to a new test file or extend existing merge tests. Since `src/lib/merge.cjs` tests may be large, add a focused test section. If `src/lib/merge.test.cjs` does not exist or is too large, add `tryStubAutoResolve` tests inline in `scaffold.test.cjs` under a `describe('RAPID-STUB T0 merge resolution')` block that imports from merge.cjs:

1. **`it('resolves stub-vs-real in favor of real (ours=stub, theirs=real)')`**
2. **`it('resolves stub-vs-real in favor of real (ours=real, theirs=stub)')`**
3. **`it('resolves both-stubs by keeping ours')`**
4. **`it('returns unresolved when neither side is a stub')`**
5. **`it('returns unresolved when content is missing')`**

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/scaffold.test.cjs
```

---

## Success Criteria

1. `generateGroupStubs()` correctly generates cross-group stubs with RAPID-STUB markers and sidecars
2. `createFoundationSet()` creates a valid set directory with foundation annotation
3. `buildScaffoldReportV2()` extends v1 reports with optional v2 fields without breaking v1 consumers
4. `tryStubAutoResolve()` correctly resolves stub-vs-real conflicts at confidence 1.0
5. `resolveConflicts()` runs T0 before T1 in the resolution cascade
6. `MergeStateSchema` includes `tier0Count` with `.default(0)` for backward compat
7. All new and existing tests pass
