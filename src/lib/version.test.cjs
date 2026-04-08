'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  getVersion,
  versionCheck,
  writeInstallTimestamp,
  readInstallTimestamp,
  isUpdateStale,
} = require('./version.cjs');

// --- getVersion ---

describe('getVersion', () => {
  it('returns a string matching semver pattern', () => {
    const version = getVersion();
    assert.match(version, /^\d+\.\d+\.\d+$/);
  });

  it('returns the same version as package.json', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const version = getVersion();
    assert.equal(version, pkg.version);
  });
});

// --- versionCheck ---

describe('versionCheck', () => {
  it('returns needsUpdate true when installed < current (major)', () => {
    const result = versionCheck('2.0.0', '3.0.0');
    assert.deepStrictEqual(result, {
      needsUpdate: true,
      installed: '2.0.0',
      current: '3.0.0',
    });
  });

  it('returns needsUpdate false when installed == current', () => {
    const result = versionCheck('3.0.0', '3.0.0');
    assert.deepStrictEqual(result, {
      needsUpdate: false,
      installed: '3.0.0',
      current: '3.0.0',
    });
  });

  it('returns needsUpdate false when installed > current', () => {
    const result = versionCheck('4.0.0', '3.0.0');
    assert.deepStrictEqual(result, {
      needsUpdate: false,
      installed: '4.0.0',
      current: '3.0.0',
    });
  });

  it('returns needsUpdate true for minor version difference', () => {
    const result = versionCheck('3.0.0', '3.1.0');
    assert.deepStrictEqual(result, {
      needsUpdate: true,
      installed: '3.0.0',
      current: '3.1.0',
    });
  });

  it('returns needsUpdate true for patch version difference', () => {
    const result = versionCheck('3.0.0', '3.0.1');
    assert.deepStrictEqual(result, {
      needsUpdate: true,
      installed: '3.0.0',
      current: '3.0.1',
    });
  });

  it('returns needsUpdate false when installed patch is higher', () => {
    const result = versionCheck('3.0.2', '3.0.1');
    assert.deepStrictEqual(result, {
      needsUpdate: false,
      installed: '3.0.2',
      current: '3.0.1',
    });
  });
});

// --- version sync ---

describe('version sync', () => {
  it('package.json and plugin.json versions match', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pluginPath = path.resolve(__dirname, '../../.claude-plugin/plugin.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
    assert.equal(pkg.version, plugin.version,
      `package.json version (${pkg.version}) !== plugin.json version (${plugin.version})`);
  });

  it('getVersion() matches plugin.json version', () => {
    const pluginPath = path.resolve(__dirname, '../../.claude-plugin/plugin.json');
    const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf-8'));
    assert.equal(getVersion(), plugin.version);
  });
});

// --- runtime dependency pins ---

describe('runtime dependency pins', () => {
  const pkgPath = path.resolve(__dirname, '../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = pkg.dependencies || {};
  const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;

  it('package.json has a dependencies block', () => {
    assert.ok(Object.keys(deps).length > 0, 'expected at least one runtime dependency');
  });

  it('every runtime dependency is an exact semver (no ^ or ~)', () => {
    const unpinned = Object.entries(deps).filter(([, v]) => !EXACT_SEMVER.test(v));
    assert.deepEqual(
      unpinned,
      [],
      `unpinned runtime dependencies found: ${JSON.stringify(unpinned)}`
    );
  });

  it('pins zod to the exact resolved version (3.25.76)', () => {
    assert.equal(deps.zod, '3.25.76');
  });

  it('pins ajv to the exact resolved version (8.18.0)', () => {
    assert.equal(deps.ajv, '8.18.0');
  });

  it('pins ajv-formats to the exact resolved version (3.0.1)', () => {
    assert.equal(deps['ajv-formats'], '3.0.1');
  });

  it('pins proper-lockfile to the exact resolved version (4.1.2)', () => {
    assert.equal(deps['proper-lockfile'], '4.1.2');
  });
});

// --- staleness primitives ---

describe('install timestamp primitives', () => {
  let tmpRoot;
  let originalEnv;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-version-test-'));
    originalEnv = process.env.RAPID_UPDATE_THRESHOLD_DAYS;
    delete process.env.RAPID_UPDATE_THRESHOLD_DAYS;
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    if (originalEnv === undefined) {
      delete process.env.RAPID_UPDATE_THRESHOLD_DAYS;
    } else {
      process.env.RAPID_UPDATE_THRESHOLD_DAYS = originalEnv;
    }
  });

  it('writeInstallTimestamp writes ISO 8601 string to .rapid-install-meta.json', () => {
    writeInstallTimestamp(tmpRoot);
    const metaPath = path.join(tmpRoot, '.rapid-install-meta.json');
    assert.ok(fs.existsSync(metaPath), '.rapid-install-meta.json should exist');
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    assert.match(parsed.installedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('readInstallTimestamp round-trips a freshly written timestamp', () => {
    writeInstallTimestamp(tmpRoot);
    const timestamp = readInstallTimestamp(tmpRoot);
    assert.ok(timestamp);
    assert.ok(!Number.isNaN(new Date(timestamp).getTime()));
  });

  it('readInstallTimestamp returns null for missing file (no throw)', () => {
    const result = readInstallTimestamp(tmpRoot);
    assert.equal(result, null);
  });

  it('readInstallTimestamp returns null for malformed JSON (no throw)', () => {
    fs.writeFileSync(path.join(tmpRoot, '.rapid-install-meta.json'), '{not valid json');
    const result = readInstallTimestamp(tmpRoot);
    assert.equal(result, null);
  });

  it('isUpdateStale returns false when no timestamp recorded', () => {
    assert.equal(isUpdateStale(tmpRoot), false);
  });

  it('isUpdateStale returns true for timestamp older than 7 days (default)', () => {
    const oldTimestamp = new Date(Date.now() - 8 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: oldTimestamp })
    );
    assert.equal(isUpdateStale(tmpRoot), true);
  });

  it('isUpdateStale returns false for timestamp younger than 7 days', () => {
    const recentTimestamp = new Date(Date.now() - 3 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: recentTimestamp })
    );
    assert.equal(isUpdateStale(tmpRoot), false);
  });

  it('isUpdateStale honors explicit thresholdDays argument', () => {
    const fiveDaysOld = new Date(Date.now() - 5 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: fiveDaysOld })
    );
    assert.equal(isUpdateStale(tmpRoot, 3), true, '5 days old > 3 day threshold');
    assert.equal(isUpdateStale(tmpRoot, 10), false, '5 days old < 10 day threshold');
  });

  it('isUpdateStale honors RAPID_UPDATE_THRESHOLD_DAYS env var when arg omitted', () => {
    const fiveDaysOld = new Date(Date.now() - 5 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: fiveDaysOld })
    );
    process.env.RAPID_UPDATE_THRESHOLD_DAYS = '3';
    assert.equal(isUpdateStale(tmpRoot), true);
    process.env.RAPID_UPDATE_THRESHOLD_DAYS = '10';
    assert.equal(isUpdateStale(tmpRoot), false);
  });

  it('isUpdateStale -- explicit arg wins over env var', () => {
    const fiveDaysOld = new Date(Date.now() - 5 * 86400000).toISOString();
    fs.writeFileSync(
      path.join(tmpRoot, '.rapid-install-meta.json'),
      JSON.stringify({ installedAt: fiveDaysOld })
    );
    process.env.RAPID_UPDATE_THRESHOLD_DAYS = '10';
    // Explicit arg of 3 should beat env var of 10
    assert.equal(isUpdateStale(tmpRoot, 3), true);
  });
});
