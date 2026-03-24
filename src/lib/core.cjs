'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DAG_SUBPATH = path.join('.planning', 'sets', 'DAG.json');

/**
 * Write a formatted message to stdout with [RAPID] prefix.
 * @param {string} msg - Message to output
 */
function output(msg) {
  process.stdout.write(`[RAPID] ${msg}\n`);
}

/**
 * Write a formatted error message to stderr with [RAPID ERROR] prefix.
 * @param {string} msg - Error message to output
 */
function error(msg) {
  process.stderr.write(`[RAPID ERROR] ${msg}\n`);
}

/**
 * Resolve the project root by querying git for the common directory.
 * Works correctly from both normal repos and git worktrees by using
 * `git rev-parse --path-format=absolute --git-common-dir` to find the
 * main repository root.
 *
 * @param {string} [cwd] - Current working directory (may be a worktree path). Defaults to process.cwd().
 * @returns {string} Resolved project root path
 */
function resolveProjectRoot(cwd) {
  cwd = cwd || process.cwd();
  try {
    const gitCommonDir = execSync(
      'git rev-parse --path-format=absolute --git-common-dir',
      { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    // gitCommonDir points to the .git directory (e.g., /path/to/project/.git)
    // Strip the trailing /.git to get the project root
    let projectRoot;
    if (gitCommonDir.endsWith(`${path.sep}.git`) || gitCommonDir.endsWith('/.git')) {
      projectRoot = gitCommonDir.slice(0, -path.sep.length - '.git'.length);
    } else if (gitCommonDir === '.git') {
      // Relative .git (shouldn't happen with --path-format=absolute, but handle it)
      projectRoot = cwd;
    } else {
      // Unexpected format -- try stripping /.git anyway
      const idx = gitCommonDir.lastIndexOf('/.git');
      if (idx !== -1) {
        projectRoot = gitCommonDir.slice(0, idx);
      } else {
        projectRoot = cwd;
      }
    }

    // Verify the resolved root contains .planning/sets/
    if (fs.existsSync(path.join(projectRoot, '.planning', 'sets'))) {
      return projectRoot;
    }

    // Fallback to cwd if .planning/sets/ not found at resolved root
    return cwd;
  } catch {
    // git rev-parse failed (not a git repo, etc.) -- fall back to cwd
    return cwd;
  }
}

/**
 * @deprecated Use resolveProjectRoot() instead.
 * Walk up the directory tree to find the project root.
 *
 * @param {string} [startDir] - Directory to start searching from (defaults to cwd)
 * @returns {string} Resolved project root path
 */
function findProjectRoot(startDir) {
  console.warn('[RAPID DEPRECATION] findProjectRoot() is deprecated, use resolveProjectRoot() from core.cjs');
  return resolveProjectRoot(startDir);
}

/**
 * Ensure DAG.json exists at the given project root.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {string} Full path to DAG.json
 * @throws {Error} If DAG.json is not found
 */
function ensureDagExists(projectRoot) {
  const fullPath = path.join(projectRoot, DAG_SUBPATH);
  if (!fs.existsSync(fullPath)) {
    throw new Error('DAG.json not found at ' + fullPath + '. Run "dag generate" or /rapid:plan-set to create it.');
  }
  return fullPath;
}

/**
 * Load RAPID configuration from config.json relative to project root.
 * Returns sensible defaults if the file does not exist.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Object} Parsed config or defaults
 */
function loadConfig(projectRoot) {
  const defaults = {
    lock_timeout_ms: 300000,
  };

  const configPath = path.join(projectRoot, 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return defaults;
    }
    throw err;
  }
}

/**
 * Resolve the path to the RAPID plugin root directory.
 * Uses __dirname relative resolution: this file lives at src/lib/core.cjs,
 * so the plugin root is two levels up.
 *
 * @returns {string} Absolute path to the RAPID plugin root directory
 */
function resolveRapidDir() {
  return path.resolve(__dirname, '..', '..');
}

module.exports = {
  output,
  error,
  resolveProjectRoot,
  findProjectRoot,
  DAG_SUBPATH,
  ensureDagExists,
  loadConfig,
  resolveRapidDir,
};
