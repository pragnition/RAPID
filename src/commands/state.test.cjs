'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'rapid-tools.cjs');

/**
 * Create a minimal valid STATE.json with one milestone and one existing set.
 * This lets us test add-set against a realistic state fixture.
 */
function createMinimalState(milestoneId, existingSets) {
  const now = new Date().toISOString();
  return {
    version: 1,
    projectName: 'test-project',
    currentMilestone: milestoneId,
    milestones: [{
      id: milestoneId,
      name: milestoneId,
      sets: existingSets.map(id => ({ id, status: 'pending', waves: [] })),
    }],
    lastUpdatedAt: now,
    createdAt: now,
  };
}

/**
 * Set up a temp directory with .planning/ structure and valid STATE.json.
 * Also initializes a git repo so findProjectRoot() works.
 */
function setupTestProject(milestoneId, existingSets) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-state-test-'));

  // Initialize git repo (required for findProjectRoot)
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });

  // Create .planning/ structure
  fs.mkdirSync(path.join(dir, '.planning', 'sets'), { recursive: true });

  // Write STATE.json
  const state = createMinimalState(milestoneId, existingSets);
  fs.writeFileSync(
    path.join(dir, '.planning', 'STATE.json'),
    JSON.stringify(state, null, 2),
    'utf-8'
  );

  return dir;
}

