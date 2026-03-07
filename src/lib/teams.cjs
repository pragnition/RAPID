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

/**
 * Build teammate spawn configuration for a single job within a wave.
 *
 * Constructs an inline prompt for job-level execution (not via
 * assembleExecutorPrompt which is set-level).
 *
 * @param {string} cwd - Project root (unused currently, reserved for future context loading)
 * @param {string} setId - Set identifier
 * @param {string} waveId - Wave identifier
 * @param {string} jobId - Job identifier
 * @param {string} worktreePath - Worktree path for this job
 * @param {string} jobPlanContent - Full content of the JOB-PLAN.md
 * @returns {{ name: string, prompt: string, worktreePath: string }}
 */
function buildJobTeammateConfig(cwd, setId, waveId, jobId, worktreePath, jobPlanContent) {
  // Parse file ownership from job plan content
  const ownedFiles = [];
  const lines = jobPlanContent.split('\n');
  let inFilesSection = false;
  let headerPassed = false;

  for (const line of lines) {
    if (line.startsWith('## Files to Create/Modify')) {
      inFilesSection = true;
      continue;
    }
    if (inFilesSection && line.startsWith('## ')) break;
    if (!inFilesSection) continue;

    const trimmed = line.trim();
    if (trimmed.startsWith('| File') || trimmed.startsWith('|---')) {
      headerPassed = true;
      continue;
    }
    if (headerPassed && trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length >= 1) {
        ownedFiles.push(cells[0]);
      }
    }
  }

  const fileList = ownedFiles.length > 0
    ? ownedFiles.map(f => `- ${f}`).join('\n')
    : '(see JOB-PLAN above)';

  const prompt = [
    `# Job: ${jobId} -- Execution`,
    '',
    `You are implementing job '${jobId}' in set '${setId}'.`,
    '',
    '## Your JOB-PLAN',
    '',
    jobPlanContent,
    '',
    '## File Ownership',
    'You may ONLY modify these files:',
    fileList,
    '',
    '## Commit Convention',
    `After each implementation step, commit with:`,
    `  git add <specific files>`,
    `  git commit -m "type(${setId}): description"`,
    'Where type is feat|fix|refactor|test|docs|chore',
    '',
    '## Working Directory',
    worktreePath,
    '',
    '## Completion',
    'When all steps complete, emit RAPID:RETURN with status COMPLETE.',
    'If context window limit reached, emit CHECKPOINT.',
    'If blocked, emit BLOCKED.',
  ].join('\n');

  return {
    name: `${setId}-${jobId}`,
    prompt,
    worktreePath,
  };
}

/**
 * Generate metadata for a job-level wave team.
 *
 * Team naming convention: rapid-{setId}-{waveId}.
 * One team per wave within a set.
 *
 * @param {string} setId - Set identifier
 * @param {string} waveId - Wave identifier
 * @returns {{ teamName: string, setId: string, waveId: string }}
 */
function waveJobTeamMeta(setId, waveId) {
  return {
    teamName: `rapid-${setId}-${waveId}`,
    setId,
    waveId,
  };
}

module.exports = {
  detectAgentTeams,
  waveTeamMeta,
  buildTeammateConfig,
  readCompletions,
  cleanupTeamTracking,
  buildJobTeammateConfig,
  waveJobTeamMeta,
};
