'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadQualityProfile, buildQualityContext, checkQualityGates, DEFAULT_TOKEN_BUDGET } = require('./quality.cjs');
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

// ---------------------------------------------------------------------------
// _generateDefaultQualityMd (tested via loadQualityProfile + generated file)
// ---------------------------------------------------------------------------

describe('_generateDefaultQualityMd (via loadQualityProfile)', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-gen-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('includes TypeScript-specific patterns when TS detected', () => {
    // tsconfig.json triggers 'typescript' language detection
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### TypeScript'), 'should have TypeScript subsection heading');
    assert.ok(content.includes('type annotations'), 'should mention type annotations');
    assert.ok(content.includes('`any`'), 'should mention avoiding any type');
  });

  it('includes Python patterns when Python detected', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==2.0\n', 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### Python'), 'should have Python subsection heading');
    assert.ok(content.includes('type hints'), 'should mention type hints');
    assert.ok(content.includes('PEP 8'), 'should mention PEP 8');
  });

  it('includes Go patterns when Go detected', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test\n\ngo 1.21\n', 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### Go'), 'should have Go subsection heading');
    assert.ok(content.includes('context.Context'), 'should mention context.Context');
    assert.ok(content.includes('%w'), 'should mention error wrapping with %w');
  });

  it('includes Rust patterns when Rust detected', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "test"\nversion = "0.1.0"\n', 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### Rust'), 'should have Rust subsection heading');
    assert.ok(content.includes('Result'), 'should mention Result type');
    assert.ok(content.includes('Derive') || content.includes('derive'), 'should mention derive traits');
  });

  it('includes React framework patterns', () => {
    const pkg = { name: 'test', dependencies: { react: '^18.0.0' } };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg), 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### React'), 'should have React subsection heading');
    assert.ok(content.includes('hooks') || content.includes('functional components'), 'should mention React patterns');
  });

  it('includes Express framework patterns', () => {
    const pkg = { name: 'test', dependencies: { express: '^4.0.0' } };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg), 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### Express'), 'should have Express subsection heading');
    assert.ok(content.includes('middleware'), 'should mention middleware');
    assert.ok(content.includes('HTTP status codes'), 'should mention HTTP status codes');
  });

  it('includes Django framework patterns', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'django==4.2\n', 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### Django'), 'should have Django subsection heading');
    assert.ok(content.includes('ORM') || content.includes('service layer'), 'should mention Django patterns');
  });
});

// ---------------------------------------------------------------------------
// _generateDefaultPatternsMd (tested via loadQualityProfile + PATTERNS.md)
// ---------------------------------------------------------------------------

describe('_generateDefaultPatternsMd (via loadQualityProfile)', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-patterns-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  function readPatterns() {
    return fs.readFileSync(path.join(tmpDir, '.planning', 'context', 'PATTERNS.md'), 'utf-8');
  }

  it('content matches stack for JS', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8');
    loadQualityProfile(tmpDir);
    const content = readPatterns();
    assert.ok(content.includes('# Pattern Library'), 'should have Pattern Library heading');
    assert.ok(content.includes('async/await') || content.includes('try/catch'), 'should include JS error handling patterns');
    assert.ok(content.includes('node:test') || content.includes('assert/strict'), 'should include JS testing patterns');
  });

  it('content matches stack for Python', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'requests==2.31\n', 'utf-8');
    loadQualityProfile(tmpDir);
    const content = readPatterns();
    assert.ok(content.includes('# Pattern Library'), 'should have Pattern Library heading');
    assert.ok(content.includes('except') || content.includes('exception'), 'should include Python error handling patterns');
    assert.ok(content.includes('pytest') || content.includes('fixtures'), 'should include Python testing patterns');
  });

  it('content matches stack for Go', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test\n\ngo 1.21\n', 'utf-8');
    loadQualityProfile(tmpDir);
    const content = readPatterns();
    assert.ok(content.includes('# Pattern Library'), 'should have Pattern Library heading');
    assert.ok(content.includes('fmt.Errorf') || content.includes('%w'), 'should include Go error wrapping patterns');
    assert.ok(content.includes('table-driven') || content.includes('t.Run'), 'should include Go testing patterns');
  });

  it('falls back to generic patterns for unknown stack', () => {
    // No manifest files -- no language detected
    loadQualityProfile(tmpDir);
    const content = readPatterns();
    assert.ok(content.includes('# Pattern Library'), 'should have Pattern Library heading');
    assert.ok(content.includes('## Error Handling'), 'should include Error Handling section');
    assert.ok(content.includes('## Testing'), 'should include Testing section');
    // Verify it does NOT contain language-specific patterns
    assert.ok(!content.includes('async/await'), 'should not contain JS-specific patterns');
    assert.ok(!content.includes('pytest'), 'should not contain Python-specific patterns');
    assert.ok(!content.includes('fmt.Errorf'), 'should not contain Go-specific patterns');
  });
});

