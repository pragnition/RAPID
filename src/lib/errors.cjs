'use strict';

/**
 * Standardized error output utilities for RAPID CLI commands.
 *
 * Unifies the two error patterns found in the monolith:
 *   1. error(msg) + process.exit(1)          -- human-readable stderr
 *   2. JSON.stringify({ error }) + process.exit(1)  -- machine-readable stdout
 *
 * exitWithError() does both. CliError is the throw-based mechanism
 * for Wave 3 handler migration (the router catches CliError and calls exitWithError).
 *
 * @module errors
 */

const { error } = require('./core.cjs');

/**
 * Custom error class for CLI command failures.
 *
 * Handlers throw CliError; the router catches it and calls exitWithError().
 * Defining it now allows Wave 2 extractors to import it immediately.
 *
 * @extends Error
 */
class CliError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {Object} [options]
   * @param {number} [options.code=1] - Process exit code
   * @param {Object} [options.data={}] - Arbitrary context for debugging
   */
  constructor(message, { code = 1, data = {} } = {}) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.data = data;
  }
}

/**
 * Write error to both stdout (JSON) and stderr (human), then exit.
 *
 * @param {string} msg - Error message
 * @param {number} [code=1] - Process exit code
 * @returns {never}
 */
function exitWithError(msg, code = 1) {
  process.stdout.write(JSON.stringify({ error: msg }) + '\n');
  error(msg);
  process.exit(code);
}

module.exports = { CliError, exitWithError };
