'use strict';

const fs = require('fs');
const path = require('path');
const { ProjectState } = require('./state-schemas.cjs');

/**
 * Read and parse STATE.json, returning the validated state object.
 * Handles backward compatibility for missing quickTasks field.
 *
 * @param {string} statePath - Absolute path to STATE.json
 * @returns {Object} Parsed and validated project state
 */
function readState(statePath) {
  const raw = fs.readFileSync(statePath, 'utf-8');
  const data = JSON.parse(raw);
  return ProjectState.parse(data);
}

/**
 * Write state object back to STATE.json.
 *
 * @param {string} statePath - Absolute path to STATE.json
 * @param {Object} state - Project state object to write
 */
function writeState(statePath, state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Get the next available quick task ID.
 * Returns max(existing IDs) + 1, or 1 if no tasks exist.
 *
 * @param {string} statePath - Absolute path to STATE.json
 * @returns {Promise<number>} Next available task ID
 */
async function getNextQuickTaskId(statePath) {
  const state = readState(statePath);
  const tasks = state.quickTasks || [];
  if (tasks.length === 0) return 1;
  const maxId = Math.max(...tasks.map(t => t.id));
  return maxId + 1;
}

/**
 * List all quick tasks from STATE.json.
 * Returns empty array if no tasks exist or quickTasks field is missing.
 *
 * @param {string} statePath - Absolute path to STATE.json
 * @returns {Promise<Array>} Array of quick task objects
 */
async function listQuickTasks(statePath) {
  const state = readState(statePath);
  return state.quickTasks || [];
}

/**
 * Add a new quick task to STATE.json.
 * Auto-increments the ID based on existing tasks.
 *
 * @param {string} statePath - Absolute path to STATE.json
 * @param {string} description - Task description
 * @param {string} [commitHash] - Optional commit hash
 * @param {string} [directory] - Optional directory path
 * @returns {Promise<Object>} The newly created task object
 */
async function addQuickTask(statePath, description, commitHash, directory) {
  const state = readState(statePath);
  const tasks = state.quickTasks || [];
  const nextId = tasks.length === 0 ? 1 : Math.max(...tasks.map(t => t.id)) + 1;

  const newTask = {
    id: nextId,
    description,
    date: new Date().toISOString().split('T')[0],
  };

  if (commitHash) newTask.commitHash = commitHash;
  if (directory) newTask.directory = directory;

  state.quickTasks = [...tasks, newTask];
  state.lastUpdatedAt = new Date().toISOString();
  writeState(statePath, state);

  return newTask;
}

/**
 * Parse CLI args for the quick add command, extracting --commit and --dir flags.
 * Remaining args are joined into the description string.
 *
 * @param {string[]} args - Raw CLI args after "quick add"
 * @returns {{ description: string, commitHash: string|null, directory: string|null }}
 */
function parseQuickAddArgs(args) {
  let commitHash = null;
  let directory = null;
  const descParts = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--commit' && i + 1 < args.length) {
      commitHash = args[++i];
    } else if (args[i] === '--dir' && i + 1 < args.length) {
      directory = args[++i];
    } else if (args[i] === '--commit' || args[i] === '--dir') {
      // Dangling flag without value -- skip it gracefully
    } else {
      descParts.push(args[i]);
    }
  }
  return { description: descParts.join(' '), commitHash, directory };
}

module.exports = {
  addQuickTask,
  listQuickTasks,
  getNextQuickTaskId,
  parseQuickAddArgs,
};
