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
 *   - worktree.cjs: generateScopedClaudeMd, readRegistry, gitExec
 *   - plan.cjs: loadSet, listSets
 *   - verify.cjs: verifyLight
 *   - contract.cjs: checkOwnership
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const worktree = require('./worktree.cjs');
const plan = require('./plan.cjs');
const verify = require('./verify.cjs');
const contract = require('./contract.cjs');
const compaction = require('./compaction.cjs');

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
 * Enhanced prepareSetContext that includes quality guidelines and pattern references.
 * Extends the existing prepareSetContext output with quality context sections.
 * This is a separate function to avoid breaking existing prepareSetContext callers.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @returns {{ scopedMd: string, definition: string, contractStr: string, setName: string, qualityContext: string }}
 */
function enrichedPrepareSetContext(cwd, setName) {
  const ctx = prepareSetContext(cwd, setName);

  let qualityContext = '';
  try {
    const quality = require('./quality.cjs');
    qualityContext = quality.buildQualityContext(cwd, setName);
  } catch {
    // Graceful -- quality context is optional
  }

  return {
    ...ctx,
    qualityContext,
  };
}

/**
 * Build a compacted context string for multi-wave execution.
 * For completed waves, uses digest siblings if available.
 * For the active wave, includes full content.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @param {number} activeWave - Current wave number being executed (1-based)
 * @returns {{ contextString: string, stats: { totalTokens: number, digestsUsed: number, fullsUsed: number, budgetExceeded: boolean } }}
 */
