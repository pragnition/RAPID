'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { CliError } = require('../lib/errors.cjs');
const { handleAssumptions, handleParseReturn, handleResume, handleVerifyArtifacts, handleContext } = require('./misc.cjs');

// ---------------------------------------------------------------------------
// Helper: capture stdout
// ---------------------------------------------------------------------------
function captureStdout(fn) {
  const chunks = [];
  const origWrite = process.stdout.write;
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = origWrite;
  }
  return chunks.join('');
}

async function captureStdoutAsync(fn) {
  const chunks = [];
  const origWrite = process.stdout.write;
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };
  try {
    await fn();
  } finally {
    process.stdout.write = origWrite;
  }
  return chunks.join('');
}

// ---------------------------------------------------------------------------
// Helper: create temp dir with plan structure
// ---------------------------------------------------------------------------
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'misc-test-'));
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// handleAssumptions
// ---------------------------------------------------------------------------
describe('handleAssumptions', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Create .planning/sets with a sample set
    const setsDir = path.join(tmpDir, '.planning', 'sets', 'auth-core');
    fs.mkdirSync(setsDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.json'), JSON.stringify({
      milestone: 'v1',
      sets: { 'auth-core': { status: 'executing' } },
    }));
  });

  after(() => {
    rmDir(tmpDir);
  });

  it('lists sets when no set name given', () => {
    const output = captureStdout(() => handleAssumptions(tmpDir, []));
    const parsed = JSON.parse(output.trim());
    assert.ok(parsed.availableSets, 'Should have availableSets key');
    assert.ok(Array.isArray(parsed.availableSets), 'availableSets should be array');
  });
});

// ---------------------------------------------------------------------------
// handleResume
// ---------------------------------------------------------------------------
describe('handleResume', () => {
  it('throws CliError for missing set name', async () => {
    await assert.rejects(
      async () => handleResume('/tmp/nonexistent', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage'), `Expected usage message, got: ${err.message}`);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// handleVerifyArtifacts
// ---------------------------------------------------------------------------
describe('handleVerifyArtifacts', () => {
  it('throws CliError when no files provided', () => {
    assert.throws(
      () => handleVerifyArtifacts([]),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// handleContext
// ---------------------------------------------------------------------------
describe('handleContext', () => {
  it('throws CliError when no subcommand given', () => {
    assert.throws(
      () => handleContext([]),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage'));
        return true;
      },
    );
  });

  it('throws CliError for unknown subcommand', () => {
    assert.throws(
      () => handleContext(['bogus']),
      (err) => {
        assert.ok(err instanceof CliError);
        assert.ok(err.message.includes('Unknown context subcommand'));
        return true;
      },
    );
  });

  it('detect subcommand works and returns JSON', () => {
    // This should work even without .planning directory
    const output = captureStdout(() => handleContext(['detect']));
    const parsed = JSON.parse(output.trim());
    // It should have at least hasSourceCode field
    assert.ok('hasSourceCode' in parsed, 'Should report hasSourceCode');
  });
});
