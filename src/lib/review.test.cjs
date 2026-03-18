'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  findDependents,
  serializeReviewScope,
  parseReviewScope,
  chunkByDirectory,
  normalizedLevenshtein,
  deduplicateFindings,
  scopeByConcern,
  buildWaveAttribution,
  extractAcceptanceCriteria,
  generateReviewSummary,
  REVIEW_CONSTANTS,
} = require('./review.cjs');

// ---------------------------------------------------------------------------
// Helper: create a temporary directory with cleanup
// ---------------------------------------------------------------------------
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'review-test-'));
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// findDependents
// ---------------------------------------------------------------------------
describe('findDependents', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Create a source file that requires quality.cjs
    const srcDir = path.join(tmpDir, 'src', 'lib');
    fs.mkdirSync(srcDir, { recursive: true });

    fs.writeFileSync(
      path.join(srcDir, 'execute.cjs'),
      "const quality = require('./quality.cjs');\nmodule.exports = {};\n"
    );
    fs.writeFileSync(
      path.join(srcDir, 'quality.cjs'),
      "module.exports = { check() { return true; } };\n"
    );
    fs.writeFileSync(
      path.join(srcDir, 'unrelated.cjs'),
      "module.exports = { foo: 42 };\n"
    );
  });

  after(() => {
    rmDir(tmpDir);
  });

  it('resolves quality.cjs path in findDependents - execute.cjs imports quality.cjs', () => {
    const dependents = findDependents(tmpDir, ['src/lib/quality.cjs']);
    assert.ok(dependents.includes('src/lib/execute.cjs'),
      `Expected dependents to include execute.cjs, got: ${JSON.stringify(dependents)}`);
    assert.ok(!dependents.includes('src/lib/unrelated.cjs'),
      'unrelated.cjs should NOT appear in dependents');
  });

  it('returns empty array for empty changedFiles', () => {
    const result = findDependents(tmpDir, []);
    assert.deepStrictEqual(result, []);
  });

  it('returns empty array for null changedFiles', () => {
    const result = findDependents(tmpDir, null);
    assert.deepStrictEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// walkDir skips .rapid-worktrees
// ---------------------------------------------------------------------------
describe('findDependents skips .rapid-worktrees', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Create a file in .rapid-worktrees that requires target.cjs
    const worktreeDir = path.join(tmpDir, '.rapid-worktrees', 'some-set', 'src');
    fs.mkdirSync(worktreeDir, { recursive: true });
    fs.writeFileSync(
      path.join(worktreeDir, 'importer.cjs'),
      "const target = require('./target.cjs');\n"
    );

    // Create the target file in the main tree
    fs.writeFileSync(
      path.join(srcDir, 'target.cjs'),
      "module.exports = { hello: true };\n"
    );
  });

  after(() => {
    rmDir(tmpDir);
  });

  it('does not include files from .rapid-worktrees directory', () => {
    const dependents = findDependents(tmpDir, ['src/target.cjs']);
    // The importer inside .rapid-worktrees should NOT appear
    const worktreeFiles = dependents.filter(f => f.includes('.rapid-worktrees'));
    assert.deepStrictEqual(worktreeFiles, [],
      `Found worktree files in dependents: ${JSON.stringify(worktreeFiles)}`);
  });
});

// ---------------------------------------------------------------------------
// serializeReviewScope handles null waveAttribution
// ---------------------------------------------------------------------------
describe('serializeReviewScope', () => {
  it('handles null waveAttribution without crashing', () => {
    const scopeData = {
      setId: 'test-set',
      date: '2025-01-01T00:00:00Z',
      postMerge: false,
      worktreePath: '/tmp/test',
      changedFiles: ['src/foo.cjs'],
      dependentFiles: [],
      totalFiles: 1,
      chunks: [{ dir: 'src', files: ['src/foo.cjs'] }],
      waveAttribution: null,
      concernScoping: null,
      useConcernScoping: false,
      fallbackWarning: null,
      acceptanceCriteria: [],
    };

    const result = serializeReviewScope(scopeData);
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('# REVIEW-SCOPE: test-set'));
    assert.ok(result.includes('unattributed'));
    assert.ok(result.includes('No wave attribution available.'));
  });

  it('includes wave attribution when provided', () => {
    const scopeData = {
      setId: 'test-set',
      date: '2025-01-01T00:00:00Z',
      postMerge: false,
      worktreePath: '/tmp/test',
      changedFiles: ['src/foo.cjs'],
      dependentFiles: [],
      totalFiles: 1,
      chunks: [{ dir: 'src', files: ['src/foo.cjs'] }],
      waveAttribution: { 'src/foo.cjs': 'wave-1' },
      concernScoping: null,
      useConcernScoping: false,
      fallbackWarning: null,
      acceptanceCriteria: ['Test criterion 1'],
    };

    const result = serializeReviewScope(scopeData);
    assert.ok(result.includes('wave-1'));
    assert.ok(result.includes('Test criterion 1'));
  });
});

