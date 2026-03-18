'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { handleUiContract } = require('./ui-contract.cjs');
const { CliError } = require('../lib/errors.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary directory simulating a project root with .planning/sets/.
 */
function createTempProject() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-ui-cmd-test-'));
  fs.mkdirSync(path.join(cwd, '.planning', 'sets'), { recursive: true });
  return cwd;
}

/**
 * Write a UI-CONTRACT.json for a given set inside the temp project.
 */
function writeUiContract(cwd, setName, contract) {
  const setDir = path.join(cwd, '.planning', 'sets', setName);
  fs.mkdirSync(setDir, { recursive: true });
  fs.writeFileSync(
    path.join(setDir, 'UI-CONTRACT.json'),
    JSON.stringify(contract, null, 2),
    'utf-8'
  );
}

/**
 * Build a valid complete contract for testing.
 */
function makeValidContract() {
  return {
    guidelines: {
      fontFamilies: ['Inter', 'Roboto'],
      tone: 'Professional and clean',
      visualIdentity: ['Use brand blue as primary'],
    },
    components: [
      {
        name: 'Dashboard',
        role: 'page',
        children: [
          { name: 'Sidebar', role: 'layout' },
          { name: 'StatsCard', role: 'widget' },
        ],
      },
    ],
    tokens: {
      primary: '#3B82F6',
      'spacing-md': '16px',
    },
    layout: {
      grid: { columns: 12, gutter: '24px' },
      breakpoints: { sm: '640px', md: '768px' },
    },
    interactions: {
      stateTransitions: ['Loading -> Loaded'],
      animations: ['Fade in on mount'],
    },
  };
}

/**
 * Capture stdout writes during an async function call.
 */
async function captureStdout(fn) {
  const chunks = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = function (chunk) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };
  try {
    await fn();
  } finally {
    process.stdout.write = originalWrite;
  }
  return chunks.join('');
}

// ---------------------------------------------------------------------------
// handleUiContract -- validate subcommand
// ---------------------------------------------------------------------------

