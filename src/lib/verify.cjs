'use strict';

/**
 * verify.cjs - Filesystem verification utilities for tiered checking.
 *
 * Provides lightweight verification (file existence + git commit hashes)
 * and heavyweight verification (tests + substantive content checks).
 * Agent completion is verified by checking filesystem artifacts --
 * separate verifier, never self-grading.
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Lightweight verification: check file existence and git commit hashes.
 *
 * @param {string[]} artifacts - File paths to check for existence
 * @param {string[]} commits - Git commit hashes to verify
 * @returns {{ passed: Array<{type: string, target: string}>, failed: Array<{type: string, target: string}> }}
 */
function verifyLight(artifacts, commits) {
  const results = { passed: [], failed: [] };

  // Check file existence
  for (const artifact of artifacts) {
    if (fs.existsSync(artifact)) {
      results.passed.push({ type: 'file_exists', target: artifact });
    } else {
      results.failed.push({ type: 'file_missing', target: artifact });
    }
  }

  // Check git commit hashes
  for (const hash of commits) {
    try {
      execSync(`git cat-file -t ${hash}`, { stdio: 'pipe' });
      results.passed.push({ type: 'commit_exists', target: hash });
    } catch (err) {
      results.failed.push({ type: 'commit_missing', target: hash });
    }
  }

  return results;
}

/**
 * Heavyweight verification: all lightweight checks PLUS test execution
 * and substantive content checks.
 *
 * @param {string[]} artifacts - File paths to check
 * @param {string|null} testCommand - Shell command to run tests (or null to skip)
 * @returns {{ passed: Array<{type: string, target: string}>, failed: Array<{type: string, target: string, error?: string}> }}
 */
function verifyHeavy(artifacts, testCommand) {
  // Start with lightweight file checks (no commits for heavy)
  const results = verifyLight(artifacts, []);

  // Run test command if provided
  if (testCommand) {
    try {
      execSync(testCommand, { stdio: 'pipe', timeout: 60000 });
      results.passed.push({ type: 'tests_pass', target: testCommand });
    } catch (err) {
      const errorMsg = err.stderr ? err.stderr.toString() : err.message;
      results.failed.push({ type: 'tests_fail', target: testCommand, error: errorMsg });
    }
  }

  // Check substantive content for each existing artifact
  for (const artifact of artifacts) {
    if (!fs.existsSync(artifact)) {
      // Already captured as file_missing by verifyLight
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(artifact, 'utf-8');
    } catch (err) {
      // Can't read file -- skip content check
      continue;
    }

    const isStub = content.length < 50
      || content.includes('TODO')
      || content.includes('placeholder');

    if (isStub) {
      results.failed.push({ type: 'stub_content', target: artifact });
    } else {
      results.passed.push({ type: 'content_substantive', target: artifact });
    }
  }

  return results;
}

/**
 * Parse encoded criteria from REQUIREMENTS.md.
 *
 * Looks for lines matching: - [ ] CATEGORY-NNN: description
 * or: - [x] CATEGORY-NNN: description
 *
 * @param {string} requirementsPath - Absolute path to REQUIREMENTS.md
 * @returns {{ criteria: Array<{id: string, description: string, checked: boolean}>, warning: string|null }}
 */
function parseCriteriaFromRequirements(requirementsPath) {
  if (!fs.existsSync(requirementsPath)) {
    return { criteria: [], warning: 'REQUIREMENTS.md not found' };
  }

  let content;
  try {
    content = fs.readFileSync(requirementsPath, 'utf-8');
  } catch (err) {
    return { criteria: [], warning: 'REQUIREMENTS.md not found' };
  }

  const criteria = [];
  const pattern = /^- \[( |x)\] ([A-Z]+-\d{3}): (.+)$/gm;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    criteria.push({
      id: match[2],
      description: match[3],
      checked: match[1] === 'x',
    });
  }

  if (criteria.length === 0 && content.length > 50) {
    return { criteria: [], warning: 'No encoded criteria found. Consider re-running /rapid:init to generate encoded criteria with CATEGORY-NNN format.' };
  }

  if (criteria.length === 0) {
    return { criteria: [], warning: null };
  }

  return { criteria, warning: null };
}

/**
 * Generate a Markdown criteria coverage report by cross-referencing
 * encoded criteria from REQUIREMENTS.md against plan files.
 *
 * @param {string} requirementsPath - Absolute path to REQUIREMENTS.md
 * @param {string[]} [planPaths] - Array of absolute paths to PLAN.md files
 * @returns {string} Markdown section starting with ## Criteria Coverage
 */
