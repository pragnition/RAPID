# Quick Plan: Fix Merge Clobber Bug (Ownership/DAG Heuristics)

## Objective

Downgrade the ownership and DAG-order signals in `tryHeuristicResolve()` from auto-resolving (resolved: true) to advisory-only (resolved: false), so the set-merger agent always performs semantic analysis when these signals fire. This prevents working implementations from later sets being silently clobbered by stubs/skeletons from file owners or earlier waves.

## Task 1: Downgrade ownership/DAG signals to advisory in merge.cjs

**Files:** `src/lib/merge.cjs`, `src/commands/merge.cjs`

### Action

In `src/lib/merge.cjs`, modify `tryHeuristicResolve()` (lines 1091-1115):

1. **Ownership signal (lines 1093-1101):** Change `resolved: true` to `resolved: false` and add an `advisory` field containing the signal metadata. Keep the confidence score so the agent can weigh it. The return shape becomes:
   ```
   {
     resolved: false,
     confidence: 0.85,
     resolution: `prefer ${owner} version (file owner)`,
     signal: 'ownership',
     advisory: true,
     advisoryData: { owner, suggestion: `File is owned by ${owner} -- consider preferring their version unless the other version is more complete` }
   }
   ```

2. **DAG order signal (lines 1104-1114):** Same treatment -- change `resolved: true` to `resolved: false`, add `advisory: true` and `advisoryData`:
   ```
   {
     resolved: false,
     confidence: 0.75,
     resolution: `prefer earlier-wave version (${conflict.setName} is wave ${setIndex + 1})`,
     signal: 'dag-order',
     advisory: true,
     advisoryData: { setName: conflict.setName, waveIndex: setIndex + 1, suggestion: `Earlier-wave version may be base truth -- but verify it is not a stub` }
   }
   ```

3. **Keep pattern-based signals unchanged.** The array-addition, import-addition, and export-addition signals (lines 1117-1143) remain `resolved: true` -- these are safe structural merges.

4. **Update `resolveConflicts()` (lines 1156-1199):** After the T2 call, check if the result has `advisory: true`. If so, do NOT mark it as tier 2 resolved. Instead, push it to results with `tier: 2, resolved: false, needsAgent: true` and include the advisory fields (`advisory`, `advisoryData`, `signal`, `confidence`, `resolution`) so the agent can see them. This ensures advisory conflicts flow to `unresolvedForAgent` count.

5. **Update `src/commands/merge.cjs` (lines 274-295):** Add an `advisoryCount` to the summary that counts results with `advisory: true`. This gives the agent a clear signal that advisory hints exist:
   ```javascript
   const advisoryCount = resolutionResults.filter(r => r.advisory === true).length;
   ```
   Include `advisoryCount` in the `summary` object and in the MERGE-STATE `resolution` block.

### Verification

```bash
cd /home/kek/Projects/RAPID && node -e "
const m = require('./src/lib/merge.cjs');

// Test 1: ownership signal returns advisory, not resolved
const r1 = m.tryHeuristicResolve({ file: 'foo.js' }, { 'foo.js': 'set-a' }, []);
console.assert(r1.resolved === false, 'ownership should NOT resolve');
console.assert(r1.advisory === true, 'ownership should be advisory');
console.assert(r1.signal === 'ownership', 'signal should be ownership');

// Test 2: DAG order signal returns advisory, not resolved
const r2 = m.tryHeuristicResolve({ file: 'bar.js', setName: 'set-b' }, {}, ['set-a', 'set-b']);
console.assert(r2.resolved === false, 'dag-order should NOT resolve');
console.assert(r2.advisory === true, 'dag-order should be advisory');

// Test 3: pattern signals still resolve
const r3 = m.tryHeuristicResolve({ file: 'x.js', pattern: 'import-addition' }, {}, []);
console.assert(r3.resolved === true, 'import-addition should still resolve');
console.assert(!r3.advisory, 'pattern signals should not be advisory');

// Test 4: resolveConflicts counts advisories as unresolved
const result = m.resolveConflicts({ allConflicts: [
  { file: 'owned.js', type: 'textual' },
] }, { ownership: { 'owned.js': 'set-x' }, dagOrder: [] });
console.assert(result[0].resolved === false, 'advisory conflict should be unresolved in cascade');
console.assert(result[0].needsAgent === true, 'advisory conflict should need agent');
console.assert(result[0].advisory === true, 'advisory field should propagate');

console.log('All merge.cjs assertions passed');
"
```

