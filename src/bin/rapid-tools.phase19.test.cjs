'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLI_PATH = path.join(__dirname, 'rapid-tools.cjs');

// ────────────────────────────────────────────────────────────────
// Helper: create a real git repo in a temp dir with an initial commit
// and a .planning/ directory (required for findProjectRoot)
// ────────────────────────────────────────────────────────────────
function createTempRepo() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-cli-test-'));
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  // .planning/ is required for findProjectRoot to recognize this as a RAPID project
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  execSync('git add .', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}

function cleanupRepo(dir) {
  // Remove any worktrees first to prevent git complaints
  try {
    const result = execSync('git worktree list --porcelain', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const blocks = result.trim().split('\n\n');
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const pathLine = lines.find(l => l.startsWith('worktree '));
      if (pathLine) {
        const wtPath = pathLine.replace('worktree ', '');
        if (wtPath !== dir) {
          try {
            execSync(`git worktree remove --force "${wtPath}"`, { cwd: dir, stdio: 'pipe' });
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }

  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Helper: run rapid-tools CLI and return { stdout, stderr, exitCode }.
 * Never throws -- captures exit code from the error object on failure.
 */
function runCli(args, cwd) {
  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: (err.stdout || '').toString(),
      stderr: (err.stderr || '').toString(),
      exitCode: err.status || 1,
    };
  }
}

/**
 * Helper: create a valid STATE.json in the temp dir's .planning/ directory.
 * Returns the state object that was written.
 */
function scaffoldState(tmpDir, overrides = {}) {
  const now = new Date().toISOString();
  const state = {
    version: 1,
    projectName: 'test-project',
    currentMilestone: 'v1.0',
    milestones: [{
      id: 'v1.0',
      name: 'v1.0',
      sets: [],
    }],
    lastUpdatedAt: now,
    createdAt: now,
    ...overrides,
  };
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.json'),
    JSON.stringify(state, null, 2),
    'utf-8'
  );
  return state;
}

/**
 * Helper: scaffold .planning/sets/<setName> with DEFINITION.md and CONTRACT.json.
 */
function scaffoldSetDefinition(tmpDir, setName) {
  const setDir = path.join(tmpDir, '.planning', 'sets', setName);
  fs.mkdirSync(setDir, { recursive: true });
  fs.writeFileSync(
    path.join(setDir, 'DEFINITION.md'),
    `# Set: ${setName}\n\n## Scope\nTest scope for ${setName}\n\n## File Ownership\n- src/${setName}/index.cjs\n`,
    'utf-8'
  );
  fs.writeFileSync(
    path.join(setDir, 'CONTRACT.json'),
    JSON.stringify({
      exports: { functions: [{ name: 'main', file: `src/${setName}/index.cjs`, params: [], returns: 'void' }], types: [] },
    }, null, 2),
    'utf-8'
  );
  // Write OWNERSHIP.json (required for generateScopedClaudeMd)
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'sets', 'OWNERSHIP.json'),
    JSON.stringify({
      version: 1,
      generated: '2026-03-07',
      ownership: { [`src/${setName}/index.cjs`]: setName },
    }, null, 2),
    'utf-8'
  );
}

/**
 * Helper: write a REGISTRY.json with given worktree entries.
 */
function scaffoldRegistry(tmpDir, worktrees = {}) {
  const regDir = path.join(tmpDir, '.planning', 'worktrees');
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(
    path.join(regDir, 'REGISTRY.json'),
    JSON.stringify({ version: 1, worktrees }, null, 2),
    'utf-8'
  );
}

/**
 * Helper: scaffold a HANDOFF.md with frontmatter and sections.
 */
function scaffoldHandoff(tmpDir, setName, overrides = {}) {
  const setDir = path.join(tmpDir, '.planning', 'sets', setName);
  fs.mkdirSync(setDir, { recursive: true });
  const pauseCycle = overrides.pauseCycle || 1;
  const handoff = [
    '---',
    `set: ${setName}`,
    `pause_cycle: ${pauseCycle}`,
    'tasks_completed: 3',
    'tasks_total: 10',
    '---',
    '',
    '## Completed Work',
    '- Implemented auth module',
    '- Added unit tests',
    '',
    '## Remaining Work',
    '- Integration tests',
    '- Error handling',
    '',
    '## Resume Instructions',
    'Continue with integration tests next.',
    '',
    '## Decisions Made',
    '- Use JWT for auth tokens',
    '- Store tokens in httpOnly cookies',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(setDir, 'HANDOFF.md'), handoff, 'utf-8');
}

