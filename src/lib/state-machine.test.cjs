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
  recoverFromGit,
  commitState,
  addMilestone,
} = require('./state-machine.cjs');

const { ProjectState } = require('./state-schemas.cjs');

// Helper to create a temp dir with .planning/ subdirectory
function makeTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-sm-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  // Create .locks directory for lock.cjs
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

// Build a state with a milestone containing sets/waves/jobs for transition tests
function makePopulatedState() {
  return createInitialState('test-project', 'v1.0');
}

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

// ---- createInitialState ----

describe('createInitialState', () => {
  it('returns a valid ProjectState', () => {
    const state = createInitialState('my-project', 'v2.0');
    // Should not throw
    const parsed = ProjectState.parse(state);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.projectName, 'my-project');
    assert.equal(parsed.currentMilestone, 'v2.0');
    assert.equal(parsed.milestones.length, 1);
    assert.equal(parsed.milestones[0].name, 'v2.0');
    assert.ok(parsed.createdAt);
    assert.ok(parsed.lastUpdatedAt);
  });

  it('creates milestone with empty sets', () => {
    const state = createInitialState('proj', 'alpha');
    assert.deepEqual(state.milestones[0].sets, []);
  });

  it('sets timestamps to ISO strings', () => {
    const state = createInitialState('proj', 'alpha');
    // Should be valid ISO date strings
    assert.ok(new Date(state.createdAt).toISOString());
    assert.ok(new Date(state.lastUpdatedAt).toISOString());
  });
});

// ---- readState ----

describe('readState', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('returns null if STATE.json does not exist', async () => {
    const result = await readState(tmpDir);
    assert.equal(result, null);
  });

  it('returns { valid: true, state } for valid STATE.json', async () => {
    const state = createInitialState('proj', 'v1');
    writeTestState(tmpDir, state);
    const result = await readState(tmpDir);
    assert.equal(result.valid, true);
    assert.equal(result.state.projectName, 'proj');
  });

  it('returns { valid: false, errors } for invalid STATE.json', async () => {
    writeTestState(tmpDir, { version: 999, bad: true });
    const result = await readState(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors);
  });
});

// ---- writeState ----

describe('writeState', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('writes valid state to STATE.json via atomic rename', async () => {
    const state = createInitialState('proj', 'v1');
    await writeState(tmpDir, state);

    const onDisk = readTestState(tmpDir);
    assert.equal(onDisk.projectName, 'proj');
    assert.equal(onDisk.version, 1);
  });

  it('updates lastUpdatedAt on write', async () => {
    const state = createInitialState('proj', 'v1');
    const originalTs = state.lastUpdatedAt;
    // Small delay to get different timestamp
    await new Promise(r => setTimeout(r, 10));
    await writeState(tmpDir, state);

    const onDisk = readTestState(tmpDir);
    assert.notEqual(onDisk.lastUpdatedAt, originalTs);
  });

  it('does not leave .tmp file after successful write', async () => {
    const state = createInitialState('proj', 'v1');
    await writeState(tmpDir, state);

    const tmpFile = path.join(tmpDir, '.planning', 'STATE.json.tmp');
    assert.equal(fs.existsSync(tmpFile), false);
  });

  it('rejects invalid state with ZodError (does not write to disk)', async () => {
    const badState = { version: 999, bad: true };
    await assert.rejects(
      () => writeState(tmpDir, badState),
      (err) => err.name === 'ZodError'
    );

    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    assert.equal(fs.existsSync(stateFile), false);
  });
});

// ---- find helpers ----

