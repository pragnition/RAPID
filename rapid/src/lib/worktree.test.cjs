'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Module under test
const worktree = require('./worktree.cjs');

// ────────────────────────────────────────────────────────────────
// Helper: create a real git repo in a temp dir with an initial commit
// ────────────────────────────────────────────────────────────────
function createTempRepo() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-worktree-test-'));
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}

function cleanupRepo(dir) {
  // Remove any worktrees first to prevent git complaints
  try {
    const result = execSync('git worktree list --porcelain', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const blocks = result.trim().split('\n\n');
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const pathLine = lines.find(l => l.startsWith('worktree '));
      if (pathLine) {
        const wtPath = pathLine.replace('worktree ', '');
        if (wtPath !== dir) {
          try {
            execSync(`git worktree remove --force "${wtPath}"`, { cwd: dir, stdio: 'pipe' });
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }
  fs.rmSync(dir, { recursive: true, force: true });
}

// ────────────────────────────────────────────────────────────────
// gitExec tests
// ────────────────────────────────────────────────────────────────
describe('gitExec', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('returns { ok: true, stdout } on success', () => {
    const result = worktree.gitExec(['rev-parse', '--is-inside-work-tree'], tmpDir);
    assert.equal(result.ok, true);
    assert.equal(result.stdout, 'true');
  });

  it('returns { ok: false, exitCode, stderr } on failure', () => {
    const result = worktree.gitExec(['rev-parse', '--verify', 'nonexistent-ref'], tmpDir);
    assert.equal(result.ok, false);
    assert.ok(typeof result.exitCode === 'number');
    assert.ok(typeof result.stderr === 'string');
  });
});

// ────────────────────────────────────────────────────────────────
// detectMainBranch tests
// ────────────────────────────────────────────────────────────────
describe('detectMainBranch', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('returns branch name in a normal repo', () => {
    const branch = worktree.detectMainBranch(tmpDir);
    assert.ok(typeof branch === 'string');
    assert.ok(branch.length > 0);
    // Default branch is typically 'main' or 'master'
    assert.ok(['main', 'master'].includes(branch) || branch.length > 0);
  });

  it('throws on detached HEAD', () => {
    // Detach HEAD
    const head = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    execSync(`git checkout ${head}`, { cwd: tmpDir, stdio: 'pipe' });
    assert.throws(() => worktree.detectMainBranch(tmpDir), /[Dd]etached HEAD/);
  });
});

// ────────────────────────────────────────────────────────────────
// ensureWorktreeDir tests
// ────────────────────────────────────────────────────────────────
describe('ensureWorktreeDir', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('creates .rapid-worktrees/ directory', () => {
    worktree.ensureWorktreeDir(tmpDir);
    assert.ok(fs.existsSync(path.join(tmpDir, '.rapid-worktrees')));
  });

  it('is idempotent', () => {
    worktree.ensureWorktreeDir(tmpDir);
    worktree.ensureWorktreeDir(tmpDir);
    assert.ok(fs.existsSync(path.join(tmpDir, '.rapid-worktrees')));
  });
});

// ────────────────────────────────────────────────────────────────
// createWorktree tests
// ────────────────────────────────────────────────────────────────
describe('createWorktree', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('creates a worktree with the expected branch and path', () => {
    const result = worktree.createWorktree(tmpDir, 'test-set');
    assert.equal(result.branch, 'rapid/test-set');
    assert.equal(result.path, path.resolve(tmpDir, '.rapid-worktrees', 'test-set'));
    assert.ok(fs.existsSync(result.path));
  });

  it('throws when branch already exists', () => {
    worktree.createWorktree(tmpDir, 'dup-set');
    assert.throws(() => worktree.createWorktree(tmpDir, 'dup-set'), /already exists/);
  });
});

// ────────────────────────────────────────────────────────────────
// removeWorktree tests
// ────────────────────────────────────────────────────────────────
describe('removeWorktree', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('removes a clean worktree successfully', () => {
    const { path: wtPath } = worktree.createWorktree(tmpDir, 'clean-set');
    const result = worktree.removeWorktree(tmpDir, wtPath);
    assert.equal(result.removed, true);
    assert.ok(!fs.existsSync(wtPath));
  });

  it('fails to remove a dirty worktree', () => {
    const { path: wtPath } = worktree.createWorktree(tmpDir, 'dirty-set');
    // Create an uncommitted file in the worktree
    fs.writeFileSync(path.join(wtPath, 'dirty-file.txt'), 'uncommitted content');
    execSync('git add dirty-file.txt', { cwd: wtPath, stdio: 'pipe' });

    const result = worktree.removeWorktree(tmpDir, wtPath);
    assert.equal(result.removed, false);
    assert.equal(result.reason, 'dirty');
  });
});

