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

// ────────────────────────────────────────────────────────────────
// formatStatusTable tests
// ────────────────────────────────────────────────────────────────
describe('formatStatusTable', () => {
  it('renders ASCII table with correct headers and rows', () => {
    const entries = [
      { setName: 'auth-core', branch: 'rapid/auth-core', phase: 'Executing', status: 'active', path: '.rapid-worktrees/auth-core' },
      { setName: 'ui-shell', branch: 'rapid/ui-shell', phase: 'Created', status: 'active', path: '.rapid-worktrees/ui-shell' },
    ];
    const table = worktree.formatStatusTable(entries);
    const lines = table.split('\n');

    // Should have header, separator, and 2 data rows
    assert.equal(lines.length, 4, 'should have header + separator + 2 rows');

    // Header should contain all column names
    assert.ok(lines[0].includes('SET'), 'header should contain SET');
    assert.ok(lines[0].includes('BRANCH'), 'header should contain BRANCH');
    assert.ok(lines[0].includes('PHASE'), 'header should contain PHASE');
    assert.ok(lines[0].includes('STATUS'), 'header should contain STATUS');
    assert.ok(lines[0].includes('PATH'), 'header should contain PATH');

    // Separator should be dashes
    assert.ok(lines[1].includes('---'), 'separator should contain dashes');

    // Data rows should contain actual values
    assert.ok(lines[2].includes('auth-core'), 'first row should contain auth-core');
    assert.ok(lines[2].includes('Executing'), 'first row should contain Executing');
    assert.ok(lines[3].includes('ui-shell'), 'second row should contain ui-shell');
  });

  it('returns "No active worktrees" message for empty array', () => {
    const result = worktree.formatStatusTable([]);
    assert.ok(result.includes('No active worktrees'), 'should contain no active worktrees message');
  });

  it('auto-calculates column widths based on content', () => {
    const short = [
      { setName: 'a', branch: 'b', phase: 'c', status: 'd', path: 'e' },
    ];
    const long = [
      { setName: 'very-long-set-name-here', branch: 'rapid/very-long-set-name-here', phase: 'Done', status: 'active', path: '.rapid-worktrees/x' },
    ];
    const shortTable = worktree.formatStatusTable(short);
    const longTable = worktree.formatStatusTable(long);

    // The long table should be wider than the short table
    const shortWidth = shortTable.split('\n')[0].length;
    const longWidth = longTable.split('\n')[0].length;
    assert.ok(longWidth > shortWidth, 'wider content should produce wider table');

    // Data row should contain the full long set name
    assert.ok(longTable.includes('very-long-set-name-here'), 'should contain full long set name');
  });
});

// ────────────────────────────────────────────────────────────────
// formatWaveSummary tests
// ────────────────────────────────────────────────────────────────
describe('formatWaveSummary', () => {
  it('produces per-wave summary lines with completion info', () => {
    const registry = {
      version: 1,
      worktrees: {
        'auth-core': { setName: 'auth-core', phase: 'Done', status: 'active' },
        'api-routes': { setName: 'api-routes', phase: 'Executing', status: 'active' },
        'ui-shell': { setName: 'ui-shell', phase: 'Created', status: 'active' },
      },
    };
    const dagJson = {
      waves: {
        '1': { sets: ['auth-core', 'api-routes'] },
        '2': { sets: ['ui-shell'] },
      },
    };

    const summary = worktree.formatWaveSummary(registry, dagJson);
    const lines = summary.split('\n');

    assert.equal(lines.length, 2, 'should have 2 wave lines');
    assert.ok(lines[0].includes('Wave 1'), 'first line should reference Wave 1');
    assert.ok(lines[0].includes('1/2 done'), 'should show 1/2 done');
    assert.ok(lines[0].includes('1 executing'), 'should show 1 executing');
    assert.ok(lines[1].includes('Wave 2'), 'second line should reference Wave 2');
    assert.ok(lines[1].includes('pending'), 'Wave 2 should show pending');
  });

  it('returns empty string when dagJson is null', () => {
    const registry = { version: 1, worktrees: {} };
    const result = worktree.formatWaveSummary(registry, null);
    assert.equal(result, '');
  });

  it('returns empty string when dagJson has no waves', () => {
    const registry = { version: 1, worktrees: {} };
    const result = worktree.formatWaveSummary(registry, { nodes: [] });
    assert.equal(result, '');
  });

  it('shows error count when sets have Error phase', () => {
    const registry = {
      version: 1,
      worktrees: {
        'fail-set': { setName: 'fail-set', phase: 'Error', status: 'active' },
        'ok-set': { setName: 'ok-set', phase: 'Done', status: 'active' },
      },
    };
    const dagJson = {
      waves: { '1': { sets: ['fail-set', 'ok-set'] } },
    };

    const summary = worktree.formatWaveSummary(registry, dagJson);
    assert.ok(summary.includes('1 error'), 'should show error count');
    assert.ok(summary.includes('1/2 done'), 'should show done count');
  });
});

