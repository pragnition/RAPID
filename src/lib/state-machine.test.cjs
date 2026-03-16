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
  withStateTransaction,
  findMilestone,
  findSet,
  findWave,
  findJob,
  transitionSet,
  transitionWave,
  transitionJob,
  detectIndependentWaves,
  addMilestone,
  validateDiskArtifacts,
  detectCorruption,
  recoverFromGit,
  commitState,
} = require('./state-machine.cjs');

const { isLocked } = require('./lock.cjs');
const { ProjectState } = require('./state-schemas.cjs');

// ---- Helpers ----

function makeTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-sm-test-'));
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

function makeStateWithSet() {
  const state = createInitialState('test-project', 'v1.0');
  state.milestones[0].sets = [{ id: 'set-1', status: 'pending' }];
  return state;
}

function makeStateWithTwoSets() {
  const state = createInitialState('test-project', 'v1.0');
  state.milestones[0].sets = [
    { id: 'set-A', status: 'pending' },
    { id: 'set-B', status: 'pending' },
  ];
  return state;
}

function makeStateWithWaves() {
  const state = createInitialState('test-project', 'v1.0');
  state.milestones[0].sets = [{
    id: 'set-1',
    status: 'pending',
    waves: [
      { id: 'wave-1', status: 'pending', jobs: [
        { id: 'job-1', status: 'pending' },
        { id: 'job-2', status: 'pending' },
      ]},
      { id: 'wave-2', status: 'pending', jobs: [] },
    ],
  }];
  return state;
}

// ---- createInitialState ----

describe('createInitialState', () => {
  it('returns a valid ProjectState', () => {
    const state = createInitialState('my-project', 'v2.0');
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
    assert.ok(new Date(state.createdAt).toISOString());
    assert.ok(new Date(state.lastUpdatedAt).toISOString());
  });

  it('includes rapidVersion when provided', () => {
    const state = createInitialState('proj', 'v1.0', '3.2.0');
    assert.equal(state.rapidVersion, '3.2.0');
    // Verify it validates through the schema
    const parsed = ProjectState.parse(state);
    assert.equal(parsed.rapidVersion, '3.2.0');
  });

  it('does not include rapidVersion when omitted', () => {
    const state = createInitialState('proj', 'v1.0');
    assert.equal(state.rapidVersion, undefined);
    assert.ok(!('rapidVersion' in state));
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

  it('returns { valid: false, errors } for bad JSON', async () => {
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, '{bad json!!!}', 'utf-8');
    const result = await readState(tmpDir);
    assert.equal(result.valid, false);
    assert.ok(result.errors);
  });

  it('returns { valid: false, errors } for invalid schema', async () => {
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

  it('round-trip preserves data', async () => {
    const state = createInitialState('proj', 'v1');
    state.milestones[0].sets = [{ id: 'set-1', status: 'pending' }];
    await writeState(tmpDir, state);
    const result = await readState(tmpDir);
    assert.equal(result.valid, true);
    assert.equal(result.state.projectName, 'proj');
    assert.equal(result.state.milestones[0].sets[0].id, 'set-1');
  });

  it('updates lastUpdatedAt on write', async () => {
    const state = createInitialState('proj', 'v1');
    const originalTs = state.lastUpdatedAt;
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

  it('rejects invalid state with ZodError', async () => {
    const badState = { version: 999, bad: true };
    await assert.rejects(
      () => writeState(tmpDir, badState),
      (err) => err.name === 'ZodError'
    );
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    assert.equal(fs.existsSync(stateFile), false);
  });
});

// ---- writeState/readState round-trip with passthrough ----

describe('writeState/readState passthrough round-trip', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('preserves unknown fields through writeState + readState cycle', async () => {
    const state = createInitialState('proj', 'v1');
    state.customExtension = 'test';
    state.futureConfig = { enabled: true, threshold: 42 };

    await writeState(tmpDir, state);
    const result = await readState(tmpDir);

    assert.equal(result.valid, true);
    assert.equal(result.state.customExtension, 'test');
    assert.deepEqual(result.state.futureConfig, { enabled: true, threshold: 42 });
  });

  it('preserves unknown fields on nested schemas through round-trip', async () => {
    const state = createInitialState('proj', 'v1');
    state.milestones[0].sets = [{
      id: 'set-1',
      status: 'pending',
      waves: [],
      customSetField: 'preserved',
    }];

    await writeState(tmpDir, state);
    const result = await readState(tmpDir);

    assert.equal(result.valid, true);
    assert.equal(result.state.milestones[0].sets[0].customSetField, 'preserved');
  });
});

// ---- withStateTransaction ----

describe('withStateTransaction', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('acquires lock, mutates state, writes atomically', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    const result = await withStateTransaction(tmpDir, (s) => {
      s.projectName = 'mutated';
    });

    assert.equal(result.projectName, 'mutated');
    const onDisk = readTestState(tmpDir);
    assert.equal(onDisk.projectName, 'mutated');
  });

  it('releases lock after completion (no double-lock)', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    await withStateTransaction(tmpDir, (s) => {
      s.projectName = 'test-lock';
    });

    // Lock should be released -- isLocked should return false
    assert.equal(isLocked(tmpDir, 'state'), false);
  });

  it('throws for missing STATE.json', async () => {
    await assert.rejects(
      () => withStateTransaction(tmpDir, () => {}),
      /missing or invalid/
    );
  });

  it('releases lock even on mutation error', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => withStateTransaction(tmpDir, () => { throw new Error('boom'); }),
      /boom/
    );
    assert.equal(isLocked(tmpDir, 'state'), false);
  });
});

