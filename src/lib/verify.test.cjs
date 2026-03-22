'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { verifyLight, verifyHeavy, generateVerificationReport, parseCriteriaFromRequirements, generateCriteriaCoverageReport } = require('./verify.cjs');

// Helper: create a temp file with content
function createTempFile(name, content) {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rapid-verify-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return { dir, filePath };
}

// Helper: get a valid commit hash from the current repo
function getValidCommitHash() {
  return execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '../..'), encoding: 'utf-8' }).trim();
}

describe('verifyLight', () => {
  it('existing file produces file_exists in passed', () => {
    const { dir, filePath } = createTempFile('exists.js', 'const x = 1;\n');
    try {
      const results = verifyLight([filePath], []);
      assert.equal(results.passed.length, 1);
      assert.equal(results.passed[0].type, 'file_exists');
      assert.equal(results.passed[0].target, filePath);
      assert.equal(results.failed.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('missing file produces file_missing in failed', () => {
    const results = verifyLight(['/tmp/nonexistent-rapid-verify-test-file.js'], []);
    assert.equal(results.passed.length, 0);
    assert.equal(results.failed.length, 1);
    assert.equal(results.failed[0].type, 'file_missing');
    assert.equal(results.failed[0].target, '/tmp/nonexistent-rapid-verify-test-file.js');
  });

  it('valid git commit hash produces commit_exists in passed', () => {
    const hash = getValidCommitHash();
    const results = verifyLight([], [hash]);
    assert.equal(results.passed.length, 1);
    assert.equal(results.passed[0].type, 'commit_exists');
    assert.equal(results.passed[0].target, hash);
  });

  it('invalid git commit hash produces commit_missing in failed', () => {
    const results = verifyLight([], ['0000000000000000000000000000000000000000']);
    assert.equal(results.failed.length, 1);
    assert.equal(results.failed[0].type, 'commit_missing');
    assert.equal(results.failed[0].target, '0000000000000000000000000000000000000000');
  });
});

describe('verifyHeavy', () => {
  it('passing test command produces tests_pass', () => {
    const results = verifyHeavy([], 'node -e "process.exit(0)"');
    const testResult = results.passed.find(r => r.type === 'tests_pass');
    assert.ok(testResult, 'Expected tests_pass in passed');
    assert.equal(testResult.target, 'node -e "process.exit(0)"');
  });

  it('failing test command produces tests_fail with error', () => {
    const results = verifyHeavy([], 'node -e "process.exit(1)"');
    const testResult = results.failed.find(r => r.type === 'tests_fail');
    assert.ok(testResult, 'Expected tests_fail in failed');
    assert.equal(testResult.target, 'node -e "process.exit(1)"');
  });

  it('stub file (< 50 chars) produces stub_content failure', () => {
    const { dir, filePath } = createTempFile('stub.js', '// stub');
    try {
      const results = verifyHeavy([filePath], null);
      const stubResult = results.failed.find(r => r.type === 'stub_content');
      assert.ok(stubResult, 'Expected stub_content in failed');
      assert.equal(stubResult.target, filePath);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('file with TODO produces stub_content failure', () => {
    const content = 'x'.repeat(60) + '\n// TODO: implement this properly\nmore content here for length';
    const { dir, filePath } = createTempFile('todo.js', content);
    try {
      const results = verifyHeavy([filePath], null);
      const stubResult = results.failed.find(r => r.type === 'stub_content');
      assert.ok(stubResult, 'Expected stub_content in failed for TODO file');
      assert.equal(stubResult.target, filePath);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('file with placeholder produces stub_content failure', () => {
    const content = 'x'.repeat(60) + '\n// placeholder implementation\nmore content for length';
    const { dir, filePath } = createTempFile('placeholder.js', content);
    try {
      const results = verifyHeavy([filePath], null);
      const stubResult = results.failed.find(r => r.type === 'stub_content');
      assert.ok(stubResult, 'Expected stub_content in failed for placeholder file');
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('substantive file passes content check', () => {
    const content = 'const realImplementation = () => {\n  return { value: 42, name: "test" };\n};\nmodule.exports = { realImplementation };\n';
    const { dir, filePath } = createTempFile('real.js', content);
    try {
      const results = verifyHeavy([filePath], null);
      const passResult = results.passed.find(r => r.type === 'content_substantive');
      assert.ok(passResult, 'Expected content_substantive in passed');
      assert.equal(passResult.target, filePath);
      // No stub_content in failed
      const stubResult = results.failed.find(r => r.type === 'stub_content');
      assert.equal(stubResult, undefined);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});

describe('generateVerificationReport', () => {
  it('produces Markdown with frontmatter containing counts', () => {
    const results = {
      passed: [{ type: 'file_exists', target: 'a.js' }],
      failed: [{ type: 'file_missing', target: 'b.js' }],
    };
    const report = generateVerificationReport(results, 'light');
    assert.ok(report.includes('pass_count: 1'));
    assert.ok(report.includes('fail_count: 1'));
    assert.ok(report.includes('tier: light'));
  });

  it('shows PASS result when no failures', () => {
    const results = {
      passed: [{ type: 'file_exists', target: 'a.js' }],
      failed: [],
    };
    const report = generateVerificationReport(results, 'light');
    assert.ok(report.includes('**Result:** PASS'));
  });

  it('shows FAIL result when failures exist', () => {
    const results = {
      passed: [],
      failed: [{ type: 'file_missing', target: 'a.js' }],
    };
    const report = generateVerificationReport(results, 'heavy');
    assert.ok(report.includes('**Result:** FAIL'));
    assert.ok(report.includes('tier: heavy'));
  });

  it('includes error details in failed table rows', () => {
    const results = {
      passed: [],
      failed: [{ type: 'tests_fail', target: 'npm test', error: 'Exit code 1' }],
    };
    const report = generateVerificationReport(results, 'heavy');
    assert.ok(report.includes('Exit code 1'));
  });

  it('appends criteria coverage when requirementsPath option is provided', () => {
    const { dir, filePath } = createTempFile('REQUIREMENTS.md', '- [x] FUNC-001: Login works\n- [ ] FUNC-002: Logout works\n');
    try {
      const results = { passed: [{ type: 'file_exists', target: 'a.js' }], failed: [] };
      const report = generateVerificationReport(results, 'light', { requirementsPath: filePath });
      assert.ok(report.includes('## Criteria Coverage'));
      assert.ok(report.includes('FUNC-001'));
      assert.ok(report.includes('FUNC-002'));
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('produces normal report without options (backward compatible)', () => {
    const results = { passed: [{ type: 'file_exists', target: 'a.js' }], failed: [] };
    const report = generateVerificationReport(results, 'light');
    assert.ok(report.includes('**Result:** PASS'));
    assert.ok(!report.includes('## Criteria Coverage'));
  });
});

describe('parseCriteriaFromRequirements', () => {
  it('parses valid encoded criteria', () => {
    const content = '# Requirements\n\n- [x] FUNC-001: User can log in\n- [ ] FUNC-002: Password reset\n- [x] UIUX-001: Responsive layout\n';
    const { dir, filePath } = createTempFile('REQUIREMENTS.md', content);
    try {
      const result = parseCriteriaFromRequirements(filePath);
      assert.equal(result.criteria.length, 3);
      assert.equal(result.warning, null);
      assert.equal(result.criteria[0].id, 'FUNC-001');
      assert.equal(result.criteria[0].description, 'User can log in');
      assert.equal(result.criteria[0].checked, true);
      assert.equal(result.criteria[1].id, 'FUNC-002');
      assert.equal(result.criteria[2].id, 'UIUX-001');
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('correctly distinguishes checked and unchecked items', () => {
    const content = '- [x] FUNC-001: done thing\n- [ ] FUNC-002: pending thing\n';
    const { dir, filePath } = createTempFile('REQUIREMENTS.md', content);
    try {
      const result = parseCriteriaFromRequirements(filePath);
      assert.equal(result.criteria.length, 2);
      assert.equal(result.criteria[0].checked, true);
      assert.equal(result.criteria[1].checked, false);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('returns warning for old-format freeform file with no encoded IDs', () => {
    const content = 'This is a requirements document with lots of prose about what the system should do. It has no encoded criteria IDs at all.';
    const { dir, filePath } = createTempFile('REQUIREMENTS.md', content);
    try {
      const result = parseCriteriaFromRequirements(filePath);
      assert.equal(result.criteria.length, 0);
      assert.ok(result.warning.includes('No encoded criteria found'));
      assert.ok(result.warning.includes('re-running'));
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('returns warning for missing file', () => {
    const result = parseCriteriaFromRequirements('/tmp/nonexistent-rapid-requirements-test.md');
    assert.equal(result.criteria.length, 0);
    assert.equal(result.warning, 'REQUIREMENTS.md not found');
  });

  it('ignores non-matching lines and parses only encoded criteria', () => {
    const content = '# Requirements\n\nSome freeform text here.\n\n- [x] FUNC-001: Valid criterion\n- This is not a criterion\n- [ ] PERF-001: Another valid one\n\nMore prose.\n';
    const { dir, filePath } = createTempFile('REQUIREMENTS.md', content);
    try {
      const result = parseCriteriaFromRequirements(filePath);
      assert.equal(result.criteria.length, 2);
      assert.equal(result.criteria[0].id, 'FUNC-001');
      assert.equal(result.criteria[1].id, 'PERF-001');
      assert.equal(result.warning, null);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});

describe('generateCriteriaCoverageReport', () => {
  it('shows full coverage when all criteria are in plan files', () => {
    const reqContent = '- [x] FUNC-001: Login\n- [ ] FUNC-002: Logout\n';
    const planContent = 'This plan covers FUNC-001 and FUNC-002 implementation.';
    const { dir: reqDir, filePath: reqPath } = createTempFile('REQUIREMENTS.md', reqContent);
    const { dir: planDir, filePath: planPath } = createTempFile('wave-1-PLAN.md', planContent);
    try {
      const report = generateCriteriaCoverageReport(reqPath, [planPath]);
      assert.ok(report.includes('2/2 (100%)'));
      assert.ok(!report.includes('### Uncovered Criteria'));
    } finally {
      fs.rmSync(reqDir, { recursive: true });
      fs.rmSync(planDir, { recursive: true });
    }
  });

  it('shows partial coverage with uncovered criteria section', () => {
    const reqContent = '- [x] FUNC-001: Login\n- [ ] FUNC-002: Logout\n';
    const planContent = 'This plan covers FUNC-001 only.';
    const { dir: reqDir, filePath: reqPath } = createTempFile('REQUIREMENTS.md', reqContent);
    const { dir: planDir, filePath: planPath } = createTempFile('wave-1-PLAN.md', planContent);
    try {
      const report = generateCriteriaCoverageReport(reqPath, [planPath]);
      assert.ok(report.includes('1/2 (50%)'));
      assert.ok(report.includes('### Uncovered Criteria'));
      assert.ok(report.includes('FUNC-002: Logout'));
    } finally {
      fs.rmSync(reqDir, { recursive: true });
      fs.rmSync(planDir, { recursive: true });
    }
  });

  it('marks all criteria uncovered when no plan files provided', () => {
    const reqContent = '- [x] FUNC-001: Login\n- [ ] FUNC-002: Logout\n';
    const { dir, filePath: reqPath } = createTempFile('REQUIREMENTS.md', reqContent);
    try {
      const report = generateCriteriaCoverageReport(reqPath, []);
      assert.ok(report.includes('0/2 (0%)'));
      assert.ok(report.includes('### Uncovered Criteria'));
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('returns warning section for freeform requirements without encoded criteria', () => {
    const content = 'This is a freeform requirements document without any encoded IDs. It has lots of text but no CATEGORY-NNN patterns.';
    const { dir, filePath: reqPath } = createTempFile('REQUIREMENTS.md', content);
    try {
      const report = generateCriteriaCoverageReport(reqPath, []);
      assert.ok(report.includes('## Criteria Coverage'));
      assert.ok(report.includes('No encoded criteria found'));
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('returns warning section for missing REQUIREMENTS.md', () => {
    const report = generateCriteriaCoverageReport('/tmp/nonexistent-rapid-req.md', []);
    assert.ok(report.includes('## Criteria Coverage'));
    assert.ok(report.includes('REQUIREMENTS.md not found'));
  });
});
