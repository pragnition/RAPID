'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Module under test (will fail until prereqs.cjs exists)
const {
  compareVersions,
  checkTool,
  validatePrereqs,
  checkGitRepo,
  formatPrereqSummary,
} = require('./prereqs.cjs');

// --- compareVersions ---

describe('compareVersions', () => {
  it('returns positive when a > b (multi-component)', () => {
    assert.ok(compareVersions('2.43', '2.30') > 0);
  });

  it('returns negative when a < b (multi-component)', () => {
    assert.ok(compareVersions('2.20', '2.30') < 0);
  });

  it('returns 0 when versions are equal (single-component)', () => {
    assert.equal(compareVersions('18', '18'), 0);
  });

  it('returns positive when a > b (single-component)', () => {
    assert.ok(compareVersions('22', '18') > 0);
  });

  it('returns negative when a < b (single-component)', () => {
    assert.ok(compareVersions('16', '18') < 0);
  });

  it('handles versions with different component counts', () => {
    // 2.30.1 > 2.30 (extra patch component)
    assert.ok(compareVersions('2.30.1', '2.30') > 0);
  });

  it('treats missing components as 0', () => {
    // 2.30 == 2.30.0
    assert.equal(compareVersions('2.30', '2.30.0'), 0);
  });
});

// --- checkTool ---

describe('checkTool', () => {
  it('returns pass for git (real system check)', async () => {
    const result = await checkTool({
      name: 'git',
      command: 'git --version',
      parseVersion: (out) => {
        const m = out.match(/git version (\d+\.\d+)/);
        return m ? m[1] : null;
      },
      minVersion: '2.30',
      required: true,
      reason: 'needed for worktrees',
    });
    assert.equal(result.name, 'git');
    assert.equal(result.status, 'pass');
    assert.equal(typeof result.version, 'string');
    assert.equal(result.required, true);
  });

  it('returns fail for nonexistent command when required', async () => {
    const result = await checkTool({
      name: 'nonexistent-tool-xyz',
      command: 'nonexistent-tool-xyz --version',
      parseVersion: (out) => out.trim(),
      minVersion: '1.0',
      required: true,
      reason: 'test',
    });
    assert.equal(result.status, 'fail');
    assert.equal(result.version, null);
  });

  it('returns warn for nonexistent command when not required', async () => {
    const result = await checkTool({
      name: 'nonexistent-tool-xyz',
      command: 'nonexistent-tool-xyz --version',
      parseVersion: (out) => out.trim(),
      minVersion: '1.0',
      required: false,
      reason: 'test',
    });
    assert.equal(result.status, 'warn');
    assert.equal(result.version, null);
  });

  it('returns fail when version below minimum and required', async () => {
    const result = await checkTool({
      name: 'fake-tool',
      command: 'echo "fake-tool version 1.0"',
      parseVersion: (out) => {
        const m = out.match(/version (\d+\.\d+)/);
        return m ? m[1] : null;
      },
      minVersion: '99.0',
      required: true,
      reason: 'test',
    });
    assert.equal(result.status, 'fail');
    assert.equal(result.version, '1.0');
  });

  it('returns warn when version below minimum and not required', async () => {
    const result = await checkTool({
      name: 'fake-tool',
      command: 'echo "fake-tool version 1.0"',
      parseVersion: (out) => {
        const m = out.match(/version (\d+\.\d+)/);
        return m ? m[1] : null;
      },
      minVersion: '99.0',
      required: false,
      reason: 'test',
    });
    assert.equal(result.status, 'warn');
    assert.equal(result.version, '1.0');
  });

  it('returns error when version output is unparseable', async () => {
    const result = await checkTool({
      name: 'fake-tool',
      command: 'echo "no version info here"',
      parseVersion: (out) => {
        const m = out.match(/version (\d+\.\d+)/);
        return m ? m[1] : null;
      },
      minVersion: '1.0',
      required: true,
      reason: 'test',
    });
    assert.equal(result.status, 'error');
  });
});

// --- validatePrereqs ---

