'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CliError } = require('../lib/errors.cjs');
const { handlePlan } = require('./plan.cjs');

describe('plan.cjs command handler', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-plan-test-'));
    // Create minimal .planning/sets structure for plan operations
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'alpha'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets', 'beta'), { recursive: true });
    // Write minimal CONTRACT.json and SET-OVERVIEW.md for load-set
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'sets', 'alpha', 'CONTRACT.json'),
      JSON.stringify({ setId: 'alpha', exports: {}, imports: {} }),
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'sets', 'alpha', 'SET-OVERVIEW.md'),
      '# Alpha\nOverview of alpha set.\n',
    );
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Test 1: exports ──────────────────────────────────────────

  it('exports handlePlan function', () => {
    assert.equal(typeof handlePlan, 'function');
  });

  // ── Test 2: unknown subcommand throws CliError ───────────────

  it('handlePlan throws CliError for unknown subcommand', () => {
    assert.throws(
      () => handlePlan(tmpDir, 'nonexistent', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        return true;
      },
    );
  });

  // ── Test 3: error message lists valid subcommands ────────────

  it('error message for unknown subcommand lists valid subcommands', () => {
    try {
      handlePlan(tmpDir, 'nonexistent', []);
      assert.fail('Should have thrown');
    } catch (err) {
      const expected = ['create-set', 'decompose', 'write-dag', 'list-sets', 'load-set'];
      for (const sub of expected) {
        assert.ok(err.message.includes(sub), `Error message should mention '${sub}', got: ${err.message}`);
      }
    }
  });

  // ── Test 4: no plan-check-gate in error message ──────────────

  it('error message does not mention plan-check-gate', () => {
    try {
      handlePlan(tmpDir, 'nonexistent', []);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(!err.message.includes('plan-check-gate'), 'Error message should not contain plan-check-gate');
    }
  });

  // ── Test 5: load-set throws without set name ─────────────────

  it('load-set throws CliError when no set name provided', () => {
    assert.throws(
      () => handlePlan(tmpDir, 'load-set', []),
      (err) => {
        assert.ok(err instanceof CliError, `Expected CliError, got ${err.constructor.name}`);
        assert.ok(err.message.includes('Usage'), `Error message should include usage hint, got: ${err.message}`);
        return true;
      },
    );
  });

  // ── Test 6: list-sets calls plan.listSets and writes JSON ────

  it('list-sets subcommand calls plan.listSets and writes JSON', () => {
    // Capture stdout
    const original = process.stdout.write;
    let captured = '';
    process.stdout.write = (chunk) => { captured += chunk; return true; };
    try {
      handlePlan(tmpDir, 'list-sets', []);
    } finally {
      process.stdout.write = original;
    }

    const parsed = JSON.parse(captured.trim());
    assert.ok(Array.isArray(parsed.sets), 'Output should have a sets array');
    assert.ok(parsed.sets.includes('alpha'), "sets should include 'alpha'");
    assert.ok(parsed.sets.includes('beta'), "sets should include 'beta'");
  });
});
