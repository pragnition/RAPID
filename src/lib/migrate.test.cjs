'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { detectVersion, isLatestVersion, createBackup, restoreBackup, cleanupBackup, _countFiles } = require('./migrate.cjs');
const { getVersion } = require('./version.cjs');

// --- detectVersion ---

describe('detectVersion', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-migrate-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should detect version from rapidVersion field', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), JSON.stringify({
      rapidVersion: '3.2.0',
      milestones: {},
    }));

    const result = detectVersion(tmpDir);
    assert.equal(result.detected, '3.2.0');
    assert.equal(result.confidence, 'high');
    assert.ok(result.signals.includes('rapidVersion field present'));
  });

  it('should detect v3.2.0 from version-prefixed milestone without rapidVersion', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), JSON.stringify({
      currentMilestone: 'v3.3.0',
      milestones: {
        'v3.3.0': {
          sets: {
            'some-set': { status: 'discussed' },
          },
        },
      },
    }));

    const result = detectVersion(tmpDir);
    assert.equal(result.detected, '3.2.0');
    assert.equal(result.confidence, 'medium');
    assert.ok(result.signals.some((s) => s.includes('Version-prefixed')));
    assert.ok(result.signals.some((s) => s.includes('Past-tense')));
  });

  it('should detect v3.1.0 from past-tense statuses without rapidVersion', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), JSON.stringify({
      currentMilestone: 'some-milestone',
      milestones: {
        'some-milestone': {
          sets: {
            'my-set': { status: 'discussed' },
          },
        },
      },
    }));

    const result = detectVersion(tmpDir);
    assert.equal(result.detected, '3.1.0');
    assert.equal(result.confidence, 'medium');
    assert.ok(result.signals.some((s) => s.includes('Past-tense')));
  });

  it('should detect v3.0.0 from present-tense statuses', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), JSON.stringify({
      currentMilestone: 'some-milestone',
      milestones: {
        'some-milestone': {
          sets: {
            'my-set': { status: 'discussing' },
          },
        },
      },
    }));

    const result = detectVersion(tmpDir);
    assert.equal(result.detected, '3.0.0');
    assert.equal(result.confidence, 'medium');
    assert.ok(result.signals.some((s) => s.includes('Present-tense')));
  });

  it('should detect v2.0.0 from numeric-prefix milestone IDs', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), JSON.stringify({
      currentMilestone: '01-plugin-infrastructure',
      milestones: {
        '01-plugin-infrastructure': {
          sets: {
            'core': { status: 'complete' },
          },
        },
      },
    }));

    const result = detectVersion(tmpDir);
    assert.equal(result.detected, '2.0.0');
    assert.equal(result.confidence, 'low');
    assert.ok(result.signals.some((s) => s.includes('Numeric-prefix')));
  });

  it('should detect v1.0.0 from STATE.md presence', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# Old state file\n');

    const result = detectVersion(tmpDir);
    assert.equal(result.detected, '1.0.0');
    assert.equal(result.confidence, 'medium');
    assert.ok(result.signals.some((s) => s.includes('STATE.md')));
  });

  it('should return null when no state files exist', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    const result = detectVersion(tmpDir);
    assert.equal(result.detected, null);
    assert.equal(result.confidence, 'low');
    assert.ok(result.signals.some((s) => s.includes('No state files found')));
  });

  it('should return null when .planning/ directory is missing', () => {
    const result = detectVersion(tmpDir);
    assert.equal(result.detected, null);
    assert.equal(result.confidence, 'low');
    assert.ok(result.signals.some((s) => s.includes('No .planning/ directory found')));
  });
});

// --- isLatestVersion ---

describe('isLatestVersion', () => {
  it('should return true when detected version matches current', () => {
    const current = getVersion();
    assert.equal(isLatestVersion(current), true);
  });

  it('should return false when detected version is older', () => {
    assert.equal(isLatestVersion('1.0.0'), false);
  });

  it('should return true when detected version is newer', () => {
    assert.equal(isLatestVersion('99.0.0'), true);
  });
});

