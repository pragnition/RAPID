'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL_PATH = path.resolve(__dirname, 'SKILL.md');

describe('skills/add-set/SKILL.md -- dual-mode reference structure', () => {
  let content;

  it('1. file exists', () => {
    assert.ok(fs.existsSync(SKILL_PATH), `Expected file at ${SKILL_PATH}`);
    content = fs.readFileSync(SKILL_PATH, 'utf-8');
  });

  it('2. valid YAML frontmatter with required keys', () => {
    assert.ok(content, 'File content must be loaded');
    const parts = content.split('---');
    assert.ok(parts.length >= 3, 'File must have YAML frontmatter delimited by ---');
    const frontmatter = parts[1];
    assert.ok(
      /^\s*description\s*:/m.test(frontmatter),
      'Frontmatter must contain "description" key'
    );
    assert.ok(
      /^\s*allowed-tools\s*:/m.test(frontmatter),
      'Frontmatter must contain "allowed-tools" key'
    );
  });

  it('3. frontmatter allowed-tools does NOT include AskUserQuestion', () => {
    const parts = content.split('---');
    const frontmatter = parts[1];
    const match = frontmatter.match(/^\s*allowed-tools\s*:\s*(.+)/m);
    assert.ok(match, 'allowed-tools key must have a value');
    assert.ok(
      !match[1].includes('AskUserQuestion'),
      'allowed-tools must NOT include AskUserQuestion (add-set routes prompts through its own dual-mode blocks, not the frontmatter-granted tool)'
    );
  });

  it('4. contains at least 4 occurrences of mcp__rapid__ask_free_text (Q1, Q2 in Step 2, plus custom-ID and retry in Step 3)', () => {
    const matches = content.match(/mcp__rapid__ask_free_text/g) || [];
    assert.ok(
      matches.length >= 4,
      `Must contain at least 4 occurrences of mcp__rapid__ask_free_text, found ${matches.length}`
    );
  });

  it('5. contains at least 2 occurrences of the guardrail phrase "DO NOT call mcp__rapid__webui_ask_user"', () => {
    const phrase = 'DO NOT call mcp__rapid__webui_ask_user';
    // Count all occurrences (case-sensitive, literal match)
    let count = 0;
    let idx = 0;
    while ((idx = content.indexOf(phrase, idx)) !== -1) {
      count += 1;
      idx += phrase.length;
    }
    assert.ok(
      count >= 2,
      `Must contain at least 2 occurrences of "${phrase}", found ${count}`
    );
  });
});