// ---- findMilestone ----

describe('findMilestone', () => {
  it('returns the milestone', () => {
    const state = createInitialState('proj', 'v1');
    const m = findMilestone(state, 'v1');
    assert.equal(m.name, 'v1');
  });

  it('throws for unknown milestone', () => {
    const state = createInitialState('proj', 'v1');
    assert.throws(
      () => findMilestone(state, 'nope'),
      /Milestone 'nope' not found/
    );
  });
});

// ---- findSet ----

describe('findSet', () => {
  it('returns the set', () => {
    const state = makeStateWithSet();
    const s = findSet(state, 'v1.0', 'set-1');
    assert.equal(s.id, 'set-1');
  });

  it('throws for unknown set', () => {
    const state = makeStateWithSet();
    assert.throws(
      () => findSet(state, 'v1.0', 'nope'),
      /Set 'nope' not found in milestone 'v1.0'/
    );
  });
});

// ---- Export availability ----

describe('export availability', () => {
  const sm = require('./state-machine.cjs');

  it('findWave is exported as a function', () => {
    assert.equal(typeof sm.findWave, 'function');
  });

  it('findJob is exported as a function', () => {
    assert.equal(typeof sm.findJob, 'function');
  });

  it('transitionWave is exported as a function', () => {
    assert.equal(typeof sm.transitionWave, 'function');
  });

  it('transitionJob is exported as a function', () => {
    assert.equal(typeof sm.transitionJob, 'function');
  });

  it('deriveWaveStatus is not exported', () => {
    assert.equal(sm.deriveWaveStatus, undefined);
  });

  it('deriveSetStatus is not exported', () => {
    assert.equal(sm.deriveSetStatus, undefined);
  });
});

// ---- transitionSet ----

describe('transitionSet', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('updates set status and persists to STATE.json', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    await transitionSet(tmpDir, 'v1.0', 'set-1', 'discussed');

    const updated = readTestState(tmpDir);
    assert.equal(updated.milestones[0].sets[0].status, 'discussed');
  });

  it('rejects invalid transitions (throws)', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => transitionSet(tmpDir, 'v1.0', 'set-1', 'complete'),
      /Invalid transition/
    );
  });

  it('validates transition with 2 args (not 3)', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    // pending -> planned is valid (skip discussed)
    await transitionSet(tmpDir, 'v1.0', 'set-1', 'planned');
    const updated = readTestState(tmpDir);
    assert.equal(updated.milestones[0].sets[0].status, 'planned');
  });
});

// ---- addMilestone ----

