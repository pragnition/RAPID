'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const review = require('./review.cjs');

// ────────────────────────────────────────────────────────────────
// Helper: create a tmp directory for test isolation
// ────────────────────────────────────────────────────────────────
function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-review-'));
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ────────────────────────────────────────────────────────────────
// Zod Schema Tests
// ────────────────────────────────────────────────────────────────

describe('ReviewIssue schema', () => {
  it('validates a correct issue object', () => {
    const issue = {
      id: 'I-001',
      type: 'bug',
      severity: 'high',
      file: 'src/auth.cjs',
      description: 'Missing null check on token parse',
      source: 'bug-hunt',
      status: 'open',
      createdAt: '2026-03-08T10:00:00Z',
    };
    const result = review.ReviewIssue.parse(issue);
    assert.equal(result.id, 'I-001');
    assert.equal(result.type, 'bug');
    assert.equal(result.severity, 'high');
    assert.equal(result.autoFixAttempted, false);
    assert.equal(result.autoFixSucceeded, false);
    assert.equal(result.status, 'open');
  });

  it('rejects issue with missing required fields', () => {
    assert.throws(() => {
      review.ReviewIssue.parse({ id: 'I-002' });
    });
  });

  it('rejects issue with invalid enum values', () => {
    assert.throws(() => {
      review.ReviewIssue.parse({
        id: 'I-003',
        type: 'invalid-type',
        severity: 'extreme',
        file: 'foo.cjs',
        description: 'test',
        source: 'unknown-source',
        status: 'pending',
        createdAt: '2026-03-08',
      });
    });
  });

  it('accepts optional line and fixedAt fields', () => {
    const issue = {
      id: 'I-004',
      type: 'artifact',
      severity: 'low',
      file: 'src/index.cjs',
      line: 42,
      description: 'Missing export',
      source: 'lean-review',
      status: 'fixed',
      createdAt: '2026-03-08T10:00:00Z',
      fixedAt: '2026-03-08T11:00:00Z',
    };
    const result = review.ReviewIssue.parse(issue);
    assert.equal(result.line, 42);
    assert.equal(result.fixedAt, '2026-03-08T11:00:00Z');
  });
});

describe('ReviewIssues schema', () => {
  it('validates container with waveId, setId, issues array, lastUpdatedAt', () => {
    const container = {
      waveId: 'wave-1',
      setId: 'auth-core',
      issues: [
        {
          id: 'I-001',
          type: 'bug',
          severity: 'high',
          file: 'src/auth.cjs',
          description: 'test',
          source: 'bug-hunt',
          status: 'open',
          createdAt: '2026-03-08T10:00:00Z',
        },
      ],
      lastUpdatedAt: '2026-03-08T10:00:00Z',
    };
    const result = review.ReviewIssues.parse(container);
    assert.equal(result.waveId, 'wave-1');
    assert.equal(result.setId, 'auth-core');
    assert.equal(result.issues.length, 1);
    assert.equal(result.lastUpdatedAt, '2026-03-08T10:00:00Z');
  });
});

// ────────────────────────────────────────────────────────────────
// Scoping Function Tests
// ────────────────────────────────────────────────────────────────

describe('scopeWaveForReview', () => {
  it('returns changedFiles, dependentFiles, totalFiles by calling getChangedFiles and findDependents', () => {
    // This test uses a temporary project structure.
    // We test findDependents separately; here we verify the shape of the result.
    // scopeWaveForReview requires a git worktree which is hard to mock,
    // so we test the return shape by calling with a fake path that
    // getChangedFiles returns [] for.
    const tmpDir = createTmpDir();
    try {
      // scopeWaveForReview calls execute.getChangedFiles which calls gitExec
      // With a non-git dir it returns []. That's fine for shape testing.
      const result = review.scopeWaveForReview(tmpDir, tmpDir, 'main');
      assert.ok(Array.isArray(result.changedFiles));
      assert.ok(Array.isArray(result.dependentFiles));
      assert.equal(typeof result.totalFiles, 'number');
      assert.equal(result.totalFiles, result.changedFiles.length + result.dependentFiles.length);
    } finally {
      cleanupDir(tmpDir);
    }
  });
});

