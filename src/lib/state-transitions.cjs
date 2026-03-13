'use strict';

const SET_TRANSITIONS = {
  pending:    ['discussed', 'planned'],
  discussed:  ['planned'],
  planned:    ['executed'],
  executed:   ['complete'],
  complete:   ['merged'],
  merged:     [],
};

const WAVE_TRANSITIONS = {
  pending:   ['executing'],
  executing: ['complete'],
  complete:  [],
};

const JOB_TRANSITIONS = {
  pending:   ['executing'],
  executing: ['complete'],
  complete:  [],
};

/**
 * Validate a state transition.
 * Throws descriptive error if transition is invalid.
 *
 * @param {string} currentStatus - Current status
 * @param {string} nextStatus - Desired next status
 * @param {Object} [transitionMap] - Optional transition map (defaults to SET_TRANSITIONS)
 */
function validateTransition(currentStatus, nextStatus, transitionMap) {
  const map = transitionMap || SET_TRANSITIONS;
  const allowed = map[currentStatus];
  if (allowed === undefined) {
    throw new Error(
      `Unknown status "${currentStatus}". Valid statuses: ${Object.keys(map).join(', ')}`
    );
  }
  if (!allowed.includes(nextStatus)) {
    if (allowed.length === 0) {
      throw new Error(
        `Invalid transition: "${currentStatus}" -> "${nextStatus}". ` +
        `"${currentStatus}" is a terminal state with no valid transitions.`
      );
    }
    throw new Error(
      `Invalid transition: "${currentStatus}" -> "${nextStatus}". ` +
      `Valid transitions from "${currentStatus}": [${allowed.join(', ')}]`
    );
  }
}

module.exports = { SET_TRANSITIONS, WAVE_TRANSITIONS, JOB_TRANSITIONS, validateTransition };