describe('addMilestone', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('creates new milestone and updates currentMilestone', async () => {
    const state = createInitialState('test-project', 'v1.0');
    writeTestState(tmpDir, state);

    const result = await addMilestone(tmpDir, 'v2.0', 'Version 2.0');
    assert.equal(result.milestoneId, 'v2.0');
    assert.equal(result.milestoneName, 'Version 2.0');

    const updated = readTestState(tmpDir);
    assert.equal(updated.milestones.length, 2);
    assert.equal(updated.currentMilestone, 'v2.0');
  });

  it('rejects duplicate milestone ID', async () => {
    const state = createInitialState('test-project', 'v1.0');
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => addMilestone(tmpDir, 'v1.0', 'Duplicate'),
      /Milestone "v1.0" already exists/
    );
  });

  it('throws when state cannot be read', async () => {
    await assert.rejects(
      () => addMilestone(tmpDir, 'v2.0', 'Version 2.0'),
      /Cannot read state/
    );
  });
});

// ---- validateDiskArtifacts ----

describe('validateDiskArtifacts', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('returns empty array when artifacts match status (pending)', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    const warnings = await validateDiskArtifacts(tmpDir, 'v1.0', 'set-1');
    assert.deepEqual(warnings, []);
  });

  it('returns warning for planning status without CONTEXT.md', async () => {
    const state = makeStateWithSet();
    state.milestones[0].sets[0].status = 'planned';
    writeTestState(tmpDir, state);

    const warnings = await validateDiskArtifacts(tmpDir, 'v1.0', 'set-1');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].type, 'warning');
    assert.ok(warnings[0].message.includes('CONTEXT.md'));
  });

  it('returns warning for executed status without wave plans dir', async () => {
    const state = makeStateWithSet();
    state.milestones[0].sets[0].status = 'executed';
    writeTestState(tmpDir, state);
    // Create CONTEXT.md so only the wave plans warning triggers
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'set-1'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'sets', 'set-1', 'CONTEXT.md'), 'ctx', 'utf-8');

    const warnings = await validateDiskArtifacts(tmpDir, 'v1.0', 'set-1');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].type, 'warning');
    assert.ok(warnings[0].message.includes('wave plans'));
  });

  it('returns error for missing/invalid STATE.json', async () => {
    const warnings = await validateDiskArtifacts(tmpDir, 'v1.0', 'set-1');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].type, 'error');
  });

  it('returns empty array when all artifacts exist for executed status', async () => {
    const state = makeStateWithSet();
    state.milestones[0].sets[0].status = 'executed';
    writeTestState(tmpDir, state);
    // Create both CONTEXT.md and wave plan subdirectory
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'set-1'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'sets', 'set-1', 'CONTEXT.md'), 'ctx', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'set-1', 'wave-1'), { recursive: true });

    const warnings = await validateDiskArtifacts(tmpDir, 'v1.0', 'set-1');
    assert.deepEqual(warnings, []);
  });

  it('does NOT write to STATE.json (check mtime before/after)', async () => {
    const state = makeStateWithSet();
    state.milestones[0].sets[0].status = 'planned';
    writeTestState(tmpDir, state);

    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    const mtimeBefore = fs.statSync(stateFile).mtimeMs;

    await new Promise(r => setTimeout(r, 50));
    await validateDiskArtifacts(tmpDir, 'v1.0', 'set-1');

    const mtimeAfter = fs.statSync(stateFile).mtimeMs;
    assert.equal(mtimeBefore, mtimeAfter, 'STATE.json mtime should not change');
  });
});

// ---- detectCorruption ----

describe('detectCorruption', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('returns { exists: false } for missing file', () => {
    const result = detectCorruption(tmpDir);
    assert.equal(result.exists, false);
  });

  it('returns { exists: true, corrupt: true } for bad JSON', () => {
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, '{bad json!!!}', 'utf-8');
    const result = detectCorruption(tmpDir);
    assert.equal(result.exists, true);
    assert.equal(result.corrupt, true);
    assert.ok(result.reason);
  });

  it('returns { exists: true, corrupt: true } for bad schema', () => {
    writeTestState(tmpDir, { version: 999, bad: true });
    const result = detectCorruption(tmpDir);
    assert.equal(result.exists, true);
    assert.equal(result.corrupt, true);
    assert.ok(result.errors);
  });

  it('returns { exists: true, corrupt: false } for valid state', () => {
    const state = createInitialState('proj', 'v1');
    writeTestState(tmpDir, state);
    const result = detectCorruption(tmpDir);
    assert.equal(result.exists, true);
    assert.equal(result.corrupt, false);
  });
});

