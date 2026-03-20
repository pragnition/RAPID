'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { CliError } = require('../lib/errors.cjs');
const { handleDisplay } = require('./display.cjs');

/**
 * Capture process.stdout.write calls during a synchronous function invocation.
 * Returns the concatenated string that was written.
 */
function captureStdout(fn) {
  const chunks = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }
  return chunks.join('');
}

describe('handleDisplay — banner subcommand', () => {
  it('writes banner to stdout for known stage "init"', () => {
    const output = captureStdout(() => handleDisplay('banner', ['init']));

    // Should contain the RAPID brand and INITIALIZING verb
    assert.ok(output.includes('RAPID'), 'Output should contain "RAPID"');
    assert.ok(output.includes('INITIALIZING'), 'Output should contain "INITIALIZING" verb for init stage');
    // Should end with a newline
    assert.ok(output.endsWith('\n'), 'Output should end with newline');
  });

  it('writes branding banner to stdout for "branding" stage', () => {
    const output = captureStdout(() => handleDisplay('banner', ['branding']));

    assert.ok(output.includes('RAPID'), 'Output should contain "RAPID"');
    assert.ok(output.includes('BRANDING'), 'Output should contain "BRANDING" verb for branding stage');
    assert.ok(output.endsWith('\n'), 'Output should end with newline');
  });

  it('joins multi-word target arguments with spaces', () => {
    const output = captureStdout(() => handleDisplay('banner', ['execute', 'Wave', '1.1']));

    assert.ok(output.includes('RAPID'), 'Output should contain "RAPID"');
    assert.ok(output.includes('EXECUTING'), 'Output should contain "EXECUTING" verb for execute stage');
    assert.ok(output.includes('Wave 1.1'), 'Output should contain joined target "Wave 1.1"');
  });

  it('throws CliError when stage argument is missing', () => {
    assert.throws(
      () => handleDisplay('banner', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage'), `Expected Usage message, got: ${err.message}`);
        return true;
      },
    );
  });

  it('throws CliError for unknown subcommand', () => {
    assert.throws(
      () => handleDisplay('unknown', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Unknown display subcommand'), `Expected unknown subcommand message, got: ${err.message}`);
        return true;
      },
    );
  });

  it('writes fallback string for unknown stage without crashing', () => {
    const output = captureStdout(() => handleDisplay('banner', ['unknown-stage']));

    // renderBanner returns "[RAPID] Unknown stage: unknown-stage" for unrecognized stages
    assert.ok(output.includes('[RAPID] Unknown stage: unknown-stage'),
      `Expected fallback message, got: ${output}`);
    assert.ok(output.endsWith('\n'), 'Output should end with newline');
  });
});
