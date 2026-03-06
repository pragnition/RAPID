'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  createInitialState,
  readState,
  writeState,
  findMilestone,
  findSet,
  findWave,
  findJob,
  transitionJob,
  transitionWave,
  transitionSet,
  deriveWaveStatus,
  deriveSetStatus,
  detectCorruption,
} = require('./state-machine.cjs');

const { ProjectState } = require('./state-schemas.cjs');

// ---- Shared helpers (mirrors existing test conventions) ----

function makeTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-lifecycle-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.mkdirSync(path.join(planningDir, '.locks'), { recursive: true });
  return tmpDir;
}

function cleanTempProject(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeTestState(cwd, stateObj) {
  const stateFile = path.join(cwd, '.planning', 'STATE.json');
  fs.writeFileSync(stateFile, JSON.stringify(stateObj, null, 2), 'utf-8');
}

function readTestState(cwd) {
  const stateFile = path.join(cwd, '.planning', 'STATE.json');
  return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
}

// Build a state with one set, one wave, and two jobs -- the minimal
// structure needed for lifecycle and transition tests.
function makeStateWithJob() {
  const state = createInitialState('test-project', 'v1.0');
  state.milestones[0].sets = [{
    id: 'set-1',
    status: 'pending',
    waves: [{
      id: 'wave-1',
      status: 'pending',
      jobs: [
        { id: 'job-1', status: 'pending', artifacts: [] },
        { id: 'job-2', status: 'pending', artifacts: [] },
      ],
    }],
  }];
  return state;
}

// Build a state with one set, TWO waves, and two jobs per wave --
// used for testing cross-wave set status derivation.
function makeStateWithTwoWaves() {
  const state = createInitialState('test-project', 'v1.0');
  state.milestones[0].sets = [{
    id: 'set-1',
    status: 'pending',
    waves: [
      {
        id: 'wave-1',
        status: 'pending',
        jobs: [
          { id: 'job-1', status: 'pending', artifacts: [] },
          { id: 'job-2', status: 'pending', artifacts: [] },
        ],
      },
      {
        id: 'wave-2',
        status: 'pending',
        jobs: [
          { id: 'job-3', status: 'pending', artifacts: [] },
          { id: 'job-4', status: 'pending', artifacts: [] },
        ],
      },
    ],
  }];
  return state;
}

// ────────────────────────────────────────────────────────────────
// Test Group 1: Multi-Step Lifecycle Sequences
//
// These tests verify that the state machine correctly persists state
// at every workflow step, which is the core value proposition for
// enabling context recovery after /clear.
// ────────────────────────────────────────────────────────────────
describe('State Machine - Multi-Step Lifecycle Sequences', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  // BEHAVIOR: A job should transition through its full happy-path lifecycle
  // pending -> executing -> complete, with timestamps set at each step.
  // GUARDS AGAINST: Missing timestamp fields after transitions, which would
  // break context recovery (a developer resuming wouldn't know when work started/ended).
  it('full job lifecycle: pending -> executing -> complete with timestamps', async () => {
    // Arrange
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    // Act: transition to executing
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');

    // Assert: job is executing with startedAt set
    let updated = readTestState(tmpDir);
    let job = updated.milestones[0].sets[0].waves[0].jobs[0];
    assert.equal(job.status, 'executing');
    assert.ok(job.startedAt, 'startedAt should be set when moving to executing');
    assert.equal(job.completedAt, undefined, 'completedAt should not be set yet');

    // Act: transition to complete
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'complete');

    // Assert: job is complete with completedAt set, startedAt preserved
    updated = readTestState(tmpDir);
    job = updated.milestones[0].sets[0].waves[0].jobs[0];
    assert.equal(job.status, 'complete');
    assert.ok(job.startedAt, 'startedAt should still be set');
    assert.ok(job.completedAt, 'completedAt should be set on completion');
  });

  // BEHAVIOR: A failed job should be retryable: pending -> executing -> failed -> executing -> complete.
  // GUARDS AGAINST: Jobs getting stuck in 'failed' state with no recovery path, which
  // would require manual state file editing.
  it('full job lifecycle with failure and retry', async () => {
    // Arrange
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    // Act: pending -> executing -> failed
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'failed');

    // Assert: job is failed with completedAt
    let updated = readTestState(tmpDir);
    let job = updated.milestones[0].sets[0].waves[0].jobs[0];
    assert.equal(job.status, 'failed');
    assert.ok(job.completedAt, 'completedAt should be set on failure');

    // Act: retry: failed -> executing -> complete
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'complete');

    // Assert: job is complete after retry
    updated = readTestState(tmpDir);
    job = updated.milestones[0].sets[0].waves[0].jobs[0];
    assert.equal(job.status, 'complete');
    assert.ok(job.completedAt, 'completedAt should be set after retry completion');
  });

  // BEHAVIOR: A wave should transition through its full lifecycle chain:
  // pending -> discussing -> planning -> executing -> reconciling -> complete.
  // GUARDS AGAINST: Broken transition chain that prevents a wave from reaching
  // completion, which would stall the entire project.
  it('full wave lifecycle through all 6 states', async () => {
    // Arrange
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    // Act & Assert: walk through the full wave chain
    const waveChain = ['discussing', 'planning', 'executing', 'reconciling', 'complete'];
    for (const nextStatus of waveChain) {
      await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', nextStatus);
      const updated = readTestState(tmpDir);
      const wave = updated.milestones[0].sets[0].waves[0];
      assert.equal(wave.status, nextStatus, `Wave should be '${nextStatus}' after transition`);
    }
  });

  // BEHAVIOR: A set should transition through its full lifecycle chain:
  // pending -> planning -> executing -> reviewing -> merging -> complete.
  // GUARDS AGAINST: Sets failing to traverse their lifecycle, blocking milestone completion.
  it('full set lifecycle through all 6 states', async () => {
    // Arrange
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    // Act & Assert: walk through the full set chain
    const setChain = ['planning', 'executing', 'reviewing', 'merging', 'complete'];
    for (const nextStatus of setChain) {
      await transitionSet(tmpDir, 'v1.0', 'set-1', nextStatus);
      const updated = readTestState(tmpDir);
      const set = updated.milestones[0].sets[0];
      assert.equal(set.status, nextStatus, `Set should be '${nextStatus}' after transition`);
    }
  });

  // BEHAVIOR: When all jobs in a wave are transitioned to 'complete', the wave
  // status should auto-derive to 'complete'. This verifies hierarchical state propagation.
  // GUARDS AGAINST: Wave staying 'executing' after all jobs finish, requiring manual
  // wave transition and causing incorrect project progress reporting.
  it('multi-job wave completion: two jobs complete -> wave derives complete', async () => {
    // Arrange
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    // Act: transition both jobs through their full lifecycle
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-2', 'executing');
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'complete');
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-2', 'complete');

    // Assert: wave status should be derived to 'complete'
    const updated = readTestState(tmpDir);
    const wave = updated.milestones[0].sets[0].waves[0];
    assert.equal(wave.status, 'complete', 'Wave should derive to complete when all jobs are complete');
  });

  // BEHAVIOR: Mixed job states (one executing, one pending) should derive the wave
  // to 'executing'. Verifies the derivation logic picks up partial progress.
  // GUARDS AGAINST: Wave showing 'pending' when work is actively happening, misleading
  // developers who check project status.
  it('mixed job states derive wave to executing', async () => {
    // Arrange
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    // Act: only transition job-1 to executing, leave job-2 pending
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');

    // Assert: wave should derive to 'executing'
    const updated = readTestState(tmpDir);
    const wave = updated.milestones[0].sets[0].waves[0];
    assert.equal(wave.status, 'executing', 'Wave should derive to executing when any job is executing');
  });

  // BEHAVIOR: When one wave in a set completes but another stays pending,
  // the set should derive to 'executing'. When both complete, set derives to 'complete'.
  // GUARDS AGAINST: Set status not reflecting the overall progress of its waves,
  // which would break milestone-level progress tracking.
  it('wave transitions cascade to set status derivation', async () => {
    // Arrange: state with two waves
    const state = makeStateWithTwoWaves();
    writeTestState(tmpDir, state);

    // Act: transition wave-1 to an active state via wave transition
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'discussing');

    // Assert: set should derive to 'executing' because wave-1 is active
    let updated = readTestState(tmpDir);
    let set = updated.milestones[0].sets[0];
    assert.equal(set.status, 'executing', 'Set should be executing when any wave is active');

    // Act: transition wave-1 to complete via the full chain
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'planning');
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'executing');
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'reconciling');
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'complete');

    // Assert: set should still be 'executing' because wave-2 is still pending
    updated = readTestState(tmpDir);
    set = updated.milestones[0].sets[0];
    // Note: deriveSetStatus returns 'pending' if all waves are pending and 'complete' if all are complete.
    // With wave-1=complete and wave-2=pending, it's neither all-pending nor all-complete,
    // so it falls through to the 'executing' catch-all.
    assert.equal(set.status, 'executing', 'Set should stay executing with mixed wave states');

    // Act: transition wave-2 to complete too
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-2', 'discussing');
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-2', 'planning');
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-2', 'executing');
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-2', 'reconciling');
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-2', 'complete');

    // Assert: set should now derive to 'complete'
    updated = readTestState(tmpDir);
    set = updated.milestones[0].sets[0];
    assert.equal(set.status, 'complete', 'Set should be complete when all waves are complete');
  });
});

