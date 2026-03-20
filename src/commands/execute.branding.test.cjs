'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CliError } = require('../lib/errors.cjs');
const { handleExecute } = require('./execute.cjs');

describe('handleExecute branding-context-injection (command layer)', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-exec-branding-'));

    // Create minimal .planning structure for a test set
    const setDir = path.join(tmpDir, '.planning', 'sets', 'test-set');
    fs.mkdirSync(setDir, { recursive: true });

    // CONTRACT.json -- minimal valid contract with at least one key
    fs.writeFileSync(
      path.join(setDir, 'CONTRACT.json'),
      JSON.stringify({
        owns: ['src/example.cjs'],
        produces: [],
        consumes: [],
      }),
    );

    // DEFINITION.md -- optional but lets us verify definitionLength > 0
    fs.writeFileSync(
      path.join(setDir, 'DEFINITION.md'),
      '# Test Set\n\nA test set for branding context injection.\n',
    );

    // Worktree registry (needed by some subcommands, not prepare-context directly)
    const wtDir = path.join(tmpDir, '.planning', 'worktrees');
    fs.mkdirSync(wtDir, { recursive: true });
    fs.writeFileSync(
      path.join(wtDir, 'REGISTRY.json'),
      JSON.stringify({ worktrees: {} }),
    );
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('prepare-context delegates to prepareSetContext and returns JSON with expected fields', async () => {
    // Capture stdout by temporarily replacing process.stdout.write
    let captured = '';
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
      captured += chunk;
      return true;
    };

    try {
      await handleExecute(tmpDir, 'prepare-context', ['test-set']);
    } finally {
      process.stdout.write = originalWrite;
    }

    // Parse the JSON output
    const result = JSON.parse(captured.trim());

    // Verify expected fields are present
    assert.equal(result.setName, 'test-set');
    assert.ok(typeof result.scopedMdPreview === 'string', 'scopedMdPreview should be a string');
    assert.ok(result.scopedMdPreview.length > 0, 'scopedMdPreview should not be empty');
    assert.ok(typeof result.definitionLength === 'number', 'definitionLength should be a number');
    assert.ok(result.definitionLength > 0, 'definitionLength should be > 0 since DEFINITION.md exists');
    assert.ok(Array.isArray(result.contractKeys), 'contractKeys should be an array');
    assert.ok(result.contractKeys.includes('owns'), 'contractKeys should include "owns"');
    assert.ok(result.contractKeys.includes('produces'), 'contractKeys should include "produces"');
    assert.ok(result.contractKeys.includes('consumes'), 'contractKeys should include "consumes"');
  });

  it('prepare-context throws CliError when no set-name provided', async () => {
    await assert.rejects(
      async () => handleExecute(tmpDir, 'prepare-context', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(
          err.message.includes('Usage'),
          `Expected usage message, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  it('throws CliError for unknown subcommand', async () => {
    await assert.rejects(
      async () => handleExecute(tmpDir, 'unknown-cmd', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(
          err.message.includes('Unknown execute subcommand'),
          `Expected unknown subcommand message, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});