function assembleCompactedWaveContext(cwd, setName, activeWave) {
  const setDir = path.join(cwd, '.planning', 'sets', setName);
  const artifacts = compaction.collectWaveArtifacts(setDir);
  const compacted = compaction.compactContext({
    setId: setName,
    setDir,
    activeWave,
    waves: artifacts,
  });

  const sections = [];

  for (const waveGroup of compacted.compacted) {
    const waveNum = waveGroup.wave;
    // Skip set-level (wave 0) and review (wave 999) artifacts -- they are not wave context
    if (waveNum === 0 || waveNum === 999) continue;

    let header;
    if (waveNum === activeWave) {
      header = `### Wave ${waveNum} (active)`;
    } else if (waveNum < activeWave) {
      const hasDigest = waveGroup.artifacts.some(a => a.isDigest);
      header = `### Wave ${waveNum} (completed${hasDigest ? ' - digest' : ''})`;
    } else {
      header = `### Wave ${waveNum} (future)`;
    }
    sections.push(header);

    for (const artifact of waveGroup.artifacts) {
      sections.push(`\n**${artifact.name}:**`);
      sections.push(artifact.content);
    }

    sections.push('');
  }

  // Footer
  sections.push(`---`);
  sections.push(`*Context stats: ${compacted.digestsUsed} digests used, ${compacted.fullsUsed} full reads, ${compacted.totalTokens} tokens total*`);

  return {
    contextString: sections.join('\n'),
    stats: {
      totalTokens: compacted.totalTokens,
      digestsUsed: compacted.digestsUsed,
      fullsUsed: compacted.fullsUsed,
      budgetExceeded: compacted.budgetExceeded,
    },
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
 * @param {number} [activeWave=0] - Current wave number for multi-wave compaction (0 = no compaction)
 * @returns {string} Assembled prompt string
 * @throws {Error} If phase is not valid
 */
function assembleExecutorPrompt(cwd, setName, phase, priorContext, activeWave = 0) {
  if (!VALID_PHASES.includes(phase)) {
    throw new Error(`Invalid phase: "${phase}". Must be one of: ${VALID_PHASES.join(', ')}`);
  }

  const ctx = prepareSetContext(cwd, setName);

  // Load memory context for plan and execute phases
  let memoryContext = '';
  if (phase === 'plan' || phase === 'execute') {
    try {
      const memory = require('./memory.cjs');
      memoryContext = memory.buildMemoryContext(cwd, setName);
    } catch {
      // Graceful -- skip memory if module not available or errors
    }
  }

  // Load quality context for plan and execute phases
  let qualityContext = '';
  if (phase === 'plan' || phase === 'execute') {
    try {
      const quality = require('./quality.cjs');
      qualityContext = quality.buildQualityContext(cwd, setName);
    } catch {
      // Graceful -- skip quality if module not available or errors
    }
  }

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
        ...(memoryContext ? ['', memoryContext] : []),
        ...(qualityContext ? ['', qualityContext] : []),
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

    case 'execute': {
      const parts = [
        `# Set: ${setName} -- Execution Phase`,
        '',
        ctx.scopedMd,
      ];

      // Inject compacted prior wave context for multi-wave execution (wave 2+)
      if (activeWave > 1) {
        try {
          const compactedCtx = assembleCompactedWaveContext(cwd, setName, activeWave);
          parts.push('');
          parts.push('## Prior Wave Context (Compacted)');
          parts.push('');
          parts.push(compactedCtx.contextString);
        } catch {
          // Graceful -- skip compaction if artifacts cannot be read
        }
      }

      if (memoryContext) {
        parts.push('');
        parts.push(memoryContext);
      }

      if (qualityContext) {
        parts.push('');
        parts.push(qualityContext);
      }

      parts.push('');
      parts.push('## Implementation Plan');
      parts.push('');
      parts.push(priorContext || 'No plan provided -- implement according to the contract and definition.');
      parts.push('');
      parts.push('## Commit Convention');
      parts.push(`After each task, commit with: type(${setName}): description`);
      parts.push('Where type is feat|fix|refactor|test|docs|chore');
      parts.push('');
      parts.push('Use `git add <specific files>` -- NEVER `git add .` or `git add -A`.');
      parts.push('Each commit must leave the codebase in a working state.');

      prompt = parts.join('\n');
      break;
    }
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
 * @param {string} [startCommit] - Optional commit hash to use as base instead of baseBranch (for solo mode)
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles(worktreePath, baseBranch, startCommit) {
  const ref = startCommit || baseBranch;
  const result = worktree.gitExec(['diff', '--name-only', `${ref}...HEAD`], worktreePath);
  if (!result.ok) return [];
  return result.stdout.split('\n').filter(line => line.trim().length > 0);
}

/**
 * Get the number of commits on the set's branch compared to base.
 *
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch name (e.g., 'main')
 * @param {string} [startCommit] - Optional commit hash to use as base instead of baseBranch (for solo mode)
 * @returns {number} Number of commits
 */
function getCommitCount(worktreePath, baseBranch, startCommit) {
  const ref = startCommit || baseBranch;
  const result = worktree.gitExec(['rev-list', '--count', `${ref}..HEAD`], worktreePath);
  if (!result.ok) return 0;
  return parseInt(result.stdout, 10) || 0;
}

/**
 * Get commit message subject lines on the set's branch compared to base.
 *
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch name (e.g., 'main')
 * @param {string} [startCommit] - Optional commit hash to use as base instead of baseBranch (for solo mode)
 * @returns {string[]} Array of commit message subject lines
 */
function getCommitMessages(worktreePath, baseBranch, startCommit) {
  const ref = startCommit || baseBranch;
  const result = worktree.gitExec(['log', '--format=%s', `${ref}..HEAD`], worktreePath);
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

  // Detect solo mode: use startCommit as diff base if available
  const registry = worktree.readRegistry(cwd);
  const regEntry = registry.worktrees[setName];
  const startCommit = (regEntry && regEntry.solo && regEntry.startCommit) ? regEntry.startCommit : undefined;

  // 1. Artifact existence check
  const artifactResults = verify.verifyLight(
    returnData.artifacts || [],
    returnData.commits || []
  );
  results.passed.push(...artifactResults.passed);
  results.failed.push(...artifactResults.failed);

  // 2. Commit count check
  const actualCount = getCommitCount(worktreePath, baseBranch, startCommit);
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
  const messages = getCommitMessages(worktreePath, baseBranch, startCommit);
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
    const changedFiles = getChangedFiles(worktreePath, baseBranch, startCommit);

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

// ────────────────────────────────────────────────────────────────
// Handoff generation and parsing (pause/resume support)
// ────────────────────────────────────────────────────────────────

/**
 * Generate HANDOFF.md content from CHECKPOINT return data.
 *
 * Produces a Markdown document with YAML frontmatter containing
 * set metadata and pause state, followed by Markdown sections for
 * completed work, remaining work, resume instructions, and decisions.
 *
 * @param {Object} checkpointData - Parsed CHECKPOINT return
 * @param {string} checkpointData.handoff_done - Description of completed work
 * @param {string} checkpointData.handoff_remaining - Description of remaining work
 * @param {string} checkpointData.handoff_resume - Instructions for resuming
 * @param {number} checkpointData.tasks_completed - Number of tasks completed
 * @param {number} checkpointData.tasks_total - Total number of tasks
 * @param {string[]} [checkpointData.decisions] - Decisions made during execution
 * @param {string} setName - Name of the set being paused
 * @param {number} pauseCycle - Current pause cycle count (incremented)
 * @returns {string} Markdown content for HANDOFF.md
 */
function generateHandoff(checkpointData, setName, pauseCycle) {
  const frontmatter = [
    '---',
    `set: ${setName}`,
    `paused_at: ${new Date().toISOString()}`,
    `pause_cycle: ${pauseCycle}`,
    `tasks_completed: ${checkpointData.tasks_completed || 0}`,
    `tasks_total: ${checkpointData.tasks_total || 0}`,
    '---',
  ].join('\n');

  const sections = [
    frontmatter,
    '',
    '## Completed Work',
    checkpointData.handoff_done || '(none recorded)',
    '',
    '## Remaining Work',
    checkpointData.handoff_remaining || '(none recorded)',
    '',
    '## Resume Instructions',
    checkpointData.handoff_resume || 'Continue from where execution stopped.',
  ];

  // Support both .decisions (array) and .handoff_decisions (string, per RAPID protocol)
  let decisions = checkpointData.decisions;
  if (!decisions || decisions.length === 0) {
    const hd = checkpointData.handoff_decisions;
    if (hd) {
      decisions = Array.isArray(hd) ? hd : [hd];
    }
  }

  if (decisions && decisions.length > 0) {
    sections.push('', '## Decisions Made');
    for (const d of decisions) {
      sections.push(`- ${d}`);
    }
  }

  return sections.join('\n') + '\n';
}

/**
 * Parse HANDOFF.md content into a structured object.
 *
 * Extracts YAML frontmatter fields and Markdown section content
 * from a HANDOFF.md file produced by generateHandoff().
 *
 * @param {string} handoffContent - Raw Markdown content of HANDOFF.md
 * @returns {{ set: string, pauseCycle: number, tasksCompleted: number, tasksTotal: number, completedWork: string, remainingWork: string, resumeInstructions: string, decisions: string[] } | null}
 *   Parsed handoff data, or null if content is empty/falsy
 */
function parseHandoff(handoffContent) {
  if (!handoffContent) return null;

  const content = handoffContent.trim();
  if (content.length === 0) return null;

  // Parse frontmatter between --- markers
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = {};
  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }

  // Parse sections: extract text under each ## heading
  const sections = {};
  const sectionRegex = /^## (.+)$/gm;
  let match;
  const sectionStarts = [];

  while ((match = sectionRegex.exec(content)) !== null) {
    sectionStarts.push({ name: match[1], headingStart: match.index, index: match.index + match[0].length });
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i].index;
    const end = i + 1 < sectionStarts.length
      ? sectionStarts[i + 1].headingStart
      : content.length;
    const sectionContent = content.slice(start, end).trim();
    sections[sectionStarts[i].name] = sectionContent;
  }

  // Parse decisions from "Decisions Made" section
  const decisions = [];
  if (sections['Decisions Made']) {
    const lines = sections['Decisions Made'].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        decisions.push(trimmed.slice(2));
      }
    }
  }

  return {
    set: frontmatter.set || '',
    pauseCycle: parseInt(frontmatter.pause_cycle, 10) || 0,
    tasksCompleted: parseInt(frontmatter.tasks_completed, 10) || 0,
    tasksTotal: parseInt(frontmatter.tasks_total, 10) || 0,
    completedWork: sections['Completed Work'] || '',
    remainingWork: sections['Remaining Work'] || '',
    resumeInstructions: sections['Resume Instructions'] || '',
    decisions,
  };
}

