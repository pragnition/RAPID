'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadQualityProfile, buildQualityContext, checkQualityGates } = require('./quality.cjs');
const { estimateTokens } = require('./tool-docs.cjs');
const { appendDecision } = require('./memory.cjs');

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

// ---------------------------------------------------------------------------
// Helpers for wave 2 tests
// ---------------------------------------------------------------------------

function writePatternsMd(tmpDir, content) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'context', 'PATTERNS.md'), content, 'utf-8');
}

function makeTmpDirWithMemory() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-w2-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.planning', 'memory'), { recursive: true });
  return tmpDir;
}

// ---------------------------------------------------------------------------
// buildQualityContext
// ---------------------------------------------------------------------------

describe('buildQualityContext', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should return a string containing Quality Context header', () => {
    const result = buildQualityContext(tmpDir, 'test-set');
    assert.ok(typeof result === 'string', 'result should be a string');
    assert.ok(result.includes('## Quality Context'), 'result should contain ## Quality Context');
  });

  it('should include quality guidelines from QUALITY.md', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Always use error boundaries

## Anti-Patterns

### General
- Avoid uncaught errors
`);
    const result = buildQualityContext(tmpDir, 'test-set');
    assert.ok(result.includes('Always use error boundaries'), 'result should include custom QUALITY.md content');
  });

  it('should include pattern library from PATTERNS.md', () => {
    // First call loadQualityProfile to ensure QUALITY.md is generated (no custom one here)
    // Then overwrite PATTERNS.md with custom content
    loadQualityProfile(tmpDir);
    writePatternsMd(tmpDir, '# Pattern Library\n\n## Custom Pattern\nThis is a custom pattern entry.\n');
    const result = buildQualityContext(tmpDir, 'test-set');
    assert.ok(result.includes('### Pattern Library'), 'result should contain ### Pattern Library');
    assert.ok(result.includes('This is a custom pattern entry.'), 'result should contain custom PATTERNS.md content');
  });

  it('should respect token budget and truncate when exceeded', () => {
    // Write a very large QUALITY.md (>40000 chars to exceed 10000 tokens at 4 chars/token)
    const repeatedLine = '- This is a repeated quality guideline to inflate the content size for testing.\n';
    const largeContent = `# Quality Profile\n\n## Approved Patterns\n\n### General\n` +
      repeatedLine.repeat(1500); // ~67500 chars >> 10000 tokens
    writeQualityMd(tmpDir, largeContent);

    const budget = 1000;
    const result = buildQualityContext(tmpDir, 'test-set', budget);

    assert.ok(result.includes('[...truncated to fit token budget]'), 'result should contain truncation marker');
    // Allow some slack for the marker itself (~15 tokens)
    assert.ok(estimateTokens(result) <= budget + 15, `token count should be within budget+slack, got ${estimateTokens(result)}`);
  });

  it('should use default token budget of 10000 when not specified', () => {
    // Write content that's definitely under 10000 tokens (under 40000 chars)
    const normalContent = `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### General
- Avoid global state
`;
    writeQualityMd(tmpDir, normalContent);
    const result = buildQualityContext(tmpDir, 'test-set');
    assert.ok(!result.includes('[...truncated to fit token budget]'), 'result should not be truncated with default budget');
  });

  it('should include default generated content when no QUALITY.md exists', () => {
    // No QUALITY.md written -- loadQualityProfile will generate defaults
    const result = buildQualityContext(tmpDir, 'test-set');
    // Default content should be included (not empty string) since loadQualityProfile generates defaults
    assert.ok(result.length > 0, 'result should not be empty since defaults are generated');
    assert.ok(result.includes('## Quality Context'), 'result should contain Quality Context header');
  });

  it('should gracefully handle missing memory-system (queryDecisions)', () => {
    // tmpDir has no .planning/memory/ directory -- queryDecisions returns []
    // This should not throw and should simply omit the Convention Decisions section
    let result;
    assert.doesNotThrow(() => {
      result = buildQualityContext(tmpDir, 'test-set');
    });
    assert.ok(typeof result === 'string', 'result should be a string');
    // Should not include Convention Decisions section when there are no decisions
    assert.ok(!result.includes('### Convention Decisions'), 'result should not include empty Convention Decisions section');
  });

  it('should include convention decisions when available', () => {
    const tmpDirWithMemory = makeTmpDirWithMemory();
    try {
      // Write a convention-category decision using memory.cjs
      appendDecision(tmpDirWithMemory, {
        category: 'convention',
        decision: 'Always use single quotes for string literals',
        rationale: 'consistency across codebase',
        source: 'user',
        topic: 'formatting',
      });

      const result = buildQualityContext(tmpDirWithMemory, 'test-set');
      assert.ok(result.includes('Always use single quotes for string literals'), 'result should include decision text');
      assert.ok(result.includes('### Convention Decisions'), 'result should include Convention Decisions section');
    } finally {
      fs.rmSync(tmpDirWithMemory, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// checkQualityGates
// ---------------------------------------------------------------------------

describe('checkQualityGates', () => {
  let tmpDir;
  let tmpFiles = [];

  beforeEach(() => {
    tmpDir = makeTmpDir();
    tmpFiles = [];
  });

  afterEach(() => {
    for (const f of tmpFiles) {
      try { fs.rmSync(f, { force: true }); } catch (_e) { /* ignore */ }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeTempFile(content, suffix = '.js') {
    const p = path.join(os.tmpdir(), `rapid-qg-test-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
    fs.writeFileSync(p, content, 'utf-8');
    tmpFiles.push(p);
    return p;
  }

  it('should return passed: true when no anti-patterns defined', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code
- Use meaningful names
`);
    // No ## Anti-Patterns section
    const artifactPath = makeTempFile('const x = 1;\n');
    const result = checkQualityGates(tmpDir, 'test-set', [artifactPath]);
    assert.equal(result.passed, true, 'should pass when no anti-patterns defined');
    assert.equal(result.violations.length, 0, 'should have no violations');
  });

  it('should detect anti-pattern violation in artifact file', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Use safe evaluation strategies

## Anti-Patterns

### General
- eval()
`);
    // Artifact must contain the exact pattern string "eval()" for simple string matching
    const artifactPath = makeTempFile('const result = eval();\n');
    const result = checkQualityGates(tmpDir, 'test-set', [artifactPath]);
    assert.equal(result.passed, false, 'should fail when anti-pattern found');
    assert.ok(result.violations.length >= 1, 'should have at least one violation');

    const v = result.violations[0];
    assert.ok('rule' in v, 'violation should have rule field');
    assert.ok('file' in v, 'violation should have file field');
    assert.ok('severity' in v, 'violation should have severity field');
    assert.ok('message' in v, 'violation should have message field');
    assert.ok('confidence' in v, 'violation should have confidence field');
  });

  it('should return passed: true when artifacts do not contain anti-patterns', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Use safe evaluation strategies

## Anti-Patterns

### General
- eval()
`);
    // safeEvaluate does not contain the exact string "eval()"
    const artifactPath = makeTempFile('const x = safeEvaluate(input);\n');
    const result = checkQualityGates(tmpDir, 'test-set', [artifactPath]);
    assert.equal(result.passed, true, 'should pass when artifact does not contain anti-pattern');
    assert.equal(result.violations.length, 0, 'should have no violations');
  });

  it('should skip non-existent artifact files without error', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### General
- eval()
`);
    const nonExistentPath = path.join(os.tmpdir(), 'does-not-exist-rapid-test-12345.js');
    let result;
    assert.doesNotThrow(() => {
      result = checkQualityGates(tmpDir, 'test-set', [nonExistentPath]);
    });
    assert.equal(result.passed, true, 'should pass when artifact does not exist');
  });

  it('should include line number in violation when detectable', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Use safe code

## Anti-Patterns

### General
- eval()
`);
    // Put exact pattern "eval()" on line 3 (simple string matching requires exact match)
    const content = 'const a = 1;\nconst b = 2;\nconst c = eval();\nconst d = 4;\n';
    const artifactPath = makeTempFile(content);
    const result = checkQualityGates(tmpDir, 'test-set', [artifactPath]);
    assert.equal(result.passed, false, 'should detect violation');
    assert.ok(result.violations.length >= 1, 'should have at least one violation');
    assert.equal(result.violations[0].line, 3, 'violation line should be 3 (1-based)');
  });

  it('should handle multiple anti-patterns across multiple files', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### General
- eval()
- global mutable state
`);
    // Use exact pattern strings for simple string matching
    const file1 = makeTempFile('const x = eval();\n');
    const file2 = makeTempFile('// global mutable state is used here\n');
    const result = checkQualityGates(tmpDir, 'test-set', [file1, file2]);
    assert.equal(result.passed, false, 'should fail when violations found in multiple files');
    assert.ok(result.violations.length >= 2, 'should collect violations from all files');
  });

  it('should never throw even on read errors', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### General
- eval()
`);
    // Pass a directory path (not a file) as an artifact
    let result;
    assert.doesNotThrow(() => {
      result = checkQualityGates(tmpDir, 'test-set', [os.tmpdir()]);
    });
    // Directories are skipped, so result should pass
    assert.equal(result.passed, true, 'should pass when artifact is a directory (skipped)');
  });

  it('should set severity to warning for all violations', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write safe code

## Anti-Patterns

### General
- eval()
- var declarations
`);
    // Use exact pattern strings so simple string matching finds them
    const content = 'var x = eval();\nvar declarations are here;\n';
    const artifactPath = makeTempFile(content);
    const result = checkQualityGates(tmpDir, 'test-set', [artifactPath]);
    assert.ok(result.violations.length > 0, 'should have violations');
    for (const v of result.violations) {
      assert.equal(v.severity, 'warning', `all violations should have severity 'warning', got '${v.severity}'`);
    }
  });

  it('violations are advisory only -- function does not modify files', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write safe code

## Anti-Patterns

### General
- eval()
`);
    // Use exact pattern string so violation IS detected
    const content = 'const x = eval();\n';
    const artifactPath = makeTempFile(content);

    const statBefore = fs.statSync(artifactPath);
    const contentBefore = fs.readFileSync(artifactPath, 'utf-8');

    checkQualityGates(tmpDir, 'test-set', [artifactPath]);

    const statAfter = fs.statSync(artifactPath);
    const contentAfter = fs.readFileSync(artifactPath, 'utf-8');

    assert.equal(contentAfter, contentBefore, 'file content should be unchanged after checkQualityGates');
    assert.equal(statAfter.mtimeMs, statBefore.mtimeMs, 'file mtime should be unchanged after checkQualityGates');
  });
});
