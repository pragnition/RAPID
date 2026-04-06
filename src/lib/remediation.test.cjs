'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  writeRemediationArtifact,
  readRemediationArtifact,
  listPendingRemediations,
  deleteRemediationArtifact,
} = require('./remediation.cjs');

/** Helper: build a valid remediation object */
function makeRemediation(overrides = {}) {
  return {
    scope: 'Fix broken imports',
    files: ['src/lib/foo.cjs'],
    deps: ['core-set'],
    severity: 'high',
    source: 'audit',
    ...overrides,
  };
}

describe('remediation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-remediation-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- writeRemediationArtifact ---

  describe('writeRemediationArtifact', () => {
    it('creates pending-sets directory and writes artifact', () => {
      writeRemediationArtifact(tmpDir, 'fix-imports', makeRemediation());

      const filePath = path.join(tmpDir, '.planning', 'pending-sets', 'fix-imports.json');
      assert.ok(fs.existsSync(filePath), 'artifact file should exist');

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.equal(parsed.setName, 'fix-imports');
      assert.equal(parsed.scope, 'Fix broken imports');
      assert.deepEqual(parsed.files, ['src/lib/foo.cjs']);
      assert.deepEqual(parsed.deps, ['core-set']);
      assert.equal(parsed.severity, 'high');
      assert.equal(parsed.source, 'audit');
      assert.ok(parsed.createdAt, 'createdAt should be set');
      // Verify createdAt is a valid ISO date
      assert.ok(!isNaN(Date.parse(parsed.createdAt)), 'createdAt should be valid ISO date');
    });

    it('overwrites existing artifact with same name', () => {
      writeRemediationArtifact(tmpDir, 'fix-imports', makeRemediation({ scope: 'first' }));
      writeRemediationArtifact(tmpDir, 'fix-imports', makeRemediation({ scope: 'second' }));

      const filePath = path.join(tmpDir, '.planning', 'pending-sets', 'fix-imports.json');
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      assert.equal(parsed.scope, 'second', 'second write should overwrite first');
    });

    it('preserves existing artifacts when writing a new one', () => {
      writeRemediationArtifact(tmpDir, 'set-alpha', makeRemediation({ scope: 'alpha' }));
      writeRemediationArtifact(tmpDir, 'set-beta', makeRemediation({ scope: 'beta' }));

      const dir = path.join(tmpDir, '.planning', 'pending-sets');
      const files = fs.readdirSync(dir);
      assert.equal(files.length, 2, 'both artifacts should exist');
      assert.ok(files.includes('set-alpha.json'));
      assert.ok(files.includes('set-beta.json'));
    });
  });

  // --- readRemediationArtifact ---

  describe('readRemediationArtifact', () => {
    it('returns parsed artifact when file exists', () => {
      writeRemediationArtifact(tmpDir, 'fix-imports', makeRemediation());
      const result = readRemediationArtifact(tmpDir, 'fix-imports');

      assert.notEqual(result, null);
      assert.equal(result.setName, 'fix-imports');
      assert.equal(result.scope, 'Fix broken imports');
      assert.deepEqual(result.files, ['src/lib/foo.cjs']);
      assert.deepEqual(result.deps, ['core-set']);
      assert.equal(result.severity, 'high');
      assert.equal(result.source, 'audit');
    });

    it('returns null when file does not exist', () => {
      // Ensure the directory exists but the specific file does not
      fs.mkdirSync(path.join(tmpDir, '.planning', 'pending-sets'), { recursive: true });
      const result = readRemediationArtifact(tmpDir, 'nonexistent');
      assert.equal(result, null);
    });

    it('returns null when pending-sets directory does not exist', () => {
      // tmpDir has no .planning/pending-sets/ at all
      const result = readRemediationArtifact(tmpDir, 'anything');
      assert.equal(result, null);
    });

    it('returns null and warns on malformed JSON', () => {
      const dir = path.join(tmpDir, '.planning', 'pending-sets');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'broken.json'), '{ NOT VALID JSON!!!');

      const result = readRemediationArtifact(tmpDir, 'broken');
      assert.equal(result, null);
    });

    it('returns null when artifact is missing required fields', () => {
      const dir = path.join(tmpDir, '.planning', 'pending-sets');
      fs.mkdirSync(dir, { recursive: true });
      // Write a JSON file missing setName, scope, source
      fs.writeFileSync(path.join(dir, 'incomplete.json'), JSON.stringify({ foo: 'bar' }));

      const result = readRemediationArtifact(tmpDir, 'incomplete');
      assert.equal(result, null);
    });
  });

  // --- listPendingRemediations ---

  describe('listPendingRemediations', () => {
    it('returns empty array when directory does not exist', () => {
      const result = listPendingRemediations(tmpDir);
      assert.deepEqual(result, []);
    });

    it('returns empty array when directory is empty', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'pending-sets'), { recursive: true });
      const result = listPendingRemediations(tmpDir);
      assert.deepEqual(result, []);
    });

    it('returns sorted set names from JSON files', () => {
      writeRemediationArtifact(tmpDir, 'bravo', makeRemediation());
      writeRemediationArtifact(tmpDir, 'alpha', makeRemediation());
      writeRemediationArtifact(tmpDir, 'charlie', makeRemediation());

      const result = listPendingRemediations(tmpDir);
      assert.deepEqual(result, ['alpha', 'bravo', 'charlie']);
    });

    it('ignores non-JSON files', () => {
      writeRemediationArtifact(tmpDir, 'valid-set', makeRemediation());

      // Write a non-JSON file alongside
      const dir = path.join(tmpDir, '.planning', 'pending-sets');
      fs.writeFileSync(path.join(dir, 'notes.txt'), 'some notes');

      const result = listPendingRemediations(tmpDir);
      assert.deepEqual(result, ['valid-set']);
    });
  });

  // --- deleteRemediationArtifact ---

  describe('deleteRemediationArtifact', () => {
    it('deletes existing artifact and returns true', () => {
      writeRemediationArtifact(tmpDir, 'to-delete', makeRemediation());
      const filePath = path.join(tmpDir, '.planning', 'pending-sets', 'to-delete.json');
      assert.ok(fs.existsSync(filePath), 'artifact should exist before delete');

      const result = deleteRemediationArtifact(tmpDir, 'to-delete');
      assert.equal(result, true);
      assert.ok(!fs.existsSync(filePath), 'artifact should be gone after delete');
    });

    it('returns false when artifact does not exist', () => {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'pending-sets'), { recursive: true });
      const result = deleteRemediationArtifact(tmpDir, 'nonexistent');
      assert.equal(result, false);
    });

    it('returns false when directory does not exist', () => {
      const result = deleteRemediationArtifact(tmpDir, 'anything');
      assert.equal(result, false);
    });
  });

  // --- behavioral contracts ---

  describe('behavioral contracts', () => {
    it('survives /clear (artifacts are on-disk files)', () => {
      writeRemediationArtifact(tmpDir, 'persist-test', makeRemediation({ scope: 'durability' }));

      // Simulate /clear by re-requiring the module (fresh module reference)
      const freshModule = require('./remediation.cjs');
      const result = freshModule.readRemediationArtifact(tmpDir, 'persist-test');

      assert.notEqual(result, null);
      assert.equal(result.scope, 'durability');
      assert.equal(result.setName, 'persist-test');
    });

    it('graceful fallback when no artifacts exist', () => {
      const list = listPendingRemediations(tmpDir);
      assert.deepEqual(list, []);

      const read = readRemediationArtifact(tmpDir, 'nonexistent');
      assert.equal(read, null);
    });
  });
});
