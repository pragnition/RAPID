'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadQualityProfile } = require('./quality.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  return tmpDir;
}

function writeQualityMd(tmpDir, content) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), content, 'utf-8');
}

function readQualityMd(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
}

function qualityMdExists(tmpDir) {
  return fs.existsSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'));
}

function patternsMdExists(tmpDir) {
  return fs.existsSync(path.join(tmpDir, '.planning', 'context', 'PATTERNS.md'));
}

// ---------------------------------------------------------------------------
// loadQualityProfile
// ---------------------------------------------------------------------------

describe('loadQualityProfile', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should create .planning/context/ directory if it does not exist', () => {
    // Remove context dir that makeTmpDir created
    fs.rmSync(path.join(tmpDir, '.planning', 'context'), { recursive: true, force: true });
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'context')), 'context dir should not exist');

    loadQualityProfile(tmpDir);

    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'context')),
      'context dir should exist after loadQualityProfile',
    );
  });

  it('should generate default QUALITY.md when file does not exist', () => {
    assert.ok(!qualityMdExists(tmpDir), 'QUALITY.md should not exist yet');

    loadQualityProfile(tmpDir);

    assert.ok(qualityMdExists(tmpDir), 'QUALITY.md should be created');
    const content = readQualityMd(tmpDir);
    assert.ok(content.includes('# Quality Profile'), 'should contain # Quality Profile heading');
    assert.ok(content.includes('## Approved Patterns'), 'should contain ## Approved Patterns');
    assert.ok(content.includes('## Anti-Patterns'), 'should contain ## Anti-Patterns');
  });

  it('should generate default PATTERNS.md when file does not exist', () => {
    assert.ok(!patternsMdExists(tmpDir), 'PATTERNS.md should not exist yet');

    loadQualityProfile(tmpDir);

    assert.ok(patternsMdExists(tmpDir), 'PATTERNS.md should be created');
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'PATTERNS.md'), 'utf-8');
    assert.ok(content.includes('# Pattern Library'), 'should contain # Pattern Library heading');
  });

  it('should parse existing QUALITY.md instead of generating default', () => {
    const customContent = `# Quality Profile

## Approved Patterns

### General
- Use dependency injection
- Write pure functions where possible

## Anti-Patterns

### General
- Avoid singleton state
`;
    writeQualityMd(tmpDir, customContent);

    const profile = loadQualityProfile(tmpDir);

    // Should contain the custom patterns, not default ones
    assert.ok(
      profile.approvedPatterns.general.includes('Use dependency injection'),
      'should parse custom approved pattern',
    );
    assert.ok(
      profile.antiPatterns.general.includes('Avoid singleton state'),
      'should parse custom anti-pattern',
    );
  });

  it('should return approvedPatterns and antiPatterns in parsed profile', () => {
    const customContent = `# Quality Profile

## Approved Patterns

### General
- Pattern one
- Pattern two

## Anti-Patterns

### General
- Anti-pattern one
- Anti-pattern two
`;
    writeQualityMd(tmpDir, customContent);

    const profile = loadQualityProfile(tmpDir);

    assert.ok(Array.isArray(profile.approvedPatterns.general), 'approvedPatterns.general should be an array');
    assert.ok(Array.isArray(profile.antiPatterns.general), 'antiPatterns.general should be an array');
    assert.deepEqual(profile.approvedPatterns.general, ['Pattern one', 'Pattern two']);
    assert.deepEqual(profile.antiPatterns.general, ['Anti-pattern one', 'Anti-pattern two']);
  });

  it('should preserve raw markdown in profile.raw', () => {
    const customContent = `# Quality Profile

## Approved Patterns

### General
- Keep it simple

## Anti-Patterns

### General
- Over-engineer
`;
    writeQualityMd(tmpDir, customContent);

    const profile = loadQualityProfile(tmpDir);

    assert.equal(profile.raw, customContent, 'raw should equal original file content');
  });

  it('should detect javascript stack and include JS patterns in default', () => {
    // Create a package.json so detectCodebase finds javascript
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }), 'utf-8');

    loadQualityProfile(tmpDir);

    const content = readQualityMd(tmpDir);
    // Should have JS-specific patterns
    assert.ok(
      content.includes('JavaScript') || content.includes('TypeScript'),
      'should include JavaScript or TypeScript section',
    );
    assert.ok(
      content.toLowerCase().includes('const') || content.toLowerCase().includes('strict'),
      'should include JS-specific patterns like const or strict mode',
    );
  });

  it('should generate minimal profile when no stack detected', () => {
    // tmpDir has no manifest files -- pure empty dir with .planning/context/
    loadQualityProfile(tmpDir);

    const profile = loadQualityProfile(tmpDir);

    // Should have at least general key with patterns
    assert.ok(
      profile.approvedPatterns.general && profile.approvedPatterns.general.length > 0,
      'should have general approved patterns even without detected stack',
    );
    assert.ok(
      profile.antiPatterns.general && profile.antiPatterns.general.length > 0,
      'should have general anti-patterns even without detected stack',
    );
  });

  it('should not overwrite existing QUALITY.md on second call', () => {
    const customContent = `# Quality Profile

## Approved Patterns

### General
- My custom pattern

## Anti-Patterns

### General
- My custom anti-pattern
`;
    writeQualityMd(tmpDir, customContent);

    loadQualityProfile(tmpDir);
    loadQualityProfile(tmpDir);

    const contentAfterSecondCall = readQualityMd(tmpDir);
    assert.equal(
      contentAfterSecondCall,
      customContent,
      'QUALITY.md content should not change after second call',
    );
  });
});

