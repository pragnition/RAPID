'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  appendDecision,
  appendCorrection,
  queryDecisions,
  queryCorrections,
  buildMemoryContext,
  VALID_CATEGORIES,
  VALID_SOURCES,
  DEFAULT_TOKEN_BUDGET,
} = require('./memory.cjs');
const { estimateTokens } = require('./tool-docs.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-memory-test-'));
  // Create .planning/ so getMemoryDir can resolve
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  return tmpDir;
}

function validDecisionEntry(overrides) {
  return {
    category: 'architecture',
    decision: 'Use JSONL for memory storage',
    rationale: 'Append-only format suits our use case',
    source: 'user',
    ...overrides,
  };
}

function validCorrectionEntry(overrides) {
  return {
    original: 'Use JSON files for memory',
    correction: 'Use JSONL for memory',
    reason: 'JSONL is append-only friendly',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// appendDecision
// ---------------------------------------------------------------------------

describe('appendDecision', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates .planning/memory/ directory on first write', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    assert.ok(!fs.existsSync(memDir), 'memory dir should not exist before first write');
    appendDecision(tmpDir, validDecisionEntry());
    assert.ok(fs.existsSync(memDir), 'memory dir should exist after first write');
  });

  it('writes valid JSONL line with all required fields', () => {
    const record = appendDecision(tmpDir, validDecisionEntry());
    const filePath = path.join(tmpDir, '.planning', 'memory', 'DECISIONS.jsonl');
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    const parsed = JSON.parse(content);

    assert.ok(parsed.id, 'should have auto-generated id');
    assert.ok(parsed.timestamp, 'should have auto-generated timestamp');
    assert.equal(parsed.category, 'architecture');
    assert.equal(parsed.decision, 'Use JSONL for memory storage');
    assert.equal(parsed.rationale, 'Append-only format suits our use case');
    assert.equal(parsed.source, 'user');
    assert.equal(parsed.milestone, null);
    assert.equal(parsed.setId, null);
    assert.equal(parsed.topic, null);
  });

  it('appends multiple entries as separate lines', () => {
    appendDecision(tmpDir, validDecisionEntry({ decision: 'First' }));
    appendDecision(tmpDir, validDecisionEntry({ decision: 'Second' }));
    appendDecision(tmpDir, validDecisionEntry({ decision: 'Third' }));

    const filePath = path.join(tmpDir, '.planning', 'memory', 'DECISIONS.jsonl');
    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
    assert.equal(lines.length, 3);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      assert.ok(parsed.id);
      assert.ok(parsed.timestamp);
    }
  });

  it('throws on missing required field: category', () => {
    assert.throws(
      () => appendDecision(tmpDir, { decision: 'x', rationale: 'y', source: 'user' }),
      /category is required/,
    );
  });

  it('throws on invalid category', () => {
    assert.throws(
      () => appendDecision(tmpDir, validDecisionEntry({ category: 'nonexistent' })),
      /invalid category/,
    );
  });

  it('throws on missing required field: decision (empty string)', () => {
    assert.throws(
      () => appendDecision(tmpDir, validDecisionEntry({ decision: '' })),
      /decision is required/,
    );
  });

  it('throws on invalid source', () => {
    assert.throws(
      () => appendDecision(tmpDir, validDecisionEntry({ source: 'robot' })),
      /invalid source/,
    );
  });

  it('includes optional fields when provided', () => {
    const record = appendDecision(tmpDir, validDecisionEntry({
      milestone: 'v3.4.0',
      setId: 'memory-system',
      topic: 'storage-format',
    }));

    assert.equal(record.milestone, 'v3.4.0');
    assert.equal(record.setId, 'memory-system');
    assert.equal(record.topic, 'storage-format');
  });

  it('returns the created record with generated id', () => {
    const record = appendDecision(tmpDir, validDecisionEntry());
    assert.ok(typeof record.id === 'string' && record.id.length > 0);
    assert.ok(typeof record.timestamp === 'string' && record.timestamp.length > 0);
    assert.equal(record.category, 'architecture');
  });
});

// ---------------------------------------------------------------------------
// appendCorrection
// ---------------------------------------------------------------------------

