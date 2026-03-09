# Judge's Final Ruling

## Summary
- Total findings reviewed: 15
- Accepted: 9 | Dismissed: 4 | Needs Human Review: 0 | Accepted (human): 2
- Estimated fix effort: Medium

## Rulings

### BUG-001: Command injection in commitState via unsanitized commit message
- **Ruling**: ACCEPTED
- **Final Risk**: Critical
- **Final Confidence**: High
- **Fix Priority**: 1
- **Reasoning**: Both agents agree. The code at `state-machine.cjs:358` interpolates an unsanitized `message` parameter into a shell command via template literal. The function is exported and designed for programmatic use by agents. The advocate also identified the same pattern in `merge.cjs:458`. This is a textbook command injection.
- **Fix Guidance**: Replace `execSync` with `execFileSync('git', ['commit', '-m', message], { cwd, stdio: 'pipe' })` to avoid shell interpretation entirely. Apply the same fix to the `git add` call and audit `merge.cjs:458` for the same pattern.

### BUG-002: Double lock acquisition causes deadlock in transitionJob/transitionWave/transitionSet
- **Ruling**: DISMISSED
- **Reasoning**: The advocate's disproof is convincing. The code deliberately inlines the write logic to avoid calling `writeState()`, and documents this intent with explicit comments at lines 232, 266, and 295. There is no current deadlock -- the Hunter acknowledges this. The concern is about hypothetical future refactoring, which is a code quality suggestion, not a bug. The existing comments serve as adequate guard against accidental refactoring. Extracting a `_writeStateUnlocked` helper would be a nice improvement but is not a defect to fix.

### BUG-003: deriveWaveStatus returns 'failed' which is not a valid WaveStatus enum value
- **Ruling**: ACCEPTED
- **Final Risk**: High
- **Final Confidence**: High
- **Fix Priority**: 2
- **Reasoning**: Both agents agree. `deriveWaveStatus()` returns `'failed'` (line 163) but `WaveStatus` has no `'failed'` value (state-schemas.cjs:9). The handling at lines 223-230 silently ignores it, leaving a failed wave stuck in `'executing'` status indefinitely. This directly violates the Phase 16 success criterion that state is updated at every step for context resume -- a wave with all failed jobs will appear to be executing forever.
- **Fix Guidance**: Add `'failed'` to the `WaveStatus` enum in `state-schemas.cjs` and add a corresponding entry in `WAVE_TRANSITIONS` in `state-transitions.cjs` (e.g., `failed: ['executing']` for retry, or `failed: []` if terminal). Then update `transitionJob` to apply the `'failed'` derived status to the wave.

### BUG-004: deriveSetStatus returns only 3 of 6 valid SetStatus values, can overwrite manually-set status
- **Ruling**: ACCEPTED
- **Final Risk**: Medium
- **Final Confidence**: Medium
- **Fix Priority**: 4
- **Reasoning**: The advocate weakened this to Medium, arguing it is "unlikely in normal operation" for `transitionWave` to be called when a set is in `'reviewing'`. However, the advocate also confirmed the core issue: `deriveSetStatus` returning `'executing'` when a set is `'pending'` would skip `'planning'`, which is an invalid transition per `SET_TRANSITIONS` (pending can only go to planning). The derivation function can produce backward and invalid transitions. Even if unlikely in the happy path, this is a state machine foundation -- it must enforce its own invariants. The risk is Medium because the invalid transition would succeed silently rather than crash.
- **Fix Guidance**: Guard the derivation so it only applies when the derived status represents a valid forward transition. Before assigning `set.status = deriveSetStatus(set.waves)`, call `validateTransition('set', set.status, derivedStatus)` inside a try/catch -- if the transition is invalid, leave the set status unchanged. Alternatively, only auto-derive for the specific transitions `pending -> executing` (when first wave starts) and `executing -> complete` (when all waves finish), skipping derivation for other set statuses.

