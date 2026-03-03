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
 * Generate a Markdown verification report from results.
 *
 * @param {{ passed: Array, failed: Array }} results - Verification results
 * @param {'light'|'heavy'} tier - Verification tier
 * @returns {string} Markdown report content
 */
function generateVerificationReport(results, tier) {
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

  return lines.join('\n');
}

module.exports = { verifyLight, verifyHeavy, generateVerificationReport };
