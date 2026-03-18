'use strict';

/**
 * hooks.cjs - Hook engine for post-task verification checks.
 *
 * Provides config loading, three built-in verification checks
 * (state, artifacts, commits), a runner that aggregates results,
 * and a convenience function for state verification.
 *
 * INVARIANTS (from CONTRACT.json):
 * - readOnlyStateAccess: never calls writeState, acquireLock, or withStateTransaction
 * - nonBlocking: runPostTaskHooks never throws, always returns a result object
 * - idempotent: same input produces same output
 */

const fs = require('fs');
const path = require('path');
const { z } = require('zod');

const { readState } = require('./state-machine.cjs');
const { verifyLight } = require('./verify.cjs');

// ---------------------------------------------------------------------------
// Zod schema for hooks config
// ---------------------------------------------------------------------------

const CheckSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
});

const HooksConfigSchema = z.object({
  version: z.number(),
  checks: z.array(CheckSchema),
});

// ---------------------------------------------------------------------------
// Default config (used when file does not exist)
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  version: 1,
  checks: [
    { id: 'state-verify', enabled: true },
    { id: 'artifact-verify', enabled: true },
    { id: 'commit-verify', enabled: true },
  ],
};

// ---------------------------------------------------------------------------
// Config loading and saving
// ---------------------------------------------------------------------------

/**
 * Load hooks config from .planning/hooks-config.json.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ version: number, checks: Array<{id: string, enabled: boolean}> }}
 */
function loadHooksConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'hooks-config.json');

  if (!fs.existsSync(configPath)) {
    return structuredClone(DEFAULT_CONFIG);
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Malformed JSON in hooks-config.json: ${err.message}`);
  }

  const result = HooksConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid hooks-config.json schema: ${issues}`);
  }

  return result.data;
}

/**
 * Save hooks config to .planning/hooks-config.json.
 *
 * @param {string} cwd - Project root directory
 * @param {object} config - Config object to write
 */