// ────────────────────────────────────────────────────────────────
// Resume deduplication
// ────────────────────────────────────────────────────────────────

/**
 * Resume a paused set by validating its pause state, parsing HANDOFF.md,
 * and optionally transitioning the registry back to Executing.
 *
 * Consolidates duplicated resume logic from handleResume() and
 * "execute resume" CLI into a single function. Both CLI entry points
 * become thin wrappers delegating to this function.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier to resume
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.infoOnly=false] - If true, skip registry update and return resumed:false
 * @returns {Promise<{ resumed: boolean, setName: string, handoff: Object, stateContext: Object|null, definitionPath: string, contractPath: string, pauseCycles: number }>}
 * @throws {Error} If setId is missing, not registered, not Paused, or HANDOFF.md is missing/unparseable
 */
async function resumeSet(cwd, setId, options = {}) {
  // 1. Validate setId exists
  if (!setId) {
    throw new Error('resumeSet requires a setId');
  }

  // 2. Load registry and validate entry
  const registry = worktree.readRegistry(cwd);
  const entry = registry.worktrees[setId];
  if (!entry) throw new Error(`No worktree registered for set "${setId}"`);
  if (entry.phase !== 'Paused') throw new Error(`Set "${setId}" is in phase "${entry.phase}", not Paused`);

  // 3. Validate HANDOFF.md exists
  const handoffPath = path.join(cwd, '.planning', 'sets', setId, 'HANDOFF.md');
  if (!fs.existsSync(handoffPath)) throw new Error(`No HANDOFF.md found for set "${setId}"`);

  // 4. Parse HANDOFF.md
  const handoffRaw = fs.readFileSync(handoffPath, 'utf-8');
  const handoff = parseHandoff(handoffRaw);
  if (!handoff) throw new Error(`Failed to parse HANDOFF.md for set "${setId}"`);

  // 5. Read STATE.json for set context
  let stateContext = null;
  try {
    const sm = require('./state-machine.cjs');
    const stateResult = await sm.readState(cwd);
    if (stateResult && stateResult.valid) {
      for (const milestone of stateResult.state.milestones) {
        const setData = (milestone.sets || []).find(s => s.id === setId);
        if (setData) {
          stateContext = { milestoneId: milestone.id, setId: setData.id, status: setData.status, waves: setData.waves || [] };
          break;
        }
      }
    }
  } catch { /* Graceful -- STATE.json may not exist */ }

  // 6. Build paths
  const definitionPath = path.join('.planning', 'sets', setId, 'DEFINITION.md');
  const contractPath = path.join('.planning', 'sets', setId, 'CONTRACT.json');

  // 7. Update registry (unless infoOnly)
  if (!options.infoOnly) {
    await worktree.withRegistryUpdate(cwd, (reg) => {
      if (reg.worktrees[setId]) {
        reg.worktrees[setId].phase = 'Executing';
        reg.worktrees[setId].updatedAt = new Date().toISOString();
      }
      return reg;
    });
  }

  // 8. Return unified result
  return {
    resumed: !options.infoOnly,
    setName: setId,
    handoff,
    stateContext,
    definitionPath,
    contractPath,
    pauseCycles: entry.pauseCycles || 0,
  };
}

