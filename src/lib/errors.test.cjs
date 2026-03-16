'use strict';

const { describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { CliError, exitWithError } = require('./errors.cjs');

describe('errors.cjs', () => {
  // ── CliError class ──
  describe('CliError', () => {
    it('is an instance of Error', () => {
      const err = new CliError('something broke');
      assert.ok(err instanceof Error);
      assert.ok(err instanceof CliError);
    });

    it('preserves message property', () => {
      const err = new CliError('disk full');
      assert.strictEqual(err.message, 'disk full');
    });

    it('has name set to CliError', () => {
      const err = new CliError('test');
      assert.strictEqual(err.name, 'CliError');
    });

    it('defaults code to 1 and data to empty object', () => {
      const err = new CliError('default test');
      assert.strictEqual(err.code, 1);
      assert.deepStrictEqual(err.data, {});
    });

    it('accepts custom code', () => {
      const err = new CliError('custom code', { code: 42 });
      assert.strictEqual(err.code, 42);
    });

    it('accepts custom data', () => {
      const data = { file: 'state.json', line: 12 };
      const err = new CliError('with data', { data });
      assert.deepStrictEqual(err.data, data);
    });

    it('accepts both code and data', () => {
      const err = new CliError('both', { code: 2, data: { x: 1 } });
      assert.strictEqual(err.code, 2);
      assert.deepStrictEqual(err.data, { x: 1 });
    });

    it('has a stack trace', () => {
      const err = new CliError('stack test');
      assert.ok(typeof err.stack === 'string');
      assert.ok(err.stack.includes('CliError'));
    });
  });

  // ── exitWithError function ──
  describe('exitWithError', () => {
    let stdoutChunks;
    let stderrChunks;
    let originalStdoutWrite;
    let originalStderrWrite;
    let originalExit;
    let exitCode;

    beforeEach(() => {
      stdoutChunks = [];
      stderrChunks = [];
      exitCode = null;

      originalStdoutWrite = process.stdout.write;
      originalStderrWrite = process.stderr.write;
      originalExit = process.exit;

      process.stdout.write = (chunk) => { stdoutChunks.push(chunk); return true; };
      process.stderr.write = (chunk) => { stderrChunks.push(chunk); return true; };
      process.exit = (code) => { exitCode = code; };
    });

    afterEach(() => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      process.exit = originalExit;
    });

    it('writes JSON error to stdout', () => {
      exitWithError('file not found');
      const stdoutOutput = stdoutChunks.join('');
      const parsed = JSON.parse(stdoutOutput.trim());
      assert.deepStrictEqual(parsed, { error: 'file not found' });
    });

    it('writes human-readable error to stderr', () => {
      exitWithError('file not found');
      const stderrOutput = stderrChunks.join('');
      assert.ok(stderrOutput.includes('file not found'), 'stderr should contain error message');
      assert.ok(stderrOutput.includes('[RAPID ERROR]'), 'stderr should use core.error format');
    });

    it('calls process.exit with default code 1', () => {
      exitWithError('some error');
      assert.strictEqual(exitCode, 1);
    });

    it('calls process.exit with custom code', () => {
      exitWithError('permission denied', 2);
      assert.strictEqual(exitCode, 2);
    });

    it('stdout output is valid JSON with error key', () => {
      exitWithError('validation failed');
      const stdoutOutput = stdoutChunks.join('');
      // Should end with newline
      assert.ok(stdoutOutput.endsWith('\n'), 'stdout should end with newline');
      const parsed = JSON.parse(stdoutOutput.trim());
      assert.ok('error' in parsed, 'JSON should have error key');
      assert.strictEqual(typeof parsed.error, 'string');
    });
  });
});