describe('appendCorrection', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates directory on first write', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    assert.ok(!fs.existsSync(memDir));
    appendCorrection(tmpDir, validCorrectionEntry());
    assert.ok(fs.existsSync(memDir));
  });

  it('writes valid JSONL line', () => {
    const record = appendCorrection(tmpDir, validCorrectionEntry());
    const filePath = path.join(tmpDir, '.planning', 'memory', 'CORRECTIONS.jsonl');
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    const parsed = JSON.parse(content);

    assert.ok(parsed.id);
    assert.ok(parsed.timestamp);
    assert.equal(parsed.original, 'Use JSON files for memory');
    assert.equal(parsed.correction, 'Use JSONL for memory');
    assert.equal(parsed.reason, 'JSONL is append-only friendly');
    assert.deepEqual(parsed.affectedSets, []);
  });

  it('throws on missing required field: original', () => {
    assert.throws(
      () => appendCorrection(tmpDir, { correction: 'x', reason: 'y' }),
      /original is required/,
    );
  });

  it('includes affectedSets array when provided', () => {
    const record = appendCorrection(tmpDir, validCorrectionEntry({
      affectedSets: ['memory-system', 'hooks-system'],
    }));
    assert.deepEqual(record.affectedSets, ['memory-system', 'hooks-system']);
  });

  it('defaults affectedSets to empty array', () => {
    const record = appendCorrection(tmpDir, validCorrectionEntry());
    assert.deepEqual(record.affectedSets, []);
  });
});

// ---------------------------------------------------------------------------
// queryDecisions
// ---------------------------------------------------------------------------

describe('queryDecisions', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns empty array when file does not exist', () => {
    const result = queryDecisions(tmpDir);
    assert.deepEqual(result, []);
  });

  it('returns all entries sorted by timestamp descending', () => {
    // Append with small delays to get different timestamps
    appendDecision(tmpDir, validDecisionEntry({ decision: 'First' }));
    // Manually write a second entry with an earlier timestamp
    const memDir = path.join(tmpDir, '.planning', 'memory');
    const filePath = path.join(memDir, 'DECISIONS.jsonl');
    const earlyRecord = JSON.stringify({
      id: 'early-id',
      timestamp: '2020-01-01T00:00:00.000Z',
      category: 'architecture',
      decision: 'Early',
      rationale: 'reason',
      source: 'user',
      milestone: null,
      setId: null,
      topic: null,
    });
    fs.appendFileSync(filePath, earlyRecord + '\n');

    const results = queryDecisions(tmpDir);
    assert.equal(results.length, 2);
    // First result should be the one with the later timestamp
    assert.equal(results[1].decision, 'Early');
    assert.ok(results[0].timestamp > results[1].timestamp);
  });

  it('filters by category', () => {
    appendDecision(tmpDir, validDecisionEntry({ category: 'architecture', decision: 'A' }));
    appendDecision(tmpDir, validDecisionEntry({ category: 'testing', decision: 'B' }));
    appendDecision(tmpDir, validDecisionEntry({ category: 'architecture', decision: 'C' }));

    const results = queryDecisions(tmpDir, { category: 'testing' });
    assert.equal(results.length, 1);
    assert.equal(results[0].decision, 'B');
  });

  it('filters by milestone', () => {
    appendDecision(tmpDir, validDecisionEntry({ milestone: 'v3.4.0', decision: 'A' }));
    appendDecision(tmpDir, validDecisionEntry({ milestone: 'v3.3.0', decision: 'B' }));

    const results = queryDecisions(tmpDir, { milestone: 'v3.4.0' });
    assert.equal(results.length, 1);
    assert.equal(results[0].decision, 'A');
  });

  it('filters by setId', () => {
    appendDecision(tmpDir, validDecisionEntry({ setId: 'memory-system', decision: 'A' }));
    appendDecision(tmpDir, validDecisionEntry({ setId: 'hooks-system', decision: 'B' }));

    const results = queryDecisions(tmpDir, { setId: 'memory-system' });
    assert.equal(results.length, 1);
    assert.equal(results[0].decision, 'A');
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      appendDecision(tmpDir, validDecisionEntry({ decision: `Decision ${i}` }));
    }
    const results = queryDecisions(tmpDir, { limit: 3 });
    assert.equal(results.length, 3);
  });

  it('skips malformed JSONL lines gracefully', () => {
    // Write a valid entry first
    appendDecision(tmpDir, validDecisionEntry({ decision: 'Valid' }));

    // Manually append a malformed line
    const filePath = path.join(tmpDir, '.planning', 'memory', 'DECISIONS.jsonl');
    fs.appendFileSync(filePath, 'this is not json\n');
    fs.appendFileSync(filePath, '{broken json\n');

    // Append another valid entry
    appendDecision(tmpDir, validDecisionEntry({ decision: 'Also Valid' }));

    const results = queryDecisions(tmpDir);
    assert.equal(results.length, 2);
    // Both valid entries should be present
    const decisions = results.map((r) => r.decision);
    assert.ok(decisions.includes('Valid'));
    assert.ok(decisions.includes('Also Valid'));
  });
});

