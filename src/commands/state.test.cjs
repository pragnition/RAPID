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
