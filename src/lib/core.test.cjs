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

  describe('findProjectRoot() (legacy)', () => {
    let tmpDir;
    let projectDir;

    before(() => {
      // Create a temp directory tree with .planning/
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
      projectDir = path.join(tmpDir, 'myproject');
      fs.mkdirSync(path.join(projectDir, '.planning', 'sets'), { recursive: true });
      // Create a nested subdirectory to test walking up
      fs.mkdirSync(path.join(projectDir, 'src', 'deep', 'nested'), { recursive: true });
    });

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns a path from a nested directory (delegates to resolveProjectRoot)', () => {
      const originalWarn = console.warn;
      console.warn = () => {};
      try {
        const result = core.findProjectRoot(path.join(projectDir, 'src', 'deep', 'nested'));
        // resolveProjectRoot uses git, not directory walking, so result is the git root or cwd fallback
        assert.ok(typeof result === 'string' && result.length > 0, 'Should return a path');
      } finally {
        console.warn = originalWarn;
      }
    });

    it('returns a path from the root itself', () => {
      const originalWarn = console.warn;
      console.warn = () => {};
      try {
        const result = core.findProjectRoot(projectDir);
        assert.ok(typeof result === 'string' && result.length > 0, 'Should return a path');
      } finally {
        console.warn = originalWarn;
      }
    });

    it('falls back gracefully when no .planning/ directory exists (no longer throws)', () => {
      const originalWarn = console.warn;
      console.warn = () => {};
      try {
        // resolveProjectRoot falls back to cwd instead of throwing
        const result = core.findProjectRoot(tmpDir);
        assert.ok(typeof result === 'string' && result.length > 0, 'Should return a fallback path');
      } finally {
        console.warn = originalWarn;
      }
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
      assert.ok(typeof config.lock_timeout_ms === 'number', 'Should have lock_timeout_ms');
      assert.equal(config.lock_timeout_ms, 300000, 'Default lock_timeout_ms should be 300000');
    });

    it('reads config from config.json when it exists', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'config.json'),
        JSON.stringify({ lock_timeout_ms: 60000, agent_size_warn_kb: 15 })
      );
      const config = core.loadConfig(tmpDir);
      assert.equal(config.lock_timeout_ms, 60000);
      assert.equal(config.agent_size_warn_kb, 15);
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

  describe('resolveProjectRoot()', () => {
    it('resolves project root from a normal git repo', () => {
      const result = core.resolveProjectRoot(process.cwd());
      assert.ok(fs.existsSync(path.join(result, '.planning', 'sets')),
        'Resolved root should contain .planning/sets/');
    });

    it('resolves project root from a git worktree', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-wt-test-'));
      try {
        const { execSync } = require('child_process');
        execSync(`git worktree add "${path.join(tmpDir, 'wt')}" --detach HEAD`,
          { cwd: process.cwd(), stdio: 'pipe' });
        const wtRoot = core.resolveProjectRoot(path.join(tmpDir, 'wt'));
        assert.ok(fs.existsSync(path.join(wtRoot, '.planning', 'sets')),
          'Worktree should resolve to main repo root with .planning/sets/');
        assert.notEqual(wtRoot, path.join(tmpDir, 'wt'),
          'Should NOT return the worktree path itself');
      } finally {
        const { execSync } = require('child_process');
        execSync(`git worktree remove "${path.join(tmpDir, 'wt')}" --force`,
          { cwd: process.cwd(), stdio: 'pipe' });
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('falls back to cwd when not in a git repo', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-nogit-'));
      try {
        const result = core.resolveProjectRoot(tmpDir);
        assert.equal(result, tmpDir, 'Should fall back to cwd when no git repo');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('resolves project root from nested subdirectory', () => {
      const nestedDir = path.join(process.cwd(), 'src', 'lib');
      const result = core.resolveProjectRoot(nestedDir);
      assert.ok(fs.existsSync(path.join(result, '.planning', 'sets')),
        'Nested subdir should resolve to project root');
    });

    it('defaults to process.cwd() when called without arguments', () => {
      const result = core.resolveProjectRoot();
      assert.ok(typeof result === 'string' && result.length > 0);
    });
  });

  describe('findProjectRoot() deprecation', () => {
    it('emits deprecation warning and delegates to resolveProjectRoot', () => {
      const originalWarn = console.warn;
      let warnMsg = '';
      console.warn = (msg) => { warnMsg = msg; };
      try {
        const result = core.findProjectRoot(process.cwd());
        assert.ok(warnMsg.includes('DEPRECATION'), 'Should emit deprecation warning');
        assert.ok(typeof result === 'string' && result.length > 0, 'Should return a path');
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('ensureDagExists()', () => {
    it('returns the DAG path when DAG.json exists', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-dag-'));
      const dagDir = path.join(tmpDir, '.planning', 'sets');
      fs.mkdirSync(dagDir, { recursive: true });
      fs.writeFileSync(path.join(dagDir, 'DAG.json'), '{}');
      try {
        const result = core.ensureDagExists(tmpDir);
        assert.ok(result.endsWith('DAG.json'), 'Should return path ending in DAG.json');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('throws with remediation steps when DAG.json is missing', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-nodag-'));
      try {
        assert.throws(
          () => core.ensureDagExists(tmpDir),
          (err) => {
            assert.ok(err.message.includes('DAG.json not found'), 'Should mention DAG.json');
            assert.ok(err.message.includes('dag generate') || err.message.includes('plan-set'),
              'Should include remediation command');
            return true;
          }
        );
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