// ---------------------------------------------------------------------------
// _parseQualityMd edge cases (tested via loadQualityProfile)
// ---------------------------------------------------------------------------

describe('_parseQualityMd edge cases (via loadQualityProfile)', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-parse-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('handles "antipatterns" heading variant (no hyphen)', () => {
    const content = `# Quality Profile

## Approved Patterns

### General
- Approved pattern one

## AntiPatterns

### General
- Anti no-hyphen pattern
`;
    writeQualityMd(tmpDir, content);
    const profile = loadQualityProfile(tmpDir);
    assert.ok(Array.isArray(profile.antiPatterns.general), 'antiPatterns.general should exist');
    assert.ok(
      profile.antiPatterns.general.includes('Anti no-hyphen pattern'),
      'should parse anti-pattern under "AntiPatterns" heading',
    );
  });

  it('ignores bullet points outside known subsections', () => {
    const content = `# Quality Profile

- Stray bullet outside any section

## Approved Patterns

- Another stray bullet outside subsection

### General
- Legit approved pattern

## Anti-Patterns

- Stray bullet outside subsection in anti

### General
- Legit anti-pattern
`;
    writeQualityMd(tmpDir, content);
    const profile = loadQualityProfile(tmpDir);
    // The "stray" bullets should NOT appear in the profile
    assert.deepEqual(profile.approvedPatterns.general, ['Legit approved pattern']);
    assert.deepEqual(profile.antiPatterns.general, ['Legit anti-pattern']);
  });

  it('handles whitespace-only content', () => {
    writeQualityMd(tmpDir, '   \n\n   \n  \n');
    const profile = loadQualityProfile(tmpDir);
    assert.deepEqual(profile.approvedPatterns, {}, 'approvedPatterns should be empty');
    assert.deepEqual(profile.antiPatterns, {}, 'antiPatterns should be empty');
  });
});

// ---------------------------------------------------------------------------
// buildQualityContext edge cases
// ---------------------------------------------------------------------------

