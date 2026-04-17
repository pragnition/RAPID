'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL_PATH = path.resolve(__dirname, 'SKILL.md');

describe('skills/init/SKILL.md -- dual-mode reference structure', () => {
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
  });

  it('3. Area 1 (Vision) SDK branch calls ask_free_text, not webui_ask_user', () => {
    const areaIdx = content.indexOf('**Area 1 (Vision/problem statement) -- freeform:**');
    assert.ok(areaIdx !== -1, 'Area 1 section must exist');
    const block = content.slice(areaIdx, areaIdx + 1200);
    assert.ok(
      block.includes('mcp__rapid__ask_free_text'),
      'Area 1 SDK branch must call mcp__rapid__ask_free_text'
    );
    assert.ok(
      block.includes('DO NOT call mcp__rapid__webui_ask_user'),
      'Area 1 SDK branch must carry the DO NOT call mcp__rapid__webui_ask_user guardrail'
    );
  });

  it('4. Area 4 (Must-have features) SDK branch calls ask_free_text, not webui_ask_user', () => {
    const areaIdx = content.indexOf('**Area 4 (Must-have features) -- freeform:**');
    assert.ok(areaIdx !== -1, 'Area 4 section must exist');
    const block = content.slice(areaIdx, areaIdx + 1200);
    assert.ok(
      block.includes('mcp__rapid__ask_free_text'),
      'Area 4 SDK branch must call mcp__rapid__ask_free_text'
    );
    assert.ok(
      block.includes('DO NOT call mcp__rapid__webui_ask_user'),
      'Area 4 SDK branch must carry the DO NOT call mcp__rapid__webui_ask_user guardrail'
    );
  });

  it('5. Area 11 (Team experience and inspiration) SDK branch calls ask_free_text, not webui_ask_user', () => {
    const areaIdx = content.indexOf('**Area 11 (Team experience and inspiration) -- freeform:**');
    assert.ok(areaIdx !== -1, 'Area 11 section must exist');
    const block = content.slice(areaIdx, areaIdx + 1200);
    assert.ok(
      block.includes('mcp__rapid__ask_free_text'),
      'Area 11 SDK branch must call mcp__rapid__ask_free_text'
    );
    assert.ok(
      block.includes('DO NOT call mcp__rapid__webui_ask_user'),
      'Area 11 SDK branch must carry the DO NOT call mcp__rapid__webui_ask_user guardrail'
    );
  });

  it('6. at least 3 occurrences of mcp__rapid__ask_free_text in the body (the three freeform Areas)', () => {
    const matches = content.match(/mcp__rapid__ask_free_text/g) || [];
    assert.ok(
      matches.length >= 3,
      `Must contain at least 3 occurrences of mcp__rapid__ask_free_text (Areas 1, 4, 11), found ${matches.length}`
    );
  });

  it('7. at least 3 occurrences of the guardrail phrase "DO NOT call mcp__rapid__webui_ask_user"', () => {
    const phrase = 'DO NOT call mcp__rapid__webui_ask_user';
    let count = 0;
    let idx = 0;
    while ((idx = content.indexOf(phrase, idx)) !== -1) {
      count += 1;
      idx += phrase.length;
    }
    assert.ok(
      count >= 3,
      `Must contain at least 3 occurrences of "${phrase}" (one per freeform Area), found ${count}`
    );
  });
});
