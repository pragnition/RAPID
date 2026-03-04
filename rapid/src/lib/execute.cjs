'use strict';

/**
 * execute.cjs - Execution engine library for RAPID set execution.
 *
 * Provides context preparation, prompt assembly, and post-execution
 * verification for subagent set execution. The orchestrator uses these
 * functions to prepare lean execution contexts, build phase-specific
 * prompts, and verify execution results.
 *
 * Depends on:
 *   - worktree.cjs: generateScopedClaudeMd, loadRegistry, gitExec
 *   - plan.cjs: loadSet, listSets
 *   - verify.cjs: verifyLight
 *   - contract.cjs: checkOwnership
 */

const fs = require('fs');
const path = require('path');
const worktree = require('./worktree.cjs');
const plan = require('./plan.cjs');
const verify = require('./verify.cjs');
const contract = require('./contract.cjs');

const VALID_PHASES = ['discuss', 'plan', 'execute'];

/**
 * Prepare execution context for a named set.
 *
 * Gathers scoped CLAUDE.md, definition content, and stringified contract
 * into a lean context object for prompt assembly.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set to prepare context for
 * @returns {{ scopedMd: string, definition: string, contractStr: string, setName: string }}
 * @throws {Error} If the set does not exist
 */
function prepareSetContext(cwd, setName) {
  const scopedMd = worktree.generateScopedClaudeMd(cwd, setName);
  const setData = plan.loadSet(cwd, setName);

  return {
    scopedMd,
    definition: setData.definition,
    contractStr: JSON.stringify(setData.contract, null, 2),
    setName,
  };
}

/**
 * Assemble a prompt string for a subagent executing a specific lifecycle phase.
 *
 * Supports three phases:
 * - 'discuss': Surface implementation questions from contract and definition
 * - 'plan': Create step-by-step implementation plan from contract, definition, and prior discussion
 * - 'execute': Full execution with scoped CLAUDE.md, plan, and commit convention
 *
 * Performs cross-set bleed detection after assembly (informational warning, not error).
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @param {string} phase - Lifecycle phase: 'discuss' | 'plan' | 'execute'
 * @param {string} [priorContext] - Output from previous phase (optional)
 * @returns {string} Assembled prompt string
 * @throws {Error} If phase is not valid
 */
function assembleExecutorPrompt(cwd, setName, phase, priorContext) {
  if (!VALID_PHASES.includes(phase)) {
    throw new Error(`Invalid phase: "${phase}". Must be one of: ${VALID_PHASES.join(', ')}`);
  }

  const ctx = prepareSetContext(cwd, setName);
  let prompt = '';

  switch (phase) {
    case 'discuss':
      prompt = [
        `# Set: ${setName} -- Discussion Phase`,
        '',
        `You are reviewing the '${setName}' set before implementation begins. Your job is to surface any questions or ambiguities about the implementation approach.`,
        '',
        '## Contract',
        '',
        '```json',
        ctx.contractStr,
        '```',
        '',
        '## Definition',
        '',
        ctx.definition,
        '',
        '## Instructions',
        'Review the contract and definition above. Ask the developer clarifying questions about:',
        '- Implementation approach and technology choices',
        '- Edge cases or error handling not covered in the contract',
        '- Integration points with other sets that need clarification',
        '',
        'If everything is clear, state that you have no questions and summarize the implementation approach you would take.',
      ].join('\n');
      break;

    case 'plan':
      prompt = [
        `# Set: ${setName} -- Planning Phase`,
        '',
        `You are creating an implementation plan for the '${setName}' set.`,
        '',
        '## Contract',
        '',
        ctx.contractStr,
        '',
        '## Definition',
        '',
        ctx.definition,
        '',
        '## Discussion Decisions',
        '',
        priorContext || 'No prior discussion -- proceed with contract and definition as given.',
        '',
        '## Instructions',
        'Create a step-by-step implementation plan. For each step:',
        '1. What files to create or modify',
        '2. What to implement',
        '3. How to verify it works',
        '4. What to commit (one commit per logical task)',
        '',
        'Organize steps so each commit leaves the codebase in a working state.',
      ].join('\n');
      break;

    case 'execute':
      prompt = [
        `# Set: ${setName} -- Execution Phase`,
        '',
        ctx.scopedMd,
        '',
        '## Implementation Plan',
        '',
        priorContext || 'No plan provided -- implement according to the contract and definition.',
        '',
        '## Commit Convention',
        `After each task, commit with: type(${setName}): description`,
        'Where type is feat|fix|refactor|test|docs|chore',
        '',
        'Use `git add <specific files>` -- NEVER `git add .` or `git add -A`.',
        'Each commit must leave the codebase in a working state.',
      ].join('\n');
      break;
  }

  // Cross-set bleed check (informational only)
  try {
    const allSets = plan.listSets(cwd);
    for (const otherSet of allSets) {
      if (otherSet === setName) continue;
      if (prompt.includes(`.planning/sets/${otherSet}/DEFINITION.md`) ||
          prompt.includes(`.planning/sets/${otherSet}/CONTRACT.json`)) {
        // Log warning but don't throw -- informational only
        const core = require('./core.cjs');
        core.output(`[WARN] Cross-set bleed detected: prompt for ${setName} references ${otherSet} artifacts`);
      }
    }
  } catch {
    // Graceful -- skip bleed check if listSets fails
  }

  return prompt;
}

