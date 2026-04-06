'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { renderFooter } = require('../src/lib/display.cjs');

describe('renderFooter', () => {
  afterEach(() => {
    delete process.env.NO_COLOR;
  });

  it('is exported as a function', () => {
    assert.equal(typeof renderFooter, 'function');
  });

  it('basic output structure', () => {
    const out = renderFooter('/rapid:plan-set 1');
    assert.equal(typeof out, 'string');
    assert.ok(out.includes('Run /clear before continuing'), 'should include /clear reminder');
    assert.ok(out.includes('Next: /rapid:plan-set 1'), 'should include next command');
    assert.ok(out.includes('\u2500'), 'should include box-drawing separator');
    assert.ok(!out.includes('\x1b'), 'should NOT contain ANSI escape codes');
  });

  it('includes breadcrumb when provided', () => {
    const out = renderFooter('/rapid:plan-set 1', { breadcrumb: 'init [done] > start-set' });
    assert.ok(out.includes('init [done] > start-set'), 'should include breadcrumb text');
    // Breadcrumb appears after next-command line
    const nextIdx = out.indexOf('Next:');
    const bcIdx = out.indexOf('init [done] > start-set');
    assert.ok(bcIdx > nextIdx, 'breadcrumb should appear after next-command line');
  });

  it('omits breadcrumb when not provided', () => {
    const out = renderFooter('/rapid:plan-set 1');
    // Split by separator to get content lines
    const lines = out.split('\n').filter(l => l.trim().length > 0 && !l.match(/^[─-]+$/));
    assert.equal(lines.length, 2, 'should have exactly 2 content lines (clear + next)');
  });

  it('clearRequired false omits clear line', () => {
    const out = renderFooter('/rapid:plan-set 1', { clearRequired: false });
    assert.ok(!out.includes('Run /clear'), 'should NOT include /clear reminder');
    assert.ok(out.includes('Next: /rapid:plan-set 1'), 'should still include next command');
  });

  it('NO_COLOR uses ASCII separator', () => {
    process.env.NO_COLOR = '1';
    const out = renderFooter('/rapid:plan-set 1');
    assert.ok(out.includes('-'), 'should include ASCII hyphen separator');
    assert.ok(!out.includes('\u2500'), 'should NOT include box-drawing character');
  });

  it('separator width adapts to content', () => {
    const shortOut = renderFooter('/rapid:x');
    const longOut = renderFooter('/rapid:execute-set some-very-long-set-name-here');

    // Extract separator lines
    const shortSep = shortOut.split('\n').find(l => /^[─]+$/.test(l));
    const longSep = longOut.split('\n').find(l => /^[─]+$/.test(l));

    assert.ok(shortSep, 'short output should have separator');
    assert.ok(longSep, 'long output should have separator');
    assert.ok(longSep.length > shortSep.length, 'longer content should produce longer separator');
    assert.ok(shortSep.length >= 40, 'separator should be at least 40 characters');
  });

  it('all three lines present with full options', () => {
    const out = renderFooter('/rapid:plan-set 1', {
      breadcrumb: 'init [done] > start-set [done]',
      clearRequired: true,
    });
    const lines = out.split('\n').filter(l => l.trim().length > 0 && !l.match(/^[─-]+$/));
    assert.equal(lines.length, 3, 'should have 3 content lines');

    // Verify order: clear, next, breadcrumb
    const clearIdx = out.indexOf('Run /clear before continuing');
    const nextIdx = out.indexOf('Next: /rapid:plan-set 1');
    const bcIdx = out.indexOf('init [done] > start-set [done]');
    assert.ok(clearIdx < nextIdx, 'clear should come before next');
    assert.ok(nextIdx < bcIdx, 'next should come before breadcrumb');
  });
});
