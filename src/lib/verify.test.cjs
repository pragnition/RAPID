'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { verifyLight, verifyHeavy, generateVerificationReport } = require('./verify.cjs');

// Helper: create a temp file with content
function createTempFile(name, content) {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rapid-verify-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return { dir, filePath };
}

// Helper: get a valid commit hash from the current repo
function getValidCommitHash() {
  return execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '../../..'), encoding: 'utf-8' }).trim();
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
});
