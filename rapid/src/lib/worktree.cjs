'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { acquireLock } = require('./lock.cjs');

const WORKTREE_DIR = '.rapid-worktrees';
const REGISTRY_DIR = '.planning/worktrees';
const REGISTRY_FILE = 'REGISTRY.json';

/**
 * Execute a git command and return structured result.
 *
 * @param {string[]} args - Git command arguments
 * @param {string} cwd - Working directory
 * @returns {{ ok: boolean, stdout?: string, exitCode?: number, stderr?: string }}
 */
function gitExec(args, cwd) {
  try {
    const result = execSync(`git ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return { ok: true, stdout: result.trim() };
  } catch (err) {
    return {
      ok: false,
      exitCode: err.status,
      stderr: (err.stderr || '').toString().trim(),
    };
  }
}

/**
 * Detect the current branch name.
 *
 * @param {string} cwd - Working directory (must be inside a git repo)
 * @returns {string} Branch name
 * @throws {Error} If HEAD is detached
 */
function detectMainBranch(cwd) {
  const result = gitExec(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  if (!result.ok) {
    throw new Error(`Cannot determine branch: ${result.stderr}`);
  }
  if (result.stdout === 'HEAD') {
    throw new Error('Detached HEAD -- cannot determine base branch');
  }
  return result.stdout;
}

/**
 * Ensure the .rapid-worktrees/ directory exists.
 *
 * @param {string} projectRoot - Project root directory
 */
function ensureWorktreeDir(projectRoot) {
  fs.mkdirSync(path.join(projectRoot, WORKTREE_DIR), { recursive: true });
}

/**
 * Create a new git worktree for a named set.
 *
 * @param {string} projectRoot - Project root directory
 * @param {string} setName - Set name (used for branch and directory)
 * @returns {{ branch: string, path: string }}
 * @throws {Error} If branch or path already exists
 */
function createWorktree(projectRoot, setName) {
  const branch = `rapid/${setName}`;
  const worktreePath = path.resolve(projectRoot, WORKTREE_DIR, setName);

  ensureWorktreeDir(projectRoot);

  const result = gitExec(
    ['worktree', 'add', '-b', branch, `"${worktreePath}"`, 'HEAD'],
    projectRoot
  );

  if (!result.ok) {
    if (result.stderr.includes('already exists')) {
      throw new Error(`Branch or worktree already exists for set "${setName}": ${result.stderr}`);
    }
    throw new Error(`Failed to create worktree for set "${setName}": ${result.stderr}`);
  }

  return { branch, path: worktreePath };
}

/**
 * Remove a git worktree.
 *
 * @param {string} projectRoot - Project root directory
 * @param {string} worktreePath - Absolute path to the worktree
 * @returns {{ removed: boolean, reason?: string, message?: string }}
 */
function removeWorktree(projectRoot, worktreePath) {
  const result = gitExec(['worktree', 'remove', `"${worktreePath}"`], projectRoot);

  if (!result.ok) {
    if (result.stderr.includes('modified or untracked') ||
        result.stderr.includes('contains modified or untracked files') ||
        result.exitCode === 128) {
      return { removed: false, reason: 'dirty', message: 'Worktree has uncommitted changes' };
    }
    return { removed: false, reason: 'error', message: result.stderr };
  }

  return { removed: true };
}

/**
 * List all git worktrees in porcelain format.
 *
 * @param {string} projectRoot - Project root directory
 * @returns {Array<{ path: string, head: string, branch?: string, detached?: boolean, locked?: boolean }>}
 */
function listWorktrees(projectRoot) {
  const result = gitExec(['worktree', 'list', '--porcelain'], projectRoot);

  if (!result.ok) {
    throw new Error(`Failed to list worktrees: ${result.stderr}`);
  }

  if (!result.stdout) return [];

  const blocks = result.stdout.split('\n\n').filter(b => b.trim().length > 0);
  const entries = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const entry = { path: '', head: '', branch: undefined, detached: false, locked: false };

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        entry.path = line.slice('worktree '.length);
      } else if (line.startsWith('HEAD ')) {
        entry.head = line.slice('HEAD '.length);
      } else if (line.startsWith('branch refs/heads/')) {
        entry.branch = line.slice('branch refs/heads/'.length);
      } else if (line === 'detached') {
        entry.detached = true;
      } else if (line.startsWith('locked')) {
        entry.locked = true;
      }
    }

    if (entry.path) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Load the worktree registry.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ version: number, worktrees: Object }}
 */
function loadRegistry(cwd) {
  const regPath = path.join(cwd, REGISTRY_DIR, REGISTRY_FILE);
  try {
    const raw = fs.readFileSync(regPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { version: 1, worktrees: {} };
    }
    throw err;
  }
}

/**
 * Write the worktree registry to disk.
 *
 * @param {string} cwd - Project root directory
 * @param {Object} registry - Registry data
 */
function writeRegistry(cwd, registry) {
  const regDir = path.join(cwd, REGISTRY_DIR);
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(
    path.join(regDir, REGISTRY_FILE),
    JSON.stringify(registry, null, 2) + '\n',
    'utf-8'
  );
}

/**
 * Update the worktree registry atomically with lock protection.
 *
 * @param {string} cwd - Project root directory
 * @param {function} updateFn - Function that receives current registry and returns updated registry
 * @returns {Promise<Object>} Updated registry
 */
async function registryUpdate(cwd, updateFn) {
  const release = await acquireLock(cwd, 'worktree-registry');
  try {
    const registry = loadRegistry(cwd);
    const updated = updateFn(registry);
    writeRegistry(cwd, updated);
    return updated;
  } finally {
    await release();
  }
}

/**
 * Reconcile the registry with actual git worktree state.
 * Marks orphaned entries and discovers unregistered RAPID worktrees.
 *
 * @param {string} cwd - Project root directory
 * @returns {Promise<Object>} Reconciled registry
 */
async function reconcileRegistry(cwd) {
  const release = await acquireLock(cwd, 'worktree-registry');
  try {
    const registry = loadRegistry(cwd);
    const gitWorktrees = listWorktrees(cwd);

    // Build a set of git worktree branch names for quick lookup
    const gitBranches = new Set(gitWorktrees.map(w => w.branch).filter(Boolean));
    const gitPaths = new Set(gitWorktrees.map(w => w.path));

    // Mark orphaned registry entries (in registry but not in git)
    for (const [setName, entry] of Object.entries(registry.worktrees)) {
      const expectedBranch = entry.branch || `rapid/${setName}`;
      if (!gitBranches.has(expectedBranch)) {
        entry.status = 'orphaned';
      }
    }

    // Discover unregistered RAPID worktrees (in git but not in registry)
    const registeredBranches = new Set(
      Object.values(registry.worktrees).map(e => e.branch || `rapid/${e.setName}`)
    );

    for (const wt of gitWorktrees) {
      if (wt.branch && wt.branch.startsWith('rapid/') && !registeredBranches.has(wt.branch)) {
        const setName = wt.branch.slice('rapid/'.length);
        registry.worktrees[setName] = {
          setName,
          branch: wt.branch,
          path: wt.path,
          phase: 'Created',
          status: 'active',
          discoveredAt: new Date().toISOString(),
        };
      }
    }

    writeRegistry(cwd, registry);
    return registry;
  } finally {
    await release();
  }
}

module.exports = {
  gitExec,
  detectMainBranch,
  createWorktree,
  removeWorktree,
  listWorktrees,
  loadRegistry,
  registryUpdate,
  reconcileRegistry,
  ensureWorktreeDir,
};
