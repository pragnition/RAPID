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

// ────────────────────────────────────────────────────────────────
// generateHandoff
// ────────────────────────────────────────────────────────────────
describe('generateHandoff', () => {
  it('produces correct frontmatter and all sections from full checkpoint data', () => {
    const checkpointData = {
      handoff_done: '- [x] Task 1: Created token.cjs\n- [x] Task 2: Created verify.cjs',
      handoff_remaining: '- [ ] Task 3: Add refresh token rotation',
      handoff_resume: 'Continue from Task 3. Token infrastructure is complete.',
      tasks_completed: 3,
      tasks_total: 7,
      decisions: ['Used HS256 for JWT signing', 'Tokens expire after 1 hour'],
    };

    const result = executeModule.generateHandoff(checkpointData, 'auth-core', 1);

    // Check frontmatter
    assert.ok(result.startsWith('---\n'), 'should start with frontmatter delimiter');
    assert.ok(result.includes('set: auth-core'), 'should have set name in frontmatter');
    assert.ok(result.includes('pause_cycle: 1'), 'should have pause_cycle in frontmatter');
    assert.ok(result.includes('tasks_completed: 3'), 'should have tasks_completed in frontmatter');
    assert.ok(result.includes('tasks_total: 7'), 'should have tasks_total in frontmatter');
    assert.ok(result.includes('paused_at:'), 'should have paused_at timestamp in frontmatter');

    // Check sections
    assert.ok(result.includes('## Completed Work'), 'should have Completed Work section');
    assert.ok(result.includes('Task 1: Created token.cjs'), 'should have completed work content');
    assert.ok(result.includes('## Remaining Work'), 'should have Remaining Work section');
    assert.ok(result.includes('Task 3: Add refresh token rotation'), 'should have remaining work content');
    assert.ok(result.includes('## Resume Instructions'), 'should have Resume Instructions section');
    assert.ok(result.includes('Continue from Task 3'), 'should have resume instructions content');
    assert.ok(result.includes('## Decisions Made'), 'should have Decisions Made section');
    assert.ok(result.includes('Used HS256 for JWT signing'), 'should have decision content');
    assert.ok(result.includes('Tokens expire after 1 hour'), 'should have second decision');
  });

  it('omits Decisions Made section when no decisions provided', () => {
    const checkpointData = {
      handoff_done: 'Some work done',
      handoff_remaining: 'More to do',
      handoff_resume: 'Continue working',
      tasks_completed: 1,
      tasks_total: 3,
    };

    const result = executeModule.generateHandoff(checkpointData, 'test-set', 2);

    assert.ok(!result.includes('## Decisions Made'), 'should NOT have Decisions Made section');
    assert.ok(result.includes('pause_cycle: 2'), 'should have pause_cycle 2');
  });

  it('uses default text for empty handoff fields', () => {
    const checkpointData = {
      tasks_completed: 0,
      tasks_total: 5,
    };

    const result = executeModule.generateHandoff(checkpointData, 'empty-set', 1);

    assert.ok(result.includes('(none recorded)'), 'should have default text for empty fields');
    assert.ok(result.includes('Continue from where execution stopped.'), 'should have default resume instructions');
  });
});