describe('buildQualityContext edge cases', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-ctx-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns empty string when profile is completely blank', () => {
    // Write empty QUALITY.md and empty PATTERNS.md, no memory decisions
    writeQualityMd(tmpDir, '');
    writePatternsMd(tmpDir, '');
    const result = buildQualityContext(tmpDir, 'test-set');
    assert.equal(result, '', 'should return empty string when all content is blank');
  });

  it('handles zero token budget by truncating immediately', () => {
    // Write some content so there IS something to truncate
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- A pattern
`);
    let result;
    assert.doesNotThrow(() => {
      result = buildQualityContext(tmpDir, 'test-set', 0);
    }, 'should not throw with zero token budget');
    assert.ok(typeof result === 'string', 'should return a string');
  });
});

// ---------------------------------------------------------------------------
// checkQualityGates edge cases
// ---------------------------------------------------------------------------

describe('checkQualityGates edge cases', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-gates-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('handles null artifacts array', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### General
- eval()
`);
    let result;
    assert.doesNotThrow(() => {
      result = checkQualityGates(tmpDir, 'test-set', null);
    }, 'should not throw with null artifacts');
    assert.equal(result.passed, true, 'should pass with null artifacts');
  });

  it('handles empty artifacts array', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### General
- eval()
`);
    const result = checkQualityGates(tmpDir, 'test-set', []);
    assert.equal(result.passed, true, 'should pass with empty artifacts array');
    assert.equal(result.violations.length, 0, 'should have no violations with empty artifacts');
  });

  it('performs case-insensitive pattern matching', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write safe code

## Anti-Patterns

### General
- eval()
`);
    // Write file with uppercase "EVAL()" -- should still match the lowercase "eval()" pattern
    const artifactPath = path.join(os.tmpdir(), `rapid-qg-ci-${Date.now()}.js`);
    fs.writeFileSync(artifactPath, 'const result = EVAL();\n', 'utf-8');
    try {
      const result = checkQualityGates(tmpDir, 'test-set', [artifactPath]);
      assert.equal(result.passed, false, 'should fail -- case-insensitive match should detect EVAL()');
      assert.ok(result.violations.length >= 1, 'should have at least one violation');
    } finally {
      fs.rmSync(artifactPath, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// _formatDecisionsSection (tested via buildQualityContext with memory)
// ---------------------------------------------------------------------------

describe('_formatDecisionsSection (via buildQualityContext)', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = makeTmpDirWithMemory();
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns empty string for null input (no decisions)', () => {
    // No decisions written -- _tryQueryDecisions returns []
    // _formatDecisionsSection([]) returns ''
    // So "Convention Decisions" section should not appear
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- A pattern
`);
    const result = buildQualityContext(tmpDir, 'test-set');
    assert.ok(!result.includes('### Convention Decisions'), 'should not include Convention Decisions when no decisions exist');
  });

  it('formats entries without topic field correctly', () => {
    // Append a decision WITHOUT the topic field
    appendDecision(tmpDir, {
      category: 'convention',
      decision: 'Use tabs for indentation',
      rationale: 'team preference',
      source: 'user',
      // no topic field
    });

    const result = buildQualityContext(tmpDir, 'test-set');
    assert.ok(result.includes('### Convention Decisions'), 'should include Convention Decisions section');
    assert.ok(result.includes('Use tabs for indentation'), 'should include the decision text');
    // Should format as "[convention]" (no topic) and NOT contain "/undefined"
    assert.ok(!result.includes('/undefined'), 'should not contain /undefined in formatted output');
    assert.ok(result.includes('[convention]'), 'should format as [convention] without topic');
  });
});

// ---------------------------------------------------------------------------
// Wave 3: 18 additional tests for quality-system coverage
// ---------------------------------------------------------------------------

describe('_truncateToTokenBudget (via buildQualityContext)', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-trunc-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('content exactly at budget boundary is not truncated', () => {
    // Write a small QUALITY.md, then set budget to exactly match the assembled output
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Small pattern

## Anti-Patterns

### General
- Small anti
`);
    writePatternsMd(tmpDir, '');
    // First, build with a huge budget to see total token count
    const fullResult = buildQualityContext(tmpDir, 'test-set', 999999);
    const exactBudget = estimateTokens(fullResult);
    // Now build with that exact budget -- should not truncate
    const result = buildQualityContext(tmpDir, 'test-set', exactBudget);
    assert.ok(!result.includes('[...truncated to fit token budget]'),
      'content at exact budget boundary should not be truncated');
    assert.equal(result, fullResult, 'result should be identical to full result');
  });

  it('single very long line with no newlines', () => {
    // Create a QUALITY.md with one extremely long line (no newlines in the pattern)
    const longLine = '- ' + 'x'.repeat(20000);
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
${longLine}

## Anti-Patterns

### General
- Anti
`);
    writePatternsMd(tmpDir, '');
    // Use a small budget that forces truncation
    const result = buildQualityContext(tmpDir, 'test-set', 100);
    assert.ok(result.includes('[...truncated to fit token budget]'),
      'should contain truncation marker when single long line exceeds budget');
  });

  it('budget smaller than truncation marker', () => {
    // Budget of 1 token -- the truncation marker itself is ~10 tokens
    // effectiveBudget goes negative, no lines accumulate, no throw
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Some pattern to force content

## Anti-Patterns

### General
- Some anti-pattern
`);
    writePatternsMd(tmpDir, '');
    let result;
    assert.doesNotThrow(() => {
      result = buildQualityContext(tmpDir, 'test-set', 1);
    }, 'should not throw with budget smaller than truncation marker');
    assert.ok(typeof result === 'string', 'should return a string');
    // With negative effective budget, no lines accumulate, only truncation marker
    assert.ok(result.includes('[...truncated to fit token budget]'),
      'should contain truncation marker');
  });
});

