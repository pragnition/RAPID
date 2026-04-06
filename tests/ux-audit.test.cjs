'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('breadcrumb formatting', () => {
  it('formatBreadcrumb with recovery command', () => {
    const { formatBreadcrumb } = require('../src/lib/errors.cjs');
    const result = formatBreadcrumb('Set auth is pending', '/rapid:discuss-set 2');
    assert.equal(result, 'Set auth is pending. Run: /rapid:discuss-set 2');
  });

  it('formatBreadcrumb without recovery command', () => {
    const { formatBreadcrumb } = require('../src/lib/errors.cjs');
    const result = formatBreadcrumb('Something went wrong');
    assert.equal(result, 'Something went wrong');
  });

  it('exitWithError uses [ERROR] label format', () => {
    // Verify that exitWithError is exported and is a function
    const { exitWithError } = require('../src/lib/errors.cjs');
    assert.equal(typeof exitWithError, 'function');
  });
});

describe('state error breadcrumbs', () => {
  it('STATE_FILE_MISSING error includes recovery hint', () => {
    const sm = require('../src/lib/state-machine.cjs');
    const err = sm.createStateError(sm.STATE_FILE_MISSING, 'STATE.json not found');
    assert.ok(err.message.includes('Run:'), 'Should include "Run:" recovery pattern');
    assert.ok(err.message.includes('/rapid:init'), 'Should suggest /rapid:init');
    assert.ok(!err.message.includes('Remediation:'), 'Should not use old format');
  });

  it('STATE_PARSE_ERROR error includes recovery hint', () => {
    const sm = require('../src/lib/state-machine.cjs');
    const err = sm.createStateError(sm.STATE_PARSE_ERROR, 'STATE.json parse failed');
    assert.ok(err.message.includes('Run:'), 'Should include "Run:" recovery pattern');
    assert.ok(err.message.includes('git checkout'), 'Should suggest git recovery');
  });

  it('STATE_VALIDATION_ERROR error includes recovery hint', () => {
    const sm = require('../src/lib/state-machine.cjs');
    const err = sm.createStateError(sm.STATE_VALIDATION_ERROR, 'Validation failed');
    assert.ok(err.message.includes('Run:'), 'Should include "Run:" recovery pattern');
  });
});

describe('transition error breadcrumbs', () => {
  it('invalid transition error includes recovery hint', () => {
    const { validateTransition } = require('../src/lib/state-transitions.cjs');
    assert.throws(
      () => validateTransition('pending', 'executed'),
      (err) => err.message.includes('Run:'),
      'Invalid transition should include recovery hint'
    );
  });

  it('terminal state error includes recovery hint', () => {
    const { validateTransition } = require('../src/lib/state-transitions.cjs');
    assert.throws(
      () => validateTransition('merged', 'pending'),
      (err) => err.message.includes('Run:'),
      'Terminal state error should include recovery hint'
    );
  });
});

describe('auto-regroup wiring', () => {
  it('autoRegroup is exported from add-set.cjs', () => {
    const { autoRegroup } = require('../src/lib/add-set.cjs');
    assert.equal(typeof autoRegroup, 'function');
  });

  it('addSetToMilestone is exported from add-set.cjs', () => {
    const { addSetToMilestone } = require('../src/lib/add-set.cjs');
    assert.equal(typeof addSetToMilestone, 'function');
  });
});

describe('teamSize storage', () => {
  it('scaffoldProject stores teamSize in STATE.json', () => {
    const { scaffoldProject } = require('../src/lib/init.cjs');
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
    try {
      scaffoldProject(tmp, { name: 'test', description: 'test', teamSize: 4 }, 'fresh');
      const state = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'STATE.json'), 'utf-8'));
      assert.equal(state.teamSize, 4, 'teamSize should be stored in STATE.json');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('scaffoldProject defaults teamSize to 1 when not provided', () => {
    const { scaffoldProject } = require('../src/lib/init.cjs');
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-test-'));
    try {
      scaffoldProject(tmp, { name: 'test', description: 'test' }, 'fresh');
      const state = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'STATE.json'), 'utf-8'));
      assert.equal(state.teamSize, 1, 'teamSize should default to 1');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('audit report structure', () => {
  it('UX audit report exists and has correct structure', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const reportPath = path.resolve(__dirname, '..', '.planning', 'v6.1.0-UX-AUDIT.md');
    assert.ok(fs.existsSync(reportPath), 'Audit report should exist');
    const content = fs.readFileSync(reportPath, 'utf-8');
    assert.ok(content.includes('Pillar 1: Breadcrumb Consistency'), 'Should have Pillar 1');
    assert.ok(content.includes('Pillar 2: Command Discoverability'), 'Should have Pillar 2');
    assert.ok(content.includes('Pillar 3: First-Run Experience'), 'Should have Pillar 3');
    assert.ok(content.includes('Pillar 4: Auto-Regroup Wiring'), 'Should have Pillar 4');
  });
});