// ────────────────────────────────────────────────────────────────
// Wave reconciliation engine
// ────────────────────────────────────────────────────────────────

/**
 * Parse file ownership paths from a DEFINITION.md content string.
 *
 * Looks for the "## File Ownership" section and extracts file paths
 * from bullet lines (- path/to/file).
 *
 * @param {string} definitionContent - Raw DEFINITION.md content
 * @returns {string[]} Array of owned file paths
 */
function parseOwnedFiles(definitionContent) {
  const files = [];
  const lines = definitionContent.split('\n');
  let inOwnership = false;

  for (const line of lines) {
    if (line.startsWith('## File Ownership')) {
      inOwnership = true;
      continue;
    }
    if (inOwnership && line.startsWith('## ')) {
      break; // Next section
    }
    if (inOwnership) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        const filePath = trimmed.slice(2).trim();
        // Filter out non-path descriptive text
        if (filePath && !filePath.startsWith('Files ') && filePath.includes('/')) {
          files.push(filePath);
        }
      }
    }
  }

  return files;
}

/**
 * Reconcile a wave: compare planned deliverables vs actual execution results.
 *
 * For each set in the wave, checks:
 * 1. Contract test compliance (hard block if tests fail)
 * 2. Artifact file existence (soft block if missing)
 * 3. Commit count on the set's branch
 *
 * @param {string} cwd - Project root directory
 * @param {number} waveNum - Wave number to reconcile
 * @param {Object} dagJson - DAG data with waves object
 * @param {Object} registry - Worktree registry with worktrees object
 * @returns {{ hardBlocks: Array, softBlocks: Array, setResults: Object, overall: string }}
 */
