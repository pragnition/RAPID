'use strict';

/**
 * merge.cjs - Merge pipeline library for RAPID set merging (v2.0).
 *
 * Provides:
 *   - 5-level conflict detection pipeline (textual L1, structural L2, dependency L3, API L4; semantic L5 = agent)
 *   - 4-tier resolution cascade (deterministic T1, heuristic T2; T3-T4 = agent/human, Plan 03)
 *   - MERGE-STATE.json Zod-validated per-set tracking (read/write/update)
 *   - DAG-ordered merge ordering (preserved from v1.0)
 *   - Merge execution with --no-ff (preserved from v1.0)
 *   - Integration test runner with NODE_TEST_CONTEXT cleanup (preserved from v1.0)
 *   - Programmatic validation gate, review prompt assembly, REVIEW.md I/O (preserved from v1.0)
 *
 * Depends on:
 *   - contract.cjs: compileContract, generateContractTest, checkOwnership
 *   - dag.cjs: getExecutionOrder for merge ordering
 *   - worktree.cjs: gitExec, readRegistry, detectMainBranch
 *   - execute.cjs: getChangedFiles (for v1.0 programmatic gate)
 *   - plan.cjs: loadSet
 *   - zod: MergeState schema validation
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { z } = require('zod');
const contract = require('./contract.cjs');
const dag = require('./dag.cjs');
const worktree = require('./worktree.cjs');
const execute = require('./execute.cjs');
const plan = require('./plan.cjs');
const returns = require('./returns.cjs');
const { acquireLock } = require('./lock.cjs');

// ────────────────────────────────────────────────────────────────
// MERGE-STATE.json Schema (MERG-03)
// ────────────────────────────────────────────────────────────────

// v2.2 Subagent lifecycle enum (MERGE-04)
const AgentPhaseEnum = z.enum(['idle', 'spawned', 'done', 'failed']);

const MergeStateSchema = z.object({
  setId: z.string(),
  status: z.enum([
    'pending',
    'detecting',
    'resolving',
    'merging',
    'testing',
    'complete',
    'failed',
    'reverted',
  ]),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  detection: z.object({
    textual: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        file: z.string(),
        type: z.string(),
        detail: z.string().optional(),
      })).default([]),
    }).optional(),
    structural: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        file: z.string(),
        functions: z.array(z.string()).default([]),
        detail: z.string().optional(),
      })).default([]),
    }).optional(),
    dependency: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        file: z.string(),
        added: z.array(z.string()).default([]),
        removed: z.array(z.string()).default([]),
      })).default([]),
    }).optional(),
    api: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        file: z.string(),
        exports: z.array(z.string()).default([]),
        detail: z.string().optional(),
      })).default([]),
    }).optional(),
    semantic: z.object({
      ran: z.boolean().default(false),
      conflicts: z.array(z.object({
        description: z.string(),
        sets: z.array(z.string()).default([]),
        confidence: z.number().optional(),
      })).default([]),
    }).optional(),
  }).optional(),
  resolution: z.object({
    tier1Count: z.number().default(0),
    tier2Count: z.number().default(0),
    tier3Count: z.number().default(0),
    tier4Count: z.number().default(0),
    escalatedConflicts: z.array(z.string()).default([]),
    allResolved: z.boolean().default(false),
  }).optional(),
  mergeCommit: z.string().optional(),
  mergeBranch: z.string().optional(),
  bisection: z.object({
    triggered: z.boolean().default(false),
    breakingSet: z.string().optional(),
    iterations: z.number().default(0),
    completedAt: z.string().optional(),
  }).optional(),
  // v2.2 Subagent tracking (MERGE-04) -- optional for backward compat
  agentPhase1: AgentPhaseEnum.optional(),  // per-set merger lifecycle
  agentPhase2: z.record(z.string(), AgentPhaseEnum).optional(),  // per-conflict resolver lifecycle (Phase 35)
  compressedResult: z.object({
    setId: z.string(),
    status: z.string(),
    conflictCounts: z.object({
      L1: z.number(),
      L2: z.number(),
      L3: z.number(),
      L4: z.number(),
      L5: z.number(),
    }),
    resolutionCounts: z.object({
      T1: z.number(),
      T2: z.number(),
      T3: z.number(),
      escalated: z.number(),
    }),
    commitSha: z.string().optional(),
  }).optional(),
  lastUpdatedAt: z.string(),
});

// ────────────────────────────────────────────────────────────────
// MERGE-STATE.json CRUD
// ────────────────────────────────────────────────────────────────

/**
 * Write MERGE-STATE.json for a set. Validates via Zod.
 *
 * @deprecated Use withMergeStateTransaction() or ensureMergeState() instead.
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Object} mergeState - State object to write
 */
function writeMergeState(cwd, setId, mergeState) {
  const validated = MergeStateSchema.parse(mergeState);
  validated.lastUpdatedAt = new Date().toISOString();

  const setDir = path.join(cwd, '.planning', 'sets', setId);
  fs.mkdirSync(setDir, { recursive: true });

  const statePath = path.join(setDir, 'MERGE-STATE.json');
  fs.writeFileSync(statePath, JSON.stringify(validated, null, 2), 'utf-8');
}

/**
 * Read MERGE-STATE.json for a set. Returns null if missing.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {Object|null}
 */
function readMergeState(cwd, setId) {
  const statePath = path.join(cwd, '.planning', 'sets', setId, 'MERGE-STATE.json');
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    return MergeStateSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Update MERGE-STATE.json with partial updates. Reads, merges, writes back.
 *
 * @deprecated Use withMergeStateTransaction() or ensureMergeState() instead.
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Object} updates - Partial state to merge
 */
function updateMergeState(cwd, setId, updates) {
  const current = readMergeState(cwd, setId);
  if (!current) {
    throw new Error(`No MERGE-STATE.json found for set ${setId}`);
  }
  const merged = { ...current, ...updates, lastUpdatedAt: new Date().toISOString() };
  writeMergeState(cwd, setId, merged);
}

/**
 * Execute a MERGE-STATE mutation within a transaction.
 * Acquires per-set lock, reads state, calls mutationFn(state) to mutate in-place,
 * validates with MergeStateSchema.parse, updates lastUpdatedAt, writes atomically
 * via tmp+rename, and releases lock. Returns validated state.
 *
 * CRITICAL: Do NOT call writeMergeState/updateMergeState from mutationFn -- it would bypass the lock.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Function} mutationFn - Function that receives state and mutates in-place
 * @returns {Promise<object>} The validated state after mutation
 */
async function withMergeStateTransaction(cwd, setId, mutationFn) {
  const release = await acquireLock(cwd, `merge-state-${setId}`);
  try {
    const current = readMergeState(cwd, setId);
    if (!current) {
      throw new Error(`No MERGE-STATE.json found for set ${setId}`);
    }
    mutationFn(current);
    const validated = MergeStateSchema.parse(current);
    validated.lastUpdatedAt = new Date().toISOString();
    const statePath = path.join(cwd, '.planning', 'sets', setId, 'MERGE-STATE.json');
    const tmpPath = statePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tmpPath, statePath);
    return validated;
  } finally {
    await release();
  }
}

/**
 * Ensure a MERGE-STATE.json exists for a set. If it exists, update with the
 * provided fields via transaction. If not, create it with writeMergeState().
 *
 * This replaces the common try-updateMergeState/catch-writeMergeState pattern.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Object} fields - Fields to set/update
 * @returns {Promise<object>} The validated state
 */
async function ensureMergeState(cwd, setId, fields) {
  const existing = readMergeState(cwd, setId);
  if (existing) {
    return withMergeStateTransaction(cwd, setId, (state) => {
      Object.assign(state, fields);
    });
  } else {
    // No existing state -- create with writeMergeState (already validates via Zod)
    const newState = {
      setId,
      lastUpdatedAt: new Date().toISOString(),
      ...fields,
    };
    writeMergeState(cwd, setId, newState);
    return readMergeState(cwd, setId);
  }
}

// ────────────────────────────────────────────────────────────────
// v2.2 Subagent Infrastructure (MERGE-04, MERGE-05)
// ────────────────────────────────────────────────────────────────

/**
 * Compress a full MERGE-STATE into a compact JSON object (~100 tokens).
 * Extracts conflict counts (L1-L5) and resolution counts (T1-T3 + escalated).
 * Used by orchestrator to retain per-set status without full state context.
 *
 * @param {Object} mergeState - Full merge state object (as returned by readMergeState)
 * @returns {Object} Compressed result: { setId, status, conflictCounts, resolutionCounts, commitSha }
 */
