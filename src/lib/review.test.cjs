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

  it('accepts optional originatingWave field', () => {
    const issue = {
      id: 'I-005',
      type: 'bug',
      severity: 'high',
      file: 'src/auth.cjs',
      description: 'Test with wave attribution',
      source: 'bug-hunt',
      status: 'open',
      createdAt: '2026-03-08T10:00:00Z',
      originatingWave: 'wave-1',
    };
    const result = review.ReviewIssue.parse(issue);
    assert.equal(result.originatingWave, 'wave-1');
  });

  it('succeeds without originatingWave (backward compat)', () => {
    const issue = {
      id: 'I-006',
      type: 'bug',
      severity: 'high',
      file: 'src/auth.cjs',
      description: 'No wave attribution',
      source: 'bug-hunt',
      status: 'open',
      createdAt: '2026-03-08T10:00:00Z',
    };
    const result = review.ReviewIssue.parse(issue);
    assert.equal(result.originatingWave, undefined);
  });
});

describe('ReviewIssues schema', () => {
  it('validates container with setId, issues array, lastUpdatedAt (no waveId)', () => {
    const container = {
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
    assert.equal(result.setId, 'auth-core');
    assert.equal(result.issues.length, 1);
    assert.equal(result.lastUpdatedAt, '2026-03-08T10:00:00Z');
  });

  it('rejects container with waveId field (waveId removed from schema)', () => {
    const container = {
      waveId: 'wave-1',
      setId: 'auth-core',
      issues: [],
      lastUpdatedAt: '2026-03-08T10:00:00Z',
    };
    // With strict mode, extra keys are stripped. The key test is that
    // the parsed result does NOT have waveId on it.
    const result = review.ReviewIssues.parse(container);
    assert.equal(result.waveId, undefined, 'waveId should not be in parsed result');
  });
});

// ────────────────────────────────────────────────────────────────
// Scoping Function Tests
// ────────────────────────────────────────────────────────────────

describe('scopeSetForReview', () => {
  it('is exported as scopeSetForReview (not scopeWaveForReview)', () => {
    assert.equal(typeof review.scopeSetForReview, 'function', 'scopeSetForReview should be exported');
    assert.equal(review.scopeWaveForReview, undefined, 'scopeWaveForReview should NOT be exported');
  });

  it('returns changedFiles, dependentFiles, totalFiles', () => {
    const tmpDir = createTmpDir();
    try {
      const result = review.scopeSetForReview(tmpDir, tmpDir, 'main');
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
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    fs.writeFileSync(path.join(srcDir, 'utils.cjs'), 'module.exports = { add: (a, b) => a + b };\n');
    fs.writeFileSync(path.join(srcDir, 'app.cjs'), "const utils = require('./utils.cjs');\nconsole.log(utils.add(1, 2));\n");
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

    const dependents = review.findDependents(tmpDir, ['src/a.cjs', 'src/b.cjs']);
    assert.ok(!dependents.includes('src/a.cjs'));
    assert.ok(!dependents.includes('src/b.cjs'));
  });
});

// ────────────────────────────────────────────────────────────────
// chunkByDirectory Tests (NEW)
// ────────────────────────────────────────────────────────────────

describe('chunkByDirectory', () => {
  it('returns single chunk with dir "." when files <= CHUNK_THRESHOLD (15)', () => {
    const files = Array.from({ length: 10 }, (_, i) => `src/lib/file${i}.cjs`);
    const chunks = review.chunkByDirectory(files);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].dir, '.');
    assert.deepStrictEqual(chunks[0].files, files);
  });

  it('returns single chunk at threshold boundary (exactly 15 files)', () => {
    const files = Array.from({ length: 15 }, (_, i) => `src/lib/file${i}.cjs`);
    const chunks = review.chunkByDirectory(files);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].dir, '.');
  });

  it('chunks files by parent directory when count > 15 across 3 directories', () => {
    const files = [
      ...Array.from({ length: 6 }, (_, i) => `src/lib/file${i}.cjs`),
      ...Array.from({ length: 6 }, (_, i) => `src/modules/mod${i}.cjs`),
      ...Array.from({ length: 5 }, (_, i) => `src/routes/route${i}.cjs`),
    ];
    // 17 files > 15, across 3 dirs each with >= 3 files
    const chunks = review.chunkByDirectory(files);
    assert.equal(chunks.length, 3);
    const dirs = chunks.map(c => c.dir).sort();
    assert.deepStrictEqual(dirs, ['src/lib', 'src/modules', 'src/routes']);
  });

  it('merges small directories (< 3 files) into the last large chunk', () => {
    const files = [
      ...Array.from({ length: 8 }, (_, i) => `src/lib/file${i}.cjs`),
      ...Array.from({ length: 5 }, (_, i) => `src/modules/mod${i}.cjs`),
      'src/tiny/one.cjs',
      'src/tiny/two.cjs',
      'src/other/single.cjs',
    ];
    // 16 files > 15; src/tiny has 2 files (< 3), src/other has 1 file (< 3)
    const chunks = review.chunkByDirectory(files);

    // Should have 2 large chunks (src/lib and src/modules), with small dirs merged
    const largeDirs = chunks.filter(c => c.dir === 'src/lib' || c.dir === 'src/modules');
    assert.equal(largeDirs.length, 2, 'Should have 2 large directory chunks');

    // Small directory files should be merged into the last large chunk
    const allChunkedFiles = chunks.flatMap(c => c.files);
    assert.ok(allChunkedFiles.includes('src/tiny/one.cjs'), 'Small dir files should be included');
    assert.ok(allChunkedFiles.includes('src/other/single.cjs'), 'Small dir files should be included');
    assert.equal(allChunkedFiles.length, files.length, 'All files should be in chunks');
  });

  it('returns single chunk when all files in one directory but > 15', () => {
    const files = Array.from({ length: 20 }, (_, i) => `src/lib/file${i}.cjs`);
    const chunks = review.chunkByDirectory(files);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].dir, 'src/lib');
    assert.equal(chunks[0].files.length, 20);
  });

  it('returns [{dir: ".", files: []}] for empty files array', () => {
    const chunks = review.chunkByDirectory([]);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].dir, '.');
    assert.deepStrictEqual(chunks[0].files, []);
  });

  it('handles only small directories (all < 3 files, total > 15)', () => {
    // 8 directories with 2 files each = 16 > 15
    const files = [];
    for (let d = 0; d < 8; d++) {
      files.push(`dir${d}/a.cjs`, `dir${d}/b.cjs`);
    }
    const chunks = review.chunkByDirectory(files);
    // All are small (< 3), so all merge into one overflow chunk
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].dir, '.');
    assert.equal(chunks[0].files.length, 16);
  });
});

