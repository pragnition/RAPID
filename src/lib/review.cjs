'use strict';

/**
 * review.cjs - Review library for RAPID review pipeline.
 *
 * Provides Zod-validated schemas, set-scoped file discovery,
 * directory-based chunking, wave attribution from job plans,
 * structured issue logging, bugfix iteration tracking, and
 * review summary generation.
 *
 * Depends on:
 *   - execute.cjs: getChangedFiles
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { z } = require('zod');
const execute = require('./execute.cjs');
const merge = require('./merge.cjs');

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const CHUNK_THRESHOLD = 15;

const REVIEW_CONSTANTS = {
  MAX_BUGFIX_CYCLES: 3,
  ISSUE_TYPES: ['artifact', 'static', 'contract', 'test', 'bug', 'uat'],
  SEVERITY_LEVELS: ['critical', 'high', 'medium', 'low'],
  CHUNK_THRESHOLD,
};

// ────────────────────────────────────────────────────────────────
// Zod Schemas
// ────────────────────────────────────────────────────────────────

const ReviewIssue = z.object({
  id: z.string(),
  type: z.enum(['artifact', 'static', 'contract', 'test', 'bug', 'uat']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  file: z.string(),
  line: z.number().optional(),
  description: z.string(),
  autoFixAttempted: z.boolean().default(false),
  autoFixSucceeded: z.boolean().default(false),
  source: z.enum(['lean-review', 'unit-test', 'bug-hunt', 'uat']),
  status: z.enum(['open', 'fixed', 'deferred', 'dismissed']).default('open'),
  originatingWave: z.string().optional(),
  concern: z.string().optional(),
  createdAt: z.string(),
  fixedAt: z.string().optional(),
});

const ConcernFile = z.object({
  file: z.string(),
  rationale: z.string(),
});

const ConcernGroup = z.object({
  name: z.string(),
  files: z.array(z.string()),
  rationale: z.record(z.string(), z.string()),
});

const ScoperOutput = z.object({
  concerns: z.array(ConcernGroup),
  crossCutting: z.array(ConcernFile),
  totalFiles: z.number(),
  concernCount: z.number(),
  crossCuttingCount: z.number(),
});

const ReviewIssues = z.object({
  setId: z.string(),
  issues: z.array(ReviewIssue),
  lastUpdatedAt: z.string(),
});

// ────────────────────────────────────────────────────────────────
// Review State Schemas
// ────────────────────────────────────────────────────────────────

const REVIEW_STAGES = ['scope', 'unit-test', 'bug-hunt', 'uat'];

const ReviewStageSchema = z.object({
  completed: z.boolean(),
  verdict: z.enum(['pass', 'fail', 'partial']),
});

const ReviewStateSchema = z.object({
  setId: z.string(),
  stages: z.object({
    scope: ReviewStageSchema.optional(),
    'unit-test': ReviewStageSchema.optional(),
    'bug-hunt': ReviewStageSchema.optional(),
    uat: ReviewStageSchema.optional(),
  }),
  lastUpdatedAt: z.string(),
});

// ────────────────────────────────────────────────────────────────
// Scoping Functions
// ────────────────────────────────────────────────────────────────

/**
 * Compute review scope for a set: changed files + one-hop dependents.
 *
 * @param {string} cwd - Project root directory
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch name (e.g., 'main')
 * @returns {{ changedFiles: string[], dependentFiles: string[], totalFiles: number }}
 */
function scopeSetForReview(cwd, worktreePath, baseBranch) {
  const changedFiles = execute.getChangedFiles(worktreePath, baseBranch);
  const dependentFiles = findDependents(cwd, changedFiles);
  return {
    changedFiles,
    dependentFiles,
    totalFiles: changedFiles.length + dependentFiles.length,
  };
}

/**
 * Compute review scope for a set from its merge commit (post-merge mode).
 * Uses MERGE-STATE.json mergeCommit hash when available, falls back to
 * git log grep. Validates the commit is a merge (2 parents), diffs against
 * the first parent, and filters out .planning/ files.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {{ changedFiles: string[], dependentFiles: string[], totalFiles: number }}
 */