describe('_checkFileAgainstPatterns (via checkQualityGates)', () => {
  let tmpDir;
  let tmpFiles = [];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-chk-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
    tmpFiles = [];
  });
  afterEach(() => {
    for (const f of tmpFiles) {
      try { fs.rmSync(f, { force: true }); } catch (_e) { /* ignore */ }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeTempFile(content, suffix = '.js') {
    const p = path.join(os.tmpdir(), `rapid-qg-chk-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
    fs.writeFileSync(p, content, 'utf-8');
    tmpFiles.push(p);
    return p;
  }

  it('skips non-array values in antiPatterns', () => {
    // The parser always produces arrays for subsections, but if a subsection heading
    // exists with no bullet points, the key maps to an empty array.
    // We can verify the function handles this gracefully by writing a QUALITY.md
    // where an anti-pattern subsection has no bullets -- the key will be an empty array.
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### EmptyCategory

### General
- eval()
`);
    const artifactPath = makeTempFile('const x = eval();\n');
    let result;
    assert.doesNotThrow(() => {
      result = checkQualityGates(tmpDir, 'test-set', [artifactPath]);
    }, 'should not throw when antiPatterns has empty-array category');
    // Should still detect eval() from the General category
    assert.equal(result.passed, false, 'should still detect violation from non-empty category');
  });

  it('reports violations from multiple categories in same file', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### Security
- eval()

### Style
- var declarations
`);
    // File contains both anti-patterns
    const artifactPath = makeTempFile('var x = eval();\nvar declarations are bad;\n');
    const result = checkQualityGates(tmpDir, 'test-set', [artifactPath]);
    assert.equal(result.passed, false, 'should fail when violations from multiple categories');
    assert.ok(result.violations.length >= 2,
      `should have violations from both categories, got ${result.violations.length}`);
    // Verify both rules are represented
    const rules = result.violations.map(v => v.rule);
    assert.ok(rules.includes('eval()'), 'should include eval() violation');
    assert.ok(rules.includes('var declarations'), 'should include var declarations violation');
  });
});

describe('loadQualityProfile additional coverage', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-lqp-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('generates PATTERNS.md when QUALITY.md exists but PATTERNS.md does not', () => {
    // Write QUALITY.md manually (so it won't be generated)
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Custom pattern

## Anti-Patterns

### General
- Custom anti
`);
    // Verify PATTERNS.md does not exist yet
    assert.ok(!patternsMdExists(tmpDir), 'PATTERNS.md should not exist before call');

    loadQualityProfile(tmpDir);

    assert.ok(patternsMdExists(tmpDir), 'PATTERNS.md should be created when QUALITY.md exists');
    const patternsContent = fs.readFileSync(
      path.join(tmpDir, '.planning', 'context', 'PATTERNS.md'), 'utf-8');
    assert.ok(patternsContent.includes('# Pattern Library'),
      'generated PATTERNS.md should contain Pattern Library heading');
  });

  it('does not regenerate either file when both exist', () => {
    const qualityContent = `# Quality Profile

## Approved Patterns

### General
- Existing quality pattern
`;
    const patternsContent = '# Pattern Library\n\n## Custom Section\nExisting patterns content.\n';

    writeQualityMd(tmpDir, qualityContent);
    writePatternsMd(tmpDir, patternsContent);

    const qualityMtime = fs.statSync(
      path.join(tmpDir, '.planning', 'context', 'QUALITY.md')).mtimeMs;
    const patternsMtime = fs.statSync(
      path.join(tmpDir, '.planning', 'context', 'PATTERNS.md')).mtimeMs;

    loadQualityProfile(tmpDir);

    const qualityAfter = fs.readFileSync(
      path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    const patternsAfter = fs.readFileSync(
      path.join(tmpDir, '.planning', 'context', 'PATTERNS.md'), 'utf-8');

    assert.equal(qualityAfter, qualityContent, 'QUALITY.md content should not change');
    assert.equal(patternsAfter, patternsContent, 'PATTERNS.md content should not change');
  });
});

