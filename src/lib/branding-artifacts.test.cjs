'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const artifacts = require('./branding-artifacts.cjs');

describe('branding-artifacts.cjs', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-artifacts-test-'));
    const brandingDir = path.join(tmpDir, '.planning', 'branding');
    fs.mkdirSync(brandingDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // getManifestPath
  // -------------------------------------------------------------------------

  describe('getManifestPath()', () => {
    it('returns correct absolute path', () => {
      const result = artifacts.getManifestPath(tmpDir);
      const expected = path.join(tmpDir, '.planning', 'branding', 'artifacts.json');
      assert.equal(result, expected);
    });
  });

  // -------------------------------------------------------------------------
  // loadManifest
  // -------------------------------------------------------------------------

  describe('loadManifest()', () => {
    it('returns empty array when artifacts.json does not exist', () => {
      const result = artifacts.loadManifest(tmpDir);
      assert.deepEqual(result, []);
    });

    it('returns parsed array when valid artifacts.json exists', () => {
      const entries = [
        { id: 'a1', type: 'logo', filename: 'logo.svg', createdAt: '2026-01-01T00:00:00.000Z', description: 'Main logo' },
      ];
      const manifestPath = artifacts.getManifestPath(tmpDir);
      fs.writeFileSync(manifestPath, JSON.stringify(entries, null, 2) + '\n');

      const result = artifacts.loadManifest(tmpDir);
      assert.deepEqual(result, entries);
    });

    it('throws on invalid JSON in artifacts.json', () => {
      const manifestPath = artifacts.getManifestPath(tmpDir);
      fs.writeFileSync(manifestPath, JSON.stringify({ not: 'an array' }));

      assert.throws(
        () => artifacts.loadManifest(tmpDir),
        (err) => err.message.includes('Invalid manifest')
      );
    });
  });

  // -------------------------------------------------------------------------
  // saveManifest
  // -------------------------------------------------------------------------

  describe('saveManifest()', () => {
    it('writes valid manifest to disk, re-readable by loadManifest', () => {
      const entries = [
        { id: 'b1', type: 'wireframe', filename: 'wire.png', createdAt: '2026-02-01T00:00:00.000Z', description: 'Homepage wireframe' },
      ];
      artifacts.saveManifest(tmpDir, entries);

      const result = artifacts.loadManifest(tmpDir);
      assert.deepEqual(result, entries);
    });

    it('throws when given invalid data', () => {
      const bad = [{ missing: 'id field' }];
      assert.throws(
        () => artifacts.saveManifest(tmpDir, bad),
        (err) => err.message.includes('Invalid manifest data')
      );
    });
  });

  // -------------------------------------------------------------------------
  // createArtifact
  // -------------------------------------------------------------------------

  describe('createArtifact()', () => {
    it('creates entry with UUID id, ISO createdAt, correct fields', () => {
      const entry = artifacts.createArtifact(tmpDir, {
        type: 'logo',
        filename: 'logo.svg',
        description: 'Brand logo',
      });

      assert.ok(entry.id, 'should have id');
      // UUID v4 format check
      assert.match(entry.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      assert.ok(entry.createdAt, 'should have createdAt');
      // ISO 8601 parse check
      assert.ok(!isNaN(new Date(entry.createdAt).getTime()), 'createdAt should be valid ISO date');
      assert.equal(entry.type, 'logo');
      assert.equal(entry.filename, 'logo.svg');
      assert.equal(entry.description, 'Brand logo');
    });

    it('appends to existing manifest without clobbering', () => {
      const first = artifacts.createArtifact(tmpDir, {
        type: 'logo',
        filename: 'logo.svg',
        description: 'First',
      });

      const second = artifacts.createArtifact(tmpDir, {
        type: 'wireframe',
        filename: 'wire.png',
        description: 'Second',
      });

      const manifest = artifacts.loadManifest(tmpDir);
      assert.equal(manifest.length, 2);
      assert.equal(manifest[0].id, first.id);
      assert.equal(manifest[1].id, second.id);
    });
  });

  // -------------------------------------------------------------------------
  // listArtifacts
  // -------------------------------------------------------------------------

  describe('listArtifacts()', () => {
    it('returns all entries from manifest', () => {
      artifacts.createArtifact(tmpDir, { type: 'a', filename: 'a.svg', description: 'A' });
      artifacts.createArtifact(tmpDir, { type: 'b', filename: 'b.svg', description: 'B' });

      const list = artifacts.listArtifacts(tmpDir);
      assert.equal(list.length, 2);
    });
  });

  // -------------------------------------------------------------------------
  // getArtifact
  // -------------------------------------------------------------------------

  describe('getArtifact()', () => {
    it('returns entry by id, null for missing id', () => {
      const entry = artifacts.createArtifact(tmpDir, {
        type: 'logo',
        filename: 'logo.svg',
        description: 'Logo',
      });

      const found = artifacts.getArtifact(tmpDir, entry.id);
      assert.deepEqual(found, entry);

      const missing = artifacts.getArtifact(tmpDir, 'nonexistent-id');
      assert.equal(missing, null);
    });
  });

  // -------------------------------------------------------------------------
  // deleteArtifact
  // -------------------------------------------------------------------------

  describe('deleteArtifact()', () => {
    it('removes entry from manifest and deletes physical file', () => {
      const brandingDir = path.join(tmpDir, '.planning', 'branding');
      const filePath = path.join(brandingDir, 'logo.svg');
      fs.writeFileSync(filePath, '<svg></svg>');

      const entry = artifacts.createArtifact(tmpDir, {
        type: 'logo',
        filename: 'logo.svg',
        description: 'Logo',
      });

      const result = artifacts.deleteArtifact(tmpDir, entry.id);
      assert.equal(result.deleted, true);
      assert.equal(result.entry.id, entry.id);

      // Manifest should be empty
      const manifest = artifacts.loadManifest(tmpDir);
      assert.equal(manifest.length, 0);

      // File should be gone
      assert.ok(!fs.existsSync(filePath), 'physical file should be deleted');
    });

    it('returns { deleted: false } for non-existent id', () => {
      const result = artifacts.deleteArtifact(tmpDir, 'no-such-id');
      assert.deepEqual(result, { deleted: false });
    });

    it('succeeds even when physical file does not exist', () => {
      const entry = artifacts.createArtifact(tmpDir, {
        type: 'logo',
        filename: 'ghost.svg',
        description: 'No file on disk',
      });

      // Do not create ghost.svg on disk -- manifest-only entry
      const result = artifacts.deleteArtifact(tmpDir, entry.id);
      assert.equal(result.deleted, true);
      assert.equal(result.entry.id, entry.id);
    });
  });

  // -------------------------------------------------------------------------
  // listUntrackedFiles
  // -------------------------------------------------------------------------

  describe('listUntrackedFiles()', () => {
    it('returns files not in manifest, excludes infrastructure files', () => {
      const brandingDir = path.join(tmpDir, '.planning', 'branding');

      // Create some files on disk
      fs.writeFileSync(path.join(brandingDir, 'stray.png'), 'data');
      fs.writeFileSync(path.join(brandingDir, 'random.css'), 'body{}');

      // Create infrastructure files that should be excluded
      fs.writeFileSync(path.join(brandingDir, 'artifacts.json'), '[]');
      fs.writeFileSync(path.join(brandingDir, '.server.pid'), '{}');
      fs.writeFileSync(path.join(brandingDir, 'index.html'), '<html>');

      // Register one artifact so it is tracked
      artifacts.createArtifact(tmpDir, {
        type: 'image',
        filename: 'stray.png',
        description: 'Now tracked',
      });

      const untracked = artifacts.listUntrackedFiles(tmpDir);
      assert.ok(untracked.includes('random.css'), 'random.css should be untracked');
      assert.ok(!untracked.includes('stray.png'), 'stray.png should be tracked');
      assert.ok(!untracked.includes('artifacts.json'), 'artifacts.json is infra');
      assert.ok(!untracked.includes('.server.pid'), '.server.pid is infra');
      assert.ok(!untracked.includes('index.html'), 'index.html is infra');
    });

    it('returns empty array when all files are tracked', () => {
      const brandingDir = path.join(tmpDir, '.planning', 'branding');
      fs.writeFileSync(path.join(brandingDir, 'logo.svg'), '<svg>');

      artifacts.createArtifact(tmpDir, {
        type: 'logo',
        filename: 'logo.svg',
        description: 'Tracked',
      });

      const untracked = artifacts.listUntrackedFiles(tmpDir);
      assert.deepEqual(untracked, []);
    });
  });
});
