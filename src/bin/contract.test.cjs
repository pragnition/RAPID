'use strict';

/**
 * Contract test harness for RAPID CLI output shapes.
 *
 * Captures the exact JSON output structure of each command group BEFORE
 * any extraction begins. These tests assert structural properties (key
 * existence and types) rather than exact values, so they tolerate additive
 * changes but catch regressions in the output contract.
 *
 * This file does NOT duplicate tests from rapid-tools.test.cjs; it only
 * adds shape assertions for command outputs that skills and agents depend on.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLI_PATH = path.join(__dirname, 'rapid-tools.cjs');

// ── Helpers ──

/**
 * Run a CLI command and return stdout. Swallows stderr.
 */
function runCli(cmd, options = {}) {
  return execSync(`node "${CLI_PATH}" ${cmd}`, {
    encoding: 'utf-8',
    timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });
}

/**
 * Run CLI and parse JSON output. Handles the [RAPID] prefix that some
 * commands prepend via output() instead of process.stdout.write().
 */
function runCliJson(cmd, options = {}) {
  const stdout = runCli(cmd, options);
  const trimmed = stdout.trim();

  // Some commands use output(JSON.stringify(...)) which prepends [RAPID]
  // Strip the prefix if present to get raw JSON
  let jsonStr = trimmed;
  if (jsonStr.startsWith('[RAPID] ')) {
    jsonStr = jsonStr.slice('[RAPID] '.length);
  }

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Expected valid JSON from "${cmd}" but got: ${trimmed.slice(0, 300)}`);
  }
}

/**
 * Create a temp directory with .planning/, STATE.json, sets/, and worktree registry.
 * Returns the path. Caller must clean up.
 */
async function createContractProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-contract-'));
  const planningDir = path.join(dir, '.planning');
  const setsDir = path.join(planningDir, 'sets');
  const locksDir = path.join(planningDir, '.locks');
  const worktreesDir = path.join(planningDir, 'worktrees');

  fs.mkdirSync(locksDir, { recursive: true });
  fs.mkdirSync(setsDir, { recursive: true });
  fs.mkdirSync(worktreesDir, { recursive: true });

  // Create valid STATE.json via state-machine
  const sm = require('../lib/state-machine.cjs');
  const state = sm.createInitialState('contract-project', 'v1.0');

  // Add a set with waves and jobs
  state.milestones[0].sets.push({
    id: 'test-set',
    name: 'Test Set',
    status: 'pending',
    waves: [{
      id: 'wave-1',
      name: 'Wave 1',
      status: 'pending',
      jobs: [{
        id: 'job-1',
        name: 'Job 1',
        status: 'pending',
      }],
    }],
  });

  await sm.writeState(dir, state);

  // Create a set directory with CONTRACT.json, SET-OVERVIEW.md, and DEFINITION.md
  const setDir = path.join(setsDir, 'test-set');
  fs.mkdirSync(setDir, { recursive: true });
  fs.writeFileSync(path.join(setDir, 'SET-OVERVIEW.md'), '# Test Set\n', 'utf-8');
  fs.writeFileSync(path.join(setDir, 'DEFINITION.md'), '# Set: test-set\n\n## Scope\nTest scope\n\n## File Ownership\n- src/test.cjs\n', 'utf-8');
  fs.writeFileSync(path.join(setDir, 'CONTRACT.json'), JSON.stringify({
    name: 'test-set',
    description: 'A test set for contract tests',
    fileOwnership: ['src/test.cjs'],
    imports: [],
    exports: [],
  }, null, 2), 'utf-8');

  // Create worktree registry
  fs.writeFileSync(path.join(worktreesDir, 'REGISTRY.json'), JSON.stringify({
    worktrees: {
      'test-set': {
        setName: 'test-set',
        branch: 'rapid/test-set',
        path: '.rapid-worktrees/test-set',
        phase: 'Planning',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  }, null, 2), 'utf-8');

  // Create DAG.json with v2.0 wave-keyed format (waves as object, not array)
  fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify({
    sets: { 'test-set': { dependsOn: [] } },
    waves: {
      1: { sets: ['test-set'] },
    },
  }, null, 2), 'utf-8');

  // Initialize git repo (required for some commands)
  try {
    execSync('git init', { cwd: dir, stdio: 'pipe', timeout: 5000 });
    execSync('git add -A', { cwd: dir, stdio: 'pipe', timeout: 5000 });
    execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe', timeout: 5000 });
  } catch {
    // Some commands work without git; proceed anyway
  }

  return dir;
}

// ════════════════════════════════════════════════════════════
// CONTRACT TESTS
// ════════════════════════════════════════════════════════════

describe('CLI Output Contract Tests', () => {
  let projectDir;

  before(async () => {
    projectDir = await createContractProject();
  });

  after(() => {
    if (projectDir) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  // ── State commands ──
  describe('state command output shapes', () => {
    it('state get --all returns object with milestones, currentMilestone, version', () => {
      const result = runCliJson('state get --all', { cwd: projectDir });
      assert.ok('milestones' in result, 'should have milestones key');
      assert.ok(Array.isArray(result.milestones), 'milestones should be an array');
      assert.ok('currentMilestone' in result, 'should have currentMilestone key');
      assert.strictEqual(typeof result.currentMilestone, 'string');
      assert.ok('version' in result, 'should have version key');
    });

    it('state get milestone <id> returns object with id, name, sets array', () => {
      const result = runCliJson('state get milestone v1.0', { cwd: projectDir });
      assert.ok('id' in result, 'should have id key');
      assert.ok('name' in result, 'should have name key');
      assert.ok('sets' in result, 'should have sets key');
      assert.ok(Array.isArray(result.sets), 'sets should be an array');
    });

    it('state get set returns object with id, name, status, waves', () => {
      const result = runCliJson('state get set v1.0 test-set', { cwd: projectDir });
      assert.ok('id' in result, 'should have id key');
      assert.ok('name' in result, 'should have name key');
      assert.ok('status' in result, 'should have status key');
      assert.ok('waves' in result, 'should have waves key');
      assert.ok(Array.isArray(result.waves), 'waves should be an array');
    });

    it('state transition set returns transitioned shape', () => {
      const result = runCliJson('state transition set v1.0 test-set planned', { cwd: projectDir });
      assert.ok('transitioned' in result, 'should have transitioned key');
      assert.strictEqual(result.transitioned, true);
      assert.ok('entity' in result, 'should have entity key');
      assert.strictEqual(result.entity, 'set');
      assert.ok('id' in result, 'should have id key');
      assert.ok('status' in result, 'should have status key');
    });

    it('state detect-corruption returns object with exists and corrupt fields', () => {
      const result = runCliJson('state detect-corruption', { cwd: projectDir });
      assert.ok('exists' in result, 'should have exists key');
      assert.strictEqual(typeof result.exists, 'boolean');
      if (result.exists) {
        assert.ok('corrupt' in result, 'should have corrupt key when exists=true');
        assert.strictEqual(typeof result.corrupt, 'boolean');
      }
    });

    it('state recover returns recovered shape or error shape', () => {
      try {
        const result = runCliJson('state recover', { cwd: projectDir });
        assert.ok('recovered' in result, 'should have recovered key');
        assert.strictEqual(result.recovered, true);
      } catch (err) {
        // If recover fails (e.g. no STATE.json in git history), check the error shape
        const stdout = err.stdout || '';
        if (stdout.trim()) {
          const result = JSON.parse(stdout.trim());
          assert.ok('error' in result, 'error output should have error key');
          assert.strictEqual(typeof result.error, 'string');
        }
      }
    });
  });

  // ── Plan commands ──
  describe('plan command output shapes', () => {
    it('plan list-sets returns object with sets array', () => {
      const result = runCliJson('plan list-sets', { cwd: projectDir });
      assert.ok('sets' in result, 'should have sets key');
      assert.ok(Array.isArray(result.sets), 'sets should be an array');
    });

    it('plan load-set returns object with definition and contract', () => {
      const result = runCliJson('plan load-set test-set', { cwd: projectDir });
      assert.ok(typeof result === 'object', 'should return an object');
      assert.ok(result !== null, 'should not be null');
      assert.ok('definition' in result, 'should have definition key');
      assert.ok('contract' in result, 'should have contract key');
      assert.strictEqual(typeof result.definition, 'string', 'definition should be a string (markdown)');
      assert.strictEqual(typeof result.contract, 'object', 'contract should be an object');
    });

    it('plan create-set returns object with created set info', () => {
      // createSet expects a full set definition with ownedFiles, scope, tasks, contract, acceptance, wave
      const setDef = JSON.stringify({
        name: 'contract-create-test',
        scope: 'Test scope for contract test',
        ownedFiles: ['src/contract-test.cjs'],
        tasks: [{ description: 'Test task', files: ['src/contract-test.cjs'] }],
        acceptance: ['Tests pass'],
        wave: 1,
        contract: {
          name: 'contract-create-test',
          fileOwnership: ['src/contract-test.cjs'],
          imports: [],
          exports: [],
        },
      });
      const stdout = execSync(
        `printf '%s' '${setDef.replace(/'/g, "'\\''")}' | node "${CLI_PATH}" plan create-set`,
        { cwd: projectDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const result = JSON.parse(stdout.trim());
      assert.ok(typeof result === 'object', 'should return an object');
      assert.ok(result !== null, 'should not be null');
    });
  });

  // ── Lock commands ──
  describe('lock command output shapes', () => {
    it('lock acquire returns acquired shape', () => {
      const result = runCliJson('lock acquire contract-test-lock', { cwd: projectDir });
      assert.ok('acquired' in result, 'should have acquired key');
      assert.strictEqual(result.acquired, true);
      assert.ok('lock' in result, 'should have lock key');
      assert.strictEqual(typeof result.lock, 'string');
    });

    it('lock status returns locked shape', () => {
      const result = runCliJson('lock status contract-test-lock', { cwd: projectDir });
      assert.ok('locked' in result, 'should have locked key');
      assert.strictEqual(typeof result.locked, 'boolean');
      assert.ok('lock' in result, 'should have lock key');
      assert.strictEqual(typeof result.lock, 'string');
    });
  });

  // ── Worktree commands ──
  describe('worktree command output shapes', () => {
    it('worktree list returns object with worktrees array', () => {
      const result = runCliJson('worktree list', { cwd: projectDir });
      assert.ok('worktrees' in result, 'should have worktrees key');
      assert.ok(Array.isArray(result.worktrees), 'worktrees should be an array');
    });

    it('worktree reconcile returns reconciled shape', () => {
      const result = runCliJson('worktree reconcile', { cwd: projectDir });
      assert.ok('reconciled' in result, 'should have reconciled key');
      assert.strictEqual(result.reconciled, true);
      assert.ok('orphaned' in result, 'should have orphaned key');
      assert.strictEqual(typeof result.orphaned, 'number');
      assert.ok('discovered' in result, 'should have discovered key');
      assert.strictEqual(typeof result.discovered, 'number');
    });
  });

  // ── Execute commands ──
  describe('execute command output shapes', () => {
    it('execute wave-status returns object with waves array', () => {
      const result = runCliJson('execute wave-status', { cwd: projectDir });
      assert.ok('waves' in result, 'should have waves key');
      assert.ok(Array.isArray(result.waves), 'waves should be an array');
      // Each wave should have wave number, sets array, and gateOpen
      if (result.waves.length > 0) {
        const wave = result.waves[0];
        assert.ok('wave' in wave, 'wave entry should have wave number');
        assert.ok('sets' in wave, 'wave entry should have sets array');
        assert.ok(Array.isArray(wave.sets), 'sets should be an array');
        assert.ok('gateOpen' in wave, 'wave entry should have gateOpen flag');
      }
    });

    it('execute update-phase returns updated shape', () => {
      const result = runCliJson('execute update-phase test-set Planning', { cwd: projectDir });
      assert.ok('updated' in result, 'should have updated key');
      assert.strictEqual(result.updated, true);
      assert.ok('setName' in result, 'should have setName key');
      assert.strictEqual(typeof result.setName, 'string');
      assert.ok('phase' in result, 'should have phase key');
      assert.strictEqual(typeof result.phase, 'string');
    });
  });

  // ── Merge commands ──
  describe('merge command output shapes', () => {
    it('merge status returns object keyed by set name with phase and mergeStatus', () => {
      // merge status uses output() which prepends [RAPID]
      const result = runCliJson('merge status', { cwd: projectDir });
      assert.ok(typeof result === 'object', 'should return an object');
      assert.ok(result !== null, 'should not be null');
      // Each entry should have phase, mergeStatus
      for (const [key, entry] of Object.entries(result)) {
        assert.ok('phase' in entry, `entry "${key}" should have phase key`);
        assert.ok('mergeStatus' in entry, `entry "${key}" should have mergeStatus key`);
        assert.ok('mergedAt' in entry, `entry "${key}" should have mergedAt key`);
        assert.ok('mergeCommit' in entry, `entry "${key}" should have mergeCommit key`);
        assert.ok('mergeState' in entry, `entry "${key}" should have mergeState key`);
      }
    });

    it('merge order returns array of arrays (wave-grouped)', () => {
      // merge order uses output() which prepends [RAPID]
      const result = runCliJson('merge order', { cwd: projectDir });
      assert.ok(Array.isArray(result), 'should return an array');
      // Each element should be an array (wave group)
      if (result.length > 0) {
        assert.ok(Array.isArray(result[0]), 'each element should be an array (wave group)');
      }
    });

    it('merge integration-test returns object with test results', () => {
      // merge integration-test uses output() which prepends [RAPID]
      const result = runCliJson('merge integration-test', { cwd: projectDir });
      assert.ok(typeof result === 'object', 'should return an object');
      assert.ok(result !== null, 'should not be null');
      assert.ok('passed' in result, 'should have passed key');
      assert.strictEqual(typeof result.passed, 'boolean');
      assert.ok('output' in result, 'should have output key');
      assert.strictEqual(typeof result.output, 'string');
    });
  });

  // ── Resolve commands ──
  describe('resolve command output shapes', () => {
    it('resolve set returns resolved set data or error shape', () => {
      try {
        const result = runCliJson('resolve set test-set', { cwd: projectDir });
        assert.ok(typeof result === 'object', 'should return an object');
        assert.ok(result !== null, 'should not be null');
        // Successful resolve should have set-related fields
        if (!('error' in result)) {
          assert.ok('id' in result || 'name' in result || 'setName' in result,
            'resolved set should have identifying field');
        }
      } catch (err) {
        // Error case: check the error shape
        const stdout = err.stdout || '';
        if (stdout.trim()) {
          const result = JSON.parse(stdout.trim());
          assert.ok('error' in result, 'error output should have error key');
          assert.strictEqual(typeof result.error, 'string');
        }
      }
    });

    it('resolve wave returns resolved wave data or error shape', () => {
      try {
        const result = runCliJson('resolve wave 1', { cwd: projectDir });
        assert.ok(typeof result === 'object', 'should return an object');
        assert.ok(result !== null, 'should not be null');
      } catch (err) {
        // Error case: check the error shape
        const stdout = err.stdout || '';
        if (stdout.trim()) {
          const result = JSON.parse(stdout.trim());
          assert.ok('error' in result, 'error output should have error key');
          assert.strictEqual(typeof result.error, 'string');
        }
      }
    });
  });

  // ── Prereqs commands ──
  describe('prereqs command output shapes', () => {
    it('prereqs returns object with results array and summary', () => {
      const result = runCliJson('prereqs', { cwd: projectDir });
      assert.ok('results' in result, 'should have results key');
      assert.ok(Array.isArray(result.results), 'results should be an array');
      assert.ok('summary' in result, 'should have summary key');
      assert.ok(typeof result.summary === 'object', 'summary should be an object');
    });

    it('prereqs --json returns JSON array', () => {
      const result = runCliJson('prereqs --json', { cwd: projectDir });
      assert.ok(Array.isArray(result), 'should return an array');
      if (result.length > 0) {
        const entry = result[0];
        assert.ok(typeof entry === 'object', 'each entry should be an object');
      }
    });

    it('prereqs --git-check returns object with isRepo field', () => {
      const result = runCliJson('prereqs --git-check', { cwd: projectDir });
      assert.ok('isRepo' in result, 'should have isRepo key');
      assert.strictEqual(typeof result.isRepo, 'boolean');
    });
  });

  // ── Display commands ──
  describe('display command output shapes', () => {
    it('display banner returns raw text (NOT JSON)', () => {
      const stdout = runCli('display banner init', { cwd: projectDir });
      assert.ok(typeof stdout === 'string', 'should return a string');
      assert.ok(stdout.length > 0, 'should not be empty');
      // Verify it is NOT JSON
      let isJson = false;
      try {
        JSON.parse(stdout.trim());
        isJson = true;
      } catch {
        // Expected: not JSON
      }
      assert.ok(!isJson, 'banner output should NOT be valid JSON');
    });
  });

  // ── Verify-artifacts commands ──
  describe('verify-artifacts command output shapes', () => {
    it('verify-artifacts returns object with passed and failed arrays', () => {
      const testFile = path.join(projectDir, 'test-artifact.cjs');
      fs.writeFileSync(testFile, '// test artifact\n', 'utf-8');

      const result = runCliJson(`verify-artifacts ${testFile}`, { cwd: projectDir });
      assert.ok(typeof result === 'object', 'should return an object');
      assert.ok('passed' in result, 'should have passed key');
      assert.ok(Array.isArray(result.passed), 'passed should be an array');
      assert.ok('failed' in result, 'should have failed key');
      assert.ok(Array.isArray(result.failed), 'failed should be an array');
    });

    it('verify-artifacts --report returns string report', () => {
      const testFile = path.join(projectDir, 'test-artifact.cjs');
      fs.writeFileSync(testFile, '// test artifact\n', 'utf-8');

      const stdout = runCli(`verify-artifacts --report ${testFile}`, { cwd: projectDir });
      assert.ok(typeof stdout === 'string', 'report should be a string');
      assert.ok(stdout.length > 0, 'report should not be empty');
    });
  });
});
