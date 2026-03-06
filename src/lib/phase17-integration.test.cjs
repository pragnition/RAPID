'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const { scaffoldProject } = require('./init.cjs');
const { readState } = require('./state-machine.cjs');

// Helper to create a temp directory for each test
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-p17-integration-'));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── 1. state.cjs deletion verified ──

describe('Phase 17: state.cjs deletion', () => {
  it('require("./state.cjs") throws module not found', () => {
    assert.throws(
      () => require('./state.cjs'),
      (err) => err.code === 'MODULE_NOT_FOUND',
      'state.cjs should be deleted and not loadable'
    );
  });

  it('require("./state-machine.cjs") succeeds', () => {
    const stateMachine = require('./state-machine.cjs');
    assert.ok(stateMachine, 'state-machine.cjs should be loadable');
    assert.ok(typeof stateMachine.createInitialState === 'function');
    assert.ok(typeof stateMachine.readState === 'function');
    assert.ok(typeof stateMachine.writeState === 'function');
    assert.ok(typeof stateMachine.transitionJob === 'function');
  });
});

// ── 2. rapid-tools.cjs state commands work end-to-end ──

describe('Phase 17: rapid-tools.cjs state commands', () => {
  const rapidToolsPath = path.resolve(__dirname, '../bin/rapid-tools.cjs');

  it('state get --all returns valid JSON with hierarchical structure', () => {
    // Scaffold a project first
    scaffoldProject(tmpDir, { name: 'IntegrationTest', description: 'test', teamSize: 1 });

    // Initialize git repo so state commands work
    execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'pipe' });

    const output = execFileSync('node', [rapidToolsPath, 'state', 'get', '--all'], {
      cwd: tmpDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const parsed = JSON.parse(output.trim());
    assert.ok(parsed.projectName, 'Should have projectName');
    assert.ok(parsed.milestones, 'Should have milestones array');
    assert.ok(Array.isArray(parsed.milestones), 'milestones should be an array');
    assert.equal(parsed.version, 1, 'Should have version 1');
  });

  it('state detect-corruption returns corrupted: false', () => {
    scaffoldProject(tmpDir, { name: 'IntegrationTest', description: 'test', teamSize: 1 });

    execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'pipe' });

    const output = execFileSync('node', [rapidToolsPath, 'state', 'detect-corruption'], {
      cwd: tmpDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const parsed = JSON.parse(output.trim());
    assert.equal(parsed.corrupt, false, 'Should not be corrupt');
  });
});

// ── 3. init.cjs produces valid STATE.json ──

describe('Phase 17: init.cjs STATE.json production', () => {
  it('scaffoldProject creates STATE.json with valid content', async () => {
    scaffoldProject(tmpDir, { name: 'ValidStateTest', description: 'test', teamSize: 2 });

    const stateJsonPath = path.join(tmpDir, '.planning', 'STATE.json');
    assert.ok(fs.existsSync(stateJsonPath), 'STATE.json should exist');

    const result = await readState(tmpDir);
    assert.ok(result !== null, 'readState should not return null');
    assert.equal(result.valid, true, 'STATE.json should be valid');
    assert.equal(result.state.projectName, 'ValidStateTest', 'projectName should match input');
    assert.equal(result.state.milestones.length, 1, 'Should have exactly one milestone');
    assert.equal(result.state.milestones[0].id, 'v1.0', 'Milestone id should be v1.0');
  });
});

// ── 4. No remaining state.cjs imports in rapid-tools.cjs ──

describe('Phase 17: no remaining state.cjs imports', () => {
  const rapidToolsPath = path.resolve(__dirname, '../bin/rapid-tools.cjs');

  it('rapid-tools.cjs does NOT import state.cjs', () => {
    const source = fs.readFileSync(rapidToolsPath, 'utf-8');
    assert.ok(
      !source.includes("require('../lib/state.cjs')"),
      'rapid-tools.cjs should NOT contain require("../lib/state.cjs")'
    );
  });

  it('rapid-tools.cjs DOES import state-machine.cjs', () => {
    const source = fs.readFileSync(rapidToolsPath, 'utf-8');
    assert.ok(
      source.includes("require('../lib/state-machine.cjs')"),
      'rapid-tools.cjs should contain require("../lib/state-machine.cjs")'
    );
  });
});
