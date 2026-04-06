'use strict';

const { formatBreadcrumb } = require('./errors.cjs');

const SET_TRANSITIONS = {
  pending:     ['discussed', 'planned'],
  discussed:   ['planned', 'discussed'],
  planned:     ['executed'],
  executed:    ['complete', 'executed'],
  complete:    ['merged'],
  merged:      [],
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
      formatBreadcrumb(
        `Unknown status "${currentStatus}". Valid statuses: ${Object.keys(map).join(', ')}`,
        '/rapid:status'
      )
    );
  }
  if (!allowed.includes(nextStatus)) {
    if (allowed.length === 0) {
      throw new Error(
        formatBreadcrumb(
          `Invalid transition: "${currentStatus}" -> "${nextStatus}". "${currentStatus}" is a terminal state with no valid transitions`,
          '/rapid:status'
        )
      );
    }
    throw new Error(
      formatBreadcrumb(
        `Invalid transition: "${currentStatus}" -> "${nextStatus}". Valid transitions from "${currentStatus}": [${allowed.join(', ')}]`,
        '/rapid:status'
      )
    );
  }
}

module.exports = { SET_TRANSITIONS, WAVE_TRANSITIONS, JOB_TRANSITIONS, validateTransition };
