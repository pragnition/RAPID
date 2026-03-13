'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const displayPath = require('path').join(__dirname, 'display.cjs');

describe('display', () => {
  let display;

  it('module loads without error', () => {
    display = require(displayPath);
    assert.ok(display, 'display module should load');
  });

  describe('STAGE_VERBS', () => {
    it('maps all 14 stages to uppercase verb strings', () => {
      const display = require(displayPath);
      const expectedStages = ['init', 'set-init', 'discuss', 'wave-plan', 'plan-set', 'execute', 'review', 'merge', 'start-set', 'discuss-set', 'execute-set', 'new-version', 'add-set', 'quick'];
      for (const stage of expectedStages) {
        assert.ok(
          typeof display.STAGE_VERBS[stage] === 'string',
          `STAGE_VERBS["${stage}"] should be a string`
        );
        assert.ok(
          display.STAGE_VERBS[stage] === display.STAGE_VERBS[stage].toUpperCase(),
          `STAGE_VERBS["${stage}"] should be uppercase, got: "${display.STAGE_VERBS[stage]}"`
        );
      }
    });

    it('has expected verb mappings', () => {
      const display = require(displayPath);
      assert.equal(display.STAGE_VERBS['init'], 'INITIALIZING');
      assert.equal(display.STAGE_VERBS['set-init'], 'PREPARING');
      assert.equal(display.STAGE_VERBS['discuss'], 'DISCUSSING');
      assert.equal(display.STAGE_VERBS['wave-plan'], 'PLANNING');
      assert.equal(display.STAGE_VERBS['execute'], 'EXECUTING');
      assert.equal(display.STAGE_VERBS['review'], 'REVIEWING');
      assert.equal(display.STAGE_VERBS['merge'], 'MERGING');
      assert.equal(display.STAGE_VERBS['plan-set'], 'PLANNING SET');
      assert.equal(display.STAGE_VERBS['start-set'], 'STARTING SET');
      assert.equal(display.STAGE_VERBS['discuss-set'], 'DISCUSSING SET');
      assert.equal(display.STAGE_VERBS['execute-set'], 'EXECUTING SET');
      assert.equal(display.STAGE_VERBS['new-version'], 'NEW VERSION');
      assert.equal(display.STAGE_VERBS['add-set'], 'ADDING SET');
      assert.equal(display.STAGE_VERBS['quick'], 'QUICK TASK');
    });
  });

  describe('STAGE_BG', () => {
    it('maps all 14 stages to ANSI background escape codes', () => {
      const display = require(displayPath);
      const expectedStages = ['init', 'set-init', 'discuss', 'wave-plan', 'plan-set', 'execute', 'review', 'merge', 'start-set', 'discuss-set', 'execute-set', 'new-version', 'add-set', 'quick'];
      for (const stage of expectedStages) {
        assert.ok(
          typeof display.STAGE_BG[stage] === 'string',
          `STAGE_BG["${stage}"] should be a string`
        );
        assert.ok(
          display.STAGE_BG[stage].startsWith('\x1b['),
          `STAGE_BG["${stage}"] should start with ANSI escape sequence, got: "${display.STAGE_BG[stage]}"`
        );
      }
    });

    it('planning stages (init, set-init, discuss, wave-plan, plan-set, start-set, discuss-set, new-version, add-set) use blue background ANSI code', () => {
      const display = require(displayPath);
      const planningStages = ['init', 'set-init', 'discuss', 'wave-plan', 'plan-set', 'start-set', 'discuss-set', 'new-version', 'add-set'];
      for (const stage of planningStages) {
        assert.equal(
          display.STAGE_BG[stage],
          '\x1b[104m',
          `Planning stage "${stage}" should use bright blue background (\\x1b[104m), got: "${display.STAGE_BG[stage]}"`
        );
      }
    });

    it('execution stages (execute, execute-set, quick) use green background ANSI code', () => {
      const display = require(displayPath);
      const executionStages = ['execute', 'execute-set', 'quick'];
      for (const stage of executionStages) {
        assert.equal(
          display.STAGE_BG[stage],
          '\x1b[102m',
          `Execution stage "${stage}" should use bright green background (\\x1b[102m)`
        );
      }
    });

    it('review stages (review, merge) use red background ANSI code', () => {
      const display = require(displayPath);
      const reviewStages = ['review', 'merge'];
      for (const stage of reviewStages) {
        assert.equal(
          display.STAGE_BG[stage],
          '\x1b[101m',
          `Review stage "${stage}" should use bright red background (\\x1b[101m), got: "${display.STAGE_BG[stage]}"`
        );
      }
    });
  });

  describe('renderBanner', () => {
    it('renderBanner("init") returns string containing ANSI escape codes', () => {
      const display = require(displayPath);
      const result = display.renderBanner('init');
      assert.ok(result.includes('\x1b['), 'Banner should contain ANSI escape codes');
    });

    it('renderBanner("init") returns string containing "RAPID"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('init');
      assert.ok(result.includes('RAPID'), 'Banner should contain "RAPID"');
    });

    it('renderBanner("init") returns string containing "INITIALIZING"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('init');
      assert.ok(result.includes('INITIALIZING'), 'Banner should contain "INITIALIZING"');
    });

    it('renderBanner("execute", "Wave 1.1") returns string containing "EXECUTING" and "Wave 1.1"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('execute', 'Wave 1.1');
      assert.ok(result.includes('EXECUTING'), 'Banner should contain "EXECUTING"');
      assert.ok(result.includes('Wave 1.1'), 'Banner should contain "Wave 1.1"');
    });

    it('renderBanner("review") returns string containing "REVIEWING"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('review');
      assert.ok(result.includes('REVIEWING'), 'Banner should contain "REVIEWING"');
    });

    it('renderBanner("merge") returns string containing "MERGING"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('merge');
      assert.ok(result.includes('MERGING'), 'Banner should contain "MERGING"');
    });

    it('renderBanner("plan-set") returns string containing "RAPID", "PLANNING SET", and ANSI codes', () => {
      const display = require(displayPath);
      const result = display.renderBanner('plan-set');
      assert.ok(result.includes('RAPID'), 'Banner should contain "RAPID"');
      assert.ok(result.includes('PLANNING SET'), 'Banner should contain "PLANNING SET"');
      assert.ok(result.includes('\x1b['), 'Banner should contain ANSI escape codes');
    });

    it('renderBanner("plan-set", "Set: auth-system") contains "auth-system"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('plan-set', 'Set: auth-system');
      assert.ok(result.includes('PLANNING SET'), 'Banner should contain "PLANNING SET"');
      assert.ok(result.includes('auth-system'), 'Banner should contain "auth-system"');
    });

    it('renderBanner("start-set") returns string containing "STARTING SET"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('start-set');
      assert.ok(result.includes('RAPID'), 'Banner should contain "RAPID"');
      assert.ok(result.includes('STARTING SET'), 'Banner should contain "STARTING SET"');
      assert.ok(result.includes('\x1b['), 'Banner should contain ANSI escape codes');
    });

    it('renderBanner("discuss-set") returns string containing "DISCUSSING SET"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('discuss-set');
      assert.ok(result.includes('RAPID'), 'Banner should contain "RAPID"');
      assert.ok(result.includes('DISCUSSING SET'), 'Banner should contain "DISCUSSING SET"');
      assert.ok(result.includes('\x1b['), 'Banner should contain ANSI escape codes');
    });

    it('renderBanner("execute-set") returns string containing "EXECUTING SET"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('execute-set');
      assert.ok(result.includes('RAPID'), 'Banner should contain "RAPID"');
      assert.ok(result.includes('EXECUTING SET'), 'Banner should contain "EXECUTING SET"');
      assert.ok(result.includes('\x1b['), 'Banner should contain ANSI escape codes');
    });

    it('renderBanner("new-version") returns string containing "NEW VERSION"', () => {
      const display = require(displayPath);
      const result = display.renderBanner('new-version');
      assert.ok(result.includes('RAPID'), 'Banner should contain "RAPID"');
      assert.ok(result.includes('NEW VERSION'), 'Banner should contain "NEW VERSION"');
      assert.ok(result.includes('\x1b['), 'Banner should contain ANSI escape codes');
    });

    it('renderBanner("add-set") returns string containing "RAPID", "ADDING SET", and ANSI codes', () => {
      const display = require(displayPath);
      const result = display.renderBanner('add-set');
      assert.ok(result.includes('RAPID'), 'Banner should contain "RAPID"');
      assert.ok(result.includes('ADDING SET'), 'Banner should contain "ADDING SET"');
      assert.ok(result.includes('\x1b['), 'Banner should contain ANSI escape codes');
    });

    it('renderBanner("quick") returns string containing "RAPID", "QUICK TASK", and ANSI codes', () => {
      const display = require(displayPath);
      const result = display.renderBanner('quick');
      assert.ok(result.includes('RAPID'), 'Banner should contain "RAPID"');
      assert.ok(result.includes('QUICK TASK'), 'Banner should contain "QUICK TASK"');
      assert.ok(result.includes('\x1b['), 'Banner should contain ANSI escape codes');
    });

    it('renderBanner("add-set") and renderBanner("quick") end with ANSI reset code', () => {
      const display = require(displayPath);
      const addSetResult = display.renderBanner('add-set');
      assert.ok(
        addSetResult.endsWith('\x1b[0m'),
        `renderBanner("add-set") should end with reset code`
      );
      const quickResult = display.renderBanner('quick');
      assert.ok(
        quickResult.endsWith('\x1b[0m'),
        `renderBanner("quick") should end with reset code`
      );
    });

    it('all 14 stages produce valid banner strings', () => {
      const display = require(displayPath);
      const stages = ['init', 'set-init', 'discuss', 'wave-plan', 'plan-set', 'execute', 'review', 'merge', 'start-set', 'discuss-set', 'execute-set', 'new-version', 'add-set', 'quick'];
      for (const stage of stages) {
        const result = display.renderBanner(stage);
        assert.ok(typeof result === 'string', `renderBanner("${stage}") should return a string`);
        assert.ok(result.length > 0, `renderBanner("${stage}") should return non-empty string`);
        assert.ok(result.includes('RAPID'), `renderBanner("${stage}") should include "RAPID"`);
        assert.ok(result.includes('\x1b['), `renderBanner("${stage}") should include ANSI escape codes`);
      }
    });

    it('renderBanner("unknown-stage") returns fallback string (no crash)', () => {
      const display = require(displayPath);
      const result = display.renderBanner('unknown-stage');
      assert.ok(typeof result === 'string', 'Should return a string for unknown stage');
      assert.ok(result.includes('Unknown stage'), 'Fallback should mention "Unknown stage"');
      assert.ok(result.includes('unknown-stage'), 'Fallback should include the stage name');
    });

    it('renderBanner output ends with ANSI reset code', () => {
      const display = require(displayPath);
      const stages = ['init', 'set-init', 'discuss', 'wave-plan', 'plan-set', 'execute', 'review', 'merge', 'start-set', 'discuss-set', 'execute-set', 'new-version', 'add-set', 'quick'];
      for (const stage of stages) {
        const result = display.renderBanner(stage);
        assert.ok(
          result.endsWith('\x1b[0m'),
          `renderBanner("${stage}") should end with reset code (\\x1b[0m), got ending: "${result.slice(-10)}"`
        );
      }
    });

    it('banner output has consistent padded width (minus ANSI codes)', () => {
      const display = require(displayPath);
      // Strip ANSI codes to measure visible width
      const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
      const stages = ['init', 'set-init', 'discuss', 'wave-plan', 'plan-set', 'execute', 'review', 'merge', 'start-set', 'discuss-set', 'execute-set', 'new-version', 'add-set', 'quick'];
      const widths = stages.map(stage => stripAnsi(display.renderBanner(stage)).length);
      // All widths should be the same (50 chars padded)
      const targetWidth = widths[0];
      for (let i = 0; i < stages.length; i++) {
        assert.equal(
          widths[i],
          targetWidth,
          `Banner for "${stages[i]}" has visible width ${widths[i]}, expected ${targetWidth}`
        );
      }
      assert.ok(targetWidth >= 50, `Padded width should be at least 50, got ${targetWidth}`);
    });

    it('planning stages use blue background ANSI code in banner', () => {
      const display = require(displayPath);
      const planningStages = ['init', 'set-init', 'discuss', 'wave-plan', 'plan-set', 'start-set', 'discuss-set', 'new-version', 'add-set'];
      for (const stage of planningStages) {
        const result = display.renderBanner(stage);
        assert.ok(
          result.includes('\x1b[104m'),
          `Planning stage "${stage}" banner should contain bright blue background code (\\x1b[104m)`
        );
      }
    });

    it('execution stages use green background ANSI code in banner', () => {
      const display = require(displayPath);
      const executionStages = ['execute', 'execute-set', 'quick'];
      for (const stage of executionStages) {
        const result = display.renderBanner(stage);
        assert.ok(
          result.includes('\x1b[102m'),
          `Execution stage "${stage}" banner should contain bright green background code (\\x1b[102m)`
        );
      }
    });

    it('review stages use red background ANSI code in banner', () => {
      const display = require(displayPath);
      const reviewStages = ['review', 'merge'];
      for (const stage of reviewStages) {
        const result = display.renderBanner(stage);
        assert.ok(
          result.includes('\x1b[101m'),
          `Review stage "${stage}" banner should contain bright red background code (\\x1b[101m)`
        );
      }
    });
  });
});
