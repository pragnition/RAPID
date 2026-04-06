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
    assert.ok(out.includes('╔'), 'should include box-drawing top-left corner');
    assert.ok(out.includes('╚'), 'should include box-drawing bottom-left corner');
    assert.ok(out.includes('║'), 'should include box-drawing vertical border');
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
    // Filter to content lines only (exclude borders and empty padding lines)
    const lines = out.split('\n').filter(l => l.trim().length > 0 && l.includes('║') && l.trim() !== '║' && !/^║\s+║$/.test(l));
    assert.equal(lines.length, 2, 'should have exactly 2 content lines (clear + next)');
  });

  it('clearRequired false omits clear line', () => {
    const out = renderFooter('/rapid:plan-set 1', { clearRequired: false });
    assert.ok(!out.includes('Run /clear'), 'should NOT include /clear reminder');
    assert.ok(out.includes('Next: /rapid:plan-set 1'), 'should still include next command');
  });

  it('NO_COLOR uses ASCII box characters', () => {
    process.env.NO_COLOR = '1';
    const out = renderFooter('/rapid:plan-set 1');
    assert.ok(out.includes('+'), 'should include ASCII corner character');
    assert.ok(out.includes('|'), 'should include ASCII vertical border');
    assert.ok(out.includes('-'), 'should include ASCII horizontal border');
    assert.ok(!out.includes('╔'), 'should NOT include box-drawing corner');
    assert.ok(!out.includes('║'), 'should NOT include box-drawing vertical');
  });

  it('box width adapts to content', () => {
    const shortOut = renderFooter('/rapid:x');
    const longOut = renderFooter('/rapid:execute-set some-very-long-set-name-here');

    // Extract top border lines (╔═══╗)
    const shortBorder = shortOut.split('\n').find(l => l.startsWith('╔'));
    const longBorder = longOut.split('\n').find(l => l.startsWith('╔'));

    assert.ok(shortBorder, 'short output should have top border');
    assert.ok(longBorder, 'long output should have top border');
    assert.ok(longBorder.length > shortBorder.length, 'longer content should produce wider box');
    assert.ok(shortBorder.length >= 42, 'box should be at least 42 characters wide (40 inner + corners)');
  });

  it('all three lines present with full options', () => {
    const out = renderFooter('/rapid:plan-set 1', {
      breadcrumb: 'init [done] > start-set [done]',
      clearRequired: true,
    });
    const lines = out.split('\n').filter(l => l.trim().length > 0 && l.includes('║') && !/^║\s+║$/.test(l));
    assert.equal(lines.length, 3, 'should have 3 content lines');

    // Verify order: clear, next, breadcrumb
    const clearIdx = out.indexOf('Run /clear before continuing');
    const nextIdx = out.indexOf('Next: /rapid:plan-set 1');
    const bcIdx = out.indexOf('init [done] > start-set [done]');
    assert.ok(clearIdx < nextIdx, 'clear should come before next');
    assert.ok(nextIdx < bcIdx, 'next should come before breadcrumb');
  });
});

// Structural regression: every designated skill must contain display footer
describe('structural: display footer in all skills', () => {
  const fs = require('node:fs');
  const path = require('node:path');

  const FOOTER_REQUIRED_SKILLS = [
    'init', 'start-set', 'discuss-set', 'plan-set', 'execute-set',
    'review', 'merge', 'new-version', 'add-set', 'scaffold',
    'audit-version', 'quick', 'branding', 'documentation',
    'unit-test', 'bug-hunt', 'uat', 'bug-fix',
  ];

  const FOOTER_EXCLUDED_SKILLS = [
    'help', 'install', 'status', 'cleanup', 'pause', 'resume',
    'assumptions', 'context', 'migrate', 'register-web', 'backlog',
  ];

  for (const name of FOOTER_REQUIRED_SKILLS) {
    it(`skill '${name}' contains display footer call`, () => {
      const skillPath = path.resolve(__dirname, '..', 'skills', name, 'SKILL.md');
      const content = fs.readFileSync(skillPath, 'utf-8');
      assert.ok(
        content.includes('display footer'),
        `Skill '${name}' SKILL.md does not contain 'display footer' -- add footer call`,
      );
    });
  }

  it('every skill directory is listed in REQUIRED or EXCLUDED', () => {
    const skillsDir = path.resolve(__dirname, '..', 'skills');
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    const allListed = new Set([...FOOTER_REQUIRED_SKILLS, ...FOOTER_EXCLUDED_SKILLS]);
    const unlisted = dirs.filter(d => !allListed.has(d));

    assert.deepStrictEqual(
      unlisted,
      [],
      `Skill(s) not in FOOTER_REQUIRED_SKILLS or FOOTER_EXCLUDED_SKILLS: ${unlisted.join(', ')} -- add each to one list`,
    );
  });
});
