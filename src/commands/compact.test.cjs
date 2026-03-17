'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { handleCompact } = require('./compact.cjs');
const { CliError } = require('../lib/errors.cjs');

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary directory simulating a set directory with wave artifacts.
 * Returns { cwd, setDir, cleanup }.
 */
function createTempSetDir(setId, artifacts = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-compact-test-'));
  const setDir = path.join(cwd, '.planning', 'sets', setId);
  fs.mkdirSync(setDir, { recursive: true });

  // artifacts is { filename: content } map
  for (const [filename, content] of Object.entries(artifacts)) {
    fs.writeFileSync(path.join(setDir, filename), content, 'utf-8');
  }

  return {
    cwd,
    setDir,
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
// Tests: handleCompact
// ---------------------------------------------------------------------------

describe('handleCompact', () => {

  // =========================================================================
  // Input Validation (CLI Layer)
  // =========================================================================

  describe('input validation', () => {

    // BEHAVIOR: handleCompact throws CliError when no setId is provided
    // GUARDS AGAINST: Running compaction against an undefined set, which would
    // construct an invalid setDir path and produce confusing filesystem errors
    it('throws CliError for missing setId', async () => {
      const tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-compact-'));
      try {
        await assert.rejects(
          () => handleCompact(tmpCwd, 'context', []),
          (err) => {
            assert.ok(err instanceof CliError, 'Should be a CliError instance');
            assert.ok(
              err.message.includes('Usage:'),
              `Error message should contain usage info, got: "${err.message}"`
            );
            return true;
          }
        );
      } finally {
        fs.rmSync(tmpCwd, { recursive: true, force: true });
      }
    });

    // BEHAVIOR: handleCompact throws CliError for unknown subcommands
    // GUARDS AGAINST: Typos or unsupported subcommands silently doing nothing;
    // the user needs clear feedback about valid subcommands
    it('throws CliError for unknown subcommand', async () => {
      const tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-compact-'));
      try {
        await assert.rejects(
          () => handleCompact(tmpCwd, 'nonexistent', ['my-set']),
          (err) => {
            assert.ok(err instanceof CliError, 'Should be a CliError instance');
            assert.ok(
              err.message.includes('Unknown compact subcommand'),
              `Error message should mention unknown subcommand, got: "${err.message}"`
            );
            return true;
          }
        );
      } finally {
        fs.rmSync(tmpCwd, { recursive: true, force: true });
      }
    });

    // BEHAVIOR: handleCompact throws CliError when the set directory has no artifacts
    // GUARDS AGAINST: Empty or non-existent set directories producing empty JSON
    // output that downstream consumers would misinterpret as success
    it('throws CliError when no artifacts found', async () => {
      // Create a cwd with an empty set directory
      const tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-compact-'));
      const setDir = path.join(tmpCwd, '.planning', 'sets', 'empty-set');
      fs.mkdirSync(setDir, { recursive: true });

      try {
        await assert.rejects(
          () => handleCompact(tmpCwd, 'context', ['empty-set']),
          (err) => {
            assert.ok(err instanceof CliError, 'Should be a CliError instance');
            assert.ok(
              err.message.includes('No artifacts found'),
              `Error message should mention no artifacts, got: "${err.message}"`
            );
            return true;
          }
        );
      } finally {
        fs.rmSync(tmpCwd, { recursive: true, force: true });
      }
    });
  });

  // =========================================================================
  // setDir Path Construction
  // =========================================================================

  describe('setDir path construction', () => {

    // BEHAVIOR: setDir is constructed as cwd/.planning/sets/<setId>
    // GUARDS AGAINST: Path construction bugs that look in the wrong directory,
    // e.g., using __dirname instead of cwd or missing the .planning prefix
    // EDGE CASE: Verifies the exact path components are joined correctly
    it('reads artifacts from cwd/.planning/sets/<setId>', async () => {
      const { cwd, cleanup } = createTempSetDir('my-test-set', {
        'CONTRACT.json': '{"name":"my-test-set"}',
      });

      try {
        const stdout = await captureStdout(async () => {
          await handleCompact(cwd, 'context', ['my-test-set']);
        });
        const output = JSON.parse(stdout);
        // If we got a valid result, the path was constructed correctly
        assert.ok(output.artifacts.length > 0, 'Should find the CONTRACT.json artifact');
        assert.equal(output.artifacts[0].name, 'CONTRACT.json');
      } finally {
        cleanup();
      }
    });
  });

  // =========================================================================
  // JSON Output Shape
  // =========================================================================

  describe('output shape', () => {

    // BEHAVIOR: Output JSON has the required top-level keys:
    //   totalTokens, digestsUsed, fullsUsed, budgetExceeded, artifacts
    // GUARDS AGAINST: Missing or renamed fields that break downstream consumers
    // (e.g., the orchestrator skill that parses compact context output)
    it('outputs valid JSON with expected shape', async () => {
      const { cwd, cleanup } = createTempSetDir('shape-test', {
        'CONTRACT.json': '{"name":"shape-test","version":"1.0"}',
        'SET-OVERVIEW.md': '# Shape Test\nSome overview content here.',
      });

      try {
        const stdout = await captureStdout(async () => {
          await handleCompact(cwd, 'context', ['shape-test']);
        });

        const output = JSON.parse(stdout);

        // Arrange -- verify all required keys exist
        assert.ok('totalTokens' in output, 'Output must have totalTokens');
        assert.ok('digestsUsed' in output, 'Output must have digestsUsed');
        assert.ok('fullsUsed' in output, 'Output must have fullsUsed');
        assert.ok('budgetExceeded' in output, 'Output must have budgetExceeded');
        assert.ok('artifacts' in output, 'Output must have artifacts');

        // Assert -- verify types
        assert.equal(typeof output.totalTokens, 'number');
        assert.equal(typeof output.digestsUsed, 'number');
        assert.equal(typeof output.fullsUsed, 'number');
        assert.equal(typeof output.budgetExceeded, 'boolean');
        assert.ok(Array.isArray(output.artifacts), 'artifacts must be an array');
      } finally {
        cleanup();
      }
    });

    // BEHAVIOR: Each artifact in the flat list has wave, name, tokens, isDigest
    // GUARDS AGAINST: Incomplete artifact entries that cause downstream key
    // lookups to return undefined, leading to silent NaN or display bugs
    it('flat artifact list has correct shape per item', async () => {
      const { cwd, cleanup } = createTempSetDir('artifact-shape', {
        'CONTRACT.json': '{"name":"artifact-shape"}',
        'wave-1-PLAN.md': '# Wave 1 Plan\nDo stuff.',
      });

      try {
        const stdout = await captureStdout(async () => {
          await handleCompact(cwd, 'context', ['artifact-shape']);
        });

        const output = JSON.parse(stdout);
        assert.ok(output.artifacts.length >= 2, 'Should have at least 2 artifacts');

        for (const artifact of output.artifacts) {
          assert.ok('wave' in artifact, `Artifact must have wave field: ${JSON.stringify(artifact)}`);
          assert.ok('name' in artifact, `Artifact must have name field: ${JSON.stringify(artifact)}`);
          assert.ok('tokens' in artifact, `Artifact must have tokens field: ${JSON.stringify(artifact)}`);
          assert.ok('isDigest' in artifact, `Artifact must have isDigest field: ${JSON.stringify(artifact)}`);

          assert.equal(typeof artifact.wave, 'number', 'wave must be a number');
          assert.equal(typeof artifact.name, 'string', 'name must be a string');
          assert.equal(typeof artifact.tokens, 'number', 'tokens must be a number');
          assert.equal(typeof artifact.isDigest, 'boolean', 'isDigest must be a boolean');
        }
      } finally {
        cleanup();
      }
    });
  });

  // =========================================================================
  // --active-wave Flag Parsing
  // =========================================================================

  describe('--active-wave flag', () => {

    // BEHAVIOR: --active-wave N is parsed and passed to compactContext, causing
    // waves < N to prefer digests (if available)
    // GUARDS AGAINST: Digests never being used because activeWave is always 0,
    // defeating the entire purpose of compaction
    it('--active-wave flag parsed correctly: digests used for completed waves', async () => {
      const { cwd, cleanup } = createTempSetDir('active-wave-test', {
        'CONTRACT.json': '{"name":"active-wave-test"}',
        'wave-1-PLAN.md': '# Wave 1 Plan\nThis is a longer plan with details.',
        'wave-1-PLAN-DIGEST.md': '# Wave 1 Digest\nShort.',
        'WAVE-1-COMPLETE.md': '# Wave 1 Complete',
        'wave-2-PLAN.md': '# Wave 2 Plan\nCurrent wave.',
      });

      try {
        const stdout = await captureStdout(async () => {
          // active-wave=2 means wave 1 is completed, should use digest
          await handleCompact(cwd, 'context', ['active-wave-test', '--active-wave', '2']);
        });

        const output = JSON.parse(stdout);
        assert.ok(output.digestsUsed > 0, `digestsUsed should be > 0 when completed wave has digest, got ${output.digestsUsed}`);

        // Find the wave-1 PLAN artifact and verify it used the digest
        const wave1Plan = output.artifacts.find(a => a.wave === 1 && a.name === 'PLAN');
        assert.ok(wave1Plan, 'Should find wave-1 PLAN artifact');
        assert.equal(wave1Plan.isDigest, true, 'wave-1 PLAN should be marked as digest');
      } finally {
        cleanup();
      }
    });

    // BEHAVIOR: When --active-wave is not provided, it defaults to 0
    // GUARDS AGAINST: Undefined activeWave causing NaN comparisons in
    // compactContext, which would make wave < NaN always false, preventing
    // any digest usage
    // EDGE CASE: With activeWave=0, no wave is "completed" (wave < 0 is false
    // for all non-negative wave numbers), so digestsUsed should be 0
    it('--active-wave defaults to 0: digestsUsed === 0', async () => {
      const { cwd, cleanup } = createTempSetDir('default-wave', {
        'CONTRACT.json': '{"name":"default-wave"}',
        'wave-1-PLAN.md': '# Wave 1 Plan\nContent.',
        'wave-1-PLAN-DIGEST.md': '# Wave 1 Digest\nShort.',
      });

      try {
        const stdout = await captureStdout(async () => {
          // No --active-wave flag, defaults to 0
          await handleCompact(cwd, 'context', ['default-wave']);
        });

        const output = JSON.parse(stdout);
        assert.equal(output.digestsUsed, 0, `digestsUsed should be 0 when activeWave defaults to 0, got ${output.digestsUsed}`);
      } finally {
        cleanup();
      }
    });

    // BEHAVIOR: --active-wave=N with equals syntax is parsed identically to
    // --active-wave N (space-separated syntax)
    // GUARDS AGAINST: parseArgs not handling the --flag=value form, which is
    // a common CLI convention that users expect to work
    it('--active-wave=N equals syntax parsed correctly', async () => {
      const { cwd, cleanup } = createTempSetDir('equals-syntax', {
        'CONTRACT.json': '{"name":"equals-syntax"}',
        'wave-1-PLAN.md': '# Wave 1 Plan\nContent.',
        'wave-1-PLAN-DIGEST.md': '# Wave 1 Digest\nShort.',
        'WAVE-1-COMPLETE.md': '# Wave 1 Complete',
        'wave-2-PLAN.md': '# Wave 2 Plan\nCurrent.',
      });

      try {
        const stdout = await captureStdout(async () => {
          // Use equals syntax
          await handleCompact(cwd, 'context', ['equals-syntax', '--active-wave=2']);
        });

        const output = JSON.parse(stdout);
        assert.ok(output.digestsUsed > 0, `digestsUsed should be > 0 with --active-wave=2, got ${output.digestsUsed}`);
      } finally {
        cleanup();
      }
    });

    // BEHAVIOR: Non-numeric --active-wave value degrades gracefully
    // GUARDS AGAINST: Process crash from parseInt producing NaN and NaN being
    // used in numeric comparisons without guard clauses
    // Non-numeric --active-wave now throws a CliError with a descriptive message
    it('non-numeric --active-wave throws CliError', async () => {
      const { cwd, cleanup } = createTempSetDir('nan-wave', {
        'CONTRACT.json': '{"name":"nan-wave"}',
        'wave-1-PLAN.md': '# Wave 1 Plan\nContent.',
        'wave-1-PLAN-DIGEST.md': '# Digest.',
      });

      try {
        await assert.rejects(
          () => handleCompact(cwd, 'context', ['nan-wave', '--active-wave', 'abc']),
          (err) => {
            assert.equal(err.constructor.name, 'CliError');
            assert.match(err.message, /Invalid --active-wave value: must be a number/);
            return true;
          }
        );
      } finally {
        cleanup();
      }
    });
  });
});
