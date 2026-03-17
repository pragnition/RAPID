'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  appendQuickTask,
  listQuickTasks,
  showQuickTask,
} = require('./quick-log.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quick-log-test-'));
  // Create .planning/ so path resolution works
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  return tmpDir;
}

function validQuickEntry(overrides) {
  return {
    description: 'Implement widget parser',
    outcome: 'COMPLETE',
    slug: 'widget-parser',
    branch: 'rapid/quick-and-addset',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// appendQuickTask
// ---------------------------------------------------------------------------

describe('appendQuickTask', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('creates .planning/memory/ directory on first write', () => {
    const memDir = path.join(tmpDir, '.planning', 'memory');
    assert.ok(!fs.existsSync(memDir), 'memory dir should not exist before first write');
    appendQuickTask(tmpDir, validQuickEntry());
    assert.ok(fs.existsSync(memDir), 'memory dir should exist after first write');
  });

  it('writes valid JSONL line with all required fields', () => {
    const record = appendQuickTask(tmpDir, validQuickEntry());
    const filePath = path.join(tmpDir, '.planning', 'memory', 'quick-tasks.jsonl');
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    const parsed = JSON.parse(content);

    assert.ok(parsed.id, 'should have auto-generated id');
    assert.ok(parsed.timestamp, 'should have auto-generated timestamp');
    assert.equal(parsed.description, 'Implement widget parser');
    assert.equal(parsed.outcome, 'COMPLETE');
    assert.equal(parsed.slug, 'widget-parser');
    assert.equal(parsed.branch, 'rapid/quick-and-addset');
  });

  it('assigns monotonic integer ID starting at 1 for empty file', () => {
    const record = appendQuickTask(tmpDir, validQuickEntry());
    assert.equal(record.id, 1);
  });

  it('increments ID based on max existing ID', () => {
    const r1 = appendQuickTask(tmpDir, validQuickEntry({ description: 'First' }));
    const r2 = appendQuickTask(tmpDir, validQuickEntry({ description: 'Second' }));
    const r3 = appendQuickTask(tmpDir, validQuickEntry({ description: 'Third' }));

    assert.equal(r1.id, 1);
    assert.equal(r2.id, 2);
    assert.equal(r3.id, 3);
  });

  it('handles non-sequential IDs (finds max)', () => {
    // Manually write a JSONL file with id=5
    const memDir = path.join(tmpDir, '.planning', 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    const filePath = path.join(memDir, 'quick-tasks.jsonl');
    const manualRecord = JSON.stringify({
      id: 5,
      timestamp: '2025-01-01T00:00:00.000Z',
      description: 'Manual entry',
      outcome: 'COMPLETE',
      slug: 'manual',
      branch: 'main',
    });
    fs.writeFileSync(filePath, manualRecord + '\n');

    const record = appendQuickTask(tmpDir, validQuickEntry({ description: 'After manual' }));
    assert.equal(record.id, 6);
  });

  it('throws on missing description', () => {
    assert.throws(
      () => appendQuickTask(tmpDir, { outcome: 'COMPLETE', slug: 'test', branch: 'main' }),
      /description/,
    );
  });

  it('throws on missing outcome', () => {
    assert.throws(
      () => appendQuickTask(tmpDir, { description: 'test', slug: 'test', branch: 'main' }),
      /outcome/,
    );
  });

  it('throws on missing slug', () => {
    assert.throws(
      () => appendQuickTask(tmpDir, { description: 'test', outcome: 'COMPLETE', branch: 'main' }),
      /slug/,
    );
  });

  it('throws on missing branch', () => {
    assert.throws(
      () => appendQuickTask(tmpDir, { description: 'test', outcome: 'COMPLETE', slug: 'test' }),
      /branch/,
    );
  });

  it('generates ISO timestamp', () => {
    const record = appendQuickTask(tmpDir, validQuickEntry());
    // ISO 8601 pattern: YYYY-MM-DDTHH:mm:ss.sssZ
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    assert.ok(isoPattern.test(record.timestamp), `Timestamp '${record.timestamp}' should match ISO 8601 pattern`);
  });
});

// ---------------------------------------------------------------------------
// listQuickTasks
// ---------------------------------------------------------------------------

describe('listQuickTasks', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns empty array when file does not exist', () => {
    const result = listQuickTasks(tmpDir);
    assert.deepEqual(result, []);
  });

  it('returns entries sorted by id descending', () => {
    appendQuickTask(tmpDir, validQuickEntry({ description: 'First' }));
    appendQuickTask(tmpDir, validQuickEntry({ description: 'Second' }));
    appendQuickTask(tmpDir, validQuickEntry({ description: 'Third' }));

    const result = listQuickTasks(tmpDir);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, 3);
    assert.equal(result[1].id, 2);
    assert.equal(result[2].id, 1);
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 5; i++) {
      appendQuickTask(tmpDir, validQuickEntry({ description: `Entry ${i}` }));
    }

    const result = listQuickTasks(tmpDir, 2);
    assert.equal(result.length, 2);
    // Should be the most recent two (ids 5 and 4)
    assert.equal(result[0].id, 5);
    assert.equal(result[1].id, 4);
  });

  it('skips malformed JSONL lines', () => {
    // Write one good line
    appendQuickTask(tmpDir, validQuickEntry({ description: 'Good entry' }));

    // Manually append a malformed line
    const filePath = path.join(tmpDir, '.planning', 'memory', 'quick-tasks.jsonl');
    fs.appendFileSync(filePath, 'this is not json\n');
    fs.appendFileSync(filePath, '{broken json\n');

    const result = listQuickTasks(tmpDir);
    assert.equal(result.length, 1);
    assert.equal(result[0].description, 'Good entry');
  });
});

// ---------------------------------------------------------------------------
// showQuickTask
// ---------------------------------------------------------------------------

describe('showQuickTask', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns null when file does not exist', () => {
    const result = showQuickTask(tmpDir, 1);
    assert.equal(result, null);
  });

  it('returns null for non-existent ID', () => {
    appendQuickTask(tmpDir, validQuickEntry({ description: 'Only entry' }));
    const result = showQuickTask(tmpDir, 999);
    assert.equal(result, null);
  });

  it('finds entry by numeric ID', () => {
    appendQuickTask(tmpDir, validQuickEntry({ description: 'First' }));
    appendQuickTask(tmpDir, validQuickEntry({ description: 'Second' }));
    appendQuickTask(tmpDir, validQuickEntry({ description: 'Third' }));

    const result = showQuickTask(tmpDir, 2);
    assert.ok(result !== null);
    assert.equal(result.id, 2);
    assert.equal(result.description, 'Second');
  });

  it('handles string ID input by converting to number', () => {
    appendQuickTask(tmpDir, validQuickEntry({ description: 'First' }));
    appendQuickTask(tmpDir, validQuickEntry({ description: 'Second' }));

    const result = showQuickTask(tmpDir, '2');
    assert.ok(result !== null);
    assert.equal(result.id, 2);
    assert.equal(result.description, 'Second');
  });
});