function reconcileWave(cwd, waveNum, dagJson, registry) {
  const waveSets = dagJson.waves[waveNum]?.sets || [];
  const hardBlocks = [];
  const softBlocks = [];
  const setResults = {};

  for (const setName of waveSets) {
    const entry = registry.worktrees[setName];
    if (!entry) continue;

    const worktreePath = path.resolve(cwd, entry.path);
    const setDir = path.join(cwd, '.planning', 'sets', setName);

    // Initialize set result
    setResults[setName] = {
      contractCompliance: 'PASS',
      artifactsPlanned: 0,
      artifactsDelivered: 0,
      missingArtifacts: [],
      commitCount: 0,
    };

    // 1. Run contract tests (hard block if fail)
    // Use plain `node` instead of `node --test` to avoid nested TAP stream
    // conflicts when reconcileWave is called inside a node:test runner.
    // Contract test files that use node:test describe/it will auto-run.
    const testFile = path.join(setDir, 'contract.test.cjs');
    if (fs.existsSync(testFile)) {
      try {
        execSync(`node "${testFile}"`, { cwd, stdio: 'pipe', timeout: 30000 });
        setResults[setName].contractCompliance = 'PASS';
      } catch (err) {
        hardBlocks.push({
          set: setName,
          type: 'contract_violation',
          detail: err.stderr?.toString() || err.message,
        });
        setResults[setName].contractCompliance = 'FAIL';
      }
    }

    // 2. Check artifact existence (soft block if missing)
    try {
      const defPath = path.join(setDir, 'DEFINITION.md');
      if (fs.existsSync(defPath)) {
        const defContent = fs.readFileSync(defPath, 'utf-8');
        const ownedFiles = parseOwnedFiles(defContent);
        setResults[setName].artifactsPlanned = ownedFiles.length;

        let delivered = 0;
        for (const filePath of ownedFiles) {
          const fullPath = path.join(worktreePath, filePath);
          if (fs.existsSync(fullPath)) {
            delivered++;
          } else {
            softBlocks.push({
              set: setName,
              type: 'missing_artifact',
              detail: `${filePath} not found in worktree`,
            });
            setResults[setName].missingArtifacts.push(filePath);
          }
        }
        setResults[setName].artifactsDelivered = delivered;
      }
    } catch {
      // Graceful -- skip artifact check if DEFINITION.md not parseable
    }

    // 3. Commit count
    try {
      const baseBranch = 'main';
      setResults[setName].commitCount = getCommitCount(worktreePath, baseBranch);
    } catch {
      setResults[setName].commitCount = 0;
    }
  }

  // Determine overall result
  let overall = 'PASS';
  if (hardBlocks.length > 0) {
    overall = 'FAIL';
  } else if (softBlocks.length > 0) {
    overall = 'PASS_WITH_WARNINGS';
  }

  return { hardBlocks, softBlocks, setResults, overall };
}

/**
 * Generate a formatted Markdown summary for wave reconciliation results.
 *
 * Produces content for .planning/sets/WAVE-{N}-SUMMARY.md with per-set
 * details, contract compliance, hard/soft blocks, and action items.
 *
 * @param {number} waveNum - Wave number
 * @param {Object} reconcileResult - Result from reconcileWave()
 * @param {string} timestamp - ISO timestamp of reconciliation
 * @param {string} [executionMode] - Execution mode label (e.g., 'Agent Teams' or 'Subagents'). Defaults to 'Subagents'.
 * @returns {string} Formatted Markdown string
 */