function compressResult(mergeState) {
  const detection = mergeState.detection || {};
  const resolution = mergeState.resolution || {};

  return {
    setId: mergeState.setId,
    status: mergeState.status,
    conflictCounts: {
      L1: (detection.textual && detection.textual.conflicts) ? detection.textual.conflicts.length : 0,
      L2: (detection.structural && detection.structural.conflicts) ? detection.structural.conflicts.length : 0,
      L3: (detection.dependency && detection.dependency.conflicts) ? detection.dependency.conflicts.length : 0,
      L4: (detection.api && detection.api.conflicts) ? detection.api.conflicts.length : 0,
      L5: (detection.semantic && detection.semantic.conflicts) ? detection.semantic.conflicts.length : 0,
    },
    resolutionCounts: {
      T1: resolution.tier1Count || 0,
      T2: resolution.tier2Count || 0,
      T3: resolution.tier3Count || 0,
      escalated: (resolution.escalatedConflicts) ? resolution.escalatedConflicts.length : 0,
    },
    commitSha: mergeState.mergeCommit || null,
  };
}

/**
 * Parse a merge subagent's RAPID:RETURN output with default-to-BLOCKED safety.
 * Wraps returns.cjs parseReturn() with merge-specific loose checks.
 *
 * @param {string} agentOutput - Full agent output text
 * @returns {{ status: string, reason?: string, data?: object }}
 *   - BLOCKED with reason on any failure (missing marker, malformed JSON, missing status)
 *   - CHECKPOINT with data for intermediate saves
 *   - COMPLETE/other with data on success
 */
function parseSetMergerReturn(agentOutput) {
  const result = returns.parseReturn(agentOutput);

  if (!result.parsed) {
    return { status: 'BLOCKED', reason: result.error };
  }

  if (!result.data.status) {
    return { status: 'BLOCKED', reason: 'Missing status field in return data' };
  }

  if (result.data.status === 'CHECKPOINT') {
    return { status: 'CHECKPOINT', data: result.data };
  }

  if (result.data.status === 'BLOCKED') {
    return { status: 'BLOCKED', reason: result.data.reason || 'Merger returned BLOCKED' };
  }

  // Loose field checks for COMPLETE and other statuses
  const arrayFields = ['semantic_conflicts', 'resolutions', 'escalations'];
  for (const field of arrayFields) {
    if (result.data[field] !== undefined && !Array.isArray(result.data[field])) {
      return { status: 'BLOCKED', reason: `Invalid field type: ${field} must be an array` };
    }
  }

  return { status: result.data.status, data: result.data };
}

/**
 * Assemble a launch briefing string for a merge subagent.
 * Pure function: takes structured data, returns assembled string.
 * The subagent reads full file details itself from the worktree.
 *
 * @param {Object} contextData - Structured launch data
 * @param {string} contextData.setId - Set identifier
 * @param {string} contextData.worktreePath - Path to set's worktree
 * @param {Array<{path: string, summary?: string}>} contextData.files - Files in set
 * @param {Array<{file: string, type: string, detail?: string}>} contextData.conflicts - Detected conflicts
 * @param {string} [contextData.contractPath] - Path to contract file
 * @returns {string} Assembled launch briefing
 */
function prepareMergerContext(contextData) {
  const { setId, worktreePath, files, conflicts, contractPath } = contextData;

  const lines = [];
  lines.push(`## Set: ${setId}`);
  lines.push(`Worktree: ${worktreePath}`);
  lines.push('');

  // Files section
  const fileCount = files.length;
  lines.push(`### Files (${fileCount} total)`);
  const maxFiles = 15;
  const displayFiles = files.slice(0, maxFiles);
  for (const f of displayFiles) {
    lines.push(`- ${f.path}: ${f.summary || '(no summary)'}`);
  }
  if (fileCount > maxFiles) {
    lines.push(`... and ${fileCount - maxFiles} more files (see worktree)`);
  }
  lines.push('');

  // Conflicts section
  const conflictCount = conflicts.length;
  lines.push(`### Conflicts (${conflictCount} total)`);
  for (const c of conflicts) {
    lines.push(`- [${c.type}] ${c.file}: ${c.detail || '(details in worktree)'}`);
  }
  lines.push('');

  // References section
  lines.push('### References');
  lines.push(`- Contract: ${contractPath || 'none'}`);

  return lines.join('\n');
}

/**
 * Estimate token count using chars/4 heuristic.
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// ────────────────────────────────────────────────────────────────
// Phase 35: Adaptive Conflict Resolution Helpers (MERGE-06)
// ────────────────────────────────────────────────────────────────

/**
 * Check if an escalation involves an API-signature conflict.
 * Cross-references escalation.file against L4 API detection results in MERGE-STATE.
 *
 * @param {Object} escalation - Escalation object from set-merger return
 * @param {string} escalation.file - File path of the escalated conflict
 * @param {Object} mergeState - MERGE-STATE object (or partial)
 * @returns {boolean} True if the file appears in L4 API conflicts
 */
function isApiSignatureConflict(escalation, mergeState) {
  const apiConflicts = mergeState?.detection?.api?.conflicts || [];
  return apiConflicts.some(c => c.file === escalation.file);
}

/**
 * Route an escalation based on confidence band and API-signature detection.
 *
 * Routing rules (from CONTEXT.md):
 *   - API-signature conflict -> 'human-api-gate' (always, regardless of confidence)
 *   - confidence < 0.3 -> 'human-direct' (too low for automated resolution)
 *   - confidence <= 0.8 -> 'resolver-agent' (mid-confidence, dispatch to resolver)
 *   - confidence > 0.8 -> 'auto-accept' (high confidence, accept as-is)
 *
 * @param {Object} escalation - Escalation object with file and confidence
 * @param {Object} mergeState - MERGE-STATE object for API detection lookup
 * @returns {'human-api-gate'|'human-direct'|'resolver-agent'|'auto-accept'} Route decision
 */
function routeEscalation(escalation, mergeState) {
  // Guard: undefined/null/NaN confidence defaults to safest route
  if (escalation.confidence == null || Number.isNaN(escalation.confidence)) {
    return 'human-direct';
  }

  if (isApiSignatureConflict(escalation, mergeState)) {
    return 'human-api-gate';
  }

  if (escalation.confidence < 0.3) {
    return 'human-direct';
  }

  if (escalation.confidence <= 0.8) {
    return 'resolver-agent';
  }

  return 'auto-accept';
}

/**
 * Generate a unique conflict ID for agentPhase2 tracking.
 *
 * Uses the escalation's file path as the base ID. If no file field,
 * falls back to 'conflict-{index}'. Appends ':1', ':2' etc. for duplicates.
 *
 * @param {Object} escalation - Escalation object from set-merger return
 * @param {number} index - Index of the escalation in the array
 * @param {Set<string>} existingIds - Set of already-used conflict IDs
 * @returns {string} Unique conflict ID
 */
function generateConflictId(escalation, index, existingIds) {
  const baseId = escalation.file || `conflict-${index}`;

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  // Find next available suffix
  let suffix = 1;
  while (existingIds.has(`${baseId}:${suffix}`)) {
    suffix++;
  }
  return `${baseId}:${suffix}`;
}

/**
 * Assemble a launch briefing for a conflict resolver agent.
 * Pure function: takes structured data, returns assembled string.
 *
 * @param {Object} contextData - Structured conflict context
 * @param {string} contextData.conflictId - Unique conflict identifier
 * @param {string} contextData.file - File path of the conflict
 * @param {string} contextData.worktreePath - Path to set's worktree
 * @param {string} contextData.setId - Set identifier
 * @param {Object} contextData.escalation - Escalation object from set-merger
 * @param {string} contextData.mergerAnalysis - Set-merger's original analysis text
 * @param {Object} contextData.contextPaths - Paths to both sets' CONTEXT.md
 * @param {Object} [contextData.apiDetection] - Optional L4 API detection data for this file
 * @returns {string} Assembled launch briefing
 */
