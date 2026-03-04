'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ────────────────────────────────────────────────────────────────
// Helper: create a mock project directory with merge pipeline structure
// ────────────────────────────────────────────────────────────────
function createMockProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-'));

  // Create .planning/sets/
  const setsDir = path.join(tmpDir, '.planning', 'sets');
  fs.mkdirSync(setsDir, { recursive: true });

  // Create .planning/worktrees/
  const wtRegDir = path.join(tmpDir, '.planning', 'worktrees');
  fs.mkdirSync(wtRegDir, { recursive: true });

  // Create auth-core set
  const authDir = path.join(setsDir, 'auth-core');
  fs.mkdirSync(authDir, { recursive: true });

  fs.writeFileSync(path.join(authDir, 'DEFINITION.md'), [
    '# Set: auth-core',
    '',
    '## Scope',
    'Authentication and token management',
    '',
    '## File Ownership',
    'Files this set owns (exclusive write access):',
    '- src/auth/token.cjs',
    '- src/auth/verify.cjs',
    '',
    '## Tasks',
    '1. Implement token generation',
    '   - Acceptance: Token can be created and verified',
    '',
    '## Interface Contract',
    'See: CONTRACT.json (adjacent file)',
    '',
    '## Wave Assignment',
    'Wave: 1 (parallel with: none)',
    '',
    '## Acceptance Criteria',
    '- Tokens can be generated and verified',
    '',
  ].join('\n'), 'utf-8');

  fs.writeFileSync(path.join(authDir, 'CONTRACT.json'), JSON.stringify({
    exports: {
      functions: [
        { name: 'createToken', file: 'src/auth/token.cjs', params: [{ name: 'payload', type: 'object' }], returns: 'string' },
        { name: 'verifyToken', file: 'src/auth/verify.cjs', params: [{ name: 'token', type: 'string' }], returns: 'object' },
      ],
      types: [],
    },
  }, null, 2), 'utf-8');

  // Create api-routes set (wave 2, depends on auth-core)
  const apiDir = path.join(setsDir, 'api-routes');
  fs.mkdirSync(apiDir, { recursive: true });

  fs.writeFileSync(path.join(apiDir, 'DEFINITION.md'), [
    '# Set: api-routes',
    '',
    '## Scope',
    'API route handlers',
    '',
    '## File Ownership',
    'Files this set owns (exclusive write access):',
    '- src/routes/index.cjs',
    '',
    '## Tasks',
    '1. Implement routes',
    '',
    '## Interface Contract',
    'See: CONTRACT.json (adjacent file)',
    '',
    '## Wave Assignment',
    'Wave: 2 (parallel with: none)',
    '',
    '## Acceptance Criteria',
    '- Routes serve requests',
    '',
  ].join('\n'), 'utf-8');

  fs.writeFileSync(path.join(apiDir, 'CONTRACT.json'), JSON.stringify({
    exports: {
      functions: [
        { name: 'setupRoutes', file: 'src/routes/index.cjs', params: [{ name: 'app', type: 'object' }], returns: 'void' },
      ],
      types: [],
    },
    imports: {
      fromSets: [{ set: 'auth-core', functions: ['verifyToken'] }],
    },
  }, null, 2), 'utf-8');

  // Create OWNERSHIP.json
  fs.writeFileSync(path.join(setsDir, 'OWNERSHIP.json'), JSON.stringify({
    version: 1,
    ownership: {
      'src/auth/token.cjs': 'auth-core',
      'src/auth/verify.cjs': 'auth-core',
      'src/routes/index.cjs': 'api-routes',
    },
  }, null, 2), 'utf-8');

  // Create DAG.json
  fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify({
    nodes: [
      { id: 'auth-core', wave: 1, status: 'pending' },
      { id: 'api-routes', wave: 2, status: 'pending' },
    ],
    edges: [{ from: 'auth-core', to: 'api-routes' }],
    waves: {
      1: { sets: ['auth-core'], checkpoint: {} },
      2: { sets: ['api-routes'], checkpoint: {} },
    },
    metadata: { totalSets: 2, totalWaves: 2, maxParallelism: 1 },
  }, null, 2), 'utf-8');

  // Create REGISTRY.json
  fs.writeFileSync(path.join(wtRegDir, 'REGISTRY.json'), JSON.stringify({
    version: 1,
    worktrees: {},
  }, null, 2), 'utf-8');

  return tmpDir;
}

