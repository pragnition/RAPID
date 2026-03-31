'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  generatePrinciplesMd,
  generateClaudeMdSection,
  loadPrinciples,
  PREDEFINED_CATEGORIES,
} = require('./principles.cjs');

// ────────────────────────────────────────────────────────────────
// Helper: create temp directory with .planning/ subdirectory
// ────────────────────────────────────────────────────────────────

function createTempDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-principles-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  return tmpDir;
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ────────────────────────────────────────────────────────────────
// Sample data factories
// ────────────────────────────────────────────────────────────────

function singlePrinciple() {
  return [
    { category: 'architecture', statement: 'Prefer composition over inheritance', rationale: 'Composition provides flexibility and avoids deep class hierarchies.' },
  ];
}

function multiCategoryPrinciples() {
  return [
    { category: 'architecture', statement: 'Prefer composition over inheritance', rationale: 'Composition provides flexibility.' },
    { category: 'architecture', statement: 'Use dependency injection', rationale: 'Improves testability.' },
    { category: 'code style', statement: 'Use strict mode everywhere', rationale: 'Prevents silent errors.' },
    { category: 'testing', statement: 'Test behavior not implementation', rationale: 'Makes tests resilient to refactoring.' },
    { category: 'security', statement: 'Never trust user input', rationale: 'Prevents injection attacks.' },
  ];
}

function customCategoryPrinciples() {
  return [
    { category: 'architecture', statement: 'Prefer composition', rationale: 'Flexibility.' },
    { category: 'compliance', statement: 'GDPR data retention', rationale: 'Legal requirement.' },
    { category: 'accessibility', statement: 'WCAG 2.1 AA compliance', rationale: 'Inclusive design.' },
  ];
}

// ────────────────────────────────────────────────────────────────
// generatePrinciplesMd tests
// ────────────────────────────────────────────────────────────────

describe('generatePrinciplesMd', () => {
  it('generates valid document for a single principle', () => {
    const md = generatePrinciplesMd(singlePrinciple());
    assert.ok(md.includes('# Project Principles'), 'should contain title');
    assert.ok(md.includes('## Architecture'), 'should contain category header');
    assert.ok(md.includes('- **Prefer composition over inheritance** -- Composition provides flexibility and avoids deep class hierarchies.'), 'should contain bullet');
  });

  it('orders categories by predefined order', () => {
    const data = multiCategoryPrinciples();
    const md = generatePrinciplesMd(data);
    const archIdx = md.indexOf('## Architecture');
    const codeIdx = md.indexOf('## Code Style');
    const testIdx = md.indexOf('## Testing');
    const secIdx = md.indexOf('## Security');
    assert.ok(archIdx < codeIdx, 'Architecture before Code Style');
    assert.ok(codeIdx < testIdx, 'Code Style before Testing');
    assert.ok(testIdx < secIdx, 'Testing before Security');
  });

  it('places custom categories after predefined categories', () => {
    const data = customCategoryPrinciples();
    const md = generatePrinciplesMd(data);
    const archIdx = md.indexOf('## Architecture');
    const accessIdx = md.indexOf('## Accessibility');
    const compIdx = md.indexOf('## Compliance');
    assert.ok(archIdx < accessIdx, 'Predefined (Architecture) before custom (Accessibility)');
    assert.ok(archIdx < compIdx, 'Predefined (Architecture) before custom (Compliance)');
    // Custom categories should be alphabetical
    assert.ok(accessIdx < compIdx, 'Custom categories in alphabetical order');
  });

  it('returns valid document with note for empty array', () => {
    const md = generatePrinciplesMd([]);
    assert.ok(md.includes('# Project Principles'), 'should contain title');
    assert.ok(md.includes('No principles captured yet.'), 'should contain empty note');
    assert.ok(md.includes('Categories: none'), 'should show none for categories');
  });

  it('throws TypeError for non-array input', () => {
    assert.throws(() => generatePrinciplesMd('not an array'), {
      name: 'TypeError',
      message: 'principlesData must be an array',
    });
    assert.throws(() => generatePrinciplesMd(null), {
      name: 'TypeError',
      message: 'principlesData must be an array',
    });
    assert.throws(() => generatePrinciplesMd(42), {
      name: 'TypeError',
      message: 'principlesData must be an array',
    });
    assert.throws(() => generatePrinciplesMd({}), {
      name: 'TypeError',
      message: 'principlesData must be an array',
    });
  });

  it('includes metadata header with Generated date and Categories summary', () => {
    const data = multiCategoryPrinciples();
    const md = generatePrinciplesMd(data);
    assert.ok(md.includes('> Generated:'), 'should contain Generated date');
    assert.ok(md.includes('> Categories: architecture, code style, testing, security'), 'should contain Categories summary');
    assert.ok(md.includes('> These principles guide development decisions.'), 'should contain instructions');
  });

  it('roundtrips: generate then parse back to equivalent data', () => {
    const data = multiCategoryPrinciples();
    const md = generatePrinciplesMd(data);

    let tmpDir;
    try {
      tmpDir = createTempDir();
      fs.writeFileSync(path.join(tmpDir, '.planning', 'PRINCIPLES.md'), md);
      const parsed = loadPrinciples(tmpDir);

      assert.ok(parsed !== null, 'parsed should not be null');
      assert.equal(parsed.length, data.length, 'same number of principles');

      for (const original of data) {
        const found = parsed.find(p =>
          p.category === original.category &&
          p.statement === original.statement
        );
        assert.ok(found, `should find principle: ${original.statement}`);
        assert.equal(found.rationale, original.rationale);
      }
    } finally {
      if (tmpDir) cleanupDir(tmpDir);
    }
  });

  it('renders principles without rationale as bold-only bullets', () => {
    const data = [
      { category: 'testing', statement: 'Always write tests', rationale: '' },
    ];
    const md = generatePrinciplesMd(data);
    assert.ok(md.includes('- **Always write tests**'), 'should contain bold-only bullet');
    assert.ok(!md.includes('- **Always write tests** --'), 'should NOT have trailing --');
  });
});

