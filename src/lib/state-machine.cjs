'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { acquireLock, isLocked } = require('./lock.cjs');
const { ProjectState } = require('./state-schemas.cjs');
const { validateTransition, WAVE_TRANSITIONS, JOB_TRANSITIONS } = require('./state-transitions.cjs');
const { assignWaves } = require('./dag.cjs');

const PLANNING_DIR = '.planning';
const STATE_FILE = 'STATE.json';

/**
 * Create an initial ProjectState for a new project.
 *
 * @param {string} projectName - Name of the project
 * @param {string} milestoneName - Name of the first milestone
 * @returns {object} A valid ProjectState object
 */
function createInitialState(projectName, milestoneName) {
  const now = new Date().toISOString();
  return {
    version: 1,
    projectName,
    currentMilestone: milestoneName,
    milestones: [{
      id: milestoneName,
      name: milestoneName,
      sets: [],
    }],
    lastUpdatedAt: now,
    createdAt: now,
  };
}

/**
 * Read STATE.json from the project directory.
 *
 * @param {string} cwd - Project root directory
 * @returns {Promise<{valid: boolean, state?: object, errors?: object} | null>}
 *   null if file missing, { valid: true, state } for valid, { valid: false, errors } for invalid
 */
async function readState(cwd) {
  const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);

  if (!fs.existsSync(stateFile)) {
    return null;
  }

  const raw = fs.readFileSync(stateFile, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { valid: false, errors: [{ message: `Invalid JSON: ${err.message}` }] };
  }

  const result = ProjectState.safeParse(parsed);
  if (result.success) {
    return { valid: true, state: result.data };
  }
  return { valid: false, errors: result.error.issues };
}

/**
 * Write state to STATE.json with lock protection and atomic rename.
 * Validates state against ProjectState schema before writing.
 *
 * @param {string} cwd - Project root directory
 * @param {object} state - State object to write
 * @throws {ZodError} If state is invalid
 */
async function writeState(cwd, state) {
  // Validate BEFORE acquiring lock -- fail fast on bad state
  const validated = ProjectState.parse(state);
  validated.lastUpdatedAt = new Date().toISOString();

  const release = await acquireLock(cwd, 'state');
  try {
    const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);
    const tmpFile = stateFile + '.tmp';

    fs.writeFileSync(tmpFile, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, stateFile);
  } finally {
    await release();
  }
}

// ---- Find helpers ----

/**
 * Find a milestone by id. Throws if not found.
 */
function findMilestone(state, milestoneId) {
  const milestone = state.milestones.find(m => m.id === milestoneId);
  if (!milestone) {
    throw new Error(`Milestone '${milestoneId}' not found in project '${state.projectName}'`);
  }
  return milestone;
}

/**
 * Find a set by id within a milestone. Throws if not found.
 */
function findSet(state, milestoneId, setId) {
  const milestone = findMilestone(state, milestoneId);
  const set = milestone.sets.find(s => s.id === setId);
  if (!set) {
    throw new Error(`Set '${setId}' not found in milestone '${milestoneId}'`);
  }
  return set;
}

/**
 * Find a wave by id within a set. Throws if not found.
 */
function findWave(state, milestoneId, setId, waveId) {
  const set = findSet(state, milestoneId, setId);
  const wave = set.waves.find(w => w.id === waveId);
  if (!wave) {
    throw new Error(`Wave '${waveId}' not found in set '${setId}'`);
  }
  return wave;
}

/**
 * Find a job by id within a wave. Throws if not found.
 */
function findJob(state, milestoneId, setId, waveId, jobId) {
  const wave = findWave(state, milestoneId, setId, waveId);
  const job = wave.jobs.find(j => j.id === jobId);
  if (!job) {
    throw new Error(`Job '${jobId}' not found in wave '${waveId}'`);
  }
  return job;
}

// ---- Transaction helper ----

/**
 * Execute a state mutation within a transaction.
 * Acquires lock once, reads state, calls mutationFn(state) to mutate in-place,
 * validates with ProjectState.parse, updates lastUpdatedAt, writes atomically
 * via tmp+rename, and releases lock. Returns validated state.
 *
 * CRITICAL: Do NOT call writeState from mutationFn -- it would deadlock.
 *
 * @param {string} cwd - Project root directory
 * @param {Function} mutationFn - Function that receives state and mutates in-place
 * @returns {Promise<object>} The validated state after mutation
 */
