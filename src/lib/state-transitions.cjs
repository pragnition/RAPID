'use strict';

const SET_TRANSITIONS = {
  pending:     ['discussing', 'planning'],
  discussing:  ['planning'],
  planning:    ['executing'],
  executing:   ['complete'],
  complete:    ['merged'],
  merged:      [],
};

/**
 * Validate a state transition for a set.
 * Throws descriptive error if transition is invalid.
 *
 * @param {string} currentStatus - Current set status
 * @param {string} nextStatus - Desired next status
 */
function validateTransition(currentStatus, nextStatus) {
  const allowed = SET_TRANSITIONS[currentStatus];
  if (allowed === undefined) {
    throw new Error(
      `Unknown status "${currentStatus}". Valid statuses: ${Object.keys(SET_TRANSITIONS).join(', ')}`
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

module.exports = { SET_TRANSITIONS, validateTransition };
