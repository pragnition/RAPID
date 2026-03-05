'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Detect if EXPERIMENTAL_AGENT_TEAMS is enabled.
 * Checks process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1'.
 * Per user decision: detection uses runtime env var check.
 * @returns {{ available: boolean }}
 */
function detectAgentTeams() {
  return {
    available: process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1',
  };
}

/**
 * Generate metadata for a wave team.
 * Team naming convention: rapid-wave-{N}.
 * Per user decision: one team per wave.
 * @param {number} waveNum
 * @returns {{ teamName: string, waveNum: number }}
 */
function waveTeamMeta(waveNum) {
  return {
    teamName: `rapid-wave-${waveNum}`,
    waveNum,
  };
}

/**
 * Build teammate spawn configuration for a set.
 * Reuses assembleExecutorPrompt from execute.cjs for prompt generation.
 * Per user decision: each teammate gets same worktree as subagent mode.
 * @param {string} cwd - Project root
 * @param {string} setName - Set name
 * @param {string} worktreePath - Worktree path for this set
 * @param {string} plan - Implementation plan from planning phase
 * @returns {{ name: string, prompt: string, worktreePath: string }}
 */
function buildTeammateConfig(cwd, setName, worktreePath, plan) {
  const execute = require('./execute.cjs');
  const prompt = execute.assembleExecutorPrompt(cwd, setName, 'execute', plan);
  return {
    name: setName,
    prompt,
    worktreePath,
  };
}

/**
 * Read team completion tracking data from JSONL file.
 * Written by the TaskCompleted hook.
 * @param {string} cwd - Project root
 * @param {string} teamName - Team name (e.g., rapid-wave-1)
 * @returns {Array<Object>} Completion records
 */
function readCompletions(cwd, teamName) {
  const trackingFile = path.join(cwd, '.planning', 'teams', `${teamName}-completions.jsonl`);
  try {
    const content = fs.readFileSync(trackingFile, 'utf-8');
    return content.trim().split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * Clean up team tracking data after wave completion.
 * @param {string} cwd - Project root
 * @param {string} teamName - Team name (e.g., rapid-wave-1)
 */
function cleanupTeamTracking(cwd, teamName) {
  const trackingFile = path.join(cwd, '.planning', 'teams', `${teamName}-completions.jsonl`);
  try {
    fs.unlinkSync(trackingFile);
  } catch {
    // Graceful -- file may not exist
  }
}

module.exports = {
  detectAgentTeams,
  waveTeamMeta,
  buildTeammateConfig,
  readCompletions,
  cleanupTeamTracking,
};
