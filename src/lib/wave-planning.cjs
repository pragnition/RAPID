'use strict';

const fs = require('fs');
const path = require('path');

const PLANNING_DIR = '.planning';

/**
 * Scan all milestones and sets to find a wave by ID.
 *
 * - If found in exactly one set, returns { milestoneId, setId, waveId, wave, set, milestone }.
 * - If found in multiple sets, returns an array of matches (caller disambiguates via AskUserQuestion).
 * - If not found, throws Error with available wave IDs listed.
 *
 * @param {object} state - Parsed STATE.json (ProjectState)
 * @param {string} waveId - Wave ID to find
 * @returns {object|Array<object>} Single match or array of matches
 * @throws {Error} If wave not found
 */
function resolveWave(state, waveId) {
  const matches = [];
  const availableWaves = new Set();

  for (const milestone of (state.milestones || [])) {
    for (const set of (milestone.sets || [])) {
      for (const wave of (set.waves || [])) {
        availableWaves.add(wave.id);
        if (wave.id === waveId) {
          matches.push({
            milestoneId: milestone.id,
            setId: set.id,
            waveId: wave.id,
            wave,
            set,
            milestone,
          });
        }
      }
    }
  }

  if (matches.length === 0) {
    const available = Array.from(availableWaves);
    const listing = available.length > 0
      ? `Available waves: ${available.join(', ')}`
      : 'No waves found in state';
    throw new Error(`Wave '${waveId}' not found. ${listing}`);
  }

  if (matches.length === 1) {
    return matches[0];
  }

  // Ambiguous -- found in multiple sets
  return matches;
}

/**
 * Create the wave planning artifact directory.
 *
 * Creates `.planning/waves/{setId}/{waveId}/` recursively.
 * Idempotent -- no error if directory already exists.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set ID
 * @param {string} waveId - Wave ID
 * @returns {string} Absolute path to the wave directory
 */
function createWaveDir(cwd, setId, waveId) {
  const waveDir = path.join(cwd, PLANNING_DIR, 'waves', setId, waveId);
  fs.mkdirSync(waveDir, { recursive: true });
  return waveDir;
}

/**
 * Write WAVE-CONTEXT.md to the wave directory.
 *
 * Creates the wave directory if it does not exist.
 * contextData is an object with:
 *   { waveGoal, grayAreas, decisions, deferredIdeas, codeContext }
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set ID
 * @param {string} waveId - Wave ID
 * @param {object} contextData - Context data object
 */
function writeWaveContext(cwd, setId, waveId, contextData) {
  const waveDir = createWaveDir(cwd, setId, waveId);
  const contextFile = path.join(waveDir, 'WAVE-CONTEXT.md');

  const lines = [];

  lines.push(`# WAVE-CONTEXT: ${waveId}`);
  lines.push('');
  lines.push(`**Set:** ${setId}`);
  lines.push(`**Wave:** ${waveId}`);
  lines.push(`**Generated:** ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Wave Goal
  lines.push('## Wave Goal');
  lines.push('');
  lines.push(contextData.waveGoal || 'No goal specified.');
  lines.push('');

  // Gray Areas Discussed
  lines.push('## Gray Areas Discussed');
  lines.push('');
  if (contextData.grayAreas && contextData.grayAreas.length > 0) {
    for (const ga of contextData.grayAreas) {
      lines.push(`### ${ga.area}`);
      lines.push('');
      lines.push(`**Decision:** ${ga.decision}`);
      lines.push('');
    }
  } else {
    lines.push('No gray areas discussed.');
    lines.push('');
  }

  // Decisions
  lines.push('## Decisions');
  lines.push('');
  if (contextData.decisions && contextData.decisions.length > 0) {
    lines.push('| Topic | Choice | Rationale |');
    lines.push('|-------|--------|-----------|');
    for (const d of contextData.decisions) {
      lines.push(`| ${d.topic} | ${d.choice} | ${d.rationale || ''} |`);
    }
    lines.push('');
  } else {
    lines.push('No decisions recorded.');
    lines.push('');
  }

  // Deferred Ideas
  lines.push('## Deferred Ideas');
  lines.push('');
  if (contextData.deferredIdeas && contextData.deferredIdeas.length > 0) {
    for (const idea of contextData.deferredIdeas) {
      lines.push(`- ${idea}`);
    }
    lines.push('');
  } else {
    lines.push('None.');
    lines.push('');
  }

  // Code Context
  lines.push('## Code Context');
  lines.push('');
  lines.push(contextData.codeContext || 'No code context captured.');
  lines.push('');

  fs.writeFileSync(contextFile, lines.join('\n'), 'utf-8');
}

/**
 * Validate job plans against CONTRACT.json.
 *
 * Checks:
 * 1. Export coverage: every export function's file is in at least one job plan's filesToModify
 * 2. Cross-set import validation: every import from another set has a matching export
 *    (case-insensitive name matching per user decision about "minor differences")
 *
 * @param {object} contractJson - The set's CONTRACT.json
 * @param {Array<{jobId: string, filesToModify: string[]}>} jobPlans - Job plans with file lists
 * @param {Object<string, object>} allSetContracts - Map of setId -> CONTRACT.json for cross-set checks
 * @returns {{ violations: Array<{severity: string, detail: string}>, autoFixes: Array<{type: string, detail: string, fix: string}> }}
 */
function validateJobPlans(contractJson, jobPlans, allSetContracts) {
  const violations = [];
  const autoFixes = [];

  // 1. Check export coverage
  const exportFunctions = (contractJson.exports && contractJson.exports.functions) || [];
  const plannedFiles = new Set();
  for (const plan of jobPlans) {
    for (const file of (plan.filesToModify || [])) {
      plannedFiles.add(file);
    }
  }

  for (const fn of exportFunctions) {
    if (!plannedFiles.has(fn.file)) {
      autoFixes.push({
        type: 'missing-export-coverage',
        detail: `Export '${fn.name}' in '${fn.file}' not covered by any job plan`,
        fix: `Add ${fn.file} to the most relevant job's file list`,
      });
    }
  }

  // 2. Cross-set import validation
  const imports = contractJson.imports || {};
  if (imports.fromSets) {
    for (const imp of imports.fromSets) {
      const sourceContract = allSetContracts[imp.set];
      if (!sourceContract) {
        violations.push({
          severity: 'major',
          detail: `Imports from set '${imp.set}' but no contract found for that set`,
        });
        continue;
      }
      // Check each imported function exists in source exports (case-insensitive)
      for (const fnName of (imp.functions || [])) {
        const sourceExports = (sourceContract.exports && sourceContract.exports.functions) || [];
        const found = sourceExports.some(f =>
          f.name.toLowerCase() === fnName.toLowerCase()
        );
        if (!found) {
          violations.push({
            severity: 'major',
            detail: `Imports '${fnName}' from set '${imp.set}' but that set does not export it`,
          });
        }
      }
    }
  }

  return { violations, autoFixes };
}

module.exports = {
  resolveWave,
  createWaveDir,
  writeWaveContext,
  validateJobPlans,
};
