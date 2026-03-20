'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROLE_PATH = path.resolve(__dirname, 'role-branding.md');

describe('src/modules/roles/role-branding.md -- structural validation', () => {
  let content;

  it('1. file exists', () => {
    assert.ok(fs.existsSync(ROLE_PATH), `Expected file at ${ROLE_PATH}`);
    content = fs.readFileSync(ROLE_PATH, 'utf-8');
  });

  it('2. starts with # Role: heading convention', () => {
    assert.ok(content, 'File content must be loaded');
    const firstLine = content.split('\n')[0].trim();
    assert.ok(
      /^#\s+Role:/.test(firstLine),
      `First line must match "# Role:" heading convention, got: "${firstLine}"`
    );
  });

  it('3. contains ## Responsibilities section with bullet items', () => {
    assert.ok(
      /^##\s+Responsibilities/m.test(content),
      'Must contain ## Responsibilities heading'
    );
    // Extract the Responsibilities section (up to next ## heading)
    const respMatch = content.match(/##\s+Responsibilities\s*\n([\s\S]*?)(?=\n##\s|\n$|$)/);
    assert.ok(respMatch, 'Must have content under ## Responsibilities');
    const respSection = respMatch[1];
    const bulletLines = respSection.match(/^-\s+/gm);
    assert.ok(bulletLines && bulletLines.length > 0, 'Responsibilities must have bullet items');
  });

  it('4. contains ## Constraints section', () => {
    assert.ok(
      /^##\s+Constraints/m.test(content),
      'Must contain ## Constraints heading'
    );
  });

  it('5. references .planning/branding/BRANDING.md output path', () => {
    assert.ok(
      content.includes('.planning/branding/BRANDING.md'),
      'Must reference .planning/branding/BRANDING.md output path'
    );
  });

  it('6. mentions all 4 branding dimensions (Tone & Voice, Terminology & Naming, Output Style, Project Identity)', () => {
    const dimensions = [
      'Tone & Voice',
      'Terminology & Naming',
      'Output Style',
      'Project Identity',
    ];
    for (const dim of dimensions) {
      assert.ok(
        content.includes(dim),
        `Must mention branding dimension: "${dim}"`
      );
    }
  });

  it('7. describes BRANDING.md format with XML tags (identity, tone, terminology, output, anti-patterns)', () => {
    const tags = ['identity', 'tone', 'terminology', 'output', 'anti-patterns'];
    for (const tag of tags) {
      assert.ok(
        content.includes(`<${tag}>`),
        `Must contain opening XML tag: <${tag}>`
      );
      assert.ok(
        content.includes(`</${tag}>`),
        `Must contain closing XML tag: </${tag}>`
      );
    }
  });

  it('8. specifies 50-150 line budget', () => {
    assert.ok(
      content.includes('50-150') || (content.includes('50') && content.includes('150')),
      'Must specify the 50-150 line budget'
    );
    assert.ok(
      content.toLowerCase().includes('line'),
      'Must mention "line" in reference to the budget'
    );
  });

  it('9. mentions AskUserQuestion with prefilled options', () => {
    assert.ok(
      content.includes('AskUserQuestion'),
      'Must mention AskUserQuestion'
    );
    assert.ok(
      content.includes('prefilled') || content.includes('pre-filled'),
      'Must mention prefilled options for AskUserQuestion'
    );
  });

  it('10. mentions re-run support', () => {
    assert.ok(
      /re-run/i.test(content),
      'Must mention re-run support'
    );
    // Should describe preserving unchanged sections
    assert.ok(
      content.includes('update') || content.includes('Update'),
      'Must describe update behavior on re-run'
    );
  });

  it('11. mentions static HTML generation', () => {
    assert.ok(
      content.includes('index.html') || content.includes('HTML'),
      'Must mention HTML page generation'
    );
    assert.ok(
      content.includes('static') || content.includes('self-contained'),
      'Must describe the HTML as static or self-contained'
    );
  });

  it('12. states branding is optional', () => {
    assert.ok(
      content.toLowerCase().includes('optional'),
      'Must state that branding is optional'
    );
  });

  it('13. does not instruct modification of existing RAPID source', () => {
    // Should not contain instructions to modify RAPID core files
    const dangerousPatterns = [
      'modify src/core/',
      'edit src/core/',
      'change src/bin/',
      'update execute.cjs',
      'modify rapid-tools.cjs',
    ];
    for (const pattern of dangerousPatterns) {
      assert.ok(
        !content.includes(pattern),
        `Must not contain instruction to "${pattern}"`
      );
    }
    // Positive check: should explicitly state scope limits
    assert.ok(
      content.includes('Never modify files outside') ||
      content.includes('scope') ||
      content.includes('Do NOT modify'),
      'Should state that modifications are scoped to branding directory'
    );
  });
});