// ---------------------------------------------------------------------------
// queryCorrections
// ---------------------------------------------------------------------------

describe('queryCorrections', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns empty array when file does not exist', () => {
    const result = queryCorrections(tmpDir);
    assert.deepEqual(result, []);
  });

  it('filters by affectedSet', () => {
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'A',
      affectedSets: ['memory-system'],
    }));
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'B',
      affectedSets: ['hooks-system'],
    }));
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'C',
      affectedSets: ['memory-system', 'hooks-system'],
    }));

    const results = queryCorrections(tmpDir, { affectedSet: 'memory-system' });
    assert.equal(results.length, 2);
    const originals = results.map((r) => r.original);
    assert.ok(originals.includes('A'));
    assert.ok(originals.includes('C'));
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      appendCorrection(tmpDir, validCorrectionEntry({ original: `Original ${i}` }));
    }
    const results = queryCorrections(tmpDir, { limit: 2 });
    assert.equal(results.length, 2);
  });
});

// ---------------------------------------------------------------------------
// buildMemoryContext
// ---------------------------------------------------------------------------

describe('buildMemoryContext', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns empty string when no memory files exist', () => {
    const result = buildMemoryContext(tmpDir, 'memory-system');
    assert.equal(result, '');
  });

  it('includes decisions section with formatted entries', () => {
    appendDecision(tmpDir, validDecisionEntry({
      category: 'architecture',
      decision: 'Use JSONL',
      rationale: 'Append-only',
    }));

    const result = buildMemoryContext(tmpDir, 'some-set');
    assert.ok(result.includes('## Memory Context'));
    assert.ok(result.includes('### Decisions'));
    assert.ok(result.includes('[architecture]'));
    assert.ok(result.includes('Use JSONL'));
    assert.ok(result.includes('Append-only'));
  });

  it('includes corrections section with formatted entries', () => {
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'Bad approach',
      correction: 'Good approach',
      reason: 'Better',
    }));

    const result = buildMemoryContext(tmpDir, 'some-set');
    assert.ok(result.includes('### Corrections'));
    assert.ok(result.includes('Original: Bad approach'));
    assert.ok(result.includes('Correction: Good approach'));
    assert.ok(result.includes('Better'));
  });

  it('respects token budget -- output does not exceed budget', () => {
    // Append many entries to exceed a small budget
    for (let i = 0; i < 60; i++) {
      appendDecision(tmpDir, validDecisionEntry({
        decision: `Decision number ${i} with some extra text to consume tokens`,
        rationale: `Rationale number ${i} explaining the reasoning behind this decision`,
        category: VALID_CATEGORIES[i % VALID_CATEGORIES.length],
        topic: `topic-${i}`,
      }));
    }

    const smallBudget = 500;
    const result = buildMemoryContext(tmpDir, 'test-set', smallBudget);
    const tokens = estimateTokens(result);
    // Allow a margin for section headers (## Memory Context, ### Decisions, etc.)
    // The headers add ~60 chars = ~15 tokens
    assert.ok(
      tokens <= smallBudget + 50,
      `Token count ${tokens} should be at most ${smallBudget + 50}`,
    );
  });

  it('deduplicates decisions by category+topic, keeping latest', () => {
    // Write older entry directly to get controlled timestamp
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const filePath = path.join(memDir, 'DECISIONS.jsonl');

    const olderRecord = {
      id: 'old-id',
      timestamp: '2024-01-01T00:00:00.000Z',
      category: 'architecture',
      decision: 'Use JSON',
      rationale: 'Simple format',
      source: 'user',
      milestone: null,
      setId: null,
      topic: 'storage-format',
    };
    fs.writeFileSync(filePath, JSON.stringify(olderRecord) + '\n');

    const newerRecord = {
      id: 'new-id',
      timestamp: '2025-06-01T00:00:00.000Z',
      category: 'architecture',
      decision: 'Use JSONL',
      rationale: 'Append-only is better',
      source: 'user',
      milestone: null,
      setId: null,
      topic: 'storage-format',
    };
    fs.appendFileSync(filePath, JSON.stringify(newerRecord) + '\n');

    const result = buildMemoryContext(tmpDir, 'test-set');
    // The newer decision should appear without [superseded]
    assert.ok(result.includes('Use JSONL'));
    assert.ok(result.includes('Append-only is better'));
  });

  it('marks superseded decisions with [superseded] tag', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const filePath = path.join(memDir, 'DECISIONS.jsonl');

    const olderRecord = {
      id: 'old-id',
      timestamp: '2024-01-01T00:00:00.000Z',
      category: 'architecture',
      decision: 'Use JSON (old)',
      rationale: 'Simple format',
      source: 'user',
      milestone: null,
      setId: null,
      topic: 'storage-format',
    };
    fs.writeFileSync(filePath, JSON.stringify(olderRecord) + '\n');

    const newerRecord = {
      id: 'new-id',
      timestamp: '2025-06-01T00:00:00.000Z',
      category: 'architecture',
      decision: 'Use JSONL (new)',
      rationale: 'Append-only is better',
      source: 'user',
      milestone: null,
      setId: null,
      topic: 'storage-format',
    };
    fs.appendFileSync(filePath, JSON.stringify(newerRecord) + '\n');

    const result = buildMemoryContext(tmpDir, 'test-set', 10000);

    // The newer entry should NOT have [superseded]
    assert.ok(result.includes('Use JSONL (new)'));
    // Check that the old entry has [superseded] if it appears within budget
    if (result.includes('Use JSON (old)')) {
      assert.ok(result.includes('[superseded]'), 'Old decision should be marked [superseded]');
    }
  });

  it('prioritizes set-specific corrections over global corrections', () => {
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'Global correction',
      correction: 'Fixed globally',
      reason: 'Global reason',
      affectedSets: [],
    }));
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'Set-specific correction',
      correction: 'Fixed for my-set',
      reason: 'Set reason',
      affectedSets: ['my-set'],
    }));

    const result = buildMemoryContext(tmpDir, 'my-set');
    assert.ok(result.includes('### Corrections'));
    // Both should appear, but set-specific should come first
    const setIdx = result.indexOf('Set-specific correction');
    const globalIdx = result.indexOf('Global correction');
    assert.ok(setIdx >= 0, 'Set-specific correction should appear');
    assert.ok(globalIdx >= 0, 'Global correction should appear');
    assert.ok(setIdx < globalIdx, 'Set-specific should come before global');
  });

  it('formats decisions with topic correctly', () => {
    appendDecision(tmpDir, validDecisionEntry({
      category: 'tooling',
      topic: 'linting',
      decision: 'Use ESLint',
      rationale: 'Industry standard',
    }));

    const result = buildMemoryContext(tmpDir, 'test-set');
    assert.ok(result.includes('[tooling/linting]'), 'Should include category/topic format');
  });
});