describe('findDependents', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('finds files that import/require any of the given changed files', () => {
    // Create a project with files that have dependencies
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // changed file
    fs.writeFileSync(path.join(srcDir, 'utils.cjs'), 'module.exports = { add: (a, b) => a + b };\n');

    // file that depends on utils.cjs
    fs.writeFileSync(path.join(srcDir, 'app.cjs'), "const utils = require('./utils.cjs');\nconsole.log(utils.add(1, 2));\n");

    // file with no dependency
    fs.writeFileSync(path.join(srcDir, 'standalone.cjs'), 'console.log("hello");\n');

    const dependents = review.findDependents(tmpDir, ['src/utils.cjs']);
    assert.ok(dependents.includes('src/app.cjs'), 'Should find app.cjs as dependent of utils.cjs');
    assert.ok(!dependents.includes('src/standalone.cjs'), 'Should NOT include standalone.cjs');
  });

  it('returns empty array when no dependents exist', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'orphan.cjs'), 'module.exports = {};\n');

    const dependents = review.findDependents(tmpDir, ['src/orphan.cjs']);
    assert.deepStrictEqual(dependents, []);
  });

  it('excludes files already in the changedFiles list', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    fs.writeFileSync(path.join(srcDir, 'a.cjs'), "const b = require('./b.cjs');\n");
    fs.writeFileSync(path.join(srcDir, 'b.cjs'), "const a = require('./a.cjs');\n");

    // Both files reference each other; if both are changed, neither should appear in dependents
    const dependents = review.findDependents(tmpDir, ['src/a.cjs', 'src/b.cjs']);
    assert.ok(!dependents.includes('src/a.cjs'));
    assert.ok(!dependents.includes('src/b.cjs'));
  });
});

// ────────────────────────────────────────────────────────────────
// Issue Management Tests
// ────────────────────────────────────────────────────────────────

describe('logIssue', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('creates REVIEW-ISSUES.json if not exists, appends issue, validates with Zod', () => {
    const issue = {
      id: 'I-001',
      type: 'bug',
      severity: 'high',
      file: 'src/auth.cjs',
      description: 'Missing null check',
      source: 'bug-hunt',
      status: 'open',
      createdAt: '2026-03-08T10:00:00Z',
    };

    review.logIssue(tmpDir, 'auth-core', 'wave-1', issue);

    const issuesPath = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-1', 'REVIEW-ISSUES.json');
    assert.ok(fs.existsSync(issuesPath), 'REVIEW-ISSUES.json should be created');

    const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    assert.equal(data.waveId, 'wave-1');
    assert.equal(data.setId, 'auth-core');
    assert.equal(data.issues.length, 1);
    assert.equal(data.issues[0].id, 'I-001');
    assert.ok(data.lastUpdatedAt);
  });

  it('appends to existing REVIEW-ISSUES.json without losing prior issues', () => {
    const issue1 = {
      id: 'I-001',
      type: 'bug',
      severity: 'high',
      file: 'src/a.cjs',
      description: 'First issue',
      source: 'bug-hunt',
      status: 'open',
      createdAt: '2026-03-08T10:00:00Z',
    };
    const issue2 = {
      id: 'I-002',
      type: 'artifact',
      severity: 'medium',
      file: 'src/b.cjs',
      description: 'Second issue',
      source: 'lean-review',
      status: 'open',
      createdAt: '2026-03-08T11:00:00Z',
    };

    review.logIssue(tmpDir, 'auth-core', 'wave-1', issue1);
    review.logIssue(tmpDir, 'auth-core', 'wave-1', issue2);

    const issuesPath = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-1', 'REVIEW-ISSUES.json');
    const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    assert.equal(data.issues.length, 2);
    assert.equal(data.issues[0].id, 'I-001');
    assert.equal(data.issues[1].id, 'I-002');
  });
});

