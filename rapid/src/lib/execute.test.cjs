'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const executeModule = require('./execute.cjs');

// ────────────────────────────────────────────────────────────────
// Helper: create a mock project directory with .planning/sets structure
// ────────────────────────────────────────────────────────────────
function createMockProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-execute-'));

  // Create .planning/sets/
  const setsDir = path.join(tmpDir, '.planning', 'sets');
  fs.mkdirSync(setsDir, { recursive: true });

  // Create .planning/worktrees/
  const wtRegDir = path.join(tmpDir, '.planning', 'worktrees');
  fs.mkdirSync(wtRegDir, { recursive: true });

  // Create a test set: auth-core
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

  // Create a second set: api-routes
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

  return tmpDir;
}

// ────────────────────────────────────────────────────────────────
// prepareSetContext
// ────────────────────────────────────────────────────────────────
describe('prepareSetContext', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns scopedMd, definition, contractStr, and setName', () => {
    const ctx = executeModule.prepareSetContext(tmpDir, 'auth-core');

    assert.ok(typeof ctx.scopedMd === 'string', 'should have scopedMd');
    assert.ok(typeof ctx.definition === 'string', 'should have definition');
    assert.ok(typeof ctx.contractStr === 'string', 'should have contractStr');
    assert.equal(ctx.setName, 'auth-core', 'should have setName');

    // Check definition content
    assert.ok(ctx.definition.includes('# Set: auth-core'), 'definition should contain set heading');

    // Check contractStr is valid JSON
    const parsed = JSON.parse(ctx.contractStr);
    assert.ok(parsed.exports, 'contractStr should parse to an object with exports');

    // Check scopedMd contains contract and scope
    assert.ok(ctx.scopedMd.includes('auth-core'), 'scopedMd should reference auth-core');
  });

  it('throws if set does not exist', () => {
    assert.throws(
      () => executeModule.prepareSetContext(tmpDir, 'nonexistent-set'),
      /does not exist/,
      'should throw for missing set'
    );
  });
});

// ────────────────────────────────────────────────────────────────
// assembleExecutorPrompt
// ────────────────────────────────────────────────────────────────
describe('assembleExecutorPrompt', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('assembles discuss phase prompt with contract and definition', () => {
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'discuss');

    assert.ok(prompt.includes('Discussion Phase'), 'should have discussion phase header');
    assert.ok(prompt.includes('auth-core'), 'should reference set name');
    assert.ok(prompt.includes('Contract'), 'should include Contract section');
    assert.ok(prompt.includes('Definition'), 'should include Definition section');
    assert.ok(prompt.includes('clarifying questions'), 'should include discussion instructions');
  });

  it('assembles plan phase prompt with prior context', () => {
    const priorContext = 'We discussed using JWT tokens with rotation.';
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'plan', priorContext);

    assert.ok(prompt.includes('Planning Phase'), 'should have planning phase header');
    assert.ok(prompt.includes('Discussion Decisions'), 'should include decisions section');
    assert.ok(prompt.includes('JWT tokens with rotation'), 'should include prior context');
    assert.ok(prompt.includes('step-by-step implementation plan'), 'should include plan instructions');
  });

  it('assembles plan phase prompt with default when no priorContext', () => {
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'plan');

    assert.ok(prompt.includes('No prior discussion'), 'should have default discussion text');
  });

  it('assembles execute phase prompt with scopedMd and commit convention', () => {
    const planText = 'Step 1: Create token.cjs\nStep 2: Create verify.cjs';
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'execute', planText);

    assert.ok(prompt.includes('Execution Phase'), 'should have execution phase header');
    assert.ok(prompt.includes('Scoped Agent Context') || prompt.includes('Your Scope'), 'should include scoped CLAUDE.md content');
    assert.ok(prompt.includes('Commit Convention'), 'should include commit convention');
    assert.ok(prompt.includes('auth-core'), 'commit convention should reference set name');
    assert.ok(prompt.includes('Step 1: Create token.cjs'), 'should include plan text');
  });

  it('does not contain references to other sets definition files (cross-set bleed check)', () => {
    const prompt = executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'execute');

    // Should NOT contain paths to api-routes definition or contract
    assert.ok(!prompt.includes('.planning/sets/api-routes/DEFINITION.md'), 'should not reference api-routes DEFINITION.md');
    assert.ok(!prompt.includes('.planning/sets/api-routes/CONTRACT.json'), 'should not reference api-routes CONTRACT.json');
  });

  it('throws on invalid phase', () => {
    assert.throws(
      () => executeModule.assembleExecutorPrompt(tmpDir, 'auth-core', 'invalid-phase'),
      /Invalid phase/,
      'should throw on invalid phase'
    );
  });
});