// ────────────────────────────────────────────────────────────────
// parseHandoff
// ────────────────────────────────────────────────────────────────
describe('parseHandoff', () => {
  it('round-trips: generateHandoff -> parseHandoff returns correct data', () => {
    const checkpointData = {
      handoff_done: '- [x] Task 1: Created token.cjs',
      handoff_remaining: '- [ ] Task 2: Add verification',
      handoff_resume: 'Start from Task 2.',
      tasks_completed: 1,
      tasks_total: 2,
      decisions: ['Chose JWT over opaque tokens'],
    };

    const handoffMd = executeModule.generateHandoff(checkpointData, 'auth-core', 3);
    const parsed = executeModule.parseHandoff(handoffMd);

    assert.ok(parsed !== null, 'should not return null');
    assert.equal(parsed.set, 'auth-core', 'should parse set name');
    assert.equal(parsed.pauseCycle, 3, 'should parse pauseCycle');
    assert.equal(parsed.tasksCompleted, 1, 'should parse tasksCompleted');
    assert.equal(parsed.tasksTotal, 2, 'should parse tasksTotal');
    assert.ok(parsed.completedWork.includes('Task 1: Created token.cjs'), 'should parse completed work');
    assert.ok(parsed.remainingWork.includes('Task 2: Add verification'), 'should parse remaining work');
    assert.ok(parsed.resumeInstructions.includes('Start from Task 2'), 'should parse resume instructions');
    assert.ok(Array.isArray(parsed.decisions), 'decisions should be array');
    assert.ok(parsed.decisions.some(d => d.includes('Chose JWT')), 'should parse decisions');
  });

  it('returns null for empty string', () => {
    const result = executeModule.parseHandoff('');
    assert.equal(result, null, 'should return null for empty string');
  });

  it('returns null for falsy input', () => {
    assert.equal(executeModule.parseHandoff(null), null, 'null input');
    assert.equal(executeModule.parseHandoff(undefined), null, 'undefined input');
  });

  it('handles content with no decisions section', () => {
    const checkpointData = {
      handoff_done: 'Work done',
      handoff_remaining: 'Work remaining',
      handoff_resume: 'Continue',
      tasks_completed: 1,
      tasks_total: 3,
    };

    const handoffMd = executeModule.generateHandoff(checkpointData, 'test-set', 1);
    const parsed = executeModule.parseHandoff(handoffMd);

    assert.ok(parsed !== null, 'should not return null');
    assert.equal(parsed.set, 'test-set', 'should parse set name');
    assert.deepEqual(parsed.decisions, [], 'decisions should be empty array when no section');
  });
});