describe('_generateDefaultQualityMd framework coverage (via loadQualityProfile)', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-fw-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('includes Fastify framework patterns', () => {
    const pkg = { name: 'test', dependencies: { fastify: '^4.0.0' } };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg), 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### Fastify'), 'should have Fastify subsection heading');
    assert.ok(content.includes('middleware') || content.includes('Validate'),
      'should mention middleware or validation for Fastify');
  });

  it('includes Flask framework patterns', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==2.3.0\n', 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### Flask'), 'should have Flask subsection heading');
    assert.ok(content.includes('service layer') || content.includes('views') || content.includes('ORM'),
      'should mention Flask-related patterns');
  });

  it('handles multiple frameworks simultaneously', () => {
    const pkg = { name: 'test', dependencies: { react: '^18.0.0', express: '^4.0.0' } };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg), 'utf-8');
    loadQualityProfile(tmpDir);
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'context', 'QUALITY.md'), 'utf-8');
    assert.ok(content.includes('### React'), 'should have React subsection heading');
    assert.ok(content.includes('### Express'), 'should have Express subsection heading');
  });
});

describe('checkQualityGates additional coverage', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-gates2-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('handles undefined artifacts parameter', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### General
- eval()
`);
    let result;
    assert.doesNotThrow(() => {
      result = checkQualityGates(tmpDir, 'test-set', undefined);
    }, 'should not throw with undefined artifacts');
    assert.equal(result.passed, true, 'should return passed: true with undefined artifacts');
    assert.deepEqual(result.violations, [], 'should have empty violations array');
  });

  it('outer try/catch returns passed:true on profile load failure', () => {
    // Pass a path that does not exist and cannot be created (e.g., /dev/null/invalid)
    // The outer try/catch in checkQualityGates should catch and return passed: true
    let result;
    assert.doesNotThrow(() => {
      result = checkQualityGates('/dev/null/invalid/path', 'test-set', []);
    }, 'should not throw on profile load failure');
    assert.equal(result.passed, true, 'should return passed: true on profile load failure');
    assert.deepEqual(result.violations, [], 'should return empty violations on profile load failure');
  });
});

describe('buildQualityContext additional coverage', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-bqc2-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('includes content when only PATTERNS.md has content', () => {
    // Write empty QUALITY.md but non-empty PATTERNS.md
    writeQualityMd(tmpDir, '');
    writePatternsMd(tmpDir, '# Pattern Library\n\n## Error Handling\n### Approved\n- Always handle errors\n');
    const result = buildQualityContext(tmpDir, 'test-set');
    assert.ok(result.includes('### Pattern Library'),
      'should include Pattern Library section when only PATTERNS.md has content');
    assert.ok(result.includes('Always handle errors'),
      'should include PATTERNS.md content in output');
  });

  it('setName parameter does not appear in output', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write clean code

## Anti-Patterns

### General
- Avoid bad code
`);
    const uniqueSetName = 'UNIQUE_SET_NAME_THAT_SHOULD_NOT_APPEAR_12345';
    const result = buildQualityContext(tmpDir, uniqueSetName);
    assert.ok(!result.includes(uniqueSetName),
      'setName should not be embedded in the output string');
  });
});