// ────────────────────────────────────────────────────────────────
// listWorktrees tests
// ────────────────────────────────────────────────────────────────
describe('listWorktrees', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('lists the main worktree by default', () => {
    const list = worktree.listWorktrees(tmpDir);
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 1, 'should have at least the main worktree');
    assert.ok(list[0].path, 'entry should have path');
    assert.ok(list[0].head, 'entry should have head');
  });

  it('shows new worktree after createWorktree', () => {
    worktree.createWorktree(tmpDir, 'listed-set');
    const list = worktree.listWorktrees(tmpDir);
    const found = list.find(e => e.branch === 'rapid/listed-set');
    assert.ok(found, 'should find the newly created worktree');
    assert.ok(found.path.includes('listed-set'));
  });
});

// ────────────────────────────────────────────────────────────────
// loadRegistry tests
// ────────────────────────────────────────────────────────────────
describe('loadRegistry', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('returns default registry when file is missing', () => {
    const reg = worktree.loadRegistry(tmpDir);
    assert.deepStrictEqual(reg, { version: 1, worktrees: {} });
  });

  it('reads existing registry file', () => {
    const regDir = path.join(tmpDir, '.planning', 'worktrees');
    fs.mkdirSync(regDir, { recursive: true });
    const data = { version: 1, worktrees: { foo: { setName: 'foo', status: 'active' } } };
    fs.writeFileSync(path.join(regDir, 'REGISTRY.json'), JSON.stringify(data, null, 2));

    const reg = worktree.loadRegistry(tmpDir);
    assert.deepStrictEqual(reg, data);
  });
});

// ────────────────────────────────────────────────────────────────
// registryUpdate tests
// ────────────────────────────────────────────────────────────────
describe('registryUpdate', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('applies updateFn and persists result', async () => {
    const result = await worktree.registryUpdate(tmpDir, (reg) => {
      reg.worktrees['my-set'] = { setName: 'my-set', status: 'active' };
      return reg;
    });
    assert.equal(result.worktrees['my-set'].status, 'active');

    // Verify persisted
    const onDisk = worktree.loadRegistry(tmpDir);
    assert.deepStrictEqual(onDisk.worktrees['my-set'], { setName: 'my-set', status: 'active' });
  });

  it('returns updated registry', async () => {
    const result = await worktree.registryUpdate(tmpDir, (reg) => {
      reg.worktrees['a'] = { setName: 'a' };
      return reg;
    });
    assert.ok(result.worktrees['a']);
  });
});

// ────────────────────────────────────────────────────────────────
// reconcileRegistry tests
// ────────────────────────────────────────────────────────────────
describe('reconcileRegistry', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('detects orphaned registry entries', async () => {
    // Write a registry entry for a worktree that does not exist in git
    const regDir = path.join(tmpDir, '.planning', 'worktrees');
    fs.mkdirSync(regDir, { recursive: true });
    const data = {
      version: 1,
      worktrees: {
        ghost: { setName: 'ghost', branch: 'rapid/ghost', status: 'active' },
      },
    };
    fs.writeFileSync(path.join(regDir, 'REGISTRY.json'), JSON.stringify(data, null, 2));

    const result = await worktree.reconcileRegistry(tmpDir);
    assert.equal(result.worktrees.ghost.status, 'orphaned');
  });

  it('discovers undiscovered RAPID worktrees', async () => {
    // Create a worktree with rapid/ branch prefix directly via git
    worktree.createWorktree(tmpDir, 'discovered-set');

    // Start with empty registry
    const regDir = path.join(tmpDir, '.planning', 'worktrees');
    fs.mkdirSync(regDir, { recursive: true });
    fs.writeFileSync(path.join(regDir, 'REGISTRY.json'), JSON.stringify({ version: 1, worktrees: {} }));

    const result = await worktree.reconcileRegistry(tmpDir);
    assert.ok(result.worktrees['discovered-set'], 'should discover the unregistered worktree');
    assert.equal(result.worktrees['discovered-set'].status, 'active');
  });
});

// ────────────────────────────────────────────────────────────────
// Integration: createWorktree + listWorktrees round-trip
// ────────────────────────────────────────────────────────────────
describe('Integration: createWorktree + listWorktrees round-trip', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  it('createWorktree followed by listWorktrees shows the new worktree', () => {
    const created = worktree.createWorktree(tmpDir, 'roundtrip');
    const list = worktree.listWorktrees(tmpDir);
    const entry = list.find(e => e.branch === 'rapid/roundtrip');
    assert.ok(entry, 'newly created worktree should appear in list');
    assert.equal(entry.path, created.path);
  });
});