function scopeSetPostMerge(cwd, setId) {
  let mergeCommit = null;

  // 1. Try MERGE-STATE.json first
  const mergeState = merge.readMergeState(cwd, setId);
  if (mergeState && mergeState.mergeCommit) {
    mergeCommit = mergeState.mergeCommit;
  }

  // 2. Fallback to git log grep
  if (!mergeCommit) {
    try {
      const result = execSync(
        `git log --oneline --grep="merge(${setId})" --format="%H" -1`,
        { cwd, stdio: 'pipe', encoding: 'utf-8' }
      ).trim();
      if (result) {
        mergeCommit = result;
      }
    } catch {
      // git log failed -- will throw below
    }
  }

  if (!mergeCommit) {
    throw new Error(`No merge commit found for set '${setId}'. Verify the set has been merged.`);
  }

  // 3. Validate merge commit has 2 parents
  try {
    const catFile = execSync(
      `git cat-file -p ${mergeCommit}`,
      { cwd, stdio: 'pipe', encoding: 'utf-8' }
    );
    const parentLines = catFile.split('\n').filter(line => line.startsWith('parent '));
    if (parentLines.length < 2) {
      throw new Error(`Commit ${mergeCommit} is not a merge commit (expected 2 parents).`);
    }
  } catch (err) {
    if (err.message.includes('is not a merge commit')) throw err;
    throw new Error(`Failed to validate merge commit ${mergeCommit}: ${err.message}`);
  }

  // 4. Get changed files via diff against first parent
  let changedFiles;
  try {
    const diffOutput = execSync(
      `git diff --name-only ${mergeCommit}^1..${mergeCommit}`,
      { cwd, stdio: 'pipe', encoding: 'utf-8' }
    ).trim();

    changedFiles = diffOutput
      .split('\n')
      .filter(f => f.length > 0)
      .filter(f => !f.startsWith('.planning/'));
  } catch {
    // Git diff failed -- return empty scope with warning
    return { changedFiles: [], dependentFiles: [], totalFiles: 0 };
  }

  // 5. Find dependents
  const dependentFiles = findDependents(cwd, changedFiles);

  // 6. Return same shape as scopeSetForReview
  return {
    changedFiles,
    dependentFiles,
    totalFiles: changedFiles.length + dependentFiles.length,
  };
}

/**
 * Find files that import/require any of the given changed files.
 * Searches project files recursively, skipping node_modules, .git, .planning.
 *
 * @param {string} cwd - Project root directory
 * @param {string[]} changedFiles - Array of changed file paths (relative to cwd)
 * @returns {string[]} Unique dependent file paths not already in changedFiles
 */
