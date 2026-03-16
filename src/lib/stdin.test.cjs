'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const path = require('path');

// We test the internal _parseAndValidate logic via readAndValidateStdin with mocked stdin,
// and test the actual stdin reading via subprocess invocations.

describe('stdin.cjs', () => {
  // ── readStdinSync via subprocess ──
  describe('readStdinSync (integration via subprocess)', () => {
    it('reads and trims piped stdin content', () => {
      const script = `
        const { readStdinSync } = require('${path.join(__dirname, 'stdin.cjs').replace(/\\/g, '\\\\')}');
        try {
          const result = readStdinSync();
          process.stdout.write(JSON.stringify({ result }));
        } catch (e) {
          process.stdout.write(JSON.stringify({ error: e.message }));
          process.exit(1);
        }
      `;
      const stdout = execSync(`echo '  hello world  ' | node -e "${script.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const parsed = JSON.parse(stdout.trim());
      assert.strictEqual(parsed.result, 'hello world');
    });

    it('throws CliError on empty stdin', () => {
      const script = `
        const { readStdinSync } = require('${path.join(__dirname, 'stdin.cjs').replace(/\\/g, '\\\\')}');
        try {
          readStdinSync();
          process.stdout.write('no-error');
        } catch (e) {
          process.stdout.write(JSON.stringify({ error: e.message, name: e.name }));
        }
      `;
      const stdout = execSync(`echo '' | node -e "${script.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const parsed = JSON.parse(stdout.trim());
      assert.strictEqual(parsed.error, 'No data on stdin');
      assert.strictEqual(parsed.name, 'CliError');
    });
  });

  // ── readAndValidateStdin (sync) with mock Zod schema ──
  describe('readAndValidateStdin (sync, via subprocess)', () => {
    it('parses valid JSON and validates against schema', () => {
      const input = JSON.stringify({ name: 'test', value: 42 });
      const script = `
        const { readAndValidateStdin } = require('${path.join(__dirname, 'stdin.cjs').replace(/\\/g, '\\\\')}');
        const mockSchema = {
          safeParse: (data) => ({ success: true, data })
        };
        try {
          const result = readAndValidateStdin(mockSchema);
          process.stdout.write(JSON.stringify(result));
        } catch (e) {
          process.stdout.write(JSON.stringify({ error: e.message }));
          process.exit(1);
        }
      `;
      const stdout = execSync(`echo '${input}' | node -e "${script.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const result = JSON.parse(stdout.trim());
      assert.strictEqual(result.name, 'test');
      assert.strictEqual(result.value, 42);
    });

    it('throws CliError on invalid JSON', () => {
      const script = `
        const { readAndValidateStdin } = require('${path.join(__dirname, 'stdin.cjs').replace(/\\/g, '\\\\')}');
        const mockSchema = { safeParse: (data) => ({ success: true, data }) };
        try {
          readAndValidateStdin(mockSchema);
          process.stdout.write('no-error');
        } catch (e) {
          process.stdout.write(JSON.stringify({ error: e.message, name: e.name }));
        }
      `;
      const stdout = execSync(`echo 'not json at all' | node -e "${script.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const parsed = JSON.parse(stdout.trim());
      assert.ok(parsed.error.startsWith('Invalid JSON on stdin:'));
      assert.strictEqual(parsed.name, 'CliError');
    });

    it('throws CliError on Zod validation failure', () => {
      const input = JSON.stringify({ name: 'test' });
      const script = `
        const { readAndValidateStdin } = require('${path.join(__dirname, 'stdin.cjs').replace(/\\/g, '\\\\')}');
        const mockSchema = {
          safeParse: () => ({
            success: false,
            error: {
              issues: [{ path: ['value'], message: 'Required' }]
            }
          })
        };
        try {
          readAndValidateStdin(mockSchema);
          process.stdout.write('no-error');
        } catch (e) {
          process.stdout.write(JSON.stringify({ error: e.message, name: e.name }));
        }
      `;
      const stdout = execSync(`echo '${input}' | node -e "${script.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const parsed = JSON.parse(stdout.trim());
      assert.ok(parsed.error.includes('Stdin validation failed'));
      assert.ok(parsed.error.includes('value: Required'));
      assert.strictEqual(parsed.name, 'CliError');
    });
  });

  // ── readAndValidateStdin (async) ──
  describe('readAndValidateStdin (async, via subprocess)', () => {
    it('reads stdin asynchronously and validates', () => {
      const input = JSON.stringify({ async: true, data: [1, 2, 3] });
      const script = `
        const { readAndValidateStdin } = require('${path.join(__dirname, 'stdin.cjs').replace(/\\/g, '\\\\')}');
        const mockSchema = {
          safeParse: (data) => ({ success: true, data })
        };
        (async () => {
          try {
            const result = await readAndValidateStdin(mockSchema, { async: true });
            process.stdout.write(JSON.stringify(result));
          } catch (e) {
            process.stdout.write(JSON.stringify({ error: e.message }));
            process.exit(1);
          }
        })();
      `;
      const stdout = execSync(`echo '${input}' | node -e "${script.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const result = JSON.parse(stdout.trim());
      assert.strictEqual(result.async, true);
      assert.deepStrictEqual(result.data, [1, 2, 3]);
    });
  });

  // ── CliError import verification ──
  describe('module integration', () => {
    it('exports readStdinSync, readStdinAsync, and readAndValidateStdin', () => {
      const stdin = require('./stdin.cjs');
      assert.strictEqual(typeof stdin.readStdinSync, 'function');
      assert.strictEqual(typeof stdin.readStdinAsync, 'function');
      assert.strictEqual(typeof stdin.readAndValidateStdin, 'function');
    });

    it('thrown errors are CliError instances', () => {
      const { CliError } = require('./errors.cjs');
      const script = `
        const { readStdinSync } = require('${path.join(__dirname, 'stdin.cjs').replace(/\\/g, '\\\\')}');
        const { CliError } = require('${path.join(__dirname, 'errors.cjs').replace(/\\/g, '\\\\')}');
        try {
          readStdinSync();
        } catch (e) {
          process.stdout.write(JSON.stringify({
            isCliError: e instanceof CliError,
            code: e.code,
          }));
        }
      `;
      const stdout = execSync(`echo '' | node -e "${script.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const result = JSON.parse(stdout.trim());
      assert.strictEqual(result.isCliError, true);
      assert.strictEqual(result.code, 1);
    });
  });
});