describe('find helpers', () => {
  it('findMilestone returns the milestone', () => {
    const state = createInitialState('proj', 'v1');
    const m = findMilestone(state, 'v1');
    assert.equal(m.name, 'v1');
  });

  it('findMilestone throws for missing milestone', () => {
    const state = createInitialState('proj', 'v1');
    assert.throws(
      () => findMilestone(state, 'nope'),
      /Milestone 'nope' not found/
    );
  });

  it('findSet returns the set', () => {
    const state = makeStateWithJob();
    const s = findSet(state, 'v1.0', 'set-1');
    assert.equal(s.id, 'set-1');
  });

  it('findSet throws for missing set with descriptive message', () => {
    const state = makeStateWithJob();
    assert.throws(
      () => findSet(state, 'v1.0', 'nope'),
      /Set 'nope' not found in milestone 'v1.0'/
    );
  });

  it('findWave returns the wave', () => {
    const state = makeStateWithJob();
    const w = findWave(state, 'v1.0', 'set-1', 'wave-1');
    assert.equal(w.id, 'wave-1');
  });

  it('findWave throws for missing wave', () => {
    const state = makeStateWithJob();
    assert.throws(
      () => findWave(state, 'v1.0', 'set-1', 'nope'),
      /Wave 'nope' not found in set 'set-1'/
    );
  });

  it('findJob returns the job', () => {
    const state = makeStateWithJob();
    const j = findJob(state, 'v1.0', 'set-1', 'wave-1', 'job-1');
    assert.equal(j.id, 'job-1');
  });

  it('findJob throws for missing job', () => {
    const state = makeStateWithJob();
    assert.throws(
      () => findJob(state, 'v1.0', 'set-1', 'wave-1', 'nope'),
      /Job 'nope' not found in wave 'wave-1'/
    );
  });
});

// ---- deriveWaveStatus ----

describe('deriveWaveStatus', () => {
  it('returns pending if all jobs are pending', () => {
    const jobs = [
      { id: '1', status: 'pending', artifacts: [] },
      { id: '2', status: 'pending', artifacts: [] },
    ];
    assert.equal(deriveWaveStatus(jobs), 'pending');
  });

  it('returns complete if all jobs are complete', () => {
    const jobs = [
      { id: '1', status: 'complete', artifacts: [] },
      { id: '2', status: 'complete', artifacts: [] },
    ];
    assert.equal(deriveWaveStatus(jobs), 'complete');
  });

  it('returns executing if any job is executing', () => {
    const jobs = [
      { id: '1', status: 'executing', artifacts: [] },
      { id: '2', status: 'pending', artifacts: [] },
    ];
    assert.equal(deriveWaveStatus(jobs), 'executing');
  });

  it('returns executing if mixed complete and executing', () => {
    const jobs = [
      { id: '1', status: 'complete', artifacts: [] },
      { id: '2', status: 'executing', artifacts: [] },
    ];
    assert.equal(deriveWaveStatus(jobs), 'executing');
  });

  it('returns failed if any failed and none executing', () => {
    const jobs = [
      { id: '1', status: 'complete', artifacts: [] },
      { id: '2', status: 'failed', artifacts: [] },
    ];
    assert.equal(deriveWaveStatus(jobs), 'failed');
  });

  it('returns executing if any failed but some still executing', () => {
    const jobs = [
      { id: '1', status: 'executing', artifacts: [] },
      { id: '2', status: 'failed', artifacts: [] },
    ];
    assert.equal(deriveWaveStatus(jobs), 'executing');
  });

  it('returns pending for empty jobs array', () => {
    assert.equal(deriveWaveStatus([]), 'pending');
  });
});

// ---- deriveSetStatus ----