describe('handleUiContract', () => {
  let cwd;

  beforeEach(() => {
    cwd = createTempProject();
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  describe('validate subcommand', () => {
    it('outputs valid:true for a valid UI-CONTRACT.json', async () => {
      writeUiContract(cwd, 'test-set', makeValidContract());
      const output = await captureStdout(() =>
        handleUiContract(cwd, 'validate', ['test-set'])
      );
      const result = JSON.parse(output.trim());
      assert.deepStrictEqual(result, { valid: true });
    });

    it('outputs valid:false with errors for invalid contract', async () => {
      // additionalProperties is false, so an unknown top-level key is invalid
      writeUiContract(cwd, 'test-set', { unknownSection: true });
      const output = await captureStdout(() =>
        handleUiContract(cwd, 'validate', ['test-set'])
      );
      const result = JSON.parse(output.trim());
      assert.strictEqual(result.valid, false);
      assert.ok(Array.isArray(result.errors));
      assert.ok(result.errors.length > 0);
    });

    it('throws CliError when set name is missing', async () => {
      await assert.rejects(
        () => handleUiContract(cwd, 'validate', []),
        (err) => {
          assert.ok(err instanceof CliError);
          return true;
        }
      );
    });

    it('throws CliError when UI-CONTRACT.json does not exist', async () => {
      // Create the set dir but no UI-CONTRACT.json
      fs.mkdirSync(path.join(cwd, '.planning', 'sets', 'empty-set'), { recursive: true });
      await assert.rejects(
        () => handleUiContract(cwd, 'validate', ['empty-set']),
        (err) => {
          assert.ok(err instanceof CliError);
          assert.ok(err.message.includes('not found'));
          return true;
        }
      );
    });

    it('throws CliError when UI-CONTRACT.json is not valid JSON', async () => {
      const setDir = path.join(cwd, '.planning', 'sets', 'bad-json');
      fs.mkdirSync(setDir, { recursive: true });
      fs.writeFileSync(path.join(setDir, 'UI-CONTRACT.json'), '{ bad json', 'utf-8');
      await assert.rejects(
        () => handleUiContract(cwd, 'validate', ['bad-json']),
        (err) => {
          assert.ok(err instanceof CliError);
          assert.ok(err.message.includes('not valid JSON'));
          return true;
        }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // check-consistency subcommand
  // ---------------------------------------------------------------------------

  describe('check-consistency subcommand', () => {
    it('outputs consistent:true when no conflicts', async () => {
      writeUiContract(cwd, 'set-a', { tokens: { primary: '#3B82F6' } });
      writeUiContract(cwd, 'set-b', { tokens: { secondary: '#FF0000' } });
      const output = await captureStdout(() =>
        handleUiContract(cwd, 'check-consistency', [])
      );
      const result = JSON.parse(output.trim());
      assert.strictEqual(result.consistent, true);
      assert.deepStrictEqual(result.conflicts, []);
    });

    it('detects token conflicts across sets', async () => {
      writeUiContract(cwd, 'set-a', { tokens: { primary: '#3B82F6' } });
      writeUiContract(cwd, 'set-b', { tokens: { primary: '#FF0000' } });
      const output = await captureStdout(() =>
        handleUiContract(cwd, 'check-consistency', [])
      );
      const result = JSON.parse(output.trim());
      assert.strictEqual(result.consistent, false);
      assert.ok(result.conflicts.length >= 1);
      const tokenConflict = result.conflicts.find((c) => c.type === 'token');
      assert.ok(tokenConflict, 'should have a token conflict');
      assert.strictEqual(tokenConflict.key, 'primary');
    });
  });

  // ---------------------------------------------------------------------------
  // show subcommand
  // ---------------------------------------------------------------------------

  describe('show subcommand', () => {
    it('outputs formatted summary for valid contract', async () => {
      writeUiContract(cwd, 'test-set', makeValidContract());
      const output = await captureStdout(() =>
        handleUiContract(cwd, 'show', ['test-set'])
      );
      const result = JSON.parse(output.trim());
      assert.strictEqual(result.set, 'test-set');
      assert.strictEqual(result.valid, true);
      assert.ok(result.sections);

      // Guidelines
      assert.strictEqual(result.sections.guidelines.present, true);
      assert.strictEqual(result.sections.guidelines.tone, 'Professional and clean');
      assert.strictEqual(result.sections.guidelines.fontCount, 2);
      assert.strictEqual(result.sections.guidelines.ruleCount, 1);

      // Components (3 total: Dashboard + Sidebar + StatsCard)
      assert.strictEqual(result.sections.components.present, true);
      assert.strictEqual(result.sections.components.count, 3);
      assert.deepStrictEqual(result.sections.components.topLevel, ['Dashboard']);

      // Tokens
      assert.strictEqual(result.sections.tokens.present, true);
      assert.strictEqual(result.sections.tokens.count, 2);
      assert.ok(result.sections.tokens.keys.includes('primary'));

      // Layout
      assert.strictEqual(result.sections.layout.present, true);
      assert.strictEqual(result.sections.layout.hasGrid, true);
      assert.strictEqual(result.sections.layout.breakpointCount, 2);

      // Interactions
      assert.strictEqual(result.sections.interactions.present, true);
      assert.ok(result.sections.interactions.categories.includes('stateTransitions'));
      assert.ok(result.sections.interactions.categories.includes('animations'));
    });

    it('marks absent sections as present:false', async () => {
      // Minimal contract with only tokens
      writeUiContract(cwd, 'minimal-set', { tokens: { primary: '#000' } });
      const output = await captureStdout(() =>
        handleUiContract(cwd, 'show', ['minimal-set'])
      );
      const result = JSON.parse(output.trim());
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.sections.guidelines.present, false);
      assert.strictEqual(result.sections.components.present, false);
      assert.strictEqual(result.sections.layout.present, false);
      assert.strictEqual(result.sections.interactions.present, false);
      assert.strictEqual(result.sections.tokens.present, true);
    });

    it('throws CliError when set name is missing', async () => {
      await assert.rejects(
        () => handleUiContract(cwd, 'show', []),
        (err) => {
          assert.ok(err instanceof CliError);
          return true;
        }
      );
    });

    it('outputs valid:false for invalid contract', async () => {
      writeUiContract(cwd, 'test-set', { unknownSection: 'bad' });
      const output = await captureStdout(() =>
        handleUiContract(cwd, 'show', ['test-set'])
      );
      const result = JSON.parse(output.trim());
      assert.strictEqual(result.valid, false);
      assert.ok(Array.isArray(result.errors));
    });
  });

  // ---------------------------------------------------------------------------
  // unknown subcommand
  // ---------------------------------------------------------------------------

  describe('unknown subcommand', () => {
    it('throws CliError for unknown subcommand', async () => {
      await assert.rejects(
        () => handleUiContract(cwd, 'bogus', []),
        (err) => {
          assert.ok(err instanceof CliError);
          assert.ok(err.message.includes('Unknown ui-contract subcommand'));
          assert.ok(err.message.includes('bogus'));
          return true;
        }
      );
    });
  });
});

// ---------------------------------------------------------------------------
// enrichedPrepareSetContext integration
// ---------------------------------------------------------------------------

describe('enrichedPrepareSetContext integration', () => {
  it('includes uiContext key in the module exports', () => {
    const execute = require('../lib/execute.cjs');
    assert.ok('enrichedPrepareSetContext' in execute);
    assert.strictEqual(typeof execute.enrichedPrepareSetContext, 'function');
  });
});
