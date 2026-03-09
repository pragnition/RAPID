# Unit Test Plan - Phase 16

## Summary

The existing test suites cover the basic happy paths and simple error cases well. After analyzing all five source files against the five success criteria, there are meaningful gaps in coverage -- particularly around:

1. **State machine transition edge cases** -- deriveWaveStatus returning 'failed' but 'failed' not being a valid WaveStatus, multi-job/multi-wave interactions, and full lifecycle sequences
2. **Concurrent/lock-protected write semantics** -- transitionJob/Wave/Set each acquire their own lock AND call writeState (which acquires a second lock internally... except they DON'T call writeState, they write directly). This double-lock avoidance pattern needs verification.
3. **DAG v2 integration with state model** -- the DAG creates typed nodes (set/wave/job) but nothing tests that DAG output aligns with state-schemas entity types
4. **Crash recovery edge cases** -- readState with corrupt JSON, detectCorruption edge cases, recovery when no git history exists
5. **Handoff validation end-to-end** -- validateHandoff with edge cases like multiple markers, extra whitespace, nested JSON

## Existing Coverage

Already well-tested (skip these):
- **state-schemas.test.cjs**: All Zod schemas, valid/invalid parsing, nested hierarchies, defaults -- comprehensive
- **state-transitions.test.cjs**: Full transition chain validation for all entity types, error messages, unknown entity/status handling -- comprehensive
- **dag.test.cjs**: toposort, assignWaves, createDAG, validateDAG, getExecutionOrder, createDAGv2, validateDAGv2 -- comprehensive for core DAG operations
- **returns.test.cjs**: parseReturn, generateReturn, validateReturn, validateHandoff, ReturnSchemas, round-trip consistency -- comprehensive
- **state-machine.test.cjs**: createInitialState, readState, writeState, find helpers, deriveWaveStatus/SetStatus basic cases, single transitions, detectCorruption, recoverFromGit, commitState

## New Tests Required

### Test Group 1: State Machine - Multi-Step Lifecycle Sequences
- **File**: `src/lib/state-machine.lifecycle.test.cjs`
- **Target**: `src/lib/state-machine.cjs`
- **Priority**: Critical
- **Why**: Success criterion 5 requires "state is updated at every workflow step so a developer can /clear context and resume from the correct position." No existing test walks through a full project lifecycle (create -> add sets/waves/jobs -> transition through all states -> complete). This is the core value proposition.
- **Tests**:
  1. Full job lifecycle: pending -> executing -> complete with timestamp verification at each step -- verifies state persists correctly at every workflow step
  2. Full job lifecycle with failure and retry: pending -> executing -> failed -> executing -> complete -- verifies the retry path updates state correctly
  3. Full wave lifecycle through all 6 states: pending -> discussing -> planning -> executing -> reconciling -> complete -- verifies wave can traverse its entire chain
  4. Full set lifecycle through all 6 states: pending -> planning -> executing -> reviewing -> merging -> complete -- verifies set can traverse its entire chain
  5. Multi-job wave completion: transition two jobs to complete and verify wave auto-derives to 'complete' -- verifies derived status propagation through the hierarchy
  6. Mixed job states derive correct wave status after multiple transitions -- verifies intermediate state derivation is consistent with on-disk state
  7. Wave transition derives set status cascade: two waves where one completes and set stays 'executing', then both complete and set derives 'complete' -- verifies cross-entity status propagation

### Test Group 2: State Machine - deriveWaveStatus 'failed' Mismatch
- **File**: `src/lib/state-machine.lifecycle.test.cjs`
- **Target**: `src/lib/state-machine.cjs` (deriveWaveStatus + transitionJob interaction)
- **Priority**: Critical
- **Why**: deriveWaveStatus can return 'failed' but 'failed' is NOT a valid WaveStatus enum value. The transitionJob function handles this by leaving wave status unchanged when derived status is 'failed'. No test verifies this critical edge case -- if this broke, the entire state file would become invalid.
- **Tests**:
  1. When all jobs fail and none executing, wave status should NOT be set to 'failed' (since it is not a valid WaveStatus) -- verify wave retains its previous valid status
  2. When a failed job is retried (failed -> executing), wave status should update to 'executing' -- verifies recovery from the failed-jobs scenario
  3. deriveWaveStatus returns 'failed' for all-failed-no-executing jobs but transitionJob preserves wave status as-is -- verifies the guard clause works

### Test Group 3: State Machine - readState Edge Cases
- **File**: `src/lib/state-machine.lifecycle.test.cjs`
- **Target**: `src/lib/state-machine.cjs` (readState)
- **Priority**: High
- **Why**: Crash recovery (success criterion 1) requires robust handling of corrupt state files. Existing tests cover basic invalid JSON and invalid schema but miss edge cases.
- **Tests**:
  1. readState with empty file (0 bytes) returns valid:false with JSON parse error -- simulates crash during write
  2. readState with truncated JSON (partial write) returns valid:false -- simulates crash mid-atomic-rename failure
  3. readState with valid JSON but wrong version number returns valid:false with schema errors -- verifies version migration detection
  4. readState after writeState round-trip produces identical state (excluding lastUpdatedAt) -- verifies no data loss through write/read cycle

### Test Group 4: State Machine - Transition Error Paths for Missing State
- **File**: `src/lib/state-machine.lifecycle.test.cjs`
- **Target**: `src/lib/state-machine.cjs` (transitionJob/Wave/Set)
- **Priority**: High
- **Why**: Success criterion 2 requires "attempting to skip states produces a clear error." Existing tests verify single invalid transitions, but don't test the error path when STATE.json is missing or corrupt, or when entity IDs don't exist.
- **Tests**:
  1. transitionJob with no STATE.json throws "missing or invalid" error -- verifies graceful failure on missing state
  2. transitionWave with no STATE.json throws "missing or invalid" error -- verifies graceful failure on missing state
  3. transitionSet with no STATE.json throws "missing or invalid" error -- verifies graceful failure on missing state
  4. transitionJob with corrupt STATE.json throws "missing or invalid" error -- verifies graceful failure on corrupt state
  5. transitionJob with non-existent milestone ID throws descriptive error -- verifies find helper integration
  6. transitionJob with non-existent job ID throws descriptive error -- verifies find helper integration in transition context
  7. transitionSet skipping states (pending -> executing) throws with valid transition options listed -- verifies error message quality for developers resuming context

### Test Group 5: DAG v2 - State Model Alignment
- **File**: `src/lib/dag.state-alignment.test.cjs`
- **Target**: `src/lib/dag.cjs` (createDAGv2)
- **Priority**: High
- **Why**: Success criterion 3 requires "Sets, Waves, and Jobs have a data model with DAG computation for dependency ordering." The existing DAG tests verify the DAG functions work, but nothing verifies that DAG node types align with state-schemas entity types (set/wave/job), or that DAG output can be used to populate the state hierarchy.
- **Tests**:
  1. createDAGv2 with 'set' type nodes produces wave assignments usable for SetState hierarchy -- verifies DAG output maps to state model
  2. createDAGv2 with 'job' type nodes produces wave assignments usable for WaveState.jobs -- verifies job-level DAG aligns with wave structure
  3. createDAGv2 rejects mixed set/job edges (cross-type validation) even when both reference valid nodes -- already tested but verify error message includes type names for developer clarity
  4. getExecutionOrder on a v2 DAG (manually constructed) returns correct wave groupings -- verifies v2 DAGs work with the existing getExecutionOrder function
  5. DAG with complex multi-wave dependency chain produces correct parallelism metadata -- verifies maxParallelism calculation for real-world scenarios (5+ nodes)

### Test Group 6: Returns - validateHandoff Edge Cases
- **File**: `src/lib/returns.edge-cases.test.cjs`
- **Target**: `src/lib/returns.cjs` (validateHandoff, parseReturn)
- **Priority**: High
- **Why**: Success criterion 4 requires "schema validation at every handoff point." The existing tests cover the main validation paths but miss edge cases that agents might actually produce.
- **Tests**:
  1. validateHandoff with extra fields beyond the schema still passes (Zod strips by default, but passthrough could leak) -- verifies unexpected agent output fields don't cause failures
  2. validateHandoff with COMPLETE where tasks_completed > tasks_total still validates -- verifies no business logic validation beyond schema (or flags it if it should)
  3. parseReturn with multiple RAPID:RETURN markers extracts only the first one -- verifies deterministic parsing when agents produce duplicate markers
  4. parseReturn with RAPID:RETURN marker embedded in a code block (backticks) still extracts it -- verifies marker detection is context-agnostic
  5. validateHandoff with null data fields (e.g., artifacts: null instead of array) returns valid:false with clear error path -- verifies null vs missing field handling
  6. generateReturn -> parseReturn -> validateHandoff full pipeline for each status type -- verifies end-to-end schema validation chain works

### Test Group 7: State Machine - writeState Atomicity Guarantees
- **File**: `src/lib/state-machine.lifecycle.test.cjs`
- **Target**: `src/lib/state-machine.cjs` (writeState)
- **Priority**: Medium
- **Why**: Success criterion 1 requires "lock-protected atomic writes." The existing tests verify basic write behavior but don't test that the tmp file cleanup happens correctly in error scenarios, or that concurrent writes are serialized.
- **Tests**:
  1. writeState validates state BEFORE acquiring lock (fail-fast) -- verify that invalid state throws ZodError without leaving stale locks
  2. Two sequential writeState calls both succeed and the second write's data is what's on disk -- verifies no lock contention issues with sequential access
  3. writeState with deeply nested hierarchy (project > milestone > multiple sets > multiple waves > multiple jobs) writes and reads back correctly -- verifies no data truncation for large state

## Priority

**Critical** (must have):
- Test Group 1 (lifecycle sequences) -- directly validates success criterion 5
- Test Group 2 (failed wave status mismatch) -- guards against state corruption bug

**High** (should have):
- Test Group 3 (readState edge cases) -- validates crash recovery robustness
- Test Group 4 (transition error paths) -- validates success criterion 2 error quality
- Test Group 5 (DAG-state alignment) -- validates success criterion 3 integration
- Test Group 6 (handoff edge cases) -- validates success criterion 4 robustness

**Medium** (nice to have):
- Test Group 7 (write atomicity) -- validates success criterion 1 deeper guarantees