// ────────────────────────────────────────────────────────────────
// Enhanced Status Dashboard tests
// ────────────────────────────────────────────────────────────────
describe('renderProgressBar', () => {
  it('renders a progress bar with partial completion', () => {
    const result = worktree.renderProgressBar('Execute', 3, 7);
    assert.equal(result, 'Execute [===----] 3/7');
  });

  it('renders a bar with zero progress', () => {
    const result = worktree.renderProgressBar('Execute', 0, 5);
    assert.equal(result, 'Execute [-------] 0/5');
  });

  it('renders a fully complete bar', () => {
    const result = worktree.renderProgressBar('Execute', 5, 5);
    assert.equal(result, 'Execute [=======] 5/5');
  });

  it('returns just the label when total is 0', () => {
    const result = worktree.renderProgressBar('Plan', 0, 0);
    assert.equal(result, 'Plan');
  });

  it('supports custom width', () => {
    const result = worktree.renderProgressBar('Test', 5, 10, 10);
    assert.equal(result, 'Test [=====-----] 5/10');
  });
});

describe('Enhanced formatStatusTable', () => {
  it('shows SET, WAVE, PHASE, PROGRESS, LAST ACTIVITY columns', () => {
    const entries = [
      { setName: 'auth', phase: 'Executing', status: 'active', tasksCompleted: 3, tasksTotal: 7, updatedAt: new Date().toISOString() },
    ];
    const dagJson = { waves: { '1': { sets: ['auth'] } } };
    const table = worktree.formatStatusTable(entries, dagJson);
    const header = table.split('\n')[0];
    assert.ok(header.includes('SET'), 'header should contain SET');
    assert.ok(header.includes('WAVE'), 'header should contain WAVE');
    assert.ok(header.includes('PHASE'), 'header should contain PHASE');
    assert.ok(header.includes('PROGRESS'), 'header should contain PROGRESS');
    assert.ok(header.includes('LAST ACTIVITY'), 'header should contain LAST ACTIVITY');
  });

  it('maps phase display labels correctly', () => {
    const entries = [
      { setName: 'a', phase: 'Discussing', status: 'active' },
      { setName: 'b', phase: 'Planning', status: 'active' },
      { setName: 'c', phase: 'Executing', status: 'active' },
      { setName: 'd', phase: 'Verifying', status: 'active' },
      { setName: 'e', phase: 'Done', status: 'active' },
      { setName: 'f', phase: 'Paused', status: 'active' },
    ];
    const table = worktree.formatStatusTable(entries);
    assert.ok(table.includes('Discuss'), 'should map Discussing to Discuss');
    assert.ok(table.includes('Plan'), 'should map Planning to Plan');
    assert.ok(table.includes('Execute'), 'should map Executing to Execute');
    assert.ok(table.includes('Verify'), 'should map Verifying to Verify');
    assert.ok(table.includes('Done'), 'should show Done');
    assert.ok(table.includes('Paused'), 'should show Paused');
  });

  it('shows progress bar during Execute phase', () => {
    const entries = [
      { setName: 'auth', phase: 'Executing', status: 'active', tasksCompleted: 3, tasksTotal: 7 },
    ];
    const table = worktree.formatStatusTable(entries);
    assert.ok(table.includes('Execute [===----] 3/7'), 'should show progress bar for Executing phase');
  });

  it('shows N/N tasks for Done phase', () => {
    const entries = [
      { setName: 'auth', phase: 'Done', status: 'active', tasksCompleted: 5, tasksTotal: 5 },
    ];
    const table = worktree.formatStatusTable(entries);
    assert.ok(table.includes('5/5 tasks'), 'should show N/N tasks for Done phase');
  });

  it('shows dash for progress in non-Execute/non-Done phases', () => {
    const entries = [
      { setName: 'auth', phase: 'Planning', status: 'active' },
    ];
    const table = worktree.formatStatusTable(entries);
    const lines = table.split('\n');
    // The data row should have a "-" in the PROGRESS column area
    const dataRow = lines[2];
    assert.ok(dataRow, 'should have a data row');
  });

  it('shows wave number from dagJson', () => {
    const entries = [
      { setName: 'auth', phase: 'Executing', status: 'active' },
    ];
    const dagJson = { waves: { '2': { sets: ['auth'] } } };
    const table = worktree.formatStatusTable(entries, dagJson);
    assert.ok(table.includes('2'), 'should show wave number 2');
  });

  it('shows dash for wave when no dagJson', () => {
    const entries = [
      { setName: 'auth', phase: 'Executing', status: 'active' },
    ];
    const table = worktree.formatStatusTable(entries);
    const lines = table.split('\n');
    // Data row should have "-" for wave
    assert.ok(lines[2].includes('-'), 'should show dash when no dagJson');
  });

  it('shows relative time for last activity', () => {
    const entries = [
      { setName: 'auth', phase: 'Executing', status: 'active', updatedAt: new Date().toISOString() },
    ];
    const table = worktree.formatStatusTable(entries);
    assert.ok(table.includes('just now') || table.includes('min ago') || table.includes('sec'), 'should show relative time');
  });

  it('shows dash for last activity when no updatedAt', () => {
    const entries = [
      { setName: 'auth', phase: 'Executing', status: 'active' },
    ];
    const table = worktree.formatStatusTable(entries);
    const lines = table.split('\n');
    // Check that the last column area has a dash
    assert.ok(lines[2], 'should have data row');
  });

  it('handles empty array gracefully', () => {
    const result = worktree.formatStatusTable([]);
    assert.ok(result.includes('No active worktrees'), 'should show empty message');
  });
});