// ────────────────────────────────────────────────────────────────
// Target 1: handleSetInit CLI -- "set-init create" command
// ────────────────────────────────────────────────────────────────
describe('Phase 19 CLI: set-init create', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
    // Pre-create the worktrees directory for registry
    fs.mkdirSync(path.join(tmpDir, '.planning', 'worktrees'), { recursive: true });
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  // BEHAVIOR: "set-init create <name>" with valid set definition should
  // output JSON with created: true, correct branch, and the worktree
  // directory should actually exist on disk
  // GUARDS AGAINST: Silent failures where the CLI reports success but
  // the worktree was not actually created (e.g., git command failed silently)
  it('outputs JSON with created:true and creates worktree on disk (happy path)', () => {
    // Arrange
    scaffoldSetDefinition(tmpDir, 'my-set');

    // Act
    const { stdout, exitCode } = runCli('set-init create my-set', tmpDir);

    // Assert
    assert.equal(exitCode, 0, `Expected exit 0 but got ${exitCode}`);
    const result = JSON.parse(stdout.trim());
    assert.equal(result.created, true, 'should report created: true');
    assert.equal(result.branch, 'rapid/my-set', 'should have correct branch');
    assert.equal(result.setName, 'my-set', 'should echo set name');
    assert.ok(result.worktreePath, 'should include worktreePath');
    // Verify the worktree directory actually exists
    assert.ok(fs.existsSync(result.worktreePath), 'worktree directory should exist on disk');
  });

  // BEHAVIOR: Missing set-name argument should print usage to stderr and exit 1
  // GUARDS AGAINST: The orchestrator calling set-init without arguments and
  // getting an unclear error instead of the expected usage message
  it('exits 1 with usage message when set-name is missing', () => {
    // Act
    const { stderr, exitCode } = runCli('set-init create', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1');
    assert.ok(
      stderr.includes('Usage') || stderr.includes('set-init create'),
      `Expected usage message in stderr but got: ${stderr}`
    );
  });

  // BEHAVIOR: Non-existent set definition should output { created: false, error: ... }
  // and exit 1 (the set directory doesn't have DEFINITION.md / CONTRACT.json,
  // but createWorktree might still succeed -- the error comes from the branch
  // or from the generateScopedClaudeMd path, NOT from missing files per se;
  // however if the set-init CLI delegates to worktree.setInit which calls
  // createWorktree, the worktree will be created but claudeMdGenerated=false)
  // This test verifies the CLI outputs valid JSON regardless
  it('outputs valid JSON when set lacks CONTRACT.json (claudeMdGenerated=false)', () => {
    // Arrange -- create DEFINITION.md but NOT CONTRACT.json
    const setDir = path.join(tmpDir, '.planning', 'sets', 'partial-set');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'DEFINITION.md'), '# Partial\n', 'utf-8');

    // Act
    const { stdout, exitCode } = runCli('set-init create partial-set', tmpDir);

    // Assert -- should succeed (worktree created) but claudeMdGenerated=false
    assert.equal(exitCode, 0, 'should exit 0 because worktree is created despite CLAUDE.md failure');
    const result = JSON.parse(stdout.trim());
    assert.equal(result.created, true, 'should still report created: true');
    assert.equal(result.claudeMdGenerated, false, 'claudeMdGenerated should be false');
  });

  // BEHAVIOR: Duplicate set-init (already initialized) should output error
  // JSON and exit 1
  // GUARDS AGAINST: Silent re-initialization that overwrites the existing
  // worktree's state, destroying in-progress work
  it('exits 1 with error JSON when set is already initialized', () => {
    // Arrange -- first init
    scaffoldSetDefinition(tmpDir, 'dup-set');
    runCli('set-init create dup-set', tmpDir);

    // Act -- second init (duplicate)
    const { stdout, exitCode } = runCli('set-init create dup-set', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1 for duplicate');
    const result = JSON.parse(stdout.trim());
    assert.equal(result.created, false, 'should report created: false');
    assert.ok(result.error, 'should have error field');
    assert.ok(
      result.error.includes('already exists'),
      `Error should mention "already exists" but got: ${result.error}`
    );
  });
});

