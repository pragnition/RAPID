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
 * Display label map for internal phase values.
 * @type {Object<string, string>}
 */
const PHASE_DISPLAY = {
  Discussing: 'Discuss',
  Planning: 'Plan',
  Executing: 'Execute',
  Verifying: 'Verify',
  Done: 'Done',
  Error: 'Error',
  Paused: 'Paused',
  Created: 'Created',
  Pending: 'Pending',
};

/**
 * Render an ASCII progress bar.
 *
 * @param {string} label - Phase label (e.g., 'Execute')
 * @param {number} completed - Number of completed items
 * @param {number} total - Total number of items
 * @param {number} [width=7] - Width of the bar in characters
 * @returns {string} Formatted progress bar or just the label if total is 0
 */
function renderProgressBar(label, completed, total, width = 7) {
  if (total === 0) return label;
  const filled = Math.round((completed / total) * width);
  const empty = width - filled;
  const bar = '='.repeat(filled) + '-'.repeat(empty);
  return `${label} [${bar}] ${completed}/${total}`;
}

/**
 * Calculate a relative time string from an ISO date string.
 *
 * @param {string|null|undefined} isoString - ISO 8601 timestamp
 * @returns {string} Human-readable relative time or "-" if falsy
 */
function relativeTime(isoString) {
  if (!isoString) return '-';
  const diff = Date.now() - Date.parse(isoString);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

/**
 * Look up which wave a set belongs to from DAG data.
 *
 * @param {string} setName - The set to look up
 * @param {Object|null} dagJson - DAG object with waves property
 * @returns {string} Wave number or "-" if unknown
 */
function lookupWave(setName, dagJson) {
  if (!dagJson || !dagJson.waves) return '-';
  for (const [waveNum, waveData] of Object.entries(dagJson.waves)) {
    if (waveData.sets && waveData.sets.includes(setName)) {
      return waveNum;
    }
  }
  return '-';
}

/**
 * Format an ASCII status table for worktree entries.
 * Enhanced with 5-column layout: SET, WAVE, PHASE, PROGRESS, LAST ACTIVITY
 *
 * @param {Array<Object>} worktrees - Array of worktree registry entries
 * @param {Object|null} [dagJson=null] - Optional DAG object for wave lookup
 * @returns {string} Formatted ASCII table or empty-state message
 */
function formatStatusTable(worktrees, dagJson = null) {
  if (!worktrees || worktrees.length === 0) {
    return 'No active worktrees. Run worktree create to get started.';
  }

  const headers = ['SET', 'WAVE', 'PHASE', 'PROGRESS', 'LAST ACTIVITY'];

  // Build row data
  const rows = worktrees.map(entry => {
    const phase = entry.phase || 'Pending';
    const displayPhase = PHASE_DISPLAY[phase] || phase;

    // Wave lookup
    const wave = lookupWave(entry.setName, dagJson);

    // Progress column
    let progress = '-';
    if (phase === 'Executing' && typeof entry.tasksCompleted === 'number' && typeof entry.tasksTotal === 'number') {
      progress = renderProgressBar('Execute', entry.tasksCompleted, entry.tasksTotal);
    } else if (phase === 'Done' && typeof entry.tasksTotal === 'number') {
      progress = `${entry.tasksTotal}/${entry.tasksTotal} tasks`;
    }

    // Last activity
    const lastActivity = relativeTime(entry.updatedAt);

    return [entry.setName, wave, displayPhase, progress, lastActivity];
  });

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxDataLen = Math.max(...rows.map(r => String(r[i] || '').length));
    return Math.max(h.length, maxDataLen);
  });

  const pad = (str, width) => String(str || '').padEnd(width);
  const join = (cells) => cells.join('  ');

  const headerLine = join(headers.map((h, i) => pad(h, widths[i])));
  const separator = join(widths.map(w => '-'.repeat(w)));
  const rowLines = rows.map(row =>
    join(row.map((cell, i) => pad(cell, widths[i])))
  );

  return [headerLine, separator, ...rowLines].join('\n');
}

/**
 * Format a per-wave progress summary from registry and DAG data.
 * Enhanced to include all lifecycle phases: discussing, planning, executing, verifying, paused, error, done.
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
    let discussing = 0;
    let planning = 0;
    let verifying = 0;
    let paused = 0;

    for (const setName of waveSets) {
      const entry = registry.worktrees[setName];
      if (entry) {
        switch (entry.phase) {
          case 'Done': done++; break;
          case 'Executing': executing++; break;
          case 'Error': errorCount++; break;
          case 'Discussing': discussing++; break;
          case 'Planning': planning++; break;
          case 'Verifying': verifying++; break;
          case 'Paused': paused++; break;
        }
      }
    }

    const hasActivity = done > 0 || executing > 0 || errorCount > 0 ||
      discussing > 0 || planning > 0 || verifying > 0 || paused > 0;

    if (!hasActivity) {
      lines.push(`Wave ${waveNum}: ${total} sets pending`);
    } else if (done === total) {
      lines.push(`Wave ${waveNum}: ${done}/${total} complete`);
    } else {
      const parts = [`Wave ${waveNum}: ${done}/${total} complete`];
      if (executing > 0) parts.push(`${executing} executing`);
      if (verifying > 0) parts.push(`${verifying} verifying`);
      if (planning > 0) parts.push(`${planning} planning`);
      if (discussing > 0) parts.push(`${discussing} discussing`);
      if (paused > 0) parts.push(`${paused} paused`);
      if (errorCount > 0) parts.push(`${errorCount} error`);
      lines.push(parts.join(' | '));
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
  renderProgressBar,
  generateScopedClaudeMd,
};
