'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { acquireLock } = require('./lock.cjs');
const { ProjectState } = require('./state-schemas.cjs');
const { validateTransition } = require('./state-transitions.cjs');

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

  const release = await acquireLock(cwd, 'state-machine');
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

// ---- Status derivation ----

/**
 * Derive wave status from its jobs.
 * - All pending = 'pending'
 * - All complete = 'complete'
 * - Any failed + none executing = 'failed'
 * - Otherwise = 'executing'
 *
 * @param {Array} jobs - Array of job objects with status field
 * @returns {string} Derived status
 */
function deriveWaveStatus(jobs) {
  if (jobs.length === 0) return 'pending';

  const allPending = jobs.every(j => j.status === 'pending');
  if (allPending) return 'pending';

  const allComplete = jobs.every(j => j.status === 'complete');
  if (allComplete) return 'complete';

  const anyFailed = jobs.some(j => j.status === 'failed');
  const anyExecuting = jobs.some(j => j.status === 'executing');

  if (anyFailed && !anyExecuting) return 'failed';

  return 'executing';
}

/**
 * Derive set status from its waves.
 * Maps wave statuses to semantic categories:
 * - pending/complete are terminal
 * - everything else (discussing, planning, executing, reconciling) is "active"
 *
 * @param {Array} waves - Array of wave objects with status field
 * @returns {string} Derived status: 'pending', 'complete', or 'executing'
 */
function deriveSetStatus(waves) {
  if (waves.length === 0) return 'pending';

  const allPending = waves.every(w => w.status === 'pending');
  if (allPending) return 'pending';

  const allComplete = waves.every(w => w.status === 'complete');
  if (allComplete) return 'complete';

  // Any active wave means set is executing
  return 'executing';
}

// ---- Transition functions ----

/**
 * Transition a job to a new status. Validates the transition, updates timestamps,
 * derives wave status, and writes state atomically.
 */
async function transitionJob(cwd, milestoneId, setId, waveId, jobId, newStatus) {
  const release = await acquireLock(cwd, 'state-machine');
  try {
    const readResult = await readState(cwd);
    if (!readResult || !readResult.valid) {
      throw new Error('Cannot transition: STATE.json is missing or invalid');
    }
    const state = readResult.state;

    const job = findJob(state, milestoneId, setId, waveId, jobId);
    validateTransition('job', job.status, newStatus);

    // Update job status and timestamps
    job.status = newStatus;
    const now = new Date().toISOString();
    if (newStatus === 'executing') {
      job.startedAt = now;
    }
    if (newStatus === 'complete' || newStatus === 'failed') {
      job.completedAt = now;
    }

    // Derive wave status from jobs
    const wave = findWave(state, milestoneId, setId, waveId);
    const derivedWaveStatus = deriveWaveStatus(wave.jobs);
    // Only update wave status if it's a valid derived status for the wave schema
    // Map derived statuses to wave-valid statuses
    if (derivedWaveStatus === 'executing') {
      wave.status = 'executing';
    } else if (derivedWaveStatus === 'complete') {
      wave.status = 'complete';
    } else if (derivedWaveStatus === 'pending') {
      wave.status = 'pending';
    }
    // 'failed' is not a valid WaveStatus, so we leave wave status as-is for that case

    // Write state directly (skip lock since we already hold it)
    const validated = ProjectState.parse(state);
    validated.lastUpdatedAt = new Date().toISOString();
    const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);
    const tmpFile = stateFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, stateFile);
  } finally {
    await release();
  }
}

/**
 * Transition a wave to a new status. Validates the transition,
 * derives set status, and writes state atomically.
 */
async function transitionWave(cwd, milestoneId, setId, waveId, newStatus) {
  const release = await acquireLock(cwd, 'state-machine');
  try {
    const readResult = await readState(cwd);
    if (!readResult || !readResult.valid) {
      throw new Error('Cannot transition: STATE.json is missing or invalid');
    }
    const state = readResult.state;

    const wave = findWave(state, milestoneId, setId, waveId);
    validateTransition('wave', wave.status, newStatus);

    wave.status = newStatus;

    // Derive set status from waves
    const set = findSet(state, milestoneId, setId);
    set.status = deriveSetStatus(set.waves);

    // Write state directly (skip lock since we already hold it)
    const validated = ProjectState.parse(state);
    validated.lastUpdatedAt = new Date().toISOString();
    const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);
    const tmpFile = stateFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, stateFile);
  } finally {
    await release();
  }
}

/**
 * Transition a set to a new status. Validates the transition and writes state atomically.
 */
async function transitionSet(cwd, milestoneId, setId, newStatus) {
  const release = await acquireLock(cwd, 'state-machine');
  try {
    const readResult = await readState(cwd);
    if (!readResult || !readResult.valid) {
      throw new Error('Cannot transition: STATE.json is missing or invalid');
    }
    const state = readResult.state;

    const set = findSet(state, milestoneId, setId);
    validateTransition('set', set.status, newStatus);

    set.status = newStatus;

    // Write state directly (skip lock since we already hold it)
    const validated = ProjectState.parse(state);
    validated.lastUpdatedAt = new Date().toISOString();
    const stateFile = path.join(cwd, PLANNING_DIR, STATE_FILE);
    const tmpFile = stateFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tmpFile, stateFile);
  } finally {
    await release();
  }
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
  execSync('git checkout HEAD -- .planning/STATE.json', { cwd, stdio: 'pipe' });
}

/**
 * Commit STATE.json to git with the given message.
 *
 * @param {string} cwd - Project root directory
 * @param {string} message - Commit message
 * @returns {{ committed: boolean }}
 */
function commitState(cwd, message) {
  try {
    execSync('git add .planning/STATE.json', { cwd, stdio: 'pipe' });
    execSync(`git commit -m "${message}"`, { cwd, stdio: 'pipe' });
    return { committed: true };
  } catch (err) {
    // Exit code 1 from git commit means nothing to commit
    return { committed: false };
  }
}

module.exports = {
  createInitialState,
  readState,
  writeState,
  findMilestone,
  findSet,
  findWave,
  findJob,
  transitionJob,
  transitionWave,
  transitionSet,
  deriveWaveStatus,
  deriveSetStatus,
  detectCorruption,
  recoverFromGit,
  commitState,
};