function saveHooksConfig(cwd, config) {
  const configPath = path.join(cwd, '.planning', 'hooks-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Built-in check: state-verify
// ---------------------------------------------------------------------------

/**
 * Check state consistency between STATE.json and return data.
 *
 * @param {string} cwd - Project root directory
 * @param {object} returnData - Agent return data with status, tasks_completed, tasks_total
 * @returns {Promise<{ id: string, passed: boolean, issues: Array<{type: string, message: string}> }>}
 */
async function checkStateConsistency(cwd, returnData) {
  const issues = [];

  const stateResult = await readState(cwd);

  // No STATE.json -- nothing to verify
  if (stateResult === null) {
    return { id: 'state-verify', passed: true, issues: [] };
  }

  // STATE.json is invalid/corrupt
  if (!stateResult.valid) {
    return {
      id: 'state-verify',
      passed: false,
      issues: [{ type: 'error', message: 'STATE.json is invalid or corrupt' }],
    };
  }

  // Check 1: status field present and valid
  const validStatuses = ['COMPLETE', 'CHECKPOINT', 'BLOCKED'];
  if (!returnData.status || !validStatuses.includes(returnData.status)) {
    issues.push({
      type: 'warning',
      message: `returnData.status must be one of ${validStatuses.join(', ')}, got: ${returnData.status}`,
    });
  }

  // Check 2: tasks_completed <= tasks_total
  if (typeof returnData.tasks_completed === 'number' && typeof returnData.tasks_total === 'number') {
    if (returnData.tasks_completed > returnData.tasks_total) {
      issues.push({
        type: 'warning',
        message: `tasks_completed (${returnData.tasks_completed}) exceeds tasks_total (${returnData.tasks_total})`,
      });
    }
  }

  // Check 3: COMPLETE status cross-check
  if (returnData.status === 'COMPLETE') {
    if (typeof returnData.tasks_completed === 'number' && typeof returnData.tasks_total === 'number') {
      if (returnData.tasks_completed !== returnData.tasks_total) {
        issues.push({
          type: 'warning',
          message: `Status is COMPLETE but tasks_completed (${returnData.tasks_completed}) !== tasks_total (${returnData.tasks_total})`,
        });
      }
    }
  }

  return { id: 'state-verify', passed: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Built-in check: artifact-verify
// ---------------------------------------------------------------------------

/**
 * Check that declared artifacts exist on disk.
 *
 * @param {string} cwd - Project root directory
 * @param {object} returnData - Agent return data with artifacts array
 * @returns {{ id: string, passed: boolean, issues: Array<{type: string, message: string}> }}
 */
function checkArtifacts(cwd, returnData) {
  if (!Array.isArray(returnData.artifacts) || returnData.artifacts.length === 0) {
    return { id: 'artifact-verify', passed: true, issues: [] };
  }

  const resolvedPaths = returnData.artifacts.map(a => path.resolve(cwd, a));
  const results = verifyLight(resolvedPaths, []);

  const issues = results.failed.map(f => ({
    type: 'warning',
    message: `Artifact not found: ${f.target}`,
  }));

  return { id: 'artifact-verify', passed: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Built-in check: commit-verify
// ---------------------------------------------------------------------------

/**
 * Check that declared commits exist in git log.
 *
 * @param {string} cwd - Project root directory
 * @param {object} returnData - Agent return data with commits array
 * @returns {{ id: string, passed: boolean, issues: Array<{type: string, message: string}> }}
 */
function checkCommits(cwd, returnData) {
  if (!Array.isArray(returnData.commits) || returnData.commits.length === 0) {
    return { id: 'commit-verify', passed: true, issues: [] };
  }

  const results = verifyLight([], returnData.commits);

  const issues = results.failed.map(f => ({
    type: 'warning',
    message: `Commit not found in git log: ${f.target}`,
  }));

  return { id: 'commit-verify', passed: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Runner: runPostTaskHooks
// ---------------------------------------------------------------------------

/**
 * Run all enabled post-task verification hooks and aggregate results.
 * Never throws -- always returns a result object (non-blocking invariant).
 *
 * @param {string} cwd - Project root directory
 * @param {object} returnData - Agent return data
 * @returns {Promise<{ passed: boolean, issues: Array<{check: string, type: string, message: string}>, remediation?: string }>}
 */
async function runPostTaskHooks(cwd, returnData) {
  const allIssues = [];

  try {
    const config = loadHooksConfig(cwd);

    const checkMap = {
      'state-verify': checkStateConsistency,
      'artifact-verify': checkArtifacts,
      'commit-verify': checkCommits,
    };

    for (const check of config.checks) {
      if (!check.enabled) continue;

      const checkFn = checkMap[check.id];
      if (!checkFn) continue;

      try {
        const result = await checkFn(cwd, returnData);
        for (const issue of result.issues) {
          allIssues.push({ check: result.id, type: issue.type, message: issue.message });
        }
      } catch (err) {
        allIssues.push({ check: check.id, type: 'error', message: `Check threw: ${err.message}` });
      }
    }
  } catch (err) {
    allIssues.push({ check: 'hooks-runner', type: 'error', message: `Check threw: ${err.message}` });
  }

  const passed = allIssues.length === 0;
  const result = { passed, issues: allIssues };

  if (!passed) {
    result.remediation = allIssues.map(i => `- [${i.check}] ${i.message}`).join('\n');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Convenience: verifyStateUpdated
// ---------------------------------------------------------------------------

/**
 * Verify state consistency -- CONTRACT.json stateVerificationHook export.
 *
 * @param {string} cwd - Project root directory
 * @param {object} returnData - Agent return data
 * @returns {Promise<{ stateConsistent: boolean, missingTransitions: string[] }>}
 */
async function verifyStateUpdated(cwd, returnData) {
  const result = await checkStateConsistency(cwd, returnData);
  return {
    stateConsistent: result.passed,
    missingTransitions: result.issues.map(i => i.message),
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadHooksConfig,
  saveHooksConfig,
  checkStateConsistency,
  checkArtifacts,
  checkCommits,
  runPostTaskHooks,
  verifyStateUpdated,
};
