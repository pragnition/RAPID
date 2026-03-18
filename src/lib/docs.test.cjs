'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { scaffoldDocTemplates, updateDocSection } = require('./docs.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-docs-test-'));
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// scaffoldDocTemplates
// ---------------------------------------------------------------------------

describe('scaffoldDocTemplates', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { cleanup(tmpDir); });

  const FULL_FILES = [
    'setup.md', 'planning.md', 'execution.md', 'agents.md',
    'configuration.md', 'merge-and-cleanup.md', 'review.md',
    'state-machines.md', 'troubleshooting.md',
  ];

  it('should create all 9 template files for full scope', () => {
    scaffoldDocTemplates(tmpDir, 'full');

    const docsDir = path.join(tmpDir, 'docs');
    for (const file of FULL_FILES) {
      assert.ok(
        fs.existsSync(path.join(docsDir, file)),
        `${file} should exist`,
      );
    }

    // Verify each file starts with # Title heading
    for (const file of FULL_FILES) {
      const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
      assert.ok(content.startsWith('# '), `${file} should start with # heading`);
    }
  });

  it('should return array of created file paths', () => {
    const created = scaffoldDocTemplates(tmpDir, 'full');

    assert.equal(created.length, 9, 'should create 9 files');
    for (const filePath of created) {
      assert.ok(path.isAbsolute(filePath), `${filePath} should be absolute`);
      assert.ok(fs.existsSync(filePath), `${filePath} should exist`);
    }
  });

  it('should never overwrite existing files (idempotency)', () => {
    const docsDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });

    const customContent = '# My Custom Setup\n\nThis is custom content.\n';
    fs.writeFileSync(path.join(docsDir, 'setup.md'), customContent, 'utf-8');

    const created = scaffoldDocTemplates(tmpDir, 'full');

    // setup.md should not be in the returned array
    const setupPaths = created.filter((p) => p.endsWith('setup.md'));
    assert.equal(setupPaths.length, 0, 'setup.md should not be in created list');

    // setup.md content should be unchanged
    const afterContent = fs.readFileSync(path.join(docsDir, 'setup.md'), 'utf-8');
    assert.equal(afterContent, customContent, 'setup.md content should be unchanged');

    // Other files should still be created (8 files)
    assert.equal(created.length, 8, 'should create 8 files (all except setup.md)');
  });

  it('should be idempotent on second call', () => {
    const first = scaffoldDocTemplates(tmpDir, 'full');
    assert.equal(first.length, 9, 'first call should create 9 files');

    const second = scaffoldDocTemplates(tmpDir, 'full');
    assert.equal(second.length, 0, 'second call should create 0 files');
  });

  it('should create docs/ directory if missing', () => {
    const docsDir = path.join(tmpDir, 'docs');
    assert.ok(!fs.existsSync(docsDir), 'docs/ should not exist initially');

    scaffoldDocTemplates(tmpDir, 'full');

    assert.ok(fs.existsSync(docsDir), 'docs/ should be created');
  });

  it('should create only CHANGELOG.md for changelog scope', () => {
    const created = scaffoldDocTemplates(tmpDir, 'changelog');

    assert.equal(created.length, 1, 'should create 1 file');
    assert.ok(created[0].endsWith('CHANGELOG.md'), 'should be CHANGELOG.md');

    // Verify none of the 9 guide files exist
    const docsDir = path.join(tmpDir, 'docs');
    for (const file of FULL_FILES) {
      assert.ok(
        !fs.existsSync(path.join(docsDir, file)),
        `${file} should NOT exist`,
      );
    }
  });

  it('should create correct subset for api scope', () => {
    const created = scaffoldDocTemplates(tmpDir, 'api');

    const createdNames = created.map((p) => path.basename(p));
    assert.deepEqual(
      createdNames.sort(),
      ['agents.md', 'configuration.md', 'state-machines.md'].sort(),
    );
    assert.equal(created.length, 3);
  });

  it('should create correct subset for architecture scope', () => {
    const created = scaffoldDocTemplates(tmpDir, 'architecture');

    const createdNames = created.map((p) => path.basename(p));
    const expected = [
      'setup.md', 'planning.md', 'execution.md',
      'merge-and-cleanup.md', 'review.md', 'troubleshooting.md',
    ];
    assert.deepEqual(createdNames.sort(), expected.sort());
    assert.equal(created.length, 6);
  });

  it('should default scope to full when null/undefined', () => {
    const created1 = scaffoldDocTemplates(tmpDir, null);
    assert.equal(created1.length, 9, 'null scope should create 9 files');

    // Clean up and test undefined
    cleanup(tmpDir);
    tmpDir = makeTmpDir();

    const created2 = scaffoldDocTemplates(tmpDir, undefined);
    assert.equal(created2.length, 9, 'undefined scope should create 9 files');
  });

  it('should produce template content with proper heading structure', () => {
    scaffoldDocTemplates(tmpDir, 'full');

    const setupContent = fs.readFileSync(
      path.join(tmpDir, 'docs', 'setup.md'),
      'utf-8',
    );

    // Should have # title heading
    assert.ok(setupContent.includes('# Setup'), 'should contain # Setup title');

    // Should have ## section headings
    assert.ok(setupContent.includes('## Prerequisites'), 'should contain ## Prerequisites');
    assert.ok(setupContent.includes('## Installation'), 'should contain ## Installation');

    // Should have placeholder text
    assert.ok(
      setupContent.includes('Step-by-step installation instructions'),
      'should contain placeholder text',
    );
  });
});