// ────────────────────────────────────────────────────────────────
// reconcileWave
// ────────────────────────────────────────────────────────────────
describe('reconcileWave', { concurrency: 1 }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-reconcile-'));

    // Create project structure
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    // Create auth-core set dir with DEFINITION.md and CONTRACT.json
    const authDir = path.join(setsDir, 'auth-core');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'DEFINITION.md'), [
      '# Set: auth-core',
      '',
      '## File Ownership',
      'Files this set owns (exclusive write access):',
      '- src/auth/token.cjs',
      '- src/auth/verify.cjs',
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(authDir, 'CONTRACT.json'), JSON.stringify({
      exports: { functions: [{ name: 'createToken', file: 'src/auth/token.cjs' }] },
    }, null, 2), 'utf-8');

    // Create a passing contract test
    fs.writeFileSync(path.join(authDir, 'contract.test.cjs'), [
      "'use strict';",
      "const { describe, it } = require('node:test');",
      "const assert = require('node:assert/strict');",
      "describe('auth-core contract', () => {",
      "  it('passes', () => { assert.ok(true); });",
      "});",
    ].join('\n'), 'utf-8');

    // Create fake worktree with artifact files
    const wtDir = path.join(tmpDir, '.rapid-worktrees', 'auth-core');
    fs.mkdirSync(path.join(wtDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(wtDir, 'src', 'auth', 'token.cjs'), '// token', 'utf-8');
    fs.writeFileSync(path.join(wtDir, 'src', 'auth', 'verify.cjs'), '// verify', 'utf-8');

    // Init git in worktree
    execSync('git init', { cwd: wtDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: wtDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: wtDir, stdio: 'pipe' });
    execSync('git add -A', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "initial"', { cwd: wtDir, stdio: 'pipe' });
    try { execSync('git branch -m main', { cwd: wtDir, stdio: 'pipe' }); } catch { /* ok */ }
    execSync('git checkout -b rapid/auth-core', { cwd: wtDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(wtDir, 'src', 'auth', 'token.cjs'), '// token v2', 'utf-8');
    execSync('git add src/auth/token.cjs', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): update token"', { cwd: wtDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns PASS when all artifacts present and contract tests pass', () => {
    const dagJson = {
      waves: { 1: { sets: ['auth-core'] } },
    };
    const registry = {
      worktrees: {
        'auth-core': {
          setName: 'auth-core',
          path: '.rapid-worktrees/auth-core',
          branch: 'rapid/auth-core',
          phase: 'Done',
        },
      },
    };

    const result = executeModule.reconcileWave(tmpDir, 1, dagJson, registry);

    assert.equal(result.overall, 'PASS', 'overall should be PASS');
    assert.equal(result.hardBlocks.length, 0, 'should have no hard blocks');
    assert.equal(result.softBlocks.length, 0, 'should have no soft blocks');
    assert.equal(result.setResults['auth-core'].contractCompliance, 'PASS', 'contract should pass');
  });

  it('reports soft block for missing artifact file', () => {
    // Remove one artifact
    fs.unlinkSync(path.join(tmpDir, '.rapid-worktrees', 'auth-core', 'src', 'auth', 'verify.cjs'));

    const dagJson = {
      waves: { 1: { sets: ['auth-core'] } },
    };
    const registry = {
      worktrees: {
        'auth-core': {
          setName: 'auth-core',
          path: '.rapid-worktrees/auth-core',
          branch: 'rapid/auth-core',
          phase: 'Done',
        },
      },
    };

    const result = executeModule.reconcileWave(tmpDir, 1, dagJson, registry);

    assert.ok(result.softBlocks.length > 0, 'should have soft blocks');
    assert.ok(result.softBlocks.some(b => b.type === 'missing_artifact'), 'should have missing_artifact type');
    assert.ok(result.softBlocks.some(b => b.detail && b.detail.includes('verify.cjs')), 'should reference the missing file');
  });

  it('reports hard block when contract test fails', () => {
    // Overwrite with a failing test (use plain throw to avoid node:test TAP conflicts)
    const authDir = path.join(tmpDir, '.planning', 'sets', 'auth-core');
    fs.writeFileSync(path.join(authDir, 'contract.test.cjs'), [
      "'use strict';",
      "const assert = require('node:assert/strict');",
      "// Deliberate failure for reconciliation test",
      "assert.strictEqual(1, 2, 'contract test fails deliberately');",
    ].join('\n'), 'utf-8');

    const dagJson = {
      waves: { 1: { sets: ['auth-core'] } },
    };
    const registry = {
      worktrees: {
        'auth-core': {
          setName: 'auth-core',
          path: '.rapid-worktrees/auth-core',
          branch: 'rapid/auth-core',
          phase: 'Done',
        },
      },
    };

    const result = executeModule.reconcileWave(tmpDir, 1, dagJson, registry);

    assert.ok(result.hardBlocks.length > 0, 'should have hard blocks');
    assert.ok(result.hardBlocks.some(b => b.type === 'contract_violation'), 'should have contract_violation type');
    assert.equal(result.setResults['auth-core'].contractCompliance, 'FAIL', 'contract should fail');
  });
});

