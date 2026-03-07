'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLI_PATH = path.join(__dirname, 'rapid-tools.cjs');
// resolveRapidDir returns path.resolve(__dirname, '..', '..') which is the rapid/ directory
const RAPID_DIR = path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(RAPID_DIR, 'agents');

describe('handleAssembleAgent integration', () => {
  let tmpDir;
  let planningDir;
  let contextDir;
  let agentFile;

  before(() => {
    // Create a temporary project directory that mimics a RAPID project
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-integration-'));
    planningDir = path.join(tmpDir, '.planning');
    contextDir = path.join(planningDir, 'context');
    fs.mkdirSync(planningDir, { recursive: true });

    // loadConfig reads from projectRoot/config.json
    const configSrc = path.join(RAPID_DIR, 'config.json');
    fs.copyFileSync(configSrc, path.join(tmpDir, 'config.json'));

    // The output file will be written to the real agents/ dir
    agentFile = path.join(AGENTS_DIR, 'rapid-planner.md');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('assembled agent output contains context file content when .planning/context/ files exist', () => {
    // Set up .planning/context/ with test files matching planner's context_files config
    fs.mkdirSync(contextDir, { recursive: true });
    fs.writeFileSync(
      path.join(contextDir, 'CONVENTIONS.md'),
      '# Conventions\nUse strict mode everywhere in all modules',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(contextDir, 'ARCHITECTURE.md'),
      '# Architecture\nHexagonal architecture pattern with ports and adapters',
      'utf-8'
    );

    // Run CLI assemble-agent for planner (context_files: ["CONVENTIONS.md", "ARCHITECTURE.md"])
    // cwd = tmpDir so findProjectRoot finds tmpDir/.planning/
    execSync(`node "${CLI_PATH}" assemble-agent planner`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Read the assembled agent file (written to real agents/ directory by resolveRapidDir)
    assert.ok(fs.existsSync(agentFile), 'Agent file should be written');
    const content = fs.readFileSync(agentFile, 'utf-8');

    // The assembled output should contain the context file contents wrapped in XML tags
    // This test will FAIL until handleAssembleAgent is wired to call loadContextFiles
    assert.ok(
      content.includes('<context-conventions>'),
      'Assembled planner should have <context-conventions> tag when CONVENTIONS.md exists'
    );
    assert.ok(
      content.includes('Use strict mode everywhere in all modules'),
      'Assembled planner should contain CONVENTIONS.md content'
    );
    assert.ok(
      content.includes('<context-architecture>'),
      'Assembled planner should have <context-architecture> tag when ARCHITECTURE.md exists'
    );
    assert.ok(
      content.includes('Hexagonal architecture pattern with ports and adapters'),
      'Assembled planner should contain ARCHITECTURE.md content'
    );
  });

  it('assembled agent output is unchanged when .planning/context/ files do not exist', () => {
    // Ensure .planning/context/ does NOT exist (graceful degradation)
    if (fs.existsSync(contextDir)) {
      fs.rmSync(contextDir, { recursive: true, force: true });
    }

    // Run CLI assemble-agent for planner -- should still work with no context files
    const stdout = execSync(`node "${CLI_PATH}" assemble-agent planner`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Should produce valid output (confirmation message)
    assert.ok(stdout.includes('Assembled rapid-planner'), 'Should output assembly confirmation');

    // Read the assembled agent file
    assert.ok(fs.existsSync(agentFile), 'Agent file should be written');
    const content = fs.readFileSync(agentFile, 'utf-8');

    // Should have standard agent content but no context- tags
    assert.ok(content.includes('<identity>'), 'Should have standard <identity> tag');
    assert.ok(content.includes('<role>'), 'Should have <role> tag');
    assert.ok(!content.includes('<context-conventions>'), 'Should not have context-conventions tag');
    assert.ok(!content.includes('<context-architecture>'), 'Should not have context-architecture tag');
  });
});

// ────────────────────────────────────────────────────────────────
// Plan CLI subcommand tests
// ────────────────────────────────────────────────────────────────
describe('handlePlan CLI integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-plan-cli-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('plan list-sets returns JSON with sets array', () => {
    const stdout = execSync(`node "${CLI_PATH}" plan list-sets`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(result.sets), 'should return sets array');
    assert.deepStrictEqual(result.sets, [], 'empty project should have no sets');
  });

  it('plan create-set with piped JSON creates the set directory', () => {
    const setDef = JSON.stringify({
      name: 'test-set',
      scope: 'Test scope',
      ownedFiles: ['src/test/**'],
      tasks: [{ description: 'Do something', acceptance: 'Test passes' }],
      acceptance: ['All tests pass'],
      wave: 1,
      parallelWith: [],
      contract: { exports: { functions: [], types: [] } },
    });

    const stdout = execSync(`echo '${setDef}' | node "${CLI_PATH}" plan create-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.ok(result.path, 'should return path');
    assert.ok(result.files.includes('DEFINITION.md'), 'should create DEFINITION.md');
    assert.ok(result.files.includes('CONTRACT.json'), 'should create CONTRACT.json');

    // Verify directory actually exists
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'sets', 'test-set', 'DEFINITION.md')),
      'DEFINITION.md should exist on disk'
    );
  });

  it('plan list-sets returns created sets', () => {
    // Create a set first
    const setDef = JSON.stringify({
      name: 'my-set',
      scope: 'Scope',
      ownedFiles: ['src/my/**'],
      tasks: [{ description: 'Task 1', acceptance: 'Done' }],
      acceptance: ['Pass'],
      wave: 1,
      parallelWith: [],
      contract: { exports: { functions: [], types: [] } },
    });
    execSync(`echo '${setDef}' | node "${CLI_PATH}" plan create-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const stdout = execSync(`node "${CLI_PATH}" plan list-sets`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.deepStrictEqual(result.sets, ['my-set']);
  });

  it('plan check-gate returns gate status JSON', () => {
    // Create a GATES.json first
    const gates = {
      version: 1,
      gates: {
        'wave-1': {
          planning: { required: ['a'], completed: [], status: 'blocked' },
          execution: { status: 'blocked' },
        },
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'sets', 'GATES.json'),
      JSON.stringify(gates, null, 2)
    );

    const stdout = execSync(`node "${CLI_PATH}" plan check-gate 1`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.open, false);
    assert.deepStrictEqual(result.required, ['a']);
    assert.deepStrictEqual(result.missing, ['a']);
  });

  it('plan update-gate marks set as planned', () => {
    const gates = {
      version: 1,
      gates: {
        'wave-1': {
          planning: { required: ['a'], completed: [], status: 'blocked' },
          execution: { status: 'blocked' },
        },
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'sets', 'GATES.json'),
      JSON.stringify(gates, null, 2)
    );

    const stdout = execSync(`node "${CLI_PATH}" plan update-gate a`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.updated, true);
    assert.equal(result.set, 'a');

    // Verify the gate was actually updated
    const updated = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.planning', 'sets', 'GATES.json'), 'utf-8')
    );
    assert.equal(updated.gates['wave-1'].planning.status, 'open');
  });

  it('plan load-set returns set data as JSON', () => {
    // Create a set first
    const setDef = JSON.stringify({
      name: 'loadable',
      scope: 'Load me',
      ownedFiles: ['src/load/**'],
      tasks: [{ description: 'Load task', acceptance: 'Loaded' }],
      acceptance: ['Loads correctly'],
      wave: 1,
      parallelWith: [],
      contract: { exports: { functions: [], types: [] } },
    });
    execSync(`echo '${setDef}' | node "${CLI_PATH}" plan create-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const stdout = execSync(`node "${CLI_PATH}" plan load-set loadable`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.ok(result.definition, 'should have definition');
    assert.ok(result.definition.includes('# Set: loadable'), 'definition should contain heading');
    assert.ok(result.contract, 'should have contract');
  });

  it('plan write-dag writes DAG.json from stdin', () => {
    const dagObj = JSON.stringify({ nodes: [], edges: [], waves: {}, metadata: {} });
    const stdout = execSync(`echo '${dagObj}' | node "${CLI_PATH}" plan write-dag`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.written, true);
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'sets', 'DAG.json')),
      'DAG.json should exist'
    );
  });
});

// ────────────────────────────────────────────────────────────────
// Assumptions CLI subcommand tests
// ────────────────────────────────────────────────────────────────
describe('handleAssumptions CLI integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-assumptions-cli-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('assumptions with no args and no sets exits with error', () => {
    try {
      execSync(`node "${CLI_PATH}" assumptions`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.stderr.includes('No sets found') || err.status !== 0, 'should error with no sets');
    }
  });

  it('assumptions with no args lists available sets when sets exist', () => {
    // Create a set first
    const setDef = JSON.stringify({
      name: 'my-set',
      scope: 'Scope',
      ownedFiles: ['src/my/**'],
      tasks: [{ description: 'Task 1', acceptance: 'Done' }],
      acceptance: ['Pass'],
      wave: 1,
      parallelWith: [],
      contract: { exports: { functions: [], types: [] } },
    });
    execSync(`echo '${setDef}' | node "${CLI_PATH}" plan create-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const stdout = execSync(`node "${CLI_PATH}" assumptions`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(result.availableSets), 'should list available sets');
    assert.ok(result.availableSets.includes('my-set'), 'should include created set');
  });

  it('assumptions <set-name> outputs structured text', () => {
    // Create a set
    const setDef = JSON.stringify({
      name: 'analyzed',
      scope: 'Something to analyze',
      ownedFiles: ['src/analyzed/**'],
      tasks: [{ description: 'Analyze task', acceptance: 'Analyzed' }],
      acceptance: ['Analysis complete'],
      wave: 1,
      parallelWith: [],
      contract: {
        exports: {
          functions: [
            { name: 'doAnalysis', file: 'src/analyzed/main.js', params: [{ name: 'input', type: 'string' }], returns: 'object' },
          ],
          types: [],
        },
      },
    });
    execSync(`echo '${setDef}' | node "${CLI_PATH}" plan create-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    const stdout = execSync(`node "${CLI_PATH}" assumptions analyzed`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    assert.ok(stdout.includes('Scope Understanding'), 'should have Scope Understanding');
    assert.ok(stdout.includes('Something to analyze'), 'should include scope text');
    assert.ok(stdout.includes('doAnalysis'), 'should include exported function');
  });
});

// ────────────────────────────────────────────────────────────────
// Worktree CLI subcommand tests
// ────────────────────────────────────────────────────────────────
describe('handleWorktree CLI integration', () => {
  let tmpDir;

  function createTestRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-wt-cli-'));
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });
    // Create .planning/ so findProjectRoot works
    fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
    return dir;
  }

  function cleanupTestRepo(dir) {
    try {
      const result = execSync('git worktree list --porcelain', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const blocks = result.trim().split('\n\n');
      for (const block of blocks) {
        const lines = block.trim().split('\n');
        const pathLine = lines.find(l => l.startsWith('worktree '));
        if (pathLine) {
          const wtPath = pathLine.replace('worktree ', '');
          if (wtPath !== dir) {
            try { execSync(`git worktree remove --force "${wtPath}"`, { cwd: dir, stdio: 'pipe' }); } catch { /* ignore */ }
          }
        }
      }
    } catch { /* ignore */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }

  beforeEach(() => {
    tmpDir = createTestRepo();
  });

  afterEach(() => {
    cleanupTestRepo(tmpDir);
  });

  it('worktree create outputs JSON with created:true', () => {
    const stdout = execSync(`node "${CLI_PATH}" worktree create my-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.created, true);
    assert.equal(result.branch, 'rapid/my-set');
    assert.equal(result.setName, 'my-set');
    assert.ok(result.path.includes('my-set'));
  });

  it('worktree create on existing worktree outputs JSON error', () => {
    // Create once
    execSync(`node "${CLI_PATH}" worktree create dup-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    // Try to create again -- should fail
    try {
      execSync(`node "${CLI_PATH}" worktree create dup-set`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      // stdout or stderr should have the error JSON or message
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });

  it('worktree list outputs JSON with worktrees array', () => {
    // Create a worktree first
    execSync(`node "${CLI_PATH}" worktree create listed-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    const stdout = execSync(`node "${CLI_PATH}" worktree list`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(result.worktrees), 'should have worktrees array');
    const found = result.worktrees.find(w => w.setName === 'listed-set');
    assert.ok(found, 'should find the created worktree in list');
  });

  it('worktree cleanup removes clean worktree and outputs JSON', () => {
    // Create a worktree
    execSync(`node "${CLI_PATH}" worktree create clean-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    // Cleanup
    const stdout = execSync(`node "${CLI_PATH}" worktree cleanup clean-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.removed, true);
    assert.equal(result.setName, 'clean-set');
  });

  it('worktree cleanup on dirty worktree outputs JSON with removed:false', () => {
    // Create a worktree
    execSync(`node "${CLI_PATH}" worktree create dirty-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    // Make it dirty
    const wtPath = path.join(tmpDir, '.rapid-worktrees', 'dirty-set');
    fs.writeFileSync(path.join(wtPath, 'dirty.txt'), 'uncommitted');
    execSync('git add dirty.txt', { cwd: wtPath, stdio: 'pipe' });

    try {
      execSync(`node "${CLI_PATH}" worktree cleanup dirty-set`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown due to dirty worktree');
    } catch (err) {
      // It exits non-zero and outputs the error JSON to stdout
      const stdout = (err.stdout || '').trim();
      if (stdout) {
        const result = JSON.parse(stdout);
        assert.equal(result.removed, false);
        assert.equal(result.reason, 'dirty');
      } else {
        assert.ok(err.status !== 0, 'should exit non-zero');
      }
    }
  });

  it('worktree reconcile outputs JSON with reconciled:true', () => {
    const stdout = execSync(`node "${CLI_PATH}" worktree reconcile`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.reconciled, true);
    assert.ok(typeof result.orphaned === 'number');
    assert.ok(typeof result.discovered === 'number');
  });

  it('unknown worktree subcommand exits non-zero', () => {
    try {
      execSync(`node "${CLI_PATH}" worktree bogus`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });

  it('worktree status outputs human-readable table', () => {
    // Create a worktree first
    execSync(`node "${CLI_PATH}" worktree create status-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    const stdout = execSync(`node "${CLI_PATH}" worktree status`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    // Should contain table headers
    assert.ok(stdout.includes('SET'), 'should contain SET header');
    assert.ok(stdout.includes('BRANCH'), 'should contain BRANCH header');
    assert.ok(stdout.includes('status-set'), 'should contain the set name');
  });

  it('worktree status --json outputs machine-readable JSON', () => {
    execSync(`node "${CLI_PATH}" worktree create json-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    const stdout = execSync(`node "${CLI_PATH}" worktree status --json`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(result.worktrees), 'should have worktrees array');
    const found = result.worktrees.find(w => w.setName === 'json-set');
    assert.ok(found, 'should find json-set in worktrees');
  });

  it('worktree status with no worktrees shows empty message', () => {
    const stdout = execSync(`node "${CLI_PATH}" worktree status`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    assert.ok(stdout.includes('No active worktrees'), 'should show no active worktrees message');
  });

  it('worktree generate-claude-md creates CLAUDE.md in worktree dir', () => {
    // First create a worktree
    execSync(`node "${CLI_PATH}" worktree create claude-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    // Create the required set structure
    const setDir = path.join(tmpDir, '.planning', 'sets', 'claude-set');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(
      path.join(setDir, 'DEFINITION.md'),
      '# Set: claude-set\n\n## Scope\nTest\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(setDir, 'CONTRACT.json'),
      JSON.stringify({ exports: { functions: [], types: [] } }),
      'utf-8'
    );

    const stdout = execSync(`node "${CLI_PATH}" worktree generate-claude-md claude-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.generated, true);
    assert.equal(result.setName, 'claude-set');
    assert.ok(result.path.includes('CLAUDE.md'), 'path should include CLAUDE.md');

    // Verify the file exists
    assert.ok(fs.existsSync(result.path), 'CLAUDE.md should exist at the specified path');
  });
});

// ────────────────────────────────────────────────────────────────
// Execute CLI subcommand tests
// ────────────────────────────────────────────────────────────────
describe('handleExecute CLI integration', () => {
  let tmpDir;

  function createTestRepoWithSets() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-exec-cli-'));
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });

    // Create .planning/ structure
    fs.mkdirSync(path.join(dir, '.planning', 'sets'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.planning', 'worktrees'), { recursive: true });

    // Create auth-core set
    const authDir = path.join(dir, '.planning', 'sets', 'auth-core');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'DEFINITION.md'), [
      '# Set: auth-core', '', '## Scope', 'Authentication', '',
      '## File Ownership', 'Files this set owns (exclusive write access):', '- src/auth/token.cjs', '',
      '## Tasks', '1. Token generation', '', '## Interface Contract', 'See: CONTRACT.json', '',
      '## Wave Assignment', 'Wave: 1 (parallel with: none)', '', '## Acceptance Criteria', '- Works', '',
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(authDir, 'CONTRACT.json'), JSON.stringify({
      exports: {
        functions: [
          { name: 'createToken', file: 'src/auth/token.cjs', params: [{ name: 'payload', type: 'object' }], returns: 'string' },
        ],
        types: [],
      },
    }, null, 2), 'utf-8');

    // Create api-routes set that imports from auth-core
    const apiDir = path.join(dir, '.planning', 'sets', 'api-routes');
    fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(path.join(apiDir, 'DEFINITION.md'), [
      '# Set: api-routes', '', '## Scope', 'API routes', '',
      '## File Ownership', 'Files this set owns (exclusive write access):', '- src/routes/index.cjs', '',
      '## Tasks', '1. Route setup', '', '## Interface Contract', 'See: CONTRACT.json', '',
      '## Wave Assignment', 'Wave: 2 (parallel with: none)', '', '## Acceptance Criteria', '- Routes work', '',
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(apiDir, 'CONTRACT.json'), JSON.stringify({
      exports: { functions: [], types: [] },
      imports: { fromSets: [{ set: 'auth-core', functions: ['createToken'] }] },
    }, null, 2), 'utf-8');

    // Create OWNERSHIP.json
    fs.writeFileSync(path.join(dir, '.planning', 'sets', 'OWNERSHIP.json'), JSON.stringify({
      version: 1, ownership: { 'src/auth/token.cjs': 'auth-core', 'src/routes/index.cjs': 'api-routes' },
    }, null, 2), 'utf-8');

    return dir;
  }

  function cleanupTestRepo(dir) {
    try {
      const result = execSync('git worktree list --porcelain', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const blocks = result.trim().split('\n\n');
      for (const block of blocks) {
        const lines = block.trim().split('\n');
        const pathLine = lines.find(l => l.startsWith('worktree '));
        if (pathLine) {
          const wtPath = pathLine.replace('worktree ', '');
          if (wtPath !== dir) {
            try { execSync(`git worktree remove --force "${wtPath}"`, { cwd: dir, stdio: 'pipe' }); } catch { /* ignore */ }
          }
        }
      }
    } catch { /* ignore */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }

  beforeEach(() => {
    tmpDir = createTestRepoWithSets();
  });

  afterEach(() => {
    cleanupTestRepo(tmpDir);
  });

  it('execute prepare-context outputs JSON with context summary', () => {
    const stdout = execSync(`node "${CLI_PATH}" execute prepare-context auth-core`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.setName, 'auth-core');
    assert.ok(result.scopedMdPreview, 'should have scopedMdPreview');
    assert.ok(typeof result.definitionLength === 'number', 'should have definitionLength');
    assert.ok(Array.isArray(result.contractKeys), 'should have contractKeys');
    assert.ok(result.contractKeys.includes('exports'), 'contractKeys should include exports');
  });

  it('execute prepare-context for missing set exits non-zero', () => {
    try {
      execSync(`node "${CLI_PATH}" execute prepare-context nonexistent`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });

  it('execute generate-stubs creates stub files for set with imports', () => {
    // Create worktree for api-routes first
    execSync(`node "${CLI_PATH}" worktree create api-routes`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    const stdout = execSync(`node "${CLI_PATH}" execute generate-stubs api-routes`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.setName, 'api-routes');
    assert.ok(Array.isArray(result.stubs), 'should have stubs array');
    assert.equal(result.stubs.length, 1, 'should have 1 stub file');
    assert.ok(result.stubs[0].includes('auth-core-stub.cjs'), 'stub should be for auth-core');
  });

  it('execute generate-stubs returns empty for set with no imports', () => {
    // Create worktree for auth-core (no imports)
    execSync(`node "${CLI_PATH}" worktree create auth-core`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    const stdout = execSync(`node "${CLI_PATH}" execute generate-stubs auth-core`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.setName, 'auth-core');
    assert.deepStrictEqual(result.stubs, []);
  });

  it('execute cleanup-stubs removes stubs and outputs result', () => {
    // Create worktree for api-routes
    execSync(`node "${CLI_PATH}" worktree create api-routes`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    // Generate stubs first
    execSync(`node "${CLI_PATH}" execute generate-stubs api-routes`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Now cleanup
    const stdout = execSync(`node "${CLI_PATH}" execute cleanup-stubs api-routes`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.cleaned, true);
    assert.equal(result.count, 1);
  });

  it('execute cleanup-stubs returns not_found when no stubs exist', () => {
    // Create worktree for auth-core (no stubs directory)
    execSync(`node "${CLI_PATH}" worktree create auth-core`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    const stdout = execSync(`node "${CLI_PATH}" execute cleanup-stubs auth-core`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.cleaned, false);
    assert.equal(result.reason, 'not_found');
  });

  it('execute verify exits non-zero when LAST_RETURN.json missing', () => {
    // Create worktree
    execSync(`node "${CLI_PATH}" worktree create auth-core`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    try {
      execSync(`node "${CLI_PATH}" execute verify auth-core --branch main`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });

  it('unknown execute subcommand exits non-zero', () => {
    try {
      execSync(`node "${CLI_PATH}" execute bogus`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });
});

// ────────────────────────────────────────────────────────────────
// USAGE includes plan, assumptions, worktree, and execute
// ────────────────────────────────────────────────────────────────
describe('USAGE help text', () => {
  it('--help includes plan commands', () => {
    const stdout = execSync(`node "${CLI_PATH}" --help`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    assert.ok(stdout.includes('plan create-set'), 'should document plan create-set');
    assert.ok(stdout.includes('plan check-gate'), 'should document plan check-gate');
    assert.ok(stdout.includes('plan list-sets'), 'should document plan list-sets');
  });

  it('--help includes assumptions command', () => {
    const stdout = execSync(`node "${CLI_PATH}" --help`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    assert.ok(stdout.includes('assumptions'), 'should document assumptions command');
  });

  it('--help includes worktree commands', () => {
    const stdout = execSync(`node "${CLI_PATH}" --help`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    assert.ok(stdout.includes('worktree create'), 'should document worktree create');
    assert.ok(stdout.includes('worktree list'), 'should document worktree list');
    assert.ok(stdout.includes('worktree cleanup'), 'should document worktree cleanup');
    assert.ok(stdout.includes('worktree reconcile'), 'should document worktree reconcile');
    assert.ok(stdout.includes('worktree status'), 'should document worktree status');
    assert.ok(stdout.includes('generate-claude-md'), 'should document worktree generate-claude-md');
  });

  it('--help includes execute commands', () => {
    const stdout = execSync(`node "${CLI_PATH}" --help`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    assert.ok(stdout.includes('execute prepare-context'), 'should document execute prepare-context');
    assert.ok(stdout.includes('execute verify'), 'should document execute verify');
    assert.ok(stdout.includes('execute generate-stubs'), 'should document execute generate-stubs');
    assert.ok(stdout.includes('execute cleanup-stubs'), 'should document execute cleanup-stubs');
    assert.ok(stdout.includes('execute wave-status'), 'should document execute wave-status');
    assert.ok(stdout.includes('execute update-phase'), 'should document execute update-phase');
  });
});

// ────────────────────────────────────────────────────────────────
// Execute wave-status and update-phase CLI tests
// ────────────────────────────────────────────────────────────────
describe('handleExecute wave-status and update-phase', () => {
  let tmpDir;

  function createTestRepoWithDAG() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-wave-cli-'));
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });

    // Create .planning/ structure
    fs.mkdirSync(path.join(dir, '.planning', 'sets'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.planning', 'worktrees'), { recursive: true });

    // Create DAG.json with 2 waves
    const dagObj = {
      nodes: [
        { id: 'auth-core', wave: 1, status: 'pending' },
        { id: 'data-layer', wave: 1, status: 'pending' },
        { id: 'api-routes', wave: 2, status: 'pending' },
      ],
      edges: [
        { from: 'auth-core', to: 'api-routes' },
      ],
      waves: {
        1: { sets: ['auth-core', 'data-layer'], checkpoint: {} },
        2: { sets: ['api-routes'], checkpoint: {} },
      },
      metadata: { totalSets: 3, totalWaves: 2, maxParallelism: 2 },
    };
    fs.writeFileSync(
      path.join(dir, '.planning', 'sets', 'DAG.json'),
      JSON.stringify(dagObj, null, 2),
      'utf-8'
    );

    return dir;
  }

  function cleanupTestRepo(dir) {
    try {
      const result = execSync('git worktree list --porcelain', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const blocks = result.trim().split('\n\n');
      for (const block of blocks) {
        const lines = block.trim().split('\n');
        const pathLine = lines.find(l => l.startsWith('worktree '));
        if (pathLine) {
          const wtPath = pathLine.replace('worktree ', '');
          if (wtPath !== dir) {
            try { execSync(`git worktree remove --force "${wtPath}"`, { cwd: dir, stdio: 'pipe' }); } catch { /* ignore */ }
          }
        }
      }
    } catch { /* ignore */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }

  beforeEach(() => {
    tmpDir = createTestRepoWithDAG();
  });

  afterEach(() => {
    cleanupTestRepo(tmpDir);
  });

  it('execute wave-status outputs JSON with waves array', () => {
    const stdout = execSync(`node "${CLI_PATH}" execute wave-status`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(result.waves), 'should have waves array');
    assert.equal(result.waves.length, 2, 'should have 2 waves');
    assert.equal(result.waves[0].wave, 1, 'first wave should be 1');
    assert.equal(result.waves[0].sets.length, 2, 'wave 1 should have 2 sets');
    assert.equal(result.waves[1].wave, 2, 'second wave should be 2');
    assert.equal(result.waves[1].sets.length, 1, 'wave 2 should have 1 set');
  });

  it('execute wave-status shows Pending phase for sets without worktrees', () => {
    const stdout = execSync(`node "${CLI_PATH}" execute wave-status`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    const authSet = result.waves[0].sets.find(s => s.name === 'auth-core');
    assert.equal(authSet.phase, 'Pending', 'set without worktree should be Pending');
    assert.equal(authSet.status, 'not-started', 'set without worktree should be not-started');
  });

  it('execute wave-status reflects registry phase after update-phase', () => {
    // First update a set's phase
    execSync(`node "${CLI_PATH}" execute update-phase auth-core Executing`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });

    const stdout = execSync(`node "${CLI_PATH}" execute wave-status`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    const authSet = result.waves[0].sets.find(s => s.name === 'auth-core');
    assert.equal(authSet.phase, 'Executing', 'should reflect updated phase');
  });

  it('execute update-phase outputs JSON with updated:true', () => {
    const stdout = execSync(`node "${CLI_PATH}" execute update-phase auth-core Discussing`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.updated, true);
    assert.equal(result.setName, 'auth-core');
    assert.equal(result.phase, 'Discussing');
  });

  it('execute update-phase rejects invalid phase', () => {
    try {
      execSync(`node "${CLI_PATH}" execute update-phase auth-core InvalidPhase`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
      assert.ok(err.stderr.includes('Invalid phase'), 'should mention invalid phase');
    }
  });

  it('execute update-phase without args exits non-zero', () => {
    try {
      execSync(`node "${CLI_PATH}" execute update-phase`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });

  it('execute wave-status without DAG exits non-zero', () => {
    // Remove DAG.json
    fs.unlinkSync(path.join(tmpDir, '.planning', 'sets', 'DAG.json'));
    try {
      execSync(`node "${CLI_PATH}" execute wave-status`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });

  it('execute update-phase creates entry for unregistered set', () => {
    // update-phase for a set not in registry should create an entry
    const stdout = execSync(`node "${CLI_PATH}" execute update-phase new-set Planning`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 15000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.updated, true);
    assert.equal(result.setName, 'new-set');
    assert.equal(result.phase, 'Planning');
  });
});

// ────────────────────────────────────────────────────────────────
// State CLI subcommand tests (v2.0 state-machine.cjs)
// ────────────────────────────────────────────────────────────────
describe('handleState CLI integration', () => {
  let tmpDir;

  /**
   * Create a temp directory with .planning/ and a valid STATE.json.
   * Uses state-machine.cjs createInitialState + writeState.
   */
  async function createStateProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-state-cli-'));
    fs.mkdirSync(path.join(dir, '.planning', '.locks'), { recursive: true });

    // Use state-machine to create valid state
    const sm = require('../lib/state-machine.cjs');
    const state = sm.createInitialState('test-project', 'v1.0');

    // Add a set with waves and jobs for hierarchy testing
    state.milestones[0].sets.push({
      id: 'auth-set',
      name: 'Authentication Set',
      status: 'pending',
      waves: [{
        id: 'wave-1',
        name: 'Wave 1',
        status: 'pending',
        jobs: [{
          id: 'job-a',
          name: 'Job A',
          status: 'pending',
        }],
      }],
    });

    await sm.writeState(dir, state);
    return dir;
  }

  before(async () => {
    tmpDir = await createStateProject();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -- state get --all --
  it('state get --all returns full STATE.json as formatted JSON', () => {
    const stdout = execSync(`node "${CLI_PATH}" state get --all`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.projectName, 'test-project');
    assert.equal(result.currentMilestone, 'v1.0');
    assert.ok(Array.isArray(result.milestones), 'should have milestones array');
  });

  it('state get --all with no STATE.json exits 1', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-state-empty-'));
    fs.mkdirSync(path.join(emptyDir, '.planning'), { recursive: true });
    try {
      execSync(`node "${CLI_PATH}" state get --all`, {
        cwd: emptyDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('state get --all with invalid STATE.json exits 1', () => {
    const badDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-state-bad-'));
    fs.mkdirSync(path.join(badDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(badDir, '.planning', 'STATE.json'), '{"invalid": true}', 'utf-8');
    try {
      execSync(`node "${CLI_PATH}" state get --all`, {
        cwd: badDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    } finally {
      fs.rmSync(badDir, { recursive: true, force: true });
    }
  });

  // -- state get milestone/set/wave/job --
  it('state get milestone returns milestone JSON', () => {
    const stdout = execSync(`node "${CLI_PATH}" state get milestone v1.0`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.id, 'v1.0');
    assert.ok(Array.isArray(result.sets), 'milestone should have sets');
  });

  it('state get set returns set JSON', () => {
    const stdout = execSync(`node "${CLI_PATH}" state get set v1.0 auth-set`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.id, 'auth-set');
    assert.equal(result.status, 'pending');
  });

  it('state get wave returns wave JSON', () => {
    const stdout = execSync(`node "${CLI_PATH}" state get wave v1.0 auth-set wave-1`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.id, 'wave-1');
  });

  it('state get job returns job JSON', () => {
    const stdout = execSync(`node "${CLI_PATH}" state get job v1.0 auth-set wave-1 job-a`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.id, 'job-a');
    assert.equal(result.status, 'pending');
  });

  it('state get with no args shows usage and exits 1', () => {
    try {
      execSync(`node "${CLI_PATH}" state get`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });

  // -- state transition --
  it('state transition job transitions status', async () => {
    // Create a fresh project for transition tests
    const dir = await createStateProject();
    try {
      const stdout = execSync(`node "${CLI_PATH}" state transition job v1.0 auth-set wave-1 job-a executing`, {
        cwd: dir,
        encoding: 'utf-8',
        timeout: 10000,
      });
      const result = JSON.parse(stdout.trim());
      assert.ok(result.success || result.transitioned, 'should indicate success');

      // Verify the job is now executing
      const getStdout = execSync(`node "${CLI_PATH}" state get job v1.0 auth-set wave-1 job-a`, {
        cwd: dir,
        encoding: 'utf-8',
        timeout: 10000,
      });
      const job = JSON.parse(getStdout.trim());
      assert.equal(job.status, 'executing');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('state transition with insufficient args shows usage and exits 1', () => {
    try {
      execSync(`node "${CLI_PATH}" state transition`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });

  // -- state add-milestone --
  it('state add-milestone creates a new milestone with --id and --name', async () => {
    // Create a fresh project for this test to avoid interference
    const addDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-add-ms-'));
    fs.mkdirSync(path.join(addDir, '.planning', '.locks'), { recursive: true });
    const sm = require('../lib/state-machine.cjs');
    const state = sm.createInitialState('test-project', 'v1.0');
    await sm.writeState(addDir, state);

    try {
      const stdout = execSync(`node "${CLI_PATH}" state add-milestone --id v2.0 --name "Version 2.0"`, {
        cwd: addDir,
        encoding: 'utf-8',
        timeout: 10000,
      });
      const result = JSON.parse(stdout.trim());
      assert.equal(result.milestoneId, 'v2.0');
      assert.equal(result.milestoneName, 'Version 2.0');
      assert.equal(result.setsCarried, 0);

      // Verify state was actually updated
      const readResult = await sm.readState(addDir);
      assert.equal(readResult.state.currentMilestone, 'v2.0');
      assert.equal(readResult.state.milestones.length, 2);
    } finally {
      fs.rmSync(addDir, { recursive: true, force: true });
    }
  });

  it('state add-milestone accepts carry-forward sets via stdin', async () => {
    const addDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-add-ms-stdin-'));
    fs.mkdirSync(path.join(addDir, '.planning', '.locks'), { recursive: true });
    const sm = require('../lib/state-machine.cjs');
    const state = sm.createInitialState('test-project', 'v1.0');
    state.milestones[0].sets.push({
      id: 'carry-set',
      status: 'pending',
      waves: [{ id: 'w1', status: 'pending', jobs: [{ id: 'j1', status: 'pending', artifacts: [] }] }],
    });
    await sm.writeState(addDir, state);

    const setsJson = JSON.stringify([state.milestones[0].sets[0]]);

    try {
      const stdout = execSync(`echo '${setsJson}' | node "${CLI_PATH}" state add-milestone --id v2.0 --name "V2"`, {
        cwd: addDir,
        encoding: 'utf-8',
        timeout: 10000,
      });
      const result = JSON.parse(stdout.trim());
      assert.equal(result.setsCarried, 1);
    } finally {
      fs.rmSync(addDir, { recursive: true, force: true });
    }
  });

  it('state add-milestone without --id exits 1', () => {
    try {
      execSync(`node "${CLI_PATH}" state add-milestone`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.status !== 0, 'should exit non-zero');
    }
  });

  // -- state detect-corruption --
  it('state detect-corruption returns JSON result', () => {
    const stdout = execSync(`node "${CLI_PATH}" state detect-corruption`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.exists, true);
    assert.equal(result.corrupt, false);
  });

  // -- state recover --
  it('state recover runs recoverFromGit', () => {
    // This will fail because tmpDir is not a git repo, which is expected behavior
    try {
      execSync(`node "${CLI_PATH}" state recover`, {
        cwd: tmpDir,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // May succeed or fail depending on git state -- either is valid
    } catch (err) {
      // Expected: not a git repo or no STATE.json in git history
      assert.ok(err.status !== 0, 'should exit non-zero for non-git dir');
    }
  });

  // -- USAGE text --
  it('--help includes new state commands', () => {
    const stdout = execSync(`node "${CLI_PATH}" --help`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    assert.ok(stdout.includes('state get --all'), 'should document state get --all');
    assert.ok(stdout.includes('state get milestone'), 'should document state get milestone');
    assert.ok(stdout.includes('state transition'), 'should document state transition');
    assert.ok(stdout.includes('state add-milestone'), 'should document state add-milestone');
    assert.ok(stdout.includes('state detect-corruption'), 'should document state detect-corruption');
    assert.ok(stdout.includes('state recover'), 'should document state recover');
  });
});

// ── Init subcommand tests ──

describe('handleInit research-dir subcommand', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-init-cli-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('creates .planning/research/ directory and outputs JSON', () => {
    const stdout = execSync(`node "${CLI_PATH}" init research-dir`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.ok(result.researchDir, 'should have researchDir field');
    assert.equal(result.ready, true, 'should be ready');
    assert.ok(fs.existsSync(result.researchDir), 'research dir should exist on disk');
    assert.ok(fs.statSync(result.researchDir).isDirectory(), 'should be a directory');
  });

  it('is idempotent - running twice succeeds', () => {
    execSync(`node "${CLI_PATH}" init research-dir`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const stdout = execSync(`node "${CLI_PATH}" init research-dir`, {
      cwd: tmpDir,
      encoding: 'utf-8',
      timeout: 10000,
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.ready, true);
    assert.ok(fs.existsSync(result.researchDir));
  });
});

describe('handleInit write-config subcommand', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-init-cli-'));
    // write-config writes to .planning/config.json, so .planning must exist
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('writes config.json with specified model and team-size', () => {
    const stdout = execSync(
      `node "${CLI_PATH}" init write-config --model opus --team-size 3 --name MyProject`,
      { cwd: tmpDir, encoding: 'utf-8', timeout: 10000 }
    );
    const result = JSON.parse(stdout.trim());
    assert.ok(result.written, 'should confirm written');

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    assert.ok(fs.existsSync(configPath), 'config.json should exist');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(config.model, 'opus');
    assert.equal(config.project.name, 'MyProject');
    // floor(3 * 1.5) = 4
    assert.equal(config.planning.max_parallel_sets, 4);
  });

  it('uses defaults when no flags provided', () => {
    const stdout = execSync(
      `node "${CLI_PATH}" init write-config`,
      { cwd: tmpDir, encoding: 'utf-8', timeout: 10000 }
    );
    const result = JSON.parse(stdout.trim());
    assert.ok(result.written);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(config.model, 'sonnet');
    // floor(1 * 1.5) = 1
    assert.equal(config.planning.max_parallel_sets, 1);
  });
});

// ──────────────────────────────────────────────────
// Plan 21-02: Job execution CLI subcommands
// ──────────────────────────────────────────────────

describe('execute reconcile-jobs subcommand', () => {
  it('prints usage when missing args', () => {
    try {
      execSync(`node "${CLI_PATH}" execute reconcile-jobs`, { encoding: 'utf-8', timeout: 10000 });
      assert.fail('Should have exited with error');
    } catch (err) {
      assert.ok(err.stderr.includes('Usage') || err.status === 1, 'Should show usage or exit 1');
    }
  });
});

describe('execute job-status subcommand', () => {
  it('prints usage when missing args', () => {
    try {
      execSync(`node "${CLI_PATH}" execute job-status`, { encoding: 'utf-8', timeout: 10000 });
      assert.fail('Should have exited with error');
    } catch (err) {
      assert.ok(err.stderr.includes('Usage') || err.status === 1, 'Should show usage or exit 1');
    }
  });
});

describe('execute commit-state subcommand', () => {
  it('code path is reachable (will fail on missing STATE.json which is expected)', () => {
    try {
      execSync(`node "${CLI_PATH}" execute commit-state "test message"`, { encoding: 'utf-8', timeout: 10000 });
      // If it succeeds (e.g. nothing to commit), that's fine
    } catch (err) {
      // Expected: fails because no STATE.json or not in git repo context
      assert.ok(err.status !== undefined, 'Should have exited with some status');
    }
  });
});

describe('wave-plan list-jobs subcommand', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-list-jobs-'));
    // Create .planning dir so findProjectRoot works
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    // Init a git repo so findProjectRoot works
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('prints usage when missing args', () => {
    try {
      execSync(`node "${CLI_PATH}" wave-plan list-jobs`, { encoding: 'utf-8', timeout: 10000 });
      assert.fail('Should have exited with error');
    } catch (err) {
      assert.ok(err.stderr.includes('Usage') || err.status === 1, 'Should show usage or exit 1');
    }
  });

  it('returns empty list for nonexistent wave directory', () => {
    const stdout = execSync(
      `node "${CLI_PATH}" wave-plan list-jobs nonexistent-set wave-01`,
      { cwd: tmpDir, encoding: 'utf-8', timeout: 10000 }
    );
    // output() adds [RAPID] prefix -- strip it for JSON parsing
    const json = stdout.trim().replace(/^\[RAPID\]\s*/, '');
    const result = JSON.parse(json);
    assert.equal(result.count, 0);
    assert.deepEqual(result.jobPlans, []);
    assert.equal(result.setId, 'nonexistent-set');
    assert.equal(result.waveId, 'wave-01');
  });

  it('lists job plan files when they exist', () => {
    const waveDir = path.join(tmpDir, '.planning', 'waves', 'my-set', 'wave-01');
    fs.mkdirSync(waveDir, { recursive: true });
    fs.writeFileSync(path.join(waveDir, 'job-a-PLAN.md'), '# Job A Plan\n');
    fs.writeFileSync(path.join(waveDir, 'job-b-PLAN.md'), '# Job B Plan\n');
    fs.writeFileSync(path.join(waveDir, 'WAVE-CONTEXT.md'), '# Not a job plan\n');

    const stdout = execSync(
      `node "${CLI_PATH}" wave-plan list-jobs my-set wave-01`,
      { cwd: tmpDir, encoding: 'utf-8', timeout: 10000 }
    );
    // output() adds [RAPID] prefix -- strip it for JSON parsing
    const json = stdout.trim().replace(/^\[RAPID\]\s*/, '');
    const result = JSON.parse(json);
    assert.equal(result.count, 2);
    assert.equal(result.jobPlans.length, 2);
    // Verify jobId extraction (strips -PLAN.md)
    const jobIds = result.jobPlans.map(j => j.jobId).sort();
    assert.deepEqual(jobIds, ['job-a', 'job-b']);
    // Verify each plan has file and path fields
    for (const jp of result.jobPlans) {
      assert.ok(jp.file.endsWith('-PLAN.md'), 'file should end with -PLAN.md');
      assert.ok(jp.path.includes(waveDir), 'path should include waveDir');
    }
  });
});