function prepareResolverContext(contextData) {
  const { conflictId, file, worktreePath, setId, escalation, mergerAnalysis, contextPaths, apiDetection } = contextData;

  const lines = [];
  lines.push(`## Conflict: ${conflictId}`);
  lines.push(`File: ${file}`);
  lines.push(`Worktree: ${worktreePath}`);
  lines.push(`Set: ${setId}`);
  lines.push('');

  // Set-Merger Analysis section (with token truncation)
  lines.push('### Set-Merger Analysis');
  const maxAnalysisChars = 800 * 4; // ~800 tokens at 4 chars/token
  if (mergerAnalysis && mergerAnalysis.length > maxAnalysisChars) {
    lines.push(mergerAnalysis.substring(0, maxAnalysisChars) + '... [truncated]');
  } else {
    lines.push(mergerAnalysis || '(no analysis available)');
  }
  lines.push('');

  // Original Escalation section
  lines.push('### Original Escalation');
  lines.push(`Confidence: ${escalation.confidence}`);
  lines.push(`Reason: ${escalation.reason}`);
  lines.push(`Proposed: ${escalation.proposed_resolution}`);
  lines.push('');

  // Context References section
  lines.push('### Context References');
  lines.push(`- Set A context: ${contextPaths.setAContext}`);
  lines.push(`- Set B context: ${contextPaths.setBContext}`);
  lines.push(`- File history: run \`git log --oneline -10 -- ${file}\` in worktree`);
  lines.push('');

  // API Detection section
  lines.push('### API Detection');
  if (apiDetection) {
    lines.push(`File: ${apiDetection.file}`);
    if (apiDetection.exports && apiDetection.exports.length > 0) {
      lines.push(`Affected exports: ${apiDetection.exports.join(', ')}`);
    }
    if (apiDetection.detail) {
      lines.push(`Detail: ${apiDetection.detail}`);
    }
  } else {
    lines.push('No API conflicts for this file');
  }

  return lines.join('\n');
}

/**
 * Parse a conflict resolver agent's RAPID:RETURN output with default-to-BLOCKED safety.
 * Wraps returns.cjs parseReturn() with conflict-resolver-specific validation.
 *
 * @param {string} agentOutput - Full agent output text
 * @returns {{ status: string, reason?: string, data?: object }}
 *   - BLOCKED with reason on any failure (missing marker, malformed JSON, missing status/confidence)
 *   - COMPLETE with data on success (requires confidence field for auto-accept routing)
 */
function parseConflictResolverReturn(agentOutput) {
  const result = returns.parseReturn(agentOutput);

  if (!result.parsed) {
    return { status: 'BLOCKED', reason: result.error };
  }

  if (!result.data.status) {
    return { status: 'BLOCKED', reason: 'Missing status field in return data' };
  }

  if (result.data.status === 'BLOCKED') {
    return { status: 'BLOCKED', reason: result.data.reason || 'Resolver returned BLOCKED' };
  }

  if (result.data.status === 'COMPLETE') {
    // Confidence is required for auto-accept routing decision
    if (result.data.confidence == null) {
      return { status: 'BLOCKED', reason: 'Missing confidence field in COMPLETE return (required for routing)' };
    }
    return { status: 'COMPLETE', data: result.data };
  }

  // Unknown status -- return as-is with data
  return { status: result.data.status, data: result.data };
}

// ────────────────────────────────────────────────────────────────
// Detection Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Get the merge-base (branch point) between two branches.
 *
 * @param {string} cwd - Git repo directory
 * @param {string} branch - Feature branch
 * @param {string} baseBranch - Base branch
 * @returns {string} Commit hash of branch point
 */
function getBranchPoint(cwd, branch, baseBranch) {
  try {
    return execFileSync('git', ['merge-base', branch, baseBranch], {
      cwd, encoding: 'utf-8', stdio: 'pipe',
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Get files changed between a branch and base since their branch point.
 *
 * @param {string} cwd - Git repo directory
 * @param {string} branch - Branch to compare
 * @param {string} baseBranch - Base branch
 * @returns {string[]} List of changed file paths
 */
function getChangedFiles(cwd, branch, baseBranch) {
  try {
    const branchPoint = getBranchPoint(cwd, branch, baseBranch);
    if (!branchPoint) return [];
    const output = execFileSync('git', ['diff', '--name-only', branchPoint, branch], {
      cwd, encoding: 'utf-8', stdio: 'pipe',
    }).trim();
    return output ? output.split('\n').filter(l => l.trim().length > 0) : [];
  } catch {
    return [];
  }
}

/**
 * Get file content at a specific git ref.
 *
 * @param {string} cwd - Git repo directory
 * @param {string} ref - Git ref (branch name, commit hash)
 * @param {string} filePath - Path to file relative to repo root
 * @returns {string|null}
 */
function getFileContent(cwd, ref, filePath) {
  try {
    return execFileSync('git', ['show', `${ref}:${filePath}`], {
      cwd, encoding: 'utf-8', stdio: 'pipe',
    });
  } catch {
    return null;
  }
}

/**
 * Get diff hunks for a specific file between two refs.
 *
 * @param {string} cwd - Git repo directory
 * @param {string} ref1 - First ref
 * @param {string} ref2 - Second ref
 * @param {string} file - File path
 * @returns {string} Diff content
 */
function getDiffHunks(cwd, ref1, ref2, file) {
  try {
    return execFileSync('git', ['diff', ref1, ref2, '--', file], {
      cwd, encoding: 'utf-8', stdio: 'pipe',
    });
  } catch {
    return '';
  }
}

/**
 * Extract function names from diff content.
 * Matches function declarations and const/let arrow functions on added/removed lines.
 *
 * @param {string} diffContent - Git diff output
 * @returns {string[]} Unique function names
 */
function extractFunctionNames(diffContent) {
  const functionPattern = /^[+-]\s*(?:async\s+)?function\s+(\w+)|^[+-]\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(|=>)/gm;
  const names = [];
  let match;
  while ((match = functionPattern.exec(diffContent)) !== null) {
    names.push(match[1] || match[2]);
  }
  return [...new Set(names)];
}

/**
 * Extract dependencies (require/import) from file content.
 *
 * @param {string} content - File content
 * @returns {string[]} Module specifiers
 */
function extractDependencies(content) {
  const deps = [];
  // CommonJS
  const requirePattern = /require\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = requirePattern.exec(content)) !== null) deps.push(m[1]);
  // ESM
  const importPattern = /from\s+['"]([^'"]+)['"]/g;
  while ((m = importPattern.exec(content)) !== null) deps.push(m[1]);
  return deps;
}

/**
 * Extract exports from file content.
 * Handles module.exports = { ... } and ESM export patterns.
 *
 * @param {string} content - File content
 * @returns {string[]} Exported names
 */
function extractExports(content) {
  const exports = [];

  // module.exports = { name1, name2, ... }
  const cjsPattern = /module\.exports\s*=\s*\{([^}]+)\}/;
  const cjsMatch = content.match(cjsPattern);
  if (cjsMatch) {
    const inner = cjsMatch[1];
    // Split on commas, extract identifiers (handle "name" and "name: value" patterns)
    const parts = inner.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // "name: value" -> take "name"; "name" -> take "name"
      const nameMatch = trimmed.match(/^(\w+)/);
      if (nameMatch) exports.push(nameMatch[1]);
    }
  }

  // ESM: export function name(), export const name =, export { name }
  const esmFnPattern = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let m;
  while ((m = esmFnPattern.exec(content)) !== null) exports.push(m[1]);

  const esmConstPattern = /export\s+(?:const|let|var)\s+(\w+)/g;
  while ((m = esmConstPattern.exec(content)) !== null) exports.push(m[1]);

  const esmNamedPattern = /export\s*\{([^}]+)\}/g;
  while ((m = esmNamedPattern.exec(content)) !== null) {
    const inner = m[1];
    const names = inner.split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    exports.push(...names);
  }

  return [...new Set(exports)];
}

/**
 * Parse conflict file paths from git merge conflict output.
 *
 * @param {string} gitOutput - Output from a failed git merge
 * @returns {Array<{file: string, type: string, detail: string}>}
 */
function parseConflictFiles(gitOutput) {
  const conflicts = [];
  const seen = new Set();
  const pattern = /CONFLICT\s*\(([^)]*)\):\s*(?:Merge conflict in\s+)?(.+)/g;
  let match;
  while ((match = pattern.exec(gitOutput)) !== null) {
    const type = match[1].trim();
    const file = match[2].trim();
    if (!seen.has(file)) {
      seen.add(file);
      conflicts.push({ file, type, detail: match[0] });
    }
  }
  return conflicts;
}

// ────────────────────────────────────────────────────────────────
// Detection Pipeline (MERG-01)
// ────────────────────────────────────────────────────────────────

/**
 * Level 1: Detect textual conflicts via dry-run git merge.
 * Always runs git merge --abort in finally block.
 *
 * @param {string} cwd - Git repo directory
 * @param {string} setBranch - Branch name (e.g., 'rapid/auth-core')
 * @param {string} baseBranch - Base branch (e.g., 'main')
 * @returns {{ hasConflicts: boolean, conflicts: Array<{file: string, type: string, detail: string}>, error?: string }}
 */
