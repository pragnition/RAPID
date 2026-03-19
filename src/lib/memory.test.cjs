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

// ===========================================================================
// NEW TESTS -- Approved test plan for context-management concern
// ===========================================================================

// ---------------------------------------------------------------------------
// appendDecision -- null and non-object entry validation
// ---------------------------------------------------------------------------
describe('appendDecision - entry validation edge cases', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  // BEHAVIOR: appendDecision must reject null entry with 'entry must be an object'
  // GUARDS AGAINST: null passing the typeof check (typeof null === 'object')
  // but the code uses !entry || typeof entry !== 'object' which catches null
  it('appendDecision throws on null entry', () => {
    assert.throws(
      () => appendDecision(tmpDir, null),
      /entry must be an object/,
    );
  });

  // BEHAVIOR: appendDecision must reject string entry with 'entry must be an object'
  // GUARDS AGAINST: Callers passing serialized JSON strings instead of objects
  it('appendDecision throws on non-object entry (string)', () => {
    assert.throws(
      () => appendDecision(tmpDir, 'not an object'),
      /entry must be an object/,
    );
  });
});

// ---------------------------------------------------------------------------
// appendCorrection -- validation edge cases
// ---------------------------------------------------------------------------
describe('appendCorrection - validation edge cases', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  // BEHAVIOR: appendCorrection must reject null entry with 'entry must be an object'
  // GUARDS AGAINST: null passing typeof check
  it('appendCorrection throws on null entry', () => {
    assert.throws(
      () => appendCorrection(tmpDir, null),
      /entry must be an object/,
    );
  });

  // BEHAVIOR: appendCorrection must reject entry missing the correction field
  // GUARDS AGAINST: Partial entries being silently accepted and written to JSONL
  it('appendCorrection throws on missing correction field', () => {
    assert.throws(
      () => appendCorrection(tmpDir, {
        original: 'Some original',
        reason: 'Some reason',
      }),
      /correction is required/,
    );
  });

  // BEHAVIOR: appendCorrection must reject entry missing the reason field
  // GUARDS AGAINST: Corrections without rationale being persisted
  it('appendCorrection throws on missing reason field', () => {
    assert.throws(
      () => appendCorrection(tmpDir, {
        original: 'Some original',
        correction: 'Some correction',
      }),
      /reason is required/,
    );
  });

  // BEHAVIOR: appendCorrection should include optional milestone and setId
  // when they are provided in the entry
  // GUARDS AGAINST: Optional fields being silently dropped during record creation
  it('appendCorrection includes optional milestone and setId when provided', () => {
    const record = appendCorrection(tmpDir, validCorrectionEntry({
      milestone: 'v3.5.0',
      setId: 'agent-prompts',
    }));

    assert.equal(record.milestone, 'v3.5.0');
    assert.equal(record.setId, 'agent-prompts');

    // Verify it was actually persisted to disk
    const filePath = path.join(tmpDir, '.planning', 'memory', 'CORRECTIONS.jsonl');
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    const parsed = JSON.parse(content);
    assert.equal(parsed.milestone, 'v3.5.0');
    assert.equal(parsed.setId, 'agent-prompts');
  });
});

// ---------------------------------------------------------------------------
// queryDecisions -- combined filters
// ---------------------------------------------------------------------------
describe('queryDecisions - combined filters', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  // BEHAVIOR: queryDecisions should apply both category and setId filters together
  // GUARDS AGAINST: Filters being applied as OR instead of AND, returning too many results
  it('queryDecisions applies combined filters (category + setId)', () => {
    appendDecision(tmpDir, validDecisionEntry({
      category: 'architecture',
      setId: 'memory-system',
      decision: 'Match both',
    }));
    appendDecision(tmpDir, validDecisionEntry({
      category: 'architecture',
      setId: 'hooks-system',
      decision: 'Match category only',
    }));
    appendDecision(tmpDir, validDecisionEntry({
      category: 'testing',
      setId: 'memory-system',
      decision: 'Match setId only',
    }));
    appendDecision(tmpDir, validDecisionEntry({
      category: 'testing',
      setId: 'hooks-system',
      decision: 'Match neither',
    }));

    const results = queryDecisions(tmpDir, { category: 'architecture', setId: 'memory-system' });
    assert.equal(results.length, 1);
    assert.equal(results[0].decision, 'Match both');
  });
});