describe('_formatDecisionsSection additional coverage (via buildQualityContext)', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = makeTmpDirWithMemory();
  });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('formats multiple decisions as separate bullets', () => {
    appendDecision(tmpDir, {
      category: 'convention',
      decision: 'Use semicolons always',
      rationale: 'clarity',
      source: 'user',
      topic: 'formatting',
    });
    appendDecision(tmpDir, {
      category: 'convention',
      decision: 'Prefer named exports',
      rationale: 'discoverability',
      source: 'user',
      topic: 'modules',
    });

    const result = buildQualityContext(tmpDir, 'test-set');
    assert.ok(result.includes('Use semicolons always'), 'should include first decision');
    assert.ok(result.includes('Prefer named exports'), 'should include second decision');
    // Each should be a separate bullet
    const lines = result.split('\n');
    const bulletLines = lines.filter(l => l.startsWith('- [convention/'));
    assert.ok(bulletLines.length >= 2,
      `should have at least 2 bullet lines with [convention/ tag, got ${bulletLines.length}`);
  });

  it('includes category/topic tag when topic is present', () => {
    appendDecision(tmpDir, {
      category: 'convention',
      decision: 'Use strict mode',
      rationale: 'safety',
      source: 'user',
      topic: 'javascript',
    });

    const result = buildQualityContext(tmpDir, 'test-set');
    assert.ok(result.includes('[convention/javascript]'),
      'should include [category/topic] format in output');
  });
});

describe('DEFAULT_TOKEN_BUDGET export', () => {
  it('equals 10000', () => {
    assert.equal(DEFAULT_TOKEN_BUDGET, 10000,
      'DEFAULT_TOKEN_BUDGET should be exported and equal 10000');
  });
});

describe('_logViolationsToStderr (via checkQualityGates)', () => {
  let tmpDir;
  let tmpFiles = [];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-quality-log-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'context'), { recursive: true });
    tmpFiles = [];
  });
  afterEach(() => {
    for (const f of tmpFiles) {
      try { fs.rmSync(f, { force: true }); } catch (_e) { /* ignore */ }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeTempFile(content, suffix = '.js') {
    const p = path.join(os.tmpdir(), `rapid-qg-log-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`);
    fs.writeFileSync(p, content, 'utf-8');
    tmpFiles.push(p);
    return p;
  }

  it('writes violation messages to stderr', () => {
    writeQualityMd(tmpDir, `# Quality Profile

## Approved Patterns

### General
- Write safe code

## Anti-Patterns

### General
- eval()
`);
    const artifactPath = makeTempFile('const x = eval();\n');

    // Intercept stderr to capture output
    const stderrChunks = [];
    const originalWrite = process.stderr.write;
    process.stderr.write = function(chunk) {
      stderrChunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    };

    try {
      checkQualityGates(tmpDir, 'test-set', [artifactPath]);
    } finally {
      process.stderr.write = originalWrite;
    }

    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[RAPID QUALITY]'),
      'stderr should contain [RAPID QUALITY] prefix');
    assert.ok(stderrOutput.includes('warning'),
      'stderr should contain severity "warning"');
    assert.ok(stderrOutput.includes('eval()'),
      'stderr should mention the anti-pattern');
    // Should include file path and line number in "file:line" format
    assert.ok(stderrOutput.includes(':1'),
      'stderr should include line number in file:line format');
  });
});