describe('deriveSetStatus', () => {
  it('returns pending if all waves are pending', () => {
    const waves = [
      { id: '1', status: 'pending', jobs: [] },
      { id: '2', status: 'pending', jobs: [] },
    ];
    assert.equal(deriveSetStatus(waves), 'pending');
  });

  it('returns complete if all waves are complete', () => {
    const waves = [
      { id: '1', status: 'complete', jobs: [] },
      { id: '2', status: 'complete', jobs: [] },
    ];
    assert.equal(deriveSetStatus(waves), 'complete');
  });

  it('returns executing if any wave is in an active state', () => {
    const waves = [
      { id: '1', status: 'discussing', jobs: [] },
      { id: '2', status: 'pending', jobs: [] },
    ];
    assert.equal(deriveSetStatus(waves), 'executing');
  });

  it('returns executing for planning wave', () => {
    const waves = [
      { id: '1', status: 'planning', jobs: [] },
    ];
    assert.equal(deriveSetStatus(waves), 'executing');
  });

  it('returns executing for executing wave', () => {
    const waves = [
      { id: '1', status: 'executing', jobs: [] },
    ];
    assert.equal(deriveSetStatus(waves), 'executing');
  });

  it('returns executing for reconciling wave', () => {
    const waves = [
      { id: '1', status: 'reconciling', jobs: [] },
    ];
    assert.equal(deriveSetStatus(waves), 'executing');
  });

  it('returns pending for empty waves array', () => {
    assert.equal(deriveSetStatus([]), 'pending');
  });
});

// ---- transitionJob ----

describe('transitionJob', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('transitions job from pending to executing', async () => {
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');

    const updated = readTestState(tmpDir);
    const job = updated.milestones[0].sets[0].waves[0].jobs[0];
    assert.equal(job.status, 'executing');
    assert.ok(job.startedAt, 'startedAt should be set');
  });

  it('sets completedAt when moving to complete', async () => {
    const state = makeStateWithJob();
    state.milestones[0].sets[0].waves[0].jobs[0].status = 'executing';
    writeTestState(tmpDir, state);

    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'complete');

    const updated = readTestState(tmpDir);
    const job = updated.milestones[0].sets[0].waves[0].jobs[0];
    assert.equal(job.status, 'complete');
    assert.ok(job.completedAt, 'completedAt should be set');
  });

  it('sets completedAt when moving to failed', async () => {
    const state = makeStateWithJob();
    state.milestones[0].sets[0].waves[0].jobs[0].status = 'executing';
    writeTestState(tmpDir, state);

    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'failed');

    const updated = readTestState(tmpDir);
    const job = updated.milestones[0].sets[0].waves[0].jobs[0];
    assert.equal(job.status, 'failed');
    assert.ok(job.completedAt, 'completedAt should be set on failure');
  });

  it('derives wave status after job transition', async () => {
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');

    const updated = readTestState(tmpDir);
    const wave = updated.milestones[0].sets[0].waves[0];
    assert.equal(wave.status, 'executing');
  });

  it('rejects invalid transition', async () => {
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'complete'),
      /Invalid job transition/
    );
  });
});

// ---- transitionWave ----

describe('transitionWave', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('transitions wave status directly', async () => {
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'discussing');

    const updated = readTestState(tmpDir);
    const wave = updated.milestones[0].sets[0].waves[0];
    assert.equal(wave.status, 'discussing');
  });

  it('derives set status after wave transition', async () => {
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'discussing');

    const updated = readTestState(tmpDir);
    const set = updated.milestones[0].sets[0];
    assert.equal(set.status, 'executing');
  });

  it('rejects invalid wave transition', async () => {
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'complete'),
      /Invalid wave transition/
    );
  });
});

// ---- transitionSet ----

describe('transitionSet', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('transitions set status directly', async () => {
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    await transitionSet(tmpDir, 'v1.0', 'set-1', 'planning');

    const updated = readTestState(tmpDir);
    const set = updated.milestones[0].sets[0];
    assert.equal(set.status, 'planning');
  });

  it('rejects invalid set transition', async () => {
    const state = makeStateWithJob();
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => transitionSet(tmpDir, 'v1.0', 'set-1', 'complete'),
      /Invalid set transition/
    );
  });
});

// ---- detectCorruption ----

