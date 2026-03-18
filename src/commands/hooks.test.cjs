'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { handleHooks } = require('./hooks.cjs');
const { CliError } = require('../lib/errors.cjs');

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary directory simulating a project root with .planning/.
 * Returns { cwd, cleanup }.
 */
function createTempProject(hooksConfig) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-hooks-cmd-test-'));
  const planningDir = path.join(cwd, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  if (hooksConfig) {
    fs.writeFileSync(
      path.join(planningDir, 'hooks-config.json'),
      JSON.stringify(hooksConfig, null, 2) + '\n',
      'utf-8',
    );
  }

  return {
    cwd,
    cleanup() {
      fs.rmSync(cwd, { recursive: true, force: true });
    },
  };
}

/**
 * Capture stdout writes during an async function call.
 * Returns the concatenated string written to stdout.
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
// Tests: handleHooks
// ---------------------------------------------------------------------------

describe('handleHooks', () => {

  // =========================================================================
  // list subcommand
  // =========================================================================

  describe('list subcommand', () => {

    it('outputs default config when no hooks-config.json exists', async () => {
      const { cwd, cleanup } = createTempProject();
      try {
        const stdout = await captureStdout(async () => {
          await handleHooks(cwd, 'list', []);
        });

        const output = JSON.parse(stdout);
        assert.ok(Array.isArray(output.checks), 'checks must be an array');
        assert.equal(output.checks.length, 3, 'default config has 3 checks');

        const ids = output.checks.map(c => c.id);
        assert.ok(ids.includes('state-verify'), 'must include state-verify');
        assert.ok(ids.includes('artifact-verify'), 'must include artifact-verify');
        assert.ok(ids.includes('commit-verify'), 'must include commit-verify');

        for (const check of output.checks) {
          assert.equal(check.enabled, true, `${check.id} should be enabled by default`);
        }
      } finally {
        cleanup();
      }
    });

    it('outputs config from disk when file exists', async () => {
      const customConfig = {
        version: 1,
        checks: [
          { id: 'state-verify', enabled: false },
          { id: 'artifact-verify', enabled: true },
          { id: 'commit-verify', enabled: false },
        ],
      };
      const { cwd, cleanup } = createTempProject(customConfig);

      try {
        const stdout = await captureStdout(async () => {
          await handleHooks(cwd, 'list', []);
        });

        const output = JSON.parse(stdout);
        assert.equal(output.checks.length, 3);
        assert.equal(output.checks[0].enabled, false, 'state-verify should be disabled');
        assert.equal(output.checks[1].enabled, true, 'artifact-verify should be enabled');
        assert.equal(output.checks[2].enabled, false, 'commit-verify should be disabled');
      } finally {
        cleanup();
      }
    });
  });

  // =========================================================================
  // enable subcommand
  // =========================================================================

  describe('enable subcommand', () => {

    it('enables a check and writes config', async () => {
      const customConfig = {
        version: 1,
        checks: [
          { id: 'state-verify', enabled: false },
          { id: 'artifact-verify', enabled: true },
          { id: 'commit-verify', enabled: true },
        ],
      };
      const { cwd, cleanup } = createTempProject(customConfig);

      try {
        const stdout = await captureStdout(async () => {
          await handleHooks(cwd, 'enable', ['state-verify']);
        });

        const output = JSON.parse(stdout);
        assert.equal(output.id, 'state-verify');
        assert.equal(output.enabled, true);

        // Verify persisted to disk
        const configPath = path.join(cwd, '.planning', 'hooks-config.json');
        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const check = saved.checks.find(c => c.id === 'state-verify');
        assert.equal(check.enabled, true, 'config on disk should reflect enabled state');
      } finally {
        cleanup();
      }
    });

    it('throws CliError for unknown check id', async () => {
      const { cwd, cleanup } = createTempProject();
      try {
        await assert.rejects(
          () => handleHooks(cwd, 'enable', ['nonexistent-check']),
          (err) => {
            assert.ok(err instanceof CliError, 'Should be a CliError');
            assert.ok(err.message.includes('Unknown check'), `Expected "Unknown check" in: ${err.message}`);
            assert.ok(err.message.includes('nonexistent-check'), 'Should mention the bad ID');
            return true;
          },
        );
      } finally {
        cleanup();
      }
    });

    it('throws CliError when no id provided', async () => {
      const { cwd, cleanup } = createTempProject();
      try {
        await assert.rejects(
          () => handleHooks(cwd, 'enable', []),
          (err) => {
            assert.ok(err instanceof CliError, 'Should be a CliError');
            assert.ok(err.message.includes('Usage'), `Expected "Usage" in: ${err.message}`);
            return true;
          },
        );
      } finally {
        cleanup();
      }
    });
  });

  // =========================================================================
  // disable subcommand
  // =========================================================================

  describe('disable subcommand', () => {

    it('disables a check and writes config', async () => {
      const { cwd, cleanup } = createTempProject();

      try {
        const stdout = await captureStdout(async () => {
          await handleHooks(cwd, 'disable', ['artifact-verify']);
        });

        const output = JSON.parse(stdout);
        assert.equal(output.id, 'artifact-verify');
        assert.equal(output.enabled, false);

        // Verify persisted to disk
        const configPath = path.join(cwd, '.planning', 'hooks-config.json');
        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const check = saved.checks.find(c => c.id === 'artifact-verify');
        assert.equal(check.enabled, false, 'config on disk should reflect disabled state');
      } finally {
        cleanup();
      }
    });

    it('throws CliError for unknown check id', async () => {
      const { cwd, cleanup } = createTempProject();
      try {
        await assert.rejects(
          () => handleHooks(cwd, 'disable', ['bogus']),
          (err) => {
            assert.ok(err instanceof CliError, 'Should be a CliError');
            assert.ok(err.message.includes('Unknown check'), `Expected "Unknown check" in: ${err.message}`);
            return true;
          },
        );
      } finally {
        cleanup();
      }
    });
  });

  // =========================================================================
  // run subcommand
  // =========================================================================

  describe('run subcommand', () => {

    it('runs hooks and outputs JSON result when called directly', async () => {
      const { cwd, cleanup } = createTempProject();

      // Create a minimal STATE.json so state-verify has something to check
      const stateDir = path.join(cwd, '.planning');
      fs.writeFileSync(
        path.join(stateDir, 'STATE.json'),
        JSON.stringify({
          rapid_state_version: '3.0.0',
          milestones: [],
        }),
        'utf-8',
      );

      try {
        // Test runPostTaskHooks directly (avoid stdin complexity in unit tests)
        const hooks = require('../lib/hooks.cjs');
        const returnData = {
          status: 'COMPLETE',
          tasks_completed: 3,
          tasks_total: 3,
          artifacts: [],
          commits: [],
        };

        const result = await hooks.runPostTaskHooks(cwd, returnData);
        assert.equal(typeof result.passed, 'boolean');
        assert.ok(Array.isArray(result.issues));
      } finally {
        cleanup();
      }
    });

    it('dry-run outputs enabled checks without executing', async () => {
      const customConfig = {
        version: 1,
        checks: [
          { id: 'state-verify', enabled: true },
          { id: 'artifact-verify', enabled: false },
          { id: 'commit-verify', enabled: true },
        ],
      };
      const { cwd, cleanup } = createTempProject(customConfig);

      try {
        // We need to simulate stdin for dry-run. Use the library directly
        // to test the dry-run logic path
        const hooks = require('../lib/hooks.cjs');
        const config = hooks.loadHooksConfig(cwd);
        const enabledChecks = config.checks
          .filter(c => c.enabled)
          .map(c => c.id);

        assert.deepEqual(enabledChecks, ['state-verify', 'commit-verify']);
      } finally {
        cleanup();
      }
    });
  });

  // =========================================================================
  // unknown subcommand
  // =========================================================================

  describe('unknown subcommand', () => {

    it('throws CliError with usage message', async () => {
      const { cwd, cleanup } = createTempProject();
      try {
        await assert.rejects(
          () => handleHooks(cwd, 'nonexistent', []),
          (err) => {
            assert.ok(err instanceof CliError, 'Should be a CliError');
            assert.ok(err.message.includes('Usage'), `Expected "Usage" in: ${err.message}`);
            assert.ok(err.message.includes('list'), 'Usage should mention list');
            assert.ok(err.message.includes('run'), 'Usage should mention run');
            assert.ok(err.message.includes('enable'), 'Usage should mention enable');
            assert.ok(err.message.includes('disable'), 'Usage should mention disable');
            return true;
          },
        );
      } finally {
        cleanup();
      }
    });

    it('throws CliError when no subcommand provided', async () => {
      const { cwd, cleanup } = createTempProject();
      try {
        await assert.rejects(
          () => handleHooks(cwd, undefined, []),
          (err) => {
            assert.ok(err instanceof CliError, 'Should be a CliError');
            assert.ok(err.message.includes('Usage'), `Expected "Usage" in: ${err.message}`);
            return true;
          },
        );
      } finally {
        cleanup();
      }
    });
  });
});
