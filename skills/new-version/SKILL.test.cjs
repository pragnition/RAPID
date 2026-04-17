'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL_PATH = path.resolve(__dirname, 'SKILL.md');

describe('skills/new-version/SKILL.md -- dual-mode reference structure', () => {
  let content;

  it('1. file exists', () => {
    assert.ok(fs.existsSync(SKILL_PATH), `Expected file at ${SKILL_PATH}`);
    content = fs.readFileSync(SKILL_PATH, 'utf-8');
  });

  it('2. top-level Dual-Mode Operation Reference names both ask_free_text and webui_ask_user with a per-shape rule', () => {
    const headerIdx = content.indexOf('## Dual-Mode Operation Reference');
    assert.ok(headerIdx !== -1, 'Dual-Mode Operation Reference header must be present');
    const section = content.slice(headerIdx, headerIdx + 2500);
    assert.ok(
      section.includes('mcp__rapid__ask_free_text'),
      'Top-level reference must name mcp__rapid__ask_free_text (for free-form textarea prompts)'
    );
    assert.ok(
      section.includes('mcp__rapid__webui_ask_user'),
      'Top-level reference must name mcp__rapid__webui_ask_user (for multiple-choice prompts)'
    );
    assert.ok(
      /Free-form questions/i.test(section),
      'Top-level reference must distinguish Free-form vs Multiple-choice question shapes'
    );
    assert.ok(
      /Ask freeform:.*free-form/i.test(section) || /`Ask freeform:`/i.test(section),
      'Top-level reference must explicitly call out that "Ask freeform:" prompts are free-form questions'
    );
  });

  it('3. Question C category-loop SDK branch calls ask_free_text per category, not webui_ask_user', () => {
    const idx = content.indexOf('**Question C: Milestone Goals');
    assert.ok(idx !== -1, 'Question C section must exist');
    const block = content.slice(idx, idx + 1500);
    assert.ok(
      block.includes('mcp__rapid__ask_free_text'),
      'Question C category loop must call mcp__rapid__ask_free_text in SDK mode'
    );
    assert.ok(
      block.includes('DO NOT call mcp__rapid__webui_ask_user'),
      'Question C category loop must carry the DO NOT call mcp__rapid__webui_ask_user guardrail'
    );
  });

  it('4. milestone version "Other" follow-up calls ask_free_text in SDK mode', () => {
    assert.ok(
      /What version\/ID should the new milestone have\?/.test(content),
      'Milestone version "Other" follow-up question must be present'
    );
    const idx = content.indexOf('What version/ID should the new milestone have?');
    const block = content.slice(Math.max(0, idx - 400), idx + 400);
    assert.ok(
      block.includes('mcp__rapid__ask_free_text'),
      'Milestone version "Other" follow-up must call mcp__rapid__ask_free_text in SDK mode'
    );
  });

  it('5. milestone-name question calls ask_free_text in SDK mode', () => {
    const idx = content.indexOf('Give a short name or description for this milestone');
    assert.ok(idx !== -1, 'Milestone name question must be present');
    const block = content.slice(Math.max(0, idx - 400), idx + 400);
    assert.ok(
      block.includes('mcp__rapid__ask_free_text'),
      'Milestone name question must call mcp__rapid__ask_free_text in SDK mode'
    );
  });

  it('6. per-category "Enter X" follow-ups route through ask_free_text (features, bug fixes, tech debt, UX)', () => {
    const markers = [
      'If "Enter features":',
      'If "Enter bug fixes":',
      'If "Enter tech debt items":',
      'If "Enter UX improvements":',
    ];
    for (const marker of markers) {
      const idx = content.indexOf(marker);
      assert.ok(idx !== -1, `Marker not found: ${marker}`);
      const block = content.slice(idx, idx + 500);
      assert.ok(
        block.includes('mcp__rapid__ask_free_text'),
        `"${marker}" branch must call mcp__rapid__ask_free_text in SDK mode`
      );
      assert.ok(
        block.includes('DO NOT call `mcp__rapid__webui_ask_user`') || block.includes('DO NOT call mcp__rapid__webui_ask_user'),
        `"${marker}" branch must carry the DO NOT call webui_ask_user guardrail`
      );
    }
  });

  it('7. at least 8 occurrences of mcp__rapid__ask_free_text (1 version-Other + 1 milestone-name + 1 category-loop + 4 per-category + 1 additional-goals + 1 roadmap-changes, minus top-level reference duplicates)', () => {
    const matches = content.match(/mcp__rapid__ask_free_text/g) || [];
    assert.ok(
      matches.length >= 8,
      `Must contain at least 8 occurrences of mcp__rapid__ask_free_text, found ${matches.length}`
    );
  });

  it('8. at least 6 occurrences of the guardrail phrase "DO NOT call" webui_ask_user (one per free-form prompt)', () => {
    const pattern = /DO NOT call\s*`?mcp__rapid__webui_ask_user`?/g;
    const matches = content.match(pattern) || [];
    assert.ok(
      matches.length >= 6,
      `Must contain at least 6 occurrences of the DO NOT call webui_ask_user guardrail, found ${matches.length}`
    );
  });
});
