'use strict';

/**
 * merge.cjs - Merge pipeline library for RAPID set merging.
 *
 * Provides programmatic validation (contract + tests + ownership),
 * review prompt assembly, REVIEW.md writing/parsing, merge execution,
 * and integration test running. The /rapid:merge skill orchestrates
 * these functions into the full review-cleanup-merge pipeline.
 *
 * Depends on:
 *   - contract.cjs: compileContract, generateContractTest, checkOwnership
 *   - dag.cjs: getExecutionOrder for merge ordering
 *   - worktree.cjs: gitExec, loadRegistry, detectMainBranch
 *   - execute.cjs: getChangedFiles
 *   - plan.cjs: loadSet
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const contract = require('./contract.cjs');
const dag = require('./dag.cjs');
const worktree = require('./worktree.cjs');
const execute = require('./execute.cjs');
const plan = require('./plan.cjs');

// ────────────────────────────────────────────────────────────────
// Programmatic Validation Gate
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
      // Clean up temp test file
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
// Review Context Preparation
// ────────────────────────────────────────────────────────────────

/**
 * Prepare review context for a set, gathering all data needed for
 * reviewer prompt assembly.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @returns {{ changedFiles: string[], contractStr: string, ownershipData: Object|null, definition: string, setDir: string }}
 */
function prepareReviewContext(cwd, setName) {
  const setData = plan.loadSet(cwd, setName);
  const setDir = path.join(cwd, '.planning', 'sets', setName);

  // Get changed files from worktree (if available)
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

  // Load ownership data
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
// Reviewer Prompt Assembly
// ────────────────────────────────────────────────────────────────

/**
 * Assemble a prompt string for the reviewer agent.
 *
 * Follows the assembleExecutorPrompt pattern from execute.cjs.
 * Includes changed files, contract JSON, programmatic validation
 * results, and review instructions.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @param {{ contractValid: boolean, testsPass: boolean, ownershipViolations: Array }} programmaticResults - Results from runProgrammaticGate
 * @returns {string} Assembled prompt string
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
// REVIEW.md Writing and Parsing
// ────────────────────────────────────────────────────────────────

/**
 * Write REVIEW.md to a set directory with structured review data.
 *
 * Produces a Markdown file with:
 * - Heading with set name
 * - ISO timestamp and verdict line
 * - Machine-parseable HTML comment: <!-- VERDICT:{verdict} -->
 * - Sections: Contract Validation, Ownership Check, Test Results, Findings
 *
 * @param {string} setDir - Path to the set directory (e.g., .planning/sets/{name})
 * @param {{ setName: string, verdict: string, contractResults: Object, ownershipResults: Object, testResults: Object, findings: { blocking: string[], fixable: string[], suggestions: string[] } }} reviewData
 */
function writeReviewMd(setDir, reviewData) {
  const timestamp = new Date().toISOString();
  const lines = [];

  // Header
  lines.push(`# Review: ${reviewData.setName}`);
  lines.push('');
  lines.push(`**Reviewed:** ${timestamp}`);
  lines.push(`**Verdict:** ${reviewData.verdict}`);
  lines.push(`<!-- VERDICT:${reviewData.verdict} -->`);
  lines.push('');

  // Contract Validation
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

  // Ownership Check
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

  // Test Results
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

  // Findings
  lines.push('## Findings');
  lines.push('');

  // Blocking
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

  // Fixable
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

  // Suggestions
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
 * Extracts the verdict from the HTML comment marker:
 * <!-- VERDICT:APPROVE --> or <!-- VERDICT:CHANGES --> or <!-- VERDICT:BLOCK -->
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
// Merge Ordering
// ────────────────────────────────────────────────────────────────

/**
 * Get the merge order as wave-grouped arrays from the DAG.
 *
 * Reads DAG.json and delegates to dag.getExecutionOrder() for
 * dependency-ordered wave grouping.
 *
 * @param {string} cwd - Project root directory
 * @returns {string[][]} Array of arrays, each inner array contains set names that can run in parallel within that wave
 */
function getMergeOrder(cwd) {
  const dagPath = path.join(cwd, '.planning', 'sets', 'DAG.json');
  const dagJson = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
  return dag.getExecutionOrder(dagJson);
}

// ────────────────────────────────────────────────────────────────
// Merge Execution
// ────────────────────────────────────────────────────────────────

/**
 * Merge a set's branch into the base branch using --no-ff.
 *
 * Checks out the base branch, then merges the set's branch with a
 * merge commit. On conflict, aborts the merge and returns structured
 * error information.
 *
 * @param {string} projectRoot - Project root directory (git repo)
 * @param {string} setName - Name of the set to merge
 * @param {string} baseBranch - Base branch to merge into (e.g., 'main')
 * @returns {{ merged: true, branch: string, commitHash: string } | { merged: false, reason: string, detail: string }}
 */
function mergeSet(projectRoot, setName, baseBranch) {
  // Checkout base branch
  const checkoutResult = worktree.gitExec(['checkout', baseBranch], projectRoot);
  if (!checkoutResult.ok) {
    return {
      merged: false,
      reason: 'checkout_failed',
      detail: checkoutResult.stderr || 'Failed to checkout base branch',
    };
  }

  // Merge with --no-ff to create merge commit
  // Use execSync directly instead of gitExec because git merge reports
  // conflict info to stdout (not stderr), and gitExec only captures stderr.
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
    // Check for merge conflict in both stdout and stderr
    // Git reports conflict info (CONFLICT, Automatic merge failed) to stdout
    const combinedOutput = mergeStdout + mergeStderr;
    if (combinedOutput.includes('CONFLICT') || combinedOutput.includes('Automatic merge failed')) {
      // Abort the failed merge
      worktree.gitExec(['merge', '--abort'], projectRoot);
      return { merged: false, reason: 'conflict', detail: combinedOutput.trim() };
    }
    return { merged: false, reason: 'error', detail: (mergeStderr || mergeStdout).trim() };
  }

  // Get the merge commit hash
  const headResult = worktree.gitExec(['rev-parse', 'HEAD'], projectRoot);
  const commitHash = headResult.ok ? headResult.stdout : '';

  return { merged: true, branch, commitHash };
}

// ────────────────────────────────────────────────────────────────
// Integration Tests
// ────────────────────────────────────────────────────────────────

/**
 * Run integration tests across all library test files on main.
 *
 * Executes `node --test src/lib/*.test.cjs` with a 30-second timeout.
 *
 * @param {string} projectRoot - Project root directory
 * @returns {{ passed: boolean, output: string }}
 */
function runIntegrationTests(projectRoot) {
  try {
    // Clear NODE_TEST_CONTEXT to prevent nested node --test processes
    // from inheriting the parent test runner's context, which causes
    // the child to silently swallow test failures.
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

module.exports = {
  runProgrammaticGate,
  prepareReviewContext,
  assembleReviewerPrompt,
  writeReviewMd,
  parseReviewVerdict,
  getMergeOrder,
  mergeSet,
  runIntegrationTests,
};