function generateCriteriaCoverageReport(requirementsPath, planPaths) {
  const { criteria, warning } = parseCriteriaFromRequirements(requirementsPath);
  const plans = Array.isArray(planPaths) ? planPaths : [];

  if (warning) {
    return `## Criteria Coverage\n\n> ${warning}\n`;
  }

  if (criteria.length === 0) {
    return '## Criteria Coverage\n\nNo criteria found.\n';
  }

  // Read plan file contents (skip missing files silently)
  const planContents = [];
  for (const planPath of plans) {
    try {
      if (fs.existsSync(planPath)) {
        const text = fs.readFileSync(planPath, 'utf-8');
        planContents.push({ name: path.basename(planPath), text });
      }
    } catch (err) {
      // skip missing/unreadable files
    }
  }

  // Check coverage for each criterion
  const rows = [];
  const uncovered = [];
  let coveredCount = 0;

  for (const criterion of criteria) {
    const matchingPlans = [];
    for (const plan of planContents) {
      if (plan.text.includes(criterion.id)) {
        matchingPlans.push(plan.name);
      }
    }
    const isCovered = matchingPlans.length > 0;
    if (isCovered) coveredCount++;
    rows.push({
      id: criterion.id,
      description: criterion.description,
      covered: isCovered ? 'Yes' : 'No',
      plans: isCovered ? matchingPlans.join(', ') : '-',
    });
    if (!isCovered) {
      uncovered.push(criterion);
    }
  }

  const total = criteria.length;
  const pct = Math.round((coveredCount / total) * 100);

  const lines = [];
  lines.push('## Criteria Coverage');
  lines.push('');
  lines.push('| ID | Description | Covered | Plan(s) |');
  lines.push('|----|-------------|---------|---------|');
  for (const row of rows) {
    lines.push(`| ${row.id} | ${row.description} | ${row.covered} | ${row.plans} |`);
  }
  lines.push('');
  lines.push(`**Coverage:** ${coveredCount}/${total} (${pct}%)`);

  if (uncovered.length > 0) {
    lines.push('');
    lines.push('### Uncovered Criteria');
    for (const c of uncovered) {
      lines.push(`- ${c.id}: ${c.description}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate a Markdown verification report from results.
 *
 * @param {{ passed: Array, failed: Array }} results - Verification results
 * @param {'light'|'heavy'} tier - Verification tier
 * @returns {string} Markdown report content
 */
function generateVerificationReport(results, tier, options = {}) {
  const passCount = results.passed.length;
  const failCount = results.failed.length;
  const timestamp = new Date().toISOString();
  const overallResult = failCount === 0 ? 'PASS' : 'FAIL';

  const lines = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`pass_count: ${passCount}`);
  lines.push(`fail_count: ${failCount}`);
  lines.push(`tier: ${tier}`);
  lines.push(`timestamp: ${timestamp}`);
  lines.push('---');
  lines.push('');
  lines.push('# Verification Report');
  lines.push('');

  // Passed section
  lines.push('## Passed');
  lines.push('');
  if (passCount > 0) {
    lines.push('| Type | Target | Notes |');
    lines.push('|------|--------|-------|');
    for (const check of results.passed) {
      lines.push(`| ${check.type} | ${check.target} | ${check.error || ''} |`);
    }
  } else {
    lines.push('No checks passed.');
  }
  lines.push('');

  // Failed section
  lines.push('## Failed');
  lines.push('');
  if (failCount > 0) {
    lines.push('| Type | Target | Error |');
    lines.push('|------|--------|-------|');
    for (const check of results.failed) {
      lines.push(`| ${check.type} | ${check.target} | ${check.error || ''} |`);
    }
  } else {
    lines.push('No checks failed.');
  }
  lines.push('');

  // Summary
  lines.push(`**Result:** ${overallResult}`);
  lines.push('');

  // Criteria coverage (optional)
  if (options.requirementsPath) {
    const coverageSection = generateCriteriaCoverageReport(options.requirementsPath, options.planPaths || []);
    lines.push(coverageSection);
  }

  return lines.join('\n');
}

module.exports = { verifyLight, verifyHeavy, generateVerificationReport, parseCriteriaFromRequirements, generateCriteriaCoverageReport };