### BUG-005: transitionWave bypasses transition validation for derived set status
- **Ruling**: ACCEPTED
- **Final Risk**: High
- **Final Confidence**: High
- **Fix Priority**: 3
- **Reasoning**: This is the validation enforcement side of BUG-004. The wave transition at line 258 is properly validated via `validateTransition('wave', ...)`, but the derived set status at line 264 bypasses validation entirely. The same pattern exists in `transitionJob` where derived wave status at lines 223-229 is applied without calling `validateTransition('wave', ...)`. The Phase 16 success criterion explicitly states "validated transitions -- skipping states produces clear error." The derived status paths violate this. This is rated higher than BUG-004 because it is the mechanism by which the invariant is broken, not just the data issue.
- **Fix Guidance**: Add `validateTransition` calls before applying any derived status. In `transitionWave`, validate the derived set transition before assignment. In `transitionJob`, validate the derived wave transition before assignment. If validation fails, either leave the status unchanged (the safe option) or log a warning. This fix should be coordinated with BUG-004 since they address the same code paths.

### BUG-006: MilestoneState schema missing status field
- **Ruling**: DISMISSED
- **Reasoning**: The advocate's evidence is persuasive. Phase 16 scope is "State Machine Foundation" and the ENTITY_MAPS in state-transitions.cjs deliberately only includes set/wave/job -- no milestone transitions exist. The `ProjectState` tracks `currentMilestone` as a string selector, which is sufficient for Phase 16. Milestone lifecycle management is a feature for a later phase, not a missing field in the current phase's deliverables.

### BUG-007: writeState validates then mutates lastUpdatedAt after validation
- **Ruling**: DISMISSED
- **Reasoning**: The advocate correctly identifies that `lastUpdatedAt` is typed as `z.string()` and `new Date().toISOString()` always produces a valid string. The mutation cannot currently produce invalid state. The pattern is repeated 4 times which is a maintenance concern, but not a bug. If the schema is later tightened to enforce a date format regex, the person tightening it would naturally fix the write sites. This is speculative risk, not a current defect.

### BUG-008: createDAG and createDAGv2 crash with -Infinity on empty node list
- **Ruling**: ACCEPTED
- **Final Risk**: Medium
- **Final Confidence**: High
- **Fix Priority**: 6
- **Reasoning**: Both agents agree. `Math.max(...[])` returns `-Infinity` which is not valid JSON (serializes to `null`). While an empty DAG is an edge case, the functions accept empty arrays without error, so the output should be sane. This is a quick one-line fix.
- **Fix Guidance**: Add a guard before the `Math.max` call in both `createDAG` (line 178) and `createDAGv2` (line 357). When `waveGroups` is empty, set `maxParallelism` to `0` instead of computing `Math.max(...[])`.

### BUG-009: CLI parse-return --validate uses legacy validateReturn instead of Zod-based validateHandoff
- **Ruling**: DISMISSED
- **Reasoning**: The advocate demonstrated that the CLI already calls `parseReturn` + `validateReturn` which covers the same fields as `validateHandoff`. The Zod version is marginally stricter on type coercion, but since the data comes from `JSON.parse` which preserves types correctly, the practical difference is negligible. This is a code consistency preference, not a functional bug. The Phase 16 success criteria concern schema validation at handoff points, and the existing validation does cover the fields.

### BUG-010: rapid-tools.cjs state command still imports state.cjs not state-machine.cjs
- **Ruling**: DISMISSED
- **Reasoning**: The advocate correctly identifies that Phase 17 ("Dependency Audit and Adapter Layer") is explicitly scoped to handle the v1-to-v2 module coupling. The v1.0 `state.cjs` and v2.0 `state-machine.cjs` coexist by design during the transition. CLI integration of the new state machine is out of Phase 16 scope. This is "not yet implemented" rather than a bug.

### BUG-011: readState uses sync I/O but is declared async
- **Ruling**: DISMISSED (note: reclassified from original filing)
- **Reasoning**: The advocate's reasoning is sound. The function is called from async contexts that already `await` due to lock acquisition. The `async` declaration provides a consistent API surface and forward compatibility for a future migration to `fs.promises`. An `async` function performing sync work returns a resolved Promise with zero practical overhead. This is a deliberate design choice.

### BUG-012: commitState swallows all git errors including actual failures
- **Ruling**: ACCEPTED
- **Final Risk**: Medium
- **Final Confidence**: High
- **Fix Priority**: 5
- **Reasoning**: Both agents agree. The catch block at lines 360-362 treats all errors identically -- `git add` failures (permission denied, file not found), corrupt repo errors, and disk full errors all return `{ committed: false }`. The Phase 16 success criterion requires state to be updated at every step for context resume; silent failure in the commit function means state may not be persisted to git without any indication of why.
- **Fix Guidance**: Separate the `git add` and `git commit` into distinct try/catch blocks. For `git commit`, check `err.status === 1` to identify the "nothing to commit" case and return `{ committed: false }`. For all other exit codes and for any `git add` failure, rethrow or return an error result like `{ committed: false, error: err.message }`.

