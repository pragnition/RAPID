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

/**
 * Format an error message with breadcrumb recovery hint.
 * Follows the compact inline format: {context}. Run: {recovery}
 *
 * ANSI coloring is NOT applied here -- it is added at output time
 * by exitWithError() so that formatBreadcrumb() returns plain text
 * suitable for CliError messages, Error objects, and JSON payloads.
 *
 * @param {string} context - What went wrong
 * @param {string} [recovery] - Recovery command suggestion
 * @returns {string} Formatted error message (without ANSI)
 */
function formatBreadcrumb(context, recovery) {
  if (recovery) {
    return `${context}. Run: ${recovery}`;
  }
  return context;
}

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
 * Uses red ANSI on the [ERROR] label; respects NO_COLOR env var.
 *
 * @param {string} msg - Error message
 * @param {number} [code=1] - Process exit code
 * @returns {never}
 */
function exitWithError(msg, code = 1) {
  process.stdout.write(JSON.stringify({ error: msg }) + '\n');
  const noColor = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
  const label = noColor ? '[ERROR]' : '\x1b[31m[ERROR]\x1b[0m';
  process.stderr.write(`${label} ${msg}\n`);
  process.exit(code);
}

module.exports = { CliError, exitWithError, formatBreadcrumb };