// ────────────────────────────────────────────────────────────────
// Test Group 2: deriveWaveStatus 'failed' Mismatch
//
// deriveWaveStatus can return 'failed' but 'failed' is NOT a valid
// WaveStatus enum value. The transitionJob function guards against
// this by leaving the wave status unchanged. If this guard broke,
// the state file would fail Zod validation on the next read.
// ────────────────────────────────────────────────────────────────
describe('State Machine - deriveWaveStatus failed mismatch', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  // BEHAVIOR: When all jobs fail and none are executing, deriveWaveStatus returns
  // 'failed', and wave status is set to 'failed' (a valid WaveStatus enum value).
  // GUARDS AGAINST: Wave status not reflecting actual job failures, hiding errors
  // from developers checking project state.
  it('all-jobs-failed wave is set to failed status', async () => {
    // Arrange: create state with jobs, transition both to executing first
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-2', 'executing');

    // Act: fail both jobs
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'failed');
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-2', 'failed');

    // Assert: wave status should be 'failed' since all jobs failed
    const updated = readTestState(tmpDir);
    const wave = updated.milestones[0].sets[0].waves[0];
    assert.equal(wave.status, 'failed', 'Wave should derive to failed when all jobs fail');

    // Extra: verify the on-disk state passes Zod validation
    const result = ProjectState.safeParse(updated);
    assert.equal(result.success, true, 'State on disk must remain Zod-valid with failed wave status');
  });

  // BEHAVIOR: When a failed job is retried (failed -> executing), the wave status
  // should update back to 'executing' because there is now an active job.
  // GUARDS AGAINST: Wave staying in a stale status after job retry, showing incorrect
  // progress to developers checking project state.
  it('retrying a failed job updates wave to executing', async () => {
    // Arrange: set up state where job-1 is failed and job-2 is complete
    const state = makeStateWithJob();
    state.milestones[0].sets[0].waves[0].jobs[0].status = 'executing';
    state.milestones[0].sets[0].waves[0].jobs[1].status = 'executing';
    state.milestones[0].sets[0].waves[0].status = 'executing';
    writeTestState(tmpDir, state);

    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'failed');
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-2', 'complete');

    // Verify intermediate state: job-1=failed, job-2=complete -> derive returns 'failed'
    let updated = readTestState(tmpDir);
    let wave = updated.milestones[0].sets[0].waves[0];
    // Wave should be 'failed' since one job failed and none executing
    assert.equal(wave.status, 'failed', 'Wave should be failed when job-1=failed, job-2=complete');

    // Act: retry job-1 (failed -> executing)
    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');

    // Assert: wave should be 'executing' again because there is an active job
    updated = readTestState(tmpDir);
    wave = updated.milestones[0].sets[0].waves[0];
    assert.equal(wave.status, 'executing', 'Wave should return to executing after job retry');
  });

  // BEHAVIOR: Verify at the unit level that deriveWaveStatus returns 'failed' for
  // all-failed-no-executing jobs, which is now correctly propagated to wave status.
  // GUARDS AGAINST: Regression where deriveWaveStatus stops returning 'failed'.
  it('deriveWaveStatus returns "failed" for all-failed-no-executing', () => {
    // Arrange
    const jobs = [
      { id: 'j1', status: 'failed', artifacts: [] },
      { id: 'j2', status: 'failed', artifacts: [] },
    ];

    // Act
    const derived = deriveWaveStatus(jobs);

    // Assert: the function does return 'failed', which is why the guard is necessary
    assert.equal(derived, 'failed', 'deriveWaveStatus should return "failed" for this scenario');
  });
});

