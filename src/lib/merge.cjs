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
 *   - worktree.cjs: gitExec, loadRegistry, detectMainBranch
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

// ────────────────────────────────────────────────────────────────
// MERGE-STATE.json Schema (MERG-03)
// ────────────────────────────────────────────────────────────────

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
  lastUpdatedAt: z.string(),
});

// ────────────────────────────────────────────────────────────────
// MERGE-STATE.json CRUD
// ────────────────────────────────────────────────────────────────

/**
 * Write MERGE-STATE.json for a set. Validates via Zod.
 *
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
    const registry = worktree.loadRegistry(cwd);
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
    const registry = worktree.loadRegistry(cwd);
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
  const checkoutResult = worktree.gitExec(['checkout', baseBranch], projectRoot);
  if (!checkoutResult.ok) {
    return {
      merged: false,
      reason: 'checkout_failed',
      detail: checkoutResult.stderr || 'Failed to checkout base branch',
    };
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

  // Preserved v1.0 Functions (MERG-04)
  runProgrammaticGate,
  prepareReviewContext,
  assembleReviewerPrompt,
  writeReviewMd,
  parseReviewVerdict,
  getMergeOrder,
  mergeSet,
  runIntegrationTests,
};
