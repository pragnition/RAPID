'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
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

// ---- Status ordinals for progression checks ----

const WAVE_STATUS_ORDER = {
  pending: 0, discussing: 1, planning: 2, executing: 3,
  reconciling: 4, complete: 5, failed: 3, // failed is at executing level
};

const SET_STATUS_ORDER = {
  pending: 0, planning: 1, executing: 2, reviewing: 3,
  merging: 4, complete: 5,
};

/**
 * Check if applying a derived status would be a valid forward progression
 * (or lateral move to 'failed'). Prevents derived status from regressing
 * a parent entity to an earlier state (e.g., 'reviewing' -> 'executing').
 *
 * @param {object} orderMap - Status ordinal map
 * @param {string} currentStatus - Current status
 * @param {string} derivedStatus - Derived status to apply
 * @returns {boolean} Whether the derived status should be applied
 */
function isDerivedStatusValid(orderMap, currentStatus, derivedStatus) {
  if (derivedStatus === currentStatus) return false; // no change needed
  const currentOrd = orderMap[currentStatus];
  const derivedOrd = orderMap[derivedStatus];
  if (currentOrd === undefined || derivedOrd === undefined) return false;
  // Allow forward progression or lateral moves (e.g., executing -> failed)
  return derivedOrd >= currentOrd;
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
    // Only update wave status if it represents forward progression
    // (prevents derived status from regressing e.g. 'reconciling' -> 'executing')
    if (isDerivedStatusValid(WAVE_STATUS_ORDER, wave.status, derivedWaveStatus)) {
      wave.status = derivedWaveStatus;
    }

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
    const derivedSetStatus = deriveSetStatus(set.waves);
    // Only update set status if it represents forward progression
    // (prevents derived status from regressing e.g. 'reviewing' -> 'executing')
    if (isDerivedStatusValid(SET_STATUS_ORDER, set.status, derivedSetStatus)) {
      set.status = derivedSetStatus;
    }

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
  findMilestone,
  findSet,
  findWave,
  findJob,
  transitionJob,
  transitionWave,
  transitionSet,
  addMilestone,
  deriveWaveStatus,
  deriveSetStatus,
  detectCorruption,
  recoverFromGit,
  commitState,
};
