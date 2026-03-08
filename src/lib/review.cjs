'use strict';

/**
 * review.cjs - Review library for RAPID review pipeline.
 *
 * Provides Zod-validated schemas, wave-scoped file discovery,
 * structured issue logging, bugfix iteration tracking, and
 * review summary generation.
 *
 * Depends on:
 *   - execute.cjs: getChangedFiles
 */

const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const execute = require('./execute.cjs');

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const REVIEW_CONSTANTS = {
  MAX_BUGFIX_CYCLES: 3,
  ISSUE_TYPES: ['artifact', 'static', 'contract', 'test', 'bug', 'uat'],
  SEVERITY_LEVELS: ['critical', 'high', 'medium', 'low'],
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
  createdAt: z.string(),
  fixedAt: z.string().optional(),
});

const ReviewIssues = z.object({
  waveId: z.string(),
  setId: z.string(),
  issues: z.array(ReviewIssue),
  lastUpdatedAt: z.string(),
});

// ────────────────────────────────────────────────────────────────
// Scoping Functions
// ────────────────────────────────────────────────────────────────

/**
 * Compute review scope for a wave: changed files + one-hop dependents.
 *
 * @param {string} cwd - Project root directory
 * @param {string} worktreePath - Absolute path to the worktree
 * @param {string} baseBranch - Base branch name (e.g., 'main')
 * @returns {{ changedFiles: string[], dependentFiles: string[], totalFiles: number }}
 */
function scopeWaveForReview(cwd, worktreePath, baseBranch) {
  const changedFiles = execute.getChangedFiles(worktreePath, baseBranch);
  const dependentFiles = findDependents(cwd, changedFiles);
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

  // Build patterns to search for: basename without extension, relative paths
  const searchPatterns = [];
  for (const filePath of changedFiles) {
    const basename = path.basename(filePath);
    const basenameNoExt = path.basename(filePath, path.extname(filePath));
    // Match require('./utils.cjs'), require('./utils'), import from './utils'
    searchPatterns.push(basename);
    searchPatterns.push(basenameNoExt);
    // Also match the relative path patterns
    searchPatterns.push(filePath);
  }

  // Recursively walk project files
  const allFiles = walkDir(cwd, ['node_modules', '.git', '.planning', '.worktrees']);

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
// Issue Management
// ────────────────────────────────────────────────────────────────

/**
 * Log a review issue to REVIEW-ISSUES.json for a wave.
 * Creates the file and directories if they don't exist.
 * Validates the issue with Zod before persisting.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {string} waveId - Wave identifier
 * @param {Object} issue - Issue data to log
 */
function logIssue(cwd, setId, waveId, issue) {
  const waveDir = path.join(cwd, '.planning', 'waves', setId, waveId);
  const issuesPath = path.join(waveDir, 'REVIEW-ISSUES.json');

  // Validate issue with Zod
  const validatedIssue = ReviewIssue.parse(issue);

  // Create directory if needed
  fs.mkdirSync(waveDir, { recursive: true });

  // Read existing or create new container
  let existing = { waveId, setId, issues: [], lastUpdatedAt: '' };
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
 * Load all issues across waves for a set.
 * Returns a flat array with waveId attached to each issue.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {Array<Object>} Flat array of issues with waveId property
 */
function loadSetIssues(cwd, setId) {
  const wavesDir = path.join(cwd, '.planning', 'waves', setId);
  const issues = [];

  if (!fs.existsSync(wavesDir)) return issues;

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
        issues.push(...data.issues.map(i => ({ ...i, waveId: entry.name })));
      } catch {
        // Skip malformed files
      }
    }
  }

  return issues;
}

/**
 * Update the status of a specific issue in a wave's REVIEW-ISSUES.json.
 * If newStatus is 'fixed', sets fixedAt to current ISO timestamp.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {string} waveId - Wave identifier
 * @param {string} issueId - Issue ID to update
 * @param {string} newStatus - New status ('open', 'fixed', 'deferred', 'dismissed')
 */
function updateIssueStatus(cwd, setId, waveId, issueId, newStatus) {
  const issuesPath = path.join(cwd, '.planning', 'waves', setId, waveId, 'REVIEW-ISSUES.json');

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
 * Includes overview with total issues by severity, per-wave breakdown,
 * issues by status, and deferred count warning if >5.
 *
 * @param {string} setId - Set identifier
 * @param {Array<Object>} issues - Flat array of issues (with waveId attached)
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

  // Per-wave breakdown
  const waveIds = [...new Set(issues.map(i => i.waveId).filter(Boolean))].sort();
  if (waveIds.length > 0) {
    lines.push('## Per-Wave Breakdown');
    lines.push('');
    for (const waveId of waveIds) {
      const waveIssues = issues.filter(i => i.waveId === waveId);
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
// Module Exports
// ────────────────────────────────────────────────────────────────

module.exports = {
  // Schemas
  ReviewIssue,
  ReviewIssues,

  // Scoping
  scopeWaveForReview,
  findDependents,

  // Issue management
  logIssue,
  loadSetIssues,
  updateIssueStatus,

  // Summary
  generateReviewSummary,

  // Constants
  REVIEW_CONSTANTS,
};
