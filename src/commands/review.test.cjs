'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'rapid-tools.cjs');

/**
 * Parse CLI output, stripping the [RAPID] prefix.
 */
function parseOutput(raw) {
  const line = raw.trim().replace(/^\[RAPID\]\s*/, '');
  return JSON.parse(line);
}

/**
 * Set up a temp directory with .planning/ structure, git repo, and STATE.json.
 */
function setupTestProject(setId) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-review-test-'));
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });
  fs.mkdirSync(path.join(dir, '.planning', 'sets', setId), { recursive: true });
  const state = {
    version: 1,
    projectName: 'test',
    currentMilestone: 'ms-1',
    milestones: [{
      id: 'ms-1',
      name: 'ms-1',
      sets: [{ id: setId, status: 'executing', waves: [] }],
    }],
    lastUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
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
// review log-issue CLI integration tests
// ────────────────────────────────────────────────────────────────
describe('review log-issue', () => {
  let tmpDir;
  const SET_ID = 'test-set';

  beforeEach(() => {
    tmpDir = setupTestProject(SET_ID);
  });

  afterEach(() => {
    cleanupTestProject(tmpDir);
  });

  it('logs issue via stdin JSON (backward compat)', () => {
    const issue = JSON.stringify({
      id: 't1', type: 'bug', severity: 'high', file: 'x.cjs',
      description: 'broken thing', source: 'bug-hunt',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const result = execSync(
      `echo '${issue}' | node "${CLI_PATH}" review log-issue ${SET_ID}`,
      { cwd: tmpDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const parsed = parseOutput(result);
    assert.strictEqual(parsed.logged, true);
    assert.strictEqual(parsed.issueId, 't1');

    // Verify REVIEW-ISSUES.json was created
    const issuesPath = path.join(tmpDir, '.planning', 'sets', SET_ID, 'REVIEW-ISSUES.json');
    assert.ok(fs.existsSync(issuesPath), 'REVIEW-ISSUES.json should exist');
    const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    assert.strictEqual(issues.issues.length, 1);
    assert.strictEqual(issues.issues[0].id, 't1');
  });

  it('logs issue via CLI flags', () => {
    const result = execSync(
      `node "${CLI_PATH}" review log-issue ${SET_ID} --type bug --severity high --file src/foo.cjs --description "broken" --source bug-hunt`,
      { cwd: tmpDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const parsed = parseOutput(result);
    assert.strictEqual(parsed.logged, true);
    assert.ok(parsed.issueId, 'should have issueId');

    // Verify REVIEW-ISSUES.json contents
    const issuesPath = path.join(tmpDir, '.planning', 'sets', SET_ID, 'REVIEW-ISSUES.json');
    const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    assert.strictEqual(data.issues.length, 1);
    const issue = data.issues[0];
    // UUID format check
    assert.match(issue.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // ISO timestamp check
    assert.ok(!isNaN(Date.parse(issue.createdAt)), 'createdAt should be valid ISO timestamp');
    assert.strictEqual(issue.type, 'bug');
    assert.strictEqual(issue.severity, 'high');
    assert.strictEqual(issue.file, 'src/foo.cjs');
    assert.strictEqual(issue.description, 'broken');
    assert.strictEqual(issue.source, 'bug-hunt');
    assert.strictEqual(issue.status, 'open');
  });

  it('CLI flags with optional --line and --wave', () => {
    const result = execSync(
      `node "${CLI_PATH}" review log-issue ${SET_ID} --type bug --severity high --file src/foo.cjs --description "broken" --source bug-hunt --line 42 --wave wave-1`,
      { cwd: tmpDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const parsed = parseOutput(result);
    assert.strictEqual(parsed.logged, true);

    const issuesPath = path.join(tmpDir, '.planning', 'sets', SET_ID, 'REVIEW-ISSUES.json');
    const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    const issue = data.issues[0];
    assert.strictEqual(issue.line, 42);
    assert.strictEqual(issue.originatingWave, 'wave-1');
  });

  it('errors on missing required CLI flags', () => {
    try {
      execSync(
        `node "${CLI_PATH}" review log-issue ${SET_ID} --type bug`,
        { cwd: tmpDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      assert.fail('should have exited with non-zero');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
      const stdout = (err.stdout || '').trim();
      if (stdout) {
        const result = parseOutput(stdout);
        assert.ok(result.error, 'should have error field');
        assert.ok(result.error.includes('Usage'), 'error should include usage hint');
      }
    }
  });

  it('errors on missing set-id', () => {
    try {
      execSync(
        `node "${CLI_PATH}" review log-issue`,
        { cwd: tmpDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      assert.fail('should have exited with non-zero');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
      const stdout = (err.stdout || '').trim();
      if (stdout) {
        const result = parseOutput(stdout);
        assert.ok(result.error, 'should have error field');
        assert.ok(result.error.includes('Usage'), 'error should include Usage');
      }
    }
  });

  it('stdin JSON with wave-id positional (backward compat)', () => {
    const issue = JSON.stringify({
      id: 't2', type: 'bug', severity: 'high', file: 'y.cjs',
      description: 'wave issue', source: 'bug-hunt',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const result = execSync(
      `echo '${issue}' | node "${CLI_PATH}" review log-issue ${SET_ID} wave-1`,
      { cwd: tmpDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const parsed = parseOutput(result);
    assert.strictEqual(parsed.logged, true);

    const issuesPath = path.join(tmpDir, '.planning', 'sets', SET_ID, 'REVIEW-ISSUES.json');
    const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    const issue2 = data.issues[0];
    assert.strictEqual(issue2.originatingWave, 'wave-1');
  });

  it('--post-merge flag works with CLI flags', () => {
    const result = execSync(
      `node "${CLI_PATH}" review log-issue ${SET_ID} --type bug --severity high --file src/foo.cjs --description "post-merge bug" --source bug-hunt --post-merge`,
      { cwd: tmpDir, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const parsed = parseOutput(result);
    assert.strictEqual(parsed.logged, true);
    assert.strictEqual(parsed.postMerge, true);

    // Should be in post-merge directory, not sets directory
    const postMergePath = path.join(tmpDir, '.planning', 'post-merge', SET_ID, 'REVIEW-ISSUES.json');
    assert.ok(fs.existsSync(postMergePath), 'post-merge REVIEW-ISSUES.json should exist');

    const setsPath = path.join(tmpDir, '.planning', 'sets', SET_ID, 'REVIEW-ISSUES.json');
    assert.ok(!fs.existsSync(setsPath), 'sets REVIEW-ISSUES.json should NOT exist');
  });
});