// ---- Set independence ----

describe('set independence', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('transitioning set A does not affect set B', async () => {
    const state = makeStateWithTwoSets();
    writeTestState(tmpDir, state);

    // Transition set-A to discussed
    await transitionSet(tmpDir, 'v1.0', 'set-A', 'discussed');

    // Verify set-B is still pending
    const updated = readTestState(tmpDir);
    const setA = updated.milestones[0].sets.find(s => s.id === 'set-A');
    const setB = updated.milestones[0].sets.find(s => s.id === 'set-B');
    assert.equal(setA.status, 'discussed');
    assert.equal(setB.status, 'pending');
  });

  it('two sets can be in different states simultaneously', async () => {
    const state = makeStateWithTwoSets();
    writeTestState(tmpDir, state);

    await transitionSet(tmpDir, 'v1.0', 'set-A', 'planned');
    await transitionSet(tmpDir, 'v1.0', 'set-B', 'discussed');

    const updated = readTestState(tmpDir);
    const setA = updated.milestones[0].sets.find(s => s.id === 'set-A');
    const setB = updated.milestones[0].sets.find(s => s.id === 'set-B');
    assert.equal(setA.status, 'planned');
    assert.equal(setB.status, 'discussed');
  });
});

// ---- findWave ----

describe('findWave', () => {
  it('returns the wave when found', () => {
    const state = makeStateWithWaves();
    const wave = findWave(state, 'v1.0', 'set-1', 'wave-1');
    assert.equal(wave.id, 'wave-1');
    assert.equal(wave.status, 'pending');
    assert.equal(wave.jobs.length, 2);
  });

  it('throws for unknown wave id with descriptive message', () => {
    const state = makeStateWithWaves();
    assert.throws(
      () => findWave(state, 'v1.0', 'set-1', 'nope'),
      (err) => {
        assert.ok(err.message.includes("'nope'"), 'Should include wave id');
        assert.ok(err.message.includes("'set-1'"), 'Should include set id');
        return true;
      }
    );
  });

  it('throws for unknown set id (bubbles up from findSet)', () => {
    const state = makeStateWithWaves();
    assert.throws(
      () => findWave(state, 'v1.0', 'no-set', 'wave-1'),
      /Set 'no-set' not found/
    );
  });
});

// ---- findJob ----

describe('findJob', () => {
  it('returns the job when found', () => {
    const state = makeStateWithWaves();
    const job = findJob(state, 'v1.0', 'set-1', 'wave-1', 'job-1');
    assert.equal(job.id, 'job-1');
    assert.equal(job.status, 'pending');
  });

  it('throws for unknown job id with descriptive message', () => {
    const state = makeStateWithWaves();
    assert.throws(
      () => findJob(state, 'v1.0', 'set-1', 'wave-1', 'nope'),
      (err) => {
        assert.ok(err.message.includes("'nope'"), 'Should include job id');
        assert.ok(err.message.includes("'wave-1'"), 'Should include wave id');
        return true;
      }
    );
  });

  it('throws for unknown wave id (bubbles up from findWave)', () => {
    const state = makeStateWithWaves();
    assert.throws(
      () => findJob(state, 'v1.0', 'set-1', 'no-wave', 'job-1'),
      /Wave 'no-wave' not found/
    );
  });
});

// ---- transitionWave ----