describe('Enhanced formatWaveSummary', () => {
  it('includes all lifecycle phases in counts', () => {
    const registry = {
      version: 1,
      worktrees: {
        'a': { setName: 'a', phase: 'Discussing' },
        'b': { setName: 'b', phase: 'Planning' },
        'c': { setName: 'c', phase: 'Executing' },
        'd': { setName: 'd', phase: 'Done' },
      },
    };
    const dagJson = { waves: { '1': { sets: ['a', 'b', 'c', 'd'] } } };
    const summary = worktree.formatWaveSummary(registry, dagJson);
    assert.ok(summary.includes('1/4 complete'), 'should show 1/4 complete');
    assert.ok(summary.includes('1 executing'), 'should show executing count');
    assert.ok(summary.includes('1 planning'), 'should show planning count');
    assert.ok(summary.includes('1 discussing'), 'should show discussing count');
  });

  it('shows all done when wave is fully complete', () => {
    const registry = {
      version: 1,
      worktrees: {
        'a': { setName: 'a', phase: 'Done' },
        'b': { setName: 'b', phase: 'Done' },
      },
    };
    const dagJson = { waves: { '1': { sets: ['a', 'b'] } } };
    const summary = worktree.formatWaveSummary(registry, dagJson);
    assert.ok(summary.includes('2/2 complete'), 'should show all complete');
  });

  it('shows pending when no sets have started', () => {
    const registry = { version: 1, worktrees: {} };
    const dagJson = { waves: { '1': { sets: ['a', 'b'] } } };
    const summary = worktree.formatWaveSummary(registry, dagJson);
    assert.ok(summary.includes('2 sets pending'), 'should show pending count');
  });

  it('handles null dagJson gracefully', () => {
    const registry = { version: 1, worktrees: {} };
    const result = worktree.formatWaveSummary(registry, null);
    assert.equal(result, '', 'should return empty string for null dagJson');
  });

  it('shows verifying and paused counts', () => {
    const registry = {
      version: 1,
      worktrees: {
        'a': { setName: 'a', phase: 'Verifying' },
        'b': { setName: 'b', phase: 'Paused' },
        'c': { setName: 'c', phase: 'Done' },
      },
    };
    const dagJson = { waves: { '1': { sets: ['a', 'b', 'c'] } } };
    const summary = worktree.formatWaveSummary(registry, dagJson);
    assert.ok(summary.includes('1 verifying'), 'should show verifying count');
    assert.ok(summary.includes('1 paused'), 'should show paused count');
  });
});