/**
 * Create a git repo with a set branch for merge testing.
 * Returns { projectRoot, worktreePath } where worktreePath is a simulated worktree.
 */
function createGitProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-git-'));

  // Init git repo
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

  // Create initial commit on main
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Project', 'utf-8');
  execSync('git add README.md', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'pipe' });
  try { execSync('git branch -m main', { cwd: tmpDir, stdio: 'pipe' }); } catch { /* ok */ }

  // Create a feature branch with commits
  execSync('git checkout -b rapid/auth-core', { cwd: tmpDir, stdio: 'pipe' });
  fs.mkdirSync(path.join(tmpDir, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'token.cjs'), '// token module\nmodule.exports = { createToken: () => "tok" };', 'utf-8');
  execSync('git add src/auth/token.cjs', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "feat(auth-core): add token module"', { cwd: tmpDir, stdio: 'pipe' });

  // Go back to main
  execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });

  return tmpDir;
}

// ────────────────────────────────────────────────────────────────
// writeReviewMd
// ────────────────────────────────────────────────────────────────
describe('writeReviewMd', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-review-'));
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes REVIEW.md with correct sections and verdict marker', () => {
    const merge = require('./merge.cjs');
    const reviewData = {
      setName: 'auth-core',
      verdict: 'APPROVE',
      contractResults: { valid: true, errors: [] },
      ownershipResults: { violations: [] },
      testResults: { passed: true, output: 'All tests pass' },
      findings: {
        blocking: [],
        fixable: [],
        suggestions: ['Consider adding JSDoc'],
      },
    };

    merge.writeReviewMd(tmpDir, reviewData);

    const content = fs.readFileSync(path.join(tmpDir, 'REVIEW.md'), 'utf-8');
    assert.ok(content.includes('# Review: auth-core'), 'should have heading with set name');
    assert.ok(content.includes('**Verdict:** APPROVE'), 'should have verdict line');
    assert.ok(content.includes('<!-- VERDICT:APPROVE -->'), 'should have machine-parseable verdict marker');
    assert.ok(content.includes('## Contract Validation'), 'should have contract section');
    assert.ok(content.includes('## Ownership Check'), 'should have ownership section');
    assert.ok(content.includes('## Test Results'), 'should have test results section');
    assert.ok(content.includes('## Findings'), 'should have findings section');
    assert.ok(content.includes('Consider adding JSDoc'), 'should include suggestion');
  });

  it('shows "None" for empty findings sections', () => {
    const merge = require('./merge.cjs');
    const reviewData = {
      setName: 'test-set',
      verdict: 'APPROVE',
      contractResults: { valid: true, errors: [] },
      ownershipResults: { violations: [] },
      testResults: { passed: true, output: '' },
      findings: { blocking: [], fixable: [], suggestions: [] },
    };

    merge.writeReviewMd(tmpDir, reviewData);

    const content = fs.readFileSync(path.join(tmpDir, 'REVIEW.md'), 'utf-8');
    // Each empty findings sub-section should show "None"
    assert.ok(content.includes('None'), 'should show None for empty findings');
  });

  it('includes blocking and fixable findings when present', () => {
    const merge = require('./merge.cjs');
    const reviewData = {
      setName: 'test-set',
      verdict: 'CHANGES',
      contractResults: { valid: true, errors: [] },
      ownershipResults: { violations: [{ file: 'x.cjs', owner: 'other-set', declared: false }] },
      testResults: { passed: false, output: 'Test failed' },
      findings: {
        blocking: ['Contract violation in token.cjs:42'],
        fixable: ['Missing JSDoc on createToken'],
        suggestions: [],
      },
    };

    merge.writeReviewMd(tmpDir, reviewData);

    const content = fs.readFileSync(path.join(tmpDir, 'REVIEW.md'), 'utf-8');
    assert.ok(content.includes('<!-- VERDICT:CHANGES -->'), 'should have CHANGES verdict');
    assert.ok(content.includes('Contract violation in token.cjs:42'), 'should include blocking finding');
    assert.ok(content.includes('Missing JSDoc on createToken'), 'should include fixable finding');
  });
});

