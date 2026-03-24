'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const merge = require('../src/lib/merge.cjs');

// Helper: create a temporary git repo and return its path
function createTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-regression-test-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'pipe' });
  return dir;
}

// Helper: remove temp directory
function removeTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

describe('snapshotExports - extension filtering', () => {
  it('should skip non-code files', () => {
    // Use the current repo at HEAD
    const snapshot = merge.snapshotExports('.', 'HEAD', [
      'README.md',
      'package.json',
      '.gitignore',
      'CLAUDE.md',
    ]);
    assert.equal(snapshot.size, 0, 'non-code files should be skipped');
  });

  it('should include .js files', () => {
    const snapshot = merge.snapshotExports('.', 'HEAD', ['src/lib/core.cjs']);
    assert.equal(snapshot.size, 1, 'should include .cjs file');
    assert.ok(snapshot.has('src/lib/core.cjs'));
  });

  it('should handle mixed file lists', () => {
    const snapshot = merge.snapshotExports('.', 'HEAD', [
      'README.md',
      'src/lib/core.cjs',
      'package.json',
    ]);
    assert.equal(snapshot.size, 1, 'should include only the code file');
    assert.ok(snapshot.has('src/lib/core.cjs'));
    assert.ok(!snapshot.has('README.md'));
    assert.ok(!snapshot.has('package.json'));
  });
});

describe('snapshotExports - real repo files', () => {
  it('should extract exports from core.cjs', () => {
    const snapshot = merge.snapshotExports('.', 'HEAD', ['src/lib/core.cjs']);
    const exports = snapshot.get('src/lib/core.cjs');
    assert.ok(Array.isArray(exports), 'should return an array of exports');
    assert.ok(exports.includes('output'), 'should find output export');
    assert.ok(exports.includes('findProjectRoot'), 'should find findProjectRoot export');
    assert.ok(exports.includes('resolveProjectRoot'), 'should find resolveProjectRoot export');
  });

  it('should return empty array for non-existent file', () => {
    const snapshot = merge.snapshotExports('.', 'HEAD', ['src/does-not-exist.cjs']);
    assert.equal(snapshot.size, 1, 'should still have entry for code file');
    const exports = snapshot.get('src/does-not-exist.cjs');
    assert.ok(Array.isArray(exports), 'should return array');
    assert.equal(exports.length, 0, 'should be empty for missing file');
  });
});

describe('checkFeatureRegression - bad merge (regression detected)', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempRepo();

    // Create initial file on main with exports [foo, bar, baz]
    const mainContent = `'use strict';
function foo() { return 'foo'; }
function bar() { return 'bar'; }
function baz() { return 'baz'; }
module.exports = { foo, bar, baz };
`;
    fs.writeFileSync(path.join(tmpDir, 'lib.cjs'), mainContent);
    execFileSync('git', ['add', 'lib.cjs'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: tmpDir, stdio: 'pipe' });

    // Create feature branch with [foo, bar, baz, newFeature]
    execFileSync('git', ['checkout', '-b', 'feature'], { cwd: tmpDir, stdio: 'pipe' });
    const featureContent = `'use strict';
function foo() { return 'foo'; }
function bar() { return 'bar'; }
function baz() { return 'baz'; }
function newFeature() { return 'new'; }
module.exports = { foo, bar, baz, newFeature };
`;
    fs.writeFileSync(path.join(tmpDir, 'lib.cjs'), featureContent);
    execFileSync('git', ['add', 'lib.cjs'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'add newFeature'], { cwd: tmpDir, stdio: 'pipe' });

    // Go back to main, create a "bad merge" commit that loses baz and newFeature
    execFileSync('git', ['checkout', 'main'], { cwd: tmpDir, stdio: 'pipe' });

    // Simulate bad merge: merge feature then clobber
    execFileSync('git', ['merge', '--no-ff', 'feature', '-m', 'merge feature'], { cwd: tmpDir, stdio: 'pipe' });

    // Now amend the merge commit to simulate a bad resolution
    const badContent = `'use strict';
function foo() { return 'foo'; }
function bar() { return 'bar'; }
module.exports = { foo, bar };
`;
    fs.writeFileSync(path.join(tmpDir, 'lib.cjs'), badContent);
    execFileSync('git', ['add', 'lib.cjs'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '--amend', '--no-edit'], { cwd: tmpDir, stdio: 'pipe' });
  });

  after(() => {
    if (tmpDir) removeTempDir(tmpDir);
  });

  it('should detect regression when exports are lost', () => {
    // preMergeRef = main~1 (before merge), setBranch = feature, postMergeRef = HEAD
    const preMergeRef = execFileSync('git', ['rev-parse', 'HEAD~1'], {
      cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe',
    }).trim();

    const result = merge.checkFeatureRegression(
      tmpDir, preMergeRef, 'feature', 'HEAD', ['lib.cjs']
    );

    assert.equal(result.hasRegression, true, 'should detect regression');
    assert.equal(result.regressions.length, 1, 'should have 1 regressed file');
    assert.equal(result.regressions[0].file, 'lib.cjs');
    assert.ok(result.regressions[0].missing.includes('baz'), 'should report baz as missing');
    assert.ok(result.regressions[0].missing.includes('newFeature'), 'should report newFeature as missing');
  });
});