describe('loadSetIssues', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('aggregates issues across all wave directories for a set', () => {
    // Set up wave-1 issues
    const wave1Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-1');
    fs.mkdirSync(wave1Dir, { recursive: true });
    fs.writeFileSync(path.join(wave1Dir, 'REVIEW-ISSUES.json'), JSON.stringify({
      waveId: 'wave-1',
      setId: 'auth-core',
      issues: [
        { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'bug1', source: 'bug-hunt', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    // Set up wave-2 issues
    const wave2Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-2');
    fs.mkdirSync(wave2Dir, { recursive: true });
    fs.writeFileSync(path.join(wave2Dir, 'REVIEW-ISSUES.json'), JSON.stringify({
      waveId: 'wave-2',
      setId: 'auth-core',
      issues: [
        { id: 'I-002', type: 'test', severity: 'medium', file: 'b.cjs', description: 'test fail', source: 'unit-test', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
        { id: 'I-003', type: 'uat', severity: 'low', file: 'c.cjs', description: 'uat issue', source: 'uat', status: 'fixed', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false, fixedAt: '2026-03-08' },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    const issues = review.loadSetIssues(tmpDir, 'auth-core');
    assert.equal(issues.length, 3);
    // Each issue should have a waveId attached
    const wave1Issues = issues.filter(i => i.waveId === 'wave-1');
    const wave2Issues = issues.filter(i => i.waveId === 'wave-2');
    assert.equal(wave1Issues.length, 1);
    assert.equal(wave2Issues.length, 2);
  });

  it('returns empty array when no issues exist', () => {
    const issues = review.loadSetIssues(tmpDir, 'nonexistent-set');
    assert.deepStrictEqual(issues, []);
  });
});

describe('updateIssueStatus', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('finds issue by id and updates status + fixedAt timestamp', () => {
    // Set up existing issues
    const waveDir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-1');
    fs.mkdirSync(waveDir, { recursive: true });
    fs.writeFileSync(path.join(waveDir, 'REVIEW-ISSUES.json'), JSON.stringify({
      waveId: 'wave-1',
      setId: 'auth-core',
      issues: [
        { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'bug', source: 'bug-hunt', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
        { id: 'I-002', type: 'test', severity: 'medium', file: 'b.cjs', description: 'test', source: 'unit-test', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    review.updateIssueStatus(tmpDir, 'auth-core', 'wave-1', 'I-001', 'fixed');

    const data = JSON.parse(fs.readFileSync(path.join(waveDir, 'REVIEW-ISSUES.json'), 'utf-8'));
    const issue = data.issues.find(i => i.id === 'I-001');
    assert.equal(issue.status, 'fixed');
    assert.ok(issue.fixedAt, 'fixedAt should be set when status is fixed');

    // Other issue should be unchanged
    const other = data.issues.find(i => i.id === 'I-002');
    assert.equal(other.status, 'open');
  });
});

// ────────────────────────────────────────────────────────────────
// Constants Tests
// ────────────────────────────────────────────────────────────────

describe('REVIEW_CONSTANTS', () => {
  it('MAX_BUGFIX_CYCLES equals 3', () => {
    assert.equal(review.REVIEW_CONSTANTS.MAX_BUGFIX_CYCLES, 3);
  });

  it('ISSUE_TYPES contains all 6 types', () => {
    const expected = ['artifact', 'static', 'contract', 'test', 'bug', 'uat'];
    assert.deepStrictEqual(review.REVIEW_CONSTANTS.ISSUE_TYPES, expected);
  });

  it('SEVERITY_LEVELS contains 4 levels', () => {
    const expected = ['critical', 'high', 'medium', 'low'];
    assert.deepStrictEqual(review.REVIEW_CONSTANTS.SEVERITY_LEVELS, expected);
  });
});

// ────────────────────────────────────────────────────────────────
// Summary Generation Tests
// ────────────────────────────────────────────────────────────────

describe('generateReviewSummary', () => {
  it('produces markdown with issue counts by type and status', () => {
    const issues = [
      { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'bug1', source: 'bug-hunt', status: 'open', createdAt: '2026-03-08', waveId: 'wave-1', autoFixAttempted: false, autoFixSucceeded: false },
      { id: 'I-002', type: 'bug', severity: 'critical', file: 'b.cjs', description: 'bug2', source: 'bug-hunt', status: 'fixed', createdAt: '2026-03-08', waveId: 'wave-1', autoFixAttempted: false, autoFixSucceeded: false, fixedAt: '2026-03-08' },
      { id: 'I-003', type: 'test', severity: 'medium', file: 'c.cjs', description: 'test1', source: 'unit-test', status: 'deferred', createdAt: '2026-03-08', waveId: 'wave-2', autoFixAttempted: false, autoFixSucceeded: false },
      { id: 'I-004', type: 'artifact', severity: 'low', file: 'd.cjs', description: 'art1', source: 'lean-review', status: 'dismissed', createdAt: '2026-03-08', waveId: 'wave-2', autoFixAttempted: false, autoFixSucceeded: false },
      { id: 'I-005', type: 'uat', severity: 'medium', file: 'e.cjs', description: 'uat1', source: 'uat', status: 'open', createdAt: '2026-03-08', waveId: 'wave-2', autoFixAttempted: false, autoFixSucceeded: false },
      { id: 'I-006', type: 'contract', severity: 'high', file: 'f.cjs', description: 'cont1', source: 'lean-review', status: 'deferred', createdAt: '2026-03-08', waveId: 'wave-1', autoFixAttempted: false, autoFixSucceeded: false },
    ];

    const summary = review.generateReviewSummary('auth-core', issues);
    assert.equal(typeof summary, 'string');

    // Should contain overview with total issues
    assert.ok(summary.includes('6'), 'Should mention total issue count');

    // Should contain severity counts
    assert.ok(summary.includes('critical'), 'Should mention critical severity');
    assert.ok(summary.includes('high'), 'Should mention high severity');

    // Should contain status breakdown
    assert.ok(summary.includes('open'), 'Should show open issues');
    assert.ok(summary.includes('fixed'), 'Should show fixed issues');
    assert.ok(summary.includes('deferred'), 'Should show deferred issues');
    assert.ok(summary.includes('dismissed'), 'Should show dismissed issues');

    // Should contain per-wave breakdown
    assert.ok(summary.includes('wave-1'), 'Should break down by wave');
    assert.ok(summary.includes('wave-2'), 'Should break down by wave');

    // Should show deferred warning when >5 deferred (we have 2, so no warning)
    // We'll just check that the summary is valid markdown
    assert.ok(summary.includes('#'), 'Should be markdown with headings');
  });

  it('shows deferred count warning when more than 5 deferred', () => {
    const issues = [];
    for (let i = 1; i <= 8; i++) {
      issues.push({
        id: `I-${String(i).padStart(3, '0')}`,
        type: 'bug',
        severity: 'medium',
        file: `file${i}.cjs`,
        description: `deferred issue ${i}`,
        source: 'bug-hunt',
        status: 'deferred',
        createdAt: '2026-03-08',
        waveId: 'wave-1',
        autoFixAttempted: false,
        autoFixSucceeded: false,
      });
    }

    const summary = review.generateReviewSummary('auth-core', issues);
    // Should contain a warning about deferred count
    assert.ok(
      summary.toLowerCase().includes('warning') || summary.toLowerCase().includes('deferred'),
      'Should warn about high deferred count'
    );
    assert.ok(summary.includes('8'), 'Should mention the deferred count');
  });
});