function detectTextualConflicts(cwd, setBranch, baseBranch) {
  try {
    execFileSync('git', ['merge', '--no-commit', '--no-ff', setBranch], {
      cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 30000,
    });
    // No textual conflicts -- abort the merge
    try {
      execFileSync('git', ['merge', '--abort'], { cwd, stdio: 'pipe' });
    } catch { /* ok -- may not be in merge state if it was fast-forward */ }
    return { hasConflicts: false, conflicts: [] };
  } catch (err) {
    const output = ((err.stdout || '') + (err.stderr || '')).toString();
    if (output.includes('CONFLICT')) {
      const conflicts = parseConflictFiles(output);
      try { execFileSync('git', ['merge', '--abort'], { cwd, stdio: 'pipe' }); } catch { /* ok */ }
      return { hasConflicts: true, conflicts };
    }
    // Non-conflict error
    try { execFileSync('git', ['merge', '--abort'], { cwd, stdio: 'pipe' }); } catch { /* ok */ }
    return { hasConflicts: false, conflicts: [], error: output };
  }
}

/**
 * Extract function names that contain modified lines from a unified diff.
 * Parses @@ hunk headers for line ranges and maps changed lines to
 * the function scope they appear in (based on the original file content).
 *
 * @param {string} diffContent - Git unified diff output
 * @param {string} fileContent - Full file content at the target ref
 * @returns {string[]} Unique function names containing changes
 */
function extractModifiedFunctions(diffContent, fileContent) {
  if (!diffContent || !fileContent) return [];

  const lines = fileContent.split('\n');

  // Build a map of line number -> enclosing function name
  // Scan for function declarations and track scope
  const functionAtLine = [];
  let currentFunction = null;
  const funcPattern = /(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(|=>)/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(funcPattern);
    if (match) {
      currentFunction = match[1] || match[2];
    }
    functionAtLine[i] = currentFunction;
  }

  // Parse diff hunk headers to find which lines (in the new version) were changed
  const changedLineNumbers = new Set();
  const hunkPattern = /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/gm;
  let hunkMatch;
  while ((hunkMatch = hunkPattern.exec(diffContent)) !== null) {
    const startLine = parseInt(hunkMatch[1], 10);
    const lineCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;

    // Within this hunk, find actual changed lines (+ lines in the diff)
    const hunkStart = hunkMatch.index + hunkMatch[0].length;
    const remaining = diffContent.slice(hunkStart);
    const hunkLines = remaining.split('\n');

    let currentLineNo = startLine;
    for (const hLine of hunkLines) {
      if (hLine.startsWith('@@') || hLine.startsWith('diff ')) break;
      if (hLine.startsWith('+')) {
        changedLineNumbers.add(currentLineNo - 1); // 0-indexed
        currentLineNo++;
      } else if (hLine.startsWith('-')) {
        // Removed line -- check the line number in the old file (nearby in new file)
        changedLineNumbers.add(currentLineNo - 1);
      } else {
        currentLineNo++;
      }
    }
  }

  // Map changed line numbers to function names
  const functions = new Set();
  for (const lineNo of changedLineNumbers) {
    if (lineNo >= 0 && lineNo < functionAtLine.length && functionAtLine[lineNo]) {
      functions.add(functionAtLine[lineNo]);
    }
  }

  return [...functions];
}

/**
 * Level 2: Detect structural conflicts (overlapping function modifications).
 *
 * @param {string} cwd - Git repo directory
 * @param {string} setBranch - Branch name
 * @param {string} baseBranch - Base branch
 * @returns {{ conflicts: Array<{file: string, type: string, functions: string[]}> }}
 */
function detectStructuralConflicts(cwd, setBranch, baseBranch) {
  const conflicts = [];

  const branchPoint = getBranchPoint(cwd, setBranch, baseBranch);
  if (!branchPoint) return { conflicts };

  // Get files changed by this set branch since branch point
  const setChangedFiles = getChangedFiles(cwd, setBranch, baseBranch);

  // Get files changed on base since branch point
  const baseChangedFiles = getChangedFiles(cwd, baseBranch, setBranch);

  // Find overlapping files
  const overlapping = setChangedFiles.filter(f => baseChangedFiles.includes(f));

  for (const file of overlapping) {
    // Get diff hunks for both branches from the branch point
    const setDiff = getDiffHunks(cwd, branchPoint, setBranch, file);
    const baseDiff = getDiffHunks(cwd, branchPoint, baseBranch, file);

    // Get file content at each branch to determine function scope
    const setContent = getFileContent(cwd, setBranch, file);
    const baseContent = getFileContent(cwd, baseBranch, file);

    // Extract functions containing modifications
    const setFunctions = extractModifiedFunctions(setDiff, setContent);
    const baseFunctions = extractModifiedFunctions(baseDiff, baseContent);

    // Find overlapping function modifications
    const overlap = setFunctions.filter(f => baseFunctions.includes(f));

    if (overlap.length > 0) {
      conflicts.push({ file, type: 'structural', functions: overlap });
    }
  }

  return { conflicts };
}

/**
 * Level 3: Detect dependency conflicts (import/require changes in overlapping files).
 *
 * @param {string} cwd - Git repo directory
 * @param {string} setBranch - Branch name
 * @param {string} baseBranch - Base branch
 * @returns {{ conflicts: Array<{file: string, type: string, added: string[], removed: string[]}> }}
 */
function detectDependencyConflicts(cwd, setBranch, baseBranch) {
  const conflicts = [];

  const branchPoint = getBranchPoint(cwd, setBranch, baseBranch);
  if (!branchPoint) return { conflicts };

  // Get files changed by both branches
  const setChangedFiles = getChangedFiles(cwd, setBranch, baseBranch);
  const baseChangedFiles = getChangedFiles(cwd, baseBranch, setBranch);
  const overlapping = setChangedFiles.filter(f => baseChangedFiles.includes(f));

  for (const file of overlapping) {
    // Get file content at branch point (common ancestor)
    const ancestorContent = getFileContent(cwd, branchPoint, file);
    // Get file content on set branch
    const branchContent = getFileContent(cwd, setBranch, file);
    // Get file content on base branch
    const baseContent = getFileContent(cwd, baseBranch, file);

    if (!ancestorContent || !branchContent || !baseContent) continue;

    const ancestorDeps = extractDependencies(ancestorContent);
    const branchDeps = extractDependencies(branchContent);
    const baseDeps = extractDependencies(baseContent);

    // Find deps added by the branch (not in ancestor)
    const branchAdded = branchDeps.filter(d => !ancestorDeps.includes(d));
    // Find deps added by base (not in ancestor)
    const baseAdded = baseDeps.filter(d => !ancestorDeps.includes(d));

    // Find deps removed by branch
    const branchRemoved = ancestorDeps.filter(d => !branchDeps.includes(d));
    // Find deps removed by base
    const baseRemoved = ancestorDeps.filter(d => !baseDeps.includes(d));

    // A dependency conflict exists if both sides added or removed different deps
    const hasConflict = branchAdded.length > 0 || baseAdded.length > 0 ||
      branchRemoved.length > 0 || baseRemoved.length > 0;

    if (hasConflict) {
      conflicts.push({
        file,
        type: 'dependency',
        added: [...new Set([...branchAdded, ...baseAdded])],
        removed: [...new Set([...branchRemoved, ...baseRemoved])],
      });
    }
  }

  return { conflicts };
}

/**
 * Level 4: Detect API conflicts (export changes in overlapping files).
 *
 * @param {string} cwd - Git repo directory
 * @param {string} setBranch - Branch name
 * @param {string} baseBranch - Base branch
 * @returns {{ conflicts: Array<{file: string, type: string, exports: string[], detail: string}> }}
 */
function detectAPIConflicts(cwd, setBranch, baseBranch) {
  const conflicts = [];

  const branchPoint = getBranchPoint(cwd, setBranch, baseBranch);
  if (!branchPoint) return { conflicts };

  const setChangedFiles = getChangedFiles(cwd, setBranch, baseBranch);
  const baseChangedFiles = getChangedFiles(cwd, baseBranch, setBranch);
  const overlapping = setChangedFiles.filter(f => baseChangedFiles.includes(f));

  for (const file of overlapping) {
    const ancestorContent = getFileContent(cwd, branchPoint, file);
    const branchContent = getFileContent(cwd, setBranch, file);
    const baseContent = getFileContent(cwd, baseBranch, file);

    if (!ancestorContent || !branchContent || !baseContent) continue;

    const ancestorExports = extractExports(ancestorContent);
    const branchExports = extractExports(branchContent);
    const baseExports = extractExports(baseContent);

    // Find exports added/changed by each branch relative to ancestor
    const branchAddedExports = branchExports.filter(e => !ancestorExports.includes(e));
    const baseAddedExports = baseExports.filter(e => !ancestorExports.includes(e));
    const branchRemovedExports = ancestorExports.filter(e => !branchExports.includes(e));
    const baseRemovedExports = ancestorExports.filter(e => !baseExports.includes(e));

    const changedExports = [...new Set([
      ...branchAddedExports, ...baseAddedExports,
      ...branchRemovedExports, ...baseRemovedExports,
    ])];

    if (changedExports.length > 0) {
      const details = [];
      if (branchAddedExports.length > 0) details.push(`branch added: ${branchAddedExports.join(', ')}`);
      if (baseAddedExports.length > 0) details.push(`base added: ${baseAddedExports.join(', ')}`);
      if (branchRemovedExports.length > 0) details.push(`branch removed: ${branchRemovedExports.join(', ')}`);
      if (baseRemovedExports.length > 0) details.push(`base removed: ${baseRemovedExports.join(', ')}`);

      conflicts.push({
        file,
        type: 'api',
        exports: changedExports,
        detail: details.join('; '),
      });
    }
  }

  return { conflicts };
}