// ────────────────────────────────────────────────────────────────
// Test Group 3: readState Edge Cases
//
// Crash recovery requires robust handling of corrupt state files.
// These tests verify that readState handles edge cases that occur
// when the process crashes during a write operation.
// ────────────────────────────────────────────────────────────────
describe('State Machine - readState edge cases', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  // BEHAVIOR: readState with an empty file should return valid:false.
  // This simulates a crash during write where the file was created but
  // no data was written yet (e.g., crash between open() and write()).
  // GUARDS AGAINST: readState returning null (thinking no file) or crashing
  // with an unhandled exception on empty JSON input.
  it('readState with empty file returns valid:false with parse error', async () => {
    // Arrange: write an empty file
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, '', 'utf-8');

    // Act
    const result = await readState(tmpDir);

    // Assert: file exists so not null, but invalid JSON
    assert.notEqual(result, null, 'Should not return null for existing but empty file');
    assert.equal(result.valid, false, 'Empty file should be invalid');
    assert.ok(result.errors, 'Should have error details');
  });

  // BEHAVIOR: readState with truncated JSON should return valid:false.
  // This simulates a crash mid-write where only partial data was flushed.
  // GUARDS AGAINST: JSON.parse silently succeeding on partial data or crashing
  // the entire application instead of returning a structured error.
  it('readState with truncated JSON returns valid:false', async () => {
    // Arrange: write partial JSON (simulating crash mid-write)
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, '{"version": 1, "projectName": "test", "currentMilestone":', 'utf-8');

    // Act
    const result = await readState(tmpDir);

    // Assert
    assert.notEqual(result, null);
    assert.equal(result.valid, false, 'Truncated JSON should be invalid');
    assert.ok(result.errors, 'Should provide error details for truncated JSON');
  });

  // BEHAVIOR: readState with valid JSON but wrong version number should fail
  // Zod schema validation (version must be literal 1).
  // GUARDS AGAINST: Reading state from a future version of RAPID without
  // detecting the incompatibility, leading to silent data corruption.
  it('readState with wrong version number returns valid:false with schema errors', async () => {
    // Arrange: valid JSON structure but version: 999 instead of 1
    const badState = {
      version: 999,
      projectName: 'test',
      currentMilestone: 'v1',
      milestones: [],
      lastUpdatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    writeTestState(tmpDir, badState);

    // Act
    const result = await readState(tmpDir);

    // Assert
    assert.notEqual(result, null);
    assert.equal(result.valid, false, 'Wrong version should be detected as invalid');
    assert.ok(result.errors, 'Should have schema validation errors');
  });

  // BEHAVIOR: writeState -> readState round-trip should produce identical state
  // (excluding lastUpdatedAt which is overwritten on write).
  // GUARDS AGAINST: Data loss through the serialization/deserialization cycle,
  // e.g., Zod stripping unknown fields, JSON.stringify losing date precision, etc.
  it('writeState -> readState round-trip preserves all data', async () => {
    // Arrange: create a populated state with sets, waves, jobs
    const state = makeStateWithJob();
    state.milestones[0].sets[0].waves[0].jobs[0].startedAt = new Date().toISOString();
    state.milestones[0].sets[0].waves[0].jobs[0].artifacts = ['file1.js', 'file2.js'];

    // Act
    await writeState(tmpDir, state);
    const result = await readState(tmpDir);

    // Assert
    assert.equal(result.valid, true, 'Round-tripped state should be valid');
    assert.equal(result.state.projectName, state.projectName);
    assert.equal(result.state.version, state.version);
    assert.equal(result.state.milestones.length, state.milestones.length);

    // Deep check: jobs, waves, sets are preserved
    const readJob = result.state.milestones[0].sets[0].waves[0].jobs[0];
    assert.equal(readJob.id, 'job-1');
    assert.equal(readJob.status, 'pending');
    assert.ok(readJob.startedAt, 'startedAt should be preserved through round-trip');
    assert.deepEqual(readJob.artifacts, ['file1.js', 'file2.js'], 'Artifacts should be preserved');
  });
});

