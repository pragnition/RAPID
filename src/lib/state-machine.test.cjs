'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  migrateState,
  createInitialState,
  readState,
  writeState,
  withStateTransaction,
  findMilestone,
  findSet,
  transitionSet,
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
});

// ---- migrateState ----

describe('migrateState', () => {
  it('migrates discussing -> discussed in all milestones', () => {
    const state = {
      milestones: [
        { sets: [{ id: 's1', status: 'discussing' }] },
        { sets: [{ id: 's2', status: 'discussing' }] },
      ],
    };
    migrateState(state);
    assert.equal(state.milestones[0].sets[0].status, 'discussed');
    assert.equal(state.milestones[1].sets[0].status, 'discussed');
  });

  it('migrates planning -> planned', () => {
    const state = {
      milestones: [
        { sets: [{ id: 's1', status: 'planning' }] },
      ],
    };
    migrateState(state);
    assert.equal(state.milestones[0].sets[0].status, 'planned');
  });

  it('migrates executing -> executed', () => {
    const state = {
      milestones: [
        { sets: [{ id: 's1', status: 'executing' }] },
      ],
    };
    migrateState(state);
    assert.equal(state.milestones[0].sets[0].status, 'executed');
  });

  it('is idempotent (safe to call twice)', () => {
    const state = {
      milestones: [
        { sets: [
          { id: 's1', status: 'discussing' },
          { id: 's2', status: 'planning' },
          { id: 's3', status: 'executing' },
        ] },
      ],
    };
    migrateState(state);
    const afterFirst = JSON.parse(JSON.stringify(state));
    migrateState(state);
    assert.deepEqual(state, afterFirst);
  });

  it('does not change pending, complete, or merged', () => {
    const state = {
      milestones: [
        { sets: [
          { id: 's1', status: 'pending' },
          { id: 's2', status: 'complete' },
          { id: 's3', status: 'merged' },
        ] },
      ],
    };
    migrateState(state);
    assert.equal(state.milestones[0].sets[0].status, 'pending');
    assert.equal(state.milestones[0].sets[1].status, 'complete');
    assert.equal(state.milestones[0].sets[2].status, 'merged');
  });

  it('handles null/undefined gracefully', () => {
    assert.equal(migrateState(null), null);
    assert.deepEqual(migrateState({}), {});
  });

  it('handles milestones with empty sets array', () => {
    const state = {
      milestones: [
        { sets: [] },
      ],
    };
    assert.doesNotThrow(() => migrateState(state));
    assert.deepEqual(state.milestones[0].sets, []);
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

// ---- Removed exports ----

describe('removed exports', () => {
  const sm = require('./state-machine.cjs');

  it('findWave is not exported', () => {
    assert.equal(sm.findWave, undefined);
  });

  it('findJob is not exported', () => {
    assert.equal(sm.findJob, undefined);
  });

  it('transitionWave is not exported', () => {
    assert.equal(sm.transitionWave, undefined);
  });

  it('transitionJob is not exported', () => {
    assert.equal(sm.transitionJob, undefined);
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

    await transitionSet(tmpDir, 'v1.0', 'set-1', 'discussing');

    const updated = readTestState(tmpDir);
    assert.equal(updated.milestones[0].sets[0].status, 'discussing');
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

    // pending -> planning is valid (skip discussing)
    await transitionSet(tmpDir, 'v1.0', 'set-1', 'planning');
    const updated = readTestState(tmpDir);
    assert.equal(updated.milestones[0].sets[0].status, 'planning');
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
    state.milestones[0].sets[0].status = 'planning';
    writeTestState(tmpDir, state);

    const warnings = await validateDiskArtifacts(tmpDir, 'v1.0', 'set-1');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].type, 'warning');
    assert.ok(warnings[0].message.includes('CONTEXT.md'));
  });

  it('returns warning for executing status without wave plans dir', async () => {
    const state = makeStateWithSet();
    state.milestones[0].sets[0].status = 'executing';
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

  it('returns empty array when all artifacts exist for executing status', async () => {
    const state = makeStateWithSet();
    state.milestones[0].sets[0].status = 'executing';
    writeTestState(tmpDir, state);
    // Create both CONTEXT.md and waves dir
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'set-1'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'sets', 'set-1', 'CONTEXT.md'), 'ctx', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'waves', 'set-1'), { recursive: true });

    const warnings = await validateDiskArtifacts(tmpDir, 'v1.0', 'set-1');
    assert.deepEqual(warnings, []);
  });

  it('does NOT write to STATE.json (check mtime before/after)', async () => {
    const state = makeStateWithSet();
    state.milestones[0].sets[0].status = 'planning';
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

    // Transition set-A to discussing
    await transitionSet(tmpDir, 'v1.0', 'set-A', 'discussing');

    // Verify set-B is still pending
    const updated = readTestState(tmpDir);
    const setA = updated.milestones[0].sets.find(s => s.id === 'set-A');
    const setB = updated.milestones[0].sets.find(s => s.id === 'set-B');
    assert.equal(setA.status, 'discussing');
    assert.equal(setB.status, 'pending');
  });

  it('two sets can be in different states simultaneously', async () => {
    const state = makeStateWithTwoSets();
    writeTestState(tmpDir, state);

    await transitionSet(tmpDir, 'v1.0', 'set-A', 'planning');
    await transitionSet(tmpDir, 'v1.0', 'set-B', 'discussing');

    const updated = readTestState(tmpDir);
    const setA = updated.milestones[0].sets.find(s => s.id === 'set-A');
    const setB = updated.milestones[0].sets.find(s => s.id === 'set-B');
    assert.equal(setA.status, 'planning');
    assert.equal(setB.status, 'discussing');
  });
});
