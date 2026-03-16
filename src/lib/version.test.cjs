'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { getVersion, versionCheck } = require('./version.cjs');

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
