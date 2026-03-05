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
async function acquireLock(cwd, lockName) {
  ensureLocksDir(cwd);
  const lockTarget = path.join(cwd, LOCKS_DIR, `${lockName}.target`);

  // Create lock target file if it does not exist
  if (!fs.existsSync(lockTarget)) {
    fs.writeFileSync(lockTarget, JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
    }), 'utf-8');
  }

  const release = await lockfile.lock(lockTarget, {
    stale: STALE_THRESHOLD,
    update: Math.floor(STALE_THRESHOLD / 2),
    retries: RETRY_CONFIG,
    realpath: false,
    onCompromised: (err) => {
      process.stderr.write(`[RAPID] Lock "${lockName}" compromised: ${err.message}\n`);
      // Log but don't crash -- let the operation complete
    },
  });

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

module.exports = { acquireLock, isLocked, ensureLocksDir };