// ---------------------------------------------------------------------------
// parseReviewScope handles extra whitespace around SCOPE-META JSON
// ---------------------------------------------------------------------------
describe('parseReviewScope', () => {
  it('parses SCOPE-META with extra whitespace correctly', () => {
    const markdown = `# REVIEW-SCOPE: test-set

<!-- SCOPE-META   {"setId":"test-set","date":"2025-01-01T00:00:00Z","postMerge":false,"totalFiles":3,"useConcernScoping":false}   -->

## Set Metadata
`;
    const result = parseReviewScope(markdown);
    assert.equal(result.setId, 'test-set');
    assert.equal(result.postMerge, false);
    assert.equal(result.totalFiles, 3);
  });

  it('throws on missing SCOPE-META marker', () => {
    assert.throws(() => parseReviewScope('# No marker here'),
      /SCOPE-META marker not found/);
  });

  it('throws on malformed JSON in SCOPE-META', () => {
    const markdown = '<!-- SCOPE-META {invalid json} -->';
    assert.throws(() => parseReviewScope(markdown),
      /Failed to parse SCOPE-META JSON/);
  });

  it('round-trips through serialize/parse', () => {
    const scopeData = {
      setId: 'roundtrip-set',
      date: '2025-06-15T12:00:00Z',
      postMerge: true,
      worktreePath: '/tmp/wt',
      changedFiles: [],
      dependentFiles: [],
      totalFiles: 0,
      chunks: [],
      waveAttribution: {},
      concernScoping: null,
      useConcernScoping: false,
      fallbackWarning: null,
      acceptanceCriteria: [],
    };

    const serialized = serializeReviewScope(scopeData);
    const parsed = parseReviewScope(serialized);
    assert.equal(parsed.setId, 'roundtrip-set');
    assert.equal(parsed.postMerge, true);
    assert.equal(parsed.totalFiles, 0);
  });
});

// ---------------------------------------------------------------------------
// chunkByDirectory
// ---------------------------------------------------------------------------
describe('chunkByDirectory', () => {
  it('returns single chunk when files are below threshold', () => {
    const files = ['a.cjs', 'b.cjs', 'c.cjs'];
    const chunks = chunkByDirectory(files);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].dir, '.');
    assert.deepStrictEqual(chunks[0].files, files);
  });
});

// ---------------------------------------------------------------------------
// normalizedLevenshtein
// ---------------------------------------------------------------------------
describe('normalizedLevenshtein', () => {
  it('returns 1 for identical strings', () => {
    assert.equal(normalizedLevenshtein('hello', 'hello'), 1);
  });

  it('returns 1 for two empty strings', () => {
    assert.equal(normalizedLevenshtein('', ''), 1);
  });

  it('returns value between 0 and 1 for similar strings', () => {
    const sim = normalizedLevenshtein('Missing null check in parseConfig', 'Missing null check in parseConfig()');
    assert.ok(sim > 0.7 && sim <= 1, `Expected similarity > 0.7, got ${sim}`);
  });
});

// ---------------------------------------------------------------------------
// deduplicateFindings
// ---------------------------------------------------------------------------
describe('deduplicateFindings', () => {
  it('returns empty for empty input', () => {
    assert.deepStrictEqual(deduplicateFindings([]), []);
  });

  it('removes duplicate findings on same file with similar descriptions', () => {
    const findings = [
      { file: 'a.cjs', description: 'Missing null check in parseConfig', severity: 'high', evidence: 'line 42' },
      { file: 'a.cjs', description: 'Missing null check in parseConfig()', severity: 'medium', evidence: 'line 42' },
    ];
    const deduped = deduplicateFindings(findings);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].severity, 'high'); // higher severity wins
  });
});

// ---------------------------------------------------------------------------
// generateReviewSummary
// ---------------------------------------------------------------------------
describe('generateReviewSummary', () => {
  it('generates correct markdown with deferred warning', () => {
    const issues = [];
    for (let i = 0; i < 7; i++) {
      issues.push({
        id: `iss-${i}`,
        severity: 'low',
        type: 'bug',
        status: 'deferred',
        originatingWave: 'wave-1',
      });
    }
    const summary = generateReviewSummary('test-set', issues);
    assert.ok(summary.includes('# Review Summary: test-set'));
    assert.ok(summary.includes('**Total issues:** 7'));
    assert.ok(summary.includes('WARNING'));
    assert.ok(summary.includes('7 deferred issues'));
  });

  it('omits deferred warning when count <= 5', () => {
    const issues = [
      { id: '1', severity: 'medium', type: 'bug', status: 'deferred', originatingWave: 'wave-1' },
    ];
    const summary = generateReviewSummary('test-set', issues);
    assert.ok(!summary.includes('WARNING'));
  });
});
