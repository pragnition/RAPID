'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const {
  createInitialState,
  readState,
  writeState,
  transitionSet,
  addMilestone,
  detectCorruption,
  recoverFromGit,
  commitState,
} = require('./state-machine.cjs');

const { ProjectState } = require('./state-schemas.cjs');

// ---- Helpers ----

function makeTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-lifecycle-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.mkdirSync(path.join(planningDir, '.locks'), { recursive: true });
  return tmpDir;
}

function initGitRepo(tmpDir) {
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
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

// ────────────────────────────────────────────────────────────────
// Test Group 1: Full Lifecycle Sequences
// ────────────────────────────────────────────────────────────────

describe('Full set lifecycle', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('full lifecycle: pending -> discussing -> planning -> executing -> complete -> merged', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    const chain = ['discussing', 'planning', 'executing', 'complete', 'merged'];
    for (const nextStatus of chain) {
      await transitionSet(tmpDir, 'v1.0', 'set-1', nextStatus);
      const updated = readTestState(tmpDir);
      assert.equal(
        updated.milestones[0].sets[0].status,
        nextStatus,
        `Set should be '${nextStatus}' after transition`
      );
    }
  });

  it('skip lifecycle: pending -> planning -> executing -> complete -> merged', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    const chain = ['planning', 'executing', 'complete', 'merged'];
    for (const nextStatus of chain) {
      await transitionSet(tmpDir, 'v1.0', 'set-1', nextStatus);
      const updated = readTestState(tmpDir);
      assert.equal(
        updated.milestones[0].sets[0].status,
        nextStatus,
        `Set should be '${nextStatus}' after transition`
      );
    }
  });

  it('invalid forward skip throws', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    // pending -> executing is invalid (must go through planning first)
    await assert.rejects(
      () => transitionSet(tmpDir, 'v1.0', 'set-1', 'executing'),
      /Invalid transition/
    );
  });

  it('backward transition throws', async () => {
    const state = makeStateWithSet();
    state.milestones[0].sets[0].status = 'planning';
    writeTestState(tmpDir, state);

    await assert.rejects(
      () => transitionSet(tmpDir, 'v1.0', 'set-1', 'pending'),
      /Invalid transition/
    );
  });
});

// ────────────────────────────────────────────────────────────────
// Test Group 2: Set Independence
// ────────────────────────────────────────────────────────────────

describe('Set independence in lifecycle', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('two sets progress independently through different lifecycles', async () => {
    const state = makeStateWithTwoSets();
    writeTestState(tmpDir, state);

    // Set-A: full path with discussing
    await transitionSet(tmpDir, 'v1.0', 'set-A', 'discussing');
    await transitionSet(tmpDir, 'v1.0', 'set-A', 'planning');

    // Set-B: skip discussing
    await transitionSet(tmpDir, 'v1.0', 'set-B', 'planning');
    await transitionSet(tmpDir, 'v1.0', 'set-B', 'executing');

    // Verify both are at expected states
    const updated = readTestState(tmpDir);
    const setA = updated.milestones[0].sets.find(s => s.id === 'set-A');
    const setB = updated.milestones[0].sets.find(s => s.id === 'set-B');
    assert.equal(setA.status, 'planning');
    assert.equal(setB.status, 'executing');
  });

  it('transitioning set A to executing while set B stays pending', async () => {
    const state = makeStateWithTwoSets();
    writeTestState(tmpDir, state);

    await transitionSet(tmpDir, 'v1.0', 'set-A', 'planning');
    await transitionSet(tmpDir, 'v1.0', 'set-A', 'executing');

    const updated = readTestState(tmpDir);
    const setA = updated.milestones[0].sets.find(s => s.id === 'set-A');
    const setB = updated.milestones[0].sets.find(s => s.id === 'set-B');
    assert.equal(setA.status, 'executing');
    assert.equal(setB.status, 'pending');
  });
});

// ────────────────────────────────────────────────────────────────
// Test Group 3: Crash Recovery
// ────────────────────────────────────────────────────────────────

describe('Crash recovery', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = makeTempProject();
    initGitRepo(tmpDir);
    // Write and commit a valid state
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);
    execSync('git add .planning/STATE.json', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "initial state"', { cwd: tmpDir, stdio: 'pipe' });
  });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('corrupt JSON detected, recoverFromGit restores, state is valid after recovery', () => {
    // Corrupt the file
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, 'CORRUPTED!!!', 'utf-8');

    // Detect corruption
    const corruption = detectCorruption(tmpDir);
    assert.equal(corruption.exists, true);
    assert.equal(corruption.corrupt, true);

    // Recover
    recoverFromGit(tmpDir);

    // Verify recovery
    const afterRecovery = detectCorruption(tmpDir);
    assert.equal(afterRecovery.exists, true);
    assert.equal(afterRecovery.corrupt, false);

    // Verify data is intact
    const restored = readTestState(tmpDir);
    assert.equal(restored.projectName, 'test-project');
  });

  it('bad schema detected, recoverFromGit restores', () => {
    // Write valid JSON but bad schema
    writeTestState(tmpDir, { version: 999, bad: true });

    const corruption = detectCorruption(tmpDir);
    assert.equal(corruption.corrupt, true);

    recoverFromGit(tmpDir);

    const afterRecovery = detectCorruption(tmpDir);
    assert.equal(afterRecovery.corrupt, false);
  });
});

// ────────────────────────────────────────────────────────────────
// Test Group 4: Atomic Write Guarantees
// ────────────────────────────────────────────────────────────────

describe('Atomic write guarantees', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTempProject(); });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('no .tmp files left after normal write', async () => {
    const state = createInitialState('proj', 'v1');
    await writeState(tmpDir, state);

    const tmpFile = path.join(tmpDir, '.planning', 'STATE.json.tmp');
    assert.equal(fs.existsSync(tmpFile), false);
  });

  it('no .tmp files left after error during validation', async () => {
    const badState = { version: 999, bad: true };
    try {
      await writeState(tmpDir, badState);
    } catch {
      // expected
    }
    const tmpFile = path.join(tmpDir, '.planning', 'STATE.json.tmp');
    assert.equal(fs.existsSync(tmpFile), false);
  });

  it('no .tmp files left after transitionSet', async () => {
    const state = makeStateWithSet();
    writeTestState(tmpDir, state);

    await transitionSet(tmpDir, 'v1.0', 'set-1', 'discussing');

    const tmpFile = path.join(tmpDir, '.planning', 'STATE.json.tmp');
    assert.equal(fs.existsSync(tmpFile), false);
  });
});

// ────────────────────────────────────────────────────────────────
// Test Group 5: commitState
// ────────────────────────────────────────────────────────────────

describe('commitState', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = makeTempProject();
    initGitRepo(tmpDir);
  });
  afterEach(() => { cleanTempProject(tmpDir); });

  it('git add + commit succeeds', () => {
    const state = createInitialState('proj', 'v1');
    writeTestState(tmpDir, state);

    const result = commitState(tmpDir, 'test commit');
    assert.equal(result.committed, true);

    const log = execSync('git log --oneline', { cwd: tmpDir, encoding: 'utf-8' });
    assert.ok(log.includes('test commit'));
  });

  it('second commit with no changes returns { committed: false }', () => {
    const state = createInitialState('proj', 'v1');
    writeTestState(tmpDir, state);
    execSync('git add .planning/STATE.json && git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });

    const result = commitState(tmpDir, 'nothing changed');
    assert.equal(result.committed, false);
  });
});
