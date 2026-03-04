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

    // loadConfig reads from projectRoot/rapid/config.json
    const rapidConfigDir = path.join(tmpDir, 'rapid');
    fs.mkdirSync(rapidConfigDir, { recursive: true });
    const configSrc = path.join(RAPID_DIR, 'config.json');
    fs.copyFileSync(configSrc, path.join(rapidConfigDir, 'config.json'));

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
// USAGE includes plan and assumptions
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
});