// ────────────────────────────────────────────────────────────────
// parseReviewVerdict
// ────────────────────────────────────────────────────────────────
describe('parseReviewVerdict', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-verdict-'));
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts APPROVE verdict from REVIEW.md', () => {
    const merge = require('./merge.cjs');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW.md'), [
      '# Review: auth-core',
      '<!-- VERDICT:APPROVE -->',
      'Some review content',
    ].join('\n'), 'utf-8');

    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, true, 'should find verdict');
    assert.equal(result.verdict, 'APPROVE', 'should extract APPROVE');
  });

  it('extracts CHANGES verdict from REVIEW.md', () => {
    const merge = require('./merge.cjs');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW.md'), [
      '# Review: test-set',
      '**Verdict:** CHANGES',
      '<!-- VERDICT:CHANGES -->',
    ].join('\n'), 'utf-8');

    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, true, 'should find verdict');
    assert.equal(result.verdict, 'CHANGES', 'should extract CHANGES');
  });

  it('extracts BLOCK verdict from REVIEW.md', () => {
    const merge = require('./merge.cjs');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW.md'), [
      '# Review: blocked-set',
      '<!-- VERDICT:BLOCK -->',
    ].join('\n'), 'utf-8');

    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, true, 'should find verdict');
    assert.equal(result.verdict, 'BLOCK', 'should extract BLOCK');
  });

  it('returns found=false when REVIEW.md is missing', () => {
    const merge = require('./merge.cjs');
    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, false, 'should not find verdict for missing file');
  });

  it('returns found=false for malformed REVIEW.md without verdict marker', () => {
    const merge = require('./merge.cjs');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW.md'), [
      '# Review: some-set',
      'No verdict marker here',
      'Just some text',
    ].join('\n'), 'utf-8');

    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, false, 'should not find verdict in malformed file');
  });
});

// ────────────────────────────────────────────────────────────────
// getMergeOrder
// ────────────────────────────────────────────────────────────────
describe('getMergeOrder', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns wave-grouped arrays from DAG', () => {
    const merge = require('./merge.cjs');
    const order = merge.getMergeOrder(tmpDir);

    assert.ok(Array.isArray(order), 'should return array');
    assert.equal(order.length, 2, 'should have 2 waves');
    assert.deepEqual(order[0], ['auth-core'], 'wave 1 should have auth-core');
    assert.deepEqual(order[1], ['api-routes'], 'wave 2 should have api-routes');
  });
});

// ────────────────────────────────────────────────────────────────
// mergeSet
// ────────────────────────────────────────────────────────────────
describe('mergeSet', { concurrency: 1 }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createGitProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('successfully merges a set branch with --no-ff', () => {
    const merge = require('./merge.cjs');
    const result = merge.mergeSet(tmpDir, 'auth-core', 'main');

    assert.equal(result.merged, true, 'should merge successfully');
    assert.equal(result.branch, 'rapid/auth-core', 'should return branch name');
    assert.ok(result.commitHash, 'should return commit hash');
    assert.ok(result.commitHash.length > 0, 'commit hash should not be empty');

    // Verify merge commit exists
    const logResult = execSync('git log --oneline -3', { cwd: tmpDir, encoding: 'utf-8' });
    assert.ok(logResult.includes('merge(auth-core)'), 'should have merge commit message');
  });

  it('returns failure on merge conflict', () => {
    const merge = require('./merge.cjs');

    // Create a conflict: modify same file on main
    fs.mkdirSync(path.join(tmpDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'token.cjs'), '// CONFLICTING content on main', 'utf-8');
    execSync('git add src/auth/token.cjs', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "conflict: modify token on main"', { cwd: tmpDir, stdio: 'pipe' });

    const result = merge.mergeSet(tmpDir, 'auth-core', 'main');

    assert.equal(result.merged, false, 'should not merge');
    assert.equal(result.reason, 'conflict', 'should report conflict reason');
    assert.ok(result.detail, 'should have detail string');
  });

  it('returns failure when checkout fails for nonexistent branch', () => {
    const merge = require('./merge.cjs');
    const result = merge.mergeSet(tmpDir, 'auth-core', 'nonexistent-branch');

    assert.equal(result.merged, false, 'should not merge');
    assert.equal(result.reason, 'checkout_failed', 'should report checkout_failed reason');
  });
});