describe('checkFeatureRegression - clean merge (no regression)', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempRepo();

    // Create initial file on main with exports [foo, bar, baz]
    const mainContent = `'use strict';
function foo() { return 'foo'; }
function bar() { return 'bar'; }
function baz() { return 'baz'; }
module.exports = { foo, bar, baz };
`;
    fs.writeFileSync(path.join(tmpDir, 'lib.cjs'), mainContent);
    execFileSync('git', ['add', 'lib.cjs'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: tmpDir, stdio: 'pipe' });

    // Create feature branch with [foo, bar, baz, newFeature]
    execFileSync('git', ['checkout', '-b', 'feature'], { cwd: tmpDir, stdio: 'pipe' });
    const featureContent = `'use strict';
function foo() { return 'foo'; }
function bar() { return 'bar'; }
function baz() { return 'baz'; }
function newFeature() { return 'new'; }
module.exports = { foo, bar, baz, newFeature };
`;
    fs.writeFileSync(path.join(tmpDir, 'lib.cjs'), featureContent);
    execFileSync('git', ['add', 'lib.cjs'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'add newFeature'], { cwd: tmpDir, stdio: 'pipe' });

    // Go back to main, do a clean merge that preserves all exports
    execFileSync('git', ['checkout', 'main'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['merge', '--no-ff', 'feature', '-m', 'merge feature'], { cwd: tmpDir, stdio: 'pipe' });
  });

  after(() => {
    if (tmpDir) removeTempDir(tmpDir);
  });

  it('should not detect regression when all exports preserved', () => {
    const preMergeRef = execFileSync('git', ['rev-parse', 'HEAD~1'], {
      cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe',
    }).trim();

    const result = merge.checkFeatureRegression(
      tmpDir, preMergeRef, 'feature', 'HEAD', ['lib.cjs']
    );

    assert.equal(result.hasRegression, false, 'should not detect regression');
    assert.equal(result.regressions.length, 0, 'should have no regressions');
  });
});

describe('extractExports union logic', () => {
  it('should detect no regression when merged has union of base and set', () => {
    // Simulate: base has {a, b, c}, set has {b, c, d}, merged has {a, b, c, d}
    const baseExports = merge.extractExports('module.exports = { a, b, c };');
    const setExports = merge.extractExports('module.exports = { b, c, d };');
    const mergedExports = merge.extractExports('module.exports = { a, b, c, d };');

    const expected = new Set([...baseExports, ...setExports]);
    const merged = new Set(mergedExports);
    const missing = [...expected].filter(s => !merged.has(s));

    assert.equal(missing.length, 0, 'no missing exports when union is preserved');
  });

  it('should detect regression when merged is missing an export from base', () => {
    // base has {a, b, c}, set has {b, c, d}, merged has {a, b, d} -- lost c
    const baseExports = merge.extractExports('module.exports = { a, b, c };');
    const setExports = merge.extractExports('module.exports = { b, c, d };');
    const mergedExports = merge.extractExports('module.exports = { a, b, d };');

    const expected = new Set([...baseExports, ...setExports]);
    const merged = new Set(mergedExports);
    const missing = [...expected].filter(s => !merged.has(s));

    assert.equal(missing.length, 1, 'one missing export');
    assert.ok(missing.includes('c'), 'c should be missing');
  });

  it('should detect regression when merged is missing exports from both branches', () => {
    // base has {a, b, c}, set has {b, c, d}, merged has {b} -- lost a, c, d
    const baseExports = merge.extractExports('module.exports = { a, b, c };');
    const setExports = merge.extractExports('module.exports = { b, c, d };');
    const mergedExports = merge.extractExports('module.exports = { b };');

    const expected = new Set([...baseExports, ...setExports]);
    const merged = new Set(mergedExports);
    const missing = [...expected].filter(s => !merged.has(s));

    assert.equal(missing.length, 3, 'three missing exports');
    assert.ok(missing.includes('a'), 'a should be missing');
    assert.ok(missing.includes('c'), 'c should be missing');
    assert.ok(missing.includes('d'), 'd should be missing');
  });
});