function generateWaveSummary(waveNum, reconcileResult, timestamp, executionMode) {
  const { overall, hardBlocks, softBlocks, setResults } = reconcileResult;

  const lines = [
    `# Wave ${waveNum} Reconciliation Summary`,
    '',
    `**Reconciled:** ${timestamp}`,
    `**Result:** ${overall}`,
    `**Execution Mode:** ${executionMode || 'Subagents'}`,
    '',
    '## Sets',
    '',
  ];

  // Per-set sections
  for (const [setName, result] of Object.entries(setResults)) {
    lines.push(`### ${setName}`);
    lines.push(`**Status:** ${result.contractCompliance}`);
    lines.push(`**Planned artifacts:** ${result.artifactsPlanned} | **Delivered:** ${result.artifactsDelivered}`);
    lines.push(`**Contract compliance:** ${result.contractCompliance === 'PASS' ? 'All exports verified' : 'FAILED'}`);
    lines.push(`**Commits:** ${result.commitCount}`);
    if (result.missingArtifacts.length > 0) {
      lines.push(`**Missing:** ${result.missingArtifacts.join(', ')}`);
    }
    lines.push('');
  }

  // Hard blocks
  lines.push('## Hard Blocks');
  if (hardBlocks.length === 0) {
    lines.push('None');
  } else {
    for (const block of hardBlocks) {
      lines.push(`- **${block.set}** (${block.type}): ${block.detail}`);
    }
  }
  lines.push('');

  // Soft blocks
  lines.push('## Soft Blocks');
  if (softBlocks.length === 0) {
    lines.push('None');
  } else {
    for (const block of softBlocks) {
      lines.push(`- **${block.set}** (${block.type}): ${block.detail}`);
    }
  }
  lines.push('');

  // Developer action
  lines.push('## Developer Action Required');
  if (overall === 'PASS') {
    lines.push('All contract obligations satisfied. Proceed to next wave.');
  } else if (overall === 'PASS_WITH_WARNINGS') {
    lines.push('Review soft blocks above. Approve to proceed to next wave.');
  } else {
    lines.push('Hard blocks must be resolved before proceeding to next wave.');
  }
  lines.push('');

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Job-level reconciliation
// ────────────────────────────────────────────────────────────────

/**
 * Parse the "Files to Create/Modify" table from a JOB-PLAN.md content string.
 *
 * Looks for a Markdown table under "## Files to Create/Modify" and extracts
 * rows with file path, action (Create/Modify), and purpose.
 *
 * @param {string} jobPlanContent - Raw JOB-PLAN.md content
 * @returns {Array<{ path: string, action: string, purpose: string }>}
 */
function parseJobPlanFiles(jobPlanContent) {
  const files = [];
  const lines = jobPlanContent.split('\n');
  let inFilesSection = false;
  let headerPassed = false;

  for (const line of lines) {
    if (line.startsWith('## Files to Create/Modify')) {
      inFilesSection = true;
      continue;
    }
    if (inFilesSection && line.startsWith('## ')) {
      break; // Next section
    }
    if (!inFilesSection) continue;

    const trimmed = line.trim();

    // Skip header row and separator
    if (trimmed.startsWith('| File') || trimmed.startsWith('|---')) {
      headerPassed = true;
      continue;
    }

    // Parse table rows: | path | action | purpose |
    if (headerPassed && trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length >= 2) {
        files.push({
          path: cells[0],
          action: cells[1],
          purpose: cells[2] || '',
        });
      }
    }
  }

  return files;
}

/**
 * Reconcile a single job's deliverables against its JOB-PLAN.md.
 *
 * Reads the job plan from `.planning/sets/{setId}/{waveId}/{jobId}-PLAN.md`.
 * Checks file existence in worktreePath and commit format using
 * `type(setId): description` pattern.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {string} waveId - Wave identifier
 * @param {string} jobId - Job identifier
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch for commit comparison
 * @returns {{ passed: Array<{type: string, target: string}>, failed: Array<{type: string, target: string}> }}
 */
function reconcileJob(cwd, setId, waveId, jobId, worktreePath, baseBranch) {
  const waveDir = path.join(cwd, '.planning', 'sets', setId, waveId);
  const jobPlanPath = path.join(waveDir, `${jobId}-PLAN.md`);
  let jobPlan;
  try {
    jobPlan = fs.readFileSync(jobPlanPath, 'utf-8');
  } catch (err) {
    return { passed: [], failed: [{ type: 'plan_read_error', target: err.message }] };
  }

  const results = { passed: [], failed: [] };

  // 1. Parse "Files to Create/Modify" table from JOB-PLAN.md
  const plannedFiles = parseJobPlanFiles(jobPlan);

  // 2. Check each planned file exists in worktree
  for (const file of plannedFiles) {
    const fullPath = path.join(worktreePath, file.path);
    if (fs.existsSync(fullPath)) {
      results.passed.push({ type: 'file_exists', target: file.path });
    } else if (file.action === 'Create') {
      results.failed.push({ type: 'missing_file', target: file.path });
    } else if (file.action === 'Modify') {
      results.failed.push({ type: 'missing_modify_file', target: file.path });
    }
  }

  // 3. Commit format check
  const messages = getCommitMessages(worktreePath, baseBranch);
  const formatPattern = new RegExp(`^(feat|fix|refactor|test|docs|chore)\\(${escapeRegExp(setId)}\\):`);
  for (const msg of messages) {
    if (formatPattern.test(msg)) {
      results.passed.push({ type: 'commit_format_valid', target: msg });
    } else {
      results.failed.push({ type: 'commit_format_violation', target: msg });
    }
  }

  return results;
}