describe('detectCorruption', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('returns { exists: false } when no STATE.json', () => {
    const result = detectCorruption(tmpDir);
    assert.equal(result.exists, false);
  });

  it('returns { exists: true, corrupt: false } for valid state', () => {
    const state = createInitialState('proj', 'v1');
    writeTestState(tmpDir, state);
    const result = detectCorruption(tmpDir);
    assert.equal(result.exists, true);
    assert.equal(result.corrupt, false);
  });

  it('detects invalid JSON as corrupt', () => {
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, '{bad json!!!}', 'utf-8');
    const result = detectCorruption(tmpDir);
    assert.equal(result.exists, true);
    assert.equal(result.corrupt, true);
    assert.ok(result.reason);
  });

  it('detects invalid schema as corrupt', () => {
    writeTestState(tmpDir, { version: 999, bad: true });
    const result = detectCorruption(tmpDir);
    assert.equal(result.exists, true);
    assert.equal(result.corrupt, true);
    assert.ok(result.errors);
  });
});

// ---- recoverFromGit / commitState ----
// These use execSync with git commands so we test them in a real git repo context

describe('recoverFromGit', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = makeTempProject();
    // Init a git repo so git commands work
    const { execSync } = require('child_process');
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

    // Commit a valid state
    const state = createInitialState('proj', 'v1');
    writeTestState(tmpDir, state);
    execSync('git add .planning/STATE.json', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "initial state"', { cwd: tmpDir, stdio: 'pipe' });
  });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('recovers STATE.json from git after corruption', () => {
    // Corrupt the file
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, 'CORRUPTED!!!', 'utf-8');

    recoverFromGit(tmpDir);

    // Should be restored
    const restored = readTestState(tmpDir);
    assert.equal(restored.projectName, 'proj');
    assert.equal(restored.version, 1);
  });
});

describe('commitState', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = makeTempProject();
    const { execSync } = require('child_process');
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('commits STATE.json to git', () => {
    const state = createInitialState('proj', 'v1');
    writeTestState(tmpDir, state);

    const result = commitState(tmpDir, 'test commit');
    assert.equal(result.committed, true);

    // Verify via git log
    const { execSync } = require('child_process');
    const log = execSync('git log --oneline', { cwd: tmpDir, encoding: 'utf-8' });
    assert.ok(log.includes('test commit'));
  });

  it('returns committed: false when nothing to commit', () => {
    const state = createInitialState('proj', 'v1');
    writeTestState(tmpDir, state);
    const { execSync } = require('child_process');
    execSync('git add .planning/STATE.json && git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });

    const result = commitState(tmpDir, 'nothing changed');
    assert.equal(result.committed, false);
  });
});

// ---- addMilestone ----