async function withStateTransaction(cwd, mutationFn) {
  const release = await acquireLock(cwd, 'state');
  try {
    const readResult = await readState(cwd);
    if (!readResult || !readResult.valid) {
      throw new Error('Cannot mutate: STATE.json is missing or invalid');
    }
    const state = readResult.state;

    // mutationFn receives state, mutates in-place, returns nothing
    mutationFn(state);

    // Validate + atomic write
    const validated = ProjectState.parse(state);
    validated.lastUpdatedAt = new Date().toISOString();
    const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);
    const tmpFile = stateFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, stateFile);

    return validated;
  } finally {
    await release();
  }
}

// ---- Transition function ----

/**
 * Transition a set to a new status. Validates the transition and writes state atomically.
 * Uses withStateTransaction to avoid double-lock.
 *
 * @param {string} cwd - Project root directory
 * @param {string} milestoneId - Milestone containing the set
 * @param {string} setId - Set to transition
 * @param {string} newStatus - Target status
 */
async function transitionSet(cwd, milestoneId, setId, newStatus) {
  return withStateTransaction(cwd, (state) => {
    const set = findSet(state, milestoneId, setId);
    validateTransition(set.status, newStatus);
    set.status = newStatus;
  });
}

/**
 * Transition a wave to a new status. Validates the transition and writes state atomically.
 * Uses withStateTransaction to avoid double-lock.
 *
 * @param {string} cwd - Project root directory
 * @param {string} milestoneId - Milestone containing the set
 * @param {string} setId - Set containing the wave
 * @param {string} waveId - Wave to transition
 * @param {string} newStatus - Target status
 */
async function transitionWave(cwd, milestoneId, setId, waveId, newStatus) {
  return withStateTransaction(cwd, (state) => {
    const wave = findWave(state, milestoneId, setId, waveId);
    validateTransition(wave.status, newStatus, WAVE_TRANSITIONS);
    wave.status = newStatus;
  });
}

/**
 * Transition a job to a new status. Validates the transition and writes state atomically.
 * Uses withStateTransaction to avoid double-lock.
 *
 * @param {string} cwd - Project root directory
 * @param {string} milestoneId - Milestone containing the set
 * @param {string} setId - Set containing the wave
 * @param {string} waveId - Wave containing the job
 * @param {string} jobId - Job to transition
 * @param {string} newStatus - Target status
 */
async function transitionJob(cwd, milestoneId, setId, waveId, jobId, newStatus) {
  return withStateTransaction(cwd, (state) => {
    const job = findJob(state, milestoneId, setId, waveId, jobId);
    validateTransition(job.status, newStatus, JOB_TRANSITIONS);
    job.status = newStatus;
  });
}

/**
 * Groups waves into parallelizable batches using DAG BFS level analysis.
 * Waves with no inter-wave dependencies are grouped together.
 * If no edges are provided, all waves are considered independent (single batch).
 *
 * @param {Array<{id: string}>} waves - Wave objects with at least an id property
 * @param {Array<{from: string, to: string}>} [edges=[]] - Inter-wave dependency edges
 * @returns {Array<Array<{id: string}>>} Array of parallel batches
 */
function detectIndependentWaves(waves, edges = []) {
  if (waves.length === 0) return [];
  if (edges.length === 0) {
    // No dependencies -- all waves are independent, single batch
    return [waves];
  }

  const waveMap = assignWaves(waves, edges);

  // Group waves by their assigned wave number
  const groups = {};
  for (const wave of waves) {
    const level = waveMap[wave.id];
    if (!groups[level]) groups[level] = [];
    groups[level].push(wave);
  }

  // Return groups sorted by level number
  return Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
    .map(level => groups[level]);
}

// ---- Milestone management ----

/**
 * Add a new milestone to STATE.json.
 * Preserves all existing milestones and updates currentMilestone.
 *
 * @param {string} cwd - Project root directory
 * @param {string} milestoneId - Unique ID for the new milestone
 * @param {string} [milestoneName] - Display name (defaults to milestoneId)
 * @param {Array} [carryForwardSets=[]] - Sets to copy into the new milestone
 * @returns {Promise<{milestoneId: string, milestoneName: string, setsCarried: number}>}
 * @throws {Error} If state cannot be read or milestone ID already exists
 */
