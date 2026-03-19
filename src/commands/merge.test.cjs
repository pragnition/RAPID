'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'rapid-tools.cjs');

/**
 * Set up a temp directory with .planning/ structure, valid STATE.json,
 * and a git repo so the CLI can find the project root.
 */
function setupTestProject(setNames) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-cmd-'));

  // Initialize git repo
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });

  // Create .planning/sets/ structure
  const setsDir = path.join(dir, '.planning', 'sets');
  fs.mkdirSync(setsDir, { recursive: true });

  // Write STATE.json
  const now = new Date().toISOString();
  const state = {
    version: 1,
    projectName: 'test-project',
    currentMilestone: 'v1',
    milestones: [{
      id: 'v1',
      name: 'v1',
      sets: setNames.map(id => ({ id, status: 'pending', waves: [] })),
    }],
    lastUpdatedAt: now,
    createdAt: now,
  };
  fs.writeFileSync(
    path.join(dir, '.planning', 'STATE.json'),
    JSON.stringify(state, null, 2),
    'utf-8'
  );

  // Write worktree REGISTRY.json (empty)
  const worktreeDir = path.join(dir, '.planning', 'worktrees');
  fs.mkdirSync(worktreeDir, { recursive: true });
  fs.writeFileSync(
    path.join(worktreeDir, 'REGISTRY.json'),
    JSON.stringify({ worktrees: {} }, null, 2),
    'utf-8'
  );

  return dir;
}

function cleanupTestProject(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// handleMerge 'order' subcommand
// ---------------------------------------------------------------------------
describe('merge order subcommand', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = setupTestProject(['auth', 'data', 'api']);
  });

  afterEach(() => {
    cleanupTestProject(tmpDir);
  });

  it('calls getMergeOrder and returns wave-grouped arrays', () => {
    // Place DAG at canonical path
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    const dagObj = {
      nodes: [{ id: 'auth' }, { id: 'data' }, { id: 'api' }],
      edges: [{ from: 'auth', to: 'api' }, { from: 'data', to: 'api' }],
      waves: { '1': { sets: ['auth', 'data'] }, '2': { sets: ['api'] } },
      metadata: { generatedAt: new Date().toISOString() },
    };
    fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify(dagObj), 'utf-8');

    const result = execSync(
      `node "${CLI_PATH}" merge order`,
      { cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe' }
    );
    // output() prefixes with [RAPID], so parse the JSON from the line
    const jsonStr = result.replace(/^\[RAPID\]\s*/, '').trim();
    const parsed = JSON.parse(jsonStr);
    assert.deepStrictEqual(parsed, [['auth', 'data'], ['api']]);
  });

  it('fails when DAG.json is missing', () => {
    // No DAG.json created -- should throw
    assert.throws(() => {
      execSync(
        `node "${CLI_PATH}" merge order`,
        { cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe' }
      );
    });
  });
});

// ---------------------------------------------------------------------------
// handleMerge 'rollback' subcommand
// ---------------------------------------------------------------------------
describe('merge rollback subcommand', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = setupTestProject(['auth', 'api']);
  });

  afterEach(() => {
    cleanupTestProject(tmpDir);
  });

  it('calls detectCascadeImpact and reports cascade warning', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');

    // Create DAG with dependency: auth -> api
    const dagObj = {
      nodes: [{ id: 'auth' }, { id: 'api' }],
      edges: [{ from: 'auth', to: 'api' }],
      waves: { '1': { sets: ['auth'] }, '2': { sets: ['api'] } },
      metadata: { generatedAt: new Date().toISOString() },
    };
    fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify(dagObj), 'utf-8');

    // Create MERGE-STATE for 'auth' with a merge commit (so rollback has something to revert)
    const authDir = path.join(setsDir, 'auth');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'MERGE-STATE.json'), JSON.stringify({
      setId: 'auth',
      status: 'complete',
      mergeCommit: 'abc1234',
      lastUpdatedAt: new Date().toISOString(),
    }), 'utf-8');

    // Create MERGE-STATE for 'api' as complete (already merged -- should trigger cascade)
    const apiDir = path.join(setsDir, 'api');
    fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(path.join(apiDir, 'MERGE-STATE.json'), JSON.stringify({
      setId: 'api',
      status: 'complete',
      mergeCommit: 'def5678',
      lastUpdatedAt: new Date().toISOString(),
    }), 'utf-8');

    // Create REGISTRY.json with worktree entries
    const worktreeDir = path.join(tmpDir, '.planning', 'worktrees');
    fs.mkdirSync(worktreeDir, { recursive: true });
    fs.writeFileSync(path.join(worktreeDir, 'REGISTRY.json'), JSON.stringify({
      worktrees: {
        auth: { path: '.rapid-worktrees/auth', branch: 'rapid/auth' },
        api: { path: '.rapid-worktrees/api', branch: 'rapid/api' },
      },
    }), 'utf-8');

    // Rollback 'auth' without --force -- should get cascade warning
    const result = execSync(
      `node "${CLI_PATH}" merge rollback auth`,
      { cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe' }
    );
    const jsonStr = result.replace(/^\[RAPID\]\s*/, '').trim();
    const parsed = JSON.parse(jsonStr);
    assert.equal(parsed.rolledBack, false);
    assert.equal(parsed.cascadeWarning, true);
    assert.ok(parsed.affectedSets.includes('api'));
    assert.ok(parsed.hint.includes('--force'));
  });
});
