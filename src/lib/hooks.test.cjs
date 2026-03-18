'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  loadHooksConfig,
  saveHooksConfig,
  checkStateConsistency,
  checkArtifacts,
  checkCommits,
  runPostTaskHooks,
  verifyStateUpdated,
} = require('./hooks.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempProject(stateData) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.mkdirSync(path.join(planningDir, '.locks'), { recursive: true });

  if (stateData) {
    const stateFile = path.join(planningDir, 'STATE.json');
    fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2), 'utf-8');
  }

  return tmpDir;
}

function cleanTempProject(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function makeValidState() {
  const now = new Date().toISOString();
  return {
    version: 1,
    projectName: 'test-project',
    currentMilestone: 'v1.0',
    milestones: [{ id: 'v1.0', name: 'v1.0', sets: [] }],
    lastUpdatedAt: now,
    createdAt: now,
  };
}

// ---------------------------------------------------------------------------
// loadHooksConfig
// ---------------------------------------------------------------------------

describe('loadHooksConfig', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmpDir);
  });

  it('returns default config when file does not exist', () => {
    const config = loadHooksConfig(tmpDir);
    assert.equal(config.version, 1);
    assert.equal(config.checks.length, 3);
    assert.deepEqual(config.checks.map(c => c.id), ['state-verify', 'artifact-verify', 'commit-verify']);
    assert.ok(config.checks.every(c => c.enabled === true));
  });

  it('loads valid config from disk', () => {
    const custom = {
      version: 1,
      checks: [
        { id: 'state-verify', enabled: false },
        { id: 'artifact-verify', enabled: true },
        { id: 'commit-verify', enabled: false },
      ],
    };
    const configPath = path.join(tmpDir, '.planning', 'hooks-config.json');
    fs.writeFileSync(configPath, JSON.stringify(custom, null, 2), 'utf-8');

    const config = loadHooksConfig(tmpDir);
    assert.equal(config.checks[0].enabled, false);
    assert.equal(config.checks[1].enabled, true);
    assert.equal(config.checks[2].enabled, false);
  });

  it('throws on malformed JSON', () => {
    const configPath = path.join(tmpDir, '.planning', 'hooks-config.json');
    fs.writeFileSync(configPath, '{not valid json!!!', 'utf-8');

    assert.throws(() => loadHooksConfig(tmpDir), /Malformed JSON/);
  });

  it('throws on invalid schema (missing version)', () => {
    const configPath = path.join(tmpDir, '.planning', 'hooks-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ checks: [] }), 'utf-8');

    assert.throws(() => loadHooksConfig(tmpDir), /Invalid hooks-config.json schema/);
  });
});

// ---------------------------------------------------------------------------
// saveHooksConfig
// ---------------------------------------------------------------------------

describe('saveHooksConfig', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmpDir);
  });

  it('writes config to disk', () => {
    const config = { version: 1, checks: [{ id: 'state-verify', enabled: false }] };
    saveHooksConfig(tmpDir, config);

    const configPath = path.join(tmpDir, '.planning', 'hooks-config.json');
    assert.ok(fs.existsSync(configPath));
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.deepEqual(loaded, config);
  });

  it('saved config can be loaded back', () => {
    const config = {
      version: 1,
      checks: [
        { id: 'state-verify', enabled: true },
        { id: 'artifact-verify', enabled: false },
        { id: 'commit-verify', enabled: true },
      ],
    };
    saveHooksConfig(tmpDir, config);
    const loaded = loadHooksConfig(tmpDir);
    assert.deepEqual(loaded, config);
  });
});

// ---------------------------------------------------------------------------
// checkStateConsistency
// ---------------------------------------------------------------------------