### Done Criteria

- `tryHeuristicResolve()` returns `resolved: false, advisory: true` for ownership and DAG signals
- `tryHeuristicResolve()` still returns `resolved: true` for pattern-based signals
- `resolveConflicts()` counts advisory results as `unresolvedForAgent`, not `tier2Resolved`
- Advisory metadata (signal, advisoryData) propagates through to the JSON output
- Summary includes `advisoryCount` field

---

## Task 2: Update set-merger agent to never skip semantic analysis with advisory signals

**Files:** `agents/rapid-set-merger.md`

### Action

Modify Step 2a (line 161) in `agents/rapid-set-merger.md`:

1. **Change the skip condition.** The current instruction says: "If all conflicts are resolved (`unresolvedForAgent` is 0 or not present), skip to Step 3." Change this to also check for advisory signals. Replace line 161 with:

   ```
   Parse the JSON output. If all conflicts are resolved (`unresolvedForAgent` is 0 or not present) AND no advisory signals are present (`advisoryCount` is 0 or not present), skip to Step 3.
   ```

2. **Add a new paragraph after the skip condition** (after line 161), before the 2b heading:

   ```
   **IMPORTANT: Advisory signals require semantic analysis.** If T1-T2 returned advisory signals (ownership, dag-order), you MUST proceed to Step 2b semantic analysis. These signals are hints suggesting which version to prefer, but they do NOT verify code quality or completeness. The file owner's version may be a stub/skeleton, and the earlier-wave version may be incomplete. Review the advisory data in the resolution output to understand the hints, then apply your own semantic judgment in Step 2b.

   NEVER skip semantic analysis when the merging set modifies files that are also modified by sets already merged in this wave. Even if T1-T2 reports zero unresolved conflicts, overlapping file modifications require semantic review.
   ```

### Verification

```bash
cd /home/kek/Projects/RAPID && grep -c "advisory" agents/rapid-set-merger.md && grep -c "NEVER skip semantic analysis" agents/rapid-set-merger.md && grep "advisoryCount" agents/rapid-set-merger.md | head -1
```

Expected: at least 2 matches for "advisory", 1 match for "NEVER skip", and the advisoryCount reference is present.

### Done Criteria

- Line 161 skip condition includes `advisoryCount` check
- New paragraph explicitly instructs the agent to proceed to 2b when advisory signals exist
- "NEVER skip semantic analysis" instruction is present for overlapping file modifications

---

## Task 3: Add advisory signal awareness to conflict resolver agent

**Files:** `agents/rapid-conflict-resolver.md`

### Action

Modify the Deep Analysis section (Step 1, around lines 138-155) in `agents/rapid-conflict-resolver.md`:

1. **Add a new item 6 to the analysis list** (after item 5, around line 149):

   ```
   6. **Review advisory signals from T1-T2 resolution.** If the conflict was escalated with advisory data (e.g., ownership or dag-order signals), review the `advisoryData` field in the launch briefing. These signals indicate which version a heuristic suggested preferring, but they were NOT auto-applied because heuristic signals cannot verify code quality. Use advisory signals as one input to your analysis, but do NOT blindly follow them -- the suggested version may be a stub, skeleton, or incomplete implementation while the other version has working code.
   ```

### Verification

```bash
cd /home/kek/Projects/RAPID && grep -c "advisory" agents/rapid-conflict-resolver.md && grep "advisoryData" agents/rapid-conflict-resolver.md | head -1
```

Expected: at least 1 match for "advisory", and the advisoryData reference is present.

### Done Criteria

- Step 1 Deep Analysis includes advisory signal review instruction
- Instruction explicitly warns against blindly following advisory signals
- Mentions both ownership and dag-order as examples of advisory signals