// ────────────────────────────────────────────────────────────────
// getChangedFiles, getCommitCount, getCommitMessages
// ────────────────────────────────────────────────────────────────
describe('git helpers', () => {
  let tmpDir;
  let baseBranch;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-exec-git-'));
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    baseBranch = 'main';
    try {
      execSync('git branch -m main', { cwd: tmpDir, stdio: 'pipe' });
    } catch {
      // already on main
    }

    // Create a feature branch with changes
    execSync('git checkout -b rapid/test-set', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'file1.cjs'), '// file1', 'utf-8');
    execSync('git add file1.cjs', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "feat(test-set): add file1"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'file2.cjs'), '// file2', 'utf-8');
    execSync('git add file2.cjs', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "feat(test-set): add file2"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('getChangedFiles returns array of changed file paths', () => {
    const files = executeModule.getChangedFiles(tmpDir, baseBranch);
    assert.ok(Array.isArray(files), 'should return array');
    assert.ok(files.includes('file1.cjs'), 'should include file1.cjs');
    assert.ok(files.includes('file2.cjs'), 'should include file2.cjs');
    assert.equal(files.length, 2, 'should have 2 files');
  });

  it('getCommitCount returns correct count', () => {
    const count = executeModule.getCommitCount(tmpDir, baseBranch);
    assert.equal(count, 2, 'should have 2 commits');
  });

  it('getCommitMessages returns array of commit subject lines', () => {
    const messages = executeModule.getCommitMessages(tmpDir, baseBranch);
    assert.ok(Array.isArray(messages), 'should return array');
    assert.equal(messages.length, 2, 'should have 2 messages');
    assert.ok(messages.some(m => m.includes('feat(test-set): add file1')), 'should include file1 commit msg');
    assert.ok(messages.some(m => m.includes('feat(test-set): add file2')), 'should include file2 commit msg');
  });

  it('getChangedFiles returns empty array on failure', () => {
    const files = executeModule.getChangedFiles('/nonexistent/path', 'main');
    assert.ok(Array.isArray(files), 'should return array');
    assert.equal(files.length, 0, 'should be empty on failure');
  });

  it('getCommitCount returns 0 on failure', () => {
    const count = executeModule.getCommitCount('/nonexistent/path', 'main');
    assert.equal(count, 0, 'should return 0 on failure');
  });

  it('getCommitMessages returns empty array on failure', () => {
    const msgs = executeModule.getCommitMessages('/nonexistent/path', 'main');
    assert.ok(Array.isArray(msgs), 'should return array');
    assert.equal(msgs.length, 0, 'should be empty on failure');
  });
});