function cleanupTestProject(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ────────────────────────────────────────────────────────────────
// state add-set CLI integration tests
// ────────────────────────────────────────────────────────────────
describe('handleState add-set CLI integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = setupTestProject('m1', ['existing-set']);
  });

  afterEach(() => {
    cleanupTestProject(tmpDir);
  });

  it('add-set throws CliError when --milestone is missing', () => {
    try {
      execSync(
        `node "${CLI_PATH}" state add-set --set-id new-set --set-name "New Set"`,
        {
          cwd: tmpDir,
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );
      assert.fail('should have exited with non-zero');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
      const stdout = (err.stdout || '').trim();
      if (stdout) {
        const result = JSON.parse(stdout);
        assert.ok(result.error, 'should have error field');
        assert.ok(result.error.includes('Usage:'), 'error should include usage hint');
      }
    }
  });

  it('add-set throws CliError when --set-id is missing', () => {
    try {
      execSync(
        `node "${CLI_PATH}" state add-set --milestone m1 --set-name "New Set"`,
        {
          cwd: tmpDir,
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );
      assert.fail('should have exited with non-zero');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
      const stdout = (err.stdout || '').trim();
      if (stdout) {
        const result = JSON.parse(stdout);
        assert.ok(result.error, 'should have error field');
        assert.ok(result.error.includes('Usage:'), 'error should include usage hint');
      }
    }
  });

  it('add-set throws CliError when --set-name is missing', () => {
    try {
      execSync(
        `node "${CLI_PATH}" state add-set --milestone m1 --set-id new-set`,
        {
          cwd: tmpDir,
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );
      assert.fail('should have exited with non-zero');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
      const stdout = (err.stdout || '').trim();
      if (stdout) {
        const result = JSON.parse(stdout);
        assert.ok(result.error, 'should have error field');
        assert.ok(result.error.includes('Usage:'), 'error should include usage hint');
      }
    }
  });

  it('add-set with all required flags calls addSetToMilestone and outputs JSON', () => {
    const stdout = execSync(
      `node "${CLI_PATH}" state add-set --milestone m1 --set-id brand-new --set-name "Brand New Set"`,
      {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 15000,
      }
    );
    const result = JSON.parse(stdout.trim());
    assert.equal(result.setId, 'brand-new', 'should return correct setId');
    assert.equal(result.milestoneId, 'm1', 'should return correct milestoneId');
    assert.ok(Array.isArray(result.depsValidated), 'should have depsValidated array');
    assert.deepStrictEqual(result.depsValidated, [], 'depsValidated should be empty when no deps');

    // Verify STATE.json was updated
    const stateRaw = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.json'), 'utf-8');
    const state = JSON.parse(stateRaw);
    const milestone = state.milestones.find(m => m.id === 'm1');
    const newSet = milestone.sets.find(s => s.id === 'brand-new');
    assert.ok(newSet, 'new set should exist in STATE.json');
    assert.equal(newSet.status, 'pending', 'new set should be in pending status');
  });

  it('add-set parses --deps flag into array', () => {
    const stdout = execSync(
      `node "${CLI_PATH}" state add-set --milestone m1 --set-id dep-set --set-name "Dep Set" --deps existing-set`,
      {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 15000,
      }
    );
    const result = JSON.parse(stdout.trim());
    assert.equal(result.setId, 'dep-set', 'should return correct setId');
    assert.deepStrictEqual(result.depsValidated, ['existing-set'], 'should validate the dependency');
  });

  it('add-set with empty --deps passes empty array', () => {
    const stdout = execSync(
      `node "${CLI_PATH}" state add-set --milestone m1 --set-id no-deps --set-name "No Deps Set" --deps ""`,
      {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 15000,
      }
    );
    const result = JSON.parse(stdout.trim());
    assert.deepStrictEqual(result.depsValidated, [], 'empty deps string should produce empty array');
  });

  it('add-set throws CliError on duplicate set', () => {
    try {
      execSync(
        `node "${CLI_PATH}" state add-set --milestone m1 --set-id existing-set --set-name "Duplicate"`,
        {
          cwd: tmpDir,
          encoding: 'utf-8',
          timeout: 15000,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );
      assert.fail('should have exited with non-zero');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero for duplicate set');
      const stdout = (err.stdout || '').trim();
      if (stdout) {
        const result = JSON.parse(stdout);
        assert.ok(result.error, 'should have error field');
        assert.ok(
          result.error.includes('already exists'),
          'error should mention set already exists'
        );
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────
// Concurrency safety integration tests for withStateTransaction
// ────────────────────────────────────────────────────────────────
const { fork } = require('child_process');
const { ProjectState } = require(path.join(__dirname, '..', 'lib', 'state-schemas.cjs'));

/**
 * Generate the JavaScript source for a worker script that increments a counter
 * inside STATE.json via withStateTransaction.
 *
 * @param {string} stateMachinePath - Absolute path to state-machine.cjs
 * @returns {string} JavaScript source code for the worker
 */
function createConcurrencyWorkerSource(stateMachinePath) {
  // Escape backslashes for Windows paths embedded in the source string
  const escapedPath = stateMachinePath.replace(/\\/g, '\\\\');
  return `'use strict';
const { withStateTransaction } = require('${escapedPath}');

const projectRoot = process.argv[2];
if (!projectRoot) {
  process.send({ ok: false, code: 'MISSING_ARG', message: 'No project root argument' });
  process.exit(1);
}

(async () => {
  try {
    await withStateTransaction(projectRoot, (state) => {
      state.counter = (state.counter || 0) + 1;
    });
    process.send({ ok: true });
  } catch (err) {
    process.send({ ok: false, code: err.code || 'UNKNOWN', message: err.message });
  }
})();
`;
}

/**
 * Fork a child process running the given script with the given project root.
 * Returns a Promise that resolves with the IPC message from the child.
 *
 * @param {string} scriptPath - Absolute path to the worker .cjs file
 * @param {string} projectRoot - Absolute path to the temp project directory
 * @returns {Promise<{ok: boolean, code?: string, message?: string}>}
 */
function forkWorker(scriptPath, projectRoot) {
  return new Promise((resolve, reject) => {
    const child = fork(scriptPath, [projectRoot], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    let result = null;
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Worker timed out after 15 seconds'));
    }, 15000);

    child.on('message', (msg) => {
      result = msg;
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (result) {
        resolve(result);
      } else {
        reject(new Error(`Worker exited with code ${code} and sent no message`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

describe('withStateTransaction concurrency safety', () => {
  let tmpDir;
  let workerScriptPath;

  beforeEach(() => {
    tmpDir = setupTestProject('m1', ['set-1']);
    // Write the worker script to a temp file
    const stateMachinePath = path.join(__dirname, '..', 'lib', 'state-machine.cjs');
    workerScriptPath = path.join(tmpDir, '_concurrency-worker.cjs');
    fs.writeFileSync(workerScriptPath, createConcurrencyWorkerSource(stateMachinePath), 'utf-8');
  });

  afterEach(() => {
    cleanupTestProject(tmpDir);
  });

  it('concurrent withStateTransaction calls do not corrupt STATE.json', { timeout: 30000 }, async () => {
    // Fork two workers in parallel
    const results = await Promise.all([
      forkWorker(workerScriptPath, tmpDir),
      forkWorker(workerScriptPath, tmpDir),
    ]);

    // Read STATE.json and verify it is valid
    const stateRaw = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.json'), 'utf-8');

    // Assert: JSON.parse succeeds (not corrupted)
    let state;
    assert.doesNotThrow(() => {
      state = JSON.parse(stateRaw);
    }, 'STATE.json should be valid JSON after concurrent writes');

    // Assert: schema validation passes
    const parseResult = ProjectState.safeParse(state);
    assert.ok(parseResult.success, `STATE.json should pass schema validation: ${JSON.stringify(parseResult.error?.issues)}`);

    // Count successes
    const successes = results.filter(r => r.ok).length;
    const failures = results.filter(r => !r.ok);

    if (successes === 2) {
      // Both succeeded -- counter should be 2
      assert.equal(state.counter, 2, 'counter should be 2 when both transactions succeed');
    } else if (successes === 1) {
      // One failed cleanly -- counter should be 1 and the failure should have a code
      assert.equal(state.counter, 1, 'counter should be 1 when one transaction fails');
      assert.ok(failures[0].code, 'failed transaction should have an error code');
    } else {
      // Both failed -- unusual but possible under extreme contention; counter stays at 0 or missing
      for (const f of failures) {
        assert.ok(f.code, 'all failed transactions should have error codes');
      }
    }
  });

  it('concurrent transactions both produce valid error codes on missing STATE.json', { timeout: 30000 }, async () => {
    // Remove STATE.json to trigger STATE_FILE_MISSING
    fs.unlinkSync(path.join(tmpDir, '.planning', 'STATE.json'));

    const results = await Promise.all([
      forkWorker(workerScriptPath, tmpDir),
      forkWorker(workerScriptPath, tmpDir),
    ]);

    // Both should fail with STATE_FILE_MISSING
    for (const r of results) {
      assert.equal(r.ok, false, 'transaction should fail when STATE.json is missing');
      assert.equal(r.code, 'STATE_FILE_MISSING', `error code should be STATE_FILE_MISSING, got: ${r.code}`);
    }
  });

  it('sequential transactions increment counter correctly', { timeout: 30000 }, async () => {
    // Run two transactions sequentially
    const result1 = await forkWorker(workerScriptPath, tmpDir);
    assert.ok(result1.ok, `first transaction should succeed: ${result1.message}`);

    const result2 = await forkWorker(workerScriptPath, tmpDir);
    assert.ok(result2.ok, `second transaction should succeed: ${result2.message}`);

    // Read final state
    const stateRaw = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.json'), 'utf-8');
    const state = JSON.parse(stateRaw);

    assert.equal(state.counter, 2, 'counter should be 2 after two sequential transactions');

    // Schema validation should still pass
    const parseResult = ProjectState.safeParse(state);
    assert.ok(parseResult.success, 'STATE.json should pass schema validation after sequential transactions');
  });
});