// ---------------------------------------------------------------------------
// queryCorrections -- additional filter tests
// ---------------------------------------------------------------------------
describe('queryCorrections - additional filters', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  // BEHAVIOR: queryCorrections should filter by setId field
  // GUARDS AGAINST: setId filter being ignored or filtering by wrong field
  it('queryCorrections filters by setId', () => {
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'A',
      setId: 'memory-system',
    }));
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'B',
      setId: 'hooks-system',
    }));
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'C',
      setId: 'memory-system',
    }));

    const results = queryCorrections(tmpDir, { setId: 'memory-system' });
    assert.equal(results.length, 2);
    const originals = results.map((r) => r.original);
    assert.ok(originals.includes('A'));
    assert.ok(originals.includes('C'));
  });

  // BEHAVIOR: queryCorrections should return entries sorted by timestamp descending
  // (later timestamps first)
  // GUARDS AGAINST: Results being returned in insertion order instead of recency order
  it('queryCorrections returns sorted by timestamp descending', () => {
    // Write entries with controlled timestamps
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const filePath = path.join(memDir, 'CORRECTIONS.jsonl');

    const earlyRecord = {
      id: 'early-id',
      timestamp: '2024-01-01T00:00:00.000Z',
      original: 'Early',
      correction: 'Early fix',
      reason: 'Early reason',
      affectedSets: [],
      setId: null,
      milestone: null,
    };
    const lateRecord = {
      id: 'late-id',
      timestamp: '2025-06-01T00:00:00.000Z',
      original: 'Late',
      correction: 'Late fix',
      reason: 'Late reason',
      affectedSets: [],
      setId: null,
      milestone: null,
    };

    // Write early first, then late
    fs.writeFileSync(filePath, JSON.stringify(earlyRecord) + '\n');
    fs.appendFileSync(filePath, JSON.stringify(lateRecord) + '\n');

    const results = queryCorrections(tmpDir);
    assert.equal(results.length, 2);
    // Late should come first (descending)
    assert.equal(results[0].original, 'Late');
    assert.equal(results[1].original, 'Early');
    assert.ok(results[0].timestamp > results[1].timestamp);
  });

  // BEHAVIOR: queryCorrections should apply both affectedSet and limit filters together
  // GUARDS AGAINST: Limit being applied before filtering (wrong order) or filters being
  // applied as OR instead of AND
  it('queryCorrections applies combined filters (affectedSet + limit)', () => {
    for (let i = 0; i < 5; i++) {
      appendCorrection(tmpDir, validCorrectionEntry({
        original: `Targeted ${i}`,
        affectedSets: ['target-set'],
      }));
    }
    // Add some that don't match the affectedSet filter
    for (let i = 0; i < 3; i++) {
      appendCorrection(tmpDir, validCorrectionEntry({
        original: `Other ${i}`,
        affectedSets: ['other-set'],
      }));
    }

    const results = queryCorrections(tmpDir, { affectedSet: 'target-set', limit: 2 });
    assert.equal(results.length, 2);
    // All results should be for target-set
    for (const r of results) {
      assert.ok(r.original.startsWith('Targeted'));
    }
  });
});