describe('addMilestone', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('adds a new milestone to STATE.json', async () => {
    const state = createInitialState('test-project', 'v1.0');
    writeTestState(tmpDir, state);

    const result = await addMilestone(tmpDir, 'v2.0', 'Version 2.0');

    assert.equal(result.milestoneId, 'v2.0');
    assert.equal(result.milestoneName, 'Version 2.0');
    assert.equal(result.setsCarried, 0);

    const updated = readTestState(tmpDir);
    assert.equal(updated.milestones.length, 2);
    assert.equal(updated.milestones[1].id, 'v2.0');
    assert.equal(updated.milestones[1].name, 'Version 2.0');
  });

  it('updates currentMilestone to new milestone ID', async () => {
    const state = createInitialState('test-project', 'v1.0');
    writeTestState(tmpDir, state);

    await addMilestone(tmpDir, 'v2.0', 'Version 2.0');

    const updated = readTestState(tmpDir);
    assert.equal(updated.currentMilestone, 'v2.0');
  });

  it('preserves all existing milestones (no data loss)', async () => {
    const state = createInitialState('test-project', 'v1.0');
    state.milestones[0].sets = [{
      id: 'set-1',
      status: 'complete',
      waves: [{
        id: 'wave-1',
        status: 'complete',
        jobs: [{ id: 'job-1', status: 'complete', artifacts: [] }],
      }],
    }];
    writeTestState(tmpDir, state);

    await addMilestone(tmpDir, 'v2.0', 'Version 2.0');

    const updated = readTestState(tmpDir);
    assert.equal(updated.milestones.length, 2);
    // Original milestone data preserved
    assert.equal(updated.milestones[0].id, 'v1.0');
    assert.equal(updated.milestones[0].sets.length, 1);
    assert.equal(updated.milestones[0].sets[0].id, 'set-1');
  });

  it('carries forward specified sets into new milestone', async () => {
    const state = createInitialState('test-project', 'v1.0');
    state.milestones[0].sets = [{
      id: 'set-carry',
      status: 'pending',
      waves: [{
        id: 'wave-1',
        status: 'pending',
        jobs: [{ id: 'job-1', status: 'pending', artifacts: [] }],
      }],
    }];
    writeTestState(tmpDir, state);

    const carryForward = [state.milestones[0].sets[0]];
    const result = await addMilestone(tmpDir, 'v2.0', 'Version 2.0', carryForward);

    assert.equal(result.setsCarried, 1);

    const updated = readTestState(tmpDir);
    const newMilestone = updated.milestones[1];
    assert.equal(newMilestone.sets.length, 1);
    assert.equal(newMilestone.sets[0].id, 'set-carry');
  });

  it('creates milestone with empty sets when carryForwardSets is empty', async () => {
    const state = createInitialState('test-project', 'v1.0');
    writeTestState(tmpDir, state);

    await addMilestone(tmpDir, 'v2.0', 'Version 2.0', []);

    const updated = readTestState(tmpDir);
    const newMilestone = updated.milestones[1];
    assert.deepEqual(newMilestone.sets, []);
  });

  it('throws if milestone ID already exists', async () => {
    const state = createInitialState('test-project', 'v1.0');
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => addMilestone(tmpDir, 'v1.0', 'Duplicate'),
      /Milestone "v1.0" already exists/
    );
  });

  it('throws if state cannot be read', async () => {
    // No STATE.json exists
    await assert.rejects(
      () => addMilestone(tmpDir, 'v2.0', 'Version 2.0'),
      /Cannot read state/
    );
  });

  it('uses writeState for atomic validated write', async () => {
    const state = createInitialState('test-project', 'v1.0');
    writeTestState(tmpDir, state);

    await addMilestone(tmpDir, 'v2.0', 'Version 2.0');

    // Verify no .tmp file left (atomic write indicator)
    const tmpFile = path.join(tmpDir, '.planning', 'STATE.json.tmp');
    assert.equal(fs.existsSync(tmpFile), false);

    // Verify state is valid (writeState validates via Zod)
    const result = await readState(tmpDir);
    assert.equal(result.valid, true);
  });

  it('deep copies carried sets (no shared references)', async () => {
    const state = createInitialState('test-project', 'v1.0');
    const originalSet = {
      id: 'set-copy',
      status: 'pending',
      waves: [{
        id: 'wave-1',
        status: 'pending',
        jobs: [{ id: 'job-1', status: 'pending', artifacts: [] }],
      }],
    };
    state.milestones[0].sets = [originalSet];
    writeTestState(tmpDir, state);

    await addMilestone(tmpDir, 'v2.0', 'Version 2.0', [originalSet]);

    // Modify the original set reference
    originalSet.id = 'MUTATED';

    // The carried set in the new milestone should not be affected
    const updated = readTestState(tmpDir);
    assert.equal(updated.milestones[1].sets[0].id, 'set-copy');
  });

  it('uses milestoneId as name when name is not provided', async () => {
    const state = createInitialState('test-project', 'v1.0');
    writeTestState(tmpDir, state);

    const result = await addMilestone(tmpDir, 'v3.0');

    assert.equal(result.milestoneName, 'v3.0');

    const updated = readTestState(tmpDir);
    assert.equal(updated.milestones[1].name, 'v3.0');
  });
});