// ────────────────────────────────────────────────────────────────
// assembleReviewerPrompt
// ────────────────────────────────────────────────────────────────
describe('assembleReviewerPrompt', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('includes changed files, contract, and programmatic results', () => {
    const merge = require('./merge.cjs');
    const programmaticResults = {
      contractValid: true,
      testsPass: true,
      ownershipViolations: [],
    };

    const prompt = merge.assembleReviewerPrompt(tmpDir, 'auth-core', programmaticResults);

    assert.ok(prompt.includes('Merge Review'), 'should have merge review heading');
    assert.ok(prompt.includes('auth-core'), 'should reference set name');
    assert.ok(prompt.includes('Contract'), 'should include contract section');
    assert.ok(prompt.includes('Programmatic Validation'), 'should include validation results');
    assert.ok(prompt.includes('PASS'), 'should show PASS for valid contract');
    assert.ok(prompt.includes('Review Instructions'), 'should include review instructions');
    assert.ok(prompt.includes('VERDICT'), 'should mention VERDICT marker in instructions');
  });

  it('shows FAIL for invalid contract in results', () => {
    const merge = require('./merge.cjs');
    const programmaticResults = {
      contractValid: false,
      testsPass: false,
      ownershipViolations: [{ file: 'x.cjs', owner: 'other', declared: false }],
    };

    const prompt = merge.assembleReviewerPrompt(tmpDir, 'auth-core', programmaticResults);

    assert.ok(prompt.includes('FAIL'), 'should show FAIL for invalid contract');
  });
});

// ────────────────────────────────────────────────────────────────
// runProgrammaticGate
// ────────────────────────────────────────────────────────────────
describe('runProgrammaticGate', { concurrency: 1 }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();

    // Create a git repo for the worktree
    const wtDir = path.join(tmpDir, '.rapid-worktrees', 'auth-core');
    fs.mkdirSync(path.join(wtDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(wtDir, 'src', 'auth', 'token.cjs'), [
      "'use strict';",
      "module.exports = { createToken: () => 'tok' };",
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(wtDir, 'src', 'auth', 'verify.cjs'), [
      "'use strict';",
      "module.exports = { verifyToken: () => ({}) };",
    ].join('\n'), 'utf-8');

    // Init git in worktree
    execSync('git init', { cwd: wtDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: wtDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: wtDir, stdio: 'pipe' });
    execSync('git add -A', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "initial"', { cwd: wtDir, stdio: 'pipe' });
    try { execSync('git branch -m main', { cwd: wtDir, stdio: 'pipe' }); } catch { /* ok */ }
    execSync('git checkout -b rapid/auth-core', { cwd: wtDir, stdio: 'pipe' });

    // Make a change on the branch
    fs.writeFileSync(path.join(wtDir, 'src', 'auth', 'token.cjs'), [
      "'use strict';",
      "module.exports = { createToken: (payload) => JSON.stringify(payload) };",
    ].join('\n'), 'utf-8');
    execSync('git add src/auth/token.cjs', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): implement createToken"', { cwd: wtDir, stdio: 'pipe' });

    // Update registry with worktree entry
    const regPath = path.join(tmpDir, '.planning', 'worktrees', 'REGISTRY.json');
    fs.writeFileSync(regPath, JSON.stringify({
      version: 1,
      worktrees: {
        'auth-core': {
          setName: 'auth-core',
          branch: 'rapid/auth-core',
          path: '.rapid-worktrees/auth-core',
          phase: 'Done',
        },
      },
    }, null, 2), 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes when contract is valid and no ownership violations', () => {
    const merge = require('./merge.cjs');
    const result = merge.runProgrammaticGate(tmpDir, 'auth-core');

    assert.equal(result.contractValid, true, 'contract should be valid');
    assert.ok(Array.isArray(result.ownershipViolations), 'should have violations array');
    assert.equal(result.ownershipViolations.length, 0, 'should have no violations');
    assert.equal(result.passed, true, 'overall should pass');
  });

  it('fails when contract schema is invalid', () => {
    const merge = require('./merge.cjs');

    // Write invalid contract
    const contractPath = path.join(tmpDir, '.planning', 'sets', 'auth-core', 'CONTRACT.json');
    fs.writeFileSync(contractPath, JSON.stringify({
      invalidField: true,
    }, null, 2), 'utf-8');

    const result = merge.runProgrammaticGate(tmpDir, 'auth-core');

    assert.equal(result.contractValid, false, 'contract should be invalid');
    assert.equal(result.passed, false, 'overall should fail');
  });

  it('detects ownership violations for cross-set file modifications', () => {
    const merge = require('./merge.cjs');

    // Add a file owned by api-routes to the worktree branch
    const wtDir = path.join(tmpDir, '.rapid-worktrees', 'auth-core');
    fs.mkdirSync(path.join(wtDir, 'src', 'routes'), { recursive: true });
    fs.writeFileSync(path.join(wtDir, 'src', 'routes', 'index.cjs'), '// routes', 'utf-8');
    execSync('git add src/routes/index.cjs', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): add routes"', { cwd: wtDir, stdio: 'pipe' });

    const result = merge.runProgrammaticGate(tmpDir, 'auth-core');

    assert.ok(result.ownershipViolations.length > 0, 'should detect ownership violation');
    assert.ok(result.ownershipViolations.some(v => v.file === 'src/routes/index.cjs'), 'should identify the violating file');
    assert.equal(result.passed, false, 'overall should fail due to ownership violation');
  });

  it('allows cross-set access when CONTRIBUTIONS.json exception exists', () => {
    const merge = require('./merge.cjs');

    // Add a file owned by api-routes to the worktree branch
    const wtDir = path.join(tmpDir, '.rapid-worktrees', 'auth-core');
    fs.mkdirSync(path.join(wtDir, 'src', 'routes'), { recursive: true });
    fs.writeFileSync(path.join(wtDir, 'src', 'routes', 'index.cjs'), '// routes', 'utf-8');
    execSync('git add src/routes/index.cjs', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): add auth middleware to routes"', { cwd: wtDir, stdio: 'pipe' });

    // Create CONTRIBUTIONS.json exception for auth-core
    const contribPath = path.join(tmpDir, '.planning', 'sets', 'auth-core', 'CONTRIBUTIONS.json');
    fs.writeFileSync(contribPath, JSON.stringify({
      set: 'auth-core',
      contributesTo: [
        { file: 'src/routes/index.cjs', owner: 'api-routes', intent: 'Add auth middleware' },
      ],
    }, null, 2), 'utf-8');

    const result = merge.runProgrammaticGate(tmpDir, 'auth-core');

    assert.equal(result.ownershipViolations.length, 0, 'should have no violations with contribution exception');
  });
});

// ────────────────────────────────────────────────────────────────
// prepareReviewContext
// ────────────────────────────────────────────────────────────────
describe('prepareReviewContext', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns context object with expected fields', () => {
    const merge = require('./merge.cjs');
    const ctx = merge.prepareReviewContext(tmpDir, 'auth-core');

    assert.ok(ctx.contractStr, 'should have contractStr');
    assert.ok(ctx.definition, 'should have definition');
    assert.ok(ctx.setDir, 'should have setDir');
    assert.ok(typeof ctx.ownershipData === 'object', 'should have ownershipData');
  });
});