describe('validatePrereqs', () => {
  it('returns array of exactly 3 results (git, Node.js, jq)', async () => {
    const results = await validatePrereqs();
    assert.equal(Array.isArray(results), true);
    assert.equal(results.length, 3);
  });

  it('never short-circuits -- all results present even if one fails', async () => {
    const results = await validatePrereqs();
    // All three should have name properties
    const names = results.map((r) => r.name);
    assert.ok(names.includes('git'));
    assert.ok(names.includes('Node.js'));
    assert.ok(names.includes('jq'));
  });

  it('returns pass for git and Node.js on dev machines', async () => {
    const results = await validatePrereqs();
    const git = results.find((r) => r.name === 'git');
    const node = results.find((r) => r.name === 'Node.js');
    assert.equal(git.status, 'pass');
    assert.equal(node.status, 'pass');
  });
});

// --- checkGitRepo ---

describe('checkGitRepo', () => {
  it('returns isRepo: true for a known git repository', () => {
    // RAPID project root is a git repo (2 levels up from src/lib/)
    const projectRoot = path.resolve(__dirname, '..', '..');
    const result = checkGitRepo(projectRoot);
    assert.equal(result.isRepo, true);
    assert.equal(typeof result.toplevel, 'string');
    assert.ok(result.toplevel.length > 0);
  });

  it('returns isRepo: false for a non-git directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
    try {
      const result = checkGitRepo(tmpDir);
      assert.equal(result.isRepo, false);
      assert.equal(result.toplevel, null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// --- formatPrereqSummary ---

describe('formatPrereqSummary', () => {
  it('with all pass: hasBlockers is false, hasWarnings is false', () => {
    const results = [
      { name: 'git', status: 'pass', version: '2.43', minVersion: '2.30', required: true, reason: 'test' },
      { name: 'Node.js', status: 'pass', version: '22', minVersion: '18', required: true, reason: 'test' },
      { name: 'jq', status: 'pass', version: '1.7', minVersion: '1.6', required: false, reason: 'test' },
    ];
    const summary = formatPrereqSummary(results);
    assert.equal(summary.hasBlockers, false);
    assert.equal(summary.hasWarnings, false);
    assert.equal(typeof summary.table, 'string');
    assert.ok(summary.table.includes('git'));
    assert.ok(summary.table.includes('Node.js'));
    assert.ok(summary.table.includes('jq'));
  });

  it('with one fail: hasBlockers is true', () => {
    const results = [
      { name: 'git', status: 'fail', version: null, minVersion: '2.30', required: true, reason: 'test' },
      { name: 'Node.js', status: 'pass', version: '22', minVersion: '18', required: true, reason: 'test' },
      { name: 'jq', status: 'pass', version: '1.7', minVersion: '1.6', required: false, reason: 'test' },
    ];
    const summary = formatPrereqSummary(results);
    assert.equal(summary.hasBlockers, true);
  });

  it('with one warn: hasWarnings is true', () => {
    const results = [
      { name: 'git', status: 'pass', version: '2.43', minVersion: '2.30', required: true, reason: 'test' },
      { name: 'Node.js', status: 'pass', version: '22', minVersion: '18', required: true, reason: 'test' },
      { name: 'jq', status: 'warn', version: null, minVersion: '1.6', required: false, reason: 'test' },
    ];
    const summary = formatPrereqSummary(results);
    assert.equal(summary.hasWarnings, true);
    assert.equal(summary.hasBlockers, false);
  });

  it('table contains status indicators', () => {
    const results = [
      { name: 'git', status: 'pass', version: '2.43', minVersion: '2.30', required: true, reason: 'test' },
      { name: 'Node.js', status: 'fail', version: '16', minVersion: '18', required: true, reason: 'test' },
      { name: 'jq', status: 'warn', version: null, minVersion: '1.6', required: false, reason: 'test' },
    ];
    const summary = formatPrereqSummary(results);
    assert.ok(summary.table.includes('pass') || summary.table.includes('PASS') || summary.table.includes('Pass'));
    assert.ok(summary.table.includes('fail') || summary.table.includes('FAIL') || summary.table.includes('Fail'));
    assert.ok(summary.table.includes('warn') || summary.table.includes('WARN') || summary.table.includes('Warn'));
  });
});