describe('transitionWave', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('transitions wave status and persists to STATE.json', async () => {
    const state = makeStateWithWaves();
    writeTestState(tmpDir, state);

    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'executing');

    const updated = readTestState(tmpDir);
    const wave = updated.milestones[0].sets[0].waves.find(w => w.id === 'wave-1');
    assert.equal(wave.status, 'executing');
  });

  it('rejects invalid wave transitions (e.g., pending -> complete)', async () => {
    const state = makeStateWithWaves();
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'complete'),
      /Invalid transition/
    );
  });

  it('accepts valid chain: pending -> executing -> complete', async () => {
    const state = makeStateWithWaves();
    writeTestState(tmpDir, state);

    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'executing');
    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'complete');

    const updated = readTestState(tmpDir);
    const wave = updated.milestones[0].sets[0].waves.find(w => w.id === 'wave-1');
    assert.equal(wave.status, 'complete');
  });

  it('does not affect sibling waves in the same set', async () => {
    const state = makeStateWithWaves();
    writeTestState(tmpDir, state);

    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'executing');

    const updated = readTestState(tmpDir);
    const wave2 = updated.milestones[0].sets[0].waves.find(w => w.id === 'wave-2');
    assert.equal(wave2.status, 'pending');
  });

  it('releases lock after completion', async () => {
    const state = makeStateWithWaves();
    writeTestState(tmpDir, state);

    await transitionWave(tmpDir, 'v1.0', 'set-1', 'wave-1', 'executing');
    assert.equal(isLocked(tmpDir, 'state'), false);
  });
});

// ---- transitionJob ----

describe('transitionJob', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('transitions job status and persists to STATE.json', async () => {
    const state = makeStateWithWaves();
    writeTestState(tmpDir, state);

    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');

    const updated = readTestState(tmpDir);
    const job = updated.milestones[0].sets[0].waves[0].jobs.find(j => j.id === 'job-1');
    assert.equal(job.status, 'executing');
  });

  it('rejects invalid job transitions', async () => {
    const state = makeStateWithWaves();
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'complete'),
      /Invalid transition/
    );
  });

  it('does not affect sibling jobs in the same wave', async () => {
    const state = makeStateWithWaves();
    writeTestState(tmpDir, state);

    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');

    const updated = readTestState(tmpDir);
    const job2 = updated.milestones[0].sets[0].waves[0].jobs.find(j => j.id === 'job-2');
    assert.equal(job2.status, 'pending');
  });

  it('releases lock after completion', async () => {
    const state = makeStateWithWaves();
    writeTestState(tmpDir, state);

    await transitionJob(tmpDir, 'v1.0', 'set-1', 'wave-1', 'job-1', 'executing');
    assert.equal(isLocked(tmpDir, 'state'), false);
  });
});

// ---- detectIndependentWaves ----

describe('detectIndependentWaves', () => {
  it('returns empty array for empty input', () => {
    const result = detectIndependentWaves([]);
    assert.deepEqual(result, []);
  });

  it('returns single batch when no edges provided (all independent)', () => {
    const waves = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const result = detectIndependentWaves(waves);
    assert.equal(result.length, 1);
    assert.equal(result[0].length, 3);
  });

  it('groups dependent waves into sequential batches', () => {
    const waves = [{ id: 'A' }, { id: 'B' }];
    const edges = [{ from: 'A', to: 'B' }];
    const result = detectIndependentWaves(waves, edges);
    assert.equal(result.length, 2);
    assert.equal(result[0].length, 1);
    assert.equal(result[0][0].id, 'A');
    assert.equal(result[1].length, 1);
    assert.equal(result[1][0].id, 'B');
  });

  it('preserves wave objects in output (not just IDs)', () => {
    const waves = [{ id: 'A', extra: 'data' }, { id: 'B', extra: 'more' }];
    const result = detectIndependentWaves(waves);
    assert.equal(result[0][0].extra, 'data');
    assert.equal(result[0][1].extra, 'more');
  });

  it('handles linear chain: A->B->C produces [[A],[B],[C]]', () => {
    const waves = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges = [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }];
    const result = detectIndependentWaves(waves, edges);
    assert.equal(result.length, 3);
    assert.equal(result[0][0].id, 'A');
    assert.equal(result[1][0].id, 'B');
    assert.equal(result[2][0].id, 'C');
  });

  it('handles diamond: A->{B,C}->D produces [[A],[B,C],[D]]', () => {
    const waves = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
    ];
    const result = detectIndependentWaves(waves, edges);
    assert.equal(result.length, 3);
    assert.equal(result[0].length, 1);
    assert.equal(result[0][0].id, 'A');
    assert.equal(result[1].length, 2);
    const midIds = result[1].map(w => w.id).sort();
    assert.deepEqual(midIds, ['B', 'C']);
    assert.equal(result[2].length, 1);
    assert.equal(result[2][0].id, 'D');
  });
});