/**
 * Get files changed on the set's branch compared to base.
 *
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch name (e.g., 'main')
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles(worktreePath, baseBranch) {
  const result = worktree.gitExec(['diff', '--name-only', `${baseBranch}...HEAD`], worktreePath);
  if (!result.ok) return [];
  return result.stdout.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Get the number of commits on the set's branch compared to base.
 *
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch name (e.g., 'main')
 * @returns {number} Number of commits
 */
function getCommitCount(worktreePath, baseBranch) {
  const result = worktree.gitExec(['rev-list', '--count', `${baseBranch}..HEAD`], worktreePath);
  if (!result.ok) return 0;
  return parseInt(result.stdout, 10) || 0;
}

/**
 * Get commit message subject lines on the set's branch compared to base.
 *
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch name (e.g., 'main')
 * @returns {string[]} Array of commit message subject lines
 */
function getCommitMessages(worktreePath, baseBranch) {
  const result = worktree.gitExec(['log', '--format=%s', `${baseBranch}..HEAD`], worktreePath);
  if (!result.ok) return [];
  return result.stdout.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Verify post-execution results for a set.
 *
 * Checks:
 * 1. Artifact existence (via verifyLight)
 * 2. Commit count matches tasks_total
 * 3. Commit message format: type(setName): description
 * 4. File ownership compliance (no cross-set bleed)
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @param {Object} returnData - Structured return from the agent
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch for comparison
 * @returns {{ passed: Array<{type: string, target: string}>, failed: Array<{type: string, target: string}> }}
 */
function verifySetExecution(cwd, setName, returnData, worktreePath, baseBranch) {
  const results = { passed: [], failed: [] };

  // 1. Artifact existence check
  const artifactResults = verify.verifyLight(
    returnData.artifacts || [],
    returnData.commits || []
  );
  results.passed.push(...artifactResults.passed);
  results.failed.push(...artifactResults.failed);

  // 2. Commit count check
  const actualCount = getCommitCount(worktreePath, baseBranch);
  const expectedCount = returnData.tasks_total || 0;
  if (actualCount === expectedCount) {
    results.passed.push({ type: 'commit_count_match', target: `${actualCount} commits` });
  } else {
    results.failed.push({
      type: 'commit_count_mismatch',
      target: `expected ${expectedCount}, actual ${actualCount}`,
    });
  }

  // 3. Commit message format check
  const messages = getCommitMessages(worktreePath, baseBranch);
  const formatPattern = new RegExp(`^(feat|fix|refactor|test|docs|chore)\\(${escapeRegExp(setName)}\\):`);
  for (const msg of messages) {
    if (formatPattern.test(msg)) {
      results.passed.push({ type: 'commit_format_valid', target: msg });
    } else {
      results.failed.push({ type: 'commit_format_violation', target: msg });
    }
  }

  // 4. Ownership check
  try {
    const ownershipPath = path.join(cwd, '.planning', 'sets', 'OWNERSHIP.json');
    const ownershipData = JSON.parse(fs.readFileSync(ownershipPath, 'utf-8'));
    const changedFiles = getChangedFiles(worktreePath, baseBranch);

    for (const file of changedFiles) {
      const owner = contract.checkOwnership(ownershipData.ownership, file);
      if (owner === setName) {
        results.passed.push({ type: 'ownership_valid', target: file });
      } else if (owner !== null && owner !== setName) {
        results.failed.push({
          type: 'ownership_violation',
          target: `${file} (owned by ${owner}, modified by ${setName})`,
        });
      }
      // owner === null means unowned file, not a violation
    }
  } catch {
    // Graceful -- skip ownership check if OWNERSHIP.json not available
  }

  return results;
}

/**
 * Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  prepareSetContext,
  assembleExecutorPrompt,
  verifySetExecution,
  getChangedFiles,
  getCommitCount,
  getCommitMessages,
};
