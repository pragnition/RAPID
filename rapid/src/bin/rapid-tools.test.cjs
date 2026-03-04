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