describe('checkStateConsistency', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmpDir);
  });

  it('returns passed when no STATE.json exists', async () => {
    const result = await checkStateConsistency(tmpDir, { status: 'COMPLETE' });
    assert.equal(result.id, 'state-verify');
    assert.equal(result.passed, true);
    assert.equal(result.issues.length, 0);
  });

  it('returns issue when STATE.json is invalid', async () => {
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, '{not valid json', 'utf-8');

    const result = await checkStateConsistency(tmpDir, { status: 'COMPLETE' });
    assert.equal(result.passed, false);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].type, 'error');
    assert.match(result.issues[0].message, /invalid or corrupt/);
  });

  it('returns passed for valid COMPLETE return with matching task counts', async () => {
    tmpDir = createTempProject(makeValidState());

    const returnData = { status: 'COMPLETE', tasks_completed: 4, tasks_total: 4 };
    const result = await checkStateConsistency(tmpDir, returnData);
    assert.equal(result.passed, true);
    assert.equal(result.issues.length, 0);
  });

  it('returns issue when tasks_completed > tasks_total', async () => {
    tmpDir = createTempProject(makeValidState());

    const returnData = { status: 'CHECKPOINT', tasks_completed: 5, tasks_total: 3 };
    const result = await checkStateConsistency(tmpDir, returnData);
    assert.equal(result.passed, false);
    assert.ok(result.issues.some(i => i.message.includes('exceeds')));
  });

  it('returns issue when COMPLETE but tasks_completed != tasks_total', async () => {
    tmpDir = createTempProject(makeValidState());

    const returnData = { status: 'COMPLETE', tasks_completed: 2, tasks_total: 4 };
    const result = await checkStateConsistency(tmpDir, returnData);
    assert.equal(result.passed, false);
    assert.ok(result.issues.some(i => i.message.includes('COMPLETE') && i.message.includes('!==')));
  });

  it('returns issue for invalid status', async () => {
    tmpDir = createTempProject(makeValidState());

    const returnData = { status: 'INVALID_STATUS', tasks_completed: 1, tasks_total: 1 };
    const result = await checkStateConsistency(tmpDir, returnData);
    assert.equal(result.passed, false);
    assert.ok(result.issues.some(i => i.message.includes('must be one of')));
  });
});

// ---------------------------------------------------------------------------
// checkArtifacts
// ---------------------------------------------------------------------------

describe('checkArtifacts', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmpDir);
  });

  it('returns passed when no artifacts in return data', () => {
    const result = checkArtifacts(tmpDir, {});
    assert.equal(result.id, 'artifact-verify');
    assert.equal(result.passed, true);
    assert.equal(result.issues.length, 0);
  });

  it('returns passed when artifacts is empty array', () => {
    const result = checkArtifacts(tmpDir, { artifacts: [] });
    assert.equal(result.passed, true);
  });

  it('returns passed when all artifacts exist', () => {
    // Create a test file
    const testFile = path.join(tmpDir, 'test-artifact.txt');
    fs.writeFileSync(testFile, 'content', 'utf-8');

    const result = checkArtifacts(tmpDir, { artifacts: ['test-artifact.txt'] });
    assert.equal(result.passed, true);
    assert.equal(result.issues.length, 0);
  });

  it('returns issues for missing artifacts', () => {
    const result = checkArtifacts(tmpDir, { artifacts: ['nonexistent.txt', 'also-missing.txt'] });
    assert.equal(result.passed, false);
    assert.equal(result.issues.length, 2);
    assert.ok(result.issues[0].message.includes('Artifact not found'));
    assert.ok(result.issues[1].message.includes('Artifact not found'));
  });

  it('handles mix of existing and missing artifacts', () => {
    const testFile = path.join(tmpDir, 'exists.txt');
    fs.writeFileSync(testFile, 'content', 'utf-8');

    const result = checkArtifacts(tmpDir, { artifacts: ['exists.txt', 'missing.txt'] });
    assert.equal(result.passed, false);
    assert.equal(result.issues.length, 1);
    assert.ok(result.issues[0].message.includes('missing.txt'));
  });
});

// ---------------------------------------------------------------------------
// checkCommits
// ---------------------------------------------------------------------------