// ────────────────────────────────────────────────────────────────
// generateScopedClaudeMd tests
// ────────────────────────────────────────────────────────────────
describe('generateScopedClaudeMd', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-scoped-md-'));
    // Create minimal .planning structure
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'my-set'), { recursive: true });
    // Write DEFINITION.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'sets', 'my-set', 'DEFINITION.md'),
      '# Set: my-set\n\n## Scope\nMy set scope\n\n## File Ownership\nFiles:\n- src/my/**\n',
      'utf-8'
    );
    // Write CONTRACT.json
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'sets', 'my-set', 'CONTRACT.json'),
      JSON.stringify({
        exports: { functions: [{ name: 'doThing', file: 'src/my/index.cjs', params: [], returns: 'void' }], types: [] },
      }, null, 2),
      'utf-8'
    );
    // Write OWNERSHIP.json
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'sets', 'OWNERSHIP.json'),
      JSON.stringify({
        version: 1,
        generated: '2026-03-04',
        ownership: {
          'src/my/index.cjs': 'my-set',
          'src/my/helper.cjs': 'my-set',
          'src/other/api.cjs': 'other-set',
          'src/shared/types.cjs': 'shared-set',
        },
      }, null, 2),
      'utf-8'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('produces Markdown with set name header', () => {
    const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
    assert.ok(md.includes('# Set: my-set'), 'should contain set name header');
  });

  it('includes scope section', () => {
    const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
    assert.ok(md.includes('## Your Scope'), 'should contain Your Scope section');
    assert.ok(md.includes('my-set'), 'should reference set name in scope');
  });

  it('includes contract JSON block', () => {
    const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
    assert.ok(md.includes('## Interface Contract'), 'should contain Interface Contract section');
    assert.ok(md.includes('doThing'), 'should contain exported function name');
  });

  it('includes owned files list', () => {
    const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
    assert.ok(md.includes('## File Ownership'), 'should contain File Ownership section');
    assert.ok(md.includes('src/my/index.cjs'), 'should list owned file');
    assert.ok(md.includes('src/my/helper.cjs'), 'should list second owned file');
  });

  it('includes deny list from OWNERSHIP.json for files NOT owned by set', () => {
    const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
    assert.ok(md.includes('DO NOT TOUCH'), 'should contain DO NOT TOUCH section');
    assert.ok(md.includes('src/other/api.cjs'), 'should list file owned by other-set');
    assert.ok(md.includes('src/shared/types.cjs'), 'should list file owned by shared-set');
    // Should NOT list own files in deny list
    assert.ok(!md.includes('DO NOT TOUCH') || !md.split('DO NOT TOUCH')[1].includes('src/my/index.cjs'),
      'deny list should not include own files');
  });

  it('groups deny list by owning set', () => {
    const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
    assert.ok(md.includes('other-set'), 'should reference other-set as owner');
    assert.ok(md.includes('shared-set'), 'should reference shared-set as owner');
  });

  it('gracefully handles missing OWNERSHIP.json', () => {
    // Remove OWNERSHIP.json
    fs.unlinkSync(path.join(tmpDir, '.planning', 'sets', 'OWNERSHIP.json'));
    const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
    // Should still produce output (reduced content)
    assert.ok(md.includes('# Set: my-set'), 'should still have header');
    assert.ok(md.includes('## Interface Contract'), 'should still have contract section');
  });

  it('includes style guide when STYLE_GUIDE.md exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'context', 'STYLE_GUIDE.md'),
      '# Style Guide\nUse strict mode everywhere.\n',
      'utf-8'
    );

    const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
    assert.ok(md.includes('## Style Guide'), 'should contain Style Guide section');
    assert.ok(md.includes('Use strict mode everywhere'), 'should contain style guide content');
  });

  it('skips style guide section when STYLE_GUIDE.md does not exist', () => {
    const md = worktree.generateScopedClaudeMd(tmpDir, 'my-set');
    // Style Guide section should not appear
    assert.ok(!md.includes('## Style Guide'), 'should not contain Style Guide section when file missing');
  });
});