### BUG-013: recoverFromGit has no error handling
- **Ruling**: ACCEPTED (human)
- **Final Risk**: Low
- **Final Confidence**: Medium
- **Fix Priority**: 8
- **Hunter's Argument**: A recovery function should handle its own errors gracefully and return a structured result, especially since it may be called when STATE.json has never been committed to git.
- **Advocate's Counterargument**: Propagating the raw execSync error to the caller is actually reasonable -- silent failure in a recovery function could be worse than throwing, since the caller might proceed as if recovery succeeded.
- **Fix Guidance**: Wrap recoverFromGit in try/catch that rethrows with a clearer error message (e.g., "Failed to recover STATE.json from git: <original error>").

### BUG-014: createDAGv2 cross-type edge validation skips unknown node references
- **Ruling**: ACCEPTED (human)
- **Final Risk**: Low
- **Final Confidence**: Medium
- **Fix Priority**: 9
- **Hunter's Argument**: Cross-type edge validation at dag.cjs:317-325 silently skips edges referencing non-existent nodes, producing a less specific error message when toposort later catches it.
- **Advocate's Counterargument**: The invalid input is still rejected by toposort at dag.cjs:30-38 -- only the error message quality differs, not correctness.
- **Fix Guidance**: Add explicit check for unknown node references before cross-type validation to produce a specific error message.

### BUG-015: plan.cjs writeGates assumes v1 DAG format which crashes with v2 DAG
- **Ruling**: ACCEPTED
- **Final Risk**: Medium
- **Final Confidence**: High
- **Fix Priority**: 7
- **Reasoning**: The advocate escalated this from Low to Medium, and I agree. `writeGates` is a publicly exported function that accesses `waveData.sets` which does not exist in v2 DAGs (which use `waveData.nodes`). The spread `[...waveData.sets]` on `undefined` would throw a `TypeError`, not silently produce bad data -- it would crash the pipeline. Both `writeGates` and `createDAGv2` are exported as public API. Even though no current code path passes a v2 DAG to `writeGates`, this is a compatibility gap between two public APIs introduced in the same phase.
- **Fix Guidance**: Make `writeGates` handle both DAG formats. Check for `waveData.sets` (v1) vs `waveData.nodes` (v2) and use whichever is present. Alternatively, check the DAG's `version` field (v2 DAGs have `version: 2`) to determine the format. Use a fallback like `waveData.sets || waveData.nodes || []`.

## Fix Order

1. **BUG-001**: Command injection in commitState - Replace `execSync` with `execFileSync` to eliminate shell interpretation of the message parameter. Also audit `merge.cjs` for the same pattern.
2. **BUG-003**: Missing 'failed' in WaveStatus enum - Add `'failed'` to the WaveStatus enum and WAVE_TRANSITIONS map, then update transitionJob to apply the derived 'failed' status.
3. **BUG-005**: Derived status bypasses transition validation - Add `validateTransition` calls before applying any derived status in transitionJob (for waves) and transitionWave (for sets).
4. **BUG-004**: deriveSetStatus produces invalid transitions - Guard the derivation to only produce valid forward transitions, coordinated with BUG-005 fix.
5. **BUG-012**: commitState swallows all git errors - Separate git add/commit error handling and check exit codes.
6. **BUG-008**: Math.max(-Infinity) on empty DAG - Guard against empty waveGroups in both createDAG and createDAGv2.
7. **BUG-015**: writeGates v1/v2 DAG incompatibility - Add v2 DAG support to writeGates.

## Items Needing Human Review

- **BUG-013**: recoverFromGit error handling - The Hunter wants structured error returns; the Advocate argues throwing is safer. Both have merit. Judge leans ACCEPT with a clearer error message wrapper. Low priority if accepted.
- **BUG-014**: Cross-type edge validation error messages - Error messages are less specific than they could be but correctness is maintained. Judge leans ACCEPT as a low-priority improvement. Trivial fix.
