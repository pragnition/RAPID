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
    assert.ok(out.includes('\u25B6 Run /clear before continuing'), 'should include /clear reminder with bullet');
    assert.ok(out.includes('Next: /rapid:plan-set 1'), 'should include next command');
    assert.ok(!out.includes('\x1b'), 'should NOT contain ANSI escape codes');
    // Should have exactly 2 non-blank lines (clear + next)
    const nonBlank = out.split('\n').filter(l => l.trim().length > 0);
    assert.equal(nonBlank.length, 2, 'should have exactly 2 non-blank lines');
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
    const nonBlank = out.split('\n').filter(l => l.trim().length > 0);
    assert.equal(nonBlank.length, 2, 'should have exactly 2 non-blank lines (clear + next)');
  });

  it('clearRequired false omits clear line', () => {
    const out = renderFooter('/rapid:plan-set 1', { clearRequired: false });
    assert.ok(!out.includes('Run /clear'), 'should NOT include /clear reminder');
    assert.ok(out.includes('Next: /rapid:plan-set 1'), 'should still include next command');
  });

  it('NO_COLOR uses ASCII bullet instead of triangle', () => {
    process.env.NO_COLOR = '1';
    const out = renderFooter('/rapid:plan-set 1');
    assert.ok(out.includes('> Run /clear'), 'should use > as bullet for clear line');
    assert.ok(out.includes('> Next:'), 'should use > as bullet for next line');
    assert.ok(!out.includes('\u25B6'), 'should NOT include triangle bullet');
    assert.ok(!out.includes('╔'), 'should NOT include box-drawing corner');
    assert.ok(!out.includes('║'), 'should NOT include box-drawing vertical');
  });

  it('long breadcrumbs are truncated with ellipsis', () => {
    // Force a narrow-ish terminal so the breadcrumb must be truncated
    const saved = process.stdout.columns;
    process.stdout.columns = 60;
    try {
      const out = renderFooter('/rapid:plan-set 1', {
        breadcrumb: 'init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set > review > merge',
      });
      assert.ok(out.includes('...'), 'long breadcrumb should be truncated with ellipsis');
      const lines = out.split('\n');
      for (const line of lines) {
        assert.ok(line.length <= 60, `line exceeds 60 chars (${line.length}): "${line}"`);
      }
    } finally {
      process.stdout.columns = saved;
    }
  });

  it('all three pieces present with full options, breadcrumb inline', () => {
    const out = renderFooter('/rapid:plan-set 1', {
      breadcrumb: 'init [done] > start-set [done]',
      clearRequired: true,
    });
    const nonBlank = out.split('\n').filter(l => l.trim().length > 0);
    // Should have 2 non-blank lines: clear line + next/breadcrumb line
    assert.equal(nonBlank.length, 2, 'should have 2 non-blank lines (clear + next with inline breadcrumb)');

    // All three pieces of info present
    assert.ok(out.includes('Run /clear before continuing'), 'should contain clear reminder');
    assert.ok(out.includes('Next: /rapid:plan-set 1'), 'should contain next command');
    assert.ok(out.includes('init [done] > start-set [done]'), 'should contain breadcrumb');

    // Verify order: clear before next, breadcrumb on same line as Next
    const clearIdx = out.indexOf('Run /clear before continuing');
    const nextIdx = out.indexOf('Next: /rapid:plan-set 1');
    assert.ok(clearIdx < nextIdx, 'clear should come before next');

    // Breadcrumb should be on the same line as Next (inline format)
    const nextLine = nonBlank.find(l => l.includes('Next:'));
    assert.ok(nextLine.includes('init [done] > start-set [done]'), 'breadcrumb should be inline with Next');
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