// ────────────────────────────────────────────────────────────────
// buildWaveAttribution Tests (NEW)
// ────────────────────────────────────────────────────────────────

describe('buildWaveAttribution', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('reads JOB-PLAN.md files and returns file-to-wave map', () => {
    const wave1Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-1');
    fs.mkdirSync(wave1Dir, { recursive: true });
    fs.writeFileSync(path.join(wave1Dir, '01-JOB-PLAN.md'), `
# Job Plan

## Files to Create/Modify

| File | Action |
|------|--------|
| \`src/lib/auth.cjs\` | Create |
| \`src/lib/token.cjs\` | Modify |
`);

    const wave2Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-2');
    fs.mkdirSync(wave2Dir, { recursive: true });
    fs.writeFileSync(path.join(wave2Dir, '01-JOB-PLAN.md'), `
# Job Plan

## Files to Create/Modify

| File | Action |
|------|--------|
| \`src/lib/session.cjs\` | Create |
`);

    const attribution = review.buildWaveAttribution(tmpDir, 'auth-core');
    assert.equal(attribution['src/lib/auth.cjs'], 'wave-1');
    assert.equal(attribution['src/lib/token.cjs'], 'wave-1');
    assert.equal(attribution['src/lib/session.cjs'], 'wave-2');
  });

  it('last wave wins when file appears in multiple waves', () => {
    const wave1Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-1');
    fs.mkdirSync(wave1Dir, { recursive: true });
    fs.writeFileSync(path.join(wave1Dir, '01-JOB-PLAN.md'), `
| File | Action |
|------|--------|
| \`src/shared.cjs\` | Create |
`);

    const wave2Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-2');
    fs.mkdirSync(wave2Dir, { recursive: true });
    fs.writeFileSync(path.join(wave2Dir, '01-JOB-PLAN.md'), `
| File | Action |
|------|--------|
| \`src/shared.cjs\` | Modify |
`);

    const attribution = review.buildWaveAttribution(tmpDir, 'auth-core');
    assert.equal(attribution['src/shared.cjs'], 'wave-2', 'Last wave should win');
  });

  it('returns empty object when wavesDir does not exist', () => {
    const attribution = review.buildWaveAttribution(tmpDir, 'nonexistent-set');
    assert.deepStrictEqual(attribution, {});
  });

  it('skips malformed plan files gracefully', () => {
    const wave1Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-1');
    fs.mkdirSync(wave1Dir, { recursive: true });
    // Write a plan file with no valid table entries
    fs.writeFileSync(path.join(wave1Dir, '01-JOB-PLAN.md'), `
# Just a title, no table
Some random content here
`);

    const attribution = review.buildWaveAttribution(tmpDir, 'auth-core');
    assert.deepStrictEqual(attribution, {});
  });

  it('handles multiple plan files in a single wave', () => {
    const wave1Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-1');
    fs.mkdirSync(wave1Dir, { recursive: true });
    fs.writeFileSync(path.join(wave1Dir, '01-JOB-PLAN.md'), `
| File | Action |
|------|--------|
| \`src/a.cjs\` | Create |
`);
    fs.writeFileSync(path.join(wave1Dir, '02-JOB-PLAN.md'), `
| File | Action |
|------|--------|
| \`src/b.cjs\` | Create |
`);

    const attribution = review.buildWaveAttribution(tmpDir, 'auth-core');
    assert.equal(attribution['src/a.cjs'], 'wave-1');
    assert.equal(attribution['src/b.cjs'], 'wave-1');
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

  it('creates REVIEW-ISSUES.json at set level (not wave subdirectory)', () => {
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

    review.logIssue(tmpDir, 'auth-core', issue);

    // Should be at set level, NOT wave subdirectory
    const setLevelPath = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'REVIEW-ISSUES.json');
    assert.ok(fs.existsSync(setLevelPath), 'REVIEW-ISSUES.json should be at set level');

    const data = JSON.parse(fs.readFileSync(setLevelPath, 'utf-8'));
    assert.equal(data.setId, 'auth-core');
    assert.equal(data.waveId, undefined, 'Container should NOT have waveId');
    assert.equal(data.issues.length, 1);
    assert.equal(data.issues[0].id, 'I-001');
    assert.ok(data.lastUpdatedAt);
  });

  it('accepts 3 params (cwd, setId, issue) not 4', () => {
    // logIssue should work with exactly 3 arguments
    const issue = {
      id: 'I-010',
      type: 'bug',
      severity: 'low',
      file: 'src/test.cjs',
      description: 'Test 3-param signature',
      source: 'lean-review',
      status: 'open',
      createdAt: '2026-03-08T10:00:00Z',
    };

    // Should not throw with 3 params
    assert.doesNotThrow(() => {
      review.logIssue(tmpDir, 'test-set', issue);
    });
  });

  it('preserves originatingWave on the issue when provided', () => {
    const issue = {
      id: 'I-011',
      type: 'bug',
      severity: 'high',
      file: 'src/auth.cjs',
      description: 'With wave attribution',
      source: 'bug-hunt',
      status: 'open',
      createdAt: '2026-03-08T10:00:00Z',
      originatingWave: 'wave-2',
    };

    review.logIssue(tmpDir, 'auth-core', issue);

    const setLevelPath = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'REVIEW-ISSUES.json');
    const data = JSON.parse(fs.readFileSync(setLevelPath, 'utf-8'));
    assert.equal(data.issues[0].originatingWave, 'wave-2');
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

    review.logIssue(tmpDir, 'auth-core', issue1);
    review.logIssue(tmpDir, 'auth-core', issue2);

    const setLevelPath = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'REVIEW-ISSUES.json');
    const data = JSON.parse(fs.readFileSync(setLevelPath, 'utf-8'));
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

  it('reads set-level REVIEW-ISSUES.json', () => {
    const setDir = path.join(tmpDir, '.planning', 'waves', 'auth-core');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'REVIEW-ISSUES.json'), JSON.stringify({
      setId: 'auth-core',
      issues: [
        { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'bug1', source: 'bug-hunt', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false, originatingWave: 'wave-1' },
        { id: 'I-002', type: 'test', severity: 'medium', file: 'b.cjs', description: 'test1', source: 'unit-test', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false, originatingWave: 'wave-2' },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    const issues = review.loadSetIssues(tmpDir, 'auth-core');
    assert.equal(issues.length, 2);
    assert.equal(issues[0].originatingWave, 'wave-1');
    assert.equal(issues[1].originatingWave, 'wave-2');
  });

  it('falls back to reading wave subdirectories for legacy compatibility', () => {
    // Set up legacy wave-level REVIEW-ISSUES.json files (from lean review)
    const wave1Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-1');
    fs.mkdirSync(wave1Dir, { recursive: true });
    fs.writeFileSync(path.join(wave1Dir, 'REVIEW-ISSUES.json'), JSON.stringify({
      waveId: 'wave-1',
      setId: 'auth-core',
      issues: [
        { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'bug1', source: 'lean-review', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    const wave2Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-2');
    fs.mkdirSync(wave2Dir, { recursive: true });
    fs.writeFileSync(path.join(wave2Dir, 'REVIEW-ISSUES.json'), JSON.stringify({
      waveId: 'wave-2',
      setId: 'auth-core',
      issues: [
        { id: 'I-002', type: 'test', severity: 'medium', file: 'b.cjs', description: 'test fail', source: 'lean-review', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    const issues = review.loadSetIssues(tmpDir, 'auth-core');
    assert.equal(issues.length, 2);
    // Legacy issues should have originatingWave set from directory name
    const wave1Issues = issues.filter(i => i.originatingWave === 'wave-1');
    const wave2Issues = issues.filter(i => i.originatingWave === 'wave-2');
    assert.equal(wave1Issues.length, 1);
    assert.equal(wave2Issues.length, 1);
  });

  it('aggregates both set-level and legacy wave-level issues', () => {
    // Set-level issues
    const setDir = path.join(tmpDir, '.planning', 'waves', 'auth-core');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'REVIEW-ISSUES.json'), JSON.stringify({
      setId: 'auth-core',
      issues: [
        { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'set-level', source: 'bug-hunt', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false, originatingWave: 'wave-1' },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    // Legacy wave-level issues
    const wave2Dir = path.join(tmpDir, '.planning', 'waves', 'auth-core', 'wave-2');
    fs.mkdirSync(wave2Dir, { recursive: true });
    fs.writeFileSync(path.join(wave2Dir, 'REVIEW-ISSUES.json'), JSON.stringify({
      waveId: 'wave-2',
      setId: 'auth-core',
      issues: [
        { id: 'I-002', type: 'test', severity: 'medium', file: 'b.cjs', description: 'legacy', source: 'lean-review', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    const issues = review.loadSetIssues(tmpDir, 'auth-core');
    assert.equal(issues.length, 2, 'Should aggregate both set-level and wave-level issues');
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

  it('accepts 4 params (cwd, setId, issueId, newStatus) not 5', () => {
    // Set up set-level REVIEW-ISSUES.json
    const setDir = path.join(tmpDir, '.planning', 'waves', 'auth-core');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'REVIEW-ISSUES.json'), JSON.stringify({
      setId: 'auth-core',
      issues: [
        { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'bug', source: 'bug-hunt', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    // 4-param call: cwd, setId, issueId, newStatus (no waveId)
    review.updateIssueStatus(tmpDir, 'auth-core', 'I-001', 'fixed');

    const data = JSON.parse(fs.readFileSync(path.join(setDir, 'REVIEW-ISSUES.json'), 'utf-8'));
    const issue = data.issues.find(i => i.id === 'I-001');
    assert.equal(issue.status, 'fixed');
    assert.ok(issue.fixedAt, 'fixedAt should be set when status is fixed');
  });

  it('reads from set-level REVIEW-ISSUES.json (not wave subdirectory)', () => {
    const setDir = path.join(tmpDir, '.planning', 'waves', 'auth-core');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'REVIEW-ISSUES.json'), JSON.stringify({
      setId: 'auth-core',
      issues: [
        { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'bug', source: 'bug-hunt', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
        { id: 'I-002', type: 'test', severity: 'medium', file: 'b.cjs', description: 'test', source: 'unit-test', status: 'open', createdAt: '2026-03-08', autoFixAttempted: false, autoFixSucceeded: false },
      ],
      lastUpdatedAt: '2026-03-08',
    }));

    review.updateIssueStatus(tmpDir, 'auth-core', 'I-001', 'dismissed');

    const data = JSON.parse(fs.readFileSync(path.join(setDir, 'REVIEW-ISSUES.json'), 'utf-8'));
    assert.equal(data.issues.find(i => i.id === 'I-001').status, 'dismissed');
    assert.equal(data.issues.find(i => i.id === 'I-002').status, 'open');
  });

  it('throws when issue not found', () => {
    const setDir = path.join(tmpDir, '.planning', 'waves', 'auth-core');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'REVIEW-ISSUES.json'), JSON.stringify({
      setId: 'auth-core',
      issues: [],
      lastUpdatedAt: '2026-03-08',
    }));

    assert.throws(() => {
      review.updateIssueStatus(tmpDir, 'auth-core', 'I-999', 'fixed');
    }, /I-999/);
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

  it('CHUNK_THRESHOLD equals 15', () => {
    assert.equal(review.REVIEW_CONSTANTS.CHUNK_THRESHOLD, 15);
  });
});

// ────────────────────────────────────────────────────────────────
// Summary Generation Tests
// ────────────────────────────────────────────────────────────────

describe('generateReviewSummary', () => {
  it('groups by originatingWave instead of waveId for per-wave breakdown', () => {
    const issues = [
      { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'bug1', source: 'bug-hunt', status: 'open', createdAt: '2026-03-08', originatingWave: 'wave-1', autoFixAttempted: false, autoFixSucceeded: false },
      { id: 'I-002', type: 'bug', severity: 'critical', file: 'b.cjs', description: 'bug2', source: 'bug-hunt', status: 'fixed', createdAt: '2026-03-08', originatingWave: 'wave-1', autoFixAttempted: false, autoFixSucceeded: false, fixedAt: '2026-03-08' },
      { id: 'I-003', type: 'test', severity: 'medium', file: 'c.cjs', description: 'test1', source: 'unit-test', status: 'deferred', createdAt: '2026-03-08', originatingWave: 'wave-2', autoFixAttempted: false, autoFixSucceeded: false },
    ];

    const summary = review.generateReviewSummary('auth-core', issues);
    assert.ok(summary.includes('wave-1'), 'Should break down by originatingWave');
    assert.ok(summary.includes('wave-2'), 'Should break down by originatingWave');
  });

  it('produces markdown with issue counts by type and status', () => {
    const issues = [
      { id: 'I-001', type: 'bug', severity: 'high', file: 'a.cjs', description: 'bug1', source: 'bug-hunt', status: 'open', createdAt: '2026-03-08', originatingWave: 'wave-1', autoFixAttempted: false, autoFixSucceeded: false },
      { id: 'I-002', type: 'bug', severity: 'critical', file: 'b.cjs', description: 'bug2', source: 'bug-hunt', status: 'fixed', createdAt: '2026-03-08', originatingWave: 'wave-1', autoFixAttempted: false, autoFixSucceeded: false, fixedAt: '2026-03-08' },
      { id: 'I-003', type: 'test', severity: 'medium', file: 'c.cjs', description: 'test1', source: 'unit-test', status: 'deferred', createdAt: '2026-03-08', originatingWave: 'wave-2', autoFixAttempted: false, autoFixSucceeded: false },
      { id: 'I-004', type: 'artifact', severity: 'low', file: 'd.cjs', description: 'art1', source: 'lean-review', status: 'dismissed', createdAt: '2026-03-08', originatingWave: 'wave-2', autoFixAttempted: false, autoFixSucceeded: false },
      { id: 'I-005', type: 'uat', severity: 'medium', file: 'e.cjs', description: 'uat1', source: 'uat', status: 'open', createdAt: '2026-03-08', originatingWave: 'wave-2', autoFixAttempted: false, autoFixSucceeded: false },
      { id: 'I-006', type: 'contract', severity: 'high', file: 'f.cjs', description: 'cont1', source: 'lean-review', status: 'deferred', createdAt: '2026-03-08', originatingWave: 'wave-1', autoFixAttempted: false, autoFixSucceeded: false },
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

    // Should contain per-wave breakdown using originatingWave
    assert.ok(summary.includes('wave-1'), 'Should break down by originatingWave');
    assert.ok(summary.includes('wave-2'), 'Should break down by originatingWave');

    // Should be markdown with headings
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
        originatingWave: 'wave-1',
        autoFixAttempted: false,
        autoFixSucceeded: false,
      });
    }

    const summary = review.generateReviewSummary('auth-core', issues);
    assert.ok(
      summary.toLowerCase().includes('warning') || summary.toLowerCase().includes('deferred'),
      'Should warn about high deferred count'
    );
    assert.ok(summary.includes('8'), 'Should mention the deferred count');
  });
});

// ────────────────────────────────────────────────────────────────
// ScoperOutput Schema Tests
// ────────────────────────────────────────────────────────────────

describe('ScoperOutput schema', () => {
  it('validates correct scoper output JSON', () => {
    const output = {
      concerns: [
        {
          name: 'state-logic',
          files: ['src/lib/state.cjs', 'src/lib/transitions.cjs'],
          rationale: {
            'src/lib/state.cjs': 'Core state management',
            'src/lib/transitions.cjs': 'Transition table definitions',
          },
        },
      ],
      crossCutting: [
        { file: 'src/lib/utils.cjs', rationale: 'Shared utilities' },
      ],
      totalFiles: 3,
      concernCount: 1,
      crossCuttingCount: 1,
    };
    const result = review.ScoperOutput.parse(output);
    assert.equal(result.concerns.length, 1);
    assert.equal(result.concerns[0].name, 'state-logic');
    assert.equal(result.crossCutting.length, 1);
    assert.equal(result.totalFiles, 3);
    assert.equal(result.concernCount, 1);
    assert.equal(result.crossCuttingCount, 1);
  });

  it('rejects missing required fields', () => {
    assert.throws(() => {
      review.ScoperOutput.parse({ concerns: [] });
    });
  });

  it('validates empty concerns and crossCutting arrays', () => {
    const output = {
      concerns: [],
      crossCutting: [],
      totalFiles: 0,
      concernCount: 0,
      crossCuttingCount: 0,
    };
    const result = review.ScoperOutput.parse(output);
    assert.deepStrictEqual(result.concerns, []);
    assert.deepStrictEqual(result.crossCutting, []);
  });

  it('validates multiple concerns with rationale records', () => {
    const output = {
      concerns: [
        {
          name: 'cli',
          files: ['src/bin/cli.cjs'],
          rationale: { 'src/bin/cli.cjs': 'CLI entry point' },
        },
        {
          name: 'lib',
          files: ['src/lib/review.cjs'],
          rationale: { 'src/lib/review.cjs': 'Review library' },
        },
      ],
      crossCutting: [],
      totalFiles: 2,
      concernCount: 2,
      crossCuttingCount: 0,
    };
    const result = review.ScoperOutput.parse(output);
    assert.equal(result.concerns.length, 2);
  });
});

// ────────────────────────────────────────────────────────────────
// ReviewIssue concern field Tests
// ────────────────────────────────────────────────────────────────

describe('ReviewIssue concern field', () => {
  it('accepts optional concern field (string)', () => {
    const issue = {
      id: 'I-100',
      type: 'bug',
      severity: 'high',
      file: 'src/auth.cjs',
      description: 'Test with concern',
      source: 'bug-hunt',
      status: 'open',
      createdAt: '2026-03-08T10:00:00Z',
      concern: 'authentication',
    };
    const result = review.ReviewIssue.parse(issue);
    assert.equal(result.concern, 'authentication');
  });

  it('succeeds without concern field (backward compat)', () => {
    const issue = {
      id: 'I-101',
      type: 'bug',
      severity: 'high',
      file: 'src/auth.cjs',
      description: 'No concern field',
      source: 'bug-hunt',
      status: 'open',
      createdAt: '2026-03-08T10:00:00Z',
    };
    const result = review.ReviewIssue.parse(issue);
    assert.equal(result.concern, undefined);
  });
});

// ────────────────────────────────────────────────────────────────
// normalizedLevenshtein Tests
// ────────────────────────────────────────────────────────────────

describe('normalizedLevenshtein', () => {
  it('returns 1.0 for identical strings', () => {
    assert.equal(review.normalizedLevenshtein('hello', 'hello'), 1.0);
  });

  it('returns 0 for completely different strings of same length (one char strings)', () => {
    assert.equal(review.normalizedLevenshtein('a', 'b'), 0);
  });

  it('returns value between 0 and 1 for similar strings', () => {
    const sim = review.normalizedLevenshtein('kitten', 'sitting');
    assert.ok(sim > 0, 'Should be > 0');
    assert.ok(sim < 1, 'Should be < 1');
  });

  it('handles empty strings (both empty = identical)', () => {
    assert.equal(review.normalizedLevenshtein('', ''), 1);
  });

  it('handles one empty string', () => {
    assert.equal(review.normalizedLevenshtein('abc', ''), 0);
    assert.equal(review.normalizedLevenshtein('', 'abc'), 0);
  });

  it('is symmetric', () => {
    const sim1 = review.normalizedLevenshtein('abc', 'abd');
    const sim2 = review.normalizedLevenshtein('abd', 'abc');
    assert.equal(sim1, sim2);
  });

  it('returns higher similarity for more similar strings', () => {
    const simClose = review.normalizedLevenshtein('Missing null check on auth', 'Missing null check on token');
    const simFar = review.normalizedLevenshtein('Missing null check on auth', 'Unused variable in tests');
    assert.ok(simClose > simFar, `Close (${simClose}) should be > far (${simFar})`);
  });
});

// ────────────────────────────────────────────────────────────────
// scopeByConcern Tests
// ────────────────────────────────────────────────────────────────

describe('scopeByConcern', () => {
  it('returns concern groups with cross-cutting files included in ALL groups', () => {
    const scoperOutput = {
      concerns: [
        { name: 'state', files: ['src/state.cjs'], rationale: { 'src/state.cjs': 'State management' } },
        { name: 'cli', files: ['src/cli.cjs'], rationale: { 'src/cli.cjs': 'CLI interface' } },
      ],
      crossCutting: [
        { file: 'src/utils.cjs', rationale: 'Shared utilities' },
      ],
      totalFiles: 3,
      concernCount: 2,
      crossCuttingCount: 1,
    };
    const allFiles = ['src/state.cjs', 'src/cli.cjs', 'src/utils.cjs'];

    const result = review.scopeByConcern(scoperOutput, allFiles);
    assert.equal(result.fallback, false);
    assert.equal(result.concernGroups.length, 2);

    // Cross-cutting file should be in ALL groups
    for (const group of result.concernGroups) {
      assert.ok(group.files.includes('src/utils.cjs'), `${group.concern} should include cross-cutting file`);
    }

    // State group has state.cjs + utils.cjs
    const stateGroup = result.concernGroups.find(g => g.concern === 'state');
    assert.ok(stateGroup.files.includes('src/state.cjs'));
    assert.ok(stateGroup.files.includes('src/utils.cjs'));

    // CLI group has cli.cjs + utils.cjs
    const cliGroup = result.concernGroups.find(g => g.concern === 'cli');
    assert.ok(cliGroup.files.includes('src/cli.cjs'));
    assert.ok(cliGroup.files.includes('src/utils.cjs'));
  });

  it('returns fallback=true with warning when cross-cutting >50% of total files', () => {
    const scoperOutput = {
      concerns: [
        { name: 'state', files: ['src/state.cjs'], rationale: {} },
      ],
      crossCutting: [
        { file: 'src/utils.cjs', rationale: 'Shared' },
        { file: 'src/config.cjs', rationale: 'Config' },
        { file: 'src/constants.cjs', rationale: 'Constants' },
      ],
      totalFiles: 4,
      concernCount: 1,
      crossCuttingCount: 3,
    };
    const allFiles = ['src/state.cjs', 'src/utils.cjs', 'src/config.cjs', 'src/constants.cjs'];

    const result = review.scopeByConcern(scoperOutput, allFiles);
    assert.equal(result.fallback, true);
    assert.deepStrictEqual(result.concernGroups, []);
    assert.ok(result.warning, 'Should include warning message');
    assert.ok(result.warning.includes('50%'), 'Warning should mention 50% threshold');
  });

  it('returns fallback=false when cross-cutting <=50%', () => {
    const scoperOutput = {
      concerns: [
        { name: 'state', files: ['src/a.cjs', 'src/b.cjs'], rationale: {} },
      ],
      crossCutting: [
        { file: 'src/utils.cjs', rationale: 'Shared' },
      ],
      totalFiles: 3,
      concernCount: 1,
      crossCuttingCount: 1,
    };
    const allFiles = ['src/a.cjs', 'src/b.cjs', 'src/utils.cjs'];

    const result = review.scopeByConcern(scoperOutput, allFiles);
    assert.equal(result.fallback, false);
    assert.equal(result.concernGroups.length, 1);
  });

  it('handles single concern (all files in one group)', () => {
    const scoperOutput = {
      concerns: [
        { name: 'everything', files: ['src/a.cjs', 'src/b.cjs', 'src/c.cjs'], rationale: {} },
      ],
      crossCutting: [],
      totalFiles: 3,
      concernCount: 1,
      crossCuttingCount: 0,
    };
    const allFiles = ['src/a.cjs', 'src/b.cjs', 'src/c.cjs'];

    const result = review.scopeByConcern(scoperOutput, allFiles);
    assert.equal(result.fallback, false);
    assert.equal(result.concernGroups.length, 1);
    assert.equal(result.concernGroups[0].concern, 'everything');
    assert.equal(result.concernGroups[0].files.length, 3);
  });

  it('handles empty concerns array', () => {
    const scoperOutput = {
      concerns: [],
      crossCutting: [],
      totalFiles: 0,
      concernCount: 0,
      crossCuttingCount: 0,
    };
    const allFiles = [];

    const result = review.scopeByConcern(scoperOutput, allFiles);
    assert.equal(result.fallback, false);
    assert.deepStrictEqual(result.concernGroups, []);
  });

  it('exact 50% boundary is not fallback (<=50%)', () => {
    const scoperOutput = {
      concerns: [
        { name: 'code', files: ['src/a.cjs'], rationale: {} },
      ],
      crossCutting: [
        { file: 'src/b.cjs', rationale: 'Shared' },
      ],
      totalFiles: 2,
      concernCount: 1,
      crossCuttingCount: 1,
    };
    const allFiles = ['src/a.cjs', 'src/b.cjs'];

    const result = review.scopeByConcern(scoperOutput, allFiles);
    assert.equal(result.fallback, false, 'Exactly 50% should NOT trigger fallback');
  });
});

// ────────────────────────────────────────────────────────────────
// deduplicateFindings Tests
// ────────────────────────────────────────────────────────────────

describe('deduplicateFindings', () => {
  it('keeps both findings when files differ', () => {
    const findings = [
      { file: 'src/a.cjs', description: 'Missing null check', severity: 'high', concern: 'state' },
      { file: 'src/b.cjs', description: 'Missing null check', severity: 'high', concern: 'cli' },
    ];
    const result = review.deduplicateFindings(findings);
    assert.equal(result.length, 2);
  });

  it('merges when same file and similar description (>0.7 similarity)', () => {
    const findings = [
      { file: 'src/auth.cjs', description: 'Missing null check on token parse result', severity: 'high', concern: 'auth' },
      { file: 'src/auth.cjs', description: 'Missing null check on token parse output', severity: 'medium', concern: 'tokens' },
    ];
    const result = review.deduplicateFindings(findings);
    assert.equal(result.length, 1, 'Should merge similar findings on same file');
  });

  it('keeps higher severity finding when deduplicating', () => {
    const findings = [
      { file: 'src/auth.cjs', description: 'Missing null check on token parse result', severity: 'high', concern: 'auth' },
      { file: 'src/auth.cjs', description: 'Missing null check on token parse output', severity: 'medium', concern: 'tokens' },
    ];
    const result = review.deduplicateFindings(findings);
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'high', 'Higher severity should win');
  });

  it('keeps longer evidence when severity is equal', () => {
    const findings = [
      { file: 'src/auth.cjs', description: 'Missing null check on token parse result', severity: 'high', evidence: 'short' },
      { file: 'src/auth.cjs', description: 'Missing null check on token parse output', severity: 'high', evidence: 'this is a much longer evidence string with more detail' },
    ];
    const result = review.deduplicateFindings(findings);
    assert.equal(result.length, 1);
    assert.ok(result[0].evidence.length > 10, 'Should keep the finding with longer evidence');
  });

  it('preserves concern tags on surviving findings', () => {
    const findings = [
      { file: 'src/auth.cjs', description: 'Missing null check on token parse result', severity: 'critical', concern: 'authentication' },
      { file: 'src/auth.cjs', description: 'Missing null check on token parse output', severity: 'high', concern: 'tokens' },
    ];
    const result = review.deduplicateFindings(findings);
    assert.equal(result.length, 1);
    assert.equal(result[0].concern, 'authentication', 'Winner should preserve its concern tag');
  });

  it('returns empty array for empty input', () => {
    const result = review.deduplicateFindings([]);
    assert.deepStrictEqual(result, []);
  });

  it('keeps findings with different descriptions on same file', () => {
    const findings = [
      { file: 'src/auth.cjs', description: 'Missing null check on token', severity: 'high' },
      { file: 'src/auth.cjs', description: 'SQL injection vulnerability in query builder', severity: 'critical' },
    ];
    const result = review.deduplicateFindings(findings);
    assert.equal(result.length, 2, 'Different descriptions should not be deduplicated');
  });

  it('handles single finding (no dedup needed)', () => {
    const findings = [
      { file: 'src/auth.cjs', description: 'Missing null check', severity: 'high' },
    ];
    const result = review.deduplicateFindings(findings);
    assert.equal(result.length, 1);
  });

  it('uses codeSnippet as fallback when evidence is missing for equal severity', () => {
    const findings = [
      { file: 'src/auth.cjs', description: 'Missing null check on token parse result', severity: 'high', codeSnippet: 'x' },
      { file: 'src/auth.cjs', description: 'Missing null check on token parse output', severity: 'high', codeSnippet: 'const token = parseToken(input); // no null check on result' },
    ];
    const result = review.deduplicateFindings(findings);
    assert.equal(result.length, 1);
    assert.ok(result[0].codeSnippet.length > 10, 'Should keep finding with longer codeSnippet');
  });

  it('handles three-way dedup: A beats B, A beats C', () => {
    const findings = [
      { file: 'src/auth.cjs', description: 'Missing null check on token parse result', severity: 'critical', concern: 'scope-1' },
      { file: 'src/auth.cjs', description: 'Missing null check on token parse output', severity: 'high', concern: 'scope-2' },
      { file: 'src/auth.cjs', description: 'Missing null check on token parse value', severity: 'medium', concern: 'scope-3' },
    ];
    const result = review.deduplicateFindings(findings);
    assert.equal(result.length, 1, 'Should deduplicate all three into one');
    assert.equal(result[0].severity, 'critical', 'Highest severity should win');
  });
});

// ────────────────────────────────────────────────────────────────
// Export Tests
// ────────────────────────────────────────────────────────────────

describe('module exports', () => {
  it('exports scopeSetForReview', () => {
    assert.equal(typeof review.scopeSetForReview, 'function');
  });

  it('does NOT export scopeWaveForReview', () => {
    assert.equal(review.scopeWaveForReview, undefined);
  });

  it('exports chunkByDirectory', () => {
    assert.equal(typeof review.chunkByDirectory, 'function');
  });

  it('exports buildWaveAttribution', () => {
    assert.equal(typeof review.buildWaveAttribution, 'function');
  });

  it('exports findDependents', () => {
    assert.equal(typeof review.findDependents, 'function');
  });

  it('exports logIssue', () => {
    assert.equal(typeof review.logIssue, 'function');
  });

  it('exports loadSetIssues', () => {
    assert.equal(typeof review.loadSetIssues, 'function');
  });

  it('exports updateIssueStatus', () => {
    assert.equal(typeof review.updateIssueStatus, 'function');
  });

  it('exports generateReviewSummary', () => {
    assert.equal(typeof review.generateReviewSummary, 'function');
  });

  it('exports ReviewIssue and ReviewIssues schemas', () => {
    assert.ok(review.ReviewIssue);
    assert.ok(review.ReviewIssues);
  });

  it('exports REVIEW_CONSTANTS', () => {
    assert.ok(review.REVIEW_CONSTANTS);
  });

  it('exports scopeByConcern', () => {
    assert.equal(typeof review.scopeByConcern, 'function');
  });

  it('exports deduplicateFindings', () => {
    assert.equal(typeof review.deduplicateFindings, 'function');
  });

  it('exports normalizedLevenshtein', () => {
    assert.equal(typeof review.normalizedLevenshtein, 'function');
  });

  it('exports ScoperOutput schema', () => {
    assert.ok(review.ScoperOutput);
  });

  it('exports scopeSetPostMerge', () => {
    assert.equal(typeof review.scopeSetPostMerge, 'function');
  });

  it('exports logIssuePostMerge', () => {
    assert.equal(typeof review.logIssuePostMerge, 'function');
  });

  it('exports loadPostMergeIssues', () => {
    assert.equal(typeof review.loadPostMergeIssues, 'function');
  });

  it('exports generatePostMergeReviewSummary', () => {
    assert.equal(typeof review.generatePostMergeReviewSummary, 'function');
  });
});

// ────────────────────────────────────────────────────────────────
// scopeSetPostMerge Tests
// ────────────────────────────────────────────────────────────────

describe('scopeSetPostMerge', () => {
  const { execSync: execSyncHelper } = require('child_process');
  let tmpDir;

  function createGitRepoWithMerge(dir, setId, extraSetup) {
    const opts = { cwd: dir, stdio: 'pipe' };

    // Init repo
    execSyncHelper('git init -b main', opts);
    execSyncHelper('git config user.email "test@test.com"', opts);
    execSyncHelper('git config user.name "Test"', opts);

    // Create initial file and commit on main
    fs.writeFileSync(path.join(dir, 'base.cjs'), 'module.exports = {};');
    execSyncHelper('git add base.cjs', opts);
    execSyncHelper('git commit -m "initial commit"', opts);

    // Create feature branch
    execSyncHelper(`git checkout -b rapid/${setId}`, opts);

    // Add files on feature branch
    fs.writeFileSync(path.join(dir, 'feature.cjs'), 'module.exports = { feature: true };');
    fs.writeFileSync(path.join(dir, 'helper.cjs'), 'module.exports = { help: true };');

    // Run extra setup if provided (e.g., adding .planning files)
    if (extraSetup) extraSetup(dir, opts);

    execSyncHelper('git add -A', opts);
    execSyncHelper(`git commit -m "feat(${setId}): add feature files"`, opts);

    // Switch back to main and merge
    execSyncHelper('git checkout main', opts);
    execSyncHelper(`git merge rapid/${setId} --no-ff -m "merge(${setId}): merge set into main"`, opts);

    // Get the merge commit hash
    const mergeCommit = execSyncHelper('git rev-parse HEAD', opts).toString().trim();
    return mergeCommit;
  }

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('returns changed files from merge commit diff', () => {
    const setId = 'test-scope';
    createGitRepoWithMerge(tmpDir, setId);

    const result = review.scopeSetPostMerge(tmpDir, setId);

    assert.ok(result.changedFiles.includes('feature.cjs'), 'should include feature.cjs');
    assert.ok(result.changedFiles.includes('helper.cjs'), 'should include helper.cjs');
    assert.ok(result.totalFiles >= 2, 'totalFiles should be at least 2');
  });

  it('uses MERGE-STATE.json mergeCommit when available', () => {
    const setId = 'test-merge-state';
    const mergeCommit = createGitRepoWithMerge(tmpDir, setId);

    // Write a valid MERGE-STATE.json
    const mergeStateDir = path.join(tmpDir, '.planning', 'sets', setId);
    fs.mkdirSync(mergeStateDir, { recursive: true });
    fs.writeFileSync(path.join(mergeStateDir, 'MERGE-STATE.json'), JSON.stringify({
      setId,
      status: 'complete',
      mergeCommit,
      detection: { l1Conflicts: [], l2Conflicts: [], l3Conflicts: [], l4Conflicts: [] },
      resolution: { resolvedConflicts: [] },
      agentPhase1: 'idle',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    }));

    const result = review.scopeSetPostMerge(tmpDir, setId);
    assert.ok(result.changedFiles.includes('feature.cjs'), 'should find feature.cjs via MERGE-STATE');
    assert.ok(result.changedFiles.includes('helper.cjs'), 'should find helper.cjs via MERGE-STATE');
  });

  it('falls back to git log grep when MERGE-STATE missing', () => {
    const setId = 'test-fallback';
    createGitRepoWithMerge(tmpDir, setId);
    // Do NOT write MERGE-STATE.json

    const result = review.scopeSetPostMerge(tmpDir, setId);
    assert.ok(result.changedFiles.includes('feature.cjs'), 'should find feature.cjs via git log grep');
    assert.ok(result.changedFiles.includes('helper.cjs'), 'should find helper.cjs via git log grep');
  });

  it('filters out .planning/ files from results', () => {
    const setId = 'test-filter-planning';
    createGitRepoWithMerge(tmpDir, setId, (dir) => {
      // Add a .planning file on the feature branch
      fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.planning', 'test.md'), '# test');
    });

    const result = review.scopeSetPostMerge(tmpDir, setId);
    const planningFiles = result.changedFiles.filter(f => f.startsWith('.planning/'));
    assert.equal(planningFiles.length, 0, '.planning/ files should be filtered out');
  });

  it('throws when set was never merged', () => {
    // Create a basic repo without any merge for this set
    const opts = { cwd: tmpDir, stdio: 'pipe' };
    execSyncHelper('git init -b main', opts);
    execSyncHelper('git config user.email "test@test.com"', opts);
    execSyncHelper('git config user.name "Test"', opts);
    fs.writeFileSync(path.join(tmpDir, 'base.cjs'), 'module.exports = {};');
    execSyncHelper('git add base.cjs', opts);
    execSyncHelper('git commit -m "initial commit"', opts);

    assert.throws(
      () => review.scopeSetPostMerge(tmpDir, 'nonexistent-set'),
      (err) => {
        assert.ok(err.message.includes('No merge commit found'), `Expected error about no merge commit, got: ${err.message}`);
        return true;
      }
    );
  });

  it('does not call state transition (behavioral contract)', () => {
    const fnSource = review.scopeSetPostMerge.toString();
    assert.ok(!fnSource.includes('state transition'), 'scopeSetPostMerge must not call state transition');
    assert.ok(!fnSource.includes('transition('), 'scopeSetPostMerge must not call transition()');

    // Verify function signature does not accept stateMachine or sm parameter
    const paramMatch = fnSource.match(/^function\s*\w*\s*\(([^)]*)\)/);
    if (paramMatch) {
      const params = paramMatch[1];
      assert.ok(!params.includes('stateMachine'), 'should not accept stateMachine param');
      assert.ok(!params.includes(' sm'), 'should not accept sm param');
    }
  });

  it('finds dependents of changed files', () => {
    const setId = 'test-dependents';
    const opts = { cwd: tmpDir, stdio: 'pipe' };

    // Init repo
    execSyncHelper('git init -b main', opts);
    execSyncHelper('git config user.email "test@test.com"', opts);
    execSyncHelper('git config user.name "Test"', opts);

    // Create a consumer that imports feature.cjs
    fs.writeFileSync(path.join(tmpDir, 'consumer.cjs'), "const feature = require('./feature.cjs');\nmodule.exports = { consume: feature };");
    fs.writeFileSync(path.join(tmpDir, 'base.cjs'), 'module.exports = {};');
    execSyncHelper('git add consumer.cjs base.cjs', opts);
    execSyncHelper('git commit -m "initial commit with consumer"', opts);

    // Create feature branch
    execSyncHelper(`git checkout -b rapid/${setId}`, opts);
    fs.writeFileSync(path.join(tmpDir, 'feature.cjs'), 'module.exports = { feature: true };');
    execSyncHelper('git add feature.cjs', opts);
    execSyncHelper(`git commit -m "feat(${setId}): add feature"`, opts);

    // Merge back
    execSyncHelper('git checkout main', opts);
    execSyncHelper(`git merge rapid/${setId} --no-ff -m "merge(${setId}): merge set into main"`, opts);

    const result = review.scopeSetPostMerge(tmpDir, setId);
    assert.ok(result.changedFiles.includes('feature.cjs'), 'feature.cjs should be in changedFiles');
    assert.ok(result.dependentFiles.includes('consumer.cjs'), 'consumer.cjs should be in dependentFiles');
  });
});

// ────────────────────────────────────────────────────────────────
// logIssuePostMerge Tests
// ────────────────────────────────────────────────────────────────

describe('logIssuePostMerge', () => {
  let tmpDir;

  function makeValidIssue(id) {
    return {
      id: id || 'PM-001',
      type: 'bug',
      severity: 'high',
      file: 'src/auth.cjs',
      description: 'Missing null check on token parse',
      source: 'bug-hunt',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('writes issue to .planning/post-merge/{setId}/ directory', () => {
    const issue = makeValidIssue('PM-001');
    review.logIssuePostMerge(tmpDir, 'test-set', issue);

    const issuesPath = path.join(tmpDir, '.planning', 'post-merge', 'test-set', 'REVIEW-ISSUES.json');
    assert.ok(fs.existsSync(issuesPath), 'REVIEW-ISSUES.json should exist in post-merge dir');

    const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    assert.equal(data.setId, 'test-set');
    assert.equal(data.issues.length, 1);
    assert.equal(data.issues[0].id, 'PM-001');
  });

  it('creates directory if it does not exist', () => {
    const postMergeDir = path.join(tmpDir, '.planning', 'post-merge');
    assert.ok(!fs.existsSync(postMergeDir), 'post-merge dir should not exist yet');

    review.logIssuePostMerge(tmpDir, 'new-set', makeValidIssue());

    assert.ok(fs.existsSync(postMergeDir), '.planning/post-merge/ should be created automatically');
    assert.ok(fs.existsSync(path.join(postMergeDir, 'new-set')), 'set subdirectory should be created');
  });

  it('appends to existing issues', () => {
    review.logIssuePostMerge(tmpDir, 'test-set', makeValidIssue('PM-001'));
    review.logIssuePostMerge(tmpDir, 'test-set', makeValidIssue('PM-002'));

    const issuesPath = path.join(tmpDir, '.planning', 'post-merge', 'test-set', 'REVIEW-ISSUES.json');
    const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    assert.equal(data.issues.length, 2, 'should have 2 issues');
    assert.equal(data.issues[0].id, 'PM-001');
    assert.equal(data.issues[1].id, 'PM-002');
  });
});

// ────────────────────────────────────────────────────────────────
// loadPostMergeIssues Tests
// ────────────────────────────────────────────────────────────────

describe('loadPostMergeIssues', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('returns empty array when no post-merge issues exist', () => {
    const issues = review.loadPostMergeIssues(tmpDir, 'nonexistent');
    assert.deepStrictEqual(issues, []);
  });

  it('loads issues from post-merge directory', () => {
    const issue = {
      id: 'PM-LOAD-001',
      type: 'bug',
      severity: 'medium',
      file: 'src/test.cjs',
      description: 'Test issue',
      source: 'bug-hunt',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    review.logIssuePostMerge(tmpDir, 'load-test', issue);

    const loaded = review.loadPostMergeIssues(tmpDir, 'load-test');
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, 'PM-LOAD-001');
  });
});

// ────────────────────────────────────────────────────────────────
// generatePostMergeReviewSummary Tests
// ────────────────────────────────────────────────────────────────

describe('generatePostMergeReviewSummary', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('writes REVIEW-SUMMARY.md to post-merge directory', () => {
    const issues = [
      {
        id: 'PM-SUM-001',
        type: 'bug',
        severity: 'high',
        file: 'src/auth.cjs',
        description: 'Missing check',
        source: 'bug-hunt',
        status: 'open',
        createdAt: new Date().toISOString(),
      },
    ];

    const summaryPath = review.generatePostMergeReviewSummary(tmpDir, 'summary-test', issues);
    assert.ok(summaryPath.includes(path.join('.planning', 'post-merge', 'summary-test', 'REVIEW-SUMMARY.md')));
    assert.ok(fs.existsSync(summaryPath), 'REVIEW-SUMMARY.md should be created');

    const content = fs.readFileSync(summaryPath, 'utf-8');
    assert.ok(content.includes('# Review Summary: summary-test'), 'should contain set id in title');
    assert.ok(content.includes('**Total issues:** 1'), 'should report issue count');
  });
});
