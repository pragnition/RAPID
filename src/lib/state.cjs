'use strict';

const fs = require('fs');
const path = require('path');
const { acquireLock } = require('./lock.cjs');

const PLANNING_DIR = '.planning';

/**
 * Read a field from STATE.md (no lock needed for reads).
 *
 * If no field is specified, returns the full STATE.md content.
 * If a field is specified, extracts the value from **Field:** value pattern.
 *
 * @param {string} cwd - Project root directory
 * @param {string} [field] - Field name to extract (e.g., 'Status', 'Current Phase')
 * @returns {string|null} Full content, field value, or null if field not found
 */
function stateGet(cwd, field) {
  const statePath = path.join(cwd, PLANNING_DIR, 'STATE.md');
  const content = fs.readFileSync(statePath, 'utf-8');

  if (!field) return content;

  // Escape regex special characters in field name
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Try bold format first: **Field:** value
  const boldPattern = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.*)`, 'i');
  const boldMatch = content.match(boldPattern);
  if (boldMatch) return boldMatch[1].trim();

  // Fall back to plain format: Field: value (at start of line)
  const plainPattern = new RegExp(`^${escaped}:\\s*(.*)`, 'im');
  const plainMatch = content.match(plainPattern);
  return plainMatch ? plainMatch[1].trim() : null;
}

/**
 * Update a field in STATE.md (lock required for writes).
 *
 * Acquires a lock, reads the file, finds and replaces the field value,
 * writes the file, and releases the lock. Uses try/finally to guarantee
 * lock release even on errors.
 *
 * @param {string} cwd - Project root directory
 * @param {string} field - Field name to update
 * @param {string} value - New value to set
 * @returns {Promise<Object>} { updated: true, field, value } on success,
 *                            { updated: false, reason } on field-not-found
 */
async function stateUpdate(cwd, field, value) {
  const release = await acquireLock(cwd, 'state');
  try {
    const statePath = path.join(cwd, PLANNING_DIR, 'STATE.md');
    let content = fs.readFileSync(statePath, 'utf-8');

    // Escape regex special characters in field name
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Try bold format first: **Field:** value
    const boldPattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
    if (boldPattern.test(content)) {
      content = content.replace(boldPattern, (_, prefix) => `${prefix}${value}`);
      fs.writeFileSync(statePath, content, 'utf-8');
      return { updated: true, field, value };
    }

    // Fall back to plain format: Field: value (at start of line)
    const plainPattern = new RegExp(`^(${escaped}:\\s*)(.*)`, 'im');
    if (plainPattern.test(content)) {
      content = content.replace(plainPattern, (_, prefix) => `${prefix}${value}`);
      fs.writeFileSync(statePath, content, 'utf-8');
      return { updated: true, field, value };
    }

    return { updated: false, reason: `Field "${field}" not found` };
  } finally {
    await release();
  }
}

module.exports = { stateGet, stateUpdate };
