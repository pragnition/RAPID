'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL_PATH = path.resolve(__dirname, 'SKILL.md');

describe('skills/uat/SKILL.md -- structural validation', () => {
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
    assert.ok(/^\s*description\s*:/m.test(frontmatter), 'Frontmatter must contain "description" key');
    assert.ok(/^\s*allowed-tools\s*:/m.test(frontmatter), 'Frontmatter must contain "allowed-tools" key');
  });

  it('3. frontmatter allowed-tools includes AskUserQuestion', () => {
    const parts = content.split('---');
    const frontmatter = parts[1];
    const match = frontmatter.match(/^\s*allowed-tools\s*:\s*(.+)/m);
    assert.ok(match, 'allowed-tools key must have a value');
    assert.ok(match[1].includes('AskUserQuestion'), 'allowed-tools must include AskUserQuestion');
  });

  it('4. frontmatter allowed-tools includes Agent', () => {
    const parts = content.split('---');
    const frontmatter = parts[1];
    const match = frontmatter.match(/^\s*allowed-tools\s*:\s*(.+)/m);
    assert.ok(match, 'allowed-tools key must have a value');
    assert.ok(match[1].includes('Agent'), 'allowed-tools must include Agent');
  });

  it('5. no browser automation references', () => {
    const forbidden = ['browserConfig', 'BROWSER_TOOL', 'chrome-devtools'];
    for (const term of forbidden) {
      assert.ok(!content.includes(term), `Must not contain "${term}"`);
    }
    // Case-insensitive checks
    const lower = content.toLowerCase();
    assert.ok(!lower.includes('playwright'), 'Must not contain "playwright" (case-insensitive)');
    assert.ok(!lower.includes('chrome devtools'), 'Must not contain "chrome devtools" (case-insensitive)');
    assert.ok(!lower.includes('browser automation'), 'Must not contain "browser automation" (case-insensitive)');
  });

  it('6. no automated retry logic', () => {
    const forbidden = ['Step 7a', 'rapid-uat-fixer', 'retryCount', 'Retry on Failure'];
    for (const term of forbidden) {
      assert.ok(!content.includes(term), `Must not contain "${term}"`);
    }
  });

  it('7. no automated/human step classification', () => {
    const forbidden = ['[automated]', 'type: "automated"', 'type: "human"', 'autoCount'];
    for (const term of forbidden) {
      assert.ok(!content.includes(term), `Must not contain classification pattern "${term}"`);
    }
  });

  it('8. step ordering is sequential', () => {
    // Match only ## Step N headings (not ### substeps like 7b, 8b)
    const stepPattern = /^## Step (\d+)/gm;
    const steps = [];
    let match;
    while ((match = stepPattern.exec(content)) !== null) {
      steps.push(parseInt(match[1], 10));
    }
    assert.ok(steps.length >= 8, `Must have at least 8 step headings, found ${steps.length}`);
    for (let i = 0; i < steps.length; i++) {
      assert.equal(steps[i], i, `Step ${i} must be in order, found Step ${steps[i]}`);
    }
  });

  it('9. Step 6 contains human verification loop with AskUserQuestion', () => {
    // Extract Step 6 section (from ## Step 6 to next ## Step)
    const step6Match = content.match(/## Step 6[\s\S]*?(?=## Step 7|$)/);
    assert.ok(step6Match, 'Must have a Step 6 section');
    const step6 = step6Match[0];
    assert.ok(step6.includes('AskUserQuestion'), 'Step 6 must contain AskUserQuestion');
    const verdicts = ['Pass', 'Fail', 'Skip', 'Pass all remaining'];
    for (const v of verdicts) {
      assert.ok(step6.includes(v), `Step 6 must contain verdict option "${v}"`);
    }
  });

  it('10. Step 6 failure path collects severity', () => {
    const step6Match = content.match(/## Step 6[\s\S]*?(?=## Step 7|$)/);
    assert.ok(step6Match, 'Must have a Step 6 section');
    const step6 = step6Match[0];
    const severities = ['Critical', 'High', 'Medium', 'Low'];
    for (const s of severities) {
      assert.ok(step6.includes(s), `Step 6 failure path must contain severity "${s}"`);
    }
  });

  it('11. UAT-FAILURES.md writing step exists', () => {
    assert.ok(content.includes('UAT-FAILURES.md'), 'Must reference UAT-FAILURES.md');
    assert.ok(content.includes('UAT-FAILURES-META'), 'Must reference UAT-FAILURES-META');
    assert.ok(content.includes('UAT-FORMAT:v2'), 'Must reference UAT-FORMAT:v2');
  });

  it('12. completion banner has no Automated count', () => {
    // Find Step 9 or the completion banner section
    const step9Match = content.match(/## Step 9[\s\S]*?(?=## |$)/);
    assert.ok(step9Match, 'Must have a Step 9 section (completion banner)');
    const step9 = step9Match[0];
    assert.ok(!step9.includes('Automated:'), 'Completion banner must not contain "Automated:" metric');
  });

  it('13. REVIEW-UAT.md format has no Type column', () => {
    // Find the REVIEW-UAT.md writing section (Step 7)
    const step7Match = content.match(/## Step 7[\s\S]*?(?=## Step 8|$)/);
    assert.ok(step7Match, 'Must have a Step 7 section (REVIEW-UAT.md writing)');
    const step7 = step7Match[0];
    assert.ok(!step7.includes('| Type |'), 'REVIEW-UAT.md format must not contain "| Type |" table header');
  });

  it('14. Important Notes section has no browser references', () => {
    const notesMatch = content.match(/## Important Notes[\s\S]*$/);
    assert.ok(notesMatch, 'Must have an Important Notes section');
    const notes = notesMatch[0];
    const lower = notes.toLowerCase();
    assert.ok(!lower.includes('browser'), 'Important Notes must not contain "browser" (case-insensitive)');
    assert.ok(!notes.includes('CHECKPOINT'), 'Important Notes must not contain "CHECKPOINT"');
  });
});