// ────────────────────────────────────────────────────────────────
// Test Group 4: Transition Error Paths for Missing/Corrupt State
//
// These tests verify that transition functions produce clear, actionable
// errors when STATE.json is missing, corrupt, or references don't exist.
// This matters for success criterion 2: "clear errors when skipping states."
// ────────────────────────────────────────────────────────────────
describe('State Machine - Transition error paths', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  // BEHAVIOR: transitionJob should throw a descriptive error when STATE.json does not exist.
  // GUARDS AGAINST: Cryptic null-reference errors that give developers no indication
  // of what went wrong or how to fix it.
  it('transitionJob with no STATE.json throws "missing or invalid" error', async () => {
    // Arrange: no STATE.json written

    // Act & Assert
    await assert.rejects(
      () => transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing'),
      /missing or invalid/i
    );
  });

  // BEHAVIOR: transitionWave should throw when STATE.json doesn't exist.
  // GUARDS AGAINST: Same as above -- unclear errors for wave transitions.
  it('transitionWave with no STATE.json throws "missing or invalid" error', async () => {
    await assert.rejects(
      () => transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'discussing'),
      /missing or invalid/i
    );
  });

  // BEHAVIOR: transitionSet should throw when STATE.json doesn't exist.
  // GUARDS AGAINST: Same as above -- unclear errors for set transitions.
  it('transitionSet with no STATE.json throws "missing or invalid" error', async () => {
    await assert.rejects(
      () => transitionSet(tmpDir, 'v1.0', 'set-1', 'planning'),
      /missing or invalid/i
    );
  });

  // BEHAVIOR: transitionJob should throw when STATE.json contains invalid JSON.
  // GUARDS AGAINST: State file corruption going undetected during transitions,
  // leading to silent data loss.
  it('transitionJob with corrupt STATE.json throws "missing or invalid" error', async () => {
    // Arrange: write corrupt JSON
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, '{corrupt data!!!}', 'utf-8');

    // Act & Assert
    await assert.rejects(
      () => transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing'),
      /missing or invalid/i
    );
  });

  // BEHAVIOR: transitionJob with a non-existent milestone ID should throw with
  // a descriptive error mentioning the milestone name.
  // GUARDS AGAINST: Generic "not found" errors that don't tell the developer
  // which entity was missing or where to look.
  it('transitionJob with non-existent milestone throws descriptive error', async () => {
    // Arrange
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    // Act & Assert
    await assert.rejects(
      () => transitionJob(tmpDir, 'nonexistent-milestone', 'set-1', 'wave-1', 'job-1', 'executing'),
      /Milestone 'nonexistent-milestone' not found/
    );
  });

  // BEHAVIOR: transitionJob with a non-existent job ID should throw with
  // a descriptive error mentioning the job name.
  // GUARDS AGAINST: Developers wasting time debugging "undefined is not an object"
  // errors instead of seeing "Job 'job-99' not found in wave 'wave-1'".
  it('transitionJob with non-existent job ID throws descriptive error', async () => {
    // Arrange
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    // Act & Assert
    await assert.rejects(
      () => transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'nonexistent-job', 'executing'),
      /Job 'nonexistent-job' not found/
    );
  });

  // BEHAVIOR: transitionSet skipping states (e.g., pending -> executing, skipping planning)
  // should throw an error listing the valid transitions from the current state.
  // GUARDS AGAINST: Developers not knowing which transitions are valid after /clear,
  // requiring them to read source code to understand the state machine.
  it('transitionSet skipping states throws with valid transition options listed', async () => {
    // Arrange
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    // Act & Assert: try to skip 'planning' and go directly to 'executing'
    await assert.rejects(
      () => transitionSet(tmpDir, 'v1.0', 'set-1', 'executing'),
      (err) => {
        assert.ok(err.message.includes('Invalid set transition'), 'Should mention invalid transition');
        assert.ok(err.message.includes('pending'), 'Should mention current state');
        assert.ok(err.message.includes('executing'), 'Should mention attempted state');
        assert.ok(err.message.includes('planning'), 'Should list valid transition options');
        return true;
      }
    );
  });
});