// ────────────────────────────────────────────────────────────────
// generateClaudeMdSection tests
// ────────────────────────────────────────────────────────────────

describe('generateClaudeMdSection', () => {
  it('generates section for a single principle', () => {
    const section = generateClaudeMdSection(singlePrinciple());
    assert.ok(section.includes('## Project Principles'), 'should contain heading');
    assert.ok(section.includes('**Architecture:**'), 'should contain category label');
    assert.ok(section.includes('Prefer composition over inheritance'), 'should contain statement');
  });

  it('joins multiple statements with semicolons per category', () => {
    const data = multiCategoryPrinciples();
    const section = generateClaudeMdSection(data);
    assert.ok(section.includes('**Architecture:** Prefer composition over inheritance; Use dependency injection'), 'should semicolon-join architecture');
    assert.ok(section.includes('**Code Style:** Use strict mode everywhere'), 'should have code style');
  });

  it('returns empty string for empty array', () => {
    const section = generateClaudeMdSection([]);
    assert.equal(section, '');
  });

  it('returns empty string for non-array input', () => {
    assert.equal(generateClaudeMdSection(null), '');
    assert.equal(generateClaudeMdSection(undefined), '');
  });

  it('does not exceed 45-line budget even with many principles', () => {
    // Generate 150 principles across 50 categories (well beyond 45-line budget)
    const data = [];
    for (let i = 0; i < 50; i++) {
      const cat = `custom category ${String(i).padStart(2, '0')}`;
      for (let j = 0; j < 3; j++) {
        data.push({
          category: cat,
          statement: `Principle ${i}-${j} statement here`,
          rationale: 'Some rationale',
        });
      }
    }
    const section = generateClaudeMdSection(data);
    const lineCount = section.split('\n').filter((_, idx, arr) => {
      // Don't count the trailing empty string from final newline
      return idx < arr.length - 1 || arr[idx] !== '';
    }).length;
    assert.ok(lineCount <= 45, `should not exceed 45 lines, got ${lineCount}`);
    assert.ok(section.includes('... and'), 'should contain truncation message');
    assert.ok(section.includes('more principles across'), 'should describe truncation');
  });

  it('always ends with pointer to PRINCIPLES.md when non-empty', () => {
    const section = generateClaudeMdSection(singlePrinciple());
    assert.ok(section.includes('> Full principles with rationale: `.planning/PRINCIPLES.md`'), 'should contain pointer');
  });

  it('maintains stable category order', () => {
    const data = customCategoryPrinciples();
    const section = generateClaudeMdSection(data);
    const archIdx = section.indexOf('**Architecture:**');
    const accessIdx = section.indexOf('**Accessibility:**');
    const compIdx = section.indexOf('**Compliance:**');
    assert.ok(archIdx < accessIdx, 'predefined before custom');
    assert.ok(accessIdx < compIdx, 'custom categories alphabetical');
  });
});