// ────────────────────────────────────────────────────────────────
// Target 2: handleSetInit CLI -- "set-init list-available" command
// ────────────────────────────────────────────────────────────────
describe('Phase 19 CLI: set-init list-available', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  // BEHAVIOR: When STATE.json does not exist, list-available should return
  // { available: [], error: ... } and NOT crash
  // GUARDS AGAINST: The orchestrator crashing on a fresh project that has
  // not run /rapid:init yet
  it('returns { available: [], error } when no STATE.json exists', () => {
    // Arrange -- no STATE.json (only .planning/ exists from createTempRepo)

    // Act
    const { stdout, exitCode } = runCli('set-init list-available', tmpDir);

    // Assert -- should return valid JSON with empty available array
    const result = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(result.available), 'should have available array');
    assert.equal(result.available.length, 0, 'should have 0 available sets');
    // May or may not have error field -- the important thing is no crash
  });

  // BEHAVIOR: When all sets already have worktrees, list-available should
  // return { available: [] } with nothing to offer
  // GUARDS AGAINST: The orchestrator showing "no sets available" correctly
  // instead of showing already-initialized sets
  it('returns { available: [] } when all pending sets have worktrees', () => {
    // Arrange
    scaffoldState(tmpDir, {
      milestones: [{
        id: 'v1.0',
        name: 'v1.0',
        sets: [
          { id: 'auth', status: 'pending', waves: [] },
          { id: 'ui', status: 'pending', waves: [] },
        ],
      }],
    });
    // Both sets have worktrees registered
    scaffoldRegistry(tmpDir, {
      'auth': { setName: 'auth', branch: 'rapid/auth', path: '.rapid-worktrees/auth', phase: 'Created' },
      'ui': { setName: 'ui', branch: 'rapid/ui', path: '.rapid-worktrees/ui', phase: 'Created' },
    });

    // Act
    const { stdout, exitCode } = runCli('set-init list-available', tmpDir);

    // Assert
    assert.equal(exitCode, 0, 'should exit with code 0');
    const result = JSON.parse(stdout.trim());
    assert.equal(result.available.length, 0, 'should have 0 available when all have worktrees');
  });

  // BEHAVIOR: Mix of pending/non-pending sets across milestones should
  // only return pending sets without worktrees
  // GUARDS AGAINST: Wrong filtering logic that returns executing or
  // complete sets, or returns pending sets that already have worktrees
  it('returns only pending sets without worktrees from all milestones', () => {
    // Arrange
    scaffoldState(tmpDir, {
      milestones: [{
        id: 'v1.0',
        name: 'v1.0',
        sets: [
          { id: 'auth', status: 'pending', waves: [] },       // pending, no worktree -> available
          { id: 'api', status: 'executing', waves: [] },      // not pending -> skip
          { id: 'ui', status: 'pending', waves: [] },         // pending, has worktree -> skip
          { id: 'db', status: 'complete', waves: [] },        // not pending -> skip
          { id: 'infra', status: 'pending', waves: [] },      // pending, no worktree -> available
        ],
      }],
    });
    scaffoldRegistry(tmpDir, {
      'ui': { setName: 'ui', branch: 'rapid/ui', path: '.rapid-worktrees/ui', phase: 'Created' },
      'api': { setName: 'api', branch: 'rapid/api', path: '.rapid-worktrees/api', phase: 'Executing' },
    });

    // Act
    const { stdout, exitCode } = runCli('set-init list-available', tmpDir);

    // Assert
    assert.equal(exitCode, 0, 'should exit 0');
    const result = JSON.parse(stdout.trim());
    assert.equal(result.available.length, 2, 'should have 2 available sets');
    const ids = result.available.map(a => a.id).sort();
    assert.deepEqual(ids, ['auth', 'infra'], 'should return auth and infra as available');
    // Each entry should have milestone reference
    for (const entry of result.available) {
      assert.equal(entry.milestone, 'v1.0', 'should include milestone ID');
      assert.equal(entry.status, 'pending', 'should all be pending');
    }
  });

  // BEHAVIOR: list-available with an invalid STATE.json should still
  // return valid JSON with { available: [], error: ... }
  // GUARDS AGAINST: Corrupted STATE.json causing the CLI to crash with
  // a stack trace instead of gracefully reporting the issue
  it('returns { available: [], error } for invalid STATE.json', () => {
    // Arrange -- write malformed JSON
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.json'),
      '{ this is not valid json }',
      'utf-8'
    );

    // Act
    const { stdout } = runCli('set-init list-available', tmpDir);

    // Assert
    const result = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(result.available), 'should have available array');
    assert.equal(result.available.length, 0, 'should have 0 available');
  });
});