// --- createBackup ---

describe('createBackup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-migrate-backup-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create backup of .planning/ directory', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), '{"test": true}');
    fs.mkdirSync(path.join(planningDir, 'sets', 'my-set'), { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'sets', 'my-set', 'CONTRACT.json'), '{}');

    const result = createBackup(tmpDir);
    const backupPath = path.join(planningDir, '.pre-migrate-backup');

    assert.equal(result.backupPath, backupPath);
    assert.ok(result.fileCount > 0);
    assert.ok(fs.existsSync(backupPath));
    assert.ok(fs.existsSync(path.join(backupPath, 'STATE.json')));
    assert.ok(fs.existsSync(path.join(backupPath, 'sets', 'my-set', 'CONTRACT.json')));
  });

  it('should exclude .locks/ from backup', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(path.join(planningDir, '.locks'), { recursive: true });
    fs.writeFileSync(path.join(planningDir, '.locks', 'test.lock'), 'locked');
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), '{}');

    const result = createBackup(tmpDir);
    const backupLocksPath = path.join(result.backupPath, '.locks');

    assert.ok(!fs.existsSync(backupLocksPath), '.locks/ should not exist in backup');
  });

  it('should throw if backup already exists', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(path.join(planningDir, '.pre-migrate-backup'), { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), '{}');

    assert.throws(
      () => createBackup(tmpDir),
      (err) => {
        assert.ok(err.message.includes('already exists'));
        return true;
      },
    );
  });

  it('should count files correctly', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), '{}');
    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), '# Roadmap');
    fs.mkdirSync(path.join(planningDir, 'sets'), { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'sets', 'test.json'), '{}');

    const result = createBackup(tmpDir);
    // 3 original files + the backup itself contains copies of those 3 files
    // But backup is inside .planning, so cpSync copies everything including newly created backup recursively.
    // Actually, cpSync with filter is called before backup dir exists for the content,
    // so it just copies STATE.json, ROADMAP.md, sets/test.json = 3 files
    assert.equal(result.fileCount, 3);
  });
});

// --- restoreBackup ---

describe('restoreBackup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-migrate-restore-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should restore backup and remove backup directory', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    const originalContent = JSON.stringify({ version: 'original', milestones: {} });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), originalContent);

    // Create backup
    createBackup(tmpDir);

    // Modify STATE.json to simulate migration changes
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), JSON.stringify({ version: 'modified' }));

    // Restore
    const result = restoreBackup(tmpDir);
    assert.equal(result.restored, true);
    assert.ok(result.fileCount > 0);

    // Verify content was restored
    const restored = fs.readFileSync(path.join(planningDir, 'STATE.json'), 'utf-8');
    assert.equal(restored, originalContent);

    // Verify backup directory is gone
    const backupPath = path.join(planningDir, '.pre-migrate-backup');
    assert.ok(!fs.existsSync(backupPath), 'Backup should be removed after restore');
  });

  it('should return restored:false when no backup exists', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    const result = restoreBackup(tmpDir);
    assert.deepStrictEqual(result, { restored: false, fileCount: 0 });
  });
});

// --- cleanupBackup ---

describe('cleanupBackup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-migrate-cleanup-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should remove backup directory', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.json'), '{}');

    createBackup(tmpDir);
    const backupPath = path.join(planningDir, '.pre-migrate-backup');
    assert.ok(fs.existsSync(backupPath), 'Backup should exist before cleanup');

    const result = cleanupBackup(tmpDir);
    assert.deepStrictEqual(result, { cleaned: true });
    assert.ok(!fs.existsSync(backupPath), 'Backup should be gone after cleanup');
  });

  it('should return cleaned:false when no backup exists', () => {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    const result = cleanupBackup(tmpDir);
    assert.deepStrictEqual(result, { cleaned: false });
  });
});