// ────────────────────────────────────────────────────────────────
// verifySetExecution
// ────────────────────────────────────────────────────────────────
describe('verifySetExecution', () => {
  let tmpDir;
  let projectDir;
  let baseBranch;

  beforeEach(() => {
    // Create a git repo for the worktree
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-verify-exec-'));
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    baseBranch = 'main';
    try {
      execSync('git branch -m main', { cwd: tmpDir, stdio: 'pipe' });
    } catch {
      // already on main
    }

    // Create project structure for ownership
    projectDir = tmpDir;
    const setsDir = path.join(projectDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    // Create OWNERSHIP.json
    fs.writeFileSync(path.join(setsDir, 'OWNERSHIP.json'), JSON.stringify({
      version: 1,
      ownership: {
        'src/auth/token.cjs': 'auth-core',
        'src/auth/verify.cjs': 'auth-core',
        'src/routes/index.cjs': 'api-routes',
      },
    }, null, 2), 'utf-8');

    // Make commits on a feature branch
    execSync('git checkout -b rapid/auth-core', { cwd: tmpDir, stdio: 'pipe' });
    fs.mkdirSync(path.join(tmpDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'token.cjs'), '// token module', 'utf-8');
    execSync('git add src/auth/token.cjs', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): add token module"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'verify.cjs'), '// verify module', 'utf-8');
    execSync('git add src/auth/verify.cjs', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): add verify module"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns passed when all checks pass', () => {
    const returnData = {
      status: 'COMPLETE',
      artifacts: [
        path.join(tmpDir, 'src', 'auth', 'token.cjs'),
        path.join(tmpDir, 'src', 'auth', 'verify.cjs'),
      ],
      commits: [],
      tasks_completed: 2,
      tasks_total: 2,
    };

    const results = executeModule.verifySetExecution(
      projectDir, 'auth-core', returnData, tmpDir, baseBranch
    );

    assert.ok(results.passed.length > 0, 'should have passed checks');
    // Check commit count passes
    const commitCountCheck = results.passed.find(p => p.type === 'commit_count_match');
    assert.ok(commitCountCheck, 'should pass commit count check');
    // Check commit format passes
    const formatChecks = results.passed.filter(p => p.type === 'commit_format_valid');
    assert.equal(formatChecks.length, 2, 'should have 2 valid commit format checks');
    // Check ownership passes
    const ownershipChecks = results.passed.filter(p => p.type === 'ownership_valid');
    assert.equal(ownershipChecks.length, 2, 'should have 2 valid ownership checks');
  });

  it('detects commit count mismatch', () => {
    const returnData = {
      status: 'COMPLETE',
      artifacts: [],
      commits: [],
      tasks_completed: 5,
      tasks_total: 5,  // expects 5 commits, but only 2 exist
    };

    const results = executeModule.verifySetExecution(
      projectDir, 'auth-core', returnData, tmpDir, baseBranch
    );

    const mismatch = results.failed.find(f => f.type === 'commit_count_mismatch');
    assert.ok(mismatch, 'should detect commit count mismatch');
    assert.ok(mismatch.target.includes('expected 5'), 'should show expected count');
    assert.ok(mismatch.target.includes('actual 2'), 'should show actual count');
  });

  it('detects commit message format violations', () => {
    // Add a badly formatted commit
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'extra.cjs'), '// extra', 'utf-8');
    execSync('git add src/auth/extra.cjs', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "bad commit message without type prefix"', { cwd: tmpDir, stdio: 'pipe' });

    const returnData = {
      status: 'COMPLETE',
      artifacts: [],
      commits: [],
      tasks_completed: 3,
      tasks_total: 3,
    };

    const results = executeModule.verifySetExecution(
      projectDir, 'auth-core', returnData, tmpDir, baseBranch
    );

    const violation = results.failed.find(f => f.type === 'commit_format_violation');
    assert.ok(violation, 'should detect commit format violation');
    assert.ok(violation.target.includes('bad commit message'), 'should include the bad message');
  });

  it('detects ownership violations', () => {
    // Add a file owned by api-routes
    fs.mkdirSync(path.join(tmpDir, 'src', 'routes'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'routes', 'index.cjs'), '// routes', 'utf-8');
    execSync('git add src/routes/index.cjs', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): add routes"', { cwd: tmpDir, stdio: 'pipe' });

    const returnData = {
      status: 'COMPLETE',
      artifacts: [],
      commits: [],
      tasks_completed: 3,
      tasks_total: 3,
    };

    const results = executeModule.verifySetExecution(
      projectDir, 'auth-core', returnData, tmpDir, baseBranch
    );

    const ownershipViolation = results.failed.find(f => f.type === 'ownership_violation');
    assert.ok(ownershipViolation, 'should detect ownership violation');
    assert.ok(ownershipViolation.target.includes('src/routes/index.cjs'), 'should identify the violating file');
  });
});