/**
 * Orchestrate all detection levels L1-L4. L5 semantic is null (filled by merger agent).
 *
 * @param {string} cwd - Git repo directory
 * @param {string} setName - Set name (branch will be rapid/{setName})
 * @param {string} baseBranch - Base branch
 * @returns {{ textual: Object, structural: Object, dependency: Object, api: Object, semantic: null }}
 */
function detectConflicts(cwd, setName, baseBranch) {
  const setBranch = `rapid/${setName}`;
  return {
    textual: detectTextualConflicts(cwd, setBranch, baseBranch),
    structural: detectStructuralConflicts(cwd, setBranch, baseBranch),
    dependency: detectDependencyConflicts(cwd, setBranch, baseBranch),
    api: detectAPIConflicts(cwd, setBranch, baseBranch),
    semantic: null, // L5: populated by merger agent via Plan 03
  };
}

// ────────────────────────────────────────────────────────────────
// Resolution Cascade (MERG-02)
// ────────────────────────────────────────────────────────────────

/**
 * Tier 1: Deterministic resolution -- auto-resolves non-overlapping changes,
 * whitespace-only conflicts, formatting differences.
 *
 * @param {Object} conflict - Conflict descriptor
 * @returns {{ resolved: boolean, confidence: number, resolution?: string }}
 */
function tryDeterministicResolve(conflict) {
  // Non-overlapping additions can always be merged safely
  if (conflict.nonOverlapping === true) {
    return {
      resolved: true,
      confidence: 1.0,
      resolution: 'auto-merged: non-overlapping changes',
    };
  }

  // Whitespace-only conflicts
  if (conflict.type === 'textual' && conflict.detail && conflict.detail.includes('whitespace')) {
    return {
      resolved: true,
      confidence: 1.0,
      resolution: 'auto-merged: whitespace-only difference',
    };
  }

  // Formatting-only conflicts
  if (conflict.type === 'textual' && conflict.detail && conflict.detail.includes('formatting')) {
    return {
      resolved: true,
      confidence: 1.0,
      resolution: 'auto-merged: formatting-only difference',
    };
  }

  return { resolved: false, confidence: 0 };
}

/**
 * Tier 2: Heuristic resolution -- uses ownership, DAG order, and common patterns.
 *
 * @param {Object} conflict - Conflict descriptor
 * @param {Object} ownership - Ownership map { filePath: ownerSetName }
 * @param {string[]} dagOrder - DAG-ordered set names (earlier = higher priority)
 * @returns {{ resolved: boolean, confidence: number, resolution?: string, signal?: string }}
 */
function tryHeuristicResolve(conflict, ownership, dagOrder) {
  // Signal 1: File ownership (weight: 0.4)
  if (ownership && ownership[conflict.file]) {
    const owner = ownership[conflict.file];
    return {
      resolved: true,
      confidence: 0.85,
      resolution: `prefer ${owner} version (file owner)`,
      signal: 'ownership',
    };
  }

  // Signal 2: DAG dependency order (weight: 0.3) -- earlier wave set's changes are base truth
  if (dagOrder && dagOrder.length > 0 && conflict.setName) {
    const setIndex = dagOrder.indexOf(conflict.setName);
    if (setIndex > 0) {
      // This set is a later wave -- prefer the earlier set's version
      return {
        resolved: true,
        confidence: 0.75,
        resolution: `prefer earlier-wave version (${conflict.setName} is wave ${setIndex + 1})`,
        signal: 'dag-order',
      };
    }
  }

  // Signal 3: Common conflict patterns (weight: 0.3)
  if (conflict.pattern === 'array-addition') {
    return {
      resolved: true,
      confidence: 0.8,
      resolution: 'merge both array entries',
      signal: 'pattern: array-addition',
    };
  }

  if (conflict.pattern === 'import-addition') {
    return {
      resolved: true,
      confidence: 0.9,
      resolution: 'merge all imports (dedup)',
      signal: 'pattern: import-dedup',
    };
  }

  if (conflict.pattern === 'export-addition') {
    return {
      resolved: true,
      confidence: 0.8,
      resolution: 'merge export objects',
      signal: 'pattern: export-merge',
    };
  }

  return { resolved: false, confidence: 0 };
}

/**
 * Run resolution cascade on all detected conflicts.
 * Tries T1 then T2, marks remainder as needsAgent for T3.
 *
 * @param {{ allConflicts: Array<Object> }} detectionResults - Aggregated conflicts
 * @param {{ ownership?: Object, dagOrder?: string[] }} options
 * @returns {Array<{ conflict: Object, tier: number, resolved: boolean, confidence: number, resolution?: string, needsAgent?: boolean }>}
 */
function resolveConflicts(detectionResults, options) {
  const results = [];
  const ownership = options.ownership || {};
  const dagOrder = options.dagOrder || [];

  for (const conflict of detectionResults.allConflicts) {
    // Tier 1: deterministic
    const t1 = tryDeterministicResolve(conflict);
    if (t1.resolved) {
      results.push({
        conflict,
        tier: 1,
        resolved: true,
        confidence: t1.confidence,
        resolution: t1.resolution,
      });
      continue;
    }

    // Tier 2: heuristic
    const t2 = tryHeuristicResolve(conflict, ownership, dagOrder);
    if (t2.resolved) {
      results.push({
        conflict,
        tier: 2,
        resolved: true,
        confidence: t2.confidence,
        resolution: t2.resolution,
      });
      continue;
    }

    // Tier 3: needs agent
    results.push({
      conflict,
      tier: 3,
      resolved: false,
      confidence: 0,
      needsAgent: true,
    });
  }

  return results;
}

// ────────────────────────────────────────────────────────────────
// Programmatic Validation Gate (preserved from v1.0)
// ────────────────────────────────────────────────────────────────

/**
 * Run the programmatic validation gate for a set before agent review.
 *
 * Checks:
 * 1. Contract schema validation (via compileContract)
 * 2. Contract test execution (generated test file run with plain `node`)
 * 3. File ownership compliance (with CONTRIBUTIONS.json exceptions)
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set to validate
 * @returns {{ passed: boolean, contractValid: boolean, testsPass: boolean, ownershipViolations: Array<{file: string, owner: string, declared: boolean}>, testOutput: string }}
 */
function runProgrammaticGate(cwd, setName) {
  const setData = plan.loadSet(cwd, setName);
  const setDir = path.join(cwd, '.planning', 'sets', setName);

  // 1. Validate contract schema
  const contractResult = contract.compileContract(setData.contract);
  const contractValid = contractResult.valid;

  // 2. Generate and run contract tests
  let testsPass = false;
  let testOutput = '';
  try {
    const testContent = contract.generateContractTest(setName, setData.contract);
    const tmpTestFile = path.join(setDir, '.contract-gate-test.cjs');
    fs.writeFileSync(tmpTestFile, testContent, 'utf-8');
    try {
      const result = execSync(`node "${tmpTestFile}"`, {
        cwd,
        stdio: 'pipe',
        timeout: 30000,
        encoding: 'utf-8',
      });
      testsPass = true;
      testOutput = result || '';
    } catch (err) {
      testsPass = false;
      testOutput = (err.stderr || err.stdout || err.message || '').toString();
    } finally {
      try { fs.unlinkSync(tmpTestFile); } catch { /* ok */ }
    }
  } catch (err) {
    testsPass = false;
    testOutput = err.message;
  }

  // 3. Check file ownership compliance
  const ownershipViolations = [];
  try {
    const registry = worktree.readRegistry(cwd);
    const entry = registry.worktrees[setName];

    if (entry) {
      const worktreePath = path.resolve(cwd, entry.path);
      let baseBranch = 'main';
      try {
        baseBranch = worktree.detectMainBranch(cwd);
      } catch {
        // Default to 'main'
      }

      const changedFiles = execute.getChangedFiles(worktreePath, baseBranch);

      // Load OWNERSHIP.json
      const ownershipPath = path.join(cwd, '.planning', 'sets', 'OWNERSHIP.json');
      let ownershipData = null;
      try {
        ownershipData = JSON.parse(fs.readFileSync(ownershipPath, 'utf-8'));
      } catch {
        // Graceful -- skip ownership check if file missing
      }

      if (ownershipData && ownershipData.ownership) {
        // Load CONTRIBUTIONS.json for exceptions
        let contributions = null;
        const contribPath = path.join(setDir, 'CONTRIBUTIONS.json');
        try {
          contributions = JSON.parse(fs.readFileSync(contribPath, 'utf-8'));
        } catch {
          // No contributions file -- no exceptions
        }

        for (const file of changedFiles) {
          const owner = contract.checkOwnership(ownershipData.ownership, file);
          if (owner !== null && owner !== setName) {
            // Check CONTRIBUTIONS.json for exception
            let hasException = false;
            if (contributions && Array.isArray(contributions.contributesTo)) {
              hasException = contributions.contributesTo.some(c => c.file === file);
            }

            if (!hasException) {
              ownershipViolations.push({ file, owner, declared: false });
            }
          }
        }
      }
    }
  } catch {
    // Graceful -- ownership check failure is not a gate failure
  }

  const passed = contractValid && testsPass && ownershipViolations.length === 0;

  return {
    passed,
    contractValid,
    testsPass,
    ownershipViolations,
    testOutput,
  };
}

