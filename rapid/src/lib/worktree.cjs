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

// ────────────────────────────────────────────────────────────────
// Status Formatting
// ────────────────────────────────────────────────────────────────

/**
 * Format an ASCII status table for worktree entries.
 *
 * @param {Array<{ setName: string, branch: string, phase: string, status: string, path: string }>} worktrees
 * @returns {string} Formatted ASCII table or empty-state message
 */
function formatStatusTable(worktrees) {
  if (!worktrees || worktrees.length === 0) {
    return 'No active worktrees. Run worktree create to get started.';
  }

  const headers = ['SET', 'BRANCH', 'PHASE', 'STATUS', 'PATH'];
  const keys = ['setName', 'branch', 'phase', 'status', 'path'];

  // Calculate column widths: max of header length and all row value lengths
  const widths = headers.map((h, i) => {
    const key = keys[i];
    const maxDataLen = Math.max(...worktrees.map(w => String(w[key] || '').length));
    return Math.max(h.length, maxDataLen);
  });

  const pad = (str, width) => String(str || '').padEnd(width);
  const join = (cells) => cells.join('  ');

  const headerLine = join(headers.map((h, i) => pad(h, widths[i])));
  const separator = join(widths.map(w => '-'.repeat(w)));
  const rowLines = worktrees.map(entry =>
    join(keys.map((k, i) => pad(entry[k], widths[i])))
  );

  return [headerLine, separator, ...rowLines].join('\n');
}

/**
 * Format a per-wave progress summary from registry and DAG data.
 *
 * @param {{ version: number, worktrees: Object }} registry
 * @param {Object|null} dagJson - DAG object with waves property
 * @returns {string} Wave summary lines or empty string
 */
function formatWaveSummary(registry, dagJson) {
  if (!dagJson || !dagJson.waves) {
    return '';
  }

  const waveNums = Object.keys(dagJson.waves).sort((a, b) => Number(a) - Number(b));
  const lines = [];

  for (const waveNum of waveNums) {
    const waveSets = dagJson.waves[waveNum].sets || [];
    const total = waveSets.length;

    let done = 0;
    let executing = 0;
    let errorCount = 0;

    for (const setName of waveSets) {
      const entry = registry.worktrees[setName];
      if (entry) {
        if (entry.phase === 'Done') done++;
        else if (entry.phase === 'Executing') executing++;
        else if (entry.phase === 'Error') errorCount++;
      }
    }

    if (done === 0 && executing === 0 && errorCount === 0) {
      lines.push(`Wave ${waveNum}: ${total} sets pending`);
    } else {
      let line = `Wave ${waveNum}: ${done}/${total} done`;
      if (executing > 0) line += `, ${executing} executing`;
      if (errorCount > 0) line += `, ${errorCount} error`;
      lines.push(line);
    }
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Scoped CLAUDE.md Generation
// ────────────────────────────────────────────────────────────────

/**
 * Generate a scoped CLAUDE.md for a worktree's set, constraining the agent
 * to only its owned files with contracts, deny list, and style guide.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @returns {string} Assembled Markdown string
 */
function generateScopedClaudeMd(cwd, setName) {
  const plan = require('./plan.cjs');

  // Load set definition and contract
  const setData = plan.loadSet(cwd, setName);
  const contractJson = setData.contract;

  // Load OWNERSHIP.json (graceful if missing)
  let ownership = null;
  try {
    const ownershipPath = path.join(cwd, '.planning', 'sets', 'OWNERSHIP.json');
    ownership = JSON.parse(fs.readFileSync(ownershipPath, 'utf-8'));
  } catch (err) {
    // Graceful -- proceed with reduced content
  }

  // Load style guide (graceful if missing)
  let styleGuide = null;
  try {
    const stylePath = path.join(cwd, '.planning', 'context', 'STYLE_GUIDE.md');
    styleGuide = fs.readFileSync(stylePath, 'utf-8');
  } catch (err) {
    // Graceful -- skip style guide section
  }

  // Build owned files and deny list from OWNERSHIP.json
  const ownedFiles = [];
  const denyByOwner = {}; // { ownerSetName: [filePaths] }

  if (ownership && ownership.ownership) {
    for (const [filePath, owner] of Object.entries(ownership.ownership)) {
      if (owner === setName) {
        ownedFiles.push(filePath);
      } else {
        if (!denyByOwner[owner]) denyByOwner[owner] = [];
        denyByOwner[owner].push(filePath);
      }
    }
  }

  // Assemble Markdown sections
  const sections = [];

  // 1. Header
  sections.push(`# Set: ${setName} -- Scoped Agent Context`);
  sections.push('');

  // 2. Your Scope
  sections.push('## Your Scope');
  sections.push(`You are working on the '${setName}' set. ONLY modify files listed under File Ownership.`);
  sections.push('');

  // 3. Interface Contract
  sections.push('## Interface Contract');
  sections.push('');
  sections.push('```json');
  sections.push(JSON.stringify(contractJson, null, 2));
  sections.push('```');
  sections.push('');

  // 4. File Ownership
  sections.push('## File Ownership');
  sections.push('You may ONLY modify these files:');
  if (ownedFiles.length > 0) {
    for (const f of ownedFiles.sort()) {
      sections.push(`- ${f}`);
    }
  } else {
    sections.push('- (no files listed in OWNERSHIP.json)');
  }
  sections.push('');

  // 5. DO NOT TOUCH
  const denyOwners = Object.keys(denyByOwner).sort();
  if (denyOwners.length > 0) {
    sections.push('## DO NOT TOUCH');
    sections.push('These files are owned by other sets. Do NOT modify them:');
    sections.push('');
    for (const owner of denyOwners) {
      sections.push(`**${owner}:**`);
      for (const f of denyByOwner[owner].sort()) {
        sections.push(`- ${f}`);
      }
      sections.push('');
    }
  }

  // 6. Style Guide (if available)
  if (styleGuide) {
    sections.push('## Style Guide');
    sections.push(styleGuide.trim());
    sections.push('');
  }

  return sections.join('\n');
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
  formatStatusTable,
  formatWaveSummary,
  generateScopedClaudeMd,
};
