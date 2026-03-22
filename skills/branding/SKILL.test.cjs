'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL_PATH = path.resolve(__dirname, 'SKILL.md');

describe('skills/branding/SKILL.md -- structural validation', () => {
  let content;

  // Load file once before all tests
  it('1. file exists', () => {
    assert.ok(fs.existsSync(SKILL_PATH), `Expected file at ${SKILL_PATH}`);
    content = fs.readFileSync(SKILL_PATH, 'utf-8');
  });

  it('2. valid YAML frontmatter (contains description and allowed-tools keys)', () => {
    assert.ok(content, 'File content must be loaded');
    // Frontmatter is between the first two --- delimiters
    const parts = content.split('---');
    assert.ok(parts.length >= 3, 'File must have YAML frontmatter delimited by ---');
    const frontmatter = parts[1];
    assert.ok(/^\s*description\s*:/m.test(frontmatter), 'Frontmatter must contain "description" key');
    assert.ok(/^\s*allowed-tools\s*:/m.test(frontmatter), 'Frontmatter must contain "allowed-tools" key');
  });

  it('3. frontmatter description is non-empty string', () => {
    const parts = content.split('---');
    const frontmatter = parts[1];
    const match = frontmatter.match(/^\s*description\s*:\s*(.+)/m);
    assert.ok(match, 'description key must have a value');
    const value = match[1].trim();
    assert.ok(value.length > 0, 'description must be a non-empty string');
  });

  it('4. frontmatter allowed-tools includes AskUserQuestion', () => {
    const parts = content.split('---');
    const frontmatter = parts[1];
    const match = frontmatter.match(/^\s*allowed-tools\s*:\s*(.+)/m);
    assert.ok(match, 'allowed-tools key must have a value');
    assert.ok(match[1].includes('AskUserQuestion'), 'allowed-tools must include AskUserQuestion');
  });

  it('5. references .planning/branding/BRANDING.md output path', () => {
    assert.ok(
      content.includes('.planning/branding/BRANDING.md'),
      'Must reference .planning/branding/BRANDING.md output path'
    );
  });

  it('6. contains 4 branding interview rounds with project-type-aware names', () => {
    // Round 1: Visual Identity or Output Identity
    assert.ok(
      content.includes('Visual Identity') || content.includes('Output Identity'),
      'Must contain Visual Identity or Output Identity for Round 1'
    );
    // Round 2: Component Style or Error
    assert.ok(
      content.includes('Component Style') || content.includes('Error'),
      'Must contain Component Style or Error for Round 2'
    );
    // Round 3: Terminology (unchanged)
    assert.ok(
      content.includes('Terminology'),
      'Must contain Terminology for Round 3'
    );
    // Round 4: Interaction Patterns or Log
    assert.ok(
      content.includes('Interaction Patterns') || content.includes('Log'),
      'Must contain Interaction Patterns or Log for Round 4'
    );
    // Verify there are exactly 4 round headings (### Round N)
    const roundHeadings = content.match(/###\s+Round\s+\d+/g);
    assert.ok(roundHeadings, 'Must have ### Round N headings');
    assert.equal(roundHeadings.length, 4, 'Must have exactly 4 interview round headings');
  });

  it('7. each interview round uses AskUserQuestion', () => {
    // Split by round headings and check each round section
    const roundSections = content.split(/###\s+Round\s+\d+/).slice(1); // skip preamble
    assert.equal(roundSections.length, 4, 'Must have 4 round sections');
    for (let i = 0; i < roundSections.length; i++) {
      // Each round section ends at the next ### or ## heading
      const section = roundSections[i].split(/^##[^#]/m)[0];
      assert.ok(
        section.includes('AskUserQuestion'),
        `Round ${i + 1} must reference AskUserQuestion`
      );
    }
  });

  it('8. each AskUserQuestion in interview rounds has 3-4 prefilled options', () => {
    // Extract each round section and count option lines in the PRIMARY code block only
    const roundSections = content.split(/###\s+Round\s+\d+/).slice(1);
    for (let i = 0; i < roundSections.length; i++) {
      // Get content up to the next ### or ## heading
      const section = roundSections[i].split(/^###?\s/m)[0];
      // Extract the first code block (the primary AskUserQuestion)
      const codeBlockMatch = section.match(/```[\s\S]*?```/);
      assert.ok(codeBlockMatch, `Round ${i + 1} must have a code block with AskUserQuestion`);
      const primaryBlock = codeBlockMatch[0];
      // Count option lines within the primary code block
      const optionLines = primaryBlock.match(/^-\s+"[^"]+"/gm);
      assert.ok(optionLines, `Round ${i + 1} must have prefilled option lines`);
      assert.ok(
        optionLines.length >= 3 && optionLines.length <= 4,
        `Round ${i + 1} must have 3-4 prefilled options, found ${optionLines.length}`
      );
    }
  });

  it('9. contains re-run UX detecting existing BRANDING.md', () => {
    // Must check for existing file and have re-run handling
    assert.ok(
      content.includes('BRANDING.md already exists') || content.includes('re-run'),
      'Must contain re-run UX for existing BRANDING.md'
    );
    // Must check file existence
    assert.ok(
      content.includes('BRANDING.md') && (content.includes('exists') || content.includes('-f')),
      'Must detect existing BRANDING.md file'
    );
  });

  it('10. re-run offers three choices (Update specific sections, Start fresh, View current and exit)', () => {
    const choices = [
      'Update specific sections',
      'Start fresh',
      'View current and exit',
    ];
    for (const choice of choices) {
      assert.ok(
        content.includes(choice),
        `Re-run UX must offer choice: "${choice}"`
      );
    }
  });

  it('11. contains static HTML generation step', () => {
    assert.ok(
      content.includes('index.html'),
      'Must reference index.html generation'
    );
    assert.ok(
      content.includes('HTML') && (content.includes('static') || content.includes('Static')),
      'Must describe static HTML generation'
    );
  });

  it('12. contains auto-open step (platform detection with xdg-open/open)', () => {
    assert.ok(content.includes('xdg-open'), 'Must reference xdg-open for Linux');
    assert.ok(
      // Match 'open' as the macOS command (not just substring of xdg-open)
      /\bopen\b/.test(content) && content.includes('Darwin'),
      'Must reference open command for macOS (Darwin)'
    );
  });

  it('13. contains anti-patterns final question', () => {
    assert.ok(
      content.includes('Anti-Patterns') || content.includes('anti-patterns'),
      'Must contain anti-patterns section'
    );
    // The final question specifically
    assert.ok(
      content.includes('Final Question') || content.includes('final question'),
      'Must have a final question section for anti-patterns'
    );
    assert.ok(
      content.includes('AVOID'),
      'Anti-patterns question must ask what to AVOID'
    );
  });

  it('14. does not reference modifying existing RAPID source code', () => {
    // Should NOT instruct modifications to core RAPID files
    assert.ok(
      content.includes('Do NOT reference or modify any RAPID internals') ||
      content.includes('Do NOT modify') ||
      !content.includes('modify execute.cjs'),
      'Must not instruct modification of existing RAPID source code'
    );
    // Specific check: should not tell agents to edit core source files
    const dangerousPatterns = [
      'modify src/core/',
      'edit src/core/',
      'change src/bin/',
    ];
    for (const pattern of dangerousPatterns) {
      assert.ok(
        !content.includes(pattern),
        `Must not contain instruction to "${pattern}"`
      );
    }
  });

  it('15. step ordering is sequential (Step 1 through Step 8)', () => {
    const stepPattern = /##\s+Step\s+(\d+)/g;
    const steps = [];
    let match;
    while ((match = stepPattern.exec(content)) !== null) {
      steps.push(parseInt(match[1], 10));
    }
    assert.ok(steps.length >= 7, `Must have at least 7 steps, found ${steps.length}`);
    for (let i = 0; i < steps.length; i++) {
      assert.equal(steps[i], i + 1, `Step ${i + 1} must be in order, found Step ${steps[i]}`);
    }
  });

  it('16. codebase detection step exists with multi-signal heuristic', () => {
    // Verify a step heading references codebase/project type detection
    assert.ok(
      /##\s+Step\s+\d+.*(?:Codebase Detection|Project Type|detect)/i.test(content),
      'Must have a step heading referencing codebase detection or project type detection'
    );
    // Verify it references reading package.json
    assert.ok(
      content.includes('package.json'),
      'Detection step must reference reading package.json'
    );
    // Verify it references checking directory structure
    assert.ok(
      content.includes('directory structure') || content.includes('Glob'),
      'Detection step must reference checking directory structure'
    );
  });

  it('17. contains project-type-conditional content for both webapp and CLI', () => {
    // Check for both webapp and CLI/library conditional content
    assert.ok(
      content.includes('webapp'),
      'Must contain webapp project type references'
    );
    assert.ok(
      content.includes('cli') || content.includes('CLI'),
      'Must contain CLI project type references'
    );
    // Check for visual identity keywords
    assert.ok(
      content.includes('color') || content.includes('typography') || content.includes('palette'),
      'Must contain visual identity keywords (color, typography, or palette)'
    );
    // Check for CLI-specific keywords
    assert.ok(
      content.includes('terminal') || content.includes('error') || content.includes('output formatting'),
      'Must contain CLI keywords (terminal, error, or output formatting)'
    );
  });
});