function findDependents(cwd, changedFiles) {
  if (!changedFiles || changedFiles.length === 0) return [];

  const changedSet = new Set(changedFiles);
  const dependents = new Set();

  // Recursively walk project files
  const allFiles = walkDir(cwd, ['node_modules', '.git', '.planning', '.worktrees', '.rapid-worktrees']);

  for (const absPath of allFiles) {
    const relPath = path.relative(cwd, absPath);

    // Skip if this file is already in changedFiles
    if (changedSet.has(relPath)) continue;

    // Only check source files
    const ext = path.extname(absPath);
    if (!['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx'].includes(ext)) continue;

    try {
      const content = fs.readFileSync(absPath, 'utf-8');

      // Check if this file references any of the changed files
      for (const changedFile of changedFiles) {
        const changedBasename = path.basename(changedFile);
        const changedNoExt = path.basename(changedFile, path.extname(changedFile));

        // Match require('...changedFile...') or import ... from '...changedFile...'
        // Use simple string matching for require/import patterns
        if (
          content.includes(`require('${changedBasename}'`) ||
          content.includes(`require('./${changedBasename}'`) ||
          content.includes(`require("${changedBasename}"`) ||
          content.includes(`require("./${changedBasename}"`) ||
          content.includes(`require('./${changedNoExt}'`) ||
          content.includes(`require("./${changedNoExt}"`) ||
          content.includes(`from '${changedBasename}'`) ||
          content.includes(`from "./${changedBasename}"`) ||
          content.includes(`from './${changedNoExt}'`) ||
          content.includes(`from "./${changedNoExt}"`) ||
          content.includes(`require('../${changedFile}'`) ||
          content.includes(`require("../${changedFile}"`) ||
          matchRelativeImport(absPath, changedFile, cwd, content)
        ) {
          dependents.add(relPath);
          break; // No need to check more changed files for this dependent
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return Array.from(dependents);
}

/**
 * Check if a file imports another via a relative path that resolves to the changed file.
 *
 * @param {string} importerAbsPath - Absolute path of the file doing the import
 * @param {string} changedRelPath - Relative path of the changed file (relative to cwd)
 * @param {string} cwd - Project root
 * @param {string} content - File content to search
 * @returns {boolean}
 */
function matchRelativeImport(importerAbsPath, changedRelPath, cwd, content) {
  const changedAbsPath = path.join(cwd, changedRelPath);
  const importerDir = path.dirname(importerAbsPath);
  const relFromImporter = path.relative(importerDir, changedAbsPath);

  // Normalize to ./relative format
  const normalized = relFromImporter.startsWith('.') ? relFromImporter : './' + relFromImporter;
  const normalizedNoExt = normalized.replace(/\.[^/.]+$/, '');

  return (
    content.includes(`'${normalized}'`) ||
    content.includes(`"${normalized}"`) ||
    content.includes(`'${normalizedNoExt}'`) ||
    content.includes(`"${normalizedNoExt}"`)
  );
}

/**
 * Recursively walk a directory, returning all file paths.
 * Skips directories in the skip list.
 *
 * @param {string} dir - Directory to walk
 * @param {string[]} skipDirs - Directory names to skip
 * @returns {string[]} Array of absolute file paths
 */
function walkDir(dir, skipDirs) {
  const files = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (skipDirs.includes(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath, skipDirs));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

// ────────────────────────────────────────────────────────────────
// Chunking Functions
// ────────────────────────────────────────────────────────────────

/**
 * Group files into directory-based chunks for parallel review.
 * Files below the CHUNK_THRESHOLD are returned as a single chunk.
 * Small directories (< 3 files) are merged into the last large chunk.
 *
 * @param {string[]} files - Array of file paths (relative to project root)
 * @returns {Array<{dir: string, files: string[]}>} Array of chunks
 */
function chunkByDirectory(files) {
  if (files.length <= CHUNK_THRESHOLD) {
    return [{ dir: '.', files }];
  }

  const groups = new Map();
  for (const file of files) {
    const dir = path.dirname(file);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(file);
  }

  // Separate large groups (>= 3 files) from small groups (< 3 files)
  const chunks = [];
  let overflow = [];
  for (const [dir, dirFiles] of groups) {
    if (dirFiles.length < 3) {
      overflow.push(...dirFiles);
    } else {
      chunks.push({ dir, files: dirFiles });
    }
  }

  // Merge overflow into last large chunk, or create overflow chunk
  if (overflow.length > 0) {
    if (chunks.length > 0) {
      chunks[chunks.length - 1].files.push(...overflow);
    } else {
      chunks.push({ dir: '.', files: overflow });
    }
  }

  return chunks;
}

// ────────────────────────────────────────────────────────────────
// Wave Attribution
// ────────────────────────────────────────────────────────────────

/**
 * Build a file-to-wave attribution map by reading JOB-PLAN.md files.
 * Extracts file paths from "Files to Create/Modify" tables in each
 * wave's plan files. Last wave wins when a file appears in multiple waves.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {Object<string, string>} Map of filePath -> waveId
 */
function buildWaveAttribution(cwd, setId) {
  const attribution = {};
  const setDir = path.join(cwd, '.planning', 'sets', setId);

  if (!fs.existsSync(setDir)) return attribution;

  let entries;
  try {
    entries = fs.readdirSync(setDir)
      .filter(f => /^wave-.*-PLAN\.md$/.test(f))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return attribution;
  }

  for (const planFile of entries) {
    // Extract wave identifier: "wave-1-PLAN.md" -> "wave-1"
    const waveId = planFile.replace(/-PLAN\.md$/, '');

    try {
      const content = fs.readFileSync(path.join(setDir, planFile), 'utf-8');
      // Regex matches table rows: | `file/path.cjs` | Create | or | file/path.cjs | Modify |
      const tableRegex = /\|\s*`?([^`|]+?)`?\s*\|\s*(Create|Modify)\s*\|/gi;
      let match;
      while ((match = tableRegex.exec(content)) !== null) {
        const filePath = match[1].trim();
        if (filePath && filePath !== 'File' && !filePath.startsWith('---')) {
          // Last wave wins (sequential execution model)
          attribution[filePath] = waveId;
        }
      }
    } catch {
      // Skip malformed plan files gracefully
    }
  }

  return attribution;
}

// ────────────────────────────────────────────────────────────────
// Issue Management
// ────────────────────────────────────────────────────────────────

/**
 * Log a review issue to REVIEW-ISSUES.json at the set level.
 * Creates the file and directories if they don't exist.
 * Validates the issue with Zod before persisting.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Object} issue - Issue data to log (may include originatingWave)
 */
function logIssue(cwd, setId, issue) {
  const setDir = path.join(cwd, '.planning', 'sets', setId);
  const issuesPath = path.join(setDir, 'REVIEW-ISSUES.json');

  // Validate issue with Zod
  const validatedIssue = ReviewIssue.parse(issue);

  // Create directory if needed
  fs.mkdirSync(setDir, { recursive: true });

  // Read existing or create new container
  let existing = { setId, issues: [], lastUpdatedAt: '' };
  if (fs.existsSync(issuesPath)) {
    existing = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
  }

  // Append issue and update timestamp
  existing.issues.push(validatedIssue);
  existing.lastUpdatedAt = new Date().toISOString();

  // Write atomically
  fs.writeFileSync(issuesPath, JSON.stringify(existing, null, 2), 'utf-8');
}

/**
 * Load all issues for a set. Reads the set-level REVIEW-ISSUES.json first,
 * then falls back to reading wave subdirectories for legacy compatibility
 * (lean review writes to wave-level REVIEW-ISSUES.json).
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {Array<Object>} Flat array of issues with originatingWave preserved
 */
function loadSetIssues(cwd, setId) {
  const wavesDir = path.join(cwd, '.planning', 'sets', setId);
  const issues = [];
  const seenIds = new Set();

  if (!fs.existsSync(wavesDir)) return issues;

  // 1. Read set-level REVIEW-ISSUES.json
  const setLevelPath = path.join(wavesDir, 'REVIEW-ISSUES.json');
  if (fs.existsSync(setLevelPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(setLevelPath, 'utf-8'));
      for (const issue of data.issues) {
        issues.push(issue);
        seenIds.add(issue.id);
      }
    } catch {
      // Skip malformed files
    }
  }

  // 2. Fall back to reading wave subdirectories for legacy compatibility
  let entries;
  try {
    entries = fs.readdirSync(wavesDir, { withFileTypes: true });
  } catch {
    return issues;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const issuesPath = path.join(wavesDir, entry.name, 'REVIEW-ISSUES.json');
    if (fs.existsSync(issuesPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
        for (const issue of data.issues) {
          // Avoid duplicates (set-level issues take precedence)
          if (!seenIds.has(issue.id)) {
            // Set originatingWave from directory name for legacy issues
            issues.push({ ...issue, originatingWave: issue.originatingWave || entry.name });
            seenIds.add(issue.id);
          }
        }
      } catch {
        // Skip malformed files
      }
    }
  }

  return issues;
}

/**
 * Update the status of a specific issue in the set-level REVIEW-ISSUES.json.
 * If newStatus is 'fixed', sets fixedAt to current ISO timestamp.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {string} issueId - Issue ID to update
 * @param {string} newStatus - New status ('open', 'fixed', 'deferred', 'dismissed')
 */
function updateIssueStatus(cwd, setId, issueId, newStatus) {
  const issuesPath = path.join(cwd, '.planning', 'sets', setId, 'REVIEW-ISSUES.json');

  if (!fs.existsSync(issuesPath)) {
    throw new Error(`REVIEW-ISSUES.json not found at ${issuesPath}`);
  }

  const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
  const issue = data.issues.find(i => i.id === issueId);

  if (!issue) {
    throw new Error(`Issue ${issueId} not found in ${issuesPath}`);
  }

  issue.status = newStatus;
  if (newStatus === 'fixed') {
    issue.fixedAt = new Date().toISOString();
  }

  data.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(issuesPath, JSON.stringify(data, null, 2), 'utf-8');
}

// ────────────────────────────────────────────────────────────────
// Summary Generation
// ────────────────────────────────────────────────────────────────

/**
 * Generate a review summary in markdown format.
 * Includes overview with total issues by severity, per-wave breakdown
 * (grouped by originatingWave), issues by status, and deferred count
 * warning if >5.
 *
 * @param {string} setId - Set identifier
 * @param {Array<Object>} issues - Flat array of issues (with originatingWave)
 * @returns {string} Markdown summary content
 */
function generateReviewSummary(setId, issues) {
  const lines = [];

  // Title
  lines.push(`# Review Summary: ${setId}`);
  lines.push('');

  // Overview
  lines.push('## Overview');
  lines.push('');
  lines.push(`**Total issues:** ${issues.length}`);
  lines.push('');

  // By severity
  lines.push('### Issues by Severity');
  lines.push('');
  for (const severity of REVIEW_CONSTANTS.SEVERITY_LEVELS) {
    const count = issues.filter(i => i.severity === severity).length;
    if (count > 0) {
      lines.push(`- **${severity}:** ${count}`);
    }
  }
  lines.push('');

  // By type
  lines.push('### Issues by Type');
  lines.push('');
  for (const type of REVIEW_CONSTANTS.ISSUE_TYPES) {
    const count = issues.filter(i => i.type === type).length;
    if (count > 0) {
      lines.push(`- **${type}:** ${count}`);
    }
  }
  lines.push('');

  // Per-wave breakdown (grouped by originatingWave)
  const waveIds = [...new Set(issues.map(i => i.originatingWave).filter(Boolean))].sort();
  if (waveIds.length > 0) {
    lines.push('## Per-Wave Breakdown');
    lines.push('');
    for (const waveId of waveIds) {
      const waveIssues = issues.filter(i => i.originatingWave === waveId);
      lines.push(`### ${waveId}`);
      lines.push('');
      lines.push(`**Issues:** ${waveIssues.length}`);

      // Severity breakdown for this wave
      for (const severity of REVIEW_CONSTANTS.SEVERITY_LEVELS) {
        const count = waveIssues.filter(i => i.severity === severity).length;
        if (count > 0) {
          lines.push(`- ${severity}: ${count}`);
        }
      }
      lines.push('');
    }
  }

  // By status
  lines.push('## Issues by Status');
  lines.push('');
  const statuses = ['open', 'fixed', 'deferred', 'dismissed'];
  for (const status of statuses) {
    const count = issues.filter(i => i.status === status).length;
    lines.push(`- **${status}:** ${count}`);
  }
  lines.push('');

  // Deferred warning
  const deferredCount = issues.filter(i => i.status === 'deferred').length;
  if (deferredCount > 5) {
    lines.push(`> **WARNING:** ${deferredCount} deferred issues detected. Consider resolving deferred items before merge.`);
    lines.push('');
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Post-Merge Review Artifacts
// ────────────────────────────────────────────────────────────────

/**
 * Log a review issue to the post-merge artifact directory.
 * Writes to .planning/post-merge/{setId}/REVIEW-ISSUES.json
 * instead of the standard .planning/sets/{setId}/ directory.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Object} issue - Issue data to log
 */
function logIssuePostMerge(cwd, setId, issue) {
  const setDir = path.join(cwd, '.planning', 'post-merge', setId);
  const issuesPath = path.join(setDir, 'REVIEW-ISSUES.json');

  // Validate issue with Zod
  const validatedIssue = ReviewIssue.parse(issue);

  // Create directory if needed
  fs.mkdirSync(setDir, { recursive: true });

  // Read existing or create new container
  let existing = { setId, issues: [], lastUpdatedAt: '' };
  if (fs.existsSync(issuesPath)) {
    existing = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
  }

  // Append issue and update timestamp
  existing.issues.push(validatedIssue);
  existing.lastUpdatedAt = new Date().toISOString();

  // Write atomically
  fs.writeFileSync(issuesPath, JSON.stringify(existing, null, 2), 'utf-8');
}

/**
 * Load issues from the post-merge artifact directory.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {Array<Object>} Array of issues (empty if none exist)
 */
function loadPostMergeIssues(cwd, setId) {
  const issuesPath = path.join(cwd, '.planning', 'post-merge', setId, 'REVIEW-ISSUES.json');
  if (!fs.existsSync(issuesPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(issuesPath, 'utf-8'));
    return data.issues || [];
  } catch {
    return [];
  }
}

/**
 * Generate REVIEW-SUMMARY.md in the post-merge artifact directory.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Array<Object>} issues - Array of issues to summarize
 * @returns {string} Path to the written summary file
 */
function generatePostMergeReviewSummary(cwd, setId, issues) {
  const summaryContent = generateReviewSummary(setId, issues);
  const summaryDir = path.join(cwd, '.planning', 'post-merge', setId);
  fs.mkdirSync(summaryDir, { recursive: true });
  const summaryPath = path.join(summaryDir, 'REVIEW-SUMMARY.md');
  fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
  return summaryPath;
}

// ────────────────────────────────────────────────────────────────
// Concern-Based Scoping
// ────────────────────────────────────────────────────────────────

/**
 * Compute normalized Levenshtein similarity between two strings.
 * Returns value between 0 (completely different) and 1 (identical).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Similarity score 0-1
 */
function normalizedLevenshtein(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return 1 - matrix[a.length][b.length] / maxLen;
}

/**
 * Group files by concern using scoper output, with cross-cutting files
 * included in ALL groups. Falls back to directory chunking if cross-cutting
 * files exceed 50% of total.
 *
 * @param {Object} scoperOutput - Parsed scoper RAPID:RETURN data
 * @param {string[]} allFiles - Full file list from review scope
 * @returns {{ concernGroups: Array<{concern: string, files: string[]}>, fallback: boolean, warning?: string }}
 */
function scopeByConcern(scoperOutput, allFiles) {
  const { concerns, crossCutting } = scoperOutput;
  const crossCuttingFiles = crossCutting.map(c => c.file);

  // Fallback check: >50% cross-cutting
  if (crossCuttingFiles.length > allFiles.length * 0.5) {
    return {
      concernGroups: [],
      fallback: true,
      warning: `Cross-cutting files (${crossCuttingFiles.length}/${allFiles.length}) exceed 50% threshold. Falling back to directory chunking.`,
    };
  }

  // Build concern groups with cross-cutting files included in each
  const concernGroups = concerns.map(c => ({
    concern: c.name,
    files: [...c.files, ...crossCuttingFiles],
  }));

  return { concernGroups, fallback: false };
}

/**
 * Deduplicate findings from multiple concern-scoped hunters.
 * Same file + similar description (>= 0.7 normalized Levenshtein) = duplicate.
 * Higher severity wins; equal severity keeps more detailed evidence.
 *
 * @param {Array<Object>} findings - Merged findings from all hunters
 * @returns {Array<Object>} Deduplicated findings with concern tags preserved
 */
function deduplicateFindings(findings) {
  if (findings.length === 0) return [];

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  const dominated = new Set();

  for (let i = 0; i < findings.length; i++) {
    if (dominated.has(i)) continue;
    for (let j = i + 1; j < findings.length; j++) {
      if (dominated.has(j)) continue;
      if (findings[i].file !== findings[j].file) continue;

      const sim = normalizedLevenshtein(findings[i].description, findings[j].description);
      if (sim < 0.7) continue;

      // Duplicate detected -- keep higher severity (or longer evidence)
      const ri = severityRank[findings[i].severity] || 0;
      const rj = severityRank[findings[j].severity] || 0;

      if (ri > rj) {
        dominated.add(j);
      } else if (rj > ri) {
        dominated.add(i);
      } else {
        // Equal severity -- keep longer evidence/codeSnippet
        const ei = (findings[i].evidence || findings[i].codeSnippet || '').length;
        const ej = (findings[j].evidence || findings[j].codeSnippet || '').length;
        dominated.add(ei >= ej ? j : i);
      }
    }
  }

  return findings.filter((_, idx) => !dominated.has(idx));
}

// ────────────────────────────────────────────────────────────────
// REVIEW-SCOPE.md Serialization / Parsing
// ────────────────────────────────────────────────────────────────

/**
 * Serialize review scope data into a structured REVIEW-SCOPE.md markdown string.
 *
 * @param {Object} scopeData
 * @param {string} scopeData.setId
 * @param {string} scopeData.date - ISO timestamp
 * @param {boolean} scopeData.postMerge
 * @param {string} scopeData.worktreePath
 * @param {string[]} scopeData.changedFiles
 * @param {string[]} scopeData.dependentFiles
 * @param {number} scopeData.totalFiles
 * @param {Array<{dir: string, files: string[]}>} scopeData.chunks
 * @param {Object<string, string>} scopeData.waveAttribution
 * @param {Object|null} scopeData.concernScoping
 * @param {boolean} scopeData.useConcernScoping
 * @param {string|null} scopeData.fallbackWarning
 * @param {string[]} scopeData.acceptanceCriteria
 * @returns {string} Markdown content
 */
function serializeReviewScope(scopeData) {
  const lines = [];

  // Title
  lines.push(`# REVIEW-SCOPE: ${scopeData.setId}`);
  lines.push('');

  // Machine-readable metadata block
  const meta = {
    setId: scopeData.setId,
    date: scopeData.date,
    postMerge: scopeData.postMerge,
    worktreePath: scopeData.worktreePath,
    totalFiles: scopeData.totalFiles,
    useConcernScoping: scopeData.useConcernScoping,
  };
  lines.push(`<!-- SCOPE-META ${JSON.stringify(meta)} -->`);
  lines.push('');

  // Set Metadata table
  lines.push('## Set Metadata');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Set ID | ${scopeData.setId} |`);
  lines.push(`| Date | ${scopeData.date} |`);
  lines.push(`| Post-Merge | ${scopeData.postMerge} |`);
  lines.push(`| Worktree Path | ${scopeData.worktreePath} |`);
  lines.push(`| Total Files | ${scopeData.totalFiles} |`);
  lines.push(`| Concern Scoping | ${scopeData.useConcernScoping} |`);
  lines.push('');

  // Changed Files table
  lines.push('## Changed Files');
  lines.push('');
  lines.push('| File | Wave Attribution |');
  lines.push('|------|-----------------|');
  for (const file of scopeData.changedFiles) {
    const wave = (scopeData.waveAttribution && scopeData.waveAttribution[file]) || 'unattributed';
    lines.push(`| \`${file}\` | ${wave} |`);
  }
  lines.push('');

  // Dependent Files table
  lines.push('## Dependent Files');
  lines.push('');
  if (scopeData.dependentFiles.length === 0) {
    lines.push('No dependent files detected.');
  } else {
    lines.push('| File |');
    lines.push('|------|');
    for (const file of scopeData.dependentFiles) {
      lines.push(`| \`${file}\` |`);
    }
  }
  lines.push('');

  // Directory Chunks
  lines.push('## Directory Chunks');
  lines.push('');
  for (let i = 0; i < scopeData.chunks.length; i++) {
    const chunk = scopeData.chunks[i];
    lines.push(`### Chunk ${i + 1}: ${chunk.dir}`);
    lines.push('');
    for (const file of chunk.files) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  // Wave Attribution table
  lines.push('## Wave Attribution');
  lines.push('');
  const attribution = scopeData.waveAttribution || {};
  const attrEntries = Object.entries(attribution);
  if (attrEntries.length === 0) {
    lines.push('No wave attribution available.');
  } else {
    lines.push('| File | Wave |');
    lines.push('|------|------|');
    for (const [file, wave] of attrEntries) {
      lines.push(`| \`${file}\` | ${wave} |`);
    }
  }
  lines.push('');

  // Concern Scoping
  lines.push('## Concern Scoping');
  lines.push('');
  if (scopeData.fallbackWarning) {
    lines.push(`> **Warning:** ${scopeData.fallbackWarning}`);
    lines.push('');
  }
  if (!scopeData.concernScoping) {
    lines.push('Concern scoping was not performed.');
  } else {
    const cs = scopeData.concernScoping;
    if (cs.concerns && cs.concerns.length > 0) {
      for (const concern of cs.concerns) {
        lines.push(`### ${concern.name}`);
        lines.push('');
        for (const file of concern.files) {
          lines.push(`- \`${file}\``);
        }
        lines.push('');
      }
    }
    if (cs.crossCutting && cs.crossCutting.length > 0) {
      lines.push('### Cross-Cutting Files');
      lines.push('');
      for (const cc of cs.crossCutting) {
        lines.push(`- \`${cc.file}\`: ${cc.rationale}`);
      }
      lines.push('');
    }
  }
  lines.push('');

  // Acceptance Criteria
  lines.push('## Acceptance Criteria');
  lines.push('');
  if (scopeData.acceptanceCriteria.length === 0) {
    lines.push('No acceptance criteria found.');
  } else {
    for (let i = 0; i < scopeData.acceptanceCriteria.length; i++) {
      lines.push(`${i + 1}. ${scopeData.acceptanceCriteria[i]}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Parse a REVIEW-SCOPE.md markdown string to extract the SCOPE-META JSON block.
 *
 * @param {string} markdown - The REVIEW-SCOPE.md content
 * @returns {Object} Parsed SCOPE-META JSON object
 * @throws {Error} If SCOPE-META marker is missing or JSON is malformed
 */
function parseReviewScope(markdown) {
  const marker = '<!-- SCOPE-META';
  const startIdx = markdown.indexOf(marker);
  if (startIdx === -1) {
    throw new Error('SCOPE-META marker not found in REVIEW-SCOPE.md');
  }

  const jsonStart = startIdx + marker.length;
  const endIdx = markdown.indexOf('-->', jsonStart);
  if (endIdx === -1) {
    throw new Error('SCOPE-META closing marker (-->) not found');
  }

  const jsonStr = markdown.substring(jsonStart, endIdx).trim();
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Failed to parse SCOPE-META JSON: ${err.message}`);
  }
}

// ────────────────────────────────────────────────────────────────
// Acceptance Criteria Extraction
// ────────────────────────────────────────────────────────────────

/**
 * Extract acceptance criteria from all wave-*-PLAN.md files for a set.
 * Reads each plan file, extracts content under "## Success Criteria" or
 * "## Acceptance Criteria" headings, parses bullet points, and prefixes
 * each with the wave identifier for traceability.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {string[]} Flat array of acceptance criteria prefixed with [waveId]
 */
function extractAcceptanceCriteria(cwd, setId) {
  const criteria = [];
  const setDir = path.join(cwd, '.planning', 'sets', setId);

  if (!fs.existsSync(setDir)) return criteria;

  let entries;
  try {
    entries = fs.readdirSync(setDir)
      .filter(f => /^wave-.*-PLAN\.md$/.test(f))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return criteria;
  }

  for (const planFile of entries) {
    const waveId = planFile.replace(/-PLAN\.md$/, '');

    try {
      const content = fs.readFileSync(path.join(setDir, planFile), 'utf-8');

      // Find "## Success Criteria" or "## Acceptance Criteria" section
      const sectionRegex = /^##\s+(?:Success|Acceptance)\s+Criteria\s*$/m;
      const sectionMatch = sectionRegex.exec(content);
      if (!sectionMatch) continue;

      // Extract content from section start to next ## heading or EOF
      const sectionStart = sectionMatch.index + sectionMatch[0].length;
      const nextHeadingMatch = content.substring(sectionStart).match(/^## /m);
      const sectionEnd = nextHeadingMatch
        ? sectionStart + nextHeadingMatch.index
        : content.length;

      const sectionContent = content.substring(sectionStart, sectionEnd);

      // Parse bullet points (lines starting with "- ")
      const bulletLines = sectionContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- '));

      for (const bullet of bulletLines) {
        const text = bullet.substring(2).trim();
        if (text) {
          criteria.push(`[${waveId}] ${text}`);
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return criteria;
}

// ────────────────────────────────────────────────────────────────
// Review State I/O
// ────────────────────────────────────────────────────────────────

/**
 * Read REVIEW-STATE.json for a set. Returns null if missing or invalid.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {Object|null}
 */
function readReviewState(cwd, setId) {
  const statePath = path.join(cwd, '.planning', 'sets', setId, 'REVIEW-STATE.json');
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    return ReviewStateSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Write REVIEW-STATE.json for a set with atomic temp-file-then-rename.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Object} state - ReviewState object to write
 */
function writeReviewState(cwd, setId, state) {
  const validated = ReviewStateSchema.parse(state);
  const setDir = path.join(cwd, '.planning', 'sets', setId);
  fs.mkdirSync(setDir, { recursive: true });
  const statePath = path.join(setDir, 'REVIEW-STATE.json');
  const tmpPath = statePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(validated, null, 2), 'utf-8');
  fs.renameSync(tmpPath, statePath);
}

/**
 * Check that prerequisites for a review stage are satisfied.
 * Throws with a descriptive error if not.
 *
 * @param {Object} state - Current ReviewState object (never null)
 * @param {string} stage - Stage name to check prerequisites for
 */
function checkStagePrerequisites(state, stage) {
  const scopeDone = state.stages.scope && state.stages.scope.completed;
  const unitTestDone = state.stages['unit-test'] && state.stages['unit-test'].completed;

  if (stage === 'scope') {
    // No prerequisites
    return;
  }

  if (stage === 'unit-test') {
    if (!scopeDone) {
      throw new Error('Cannot run unit-test: scope stage has not been completed. Run /rapid:review <set-id> first.');
    }
    return;
  }

  if (stage === 'bug-hunt') {
    if (!scopeDone) {
      throw new Error('Cannot run bug-hunt: scope stage has not been completed. Run /rapid:review <set-id> first.');
    }
    return;
  }

  if (stage === 'uat') {
    if (!scopeDone) {
      throw new Error('Cannot run uat: scope stage has not been completed. Run /rapid:review <set-id> first.');
    }
    if (!unitTestDone) {
      throw new Error('Cannot run uat: unit-test stage has not been completed. Run /rapid:unit-test <set-id> first.');
    }
    return;
  }
}

/**
 * Mark a review stage as complete with a verdict.
 * Creates state from scratch if no REVIEW-STATE.json exists.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {string} stage - One of REVIEW_STAGES
 * @param {string} verdict - One of 'pass', 'fail', 'partial'
 * @returns {Object} The updated ReviewState
 */
function markStageComplete(cwd, setId, stage, verdict) {
  if (!REVIEW_STAGES.includes(stage)) {
    throw new Error(`Invalid stage "${stage}". Must be one of: ${REVIEW_STAGES.join(', ')}`);
  }
  if (!['pass', 'fail', 'partial'].includes(verdict)) {
    throw new Error(`Invalid verdict "${verdict}". Must be one of: pass, fail, partial`);
  }

  let state = readReviewState(cwd, setId);
  if (!state) {
    state = { setId, stages: {}, lastUpdatedAt: new Date().toISOString() };
  }

  checkStagePrerequisites(state, stage);

  state.stages[stage] = { completed: true, verdict };
  state.lastUpdatedAt = new Date().toISOString();
  writeReviewState(cwd, setId, state);
  return state;
}

// ────────────────────────────────────────────────────────────────
// Module Exports
// ────────────────────────────────────────────────────────────────

module.exports = {
  // Schemas
  ReviewIssue,
  ReviewIssues,
  ScoperOutput,

  // Scoping
  scopeSetForReview,
  scopeSetPostMerge,
  findDependents,

  // Concern-based scoping
  scopeByConcern,
  deduplicateFindings,
  normalizedLevenshtein,

  // Chunking
  chunkByDirectory,

  // Wave attribution
  buildWaveAttribution,

  // Review scope serialization/parsing
  serializeReviewScope,
  parseReviewScope,

  // Acceptance criteria
  extractAcceptanceCriteria,

  // Issue management
  logIssue,
  loadSetIssues,
  updateIssueStatus,

  // Summary
  generateReviewSummary,

  // Post-merge review
  logIssuePostMerge,
  loadPostMergeIssues,
  generatePostMergeReviewSummary,

  // Constants
  REVIEW_CONSTANTS,

  // Review state
  ReviewStageSchema,
  ReviewStateSchema,
  REVIEW_STAGES,
  readReviewState,
  writeReviewState,
  markStageComplete,
  checkStagePrerequisites,
};