// ────────────────────────────────────────────────────────────────
// runIntegrationTests
// ────────────────────────────────────────────────────────────────
describe('runIntegrationTests', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-integ-'));
    fs.mkdirSync(path.join(tmpDir, 'rapid', 'src', 'lib'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes when tests succeed', () => {
    const merge = require('./merge.cjs');

    // Create a simple passing test file
    fs.writeFileSync(path.join(tmpDir, 'rapid', 'src', 'lib', 'pass.test.cjs'), [
      "'use strict';",
      "const { describe, it } = require('node:test');",
      "const assert = require('node:assert/strict');",
      "describe('pass', () => { it('works', () => { assert.ok(true); }); });",
    ].join('\n'), 'utf-8');

    const result = merge.runIntegrationTests(tmpDir);
    assert.equal(result.passed, true, 'should pass');
    assert.ok(typeof result.output === 'string', 'should have output');
  });

  it('fails when tests fail', () => {
    const merge = require('./merge.cjs');

    // Create a failing test file
    fs.writeFileSync(path.join(tmpDir, 'rapid', 'src', 'lib', 'fail.test.cjs'), [
      "'use strict';",
      "const assert = require('node:assert/strict');",
      "assert.strictEqual(1, 2, 'deliberate failure');",
    ].join('\n'), 'utf-8');

    const result = merge.runIntegrationTests(tmpDir);
    assert.equal(result.passed, false, 'should fail');
    assert.ok(typeof result.output === 'string', 'should have output');
  });
});

// ────────────────────────────────────────────────────────────────
// Module exports check
// ────────────────────────────────────────────────────────────────
describe('merge.cjs module exports', () => {
  it('exports all 8 required functions', () => {
    const merge = require('./merge.cjs');

    const expectedExports = [
      'runProgrammaticGate',
      'prepareReviewContext',
      'assembleReviewerPrompt',
      'writeReviewMd',
      'parseReviewVerdict',
      'getMergeOrder',
      'mergeSet',
      'runIntegrationTests',
    ];

    for (const name of expectedExports) {
      assert.equal(typeof merge[name], 'function', `should export ${name} as a function`);
    }
  });
});