// ────────────────────────────────────────────────────────────────
// loadPrinciples tests
// ────────────────────────────────────────────────────────────────

describe('loadPrinciples', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('parses a generated PRINCIPLES.md file correctly', () => {
    const data = multiCategoryPrinciples();
    const md = generatePrinciplesMd(data);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PRINCIPLES.md'), md);

    const parsed = loadPrinciples(tmpDir);
    assert.ok(Array.isArray(parsed), 'should return an array');
    assert.equal(parsed.length, data.length, 'same count');

    // Verify each principle exists in parsed output
    for (const original of data) {
      const found = parsed.find(p =>
        p.category === original.category &&
        p.statement === original.statement &&
        p.rationale === original.rationale
      );
      assert.ok(found, `should find: [${original.category}] ${original.statement}`);
    }
  });

  it('returns null when file does not exist', () => {
    const result = loadPrinciples(tmpDir);
    // The .planning dir exists but PRINCIPLES.md does not
    // Actually we need to make sure PRINCIPLES.md doesn't exist
    const filePath = path.join(tmpDir, '.planning', 'PRINCIPLES.md');
    assert.ok(!fs.existsSync(filePath), 'file should not exist');
    assert.equal(result, null, 'should return null for missing file');
  });

  it('returns empty array for file with only header (no principles)', () => {
    const headerOnly = [
      '# Project Principles',
      '',
      '> Generated: 2026-03-31',
      '> Categories: none',
      '>',
      '> These principles guide development decisions.',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PRINCIPLES.md'), headerOnly);

    const parsed = loadPrinciples(tmpDir);
    assert.ok(Array.isArray(parsed), 'should return an array, not null');
    assert.equal(parsed.length, 0, 'should be empty array');
  });

  it('handles extra blank lines and non-standard formatting gracefully', () => {
    const messy = [
      '# Project Principles',
      '',
      '> Some metadata here',
      '',
      '## Architecture',
      '',
      '',
      '- **Prefer composition** -- Flexibility.',
      '',
      '  Some random text that should be skipped.',
      '',
      '- **Use DI** -- Testability.',
      '',
      '## Testing',
      '',
      'This is a paragraph that should be skipped.',
      '',
      '- **Test behavior** -- Resilience.',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PRINCIPLES.md'), messy);

    const parsed = loadPrinciples(tmpDir);
    assert.equal(parsed.length, 3, 'should parse 3 principles');
    assert.equal(parsed[0].category, 'architecture');
    assert.equal(parsed[0].statement, 'Prefer composition');
    assert.equal(parsed[1].statement, 'Use DI');
    assert.equal(parsed[2].category, 'testing');
    assert.equal(parsed[2].statement, 'Test behavior');
  });

  it('parses principle without rationale (missing -- separator)', () => {
    const noRationale = [
      '# Project Principles',
      '',
      '## Security',
      '',
      '- **Never trust user input**',
      '- **Sanitize all outputs** -- Prevents XSS.',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PRINCIPLES.md'), noRationale);

    const parsed = loadPrinciples(tmpDir);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].statement, 'Never trust user input');
    assert.equal(parsed[0].rationale, '', 'missing rationale should be empty string');
    assert.equal(parsed[1].rationale, 'Prevents XSS.');
  });

  it('re-throws non-ENOENT errors (e.g., EISDIR)', () => {
    // Trying to read a directory as a file throws EISDIR, not ENOENT
    const dirAsFile = path.join(tmpDir, '.planning', 'PRINCIPLES.md');
    fs.mkdirSync(dirAsFile, { recursive: true });

    assert.throws(() => loadPrinciples(tmpDir), (err) => {
      // Should be EISDIR or similar, but NOT treated as missing file
      return err.code !== 'ENOENT';
    }, 'should re-throw non-ENOENT error');
  });

  it('lowercases category names during parsing', () => {
    const mixedCase = [
      '# Project Principles',
      '',
      '## Architecture',
      '',
      '- **Use layers** -- Separation of concerns.',
      '',
      '## Code Style',
      '',
      '- **Use strict** -- Prevents errors.',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PRINCIPLES.md'), mixedCase);

    const parsed = loadPrinciples(tmpDir);
    assert.equal(parsed[0].category, 'architecture', 'category should be lowercase');
    assert.equal(parsed[1].category, 'code style', 'category should be lowercase');
  });
});