/**
 * Aggregate per-job reconciliation into wave-level results.
 *
 * Reads all `*-PLAN.md` files from `.planning/sets/{setId}/{waveId}/`.
 * Calls reconcileJob for each. Computes hardBlocks, softBlocks, and
 * overall PASS/PASS_WITH_WARNINGS/FAIL.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {string} waveId - Wave identifier
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch for commit comparison
 * @returns {{ hardBlocks: Array, softBlocks: Array, jobResults: Object, overall: string }}
 */
function reconcileWaveJobs(cwd, setId, waveId, worktreePath, baseBranch) {
  const waveDir = path.join(cwd, '.planning', 'sets', setId, waveId);
  let jobPlanFiles;
  try {
    jobPlanFiles = fs.readdirSync(waveDir).filter(f => f.endsWith('-PLAN.md'));
  } catch (err) {
    return { hardBlocks: [], softBlocks: [{ job: waveId, type: 'wave_dir_error', detail: err.message }], jobResults: {}, overall: 'PASS_WITH_WARNINGS' };
  }

  const hardBlocks = [];
  const softBlocks = [];
  const jobResults = {};

  for (const planFile of jobPlanFiles) {
    const jobId = planFile.replace('-PLAN.md', '');
    const result = reconcileJob(cwd, setId, waveId, jobId, worktreePath, baseBranch);

    jobResults[jobId] = {
      filesPlanned: result.passed.filter(p => p.type === 'file_exists').length +
                     result.failed.filter(f => f.type === 'missing_file').length +
                     result.failed.filter(f => f.type === 'missing_modify_file').length,
      filesDelivered: result.passed.filter(p => p.type === 'file_exists').length,
      missingFiles: result.failed.filter(f => f.type === 'missing_file' || f.type === 'missing_modify_file').map(f => f.target),
      commitViolations: result.failed.filter(f => f.type === 'commit_format_violation').map(f => f.target),
    };

    // Missing files are soft blocks
    for (const f of result.failed.filter(f => f.type === 'missing_file' || f.type === 'missing_modify_file')) {
      softBlocks.push({ job: jobId, type: f.type, detail: f.target });
    }
    // Commit violations are soft blocks
    for (const f of result.failed.filter(f => f.type === 'commit_format_violation')) {
      softBlocks.push({ job: jobId, type: 'commit_format_violation', detail: f.target });
    }
  }

  let overall = 'PASS';
  if (hardBlocks.length > 0) {
    overall = 'FAIL';
  } else if (softBlocks.length > 0) {
    overall = 'PASS_WITH_WARNINGS';
  }

  return { hardBlocks, softBlocks, jobResults, overall };
}

// ────────────────────────────────────────────────────────────────
// Progress banner generation
// ────────────────────────────────────────────────────────────────

/**
 * Generate a formatted progress banner for wave execution.
 *
 * Produces a banner block with wave header, indented job status lines, and timestamp.
 *
 * @param {string} waveId - Wave identifier
 * @param {number} waveIndex - Current wave index (1-based)
 * @param {number} totalWaves - Total number of waves
 * @param {Array<{ jobId: string, status: string, tasksCompleted: number, tasksTotal: number }>} jobStatuses
 * @param {string} timestamp - Timestamp string (HH:MM format)
 * @returns {string} Formatted banner string
 */