// ---------------------------------------------------------------------------
// _parseQualityMd (via loadQualityProfile)
// ---------------------------------------------------------------------------

describe('_parseQualityMd (via loadQualityProfile)', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should handle QUALITY.md with only general sections', () => {
    const content = `# Quality Profile

## Approved Patterns

### General
- Always write tests
- Keep functions small

## Anti-Patterns

### General
- Avoid code duplication
`;
    writeQualityMd(tmpDir, content);

    const profile = loadQualityProfile(tmpDir);

    assert.ok(Array.isArray(profile.approvedPatterns.general));
    assert.ok(Array.isArray(profile.antiPatterns.general));
    assert.ok(profile.approvedPatterns.general.includes('Always write tests'));
    assert.ok(profile.antiPatterns.general.includes('Avoid code duplication'));
  });

  it('should handle QUALITY.md with multiple language sections', () => {
    const content = `# Quality Profile

## Approved Patterns

### General
- General pattern

### JavaScript
- Use const over let

### Python
- Use type hints

## Anti-Patterns

### General
- Avoid magic numbers

### JavaScript
- Avoid var

### Python
- Avoid bare except
`;
    writeQualityMd(tmpDir, content);

    const profile = loadQualityProfile(tmpDir);

    // Both language sections should be parsed into correct keys
    assert.ok(Array.isArray(profile.approvedPatterns.javascript), 'javascript key should exist');
    assert.ok(Array.isArray(profile.approvedPatterns.python), 'python key should exist');
    assert.ok(profile.approvedPatterns.javascript.includes('Use const over let'));
    assert.ok(profile.approvedPatterns.python.includes('Use type hints'));
    assert.ok(Array.isArray(profile.antiPatterns.javascript));
    assert.ok(Array.isArray(profile.antiPatterns.python));
    assert.ok(profile.antiPatterns.javascript.includes('Avoid var'));
    assert.ok(profile.antiPatterns.python.includes('Avoid bare except'));
  });

  it('should handle malformed QUALITY.md gracefully', () => {
    // Missing ## Anti-Patterns section, incorrect heading levels
    const content = `# Quality Profile

Some introductory text with no sections

#### Wrong level heading
- Not a real pattern

## Approved Patterns

### General
- Valid pattern
`;
    writeQualityMd(tmpDir, content);

    // Should not throw
    let profile;
    assert.doesNotThrow(() => {
      profile = loadQualityProfile(tmpDir);
    });

    assert.ok(Array.isArray(profile.approvedPatterns.general));
    assert.ok(profile.approvedPatterns.general.includes('Valid pattern'));
    // antiPatterns should have empty object (graceful degradation)
    assert.deepEqual(profile.antiPatterns, {});
  });

  it('should handle empty QUALITY.md', () => {
    writeQualityMd(tmpDir, '');

    let profile;
    assert.doesNotThrow(() => {
      profile = loadQualityProfile(tmpDir);
    });

    assert.deepEqual(profile.approvedPatterns, {});
    assert.deepEqual(profile.antiPatterns, {});
    assert.equal(profile.raw, '');
  });
});