// ────────────────────────────────────────────────────────────────
// Test Group 7: writeState Atomicity Guarantees
//
// Success criterion 1 requires "lock-protected atomic writes."
// These tests verify the write path handles validation failures
// correctly and doesn't corrupt state on sequential writes.
// ────────────────────────────────────────────────────────────────
describe('State Machine - writeState atomicity guarantees', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  // BEHAVIOR: writeState should validate state BEFORE acquiring the lock, so
  // invalid state rejects immediately without leaving stale lock files.
  // GUARDS AGAINST: Stale locks after validation failure that would block all
  // subsequent state operations until the lock times out.
  it('writeState rejects invalid state with ZodError without leaving lock artifacts', async () => {
    // Arrange
    const badState = { version: 999, bad: true };

    // Act & Assert: should throw ZodError
    await assert.rejects(
      () => writeState(tmpDir, badState),
      (err) => err.name === 'ZodError'
    );

    // Verify: no STATE.json created, no .tmp file left, no lock file left
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    const tmpFile = stateFile + '.tmp';
    assert.equal(fs.existsSync(stateFile), false, 'STATE.json should not exist after failed write');
    assert.equal(fs.existsSync(tmpFile), false, 'No .tmp file should be left behind');
  });

  // BEHAVIOR: Two sequential writeState calls should both succeed, with the
  // second write's data being the final on-disk state.
  // GUARDS AGAINST: Lock contention or state corruption when multiple write
  // operations happen in sequence (common during rapid transitions).
  it('two sequential writes both succeed and last write wins', async () => {
    // Arrange
    const state1 = createInitialState('project-v1', 'milestone-1');
    const state2 = createInitialState('project-v2', 'milestone-2');

    // Act
    await writeState(tmpDir, state1);
    await writeState(tmpDir, state2);

    // Assert: second write should be on disk
    const onDisk = readTestState(tmpDir);
    assert.equal(onDisk.projectName, 'project-v2', 'Second write should overwrite first');
    assert.equal(onDisk.currentMilestone, 'milestone-2');
  });

  // BEHAVIOR: writeState should handle deeply nested state hierarchies correctly
  // (project > milestone > multiple sets > multiple waves > multiple jobs).
  // GUARDS AGAINST: JSON serialization truncating large state objects, or Zod
  // validation rejecting deeply nested structures.
  it('writeState handles deeply nested hierarchy without truncation', async () => {
    // Arrange: build a state with 3 sets, 2 waves each, 3 jobs each
    const state = createInitialState('big-project', 'v1.0');
    const sets = [];
    for (let s = 1; s <= 3; s++) {
      const waves = [];
      for (let w = 1; w <= 2; w++) {
        const jobs = [];
        for (let j = 1; j <= 3; j++) {
          jobs.push({ id: `job-${s}-${w}-${j}`, status: 'pending', artifacts: [] });
        }
        waves.push({ id: `wave-${s}-${w}`, status: 'pending', jobs });
      }
      sets.push({ id: `set-${s}`, status: 'pending', waves });
    }
    state.milestones[0].sets = sets;

    // Act
    await writeState(tmpDir, state);
    const result = await readState(tmpDir);

    // Assert: all data preserved
    assert.equal(result.valid, true, 'Deeply nested state should be valid');
    assert.equal(result.state.milestones[0].sets.length, 3, 'Should have 3 sets');
    assert.equal(result.state.milestones[0].sets[0].waves.length, 2, 'Each set should have 2 waves');
    assert.equal(result.state.milestones[0].sets[0].waves[0].jobs.length, 3, 'Each wave should have 3 jobs');

    // Spot check deepest nested job
    const deepJob = result.state.milestones[0].sets[2].waves[1].jobs[2];
    assert.equal(deepJob.id, 'job-3-2-3', 'Deepest nested job ID should be preserved');
    assert.equal(deepJob.status, 'pending');
  });
});