describe('checkCommits', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmpDir);
  });

  it('returns passed when no commits in return data', () => {
    const result = checkCommits(tmpDir, {});
    assert.equal(result.id, 'commit-verify');
    assert.equal(result.passed, true);
    assert.equal(result.issues.length, 0);
  });

  it('returns passed when commits is empty array', () => {
    const result = checkCommits(tmpDir, { commits: [] });
    assert.equal(result.passed, true);
  });

  it('returns issues for nonexistent commit hashes', () => {
    const result = checkCommits(tmpDir, { commits: ['deadbeef123456'] });
    assert.equal(result.passed, false);
    assert.equal(result.issues.length, 1);
    assert.ok(result.issues[0].message.includes('Commit not found'));
  });
});

// ---------------------------------------------------------------------------
// runPostTaskHooks
// ---------------------------------------------------------------------------

describe('runPostTaskHooks', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmpDir);
  });

  it('runs all enabled checks and aggregates results', async () => {
    // No STATE.json, no artifacts, no commits -- all checks should pass trivially
    const result = await runPostTaskHooks(tmpDir, { status: 'COMPLETE' });
    assert.equal(result.passed, true);
    assert.equal(result.issues.length, 0);
  });

  it('skips disabled checks', async () => {
    // Create a state so state-verify would have something to check
    tmpDir = createTempProject(makeValidState());

    // Disable state-verify, but give it an invalid status that would fail
    const config = {
      version: 1,
      checks: [
        { id: 'state-verify', enabled: false },
        { id: 'artifact-verify', enabled: true },
        { id: 'commit-verify', enabled: true },
      ],
    };
    saveHooksConfig(tmpDir, config);

    // Invalid status would fail state-verify, but it is disabled
    const result = await runPostTaskHooks(tmpDir, { status: 'INVALID' });
    assert.equal(result.passed, true);
    assert.equal(result.issues.length, 0);
  });

  it('catches check errors without propagating (non-blocking)', async () => {
    // Create a corrupt hooks-config that would cause loadHooksConfig to succeed
    // but set up a scenario where a check function internally throws.
    // We do this by writing a valid config but with a custom check ID that has no handler.
    // The runner should just skip unknown IDs.
    // For a real throw test, we put invalid JSON in STATE.json so readState returns {valid:false}
    // and then verify the runner still returns a result (it won't throw).
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, '{corrupt json', 'utf-8');

    const result = await runPostTaskHooks(tmpDir, {
      status: 'COMPLETE',
      tasks_completed: 3,
      tasks_total: 3,
    });

    // Should not throw, should return an issue about corrupt state
    assert.equal(typeof result, 'object');
    assert.equal(result.passed, false);
    assert.ok(result.issues.some(i => i.message.includes('invalid or corrupt')));
  });

  it('generates remediation string when issues found', async () => {
    tmpDir = createTempProject(makeValidState());

    const result = await runPostTaskHooks(tmpDir, {
      status: 'COMPLETE',
      tasks_completed: 2,
      tasks_total: 4,
      artifacts: ['nonexistent-file.txt'],
    });

    assert.equal(result.passed, false);
    assert.ok(result.remediation);
    assert.ok(result.remediation.includes('[state-verify]'));
    assert.ok(result.remediation.includes('[artifact-verify]'));
  });

  it('returns passed:true when all checks pass', async () => {
    // No state, no artifacts, no commits -- everything trivially passes
    const result = await runPostTaskHooks(tmpDir, { status: 'COMPLETE' });
    assert.equal(result.passed, true);
    assert.equal(result.issues.length, 0);
    assert.equal(result.remediation, undefined);
  });
});

// ---------------------------------------------------------------------------
// verifyStateUpdated
// ---------------------------------------------------------------------------

describe('verifyStateUpdated', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmpDir);
  });

  it('returns stateConsistent true when state is valid', async () => {
    tmpDir = createTempProject(makeValidState());

    const result = await verifyStateUpdated(tmpDir, {
      status: 'COMPLETE',
      tasks_completed: 3,
      tasks_total: 3,
    });
    assert.equal(result.stateConsistent, true);
    assert.deepEqual(result.missingTransitions, []);
  });

  it('returns missingTransitions array for issues', async () => {
    tmpDir = createTempProject(makeValidState());

    const result = await verifyStateUpdated(tmpDir, {
      status: 'COMPLETE',
      tasks_completed: 1,
      tasks_total: 4,
    });
    assert.equal(result.stateConsistent, false);
    assert.ok(result.missingTransitions.length > 0);
    assert.ok(result.missingTransitions.some(m => m.includes('COMPLETE')));
  });

  it('returns stateConsistent true when no STATE.json exists', async () => {
    const result = await verifyStateUpdated(tmpDir, { status: 'COMPLETE' });
    assert.equal(result.stateConsistent, true);
    assert.deepEqual(result.missingTransitions, []);
  });
});