// ---------------------------------------------------------------------------
// updateDocSection
// ---------------------------------------------------------------------------

describe('updateDocSection', () => {
  let tmpDir;
  let testFile;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    testFile = path.join(tmpDir, 'test.md');
  });
  afterEach(() => { cleanup(tmpDir); });

  it('should replace a matching section by heading', () => {
    const original = '# Doc\n\n## Foo\n\nold content\n\n## Bar\n\nbar content\n';
    fs.writeFileSync(testFile, original, 'utf-8');

    updateDocSection(testFile, 'Foo', 'new content');

    const result = fs.readFileSync(testFile, 'utf-8');
    assert.ok(result.includes('## Foo'), 'Foo heading should be preserved');
    assert.ok(result.includes('new content'), 'new content should be present');
    assert.ok(!result.includes('old content'), 'old content should be gone');
    assert.ok(result.includes('## Bar'), 'Bar heading should be preserved');
    assert.ok(result.includes('bar content'), 'bar content should be preserved');
  });

  it('should preserve all non-targeted sections byte-for-byte', () => {
    const original = [
      '# Title\n',
      '\n## Section1\n\ncontent1 with special chars: @#$%\n',
      '\n## Section2\n\ncontent2\n',
      '\n## Section3\n\ncontent3\n',
      '\n## Section4\n\ncontent4\n',
    ].join('');
    fs.writeFileSync(testFile, original, 'utf-8');

    updateDocSection(testFile, 'Section2', 'updated content2');

    const result = fs.readFileSync(testFile, 'utf-8');

    // Section1, Section3, Section4 should be preserved exactly
    assert.ok(result.includes('content1 with special chars: @#$%'), 'section1 preserved');
    assert.ok(result.includes('content3'), 'section3 preserved');
    assert.ok(result.includes('content4'), 'section4 preserved');
    assert.ok(result.includes('## Section1'), 'section1 heading preserved');
    assert.ok(result.includes('## Section3'), 'section3 heading preserved');
    assert.ok(result.includes('## Section4'), 'section4 heading preserved');
  });

  it('should match headings case-insensitively', () => {
    const original = '# Doc\n\n## SETUP\n\nold setup content\n';
    fs.writeFileSync(testFile, original, 'utf-8');

    const result = updateDocSection(testFile, 'setup', 'new setup content');

    assert.ok(result.updated, 'should report updated');
    const content = fs.readFileSync(testFile, 'utf-8');
    assert.ok(content.includes('## SETUP'), 'original heading case preserved');
    assert.ok(content.includes('new setup content'), 'new content present');
  });

  it('should append section when heading not found', () => {
    const original = '# Doc\n\n## Existing\n\nexisting content\n';
    fs.writeFileSync(testFile, original, 'utf-8');

    const result = updateDocSection(testFile, 'NewSection', 'new section content');

    assert.ok(result.updated, 'should report updated');
    const content = fs.readFileSync(testFile, 'utf-8');
    assert.ok(content.includes('## NewSection'), 'new heading appended');
    assert.ok(content.includes('new section content'), 'new content appended');
    // Original content should still be there
    assert.ok(content.includes('## Existing'), 'existing heading preserved');
    assert.ok(content.includes('existing content'), 'existing content preserved');
  });

  it('should return updated:false when content is identical', () => {
    const original = '# Doc\n\n## Foo\n\nsame content\n';
    fs.writeFileSync(testFile, original, 'utf-8');

    const result = updateDocSection(testFile, 'Foo', 'same content');

    assert.equal(result.updated, false, 'should not be updated');
    assert.equal(result.diff, '', 'diff should be empty');
  });

  it('should return updated:true with diff when content changes', () => {
    const original = '# Doc\n\n## Foo\n\nold text\n';
    fs.writeFileSync(testFile, original, 'utf-8');

    const result = updateDocSection(testFile, 'Foo', 'new text');

    assert.equal(result.updated, true, 'should be updated');
    assert.ok(result.diff.includes('old text'), 'diff should contain old content');
    assert.ok(result.diff.includes('new text'), 'diff should contain new content');
    assert.ok(result.diff.includes('--- old'), 'diff should have old marker');
    assert.ok(result.diff.includes('+++ new'), 'diff should have new marker');
  });

  it('should handle nested headings correctly', () => {
    const original = [
      '# Doc\n',
      '\n## Parent\n\nparent text\n',
      '\n### Child\n\nchild text\n',
      '\n## Sibling\n\nsibling text\n',
    ].join('');
    fs.writeFileSync(testFile, original, 'utf-8');

    updateDocSection(testFile, 'Parent', 'replaced parent');

    const result = fs.readFileSync(testFile, 'utf-8');
    // ### Child should be replaced (it is within Parent's scope)
    assert.ok(!result.includes('child text'), 'child text should be replaced');
    assert.ok(!result.includes('### Child'), 'child heading should be replaced');
    // ## Sibling should be preserved
    assert.ok(result.includes('## Sibling'), 'sibling heading preserved');
    assert.ok(result.includes('sibling text'), 'sibling text preserved');
    // New content should be present
    assert.ok(result.includes('replaced parent'), 'new content present');
  });

  it('should preserve preamble/frontmatter', () => {
    const preamble = 'This is preamble text before any heading.\n\n';
    const original = preamble + '## Section1\n\ncontent1\n\n## Section2\n\ncontent2\n';
    fs.writeFileSync(testFile, original, 'utf-8');

    updateDocSection(testFile, 'Section2', 'updated content2');

    const result = fs.readFileSync(testFile, 'utf-8');
    assert.ok(
      result.startsWith('This is preamble text before any heading.'),
      'preamble should be preserved',
    );
  });

  it('should handle file with single section', () => {
    const original = '## Only\n\nonly content here\n';
    fs.writeFileSync(testFile, original, 'utf-8');

    updateDocSection(testFile, 'Only', 'replaced content');

    const result = fs.readFileSync(testFile, 'utf-8');
    assert.ok(result.includes('## Only'), 'heading preserved');
    assert.ok(result.includes('replaced content'), 'content replaced');
    assert.ok(!result.includes('only content here'), 'old content removed');
  });

  it('should handle empty new content', () => {
    const original = '# Doc\n\n## Foo\n\nsome content\n\n## Bar\n\nbar content\n';
    fs.writeFileSync(testFile, original, 'utf-8');

    updateDocSection(testFile, 'Foo', '');

    const result = fs.readFileSync(testFile, 'utf-8');
    assert.ok(result.includes('## Foo'), 'Foo heading preserved');
    assert.ok(!result.includes('some content'), 'old content removed');
    assert.ok(result.includes('## Bar'), 'Bar heading preserved');
    assert.ok(result.includes('bar content'), 'bar content preserved');
  });
});
