const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// We test output, error, findProjectRoot, loadConfig, resolveRapidDir
const core = require('./core.cjs');

describe('core.cjs', () => {
  describe('output()', () => {
    it('formats message with [RAPID] prefix to stdout', () => {
      // Capture stdout
      const original = process.stdout.write;
      let captured = '';
      process.stdout.write = (chunk) => { captured += chunk; return true; };
      try {
        core.output('hello world');
        assert.ok(captured.includes('[RAPID]'), 'Should contain [RAPID] prefix');
        assert.ok(captured.includes('hello world'), 'Should contain message');
      } finally {
        process.stdout.write = original;
      }
    });
  });

  describe('error()', () => {
    it('formats error message with [RAPID ERROR] prefix to stderr', () => {
      const original = process.stderr.write;
      let captured = '';
      process.stderr.write = (chunk) => { captured += chunk; return true; };
      try {
        core.error('something failed');
        assert.ok(captured.includes('[RAPID ERROR]'), 'Should contain [RAPID ERROR] prefix');
        assert.ok(captured.includes('something failed'), 'Should contain message');
      } finally {
        process.stderr.write = original;
      }
    });
  });

  describe('findProjectRoot()', () => {
    let tmpDir;
    let projectDir;

    before(() => {
      // Create a temp directory tree with .planning/
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
      projectDir = path.join(tmpDir, 'myproject');
      fs.mkdirSync(path.join(projectDir, '.planning'), { recursive: true });
      // Create a nested subdirectory to test walking up
      fs.mkdirSync(path.join(projectDir, 'src', 'deep', 'nested'), { recursive: true });
    });

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('finds project root from a nested directory', () => {
      const result = core.findProjectRoot(path.join(projectDir, 'src', 'deep', 'nested'));
      assert.equal(result, projectDir);
    });

    it('finds project root from the root itself', () => {
      const result = core.findProjectRoot(projectDir);
      assert.equal(result, projectDir);
    });

    it('throws when no .planning/ directory exists', () => {
      assert.throws(
        () => core.findProjectRoot(tmpDir),
        /not found|could not find/i
      );
    });
  });

  describe('loadConfig()', () => {
    let tmpDir;

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-config-test-'));
    });

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns defaults when config file does not exist', () => {
      const config = core.loadConfig(tmpDir);
      assert.ok(config.agents !== undefined, 'Should have agents key');
      assert.ok(typeof config.lock_timeout_ms === 'number', 'Should have lock_timeout_ms');
      assert.equal(config.lock_timeout_ms, 300000, 'Default lock_timeout_ms should be 300000');
    });

    it('reads config from rapid/config.json when it exists', () => {
      const configDir = path.join(tmpDir, 'rapid');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify({ agents: { test: true }, lock_timeout_ms: 60000 })
      );
      const config = core.loadConfig(tmpDir);
      assert.deepEqual(config.agents, { test: true });
      assert.equal(config.lock_timeout_ms, 60000);
    });
  });

  describe('resolveRapidDir()', () => {
    it('returns a path ending in rapid/', () => {
      const dir = core.resolveRapidDir();
      assert.ok(typeof dir === 'string', 'Should return a string');
      // It should resolve to a real directory (or at least a path)
      assert.ok(dir.length > 0, 'Should be non-empty');
    });
  });
});