// ────────────────────────────────────────────────────────────────
// Review Context Preparation (preserved from v1.0)
// ────────────────────────────────────────────────────────────────

/**
 * Prepare review context for a set.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @returns {{ changedFiles: string[], contractStr: string, ownershipData: Object|null, definition: string, setDir: string }}
 */
function prepareReviewContext(cwd, setName) {
  const setData = plan.loadSet(cwd, setName);
  const setDir = path.join(cwd, '.planning', 'sets', setName);

  let changedFiles = [];
  try {
    const registry = worktree.readRegistry(cwd);
    const entry = registry.worktrees[setName];
    if (entry) {
      const worktreePath = path.resolve(cwd, entry.path);
      let baseBranch = 'main';
      try { baseBranch = worktree.detectMainBranch(cwd); } catch { /* default */ }
      changedFiles = execute.getChangedFiles(worktreePath, baseBranch);
    }
  } catch {
    // Graceful
  }

  let ownershipData = null;
  try {
    const ownershipPath = path.join(cwd, '.planning', 'sets', 'OWNERSHIP.json');
    ownershipData = JSON.parse(fs.readFileSync(ownershipPath, 'utf-8'));
  } catch {
    // Graceful
  }

  return {
    changedFiles,
    contractStr: JSON.stringify(setData.contract, null, 2),
    ownershipData,
    definition: setData.definition,
    setDir,
  };
}

// ────────────────────────────────────────────────────────────────
// Reviewer Prompt Assembly (preserved from v1.0)
// ────────────────────────────────────────────────────────────────

/**
 * Assemble a prompt string for the reviewer agent.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @param {{ contractValid: boolean, testsPass: boolean, ownershipViolations: Array }} programmaticResults
 * @returns {string}
 */
function assembleReviewerPrompt(cwd, setName, programmaticResults) {
  const ctx = prepareReviewContext(cwd, setName);

  const violationCount = programmaticResults.ownershipViolations.length;
  const violationText = violationCount === 0
    ? 'none'
    : programmaticResults.ownershipViolations.map(v => `${v.file} (owned by ${v.owner})`).join(', ');

  const prompt = [
    `# Merge Review: ${setName}`,
    '',
    '## Changed Files',
    '',
    ctx.changedFiles.length > 0
      ? ctx.changedFiles.map(f => `- ${f}`).join('\n')
      : '- (no changed files detected)',
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
    '## Programmatic Validation Results',
    '',
    `- Contract schema: ${programmaticResults.contractValid ? 'PASS' : 'FAIL'}`,
    `- Contract tests: ${programmaticResults.testsPass ? 'PASS' : 'FAIL'}`,
    `- Ownership violations: ${violationText}`,
    '',
    '## Review Instructions',
    '',
    'Perform deep code review of all changed files. Evaluate:',
    '1. Code style consistency with project conventions',
    '2. Correctness -- logic errors, edge cases, error handling',
    '3. Contract compliance -- all exports match specification',
    '4. Test coverage -- critical paths have tests',
    '5. Merge safety -- no files modified outside set ownership',
    '',
    'Write your verdict as one of:',
    '- APPROVE: code is ready to merge',
    '- CHANGES: fixable issues found (style, missing tests)',
    '- BLOCK: critical issues requiring human intervention',
    '',
    'Output your review in REVIEW.md format with a `<!-- VERDICT:{verdict} -->` marker.',
    'Categorize findings as Blocking, Fixable (auto-cleanup eligible), or Suggestions.',
  ].join('\n');

  return prompt;
}

// ────────────────────────────────────────────────────────────────
// REVIEW.md Writing and Parsing (preserved from v1.0)
// ────────────────────────────────────────────────────────────────

/**
 * Write REVIEW.md to a set directory.
 *
 * @param {string} setDir - Path to the set directory
 * @param {{ setName: string, verdict: string, contractResults: Object, ownershipResults: Object, testResults: Object, findings: { blocking: string[], fixable: string[], suggestions: string[] } }} reviewData
 */
function writeReviewMd(setDir, reviewData) {
  const timestamp = new Date().toISOString();
  const lines = [];

  lines.push(`# Review: ${reviewData.setName}`);
  lines.push('');
  lines.push(`**Reviewed:** ${timestamp}`);
  lines.push(`**Verdict:** ${reviewData.verdict}`);
  lines.push(`<!-- VERDICT:${reviewData.verdict} -->`);
  lines.push('');

  lines.push('## Contract Validation');
  lines.push('');
  if (reviewData.contractResults.valid) {
    lines.push('- Schema validation: PASS');
  } else {
    lines.push('- Schema validation: FAIL');
    if (reviewData.contractResults.errors && reviewData.contractResults.errors.length > 0) {
      for (const err of reviewData.contractResults.errors) {
        lines.push(`  - ${err}`);
      }
    }
  }
  lines.push('');

  lines.push('## Ownership Check');
  lines.push('');
  const violations = reviewData.ownershipResults.violations || [];
  if (violations.length === 0) {
    lines.push('- No ownership violations');
  } else {
    lines.push(`- Ownership violations: ${violations.length}`);
    for (const v of violations) {
      lines.push(`  - ${v.file} (owned by ${v.owner}, declared: ${v.declared})`);
    }
  }
  lines.push('');

  lines.push('## Test Results');
  lines.push('');
  if (reviewData.testResults.passed) {
    lines.push('- Test suite: PASS');
  } else {
    lines.push('- Test suite: FAIL');
  }
  if (reviewData.testResults.output) {
    lines.push(`- Output: ${reviewData.testResults.output}`);
  }
  lines.push('');

  lines.push('## Findings');
  lines.push('');

  lines.push('### Blocking');
  lines.push('');
  if (reviewData.findings.blocking.length === 0) {
    lines.push('None');
  } else {
    for (const finding of reviewData.findings.blocking) {
      lines.push(`- ${finding}`);
    }
  }
  lines.push('');

  lines.push('### Fixable (auto-cleanup eligible)');
  lines.push('');
  if (reviewData.findings.fixable.length === 0) {
    lines.push('None');
  } else {
    for (const finding of reviewData.findings.fixable) {
      lines.push(`- ${finding}`);
    }
  }
  lines.push('');

  lines.push('### Suggestions');
  lines.push('');
  if (reviewData.findings.suggestions.length === 0) {
    lines.push('None');
  } else {
    for (const finding of reviewData.findings.suggestions) {
      lines.push(`- ${finding}`);
    }
  }
  lines.push('');

  fs.writeFileSync(path.join(setDir, 'REVIEW.md'), lines.join('\n'), 'utf-8');
}

/**
 * Parse the verdict from a set's REVIEW.md file.
 *
 * @param {string} setDir - Path to the set directory
 * @returns {{ verdict: string, found: true } | { found: false }}
 */
