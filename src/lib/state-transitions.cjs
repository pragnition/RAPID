'use strict';

const SET_TRANSITIONS = {
  pending: ['planning'],
  planning: ['executing'],
  executing: ['reviewing'],
  reviewing: ['merging'],
  merging: ['complete'],
  complete: [],
};

const WAVE_TRANSITIONS = {
  pending: ['discussing'],
  discussing: ['planning'],
  planning: ['executing'],
  executing: ['reconciling'],
  reconciling: ['complete'],
  complete: [],
};

const JOB_TRANSITIONS = {
  pending: ['executing'],
  executing: ['complete', 'failed'],
  complete: [],
  failed: ['executing'],
};

const ENTITY_MAPS = {
  set: SET_TRANSITIONS,
  wave: WAVE_TRANSITIONS,
  job: JOB_TRANSITIONS,
};

/**
 * Validate a state transition for the given entity type.
 * Throws descriptive error if transition is invalid.
 *
 * @param {string} entityType - 'set', 'wave', or 'job'
 * @param {string} currentStatus - Current status value
 * @param {string} nextStatus - Desired next status
 */
function validateTransition(entityType, currentStatus, nextStatus) {
  const map = ENTITY_MAPS[entityType];
  if (!map) {
    throw new Error(`Unknown entity type: "${entityType}". Valid types: ${Object.keys(ENTITY_MAPS).join(', ')}`);
  }

  const allowed = map[currentStatus];
  if (allowed === undefined) {
    throw new Error(`Unknown status "${currentStatus}" for ${entityType}. Valid statuses: ${Object.keys(map).join(', ')}`);
  }

  if (!allowed.includes(nextStatus)) {
    if (allowed.length === 0) {
      throw new Error(
        `Invalid ${entityType} transition: "${currentStatus}" -> "${nextStatus}". ` +
        `"${currentStatus}" is a terminal state with no valid transitions.`
      );
    }
    throw new Error(
      `Invalid ${entityType} transition: "${currentStatus}" -> "${nextStatus}". ` +
      `Valid transitions from "${currentStatus}": [${allowed.join(', ')}]`
    );
  }
}

module.exports = {
  SET_TRANSITIONS,
  WAVE_TRANSITIONS,
  JOB_TRANSITIONS,
  validateTransition,
};
