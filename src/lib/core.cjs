'use strict';

const fs = require('fs');
const path = require('path');

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
 * Walk up the directory tree to find the project root.
 * The project root is identified by the presence of a `.planning/` directory.
 *
 * @param {string} [startDir] - Directory to start searching from (defaults to cwd)
 * @returns {string} Absolute path to the project root
 * @throws {Error} If no .planning/ directory is found
 */
function findProjectRoot(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  const root = path.parse(dir).root;

  while (true) {
    const planningDir = path.join(dir, '.planning');
    if (fs.existsSync(planningDir) && fs.statSync(planningDir).isDirectory()) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir || dir === root) {
      throw new Error(
        `Project root not found: no .planning/ directory in ${startDir || process.cwd()} or any parent directory`
      );
    }
    dir = parent;
  }
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
    agents: {},
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
  findProjectRoot,
  loadConfig,
  resolveRapidDir,
};
