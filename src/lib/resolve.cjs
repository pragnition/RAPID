'use strict';

const path = require('path');

const NUMERIC_SET_PATTERN = /^\d+$/;
const NUMERIC_WAVE_PATTERN = /^\d+\.\d+$/;

/**
 * Resolve a set reference (numeric index or string ID) to full set info.
 *
 * Numeric IDs are 1-based indices into the alphabetically-sorted set list
 * from `.planning/sets/`. String IDs are matched exactly against directory names.
 *
 * @param {string} input - Numeric index (e.g., "1") or string ID (e.g., "set-01-foundation")
 * @param {string} cwd - Project root directory
 * @returns {{ resolvedId: string, numericIndex: number, wasNumeric: boolean }}
 * @throws {Error} On invalid index, out-of-range, no sets, or not found
 */
function resolveSet(input, cwd) {
  const plan = require('./plan.cjs');
  const sets = plan.listSets(cwd);

  if (sets.length === 0) {
    throw new Error('No sets found. Run /rapid:plan first to create a project plan with sets.');
  }

  if (NUMERIC_SET_PATTERN.test(input)) {
    const index = parseInt(input, 10);
    if (index <= 0) {
      throw new Error('Invalid index: must be a positive integer.');
    }
    if (index > sets.length) {
      throw new Error(
        `Set ${index} not found. Valid range: 1-${sets.length}. Use /rapid:status to see available sets.`
      );
    }
    return {
      resolvedId: sets[index - 1],
      numericIndex: index,
      wasNumeric: true,
    };
  }

  // String ID -- verify it exists and find its index
  const idx = sets.indexOf(input);
  if (idx === -1) {
    throw new Error(`Set '${input}' not found. Available sets: ${sets.join(', ')}`);
  }
  return {
    resolvedId: input,
    numericIndex: idx + 1,
    wasNumeric: false,
  };
}

/**
 * Resolve a wave reference (dot notation or string ID) to full wave info.
 *
 * Dot notation "N.M" resolves set N (1-based index) and wave M (1-based index
 * within the set's waves[] array in the current milestone's state).
 *
 * String wave IDs are delegated to wave-planning.resolveWave() for lookup,
 * then enriched with setIndex/waveIndex.
 *
 * @param {string} input - Dot notation (e.g., "1.1") or wave string ID (e.g., "wave-01")
 * @param {object} state - Parsed ProjectState object
 * @param {string} cwd - Project root directory (for set resolution via listSets)
 * @returns {{ setId: string, waveId: string, setIndex: number, waveIndex: number, wasNumeric: boolean }}
 * @throws {Error} On malformed input, out-of-range, or not found
 */
function resolveWave(input, state, cwd) {
  // Check for malformed dot notation patterns that don't match the strict regex
  // e.g., "1.", ".1", "1.0." -- these contain dots but don't match N.N
  if (input.includes('.') && !NUMERIC_WAVE_PATTERN.test(input)) {
    // Only throw malformed error if it looks like an attempted dot notation
    // (contains a dot and at least one digit-dot or dot-digit)
    if (/^\d+\.$/.test(input) || /^\.\d+$/.test(input)) {
      throw new Error('Invalid wave reference. Use N.N format (e.g., 1.1 = set 1, wave 1).');
    }
    // Otherwise fall through to string ID lookup (e.g., "1.1.1" or "some.thing")
  }

  if (NUMERIC_WAVE_PATTERN.test(input)) {
    const parts = input.split('.');
    const setIndex = parseInt(parts[0], 10);
    const waveIndex = parseInt(parts[1], 10);

    if (setIndex <= 0 || waveIndex <= 0) {
      throw new Error('Invalid index: must be a positive integer.');
    }

    // Resolve the set first (reuse resolveSet for the set index)
    const setResult = resolveSet(String(setIndex), cwd);
    const setId = setResult.resolvedId;

    // Find the set in state to get its waves
    const milestone = state.milestones.find((m) => m.id === state.currentMilestone);
    if (!milestone) {
      throw new Error(`Current milestone '${state.currentMilestone}' not found in state.`);
    }

    const setInState = milestone.sets.find((s) => s.id === setId);
    if (!setInState) {
      throw new Error(`Set '${setId}' not found in state for milestone '${state.currentMilestone}'.`);
    }

    const waves = setInState.waves || [];
    if (waveIndex > waves.length) {
      throw new Error(
        `Wave ${waveIndex} not found in set '${setId}'. Valid range: 1-${waves.length}.`
      );
    }

    return {
      setId,
      waveId: waves[waveIndex - 1].id,
      setIndex,
      waveIndex,
      wasNumeric: true,
    };
  }

  // String wave ID -- delegate to wave-planning.resolveWave for lookup
  const wavePlanning = require('./wave-planning.cjs');
  const match = wavePlanning.resolveWave(state, input);

  // wave-planning.resolveWave returns single match or array of matches
  // For the resolver, we take the first match (or single match)
  const resolved = Array.isArray(match) ? match[0] : match;

  // Compute set and wave indices
  const plan = require('./plan.cjs');
  const sets = plan.listSets(cwd);
  const setIndex = sets.indexOf(resolved.setId) + 1;

  // Find wave index within the set's waves array
  const milestone = state.milestones.find((m) => m.id === resolved.milestoneId);
  const setInState = milestone.sets.find((s) => s.id === resolved.setId);
  const waveIdx = setInState.waves.findIndex((w) => w.id === input) + 1;

  return {
    setId: resolved.setId,
    waveId: input,
    setIndex,
    waveIndex: waveIdx,
    wasNumeric: false,
  };
}

module.exports = { resolveSet, resolveWave };
