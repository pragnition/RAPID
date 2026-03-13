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
  if (!setName || typeof setName !== 'string' || setName.trim() === '' || /\s/.test(setName)) {
    throw new Error(`Invalid set name: "${setName}". Set name must be a non-empty string with no whitespace.`);
  }

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
 * Delete a git branch with optional force mode.
 *
 * @param {string} cwd - Working directory (must be inside a git repo)
 * @param {string} branchName - Branch name to delete
 * @param {boolean} [force=false] - Use -D (force) instead of -d (safe)
 * @returns {{ deleted: boolean, branch: string, forced?: boolean, reason?: string, message?: string }}
 * @throws {Error} If branchName is empty or contains spaces
 */
function deleteBranch(cwd, branchName, force = false) {
  if (!branchName || typeof branchName !== 'string' || branchName.trim() === '' || branchName.includes(' ')) {
    throw new Error(`Invalid branch name: "${branchName}". Branch name must be non-empty and contain no spaces.`);
  }

  const flag = force ? '-D' : '-d';
  const result = gitExec(['branch', flag, branchName], cwd);

  if (result.ok) {
    const ret = { deleted: true, branch: branchName };
    if (force) ret.forced = true;
    return ret;
  }

  // Branch not found
  if (result.stderr.includes('not found') || result.stderr.includes('error: branch')) {
    return { deleted: false, reason: 'not-found', branch: branchName, message: result.stderr };
  }

  // Unmerged branch (git branch -d fails when branch is not fully merged)
  if (result.stderr.includes('not fully merged') || result.stderr.includes('is not fully merged')) {
    return { deleted: false, reason: 'unmerged', branch: branchName, message: result.stderr };
  }

  // Other error
  return { deleted: false, reason: 'error', branch: branchName, message: result.stderr };
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

    // Mark orphaned registry entries (in registry but not in git)
    for (const [setName, entry] of Object.entries(registry.worktrees)) {
      const expectedBranch = entry.branch || `rapid/${setName}`;
      if (!gitBranches.has(expectedBranch)) {
        entry.status = 'orphaned';
      }
    }

    // Discover unregistered RAPID worktrees (in git but not in registry)
    const registeredBranches = new Set(
      Object.entries(registry.worktrees).map(([key, e]) => e.branch || `rapid/${key}`)
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
// Set Init Orchestration
// ────────────────────────────────────────────────────────────────

/**
 * Initialize a set for development: create worktree, generate scoped CLAUDE.md,
 * and register in REGISTRY.json. Does NOT transition set status in STATE.json.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set to initialize
 * @returns {Promise<{ created: boolean, branch: string, worktreePath: string, setName: string, claudeMdGenerated: boolean, claudeMdError: string|null }>}
 * @throws {Error} If branch/worktree already exists, or set definition is missing
 */
async function setInit(cwd, setName) {
  // 1. Create the git worktree and branch
  const { branch, path: worktreePath } = createWorktree(cwd, setName);

  // 2. Generate scoped CLAUDE.md and write to worktree
  let claudeMdGenerated = false;
  let claudeMdError = null;
  try {
    const claudeMd = generateScopedClaudeMd(cwd, setName);
    fs.writeFileSync(path.join(worktreePath, 'CLAUDE.md'), claudeMd, 'utf-8');
    claudeMdGenerated = true;
  } catch (err) {
    // Graceful -- worktree was created but CLAUDE.md generation failed
    // (e.g., missing CONTRACT.json or DEFINITION.md)
    // Still proceed with registration; surface error for debugging
    claudeMdError = err.message;
  }

  // 3. Register in REGISTRY.json
  await registryUpdate(cwd, (reg) => {
    reg.worktrees[setName] = {
      setName,
      branch,
      path: path.relative(cwd, worktreePath),
      phase: 'Created',
      status: 'active',
      wave: null,
      createdAt: new Date().toISOString(),
    };
    return reg;
  });

  // 4. Return structured result (do NOT call transitionSet -- set stays 'pending')
  return {
    created: true,
    branch,
    worktreePath,
    setName,
    claudeMdGenerated,
    claudeMdError,
  };
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
  if (isNaN(diff)) return '-';
  if (diff < 0) return 'just now';
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

/**
 * Format status output with optional execution mode indicator.
 * Per user decision: /rapid:status shows "Execution mode: Agent Teams" or "Execution mode: Subagents"
 *
 * @param {Array<Object>} worktrees - Array of worktree registry entries
 * @param {Object|null} [dagJson=null] - Optional DAG for wave lookup
 * @param {string|null} [executionMode=null] - Execution mode label or null to omit
 * @returns {string} Formatted output with optional mode header
 */
// ────────────────────────────────────────────────────────────────
// Mark II Status Dashboard
// ────────────────────────────────────────────────────────────────

/**
 * Sort priority for set statuses. Lower number = displayed first.
 * @type {Object<string, number>}
 */
const STATUS_SORT_ORDER = {
  executing: 0,
  reviewing: 1,
  merging: 2,
  planning: 3,
  pending: 4,
  complete: 5,
};

/**
 * Format a compact wave progress string for a set's waves.
 * E.g., "W1: 3/5 done, W2: 0/3 pending"
 *
 * @param {Array<{id: string, status: string, jobs: Array<{id: string, status: string}>}>} waves
 * @returns {string} Compact wave progress or "-" if no waves
 */
function formatWaveProgress(waves) {
  if (!waves || waves.length === 0) return '-';

  const parts = [];
  for (let i = 0; i < waves.length; i++) {
    const wave = waves[i];
    const total = wave.jobs ? wave.jobs.length : 0;
    const completed = wave.jobs ? wave.jobs.filter(j => j.status === 'complete').length : 0;
    const label = `W${i + 1}`;

    if (completed === total && total > 0) {
      parts.push(`${label}: ${completed}/${total} done`);
    } else if (completed > 0) {
      parts.push(`${label}: ${completed}/${total} done`);
    } else {
      parts.push(`${label}: ${completed}/${total} pending`);
    }
  }

  return parts.join(', ');
}

/**
 * Format an ASCII status table for Mark II set > wave > job hierarchy.
 * Reads from STATE.json for hierarchy data and REGISTRY.json for worktree paths.
 *
 * @param {{ milestone: string, sets: Array<{id: string, status: string, waves: Array}>}} stateData
 * @param {{ worktrees: Object }} registryData
 * @returns {string} Formatted ASCII table or "No sets found" message
 */
function formatMarkIIStatus(stateData, registryData) {
  if (!stateData.sets || stateData.sets.length === 0) {
    return 'No sets found in the current milestone.';
  }

  const headers = ['SET', 'STATUS', 'WAVES', 'WORKTREE', 'UPDATED'];

  // Sort sets by status priority
  const sortedSets = [...stateData.sets].sort((a, b) => {
    const orderA = STATUS_SORT_ORDER[a.status] ?? 4;
    const orderB = STATUS_SORT_ORDER[b.status] ?? 4;
    return orderA - orderB;
  });

  // Build row data
  const rows = sortedSets.map(set => {
    const setId = set.id.length > 20 ? set.id.slice(0, 20) : set.id;
    const status = set.status;
    const waveProgress = formatWaveProgress(set.waves);

    // Worktree path from registry
    const regEntry = registryData.worktrees[set.id];
    const worktreePath = regEntry ? regEntry.path : 'not created';

    // Updated time from registry
    const updatedAt = regEntry && regEntry.updatedAt ? relativeTime(regEntry.updatedAt) : '-';

    return [setId, status, waveProgress, worktreePath, updatedAt];
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
 * Derive context-aware next actions based on current state.
 *
 * @param {{ milestone: string, sets: Array<{id: string, status: string, waves: Array}>}} stateData
 * @param {{ worktrees: Object }} registryData
 * @returns {Array<{action: string, setName?: string, description: string}>} Max 5 actions
 */
function deriveNextActions(stateData, registryData) {
  const actions = [];

  for (const set of stateData.sets) {
    const hasWorktree = !!registryData.worktrees[set.id];

    switch (set.status) {
      case 'pending':
        if (!hasWorktree) {
          actions.push({
            action: `/set-init ${set.id}`,
            setName: set.id,
            description: `Initialize the ${set.id} set for development`,
          });
        } else {
          actions.push({
            action: `/discuss ${set.id}`,
            setName: set.id,
            description: `Start planning discussion for ${set.id}`,
          });
        }
        break;
      case 'executing':
        actions.push({
          action: `/execute ${set.id}`,
          setName: set.id,
          description: `Continue executing ${set.id}`,
        });
        break;
      case 'reviewing':
        actions.push({
          action: `/review ${set.id}`,
          setName: set.id,
          description: `Run review for ${set.id}`,
        });
        break;
      case 'merging':
        actions.push({
          action: `/merge ${set.id}`,
          setName: set.id,
          description: `Merge set ${set.id}`,
        });
        break;
      case 'complete':
        if (hasWorktree) {
          actions.push({
            action: `/cleanup ${set.id}`,
            setName: set.id,
            description: `Clean up worktree for completed set ${set.id}`,
          });
        }
        break;
    }
  }

  return actions.slice(0, 5);
}

function formatStatusOutput(worktrees, dagJson, executionMode) {
  const lines = [];
  if (executionMode) {
    lines.push(`Execution mode: ${executionMode}`);
    lines.push('');
  }
  lines.push(formatStatusTable(worktrees, dagJson));
  return lines.join('\n');
}

module.exports = {
  gitExec,
  detectMainBranch,
  createWorktree,
  removeWorktree,
  deleteBranch,
  listWorktrees,
  loadRegistry,
  registryUpdate,
  reconcileRegistry,
  ensureWorktreeDir,
  setInit,
  formatStatusTable,
  formatStatusOutput,
  formatWaveSummary,
  renderProgressBar,
  generateScopedClaudeMd,
  formatMarkIIStatus,
  deriveNextActions,
};