// ---------------------------------------------------------------------------
// CONTRACT.json behavioral invariants
// ---------------------------------------------------------------------------

describe('CONTRACT.json behavioral invariants', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanTempProject(tmpDir);
  });

  it('readOnlyStateAccess: hooks never call writeState or acquireLock', () => {
    // Static analysis: read the hooks.cjs source and verify no write/lock calls
    const hooksSource = fs.readFileSync(
      path.join(__dirname, 'hooks.cjs'),
      'utf-8'
    );

    // Remove comments and string literals to avoid false positives
    // Check for actual function calls (word followed by open paren)
    const writeStateCalls = hooksSource.match(/writeState\s*\(/g);
    const acquireLockCalls = hooksSource.match(/acquireLock\s*\(/g);
    const withStateTransactionCalls = hooksSource.match(/withStateTransaction\s*\(/g);

    assert.equal(writeStateCalls, null, 'hooks.cjs must not call writeState()');
    assert.equal(acquireLockCalls, null, 'hooks.cjs must not call acquireLock()');
    assert.equal(withStateTransactionCalls, null, 'hooks.cjs must not call withStateTransaction()');
  });

  it('readOnlyStateAccess: hooks only import readState, not write functions', () => {
    const hooksSource = fs.readFileSync(
      path.join(__dirname, 'hooks.cjs'),
      'utf-8'
    );

    // Verify the require line only imports readState
    const stateImports = hooksSource.match(/require\('\.\/state-machine\.cjs'\)/);
    assert.ok(stateImports, 'hooks.cjs should import from state-machine.cjs');

    // Should not destructure writeState or acquireLock
    assert.ok(!hooksSource.includes("writeState } = require('./state-machine.cjs')"));
    assert.ok(!hooksSource.includes("acquireLock } = require('./state-machine.cjs')"));
  });

  it('nonBlocking: runPostTaskHooks never throws, even with broken checks', async () => {
    // Write completely broken state file
    const stateFile = path.join(tmpDir, '.planning', 'STATE.json');
    fs.writeFileSync(stateFile, '{{{totally broken', 'utf-8');

    // Write broken hooks config
    const configPath = path.join(tmpDir, '.planning', 'hooks-config.json');
    fs.writeFileSync(configPath, '{{{also broken', 'utf-8');

    // runPostTaskHooks should NEVER throw
    let result;
    let threw = false;
    try {
      result = await runPostTaskHooks(tmpDir, { status: 'COMPLETE' });
    } catch (e) {
      threw = true;
    }

    assert.equal(threw, false, 'runPostTaskHooks must never throw');
    assert.ok(result, 'must return a result object');
    assert.equal(typeof result.passed, 'boolean');
    assert.ok(Array.isArray(result.issues));
  });

  it('idempotent: running hooks twice with same input produces same output', async () => {
    tmpDir = createTempProject(makeValidState());

    const returnData = {
      status: 'COMPLETE',
      tasks_completed: 3,
      tasks_total: 3,
      artifacts: [],
      commits: [],
    };

    const result1 = await runPostTaskHooks(tmpDir, returnData);
    const result2 = await runPostTaskHooks(tmpDir, returnData);

    assert.deepEqual(result1, result2, 'Same input must produce same output');
  });

  it('idempotent: verifyStateUpdated with same input produces same output', async () => {
    tmpDir = createTempProject(makeValidState());

    const returnData = { status: 'CHECKPOINT', tasks_completed: 1, tasks_total: 3 };

    const result1 = await verifyStateUpdated(tmpDir, returnData);
    const result2 = await verifyStateUpdated(tmpDir, returnData);

    assert.deepEqual(result1, result2);
  });
});