function parseReviewVerdict(setDir) {
  const reviewPath = path.join(setDir, 'REVIEW.md');
  try {
    const content = fs.readFileSync(reviewPath, 'utf-8');
    const match = content.match(/<!-- VERDICT:(APPROVE|CHANGES|BLOCK) -->/);
    if (match) {
      return { verdict: match[1], found: true };
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

// ────────────────────────────────────────────────────────────────
// Merge Ordering (preserved from v1.0)
// ────────────────────────────────────────────────────────────────

/**
 * Get the merge order as wave-grouped arrays from the DAG.
 *
 * @param {string} cwd - Project root directory
 * @returns {string[][]}
 */
function getMergeOrder(cwd) {
  const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
  const dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
  return dag.getExecutionOrder(dagJson);
}

// ────────────────────────────────────────────────────────────────
// Merge Execution (preserved from v1.0)
// ────────────────────────────────────────────────────────────────

/**
 * Merge a set's branch into the base branch using --no-ff.
 *
 * @param {string} projectRoot - Project root directory
 * @param {string} setName - Name of the set to merge
 * @param {string} baseBranch - Base branch to merge into
 * @returns {{ merged: true, branch: string, commitHash: string } | { merged: false, reason: string, detail: string }}
 */
function mergeSet(projectRoot, setName, baseBranch) {
  // Solo mode: no merge needed -- work is already on main
  const registry = worktree.readRegistry(projectRoot);
  const entry = registry.worktrees[setName];
  if (entry && entry.solo === true) {
    const headResult = worktree.gitExec(['rev-parse', 'HEAD'], projectRoot);
    return {
      merged: true,
      branch: entry.branch || baseBranch,
      commitHash: headResult.ok ? headResult.stdout : '',
      solo: true,
    };
  }

  const checkoutResult = worktree.gitExec(['checkout', baseBranch], projectRoot);
  if (!checkoutResult.ok) {
    return {
      merged: false,
      reason: 'checkout_failed',
      detail: checkoutResult.stderr || 'Failed to checkout base branch',
    };
  }

  // Pre-merge cleanup: commit untracked planning artifacts on main
  const untrackedResult = worktree.gitExec(
    ['ls-files', '--others', '--exclude-standard', '.planning/'],
    projectRoot
  );
  if (untrackedResult.ok && untrackedResult.stdout.trim()) {
    // Stage all untracked planning artifacts
    worktree.gitExec(['add', '.planning/'], projectRoot);
    // Commit them so merge --no-ff does not fail
    worktree.gitExec(
      ['commit', '-m', 'chore: stage untracked planning artifacts before merge'],
      projectRoot
    );
  }

  const branch = `rapid/${setName}`;
  const mergeMsg = `merge(${setName}): merge set into ${baseBranch}`;
  let mergeOk = false;
  let mergeStdout = '';
  let mergeStderr = '';
  try {
    mergeStdout = execFileSync(
      'git', ['merge', '--no-ff', branch, '-m', mergeMsg],
      { cwd: projectRoot, encoding: 'utf-8', stdio: 'pipe', timeout: 30000 }
    );
    mergeOk = true;
  } catch (err) {
    mergeStdout = (err.stdout || '').toString();
    mergeStderr = (err.stderr || '').toString();
  }

  if (!mergeOk) {
    const combinedOutput = mergeStdout + mergeStderr;
    if (combinedOutput.includes('CONFLICT') || combinedOutput.includes('Automatic merge failed')) {
      worktree.gitExec(['merge', '--abort'], projectRoot);
      return { merged: false, reason: 'conflict', detail: combinedOutput.trim() };
    }
    return { merged: false, reason: 'error', detail: (mergeStderr || mergeStdout).trim() };
  }

  const headResult = worktree.gitExec(['rev-parse', 'HEAD'], projectRoot);
  const commitHash = headResult.ok ? headResult.stdout : '';

  return { merged: true, branch, commitHash };
}

// ────────────────────────────────────────────────────────────────
// Integration Tests (preserved from v1.0)
// ────────────────────────────────────────────────────────────────

/**
 * Run integration tests. Clears NODE_TEST_CONTEXT before spawning.
 *
 * @param {string} projectRoot - Project root directory
 * @returns {{ passed: boolean, output: string }}
 */
function runIntegrationTests(projectRoot) {
  try {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;

    const result = execSync('node --test src/lib/*.test.cjs', {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 30000,
      encoding: 'utf-8',
      env,
    });
    return { passed: true, output: result || '' };
  } catch (err) {
    const output = (err.stderr || err.stdout || err.message || '').toString();
    return { passed: false, output };
  }
}

// ────────────────────────────────────────────────────────────────
// Bisection Recovery (MERG-05)
// ────────────────────────────────────────────────────────────────

const os = require('os');

/**
 * Get current HEAD commit hash before wave merging starts.
 * Used to record the pre-wave commit for later bisection.
 *
 * @param {string} cwd - Git repo directory
 * @returns {string} Current HEAD commit hash
 */
function getPreWaveCommit(cwd) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd, encoding: 'utf-8', stdio: 'pipe',
  }).trim();
}

/**
 * Bisect a wave to find the breaking set via binary search.
 *
 * 1. Saves .planning/ directory to temp location (fs.cpSync)
 * 2. Runs git reset --hard to preWaveCommit
 * 3. Binary search: splits mergedSets, re-merges subset via mergeSet(), runs runIntegrationTests()
 * 4. After each iteration, resets back to preWaveCommit
 * 5. When breaking set identified, restores .planning/ from temp
 * 6. Updates MERGE-STATE.json bisection field for the breaking set
 * 7. Returns {breakingSet, iterations, testOutput}
 *
 * @param {string} cwd - Git repo directory
 * @param {string} baseBranch - Base branch name (e.g., 'main')
 * @param {string[]} mergedSets - Array of set names that were merged in this wave
 * @param {string} preWaveCommit - Commit hash before wave merging started
 * @returns {{ breakingSet: string, iterations: number, testOutput: string }}
 */