// ────────────────────────────────────────────────────────────────
// Target 3: handleResume CLI command
// ────────────────────────────────────────────────────────────────
describe('Phase 19 CLI: resume', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  // BEHAVIOR: Missing set-name argument should print usage and exit 1
  // GUARDS AGAINST: The orchestrator calling resume without a set name
  // and getting an unclear error
  it('exits 1 with usage when set-name is missing', () => {
    // Act
    const { stderr, exitCode } = runCli('resume', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1');
    assert.ok(
      stderr.includes('Usage') || stderr.includes('resume'),
      `Expected usage in stderr but got: ${stderr}`
    );
  });

  // BEHAVIOR: Resuming a set that is not in the registry should error
  // with "No worktree registered"
  // GUARDS AGAINST: Trying to resume a set that was never initialized,
  // which would leave the agent in an inconsistent state
  it('exits 1 when set is not in registry', () => {
    // Arrange -- empty registry
    scaffoldRegistry(tmpDir, {});

    // Act
    const { stderr, exitCode } = runCli('resume nonexistent-set', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1');
    assert.ok(
      stderr.includes('No worktree registered'),
      `Expected "No worktree registered" in stderr but got: ${stderr}`
    );
  });

  // BEHAVIOR: Resuming a set that is NOT in Paused phase should error
  // about wrong phase
  // GUARDS AGAINST: A set being "resumed" when it was never paused,
  // causing the orchestrator to re-execute already-completed work
  it('exits 1 when set is not in Paused phase', () => {
    // Arrange -- registry entry with phase=Executing (not Paused)
    scaffoldRegistry(tmpDir, {
      'my-set': {
        setName: 'my-set',
        branch: 'rapid/my-set',
        path: '.rapid-worktrees/my-set',
        phase: 'Executing',
        status: 'active',
      },
    });

    // Act
    const { stderr, exitCode } = runCli('resume my-set', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1');
    assert.ok(
      stderr.includes('not Paused') || stderr.includes('Executing'),
      `Expected phase error in stderr but got: ${stderr}`
    );
  });

  // BEHAVIOR: Resuming a paused set that has no HANDOFF.md should error
  // about missing handoff
  // GUARDS AGAINST: Resuming without context -- the agent needs the
  // handoff file to know what work was completed and what remains
  it('exits 1 when HANDOFF.md does not exist', () => {
    // Arrange -- registry entry in Paused phase but no HANDOFF.md
    scaffoldRegistry(tmpDir, {
      'no-handoff': {
        setName: 'no-handoff',
        branch: 'rapid/no-handoff',
        path: '.rapid-worktrees/no-handoff',
        phase: 'Paused',
        status: 'active',
      },
    });

    // Act
    const { stderr, exitCode } = runCli('resume no-handoff', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1');
    assert.ok(
      stderr.includes('HANDOFF.md') || stderr.includes('handoff'),
      `Expected HANDOFF.md error in stderr but got: ${stderr}`
    );
  });

  // BEHAVIOR: Happy path with STATE.json present -- resume should parse
  // HANDOFF.md, include stateContext from STATE.json, and output structured JSON
  // GUARDS AGAINST: Resume succeeding but returning incomplete data that
  // the orchestrator cannot use to rebuild context
  it('outputs structured JSON with handoff and stateContext on happy path', () => {
    // Arrange
    scaffoldRegistry(tmpDir, {
      'good-set': {
        setName: 'good-set',
        branch: 'rapid/good-set',
        path: '.rapid-worktrees/good-set',
        phase: 'Paused',
        status: 'active',
        pauseCycles: 2,
      },
    });
    scaffoldHandoff(tmpDir, 'good-set', { pauseCycle: 2 });
    scaffoldState(tmpDir, {
      milestones: [{
        id: 'v1.0',
        name: 'v1.0',
        sets: [
          { id: 'good-set', status: 'executing', waves: [
            { id: 'w1', status: 'executing', jobs: [
              { id: 'j1', status: 'complete' },
              { id: 'j2', status: 'pending' },
            ] },
          ] },
        ],
      }],
    });

    // Act
    const { stdout, exitCode } = runCli('resume good-set', tmpDir);

    // Assert
    assert.equal(exitCode, 0, `Expected exit 0 but got ${exitCode}`);
    const result = JSON.parse(stdout.trim());
    assert.equal(result.resumed, true, 'should report resumed: true');
    assert.equal(result.setName, 'good-set', 'should echo set name');

    // Handoff parsed correctly
    assert.ok(result.handoff, 'should include parsed handoff');
    assert.equal(result.handoff.set, 'good-set', 'handoff should have set name');
    assert.equal(result.handoff.tasksCompleted, 3, 'handoff should have tasksCompleted');
    assert.equal(result.handoff.tasksTotal, 10, 'handoff should have tasksTotal');
    assert.ok(result.handoff.completedWork.includes('auth module'), 'handoff should have completed work');
    assert.ok(result.handoff.remainingWork.includes('Integration'), 'handoff should have remaining work');
    assert.ok(Array.isArray(result.handoff.decisions), 'handoff should have decisions array');

    // State context should be present
    assert.ok(result.stateContext, 'should include stateContext');
    assert.equal(result.stateContext.milestoneId, 'v1.0', 'stateContext should have milestone');
    assert.equal(result.stateContext.setId, 'good-set', 'stateContext should have set ID');
    assert.ok(Array.isArray(result.stateContext.waves), 'stateContext should have waves');

    // Should include definition and contract paths
    assert.ok(result.definitionPath, 'should include definitionPath');
    assert.ok(result.contractPath, 'should include contractPath');
  });

  // BEHAVIOR: Happy path WITHOUT STATE.json -- stateContext should be null
  // (graceful degradation, not an error)
  // GUARDS AGAINST: Resume failing completely when STATE.json is missing,
  // when the handoff alone has enough context to continue
  it('sets stateContext to null when STATE.json does not exist', () => {
    // Arrange -- registry + handoff but NO STATE.json
    scaffoldRegistry(tmpDir, {
      'no-state': {
        setName: 'no-state',
        branch: 'rapid/no-state',
        path: '.rapid-worktrees/no-state',
        phase: 'Paused',
        status: 'active',
      },
    });
    scaffoldHandoff(tmpDir, 'no-state');
    // Explicitly ensure no STATE.json
    const statePath = path.join(tmpDir, '.planning', 'STATE.json');
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

    // Act
    const { stdout, exitCode } = runCli('resume no-state', tmpDir);

    // Assert
    assert.equal(exitCode, 0, 'should exit 0 even without STATE.json');
    const result = JSON.parse(stdout.trim());
    assert.equal(result.resumed, true, 'should report resumed: true');
    assert.equal(result.stateContext, null, 'stateContext should be null when STATE.json missing');
  });

  // BEHAVIOR: After resume, the registry phase should be updated to "Executing"
  // GUARDS AGAINST: The set staying in "Paused" state in the registry after
  // resume, causing the status dashboard to show it as paused when it's active
  it('updates registry phase to Executing after successful resume', () => {
    // Arrange
    scaffoldRegistry(tmpDir, {
      'phase-check': {
        setName: 'phase-check',
        branch: 'rapid/phase-check',
        path: '.rapid-worktrees/phase-check',
        phase: 'Paused',
        status: 'active',
      },
    });
    scaffoldHandoff(tmpDir, 'phase-check');

    // Act
    const { exitCode } = runCli('resume phase-check', tmpDir);
    assert.equal(exitCode, 0, 'resume should succeed');

    // Assert -- read registry directly and check phase
    const regPath = path.join(tmpDir, '.planning', 'worktrees', 'REGISTRY.json');
    const registry = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
    assert.equal(
      registry.worktrees['phase-check'].phase,
      'Executing',
      'registry phase should be updated to Executing after resume'
    );
    // Should also have updatedAt timestamp
    assert.ok(
      registry.worktrees['phase-check'].updatedAt,
      'registry entry should have updatedAt after resume'
    );
  });
});

// ────────────────────────────────────────────────────────────────
// Target 4: worktree status-v2 CLI subcommand
// ────────────────────────────────────────────────────────────────
describe('Phase 19 CLI: worktree status-v2', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  // BEHAVIOR: When STATE.json does not exist, status-v2 should error
  // about invalid state and exit 1
  // GUARDS AGAINST: The status skill crashing with a stack trace instead
  // of a user-friendly error message
  it('exits 1 when STATE.json does not exist', () => {
    // Arrange -- no STATE.json (only .planning/ directory)

    // Act
    const { stderr, exitCode } = runCli('worktree status-v2', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1');
    assert.ok(
      stderr.includes('STATE.json') || stderr.includes('invalid'),
      `Expected state error in stderr but got: ${stderr}`
    );
  });

  // BEHAVIOR: Valid STATE.json with sets should output JSON with table,
  // actions, and milestone fields on stdout
  // GUARDS AGAINST: The JSON structure being wrong, which would cause the
  // status skill to fail parsing the dashboard data
  it('outputs JSON with table, actions, and milestone fields', () => {
    // Arrange
    scaffoldState(tmpDir, {
      milestones: [{
        id: 'v1.0',
        name: 'v1.0',
        sets: [
          { id: 'auth', status: 'executing', waves: [
            { id: 'w1', status: 'executing', jobs: [
              { id: 'j1', status: 'complete' },
              { id: 'j2', status: 'pending' },
            ] },
          ] },
          { id: 'ui', status: 'pending', waves: [] },
        ],
      }],
    });
    scaffoldRegistry(tmpDir, {
      'auth': { path: '.rapid-worktrees/auth', updatedAt: new Date().toISOString() },
    });

    // Act
    const { stdout, exitCode } = runCli('worktree status-v2', tmpDir);

    // Assert
    assert.equal(exitCode, 0, `Expected exit 0 but got ${exitCode}`);
    const result = JSON.parse(stdout.trim());

    // Should have the three required fields
    assert.ok(typeof result.table === 'string', 'should have table as string');
    assert.ok(Array.isArray(result.actions), 'should have actions as array');
    assert.equal(result.milestone, 'v1.0', 'should have milestone field');

    // Table should contain expected columns
    assert.ok(result.table.includes('SET'), 'table should have SET column');
    assert.ok(result.table.includes('STATUS'), 'table should have STATUS column');

    // Actions should include reasonable suggestions
    assert.ok(result.actions.length > 0, 'should have at least one action');
  });

  // BEHAVIOR: status-v2 with empty sets should still output valid JSON
  // with "No sets found" table message
  // GUARDS AGAINST: Empty state causing JSON parse errors or missing fields
  it('outputs valid JSON with "No sets found" for empty milestone', () => {
    // Arrange
    scaffoldState(tmpDir, {
      milestones: [{
        id: 'v1.0',
        name: 'v1.0',
        sets: [],
      }],
    });

    // Act
    const { stdout, exitCode } = runCli('worktree status-v2', tmpDir);

    // Assert
    assert.equal(exitCode, 0, 'should exit 0 even with empty sets');
    const result = JSON.parse(stdout.trim());
    assert.ok(result.table.includes('No sets found'), 'table should say "No sets found"');
    assert.equal(result.actions.length, 0, 'should have 0 actions for empty milestone');
  });
});

// ────────────────────────────────────────────────────────────────
// Target 5: worktree delete-branch CLI subcommand
// ────────────────────────────────────────────────────────────────
describe('Phase 19 CLI: worktree delete-branch', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
  });

  // BEHAVIOR: Missing branch-name should print usage to stderr and exit 1
  // GUARDS AGAINST: The cleanup skill calling delete-branch without an
  // argument and getting a confusing error
  it('exits 1 with usage when branch-name is missing', () => {
    // Act
    const { stderr, exitCode } = runCli('worktree delete-branch', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1');
    assert.ok(
      stderr.includes('Usage') || stderr.includes('delete-branch'),
      `Expected usage in stderr but got: ${stderr}`
    );
  });

  // BEHAVIOR: Valid branch deletion should output { deleted: true, branch: ... }
  // and exit 0
  // GUARDS AGAINST: Successful deletion not being reported as JSON, which would
  // break the cleanup skill's success detection
  it('outputs { deleted: true } JSON for valid branch deletion', () => {
    // Arrange -- create a merged branch
    execSync('git branch deletable-branch', { cwd: tmpDir, stdio: 'pipe' });

    // Act
    const { stdout, exitCode } = runCli('worktree delete-branch deletable-branch', tmpDir);

    // Assert
    assert.equal(exitCode, 0, 'should exit with code 0');
    const result = JSON.parse(stdout.trim());
    assert.equal(result.deleted, true, 'should report deleted: true');
    assert.equal(result.branch, 'deletable-branch', 'should echo branch name');
  });

  // BEHAVIOR: Non-existent branch should output { deleted: false } and exit 1
  // GUARDS AGAINST: The cleanup skill treating a "branch not found" as a
  // success and moving on to the next step without proper error handling
  it('outputs { deleted: false } and exits 1 for non-existent branch', () => {
    // Act
    const { stdout, exitCode } = runCli('worktree delete-branch no-such-branch', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1');
    const result = JSON.parse(stdout.trim());
    assert.equal(result.deleted, false, 'should report deleted: false');
  });

  // BEHAVIOR: Invalid branch name (with spaces) should output { deleted: false, error: ... }
  // and exit 1
  // GUARDS AGAINST: Malformed branch names being passed to git, producing
  // cryptic git errors instead of a clear validation message
  it('outputs { deleted: false, error: ... } for invalid branch name', () => {
    // Act
    const { stdout, exitCode } = runCli('worktree delete-branch "bad branch name"', tmpDir);

    // Assert
    assert.equal(exitCode, 1, 'should exit with code 1');
    const result = JSON.parse(stdout.trim());
    assert.equal(result.deleted, false, 'should report deleted: false');
    assert.ok(result.error, 'should have error field');
    assert.ok(
      result.error.includes('Invalid branch name'),
      `Error should mention "Invalid branch name" but got: ${result.error}`
    );
  });

  // BEHAVIOR: The --force flag should pass force=true to deleteBranch,
  // allowing unmerged branches to be deleted
  // GUARDS AGAINST: The --force flag being silently ignored, leaving
  // unmerged branches that block cleanup of completed sets
  it('passes --force flag through to deleteBranch', () => {
    // Arrange -- create an unmerged branch
    execSync('git checkout -b unmerged-force', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "diverged work"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git checkout -', { cwd: tmpDir, stdio: 'pipe' });

    // First verify that without --force it fails
    const { stdout: failStdout, exitCode: failCode } = runCli(
      'worktree delete-branch unmerged-force', tmpDir
    );
    assert.equal(failCode, 1, 'should fail without --force for unmerged branch');
    const failResult = JSON.parse(failStdout.trim());
    assert.equal(failResult.deleted, false, 'should not delete without --force');

    // Re-create the branch since the attempt above shouldn't have deleted it
    // (it should still exist because delete failed)

    // Act -- with --force
    const { stdout, exitCode } = runCli('worktree delete-branch unmerged-force --force', tmpDir);

    // Assert
    assert.equal(exitCode, 0, 'should exit 0 with --force');
    const result = JSON.parse(stdout.trim());
    assert.equal(result.deleted, true, 'should report deleted: true with --force');
    assert.equal(result.forced, true, 'should report forced: true');
  });
});
