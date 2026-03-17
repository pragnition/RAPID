'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_TASKS_FILE = 'quick-tasks.jsonl';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return the absolute path to .planning/memory/quick-tasks.jsonl.
 * @param {string} cwd - Project root directory
 * @returns {string}
 */
function getQuickTasksPath(cwd) {
  return path.join(cwd, '.planning', 'memory', QUICK_TASKS_FILE);
}

/**
 * Read and parse the quick-tasks.jsonl file, skipping malformed lines.
 * @param {string} cwd - Project root directory
 * @returns {object[]}
 */
function readQuickTasksFile(cwd) {
  const filePath = getQuickTasksPath(cwd);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim() !== '');
  const results = [];

  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch (_e) {
      // Skip malformed lines silently
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append a quick task record to .planning/memory/quick-tasks.jsonl.
 *
 * @param {string} cwd - Project root directory
 * @param {object} entry - Quick task entry with required fields
 * @param {string} entry.description - Task description
 * @param {string} entry.outcome - One of "COMPLETE", "CHECKPOINT", "BLOCKED"
 * @param {string} entry.slug - Task slug identifier
 * @param {string} entry.branch - Git branch name
 * @returns {object} The created record with generated id and timestamp
 */
function appendQuickTask(cwd, entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('appendQuickTask: entry must be an object');
  }
  if (!entry.description || typeof entry.description !== 'string') {
    throw new Error('appendQuickTask: description is required and must be a non-empty string');
  }
  if (!entry.outcome || typeof entry.outcome !== 'string') {
    throw new Error('appendQuickTask: outcome is required and must be a non-empty string');
  }
  if (!entry.slug || typeof entry.slug !== 'string') {
    throw new Error('appendQuickTask: slug is required and must be a non-empty string');
  }
  if (!entry.branch || typeof entry.branch !== 'string') {
    throw new Error('appendQuickTask: branch is required and must be a non-empty string');
  }

  // Read existing entries to determine next monotonic ID
  const existing = readQuickTasksFile(cwd);
  let maxId = 0;
  for (const e of existing) {
    if (typeof e.id === 'number' && e.id > maxId) {
      maxId = e.id;
    }
  }

  const record = {
    id: maxId + 1,
    timestamp: new Date().toISOString(),
    description: entry.description,
    outcome: entry.outcome,
    slug: entry.slug,
    branch: entry.branch,
  };

  // Ensure .planning/memory/ directory exists
  const memDir = path.join(cwd, '.planning', 'memory');
  fs.mkdirSync(memDir, { recursive: true });

  fs.appendFileSync(getQuickTasksPath(cwd), JSON.stringify(record) + '\n');

  return record;
}

/**
 * Query quick task entries from the JSONL log.
 *
 * @param {string} cwd - Project root directory
 * @param {number} [limit] - If a positive integer, return only this many entries
 * @returns {object[]} Entries sorted by id descending (most recent first)
 */
function listQuickTasks(cwd, limit) {
  let entries = readQuickTasksFile(cwd);

  // Sort by id descending (most recent first)
  entries.sort((a, b) => (b.id || 0) - (a.id || 0));

  if (typeof limit === 'number' && limit > 0) {
    entries = entries.slice(0, limit);
  }

  return entries;
}

/**
 * Find a single quick task by numeric ID.
 *
 * @param {string} cwd - Project root directory
 * @param {number|string} id - Numeric task ID
 * @returns {object|null} The task entry, or null if not found
 */
function showQuickTask(cwd, id) {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  const entries = readQuickTasksFile(cwd);

  for (const entry of entries) {
    if (entry.id === numId) {
      return entry;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  appendQuickTask,
  listQuickTasks,
  showQuickTask,
};