function bisectWave(cwd, baseBranch, mergedSets, preWaveCommit) {
  const planningDir = path.join(cwd, '.planning');
  const tempDir = path.join(os.tmpdir(), `rapid-bisect-planning-${Date.now()}`);

  // 1. Save .planning/ to temp
  if (fs.existsSync(planningDir)) {
    fs.cpSync(planningDir, tempDir, { recursive: true });
  }

  let breakingSet = mergedSets[0]; // default for single-set case
  let iterations = 0;
  let lastTestOutput = '';

  try {
    // Trivial case: single set
    if (mergedSets.length === 1) {
      // Reset to pre-wave state
      execFileSync('git', ['reset', '--hard', preWaveCommit], {
        cwd, stdio: 'pipe',
      });

      // Re-merge the single set
      mergeSet(cwd, mergedSets[0], baseBranch);
      iterations = 1;

      // Run tests -- should fail (this set is the breaker)
      const testResult = runIntegrationTests(cwd);
      lastTestOutput = testResult.output || '';
      breakingSet = mergedSets[0];
    } else {
      // Binary search over merged sets
      let lo = 0;
      let hi = mergedSets.length - 1;

      while (lo < hi) {
        iterations++;
        const mid = Math.floor((lo + hi) / 2);

        // Reset to pre-wave state
        execFileSync('git', ['reset', '--hard', preWaveCommit], {
          cwd, stdio: 'pipe',
        });

        // Re-merge the first half (lo..mid)
        for (let i = lo; i <= mid; i++) {
          mergeSet(cwd, mergedSets[i], baseBranch);
        }

        // Run tests
        const testResult = runIntegrationTests(cwd);
        lastTestOutput = testResult.output || '';

        if (!testResult.passed) {
          // Breaking set is in first half
          hi = mid;
        } else {
          // Breaking set is in second half
          lo = mid + 1;
        }

        // Reset for next iteration
        execFileSync('git', ['reset', '--hard', preWaveCommit], {
          cwd, stdio: 'pipe',
        });
      }

      breakingSet = mergedSets[lo];
    }
  } finally {
    // 5. Restore .planning/ from temp
    if (fs.existsSync(tempDir)) {
      // Remove any .planning/ that git reset may have left
      if (fs.existsSync(planningDir)) {
        fs.rmSync(planningDir, { recursive: true, force: true });
      }
      fs.cpSync(tempDir, planningDir, { recursive: true });
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  // 6. Update MERGE-STATE.json with bisection results
  // TODO(data-integrity): migrate to withMergeStateTransaction when bisectWave becomes async
  try {
    const currentState = readMergeState(cwd, breakingSet);
    if (currentState) {
      // TODO(data-integrity): migrate to withMergeStateTransaction when bisectWave becomes async
      updateMergeState(cwd, breakingSet, {
        bisection: {
          triggered: true,
          breakingSet,
          iterations,
          completedAt: new Date().toISOString(),
        },
      });
    } else {
      // Create a new MERGE-STATE for the breaking set
      // TODO(data-integrity): migrate to ensureMergeState when bisectWave becomes async
      writeMergeState(cwd, breakingSet, {
        setId: breakingSet,
        status: 'failed',
        bisection: {
          triggered: true,
          breakingSet,
          iterations,
          completedAt: new Date().toISOString(),
        },
        lastUpdatedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Non-critical: bisection result is still returned even if state write fails
  }

  return { breakingSet, iterations, testOutput: lastTestOutput };
}

// ────────────────────────────────────────────────────────────────
// Single-Set Rollback (MERG-06)
// ────────────────────────────────────────────────────────────────

/**
 * Revert a single set's merge commit using git revert -m 1 --no-edit.
 * Reads MERGE-STATE.json to get the mergeCommit hash.
 *
 * @param {string} cwd - Git repo directory
 * @param {string} setId - Set identifier
 * @returns {{ reverted: boolean, revertCommit?: string, reason?: string, detail?: string }}
 */
function revertSetMerge(cwd, setId) {
  // Read MERGE-STATE to get the merge commit hash
  const state = readMergeState(cwd, setId);
  if (!state || !state.mergeCommit) {
    return {
      reverted: false,
      reason: 'no merge commit: missing mergeCommit in MERGE-STATE.json',
      detail: state ? 'MERGE-STATE exists but mergeCommit field is not set' : 'No MERGE-STATE.json found',
    };
  }

  const mergeCommitHash = state.mergeCommit;

  try {
    // -m 1 specifies parent 1 (base branch before merge)
    execFileSync('git', ['revert', '-m', '1', '--no-edit', mergeCommitHash], {
      cwd, encoding: 'utf-8', stdio: 'pipe',
    });

    // Get the revert commit hash
    const revertHash = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd, encoding: 'utf-8', stdio: 'pipe',
    }).trim();

    return { reverted: true, revertCommit: revertHash };
  } catch (err) {
    const output = ((err.stdout || '') + (err.stderr || '')).toString();

    // Abort any in-progress revert to leave repo clean
    try { execFileSync('git', ['revert', '--abort'], { cwd, stdio: 'pipe' }); } catch { /* ok */ }

    if (output.includes('CONFLICT') || output.includes('conflict')) {
      return { reverted: false, reason: 'conflict', detail: output.trim() };
    }
    return { reverted: false, reason: 'error', detail: output.trim() };
  }
}

/**
 * Detect cascade impact of rolling back a set.
 * Reads DAG.json to find sets that depend on setId AND have already been merged.
 *
 * @param {string} cwd - Git repo directory
 * @param {string} setId - Set identifier being rolled back
 * @returns {{ hasCascade: boolean, affectedSets: string[], recommendation: string }}
 */
function detectCascadeImpact(cwd, setId) {
  // Read DAG.json
  const dagPath = path.join(cwd, '.planning', 'DAG.json');
  let dagData;
  try {
    dagData = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
  } catch {
    return { hasCascade: false, affectedSets: [], recommendation: 'No DAG.json found -- cannot assess cascade impact' };
  }

  // Find sets that depend on setId (edges where setId is the "from" / dependency)
  const dependentSetIds = [];
  for (const edge of (dagData.edges || [])) {
    if (edge.from === setId) {
      dependentSetIds.push(edge.to);
    }
  }

  if (dependentSetIds.length === 0) {
    return { hasCascade: false, affectedSets: [], recommendation: 'No dependent sets in DAG' };
  }

  // Check which dependents have already been merged (status = 'complete' in MERGE-STATE)
  const affectedSets = [];
  for (const depSetId of dependentSetIds) {
    const depState = readMergeState(cwd, depSetId);
    if (depState && depState.status === 'complete') {
      affectedSets.push(depSetId);
    }
  }

  if (affectedSets.length === 0) {
    return {
      hasCascade: false,
      affectedSets: [],
      recommendation: `${dependentSetIds.length} dependent set(s) found but none have merged yet -- safe to rollback`,
    };
  }

  return {
    hasCascade: true,
    affectedSets,
    recommendation: `Rolling back ${setId} may affect ${affectedSets.length} already-merged dependent set(s): ${affectedSets.join(', ')}. Run integration tests after rollback and consider reverting dependent sets if tests fail.`,
  };
}

// ────────────────────────────────────────────────────────────────
// Agent Integration (MERG-01, MERG-02 completion)
// ────────────────────────────────────────────────────────────────

/**
 * Integrate merger agent's semantic conflict findings into the detection report.
 * Returns a new detection results object with the semantic field populated.
 * Does NOT mutate the original detectionResults.
 *
 * @param {Object} detectionResults - Detection results from detectConflicts (semantic may be null)
 * @param {Object} agentResults - Agent output with semantic_conflicts array
 * @returns {Object} Updated detection results with semantic field populated
 */
function integrateSemanticResults(detectionResults, agentResults) {
  // Deep-copy to avoid mutation
  const result = JSON.parse(JSON.stringify(detectionResults));

  if (agentResults && agentResults.semantic_conflicts) {
    result.semantic = {
      ran: true,
      conflicts: agentResults.semantic_conflicts.map(sc => ({
        description: sc.description,
        sets: sc.sets || [],
        confidence: sc.confidence,
      })),
    };
  } else {
    result.semantic = { ran: true, conflicts: [] };
  }

  return result;
}

/**
 * Apply merger agent's resolutions, categorizing as tier 3 (applied) or tier 4 (escalated)
 * based on confidence threshold.
 *
 * @param {Array} resolutions - Existing resolution array from resolveConflicts
 * @param {Object} agentResults - Agent output with resolutions array
 * @param {number} [confidenceThreshold=0.7] - Threshold for tier 3 vs tier 4
 * @returns {Array<{conflict: string, tier: 3|4, resolved: boolean, confidence: number, resolution?: string, escalation?: string}>}
 */
function applyAgentResolutions(resolutions, agentResults, confidenceThreshold) {
  const threshold = confidenceThreshold !== undefined ? confidenceThreshold : 0.7;

  const agentResolutionMap = {};
  if (agentResults && agentResults.resolutions) {
    for (const ar of agentResults.resolutions) {
      agentResolutionMap[ar.conflict] = ar;
    }
  }

  const results = [];
  for (const res of resolutions) {
    const agentRes = agentResolutionMap[res.conflict];
    if (agentRes) {
      if (agentRes.confidence >= threshold) {
        // Tier 3: AI-assisted resolution applied
        results.push({
          conflict: res.conflict,
          tier: 3,
          resolved: true,
          confidence: agentRes.confidence,
          resolution: agentRes.resolution,
        });
      } else {
        // Tier 4: Human escalation
        results.push({
          conflict: res.conflict,
          tier: 4,
          resolved: false,
          confidence: agentRes.confidence,
          escalation: `Agent confidence ${agentRes.confidence} below threshold ${threshold} -- requires human review`,
        });
      }
    } else {
      // No agent resolution for this conflict -- keep as-is
      results.push({ ...res });
    }
  }

  return results;
}

// ────────────────────────────────────────────────────────────────
// Module Exports
// ────────────────────────────────────────────────────────────────

module.exports = {
  // v2.0 Detection Pipeline (MERG-01)
  detectConflicts,
  detectTextualConflicts,
  detectStructuralConflicts,
  detectDependencyConflicts,
  detectAPIConflicts,

  // v2.0 Detection Helpers
  getChangedFiles,
  getFileContent,
  getDiffHunks,
  getBranchPoint,
  extractFunctionNames,
  extractDependencies,
  extractExports,
  parseConflictFiles,

  // v2.0 Resolution Cascade (MERG-02)
  tryDeterministicResolve,
  tryHeuristicResolve,
  resolveConflicts,

  // v2.0 MERGE-STATE.json (MERG-03)
  MergeStateSchema,
  writeMergeState,
  readMergeState,
  updateMergeState,
  withMergeStateTransaction,
  ensureMergeState,

  // v2.0 Bisection Recovery (MERG-05)
  bisectWave,
  getPreWaveCommit,

  // v2.0 Rollback (MERG-06)
  revertSetMerge,
  detectCascadeImpact,

  // v2.0 Agent Integration (MERG-01, MERG-02 completion)
  integrateSemanticResults,
  applyAgentResolutions,

  // Preserved v1.0 Functions (MERG-04)
  runProgrammaticGate,
  prepareReviewContext,
  assembleReviewerPrompt,
  writeReviewMd,
  parseReviewVerdict,
  getMergeOrder,
  mergeSet,
  runIntegrationTests,

  // v2.2 Subagent Infrastructure (MERGE-04, MERGE-05)
  prepareMergerContext,
  parseSetMergerReturn,
  compressResult,
  AgentPhaseEnum,

  // v2.2 Phase 35: Adaptive Conflict Resolution (MERGE-06)
  routeEscalation,
  isApiSignatureConflict,
  generateConflictId,
  prepareResolverContext,
  parseConflictResolverReturn,
};