// ---------------------------------------------------------------------------
// buildMemoryContext -- edge cases
// ---------------------------------------------------------------------------
describe('buildMemoryContext - context-management edge cases', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  // BEHAVIOR: When setName is null, buildMemoryContext should skip set-specific
  // corrections query (no affectedSet filter) and only show global corrections
  // GUARDS AGAINST: Null setName causing a crash in the affectedSet filter
  it('buildMemoryContext with null setName skips set-specific corrections', () => {
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'Global issue',
      correction: 'Global fix',
      reason: 'Applies everywhere',
      affectedSets: ['some-set'],
    }));
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'Another issue',
      correction: 'Another fix',
      reason: 'Also global',
      affectedSets: [],
    }));

    // null setName -- setCorrections will be [], only globalCorrections used
    const result = buildMemoryContext(tmpDir, null);
    assert.ok(result.includes('### Corrections'));
    // Both corrections should appear (both are in globalCorrections)
    assert.ok(result.includes('Global issue'));
    assert.ok(result.includes('Another issue'));
  });

  // BEHAVIOR: When only decisions exist (no corrections), the corrections
  // section should show "(no corrections recorded)"
  // GUARDS AGAINST: Missing placeholder text or section being omitted entirely
  it('buildMemoryContext shows "(no corrections recorded)" when only decisions exist', () => {
    appendDecision(tmpDir, validDecisionEntry({ decision: 'Some decision' }));

    const result = buildMemoryContext(tmpDir, 'test-set');
    assert.ok(result.includes('(no corrections recorded)'),
      'Should show placeholder for empty corrections section');
    assert.ok(result.includes('### Decisions'));
    assert.ok(result.includes('Some decision'));
  });

  // BEHAVIOR: When only corrections exist (no decisions), the decisions
  // section should show "(no decisions recorded)"
  // GUARDS AGAINST: Missing placeholder text or section being omitted entirely
  it('buildMemoryContext shows "(no decisions recorded)" when only corrections exist', () => {
    appendCorrection(tmpDir, validCorrectionEntry({
      original: 'Some original',
      correction: 'Some correction',
      reason: 'Some reason',
    }));

    const result = buildMemoryContext(tmpDir, 'test-set');
    assert.ok(result.includes('(no decisions recorded)'),
      'Should show placeholder for empty decisions section');
    assert.ok(result.includes('### Corrections'));
    assert.ok(result.includes('Some correction'));
  });

  // BEHAVIOR: Decisions with the same category but null topic should be
  // deduplicated together -- category::'' is the dedup key for null topics.
  // When two entries share the same category and both have null topics,
  // the latest one wins and the older is marked superseded.
  // GUARDS AGAINST: Null topic creating unique keys per entry (no dedup)
  it('buildMemoryContext deduplicates entries with null topic on same category', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const filePath = path.join(memDir, 'DECISIONS.jsonl');

    const olderRecord = {
      id: 'old-null-topic',
      timestamp: '2024-01-01T00:00:00.000Z',
      category: 'convention',
      decision: 'Old convention decision',
      rationale: 'Old reason',
      source: 'user',
      milestone: null,
      setId: null,
      topic: null,
    };
    const newerRecord = {
      id: 'new-null-topic',
      timestamp: '2025-06-01T00:00:00.000Z',
      category: 'convention',
      decision: 'New convention decision',
      rationale: 'New reason',
      source: 'user',
      milestone: null,
      setId: null,
      topic: null,
    };

    fs.writeFileSync(filePath, JSON.stringify(olderRecord) + '\n');
    fs.appendFileSync(filePath, JSON.stringify(newerRecord) + '\n');

    const result = buildMemoryContext(tmpDir, 'test-set', 10000);
    // Newer should appear without [superseded]
    assert.ok(result.includes('New convention decision'));
    // If old appears, it should be marked superseded
    if (result.includes('Old convention decision')) {
      assert.ok(result.includes('[superseded]'),
        'Old entry with same category+null topic should be marked [superseded]');
    }
  });

  // BEHAVIOR: The correction section has its own independent token budget
  // (30% of total budget by default). When corrections exceed this budget,
  // they should be truncated independently of the decisions section.
  // GUARDS AGAINST: Correction and decision budgets bleeding into each other,
  // or corrections consuming the entire budget
  it('buildMemoryContext respects correction token budget independently', () => {
    // Add a few decisions (small)
    appendDecision(tmpDir, validDecisionEntry({
      decision: 'Keep it simple',
      rationale: 'KISS principle',
    }));

    // Add many corrections to exceed the correction budget
    // With budget=200, correction budget = 200 * 0.3 = 60 tokens
    for (let i = 0; i < 30; i++) {
      appendCorrection(tmpDir, validCorrectionEntry({
        original: `Original problem number ${i} that is quite lengthy to consume tokens`,
        correction: `Corrected approach number ${i} with detailed explanation`,
        reason: `Reason number ${i} explaining why this correction is needed`,
      }));
    }

    const tinyBudget = 200; // 200 tokens total, 60 tokens for corrections
    const result = buildMemoryContext(tmpDir, 'test-set', tinyBudget);

    // Count correction lines (each starts with "- Original:")
    const correctionLines = result.split('\n').filter(
      (line) => line.startsWith('- Original:'),
    );

    // Should have some corrections but not all 30 (budget limits them)
    assert.ok(correctionLines.length > 0, 'Should include at least one correction');
    assert.ok(correctionLines.length < 30,
      `Should truncate corrections (got ${correctionLines.length} of 30)`);

    // Decision should still appear (it has its own budget)
    assert.ok(result.includes('Keep it simple'),
      'Decision should appear despite correction budget exhaustion');
  });
});
