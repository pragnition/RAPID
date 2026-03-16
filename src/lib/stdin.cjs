'use strict';

/**
 * Stdin reading utilities with optional Zod validation.
 *
 * Covers the 7 stdin-reading sites in the monolith:
 *   - 6 synchronous (fs.readFileSync(0)) sites
 *   - 1 asynchronous (stream-based) site (add-milestone with TTY guard)
 *
 * @module stdin
 */

const fs = require('fs');
const { CliError } = require('./errors.cjs');

/**
 * Read stdin synchronously using file descriptor 0.
 *
 * @returns {string} Trimmed stdin content
 * @throws {CliError} If stdin is empty
 */
function readStdinSync() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf-8');
  } catch (err) {
    throw new CliError('No data on stdin', { data: { cause: err.message } });
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new CliError('No data on stdin');
  }
  return trimmed;
}

/**
 * Read stdin asynchronously using the stream API.
 *
 * Used by add-milestone which has a TTY guard before calling.
 *
 * @returns {Promise<string>} Trimmed stdin content
 * @throws {CliError} If stdin is empty
 */
async function readStdinAsync() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const trimmed = Buffer.concat(chunks).toString('utf-8').trim();
  if (!trimmed) {
    throw new CliError('No data on stdin');
  }
  return trimmed;
}

/**
 * Read stdin and validate against a Zod schema.
 *
 * @param {Object} zodSchema - A Zod schema with .safeParse() method
 * @param {Object} [options]
 * @param {boolean} [options.async=false] - Use async stream reading instead of sync
 * @returns {Object|Promise<Object>} Parsed and validated object
 * @throws {CliError} On empty stdin, invalid JSON, or Zod validation failure
 */
function readAndValidateStdin(zodSchema, { async = false } = {}) {
  if (async) {
    return _readAndValidateAsync(zodSchema);
  }
  return _readAndValidateSync(zodSchema);
}

/**
 * @private
 */
function _readAndValidateSync(zodSchema) {
  const raw = readStdinSync();
  return _parseAndValidate(raw, zodSchema);
}

/**
 * @private
 */
async function _readAndValidateAsync(zodSchema) {
  const raw = await readStdinAsync();
  return _parseAndValidate(raw, zodSchema);
}

/**
 * Parse JSON string and validate against Zod schema.
 * @private
 */
function _parseAndValidate(raw, zodSchema) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CliError(`Invalid JSON on stdin: ${err.message}`, {
      data: { raw: raw.slice(0, 200) },
    });
  }

  const result = zodSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      ? result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      : String(result.error);
    throw new CliError(`Stdin validation failed: ${issues}`, {
      data: { zodError: result.error },
    });
  }

  return result.data;
}

module.exports = { readStdinSync, readStdinAsync, readAndValidateStdin };
