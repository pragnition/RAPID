'use strict';

const lockfile = require('proper-lockfile');
const fs = require('fs');
const path = require('path');

const LOCKS_DIR = '.planning/.locks';
const STALE_THRESHOLD = 300000; // 5 minutes (300,000ms)
const RETRY_CONFIG = {
  retries: 10,
  factor: 2,
  minTimeout: 100,
  maxTimeout: 2000,
  randomize: true,
};

/**
 * Ensure .planning/.locks/ directory exists with a .gitignore inside it.
 * The .gitignore ensures lock files are never committed to git.
 *
 * @param {string} cwd - Project root directory
 */
function ensureLocksDir(cwd) {
  const locksPath = path.join(cwd, LOCKS_DIR);
  fs.mkdirSync(locksPath, { recursive: true });

  const gitignorePath = path.join(locksPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*\n!.gitignore\n', 'utf-8');
  }
}

/**
 * Acquire a lock on a named resource.
 * Creates a lock target file if needed, then uses proper-lockfile for atomic
 * mkdir-based locking with stale detection and retry.
 *
 * @param {string} cwd - Project root directory
 * @param {string} lockName - Lock identifier (e.g., 'state', 'config')
 * @returns {Promise<Function>} Release function to call when done
 */
async function acquireLock(cwd, lockName, options = {}) {
  const { onCompromised: onCompromisedMode = 'continue' } = options;
  ensureLocksDir(cwd);
  const lockTarget = path.join(cwd, LOCKS_DIR, `${lockName}.target`);

  // Create lock target file if it does not exist
  if (!fs.existsSync(lockTarget)) {
    fs.writeFileSync(lockTarget, JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
    }), 'utf-8');
  }

  let compromised = false;

  const release = await lockfile.lock(lockTarget, {
    stale: STALE_THRESHOLD,
    update: Math.floor(STALE_THRESHOLD / 2),
    retries: RETRY_CONFIG,
    realpath: false,
    onCompromised: (err) => {
      process.stderr.write(`[RAPID] Lock "${lockName}" compromised: ${err.message}\n`);
      if (onCompromisedMode === 'abort') {
        compromised = true;
      }
      // In 'continue' mode, log but don't crash -- let the operation complete
    },
  });

  // Update lock target with current PID after acquisition
  fs.writeFileSync(lockTarget, JSON.stringify({
    pid: process.pid,
    timestamp: Date.now(),
  }), 'utf-8');

  // Check if compromise happened during lock acquisition (race condition)
  if (onCompromisedMode === 'abort' && compromised) {
    await release();
    const err = new Error('Lock compromised during state transaction');
    err.code = 'LOCK_COMPROMISED';
    throw err;
  }

  if (onCompromisedMode === 'abort') {
    // Return wrapper that checks compromised flag before releasing
    return async () => {
      if (compromised) {
        try { await release(); } catch { /* best effort */ }
        const err = new Error('Lock compromised during state transaction');
        err.code = 'LOCK_COMPROMISED';
        throw err;
      }
      return release();
    };
  }

  return release;
}

/**
 * Synchronous non-blocking check of whether a lock is currently held.
 *
 * @param {string} cwd - Project root directory
 * @param {string} lockName - Lock identifier
 * @returns {boolean} true if locked, false if not
 */
function isLocked(cwd, lockName) {
  const lockTarget = path.join(cwd, LOCKS_DIR, `${lockName}.target`);
  if (!fs.existsSync(lockTarget)) return false;
  try {
    return lockfile.checkSync(lockTarget, {
      stale: STALE_THRESHOLD,
      realpath: false,
    });
  } catch {
    return false;
  }
}

/**
 * Check if a process with the given PID is alive.
 * Uses signal 0 which performs an existence check without sending a signal.
 *
 * @param {number} pid - Process ID to check
 * @returns {boolean} true if process exists, false if not
 */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove lock artifacts (target file + .lock directory) for locks owned
 * by processes that are no longer alive. Safe to call at startup.
 *
 * @param {string} cwd - Project root directory
 */
function cleanStaleLocks(cwd) {
  const locksPath = path.join(cwd, LOCKS_DIR);
  if (!fs.existsSync(locksPath)) return;

  const targets = fs.readdirSync(locksPath).filter(f => f.endsWith('.target'));
  for (const target of targets) {
    const targetPath = path.join(locksPath, target);
    try {
      const data = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      if (data.pid && !isProcessAlive(data.pid)) {
        // Owning process is dead -- clean up lock artifacts
        const lockDir = targetPath + '.lock';
        if (fs.existsSync(lockDir)) {
          fs.rmSync(lockDir, { recursive: true, force: true });
        }
        fs.unlinkSync(targetPath);
      }
    } catch {
      // If we can't read/parse the target file, skip it
    }
  }
}

module.exports = { acquireLock, isLocked, ensureLocksDir, cleanStaleLocks };