// ────────────────────────────────────────────────────────────────
// generateWaveSummary
// ────────────────────────────────────────────────────────────────
describe('generateWaveSummary', () => {
  it('produces valid Markdown with correct headings', () => {
    const reconcileResult = {
      overall: 'PASS',
      hardBlocks: [],
      softBlocks: [],
      setResults: {
        'auth-core': {
          contractCompliance: 'PASS',
          artifactsPlanned: 2,
          artifactsDelivered: 2,
          missingArtifacts: [],
          commitCount: 3,
        },
      },
    };

    const summary = executeModule.generateWaveSummary(1, reconcileResult, '2026-03-04T12:00:00Z');

    assert.ok(summary.includes('# Wave 1 Reconciliation Summary'), 'should have wave heading');
    assert.ok(summary.includes('**Result:** PASS'), 'should show PASS result');
    assert.ok(summary.includes('auth-core'), 'should reference the set');
    assert.ok(summary.includes('2026-03-04'), 'should include timestamp');
    assert.ok(summary.includes('## Hard Blocks'), 'should have Hard Blocks section');
    assert.ok(summary.includes('## Soft Blocks'), 'should have Soft Blocks section');
  });

  it('includes hard/soft blocks when present', () => {
    const reconcileResult = {
      overall: 'FAIL',
      hardBlocks: [{ set: 'auth-core', type: 'contract_violation', detail: 'createToken not found' }],
      softBlocks: [{ set: 'db-schema', type: 'missing_artifact', detail: 'README.md missing' }],
      setResults: {
        'auth-core': { contractCompliance: 'FAIL', artifactsPlanned: 2, artifactsDelivered: 2, missingArtifacts: [], commitCount: 2 },
        'db-schema': { contractCompliance: 'PASS', artifactsPlanned: 3, artifactsDelivered: 2, missingArtifacts: ['README.md'], commitCount: 4 },
      },
    };

    const summary = executeModule.generateWaveSummary(2, reconcileResult, '2026-03-04T13:00:00Z');

    assert.ok(summary.includes('**Result:** FAIL'), 'should show FAIL result');
    assert.ok(summary.includes('contract_violation'), 'should include hard block type');
    assert.ok(summary.includes('createToken not found'), 'should include hard block detail');
    assert.ok(summary.includes('missing_artifact'), 'should include soft block type');
    assert.ok(summary.includes('README.md missing'), 'should include soft block detail');
  });

  it('shows "None" for empty block lists', () => {
    const reconcileResult = {
      overall: 'PASS',
      hardBlocks: [],
      softBlocks: [],
      setResults: {},
    };

    const summary = executeModule.generateWaveSummary(1, reconcileResult, '2026-03-04T12:00:00Z');

    // After "## Hard Blocks" and "## Soft Blocks", should have "None"
    assert.ok(summary.includes('None'), 'should show None for empty blocks');
  });

  it('includes execution mode when provided', () => {
    const reconcileResult = {
      overall: 'PASS',
      hardBlocks: [],
      softBlocks: [],
      setResults: {},
    };

    const summary = executeModule.generateWaveSummary(1, reconcileResult, '2026-03-04T12:00:00Z', 'Agent Teams');
    assert.ok(summary.includes('**Execution Mode:** Agent Teams'), 'should show Agent Teams mode');
  });

  it('defaults to Subagents when mode not provided', () => {
    const reconcileResult = {
      overall: 'PASS',
      hardBlocks: [],
      softBlocks: [],
      setResults: {},
    };

    const summary = executeModule.generateWaveSummary(1, reconcileResult, '2026-03-04T12:00:00Z');
    assert.ok(summary.includes('**Execution Mode:** Subagents'), 'should default to Subagents');
  });

  it('shows Agent Teams when mode is Agent Teams', () => {
    const reconcileResult = {
      overall: 'PASS_WITH_WARNINGS',
      hardBlocks: [],
      softBlocks: [{ set: 'test', type: 'missing_artifact', detail: 'file.cjs' }],
      setResults: {
        'test': { contractCompliance: 'PASS', artifactsPlanned: 1, artifactsDelivered: 0, missingArtifacts: ['file.cjs'], commitCount: 1 },
      },
    };

    const summary = executeModule.generateWaveSummary(2, reconcileResult, '2026-03-04T14:00:00Z', 'Agent Teams');
    assert.ok(summary.includes('**Execution Mode:** Agent Teams'), 'should show Agent Teams');
    assert.ok(summary.includes('**Result:** PASS_WITH_WARNINGS'), 'should show correct result');
  });
});