async function addMilestone(cwd, milestoneId, milestoneName, carryForwardSets = []) {
  const result = await readState(cwd);
  if (!result || !result.valid) {
    throw new Error('Cannot read state: ' + (result?.error || result?.errors?.[0]?.message || 'unknown'));
  }

  const state = result.state;

  // Check for duplicate milestone
  if (state.milestones.some(m => m.id === milestoneId)) {
    throw new Error(`Milestone "${milestoneId}" already exists`);
  }

  const newMilestone = {
    id: milestoneId,
    name: milestoneName || milestoneId,
    sets: carryForwardSets.map(s => JSON.parse(JSON.stringify(s))), // deep copy carried sets
  };

  state.milestones.push(newMilestone);
  state.currentMilestone = milestoneId;
  await writeState(cwd, state);
  return { milestoneId, milestoneName: newMilestone.name, setsCarried: carryForwardSets.length };
}

// ---- Disk artifact validation ----

/**
 * Validate that disk artifacts match the state of a set.
 * Returns an array of { type, message } objects. NEVER modifies STATE.json.
 *
 * Checks:
 * - CONTEXT.md exists when status is planning/executing/complete/merged
 * - Wave plans directory exists when status is executing/complete/merged
 *
 * @param {string} cwd - Project root directory
 * @param {string} milestoneId - Milestone ID
 * @param {string} setId - Set ID
 * @returns {Promise<Array<{type: string, message: string}>>} Warnings/errors
 */
async function validateDiskArtifacts(cwd, milestoneId, setId) {
  const readResult = await readState(cwd);
  if (!readResult || !readResult.valid) {
    return [{ type: 'error', message: 'STATE.json missing or invalid' }];
  }

  let set;
  try {
    set = findSet(readResult.state, milestoneId, setId);
  } catch (err) {
    return [{ type: 'error', message: err.message }];
  }

  const warnings = [];

  // Check: if status says planning or later, CONTEXT.md should exist
  if (['planned', 'executed', 'complete', 'merged'].includes(set.status)) {
    const contextPath = path.join(cwd, '.planning', 'sets', setId, 'CONTEXT.md');
    if (!fs.existsSync(contextPath)) {
      warnings.push({
        type: 'warning',
        message: `Set "${setId}" is "${set.status}" but no CONTEXT.md found -- run /discuss-set or /discuss-set --skip`,
      });
    }
  }

  // Check: if status says executing or later, wave plans dir should exist
  if (['executed', 'complete', 'merged'].includes(set.status)) {
    const wavesDir = path.join(cwd, '.planning', 'waves', setId);
    if (!fs.existsSync(wavesDir)) {
      warnings.push({
        type: 'warning',
        message: `Set "${setId}" is "${set.status}" but no wave plans found -- run /plan-set`,
      });
    }
  }

  return warnings;
}

// ---- Corruption detection and recovery ----

/**
 * Detect corruption in STATE.json.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ exists: boolean, corrupt?: boolean, reason?: string, errors?: Array }}
 */
function detectCorruption(cwd) {
  const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);

  if (!fs.existsSync(stateFile)) {
    return { exists: false };
  }

  const raw = fs.readFileSync(stateFile, 'utf-8');

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { exists: true, corrupt: true, reason: `Invalid JSON: ${err.message}` };
  }

  const result = ProjectState.safeParse(parsed);
  if (result.success) {
    return { exists: true, corrupt: false };
  }

  return { exists: true, corrupt: true, errors: result.error.issues };
}

/**
 * Recover STATE.json from the last git commit.
 *
 * @param {string} cwd - Project root directory
 */
function recoverFromGit(cwd) {
  try {
    execFileSync('git', ['checkout', 'HEAD', '--', '.planning/STATE.json'], { cwd, stdio: 'pipe' });
  } catch (err) {
    throw new Error(`Failed to recover STATE.json from git: ${err.message}`);
  }
}

/**
 * Commit STATE.json to git with the given message.
 *
 * @param {string} cwd - Project root directory
 * @param {string} message - Commit message
 * @returns {{ committed: boolean }}
 */
function commitState(cwd, message) {
  // git add must succeed -- any failure is a real error
  execFileSync('git', ['add', '.planning/STATE.json'], { cwd, stdio: 'pipe' });

  try {
    execFileSync('git', ['commit', '-m', message], { cwd, stdio: 'pipe' });
    return { committed: true };
  } catch (err) {
    // Exit code 1 from git commit means nothing to commit (clean tree)
    if (err.status === 1) {
      return { committed: false };
    }
    // Any other exit code is a real failure -- propagate it
    return { committed: false, error: err.message };
  }
}

module.exports = {
  createInitialState,
  readState,
  writeState,
  withStateTransaction,
  findMilestone,
  findSet,
  findWave,
  findJob,
  transitionSet,
  transitionWave,
  transitionJob,
  detectIndependentWaves,
  addMilestone,
  validateDiskArtifacts,
  detectCorruption,
  recoverFromGit,
  commitState,
};