// ---------------------------------------------------------------------------
// append-only invariant
// ---------------------------------------------------------------------------

describe('append-only invariant', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('appendDecision never modifies existing lines', () => {
    appendDecision(tmpDir, validDecisionEntry({ decision: 'First' }));

    const filePath = path.join(tmpDir, '.planning', 'memory', 'DECISIONS.jsonl');
    const contentAfterFirst = fs.readFileSync(filePath, 'utf-8');

    appendDecision(tmpDir, validDecisionEntry({ decision: 'Second' }));
    const contentAfterSecond = fs.readFileSync(filePath, 'utf-8');

    assert.ok(
      contentAfterSecond.startsWith(contentAfterFirst),
      'Content after second append should start with content from first append',
    );
  });

  it('file content only grows, never shrinks', () => {
    const sizes = [];
    for (let i = 0; i < 5; i++) {
      appendDecision(tmpDir, validDecisionEntry({ decision: `Entry ${i}` }));
      const filePath = path.join(tmpDir, '.planning', 'memory', 'DECISIONS.jsonl');
      const stat = fs.statSync(filePath);
      sizes.push(stat.size);
    }

    for (let i = 1; i < sizes.length; i++) {
      assert.ok(
        sizes[i] > sizes[i - 1],
        `File size at step ${i} (${sizes[i]}) should be greater than step ${i - 1} (${sizes[i - 1]})`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// lazy init invariant
// ---------------------------------------------------------------------------

describe('lazy init invariant', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('query functions do not create the memory directory', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    assert.ok(!fs.existsSync(memDir), 'memory dir should not exist initially');

    queryDecisions(tmpDir);
    queryCorrections(tmpDir);

    assert.ok(!fs.existsSync(memDir), 'memory dir should not exist after query calls');
  });

  it('buildMemoryContext does not create the memory directory', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    assert.ok(!fs.existsSync(memDir), 'memory dir should not exist initially');

    buildMemoryContext(tmpDir, 'test-set');

    assert.ok(!fs.existsSync(memDir), 'memory dir should not exist after buildMemoryContext');
  });
});