function formatProgressBanner(waveId, waveIndex, totalWaves, jobStatuses, timestamp) {
  const lines = [
    '--- RAPID Execute ---',
    `Wave ${waveId} (${waveIndex}/${totalWaves})`,
  ];

  for (const job of jobStatuses) {
    lines.push(`  ${job.jobId}: ${job.status} (${job.tasksCompleted}/${job.tasksTotal} steps)`);
  }

  lines.push(`[${timestamp}]`);
  lines.push('---------------------');

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Job-level handoff generation and parsing
// ────────────────────────────────────────────────────────────────

/**
 * Generate HANDOFF.md content for a job-level CHECKPOINT return.
 *
 * Like generateHandoff but includes wave and job context in frontmatter.
 * Stores at `.planning/sets/{setId}/{waveId}/{jobId}-HANDOFF.md`.
 *
 * @param {Object} checkpointData - Parsed CHECKPOINT return data
 * @param {string} setId - Set identifier
 * @param {string} waveId - Wave identifier
 * @param {string} jobId - Job identifier
 * @param {number} pauseCycle - Current pause cycle count
 * @returns {string} Markdown content for job-level HANDOFF.md
 */
function generateJobHandoff(checkpointData, setId, waveId, jobId, pauseCycle) {
  const frontmatter = [
    '---',
    `set: ${setId}`,
    `wave_id: ${waveId}`,
    `job_id: ${jobId}`,
    `paused_at: ${new Date().toISOString()}`,
    `pause_cycle: ${pauseCycle}`,
    `tasks_completed: ${checkpointData.tasks_completed || 0}`,
    `tasks_total: ${checkpointData.tasks_total || 0}`,
    '---',
  ].join('\n');

  const sections = [
    frontmatter,
    '',
    '## Completed Work',
    checkpointData.handoff_done || '(none recorded)',
    '',
    '## Remaining Work',
    checkpointData.handoff_remaining || '(none recorded)',
    '',
    '## Resume Instructions',
    checkpointData.handoff_resume || 'Continue from where execution stopped.',
  ];

  // Support both .decisions (array) and .handoff_decisions (string, per RAPID protocol)
  let decisions = checkpointData.decisions;
  if (!decisions || decisions.length === 0) {
    const hd = checkpointData.handoff_decisions;
    if (hd) {
      decisions = Array.isArray(hd) ? hd : [hd];
    }
  }

  if (decisions && decisions.length > 0) {
    sections.push('', '## Decisions Made');
    for (const d of decisions) {
      sections.push(`- ${d}`);
    }
  }

  return sections.join('\n') + '\n';
}

/**
 * Parse job-level HANDOFF.md content into a structured object.
 *
 * Like parseHandoff but extracts waveId and jobId from frontmatter.
 *
 * @param {string} handoffContent - Raw Markdown content
 * @returns {{ set: string, waveId: string, jobId: string, pauseCycle: number, tasksCompleted: number, tasksTotal: number, completedWork: string, remainingWork: string, resumeInstructions: string, decisions: string[] } | null}
 */
function parseJobHandoff(handoffContent) {
  if (!handoffContent) return null;

  const content = handoffContent.trim();
  if (content.length === 0) return null;

  // Parse frontmatter between --- markers
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = {};
  if (fmMatch) {
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }

  // Parse sections: extract text under each ## heading
  const sections = {};
  const sectionRegex = /^## (.+)$/gm;
  let match;
  const sectionStarts = [];

  while ((match = sectionRegex.exec(content)) !== null) {
    sectionStarts.push({ name: match[1], headingStart: match.index, index: match.index + match[0].length });
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i].index;
    const end = i + 1 < sectionStarts.length
      ? sectionStarts[i + 1].headingStart
      : content.length;
    const sectionContent = content.slice(start, end).trim();
    sections[sectionStarts[i].name] = sectionContent;
  }

  // Parse decisions from "Decisions Made" section
  const decisions = [];
  if (sections['Decisions Made']) {
    const lines = sections['Decisions Made'].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        decisions.push(trimmed.slice(2));
      }
    }
  }

  return {
    set: frontmatter.set || '',
    waveId: frontmatter.wave_id || '',
    jobId: frontmatter.job_id || '',
    pauseCycle: parseInt(frontmatter.pause_cycle, 10) || 0,
    tasksCompleted: parseInt(frontmatter.tasks_completed, 10) || 0,
    tasksTotal: parseInt(frontmatter.tasks_total, 10) || 0,
    completedWork: sections['Completed Work'] || '',
    remainingWork: sections['Remaining Work'] || '',
    resumeInstructions: sections['Resume Instructions'] || '',
    decisions,
  };
}

module.exports = {
  prepareSetContext,
  enrichedPrepareSetContext,
  assembleExecutorPrompt,
  assembleCompactedWaveContext,
  verifySetExecution,
  getChangedFiles,
  getCommitCount,
  getCommitMessages,
  generateHandoff,
  parseHandoff,
  resumeSet,
  reconcileWave,
  generateWaveSummary,
  reconcileJob,
  reconcileWaveJobs,
  formatProgressBanner,
  generateJobHandoff,
  parseJobHandoff,
  parseOwnedFiles,
  parseJobPlanFiles,
};
