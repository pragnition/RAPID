'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFileSync } = require('child_process');

// ────────────────────────────────────────────────────────────────
// Helper: create a mock project directory with merge pipeline structure
// ────────────────────────────────────────────────────────────────
function createMockProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-'));

  // Create .planning/sets/
  const setsDir = path.join(tmpDir, '.planning', 'sets');
  fs.mkdirSync(setsDir, { recursive: true });

  // Create .planning/worktrees/
  const wtRegDir = path.join(tmpDir, '.planning', 'worktrees');
  fs.mkdirSync(wtRegDir, { recursive: true });

  // Create auth-core set
  const authDir = path.join(setsDir, 'auth-core');
  fs.mkdirSync(authDir, { recursive: true });

  fs.writeFileSync(path.join(authDir, 'DEFINITION.md'), [
    '# Set: auth-core',
    '',
    '## Scope',
    'Authentication and token management',
    '',
    '## File Ownership',
    'Files this set owns (exclusive write access):',
    '- src/auth/token.cjs',
    '- src/auth/verify.cjs',
    '',
    '## Tasks',
    '1. Implement token generation',
    '   - Acceptance: Token can be created and verified',
    '',
    '## Interface Contract',
    'See: CONTRACT.json (adjacent file)',
    '',
    '## Wave Assignment',
    'Wave: 1 (parallel with: none)',
    '',
    '## Acceptance Criteria',
    '- Tokens can be generated and verified',
    '',
  ].join('\n'), 'utf-8');

  fs.writeFileSync(path.join(authDir, 'CONTRACT.json'), JSON.stringify({
    exports: {
      functions: [
        { name: 'createToken', file: 'src/auth/token.cjs', params: [{ name: 'payload', type: 'object' }], returns: 'string' },
        { name: 'verifyToken', file: 'src/auth/verify.cjs', params: [{ name: 'token', type: 'string' }], returns: 'object' },
      ],
      types: [],
    },
  }, null, 2), 'utf-8');

  // Create api-routes set (wave 2, depends on auth-core)
  const apiDir = path.join(setsDir, 'api-routes');
  fs.mkdirSync(apiDir, { recursive: true });

  fs.writeFileSync(path.join(apiDir, 'DEFINITION.md'), [
    '# Set: api-routes',
    '',
    '## Scope',
    'API route handlers',
    '',
    '## File Ownership',
    'Files this set owns (exclusive write access):',
    '- src/routes/index.cjs',
    '',
    '## Tasks',
    '1. Implement routes',
    '',
    '## Interface Contract',
    'See: CONTRACT.json (adjacent file)',
    '',
    '## Wave Assignment',
    'Wave: 2 (parallel with: none)',
    '',
    '## Acceptance Criteria',
    '- Routes serve requests',
    '',
  ].join('\n'), 'utf-8');

  fs.writeFileSync(path.join(apiDir, 'CONTRACT.json'), JSON.stringify({
    exports: {
      functions: [
        { name: 'setupRoutes', file: 'src/routes/index.cjs', params: [{ name: 'app', type: 'object' }], returns: 'void' },
      ],
      types: [],
    },
    imports: {
      fromSets: [{ set: 'auth-core', functions: ['verifyToken'] }],
    },
  }, null, 2), 'utf-8');

  // Create OWNERSHIP.json
  fs.writeFileSync(path.join(setsDir, 'OWNERSHIP.json'), JSON.stringify({
    version: 1,
    ownership: {
      'src/auth/token.cjs': 'auth-core',
      'src/auth/verify.cjs': 'auth-core',
      'src/routes/index.cjs': 'api-routes',
    },
  }, null, 2), 'utf-8');

  // Create DAG.json
  fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify({
    nodes: [
      { id: 'auth-core', wave: 1, status: 'pending' },
      { id: 'api-routes', wave: 2, status: 'pending' },
    ],
    edges: [{ from: 'auth-core', to: 'api-routes' }],
    waves: {
      1: { sets: ['auth-core'], checkpoint: {} },
      2: { sets: ['api-routes'], checkpoint: {} },
    },
    metadata: { totalSets: 2, totalWaves: 2, maxParallelism: 1 },
  }, null, 2), 'utf-8');

  // Create REGISTRY.json
  fs.writeFileSync(path.join(wtRegDir, 'REGISTRY.json'), JSON.stringify({
    version: 1,
    worktrees: {},
  }, null, 2), 'utf-8');

  return tmpDir;
}

/**
 * Create a git repo with a set branch for merge testing.
 * Returns tmpDir path.
 */
function createGitProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-git-'));

  // Init git repo
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

  // Create initial commit on main
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Project', 'utf-8');
  execSync('git add README.md', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'pipe' });
  try { execSync('git branch -m main', { cwd: tmpDir, stdio: 'pipe' }); } catch { /* ok */ }

  // Create a feature branch with commits
  execSync('git checkout -b rapid/auth-core', { cwd: tmpDir, stdio: 'pipe' });
  fs.mkdirSync(path.join(tmpDir, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'token.cjs'), '// token module\nmodule.exports = { createToken: () => "tok" };', 'utf-8');
  execSync('git add src/auth/token.cjs', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "feat(auth-core): add token module"', { cwd: tmpDir, stdio: 'pipe' });

  // Go back to main
  execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });

  return tmpDir;
}

/**
 * Create a git repo with overlapping changes for conflict testing.
 * Sets up main and rapid/test-set branches with conflicting modifications.
 */
function createConflictGitProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-conflict-'));

  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

  // Create initial file and commit on main
  fs.mkdirSync(path.join(tmpDir, 'src', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'lib', 'shared.cjs'), [
    "'use strict';",
    '',
    'function greet(name) {',
    '  return "Hello, " + name;',
    '}',
    '',
    'function farewell(name) {',
    '  return "Goodbye, " + name;',
    '}',
    '',
    "const utils = require('./utils.cjs');",
    '',
    'module.exports = { greet, farewell };',
  ].join('\n'), 'utf-8');

  fs.writeFileSync(path.join(tmpDir, 'src', 'lib', 'other.cjs'), [
    "'use strict';",
    'module.exports = { foo: () => 42 };',
  ].join('\n'), 'utf-8');

  execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'pipe' });
  try { execSync('git branch -m main', { cwd: tmpDir, stdio: 'pipe' }); } catch { /* ok */ }

  // Create feature branch
  execSync('git checkout -b rapid/test-set', { cwd: tmpDir, stdio: 'pipe' });

  // On the branch: modify greet, add a dependency, change exports
  fs.writeFileSync(path.join(tmpDir, 'src', 'lib', 'shared.cjs'), [
    "'use strict';",
    '',
    'function greet(name) {',
    '  return "Hi there, " + name + "!";',
    '}',
    '',
    'function farewell(name) {',
    '  return "Goodbye, " + name;',
    '}',
    '',
    "const utils = require('./utils.cjs');",
    "const logger = require('./logger.cjs');",
    '',
    'function newHelper() { return true; }',
    '',
    'module.exports = { greet, farewell, newHelper };',
  ].join('\n'), 'utf-8');

  execSync('git add src/lib/shared.cjs', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "feat(test-set): modify shared module"', { cwd: tmpDir, stdio: 'pipe' });

  // Go back to main and make conflicting changes
  execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });

  fs.writeFileSync(path.join(tmpDir, 'src', 'lib', 'shared.cjs'), [
    "'use strict';",
    '',
    'function greet(name) {',
    '  return "Welcome, " + name + ".";',
    '}',
    '',
    'function farewell(name) {',
    '  return "See you later, " + name;',
    '}',
    '',
    "const utils = require('./utils.cjs');",
    "const config = require('./config.cjs');",
    '',
    'module.exports = { greet, farewell };',
  ].join('\n'), 'utf-8');

  execSync('git add src/lib/shared.cjs', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "feat: modify shared on main"', { cwd: tmpDir, stdio: 'pipe' });

  return tmpDir;
}

// ────────────────────────────────────────────────────────────────
// Detection Pipeline Tests (MERG-01)
// ────────────────────────────────────────────────────────────────

describe('extractFunctionNames', () => {
  it('extracts function declarations and const/let arrow functions', () => {
    const merge = require('./merge.cjs');
    const diff = [
      '+function greet(name) {',
      '+  return name;',
      '+}',
      '+const helper = () => true;',
      '+let process = async function doWork() {',
      '-function oldFunc() {',
      ' function unchanged() {',
    ].join('\n');

    const names = merge.extractFunctionNames(diff);
    assert.ok(names.includes('greet'), 'should extract function declaration greet');
    assert.ok(names.includes('helper'), 'should extract const arrow function helper');
    assert.ok(names.includes('oldFunc'), 'should extract removed function declaration oldFunc');
    // unchanged (no +/- prefix) should NOT be extracted
    assert.ok(!names.includes('unchanged'), 'should not extract unchanged function');
  });
});

describe('extractDependencies', () => {
  it('extracts both require() and import-from patterns', () => {
    const merge = require('./merge.cjs');
    const content = [
      "const fs = require('fs');",
      "const path = require('path');",
      "const { z } = require('zod');",
      "import foo from 'bar';",
      "import { baz } from 'qux';",
    ].join('\n');

    const deps = merge.extractDependencies(content);
    assert.ok(deps.includes('fs'), 'should extract fs require');
    assert.ok(deps.includes('path'), 'should extract path require');
    assert.ok(deps.includes('zod'), 'should extract zod require');
    assert.ok(deps.includes('bar'), 'should extract bar import');
    assert.ok(deps.includes('qux'), 'should extract qux import');
  });
});

describe('extractExports', () => {
  it('extracts module.exports and named exports', () => {
    const merge = require('./merge.cjs');
    const content = [
      'module.exports = { greet, farewell, helper };',
    ].join('\n');

    const exports = merge.extractExports(content);
    assert.ok(exports.includes('greet'), 'should extract greet from module.exports');
    assert.ok(exports.includes('farewell'), 'should extract farewell from module.exports');
    assert.ok(exports.includes('helper'), 'should extract helper from module.exports');
  });

  it('extracts ESM named exports', () => {
    const merge = require('./merge.cjs');
    const content = [
      'export function greet() {}',
      'export const helper = () => {};',
      'export { farewell };',
    ].join('\n');

    const exports = merge.extractExports(content);
    assert.ok(exports.includes('greet'), 'should extract ESM function export');
    assert.ok(exports.includes('helper'), 'should extract ESM const export');
    assert.ok(exports.includes('farewell'), 'should extract ESM named export');
  });
});

describe('parseConflictFiles', () => {
  it('extracts file paths from git conflict output', () => {
    const merge = require('./merge.cjs');
    const output = [
      'Auto-merging src/lib/shared.cjs',
      'CONFLICT (content): Merge conflict in src/lib/shared.cjs',
      'CONFLICT (content): Merge conflict in src/lib/other.cjs',
      'Automatic merge failed; fix conflicts and then commit the result.',
    ].join('\n');

    const files = merge.parseConflictFiles(output);
    assert.ok(files.some(c => c.file === 'src/lib/shared.cjs'), 'should extract shared.cjs');
    assert.ok(files.some(c => c.file === 'src/lib/other.cjs'), 'should extract other.cjs');
  });
});

describe('detectTextualConflicts', { concurrency: 1 }, () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns hasConflicts=false when no conflicts exist', () => {
    const merge = require('./merge.cjs');
    tmpDir = createGitProject();

    const result = merge.detectTextualConflicts(tmpDir, 'rapid/auth-core', 'main');
    assert.equal(result.hasConflicts, false, 'should have no conflicts');
  });

  it('returns hasConflicts=true with file list when conflicts exist', () => {
    const merge = require('./merge.cjs');
    tmpDir = createConflictGitProject();

    const result = merge.detectTextualConflicts(tmpDir, 'rapid/test-set', 'main');
    assert.equal(result.hasConflicts, true, 'should detect conflicts');
    assert.ok(result.conflicts.length > 0, 'should have conflict list');
    assert.ok(result.conflicts.some(c => c.file === 'src/lib/shared.cjs'), 'should identify conflicting file');
  });

  it('always aborts merge (working tree clean after detection)', () => {
    const merge = require('./merge.cjs');
    tmpDir = createConflictGitProject();

    merge.detectTextualConflicts(tmpDir, 'rapid/test-set', 'main');

    // Working tree should be clean
    const status = execSync('git status --porcelain', { cwd: tmpDir, encoding: 'utf-8' });
    assert.equal(status.trim(), '', 'working tree should be clean after detection');
  });
});

describe('detectStructuralConflicts', { concurrency: 1 }, () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty when no overlapping function modifications', () => {
    const merge = require('./merge.cjs');
    tmpDir = createGitProject();

    const result = merge.detectStructuralConflicts(tmpDir, 'rapid/auth-core', 'main');
    assert.ok(Array.isArray(result.conflicts), 'should return conflicts array');
    assert.equal(result.conflicts.length, 0, 'should have no structural conflicts');
  });

  it('detects when same function is modified in both branches', () => {
    const merge = require('./merge.cjs');
    tmpDir = createConflictGitProject();

    const result = merge.detectStructuralConflicts(tmpDir, 'rapid/test-set', 'main');
    assert.ok(Array.isArray(result.conflicts), 'should return conflicts array');
    // Both branches modify greet and farewell in shared.cjs
    const sharedConflict = result.conflicts.find(c => c.file === 'src/lib/shared.cjs');
    assert.ok(sharedConflict, 'should detect structural conflict in shared.cjs');
    assert.ok(sharedConflict.functions.includes('greet'), 'should detect greet function overlap');
  });
});

describe('detectDependencyConflicts', { concurrency: 1 }, () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects added/removed dependencies in overlapping files', () => {
    const merge = require('./merge.cjs');
    tmpDir = createConflictGitProject();

    const result = merge.detectDependencyConflicts(tmpDir, 'rapid/test-set', 'main');
    assert.ok(Array.isArray(result.conflicts), 'should return conflicts array');
    // The branch added logger, main added config -- both added deps
    // There should be a dependency conflict for shared.cjs
    const depConflict = result.conflicts.find(c => c.file === 'src/lib/shared.cjs');
    assert.ok(depConflict, 'should detect dependency conflict in shared.cjs');
    assert.equal(depConflict.type, 'dependency', 'should be a dependency type');
  });
});

describe('detectAPIConflicts', { concurrency: 1 }, () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects changed exports in overlapping files', () => {
    const merge = require('./merge.cjs');
    tmpDir = createConflictGitProject();

    const result = merge.detectAPIConflicts(tmpDir, 'rapid/test-set', 'main');
    assert.ok(Array.isArray(result.conflicts), 'should return conflicts array');
    // The branch added newHelper to exports, base did not
    const apiConflict = result.conflicts.find(c => c.file === 'src/lib/shared.cjs');
    assert.ok(apiConflict, 'should detect API conflict in shared.cjs');
    assert.equal(apiConflict.type, 'api', 'should be api type');
  });
});

describe('detectConflicts', { concurrency: 1 }, () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('orchestrates all L1-L4 and returns structured report with L5=null', () => {
    const merge = require('./merge.cjs');
    tmpDir = createConflictGitProject();

    const result = merge.detectConflicts(tmpDir, 'test-set', 'main');
    assert.ok(result.textual, 'should have textual detection result');
    assert.ok(result.structural, 'should have structural detection result');
    assert.ok(result.dependency, 'should have dependency detection result');
    assert.ok(result.api, 'should have api detection result');
    assert.equal(result.semantic, null, 'L5 semantic should be null');
  });
});

// ────────────────────────────────────────────────────────────────
// Resolution Cascade Tests (MERG-02)
// ────────────────────────────────────────────────────────────────

describe('tryDeterministicResolve', () => {
  it('resolves non-overlapping addition with confidence=1.0', () => {
    const merge = require('./merge.cjs');
    const conflict = {
      file: 'src/lib/shared.cjs',
      type: 'textual',
      detail: 'non-overlapping',
      nonOverlapping: true,
    };

    const result = merge.tryDeterministicResolve(conflict);
    assert.equal(result.resolved, true, 'should resolve non-overlapping');
    assert.equal(result.confidence, 1.0, 'confidence should be 1.0');
  });

  it('returns unresolved for overlapping changes', () => {
    const merge = require('./merge.cjs');
    const conflict = {
      file: 'src/lib/shared.cjs',
      type: 'structural',
      functions: ['greet'],
      nonOverlapping: false,
    };

    const result = merge.tryDeterministicResolve(conflict);
    assert.equal(result.resolved, false, 'should not resolve overlapping');
  });
});

describe('tryHeuristicResolve', () => {
  it('prefers file owner version when ownership available', () => {
    const merge = require('./merge.cjs');
    const conflict = {
      file: 'src/auth/token.cjs',
      type: 'structural',
      functions: ['createToken'],
    };
    const ownership = { 'src/auth/token.cjs': 'auth-core' };
    const dagOrder = ['auth-core', 'api-routes'];

    const result = merge.tryHeuristicResolve(conflict, ownership, dagOrder);
    assert.equal(result.resolved, true, 'should resolve with ownership');
    assert.ok(result.confidence >= 0.7 && result.confidence <= 0.9, 'confidence should be 0.7-0.9');
    assert.ok(result.signal.includes('ownership'), 'signal should mention ownership');
  });

  it('prefers earlier-wave set when DAG order available', () => {
    const merge = require('./merge.cjs');
    const conflict = {
      file: 'src/shared/utils.cjs',
      type: 'structural',
      functions: ['helper'],
      setName: 'api-routes',
    };
    const ownership = {}; // no ownership info for this file
    const dagOrder = ['auth-core', 'api-routes'];

    const result = merge.tryHeuristicResolve(conflict, ownership, dagOrder);
    assert.equal(result.resolved, true, 'should resolve with DAG order');
    assert.ok(result.signal.includes('dag'), 'signal should mention dag order');
  });

  it('merges both entries for array-addition pattern', () => {
    const merge = require('./merge.cjs');
    const conflict = {
      file: 'src/lib/routes.cjs',
      type: 'textual',
      detail: 'both-added-to-array',
      pattern: 'array-addition',
    };
    const ownership = {};
    const dagOrder = [];

    const result = merge.tryHeuristicResolve(conflict, ownership, dagOrder);
    assert.equal(result.resolved, true, 'should resolve array addition');
    assert.ok(result.signal.includes('pattern'), 'signal should mention pattern');
  });
});

describe('resolveConflicts', () => {
  it('cascades through tiers correctly', () => {
    const merge = require('./merge.cjs');
    const detectionResults = {
      allConflicts: [
        { file: 'a.cjs', type: 'textual', nonOverlapping: true },
        { file: 'b.cjs', type: 'structural', functions: ['foo'], setName: 'api-routes' },
      ],
    };
    const options = {
      ownership: {},
      dagOrder: ['auth-core', 'api-routes'],
    };

    const results = merge.resolveConflicts(detectionResults, options);
    assert.ok(Array.isArray(results), 'should return array');
    assert.equal(results.length, 2, 'should have result per conflict');

    // First conflict is non-overlapping -> T1
    const t1Result = results.find(r => r.conflict.file === 'a.cjs');
    assert.ok(t1Result, 'should have result for a.cjs');
    assert.equal(t1Result.tier, 1, 'non-overlapping should be tier 1');

    // Second conflict -> T2 (DAG order)
    const t2Result = results.find(r => r.conflict.file === 'b.cjs');
    assert.ok(t2Result, 'should have result for b.cjs');
    assert.equal(t2Result.tier, 2, 'structural with DAG should be tier 2');
  });

  it('marks unresolvable conflicts as needsAgent', () => {
    const merge = require('./merge.cjs');
    const detectionResults = {
      allConflicts: [
        { file: 'c.cjs', type: 'structural', functions: ['bar'], nonOverlapping: false },
      ],
    };
    const options = {
      ownership: {},
      dagOrder: [],
    };

    const results = merge.resolveConflicts(detectionResults, options);
    assert.equal(results.length, 1, 'should have one result');
    assert.equal(results[0].needsAgent, true, 'should mark as needsAgent');
    assert.equal(results[0].tier, 3, 'should be tier 3');
  });
});

// ────────────────────────────────────────────────────────────────
// MERGE-STATE.json Tests (MERG-03)
// ────────────────────────────────────────────────────────────────

describe('MergeStateSchema', () => {
  it('validates correct merge state object', () => {
    const merge = require('./merge.cjs');
    const valid = {
      setId: 'auth-core',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    };
    // Should not throw
    const result = merge.MergeStateSchema.parse(valid);
    assert.equal(result.setId, 'auth-core');
    assert.equal(result.status, 'pending');
  });

  it('rejects invalid status values', () => {
    const merge = require('./merge.cjs');
    const invalid = {
      setId: 'auth-core',
      status: 'bogus-status',
      lastUpdatedAt: new Date().toISOString(),
    };
    assert.throws(() => merge.MergeStateSchema.parse(invalid), 'should throw for invalid status');
  });
});

describe('writeMergeState', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates file with validated content', () => {
    const merge = require('./merge.cjs');
    const state = {
      setId: 'auth-core',
      status: 'detecting',
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };

    merge.writeMergeState(tmpDir, 'auth-core', state);

    const filePath = path.join(tmpDir, '.planning', 'sets', 'auth-core', 'MERGE-STATE.json');
    assert.ok(fs.existsSync(filePath), 'should create MERGE-STATE.json');
    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.equal(written.setId, 'auth-core');
    assert.equal(written.status, 'detecting');
  });
});

describe('readMergeState', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for missing file', () => {
    const merge = require('./merge.cjs');
    const result = merge.readMergeState(tmpDir, 'nonexistent');
    assert.equal(result, null, 'should return null for missing');
  });

  it('returns validated object for existing file', () => {
    const merge = require('./merge.cjs');
    const state = {
      setId: 'auth-core',
      status: 'merging',
      lastUpdatedAt: new Date().toISOString(),
    };

    // Write first
    merge.writeMergeState(tmpDir, 'auth-core', state);

    // Read back
    const result = merge.readMergeState(tmpDir, 'auth-core');
    assert.ok(result, 'should return state object');
    assert.equal(result.setId, 'auth-core');
    assert.equal(result.status, 'merging');
  });
});

describe('updateMergeState', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('merges partial updates correctly', () => {
    const merge = require('./merge.cjs');
    const initial = {
      setId: 'auth-core',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    };

    merge.writeMergeState(tmpDir, 'auth-core', initial);
    merge.updateMergeState(tmpDir, 'auth-core', { status: 'detecting', startedAt: new Date().toISOString() });

    const result = merge.readMergeState(tmpDir, 'auth-core');
    assert.equal(result.status, 'detecting', 'should update status');
    assert.ok(result.startedAt, 'should have startedAt');
    assert.equal(result.setId, 'auth-core', 'should preserve setId');
  });
});

// ────────────────────────────────────────────────────────────────
// Preserved v1.0 Function Tests (MERG-04)
// ────────────────────────────────────────────────────────────────

describe('writeReviewMd', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-review-'));
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes REVIEW.md with correct sections and verdict marker', () => {
    const merge = require('./merge.cjs');
    const reviewData = {
      setName: 'auth-core',
      verdict: 'APPROVE',
      contractResults: { valid: true, errors: [] },
      ownershipResults: { violations: [] },
      testResults: { passed: true, output: 'All tests pass' },
      findings: {
        blocking: [],
        fixable: [],
        suggestions: ['Consider adding JSDoc'],
      },
    };

    merge.writeReviewMd(tmpDir, reviewData);

    const content = fs.readFileSync(path.join(tmpDir, 'REVIEW.md'), 'utf-8');
    assert.ok(content.includes('# Review: auth-core'), 'should have heading with set name');
    assert.ok(content.includes('**Verdict:** APPROVE'), 'should have verdict line');
    assert.ok(content.includes('<!-- VERDICT:APPROVE -->'), 'should have machine-parseable verdict marker');
    assert.ok(content.includes('## Contract Validation'), 'should have contract section');
    assert.ok(content.includes('## Ownership Check'), 'should have ownership section');
    assert.ok(content.includes('## Test Results'), 'should have test results section');
    assert.ok(content.includes('## Findings'), 'should have findings section');
    assert.ok(content.includes('Consider adding JSDoc'), 'should include suggestion');
  });

  it('shows "None" for empty findings sections', () => {
    const merge = require('./merge.cjs');
    const reviewData = {
      setName: 'test-set',
      verdict: 'APPROVE',
      contractResults: { valid: true, errors: [] },
      ownershipResults: { violations: [] },
      testResults: { passed: true, output: '' },
      findings: { blocking: [], fixable: [], suggestions: [] },
    };

    merge.writeReviewMd(tmpDir, reviewData);

    const content = fs.readFileSync(path.join(tmpDir, 'REVIEW.md'), 'utf-8');
    assert.ok(content.includes('None'), 'should show None for empty findings');
  });

  it('includes blocking and fixable findings when present', () => {
    const merge = require('./merge.cjs');
    const reviewData = {
      setName: 'test-set',
      verdict: 'CHANGES',
      contractResults: { valid: true, errors: [] },
      ownershipResults: { violations: [{ file: 'x.cjs', owner: 'other-set', declared: false }] },
      testResults: { passed: false, output: 'Test failed' },
      findings: {
        blocking: ['Contract violation in token.cjs:42'],
        fixable: ['Missing JSDoc on createToken'],
        suggestions: [],
      },
    };

    merge.writeReviewMd(tmpDir, reviewData);

    const content = fs.readFileSync(path.join(tmpDir, 'REVIEW.md'), 'utf-8');
    assert.ok(content.includes('<!-- VERDICT:CHANGES -->'), 'should have CHANGES verdict');
    assert.ok(content.includes('Contract violation in token.cjs:42'), 'should include blocking finding');
    assert.ok(content.includes('Missing JSDoc on createToken'), 'should include fixable finding');
  });
});

describe('parseReviewVerdict', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-verdict-'));
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts APPROVE verdict from REVIEW.md', () => {
    const merge = require('./merge.cjs');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW.md'), [
      '# Review: auth-core',
      '<!-- VERDICT:APPROVE -->',
      'Some review content',
    ].join('\n'), 'utf-8');

    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, true, 'should find verdict');
    assert.equal(result.verdict, 'APPROVE', 'should extract APPROVE');
  });

  it('extracts CHANGES verdict from REVIEW.md', () => {
    const merge = require('./merge.cjs');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW.md'), [
      '# Review: test-set',
      '**Verdict:** CHANGES',
      '<!-- VERDICT:CHANGES -->',
    ].join('\n'), 'utf-8');

    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, true, 'should find verdict');
    assert.equal(result.verdict, 'CHANGES', 'should extract CHANGES');
  });

  it('extracts BLOCK verdict from REVIEW.md', () => {
    const merge = require('./merge.cjs');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW.md'), [
      '# Review: blocked-set',
      '<!-- VERDICT:BLOCK -->',
    ].join('\n'), 'utf-8');

    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, true, 'should find verdict');
    assert.equal(result.verdict, 'BLOCK', 'should extract BLOCK');
  });

  it('returns found=false when REVIEW.md is missing', () => {
    const merge = require('./merge.cjs');
    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, false, 'should not find verdict for missing file');
  });

  it('returns found=false for malformed REVIEW.md without verdict marker', () => {
    const merge = require('./merge.cjs');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW.md'), [
      '# Review: some-set',
      'No verdict marker here',
      'Just some text',
    ].join('\n'), 'utf-8');

    const result = merge.parseReviewVerdict(tmpDir);
    assert.equal(result.found, false, 'should not find verdict in malformed file');
  });
});

describe('getMergeOrder', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns wave-grouped arrays from DAG', () => {
    const merge = require('./merge.cjs');
    const order = merge.getMergeOrder(tmpDir);

    assert.ok(Array.isArray(order), 'should return array');
    assert.equal(order.length, 2, 'should have 2 waves');
    assert.deepEqual(order[0], ['auth-core'], 'wave 1 should have auth-core');
    assert.deepEqual(order[1], ['api-routes'], 'wave 2 should have api-routes');
  });
});

describe('mergeSet', { concurrency: 1 }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createGitProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('successfully merges a set branch with --no-ff', () => {
    const merge = require('./merge.cjs');
    const result = merge.mergeSet(tmpDir, 'auth-core', 'main');

    assert.equal(result.merged, true, 'should merge successfully');
    assert.equal(result.branch, 'rapid/auth-core', 'should return branch name');
    assert.ok(result.commitHash, 'should return commit hash');
    assert.ok(result.commitHash.length > 0, 'commit hash should not be empty');

    // Verify merge commit exists
    const logResult = execSync('git log --oneline -3', { cwd: tmpDir, encoding: 'utf-8' });
    assert.ok(logResult.includes('merge(auth-core)'), 'should have merge commit message');
  });

  it('returns failure on merge conflict', () => {
    const merge = require('./merge.cjs');

    // Create a conflict: modify same file on main
    fs.mkdirSync(path.join(tmpDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'token.cjs'), '// CONFLICTING content on main', 'utf-8');
    execSync('git add src/auth/token.cjs', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "conflict: modify token on main"', { cwd: tmpDir, stdio: 'pipe' });

    const result = merge.mergeSet(tmpDir, 'auth-core', 'main');

    assert.equal(result.merged, false, 'should not merge');
    assert.equal(result.reason, 'conflict', 'should report conflict reason');
    assert.ok(result.detail, 'should have detail string');
  });

  it('returns failure when checkout fails for nonexistent branch', () => {
    const merge = require('./merge.cjs');
    const result = merge.mergeSet(tmpDir, 'auth-core', 'nonexistent-branch');

    assert.equal(result.merged, false, 'should not merge');
    assert.equal(result.reason, 'checkout_failed', 'should report checkout_failed reason');
  });
});

describe('assembleReviewerPrompt', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('includes changed files, contract, and programmatic results', () => {
    const merge = require('./merge.cjs');
    const programmaticResults = {
      contractValid: true,
      testsPass: true,
      ownershipViolations: [],
    };

    const prompt = merge.assembleReviewerPrompt(tmpDir, 'auth-core', programmaticResults);

    assert.ok(prompt.includes('Merge Review'), 'should have merge review heading');
    assert.ok(prompt.includes('auth-core'), 'should reference set name');
    assert.ok(prompt.includes('Contract'), 'should include contract section');
    assert.ok(prompt.includes('Programmatic Validation'), 'should include validation results');
    assert.ok(prompt.includes('PASS'), 'should show PASS for valid contract');
    assert.ok(prompt.includes('Review Instructions'), 'should include review instructions');
    assert.ok(prompt.includes('VERDICT'), 'should mention VERDICT marker in instructions');
  });

  it('shows FAIL for invalid contract in results', () => {
    const merge = require('./merge.cjs');
    const programmaticResults = {
      contractValid: false,
      testsPass: false,
      ownershipViolations: [{ file: 'x.cjs', owner: 'other', declared: false }],
    };

    const prompt = merge.assembleReviewerPrompt(tmpDir, 'auth-core', programmaticResults);

    assert.ok(prompt.includes('FAIL'), 'should show FAIL for invalid contract');
  });
});

describe('runProgrammaticGate', { concurrency: 1 }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();

    // Create source files at project root
    fs.mkdirSync(path.join(tmpDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'token.cjs'), [
      "'use strict';",
      "module.exports = { createToken: () => 'tok' };",
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'verify.cjs'), [
      "'use strict';",
      "module.exports = { verifyToken: () => ({}) };",
    ].join('\n'), 'utf-8');

    // Create a git repo for the worktree
    const wtDir = path.join(tmpDir, '.rapid-worktrees', 'auth-core');
    fs.mkdirSync(path.join(wtDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(wtDir, 'src', 'auth', 'token.cjs'), [
      "'use strict';",
      "module.exports = { createToken: () => 'tok' };",
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(wtDir, 'src', 'auth', 'verify.cjs'), [
      "'use strict';",
      "module.exports = { verifyToken: () => ({}) };",
    ].join('\n'), 'utf-8');

    // Init git in worktree
    execSync('git init', { cwd: wtDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: wtDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: wtDir, stdio: 'pipe' });
    execSync('git add -A', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "initial"', { cwd: wtDir, stdio: 'pipe' });
    try { execSync('git branch -m main', { cwd: wtDir, stdio: 'pipe' }); } catch { /* ok */ }
    execSync('git checkout -b rapid/auth-core', { cwd: wtDir, stdio: 'pipe' });

    // Make a change on the branch
    fs.writeFileSync(path.join(wtDir, 'src', 'auth', 'token.cjs'), [
      "'use strict';",
      "module.exports = { createToken: (payload) => JSON.stringify(payload) };",
    ].join('\n'), 'utf-8');
    execSync('git add src/auth/token.cjs', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): implement createToken"', { cwd: wtDir, stdio: 'pipe' });

    // Update registry with worktree entry
    const regPath = path.join(tmpDir, '.planning', 'worktrees', 'REGISTRY.json');
    fs.writeFileSync(regPath, JSON.stringify({
      version: 1,
      worktrees: {
        'auth-core': {
          setName: 'auth-core',
          branch: 'rapid/auth-core',
          path: '.rapid-worktrees/auth-core',
          phase: 'Done',
        },
      },
    }, null, 2), 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes when contract is valid and no ownership violations', () => {
    const merge = require('./merge.cjs');
    const result = merge.runProgrammaticGate(tmpDir, 'auth-core');

    assert.equal(result.contractValid, true, 'contract should be valid');
    assert.ok(Array.isArray(result.ownershipViolations), 'should have violations array');
    assert.equal(result.ownershipViolations.length, 0, 'should have no violations');
    assert.equal(result.passed, true, 'overall should pass');
  });

  it('fails when contract schema is invalid', () => {
    const merge = require('./merge.cjs');

    // Write invalid contract
    const contractPath = path.join(tmpDir, '.planning', 'sets', 'auth-core', 'CONTRACT.json');
    fs.writeFileSync(contractPath, JSON.stringify({
      invalidField: true,
    }, null, 2), 'utf-8');

    const result = merge.runProgrammaticGate(tmpDir, 'auth-core');

    assert.equal(result.contractValid, false, 'contract should be invalid');
    assert.equal(result.passed, false, 'overall should fail');
  });

  it('detects ownership violations for cross-set file modifications', () => {
    const merge = require('./merge.cjs');

    // Add a file owned by api-routes to the worktree branch
    const wtDir = path.join(tmpDir, '.rapid-worktrees', 'auth-core');
    fs.mkdirSync(path.join(wtDir, 'src', 'routes'), { recursive: true });
    fs.writeFileSync(path.join(wtDir, 'src', 'routes', 'index.cjs'), '// routes', 'utf-8');
    execSync('git add src/routes/index.cjs', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): add routes"', { cwd: wtDir, stdio: 'pipe' });

    const result = merge.runProgrammaticGate(tmpDir, 'auth-core');

    assert.ok(result.ownershipViolations.length > 0, 'should detect ownership violation');
    assert.ok(result.ownershipViolations.some(v => v.file === 'src/routes/index.cjs'), 'should identify the violating file');
    assert.equal(result.passed, false, 'overall should fail due to ownership violation');
  });

  it('allows cross-set access when CONTRIBUTIONS.json exception exists', () => {
    const merge = require('./merge.cjs');

    // Add a file owned by api-routes to the worktree branch
    const wtDir = path.join(tmpDir, '.rapid-worktrees', 'auth-core');
    fs.mkdirSync(path.join(wtDir, 'src', 'routes'), { recursive: true });
    fs.writeFileSync(path.join(wtDir, 'src', 'routes', 'index.cjs'), '// routes', 'utf-8');
    execSync('git add src/routes/index.cjs', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "feat(auth-core): add auth middleware to routes"', { cwd: wtDir, stdio: 'pipe' });

    // Create CONTRIBUTIONS.json exception for auth-core
    const contribPath = path.join(tmpDir, '.planning', 'sets', 'auth-core', 'CONTRIBUTIONS.json');
    fs.writeFileSync(contribPath, JSON.stringify({
      set: 'auth-core',
      contributesTo: [
        { file: 'src/routes/index.cjs', owner: 'api-routes', intent: 'Add auth middleware' },
      ],
    }, null, 2), 'utf-8');

    const result = merge.runProgrammaticGate(tmpDir, 'auth-core');

    assert.equal(result.ownershipViolations.length, 0, 'should have no violations with contribution exception');
  });
});

describe('prepareReviewContext', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns context object with expected fields', () => {
    const merge = require('./merge.cjs');
    const ctx = merge.prepareReviewContext(tmpDir, 'auth-core');

    assert.ok(ctx.contractStr, 'should have contractStr');
    assert.ok(ctx.definition, 'should have definition');
    assert.ok(ctx.setDir, 'should have setDir');
    assert.ok(typeof ctx.ownershipData === 'object', 'should have ownershipData');
  });
});

describe('runIntegrationTests', { concurrency: 1 }, () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-integ-'));
    fs.mkdirSync(path.join(tmpDir, 'src', 'lib'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('passes when tests succeed', () => {
    const merge = require('./merge.cjs');

    // Create a simple passing test file
    fs.writeFileSync(path.join(tmpDir, 'src', 'lib', 'pass.test.cjs'), [
      "'use strict';",
      "const { describe, it } = require('node:test');",
      "const assert = require('node:assert/strict');",
      "describe('pass', () => { it('works', () => { assert.ok(true); }); });",
    ].join('\n'), 'utf-8');

    const result = merge.runIntegrationTests(tmpDir);
    assert.equal(result.passed, true, 'should pass');
    assert.ok(typeof result.output === 'string', 'should have output');
  });

  it('fails when tests fail', () => {
    const merge = require('./merge.cjs');

    // Create a failing test file that throws at top level
    fs.writeFileSync(path.join(tmpDir, 'src', 'lib', 'fail.test.cjs'), [
      "'use strict';",
      "process.exitCode = 1;",
      "throw new Error('deliberate test failure');",
    ].join('\n'), 'utf-8');

    const result = merge.runIntegrationTests(tmpDir);
    assert.equal(result.passed, false, 'should fail');
    assert.ok(typeof result.output === 'string', 'should have output');
  });
});

// ────────────────────────────────────────────────────────────────
// Bisection Recovery Tests (MERG-05)
// ────────────────────────────────────────────────────────────────

/**
 * Create a git project with multiple set branches for bisection testing.
 * Sets up main with an initial commit, then creates N set branches with commits.
 * Each set modifies a unique file (no conflicts between sets).
 * One set (the "breaker") adds a file that causes the test script to fail.
 */
function createBisectionProject(breakerIndex) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-bisect-'));

  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

  // Create initial structure on main
  fs.mkdirSync(path.join(tmpDir, 'src', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test', 'utf-8');

  // Create a simple test script that checks for the breaker file
  fs.writeFileSync(path.join(tmpDir, 'src', 'lib', 'integ.test.cjs'), [
    "'use strict';",
    "const { describe, it } = require('node:test');",
    "const assert = require('node:assert/strict');",
    "const fs = require('fs');",
    "const path = require('path');",
    "describe('integration', () => {",
    "  it('no breaker present', () => {",
    "    const breaker = path.join(__dirname, '..', '..', 'BREAKER');",
    "    assert.ok(!fs.existsSync(breaker), 'BREAKER file should not exist');",
    "  });",
    "});",
  ].join('\n'), 'utf-8');

  execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'pipe' });
  try { execSync('git branch -m main', { cwd: tmpDir, stdio: 'pipe' }); } catch { /* ok */ }

  // Create set branches
  const setNames = ['set-alpha', 'set-beta', 'set-gamma'];
  for (let i = 0; i < setNames.length; i++) {
    const setName = setNames[i];
    execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });
    execSync(`git checkout -b rapid/${setName}`, { cwd: tmpDir, stdio: 'pipe' });

    // Each set creates a unique file
    fs.writeFileSync(path.join(tmpDir, 'src', `${setName}.cjs`), `// ${setName}\nmodule.exports = {};`, 'utf-8');
    execSync(`git add src/${setName}.cjs`, { cwd: tmpDir, stdio: 'pipe' });

    // The breaker set also creates the BREAKER file
    if (i === breakerIndex) {
      fs.writeFileSync(path.join(tmpDir, 'BREAKER'), 'this causes test failure', 'utf-8');
      execSync('git add BREAKER', { cwd: tmpDir, stdio: 'pipe' });
    }

    execSync(`git commit -m "feat(${setName}): add ${setName} module"`, { cwd: tmpDir, stdio: 'pipe' });

    // Write MERGE-STATE.json for each set
    const setDir = path.join(tmpDir, '.planning', 'sets', setName);
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'MERGE-STATE.json'), JSON.stringify({
      setId: setName,
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    }, null, 2), 'utf-8');
  }

  execSync('git checkout main', { cwd: tmpDir, stdio: 'pipe' });

  return { tmpDir, setNames };
}

describe('getPreWaveCommit', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createGitProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns current HEAD hash', () => {
    const merge = require('./merge.cjs');
    const head = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    const result = merge.getPreWaveCommit(tmpDir);
    assert.equal(result, head);
  });
});

describe('bisectWave', { concurrency: 1 }, () => {
  let tmpDir, setNames;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('with single set returns that set as breaking (trivial case)', () => {
    const merge = require('./merge.cjs');
    // Create project where set-alpha is the breaker (index 0)
    const proj = createBisectionProject(0);
    tmpDir = proj.tmpDir;

    // First merge the single breaker set
    const preWaveCommit = merge.getPreWaveCommit(tmpDir);
    merge.mergeSet(tmpDir, 'set-alpha', 'main');

    const result = merge.bisectWave(tmpDir, 'main', ['set-alpha'], preWaveCommit);
    assert.equal(result.breakingSet, 'set-alpha');
    assert.equal(typeof result.iterations, 'number');
    assert.ok(result.iterations >= 1);
  });

  it('with two sets identifies the one that causes test failure', () => {
    const merge = require('./merge.cjs');
    // set-beta (index 1) is the breaker
    const proj = createBisectionProject(1);
    tmpDir = proj.tmpDir;

    const preWaveCommit = merge.getPreWaveCommit(tmpDir);
    // Merge both sets
    merge.mergeSet(tmpDir, 'set-alpha', 'main');
    merge.mergeSet(tmpDir, 'set-beta', 'main');

    const result = merge.bisectWave(tmpDir, 'main', ['set-alpha', 'set-beta'], preWaveCommit);
    assert.equal(result.breakingSet, 'set-beta');
  });

  it('preserves .planning/ directory after completion', () => {
    const merge = require('./merge.cjs');
    const proj = createBisectionProject(0);
    tmpDir = proj.tmpDir;

    // Write extra .planning data to ensure it's preserved
    const markerFile = path.join(tmpDir, '.planning', 'PRESERVE-MARKER.txt');
    fs.writeFileSync(markerFile, 'must survive bisection', 'utf-8');
    execSync('git add .planning/', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "add planning marker"', { cwd: tmpDir, stdio: 'pipe' });

    const preWaveCommit = merge.getPreWaveCommit(tmpDir);
    merge.mergeSet(tmpDir, 'set-alpha', 'main');

    merge.bisectWave(tmpDir, 'main', ['set-alpha'], preWaveCommit);

    // .planning/ should be restored
    assert.ok(fs.existsSync(markerFile), '.planning/ files should be preserved after bisection');
    const content = fs.readFileSync(markerFile, 'utf-8');
    assert.equal(content, 'must survive bisection');
  });

  it('updates MERGE-STATE.json with bisection results', () => {
    const merge = require('./merge.cjs');
    const proj = createBisectionProject(0);
    tmpDir = proj.tmpDir;

    // Ensure MERGE-STATE exists and commit it
    execSync('git add .planning/', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "add merge state"', { cwd: tmpDir, stdio: 'pipe' });

    const preWaveCommit = merge.getPreWaveCommit(tmpDir);
    merge.mergeSet(tmpDir, 'set-alpha', 'main');

    merge.bisectWave(tmpDir, 'main', ['set-alpha'], preWaveCommit);

    // Read the MERGE-STATE for the breaking set
    const state = merge.readMergeState(tmpDir, 'set-alpha');
    assert.ok(state, 'MERGE-STATE.json should exist for breaking set');
    assert.ok(state.bisection, 'bisection field should exist');
    assert.equal(state.bisection.triggered, true);
    assert.equal(state.bisection.breakingSet, 'set-alpha');
    assert.ok(state.bisection.iterations >= 1);
  });
});

// ────────────────────────────────────────────────────────────────
// Single-Set Rollback Tests (MERG-06)
// ────────────────────────────────────────────────────────────────

describe('revertSetMerge', { concurrency: 1 }, () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('successfully reverts a merge commit', () => {
    const merge = require('./merge.cjs');
    tmpDir = createGitProject();

    // Create .planning/sets with MERGE-STATE
    const setDir = path.join(tmpDir, '.planning', 'sets', 'auth-core');
    fs.mkdirSync(setDir, { recursive: true });

    // Merge the set to get a merge commit
    const mergeResult = merge.mergeSet(tmpDir, 'auth-core', 'main');
    assert.ok(mergeResult.merged, 'merge should succeed');

    // Write MERGE-STATE with the merge commit hash
    merge.writeMergeState(tmpDir, 'auth-core', {
      setId: 'auth-core',
      status: 'complete',
      mergeCommit: mergeResult.commitHash.trim(),
      lastUpdatedAt: new Date().toISOString(),
    });

    // Now revert it
    const result = merge.revertSetMerge(tmpDir, 'auth-core');
    assert.equal(result.reverted, true);
    assert.ok(result.revertCommit, 'should have revert commit hash');

    // Verify the file is gone (reverted)
    const tokenFile = path.join(tmpDir, 'src', 'auth', 'token.cjs');
    assert.ok(!fs.existsSync(tokenFile), 'merged file should be removed after revert');
  });

  it('returns error when mergeCommit missing in MERGE-STATE.json', () => {
    const merge = require('./merge.cjs');
    tmpDir = createGitProject();

    const setDir = path.join(tmpDir, '.planning', 'sets', 'auth-core');
    fs.mkdirSync(setDir, { recursive: true });

    // Write MERGE-STATE without mergeCommit
    merge.writeMergeState(tmpDir, 'auth-core', {
      setId: 'auth-core',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    });

    const result = merge.revertSetMerge(tmpDir, 'auth-core');
    assert.equal(result.reverted, false);
    assert.ok(result.reason, 'should have a reason');
    assert.ok(result.reason.includes('missing') || result.reason.includes('no merge commit'), 'reason should indicate missing commit');
  });

  it('handles conflict during revert gracefully', () => {
    const merge = require('./merge.cjs');
    tmpDir = createGitProject();

    const setDir = path.join(tmpDir, '.planning', 'sets', 'auth-core');
    fs.mkdirSync(setDir, { recursive: true });

    // Merge the set
    const mergeResult = merge.mergeSet(tmpDir, 'auth-core', 'main');
    assert.ok(mergeResult.merged);

    // Modify the merged file on main to create a conflict for revert
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'token.cjs'), '// modified after merge\nmodule.exports = { changed: true };', 'utf-8');
    execSync('git add src/auth/token.cjs', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "modify merged file"', { cwd: tmpDir, stdio: 'pipe' });

    merge.writeMergeState(tmpDir, 'auth-core', {
      setId: 'auth-core',
      status: 'complete',
      mergeCommit: mergeResult.commitHash.trim(),
      lastUpdatedAt: new Date().toISOString(),
    });

    // This may or may not conflict depending on git, but the function should handle it gracefully
    const result = merge.revertSetMerge(tmpDir, 'auth-core');
    assert.equal(typeof result.reverted, 'boolean', 'should return structured result');
    if (!result.reverted) {
      assert.ok(result.reason, 'failed revert should have a reason');
    }
  });
});

describe('detectCascadeImpact', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createMockProject();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns hasCascade=false for set with no dependents', () => {
    const merge = require('./merge.cjs');

    // Create DAG with no edges pointing to auth-core as a dependency
    const dagPath = path.join(tmpDir, '.planning', 'DAG.json');
    fs.writeFileSync(dagPath, JSON.stringify({
      nodes: [
        { id: 'auth-core', wave: 1, status: 'complete' },
        { id: 'api-routes', wave: 2, status: 'pending' },
      ],
      edges: [
        { from: 'auth-core', to: 'api-routes' },
      ],
      waves: { '1': { sets: ['auth-core'] }, '2': { sets: ['api-routes'] } },
      metadata: { totalSets: 2, totalWaves: 2 },
    }, null, 2), 'utf-8');

    // api-routes has NO merged state -- it's still pending
    const result = merge.detectCascadeImpact(tmpDir, 'auth-core');
    assert.equal(result.hasCascade, false, 'no cascade when dependents have not merged');
    assert.deepEqual(result.affectedSets, []);
  });

  it('returns hasCascade=true with affected sets for set with merged dependents', () => {
    const merge = require('./merge.cjs');

    const dagPath = path.join(tmpDir, '.planning', 'DAG.json');
    fs.writeFileSync(dagPath, JSON.stringify({
      nodes: [
        { id: 'auth-core', wave: 1, status: 'complete' },
        { id: 'api-routes', wave: 2, status: 'complete' },
      ],
      edges: [
        { from: 'auth-core', to: 'api-routes' },
      ],
      waves: { '1': { sets: ['auth-core'] }, '2': { sets: ['api-routes'] } },
      metadata: { totalSets: 2, totalWaves: 2 },
    }, null, 2), 'utf-8');

    // Write MERGE-STATE for api-routes showing it has merged
    merge.writeMergeState(tmpDir, 'api-routes', {
      setId: 'api-routes',
      status: 'complete',
      mergeCommit: 'abc123',
      lastUpdatedAt: new Date().toISOString(),
    });

    const result = merge.detectCascadeImpact(tmpDir, 'auth-core');
    assert.equal(result.hasCascade, true, 'cascade when dependent has merged');
    assert.ok(result.affectedSets.includes('api-routes'), 'api-routes should be in affected sets');
    assert.ok(result.recommendation, 'should provide a recommendation');
  });

  it('returns hasCascade=false when dependents have not merged yet', () => {
    const merge = require('./merge.cjs');

    const dagPath = path.join(tmpDir, '.planning', 'DAG.json');
    fs.writeFileSync(dagPath, JSON.stringify({
      nodes: [
        { id: 'auth-core', wave: 1, status: 'complete' },
        { id: 'api-routes', wave: 2, status: 'pending' },
        { id: 'ui-layer', wave: 2, status: 'pending' },
      ],
      edges: [
        { from: 'auth-core', to: 'api-routes' },
        { from: 'auth-core', to: 'ui-layer' },
      ],
      waves: { '1': { sets: ['auth-core'] }, '2': { sets: ['api-routes', 'ui-layer'] } },
      metadata: { totalSets: 3, totalWaves: 2 },
    }, null, 2), 'utf-8');

    // Write MERGE-STATE for dependents as pending (not merged)
    merge.writeMergeState(tmpDir, 'api-routes', {
      setId: 'api-routes',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    });
    merge.writeMergeState(tmpDir, 'ui-layer', {
      setId: 'ui-layer',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    });

    const result = merge.detectCascadeImpact(tmpDir, 'auth-core');
    assert.equal(result.hasCascade, false, 'no cascade when dependents are still pending');
    assert.deepEqual(result.affectedSets, []);
  });
});

// ────────────────────────────────────────────────────────────────
// Agent Integration Tests (MERG-01, MERG-02 completion)
// ────────────────────────────────────────────────────────────────

describe('integrateSemanticResults', () => {
  it('merges agent findings into detection.semantic', () => {
    const merge = require('./merge.cjs');

    const detectionResults = {
      textual: { hasConflicts: false, conflicts: [] },
      structural: { conflicts: [] },
      dependency: { conflicts: [] },
      api: { conflicts: [] },
      semantic: null,
    };

    const agentResults = {
      semantic_conflicts: [
        { description: 'Intent divergence on auth flow', sets: ['auth-core', 'api-routes'], confidence: 0.85 },
        { description: 'Contract behavioral mismatch', sets: ['auth-core'], confidence: 0.6 },
      ],
    };

    const result = merge.integrateSemanticResults(detectionResults, agentResults);

    // Should update semantic field
    assert.ok(result.semantic, 'semantic field should be populated');
    assert.equal(result.semantic.conflicts.length, 2, 'should have 2 semantic conflicts');
    assert.equal(result.semantic.conflicts[0].description, 'Intent divergence on auth flow');
    assert.equal(result.semantic.conflicts[1].confidence, 0.6);

    // Original detection results should not be mutated
    assert.equal(detectionResults.semantic, null, 'original should not be mutated');
  });
});

describe('applyAgentResolutions', () => {
  it('marks high-confidence resolutions as tier 3 applied', () => {
    const merge = require('./merge.cjs');

    const resolutions = [
      { conflict: 'auth-flow-conflict', tier: 2, resolved: false, confidence: 0.5 },
    ];

    const agentResults = {
      resolutions: [
        { conflict: 'auth-flow-conflict', resolution: 'merged both patterns', confidence: 0.9 },
      ],
    };

    const result = merge.applyAgentResolutions(resolutions, agentResults, 0.7);
    const authRes = result.find(r => r.conflict === 'auth-flow-conflict');
    assert.ok(authRes, 'should have auth resolution');
    assert.equal(authRes.tier, 3, 'high confidence should be tier 3');
    assert.equal(authRes.resolved, true, 'should be resolved');
    assert.ok(authRes.resolution, 'should have resolution text');
  });

  it('escalates low-confidence resolutions to tier 4', () => {
    const merge = require('./merge.cjs');

    const resolutions = [
      { conflict: 'complex-conflict', tier: 2, resolved: false, confidence: 0.3 },
    ];

    const agentResults = {
      resolutions: [
        { conflict: 'complex-conflict', resolution: 'attempt at merge', confidence: 0.4 },
      ],
    };

    const result = merge.applyAgentResolutions(resolutions, agentResults, 0.7);
    const complexRes = result.find(r => r.conflict === 'complex-conflict');
    assert.ok(complexRes, 'should have complex resolution');
    assert.equal(complexRes.tier, 4, 'low confidence should be tier 4');
    assert.equal(complexRes.resolved, false, 'should not be resolved');
    assert.ok(complexRes.escalation, 'should have escalation info');
  });

  it('uses default threshold of 0.7', () => {
    const merge = require('./merge.cjs');

    const resolutions = [
      { conflict: 'borderline', tier: 2, resolved: false, confidence: 0.5 },
    ];

    const agentResults = {
      resolutions: [
        { conflict: 'borderline', resolution: 'attempt', confidence: 0.65 },
      ],
    };

    // No threshold arg -- should use default 0.7
    const result = merge.applyAgentResolutions(resolutions, agentResults);
    const borderRes = result.find(r => r.conflict === 'borderline');
    assert.equal(borderRes.tier, 4, '0.65 should be below default 0.7 threshold');
  });

  it('respects custom threshold', () => {
    const merge = require('./merge.cjs');

    const resolutions = [
      { conflict: 'custom-threshold', tier: 2, resolved: false, confidence: 0.5 },
    ];

    const agentResults = {
      resolutions: [
        { conflict: 'custom-threshold', resolution: 'attempt', confidence: 0.55 },
      ],
    };

    // Custom threshold of 0.5 -- 0.55 >= 0.5 so should be tier 3
    const result = merge.applyAgentResolutions(resolutions, agentResults, 0.5);
    const customRes = result.find(r => r.conflict === 'custom-threshold');
    assert.equal(customRes.tier, 3, '0.55 should be at or above 0.5 threshold');
    assert.equal(customRes.resolved, true);
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Subagent Infrastructure: Schema Extension (MERGE-04)
// ────────────────────────────────────────────────────────────────

describe('MergeStateSchema v2.2 extensions', () => {
  it('backward compat: validates v2.1-era state without agentPhase fields', () => {
    const merge = require('./merge.cjs');
    const v21State = {
      setId: 'auth-core',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    };
    // Should not throw
    const result = merge.MergeStateSchema.parse(v21State);
    assert.equal(result.setId, 'auth-core');
    assert.equal(result.agentPhase1, undefined);
    assert.equal(result.agentPhase2, undefined);
    assert.equal(result.compressedResult, undefined);
  });

  it('accepts agentPhase1 with valid enum values', () => {
    const merge = require('./merge.cjs');
    for (const phase of ['idle', 'spawned', 'done', 'failed']) {
      const state = {
        setId: 'auth-core',
        status: 'resolving',
        agentPhase1: phase,
        lastUpdatedAt: new Date().toISOString(),
      };
      const result = merge.MergeStateSchema.parse(state);
      assert.equal(result.agentPhase1, phase);
    }
  });

  it('accepts agentPhase2 with per-conflict object map', () => {
    const merge = require('./merge.cjs');
    const state = {
      setId: 'auth-core',
      status: 'resolving',
      agentPhase2: { 'src/lib/auth.cjs': 'spawned', 'src/lib/db.cjs': 'done' },
      lastUpdatedAt: new Date().toISOString(),
    };
    const result = merge.MergeStateSchema.parse(state);
    assert.deepEqual(result.agentPhase2, { 'src/lib/auth.cjs': 'spawned', 'src/lib/db.cjs': 'done' });
  });

  it('accepts agentPhase2 with empty object (no conflicts tracked yet)', () => {
    const merge = require('./merge.cjs');
    const state = {
      setId: 'auth-core',
      status: 'resolving',
      agentPhase2: {},
      lastUpdatedAt: new Date().toISOString(),
    };
    const result = merge.MergeStateSchema.parse(state);
    assert.deepEqual(result.agentPhase2, {});
  });

  it('rejects agentPhase2 with bare string (must be object map)', () => {
    const merge = require('./merge.cjs');
    const state = {
      setId: 'auth-core',
      status: 'resolving',
      agentPhase2: 'done',
      lastUpdatedAt: new Date().toISOString(),
    };
    assert.throws(() => merge.MergeStateSchema.parse(state));
  });

  it('rejects invalid agentPhase1 values', () => {
    const merge = require('./merge.cjs');
    const state = {
      setId: 'auth-core',
      status: 'resolving',
      agentPhase1: 'bogus',
      lastUpdatedAt: new Date().toISOString(),
    };
    assert.throws(() => merge.MergeStateSchema.parse(state));
  });

  it('rejects agentPhase2 with invalid enum values in map', () => {
    const merge = require('./merge.cjs');
    const state = {
      setId: 'auth-core',
      status: 'resolving',
      agentPhase2: { 'a.js': 'bogus' },
      lastUpdatedAt: new Date().toISOString(),
    };
    assert.throws(() => merge.MergeStateSchema.parse(state));
  });

  it('accepts compressedResult with full object', () => {
    const merge = require('./merge.cjs');
    const state = {
      setId: 'auth-core',
      status: 'complete',
      compressedResult: {
        setId: 'auth-core',
        status: 'complete',
        conflictCounts: { L1: 2, L2: 1, L3: 0, L4: 0, L5: 1 },
        resolutionCounts: { T1: 1, T2: 1, T3: 0, escalated: 1 },
        commitSha: 'abc123f',
      },
      lastUpdatedAt: new Date().toISOString(),
    };
    const result = merge.MergeStateSchema.parse(state);
    assert.deepEqual(result.compressedResult.conflictCounts, { L1: 2, L2: 1, L3: 0, L4: 0, L5: 1 });
    assert.deepEqual(result.compressedResult.resolutionCounts, { T1: 1, T2: 1, T3: 0, escalated: 1 });
  });

  it('accepts compressedResult without optional commitSha', () => {
    const merge = require('./merge.cjs');
    const state = {
      setId: 'auth-core',
      status: 'resolving',
      compressedResult: {
        setId: 'auth-core',
        status: 'resolving',
        conflictCounts: { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 },
        resolutionCounts: { T1: 0, T2: 0, T3: 0, escalated: 0 },
      },
      lastUpdatedAt: new Date().toISOString(),
    };
    const result = merge.MergeStateSchema.parse(state);
    assert.equal(result.compressedResult.commitSha, undefined);
  });

  it('exports AgentPhaseEnum', () => {
    const merge = require('./merge.cjs');
    assert.ok(merge.AgentPhaseEnum, 'should export AgentPhaseEnum');
    // Verify it validates correctly
    assert.equal(merge.AgentPhaseEnum.parse('idle'), 'idle');
    assert.throws(() => merge.AgentPhaseEnum.parse('bogus'));
  });
});

describe('updateMergeState with agentPhase fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-agent-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates agentPhase1 via updateMergeState', () => {
    const merge = require('./merge.cjs');
    const initial = {
      setId: 'auth-core',
      status: 'resolving',
      lastUpdatedAt: new Date().toISOString(),
    };

    merge.writeMergeState(tmpDir, 'auth-core', initial);
    merge.updateMergeState(tmpDir, 'auth-core', { agentPhase1: 'spawned' });

    const result = merge.readMergeState(tmpDir, 'auth-core');
    assert.equal(result.agentPhase1, 'spawned');
    assert.equal(result.status, 'resolving');
  });

  it('updates agentPhase2 object map via updateMergeState', () => {
    const merge = require('./merge.cjs');
    const initial = {
      setId: 'auth-core',
      status: 'resolving',
      lastUpdatedAt: new Date().toISOString(),
    };

    merge.writeMergeState(tmpDir, 'auth-core', initial);
    merge.updateMergeState(tmpDir, 'auth-core', { agentPhase2: { 'src/a.cjs': 'spawned' } });

    const result = merge.readMergeState(tmpDir, 'auth-core');
    assert.deepEqual(result.agentPhase2, { 'src/a.cjs': 'spawned' });
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Subagent Infrastructure: compressResult (MERGE-05)
// ────────────────────────────────────────────────────────────────

describe('compressResult', () => {
  it('extracts correct counts from full MERGE-STATE with detection + resolution data', () => {
    const merge = require('./merge.cjs');
    const fullState = {
      setId: 'auth-core',
      status: 'complete',
      detection: {
        textual: { ran: true, conflicts: [
          { file: 'src/a.js', type: 'merge' },
          { file: 'src/b.js', type: 'merge' },
        ] },
        structural: { ran: true, conflicts: [
          { file: 'src/c.js', functions: ['foo'] },
        ] },
        dependency: { ran: true, conflicts: [] },
        api: { ran: true, conflicts: [
          { file: 'src/d.js', exports: ['bar'] },
        ] },
        semantic: { ran: true, conflicts: [
          { description: 'logic conflict', sets: ['auth-core'] },
        ] },
      },
      resolution: {
        tier1Count: 1,
        tier2Count: 1,
        tier3Count: 0,
        tier4Count: 0,
        escalatedConflicts: ['semantic conflict'],
        allResolved: false,
      },
      mergeCommit: 'abc123f',
      lastUpdatedAt: new Date().toISOString(),
    };

    const result = merge.compressResult(fullState);
    assert.equal(result.setId, 'auth-core');
    assert.equal(result.status, 'complete');
    assert.deepEqual(result.conflictCounts, { L1: 2, L2: 1, L3: 0, L4: 1, L5: 1 });
    assert.deepEqual(result.resolutionCounts, { T1: 1, T2: 1, T3: 0, escalated: 1 });
    assert.equal(result.commitSha, 'abc123f');
  });

  it('produces JSON under ~100 tokens (JSON.stringify().length / 4 < 120)', () => {
    const merge = require('./merge.cjs');
    const fullState = {
      setId: 'auth-core',
      status: 'complete',
      detection: {
        textual: { ran: true, conflicts: [
          { file: 'src/a.js', type: 'merge' },
          { file: 'src/b.js', type: 'merge' },
        ] },
        structural: { ran: true, conflicts: [
          { file: 'src/c.js', functions: ['foo'] },
        ] },
        dependency: { ran: true, conflicts: [] },
        api: { ran: true, conflicts: [] },
        semantic: { ran: true, conflicts: [
          { description: 'logic conflict', sets: ['a'] },
        ] },
      },
      resolution: {
        tier1Count: 2,
        tier2Count: 1,
        tier3Count: 0,
        tier4Count: 0,
        escalatedConflicts: [],
        allResolved: true,
      },
      mergeCommit: 'def456g',
      lastUpdatedAt: new Date().toISOString(),
    };

    const result = merge.compressResult(fullState);
    const tokenEstimate = Math.ceil(JSON.stringify(result).length / 4);
    assert.ok(tokenEstimate < 120, `Token estimate ${tokenEstimate} should be under 120`);
  });

  it('handles MERGE-STATE with no detection/resolution (zero counts)', () => {
    const merge = require('./merge.cjs');
    const minimalState = {
      setId: 'payment-api',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    };

    const result = merge.compressResult(minimalState);
    assert.equal(result.setId, 'payment-api');
    assert.equal(result.status, 'pending');
    assert.deepEqual(result.conflictCounts, { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 });
    assert.deepEqual(result.resolutionCounts, { T1: 0, T2: 0, T3: 0, escalated: 0 });
    assert.equal(result.commitSha, null);
  });

  it('8-set compressed result budget stays under ~800 tokens total', () => {
    const merge = require('./merge.cjs');
    const sets = [];
    for (let i = 0; i < 8; i++) {
      sets.push(merge.compressResult({
        setId: `set-${i}-with-longer-name`,
        status: 'complete',
        detection: {
          textual: { ran: true, conflicts: [
            { file: `src/file${i}.js`, type: 'merge' },
          ] },
          structural: { ran: true, conflicts: [] },
          dependency: { ran: true, conflicts: [] },
          api: { ran: true, conflicts: [] },
          semantic: { ran: true, conflicts: [] },
        },
        resolution: {
          tier1Count: 1,
          tier2Count: 0,
          tier3Count: 0,
          tier4Count: 0,
          escalatedConflicts: [],
          allResolved: true,
        },
        mergeCommit: `commit${i}`,
        lastUpdatedAt: new Date().toISOString(),
      }));
    }

    const totalTokens = Math.ceil(JSON.stringify(sets).length / 4);
    assert.ok(totalTokens < 800, `Total tokens ${totalTokens} for 8 sets should be under 800`);
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Subagent Infrastructure: parseSetMergerReturn (MERGE-04)
// ────────────────────────────────────────────────────────────────

describe('parseSetMergerReturn', () => {
  it('returns BLOCKED with reason when no RAPID:RETURN marker found', () => {
    const merge = require('./merge.cjs');
    const result = merge.parseSetMergerReturn('This is just some text with no marker');
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason, 'should have a reason');
    assert.ok(result.reason.includes('marker') || result.reason.includes('RAPID:RETURN'),
      'reason should mention missing marker');
  });

  it('returns BLOCKED with reason when JSON is malformed', () => {
    const merge = require('./merge.cjs');
    const result = merge.parseSetMergerReturn('<!-- RAPID:RETURN {invalid json here -->');
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason, 'should have a reason');
  });

  it('returns BLOCKED when data.status is missing', () => {
    const merge = require('./merge.cjs');
    const result = merge.parseSetMergerReturn('<!-- RAPID:RETURN {"foo": "bar"} -->');
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason.includes('status'), 'reason should mention missing status');
  });

  it('returns BLOCKED with empty string input', () => {
    const merge = require('./merge.cjs');
    const result = merge.parseSetMergerReturn('');
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason);
  });

  it('accepts CHECKPOINT status and returns { status: CHECKPOINT, data }', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'CHECKPOINT',
      handoff_done: 'Resolved 3 of 5 conflicts',
      handoff_remaining: '2 conflicts pending',
      handoff_resume: 'Continue from conflict 4',
    };
    const result = merge.parseSetMergerReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'CHECKPOINT');
    assert.deepEqual(result.data, returnData);
  });

  it('accepts COMPLETE status with semantic_conflicts/resolutions/escalations arrays', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'COMPLETE',
      semantic_conflicts: [{ description: 'logic issue', sets: ['a', 'b'], confidence: 0.9 }],
      resolutions: [{ file: 'src/a.js', original_conflict: 'merge', resolution_summary: 'kept both', confidence: 0.8, applied: true }],
      escalations: [{ file: 'src/b.js', conflict_description: 'semantic', reason: 'low confidence', confidence: 0.3, proposed_resolution: 'manual review' }],
      all_resolved: true,
    };
    const result = merge.parseSetMergerReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'COMPLETE');
    assert.ok(result.data);
    assert.ok(Array.isArray(result.data.semantic_conflicts));
    assert.ok(Array.isArray(result.data.resolutions));
    assert.ok(Array.isArray(result.data.escalations));
  });

  it('handles loose data (missing optional arrays like escalations) without throwing', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'COMPLETE',
      semantic_conflicts: [],
      resolutions: [],
      // escalations intentionally missing
      all_resolved: true,
    };
    const result = merge.parseSetMergerReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'COMPLETE');
    assert.ok(result.data);
  });

  it('returns BLOCKED when semantic_conflicts is not an array', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'COMPLETE',
      semantic_conflicts: 'not an array',
      resolutions: [],
    };
    const result = merge.parseSetMergerReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason.includes('semantic_conflicts'), 'reason should mention the invalid field');
  });

  it('returns BLOCKED when resolutions is not an array', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'COMPLETE',
      semantic_conflicts: [],
      resolutions: 'not an array',
    };
    const result = merge.parseSetMergerReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason.includes('resolutions'), 'reason should mention the invalid field');
  });

  it('returns BLOCKED when escalations is not an array (when present)', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'COMPLETE',
      semantic_conflicts: [],
      resolutions: [],
      escalations: { not: 'an array' },
    };
    const result = merge.parseSetMergerReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason.includes('escalations'), 'reason should mention the invalid field');
  });

  it('returns BLOCKED status when merger returns BLOCKED', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'BLOCKED',
      reason: 'Cannot access worktree',
    };
    const result = merge.parseSetMergerReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason);
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Subagent Infrastructure: prepareMergerContext (MERGE-04)
// ────────────────────────────────────────────────────────────────

describe('prepareMergerContext', () => {
  it('produces string containing set name and file paths for typical set', () => {
    const merge = require('./merge.cjs');
    const contextData = {
      setId: 'auth-core',
      worktreePath: '/tmp/worktrees/auth-core',
      files: [
        { path: 'src/auth/token.cjs', summary: 'Token generation and verification' },
        { path: 'src/auth/verify.cjs', summary: 'Middleware for route protection' },
        { path: 'src/auth/refresh.cjs', summary: 'Refresh token rotation' },
        { path: 'src/types/user.ts', summary: 'User type definitions' },
        { path: 'CONTRACT.json', summary: '3 interfaces, 2 with changes' },
      ],
      conflicts: [
        { file: 'src/auth/token.cjs', type: 'textual', detail: 'Merge conflict in lines 20-35' },
        { file: 'src/auth/verify.cjs', type: 'structural', detail: 'Function signature mismatch' },
        { file: 'src/types/user.ts', type: 'api', detail: 'Export type changed' },
      ],
      contractPath: '.planning/sets/auth-core/CONTRACT.json',
    };

    const result = merge.prepareMergerContext(contextData);
    assert.equal(typeof result, 'string');
    assert.ok(result.includes('auth-core'), 'should contain set name');
    assert.ok(result.includes('src/auth/token.cjs'), 'should contain file path');
    assert.ok(result.includes('Token generation'), 'should contain file summary');
    assert.ok(result.includes('[textual]'), 'should contain conflict type');
    assert.ok(result.includes('CONTRACT.json'), 'should reference contract');
  });

  it('token estimate under 1000 for typical set (5 files, 3 conflicts)', () => {
    const merge = require('./merge.cjs');
    const contextData = {
      setId: 'auth-core',
      worktreePath: '/tmp/worktrees/auth-core',
      files: [
        { path: 'src/auth/token.cjs', summary: 'Token generation and verification' },
        { path: 'src/auth/verify.cjs', summary: 'Middleware for route protection' },
        { path: 'src/auth/refresh.cjs', summary: 'Refresh token rotation' },
        { path: 'src/types/user.ts', summary: 'User type definitions' },
        { path: 'CONTRACT.json', summary: '3 interfaces, 2 with changes' },
      ],
      conflicts: [
        { file: 'src/auth/token.cjs', type: 'textual', detail: 'Merge conflict in lines 20-35' },
        { file: 'src/auth/verify.cjs', type: 'structural', detail: 'Function signature mismatch' },
        { file: 'src/types/user.ts', type: 'api', detail: 'Export type changed' },
      ],
      contractPath: '.planning/sets/auth-core/CONTRACT.json',
    };

    const result = merge.prepareMergerContext(contextData);
    const tokenEstimate = Math.ceil(result.length / 4);
    assert.ok(tokenEstimate < 1000, `Token estimate ${tokenEstimate} should be under 1000`);
  });

  it('produces valid string with "Conflicts (0 total)" for empty conflicts', () => {
    const merge = require('./merge.cjs');
    const contextData = {
      setId: 'clean-set',
      worktreePath: '/tmp/worktrees/clean-set',
      files: [
        { path: 'src/clean/main.cjs', summary: 'Main entry point' },
      ],
      conflicts: [],
    };

    const result = merge.prepareMergerContext(contextData);
    assert.ok(result.includes('Conflicts (0 total)'), 'should show zero conflicts');
    assert.ok(result.includes('clean-set'), 'should contain set name');
  });

  it('truncates at 15 files with overflow note for large file list', () => {
    const merge = require('./merge.cjs');
    const files = [];
    for (let i = 0; i < 20; i++) {
      files.push({ path: `src/mod${i}/file.cjs`, summary: `Module ${i} code` });
    }
    const contextData = {
      setId: 'large-set',
      worktreePath: '/tmp/worktrees/large-set',
      files,
      conflicts: [{ file: 'src/mod0/file.cjs', type: 'textual' }],
    };

    const result = merge.prepareMergerContext(contextData);
    assert.ok(result.includes('Files (20 total)'), 'should show total file count');
    assert.ok(result.includes('and 5 more files'), 'should show overflow note');
    assert.ok(!result.includes('src/mod15/file.cjs'), 'should not contain file 16');
    assert.ok(result.includes('src/mod14/file.cjs'), 'should contain file 15');
  });

  it('falls back to "(no summary)" when file summaries are missing', () => {
    const merge = require('./merge.cjs');
    const contextData = {
      setId: 'no-summary-set',
      worktreePath: '/tmp/worktrees/no-summary-set',
      files: [
        { path: 'src/a.cjs' },
        { path: 'src/b.cjs' },
      ],
      conflicts: [],
    };

    const result = merge.prepareMergerContext(contextData);
    assert.ok(result.includes('(no summary)'), 'should show no summary fallback');
  });

  it('token estimate under 1000 for set with 10 files', () => {
    const merge = require('./merge.cjs');
    const files = [];
    for (let i = 0; i < 10; i++) {
      files.push({ path: `src/component${i}/index.cjs`, summary: `Component ${i} with standard implementation` });
    }
    const contextData = {
      setId: 'medium-set',
      worktreePath: '/tmp/worktrees/medium-set',
      files,
      conflicts: [
        { file: 'src/component0/index.cjs', type: 'textual', detail: 'Line conflict at 45' },
        { file: 'src/component3/index.cjs', type: 'structural', detail: 'Function changed' },
      ],
      contractPath: '.planning/sets/medium-set/CONTRACT.json',
    };

    const result = merge.prepareMergerContext(contextData);
    const tokenEstimate = Math.ceil(result.length / 4);
    assert.ok(tokenEstimate < 1000, `Token estimate ${tokenEstimate} for 10-file set should be under 1000`);
  });

  it('shows "none" for contract reference when contractPath is not provided', () => {
    const merge = require('./merge.cjs');
    const contextData = {
      setId: 'no-contract-set',
      worktreePath: '/tmp/worktrees/no-contract-set',
      files: [{ path: 'src/a.cjs', summary: 'File A' }],
      conflicts: [],
    };

    const result = merge.prepareMergerContext(contextData);
    assert.ok(result.includes('Contract: none'), 'should show none for missing contract');
  });

  it('shows conflict detail fallback when detail is missing', () => {
    const merge = require('./merge.cjs');
    const contextData = {
      setId: 'fallback-set',
      worktreePath: '/tmp/worktrees/fallback-set',
      files: [{ path: 'src/a.cjs', summary: 'File A' }],
      conflicts: [
        { file: 'src/a.cjs', type: 'textual' },
      ],
    };

    const result = merge.prepareMergerContext(contextData);
    assert.ok(result.includes('(details in worktree)'), 'should show fallback for missing detail');
  });
});

// ────────────────────────────────────────────────────────────────
// Module exports check
// ────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────
// v2.2 Task 1: Build-agents registration for set-merger (MERGE-01)
// ────────────────────────────────────────────────────────────────

describe('build-agents set-merger registration', () => {
  // These tests validate that rapid-tools.cjs has correct set-merger entries
  // in all four build-agents maps, and that the generated agent is well-formed.

  it('ROLE_CORE_MAP has set-merger with correct core modules', () => {
    // We test by running build-agents and checking the generated file
    const agentPath = path.join(__dirname, '..', '..', 'agents', 'rapid-set-merger.md');
    assert.ok(fs.existsSync(agentPath), 'rapid-set-merger.md should exist after build-agents');

    const content = fs.readFileSync(agentPath, 'utf-8');
    // Core modules: identity, conventions, returns
    assert.ok(content.includes('<identity>'), 'should contain identity core module');
    assert.ok(content.includes('<returns>'), 'should contain returns core module');
    assert.ok(content.includes('<conventions>'), 'should contain conventions core module');
    // Should NOT contain state-access or context-loading
    assert.ok(!content.includes('<state-access>'), 'should NOT contain state-access core module');
    assert.ok(!content.includes('<context-loading>'), 'should NOT contain context-loading core module');
  });

  it('ROLE_TOOLS has set-merger with Read, Write, Edit, Bash, Grep, Glob', () => {
    const agentPath = path.join(__dirname, '..', '..', 'agents', 'rapid-set-merger.md');
    const content = fs.readFileSync(agentPath, 'utf-8');
    // YAML frontmatter should have tools line
    assert.ok(content.includes('tools: Read, Write, Edit, Bash, Grep, Glob'), 'should have correct tools in frontmatter');
  });

  it('ROLE_COLORS has set-merger with green', () => {
    const agentPath = path.join(__dirname, '..', '..', 'agents', 'rapid-set-merger.md');
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('color: green'), 'should have green color in frontmatter');
  });

  it('ROLE_DESCRIPTIONS has set-merger containing "set merger"', () => {
    const agentPath = path.join(__dirname, '..', '..', 'agents', 'rapid-set-merger.md');
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('set merger'), 'description should contain "set merger"');
  });

  it('generated agent contains "Do NOT execute git merge" rule', () => {
    const agentPath = path.join(__dirname, '..', '..', 'agents', 'rapid-set-merger.md');
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('Do NOT execute git merge'), 'should contain git merge prohibition');
  });

  it('generated agent contains "Do NOT use AskUserQuestion" rule', () => {
    const agentPath = path.join(__dirname, '..', '..', 'agents', 'rapid-set-merger.md');
    const content = fs.readFileSync(agentPath, 'utf-8');
    assert.ok(content.includes('Do NOT use AskUserQuestion'), 'should contain AskUserQuestion prohibition');
  });

  it('generated agent has valid YAML frontmatter', () => {
    const agentPath = path.join(__dirname, '..', '..', 'agents', 'rapid-set-merger.md');
    const content = fs.readFileSync(agentPath, 'utf-8');
    // Should start with GENERATED comment then ---
    assert.ok(content.includes('---\nname: rapid-set-merger'), 'should have name in frontmatter');
    assert.ok(content.includes('model: inherit'), 'should have model: inherit');
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Task 2: --agent-phase flag on update-status + prepare-context CLI (MERGE-01)
// ────────────────────────────────────────────────────────────────

describe('update-status --agent-phase CLI flag', () => {
  let tmpDir;
  const RAPID_TOOLS = path.join(__dirname, '..', 'bin', 'rapid-tools.cjs');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-agent-phase-'));
    // Create minimal .planning structure
    const setsDir = path.join(tmpDir, '.planning', 'sets', 'auth-core');
    fs.mkdirSync(setsDir, { recursive: true });
    fs.writeFileSync(path.join(setsDir, 'DEFINITION.md'), '# Set: auth-core\n## Scope\nAuth\n## File Ownership\n- src/auth.cjs\n## Tasks\n1. Auth\n## Wave Assignment\nWave: 1\n## Acceptance Criteria\n- works\n');
    fs.writeFileSync(path.join(setsDir, 'CONTRACT.json'), '{"exports":{"functions":[],"types":[]}}');
    // Create worktrees dir and registry
    const wtDir = path.join(tmpDir, '.planning', 'worktrees');
    fs.mkdirSync(wtDir, { recursive: true });
    fs.writeFileSync(path.join(wtDir, 'registry.json'), JSON.stringify({
      worktrees: {
        'auth-core': { path: 'worktrees/auth-core', branch: 'rapid/auth-core', mergeStatus: 'pending' },
      },
    }));
    // Create config.json
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ mode: 'yolo' }));
    // Initialize MERGE-STATE
    const merge = require('./merge.cjs');
    merge.writeMergeState(tmpDir, 'auth-core', {
      setId: 'auth-core',
      status: 'pending',
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('--agent-phase spawned writes agentPhase1=spawned to MERGE-STATE', () => {
    execSync(`node "${RAPID_TOOLS}" merge update-status auth-core resolving --agent-phase spawned`, {
      cwd: tmpDir, stdio: 'pipe',
    });
    const merge = require('./merge.cjs');
    const state = merge.readMergeState(tmpDir, 'auth-core');
    assert.equal(state.agentPhase1, 'spawned');
    assert.equal(state.status, 'resolving');
  });

  it('--agent-phase done writes agentPhase1=done to MERGE-STATE', () => {
    execSync(`node "${RAPID_TOOLS}" merge update-status auth-core resolving --agent-phase done`, {
      cwd: tmpDir, stdio: 'pipe',
    });
    const merge = require('./merge.cjs');
    const state = merge.readMergeState(tmpDir, 'auth-core');
    assert.equal(state.agentPhase1, 'done');
  });

  it('--agent-phase failed writes agentPhase1=failed to MERGE-STATE', () => {
    execSync(`node "${RAPID_TOOLS}" merge update-status auth-core resolving --agent-phase failed`, {
      cwd: tmpDir, stdio: 'pipe',
    });
    const merge = require('./merge.cjs');
    const state = merge.readMergeState(tmpDir, 'auth-core');
    assert.equal(state.agentPhase1, 'failed');
  });

  it('without --agent-phase does NOT modify agentPhase1 (backward compatible)', () => {
    execSync(`node "${RAPID_TOOLS}" merge update-status auth-core detecting`, {
      cwd: tmpDir, stdio: 'pipe',
    });
    const merge = require('./merge.cjs');
    const state = merge.readMergeState(tmpDir, 'auth-core');
    assert.equal(state.agentPhase1, undefined);
    assert.equal(state.status, 'detecting');
  });

  it('invalid --agent-phase value (bogus) returns error', () => {
    assert.throws(() => {
      execSync(`node "${RAPID_TOOLS}" merge update-status auth-core resolving --agent-phase bogus`, {
        cwd: tmpDir, stdio: 'pipe',
      });
    }, /Invalid agent-phase|invalid|error/i);
  });
});

describe('merge prepare-context CLI subcommand', () => {
  let tmpDir;
  const RAPID_TOOLS = path.join(__dirname, '..', 'bin', 'rapid-tools.cjs');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-prepare-ctx-'));
    // Create minimal .planning structure
    const setsDir = path.join(tmpDir, '.planning', 'sets', 'auth-core');
    fs.mkdirSync(setsDir, { recursive: true });
    fs.writeFileSync(path.join(setsDir, 'DEFINITION.md'), '# Set: auth-core\n## Scope\nAuth\n## File Ownership\n- src/auth.cjs\n## Tasks\n1. Auth\n## Wave Assignment\nWave: 1\n## Acceptance Criteria\n- works\n');
    fs.writeFileSync(path.join(setsDir, 'CONTRACT.json'), '{"exports":{"functions":[],"types":[]}}');
    // Create worktrees dir and registry
    const wtDir = path.join(tmpDir, '.planning', 'worktrees');
    fs.mkdirSync(wtDir, { recursive: true });
    fs.writeFileSync(path.join(wtDir, 'registry.json'), JSON.stringify({
      worktrees: {
        'auth-core': { path: 'worktrees/auth-core', branch: 'rapid/auth-core', mergeStatus: 'pending' },
      },
    }));
    // Create config.json
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ mode: 'yolo' }));
    // Initialize MERGE-STATE with some detection results
    const merge = require('./merge.cjs');
    merge.writeMergeState(tmpDir, 'auth-core', {
      setId: 'auth-core',
      status: 'detecting',
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      detection: {
        textual: { ran: true, conflicts: [{ file: 'src/auth.cjs', type: 'merge', detail: 'conflict in auth module' }] },
        structural: { ran: true, conflicts: [] },
        dependency: { ran: true, conflicts: [] },
        api: { ran: true, conflicts: [] },
      },
    });
    // Initialize git repo (needed for getChangedFiles)
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# test');
    execSync('git add README.md', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    try { execSync('git branch -m main', { cwd: tmpDir, stdio: 'pipe' }); } catch { /* ok */ }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('outputs JSON with briefing string for valid set name', () => {
    const out = execSync(`node "${RAPID_TOOLS}" merge prepare-context auth-core`, {
      cwd: tmpDir, encoding: 'utf-8',
    });
    // Parse last line -- strip [RAPID] prefix if present
    const lines = out.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const jsonStr = lastLine.replace(/^\[RAPID\]\s*/, '');
    const result = JSON.parse(jsonStr);
    assert.equal(result.setName, 'auth-core');
    assert.ok(typeof result.briefing === 'string', 'briefing should be a string');
    assert.ok(result.briefing.includes('auth-core'), 'briefing should mention set name');
    assert.ok(typeof result.tokenEstimate === 'number', 'should have tokenEstimate');
  });

  it('exits with error for missing set name', () => {
    assert.throws(() => {
      execSync(`node "${RAPID_TOOLS}" merge prepare-context`, {
        cwd: tmpDir, stdio: 'pipe',
      });
    }, /error|Usage/i);
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Phase 35: routeEscalation (MERGE-06)
// ────────────────────────────────────────────────────────────────

describe('routeEscalation', () => {
  it('routes confidence 0.2 (no API flag) to human-direct', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/foo.cjs', confidence: 0.2 };
    const mergeState = {};
    assert.equal(merge.routeEscalation(escalation, mergeState), 'human-direct');
  });

  it('routes confidence 0.5 (no API flag) to resolver-agent', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/foo.cjs', confidence: 0.5 };
    const mergeState = {};
    assert.equal(merge.routeEscalation(escalation, mergeState), 'resolver-agent');
  });

  it('routes confidence 0.8 (no API flag) to resolver-agent (upper bound inclusive)', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/foo.cjs', confidence: 0.8 };
    const mergeState = {};
    assert.equal(merge.routeEscalation(escalation, mergeState), 'resolver-agent');
  });

  it('routes confidence 0.85 (no API flag) to auto-accept', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/foo.cjs', confidence: 0.85 };
    const mergeState = {};
    assert.equal(merge.routeEscalation(escalation, mergeState), 'auto-accept');
  });

  it('routes confidence 0.5 with API-signature conflict to human-api-gate', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/api.cjs', confidence: 0.5 };
    const mergeState = {
      detection: {
        api: { ran: true, conflicts: [{ file: 'src/lib/api.cjs', exports: ['doThing'] }] },
      },
    };
    assert.equal(merge.routeEscalation(escalation, mergeState), 'human-api-gate');
  });

  it('routes confidence 0.1 with API-signature conflict to human-api-gate (API rule wins over low confidence)', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/api.cjs', confidence: 0.1 };
    const mergeState = {
      detection: {
        api: { ran: true, conflicts: [{ file: 'src/lib/api.cjs', exports: ['doThing'] }] },
      },
    };
    assert.equal(merge.routeEscalation(escalation, mergeState), 'human-api-gate');
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Phase 35: isApiSignatureConflict (MERGE-06)
// ────────────────────────────────────────────────────────────────

describe('isApiSignatureConflict', () => {
  it('returns true when file is in detection.api.conflicts', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/api.cjs' };
    const mergeState = {
      detection: {
        api: { ran: true, conflicts: [{ file: 'src/lib/api.cjs', exports: ['doThing'] }] },
      },
    };
    assert.equal(merge.isApiSignatureConflict(escalation, mergeState), true);
  });

  it('returns false when file is NOT in detection.api.conflicts', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/other.cjs' };
    const mergeState = {
      detection: {
        api: { ran: true, conflicts: [{ file: 'src/lib/api.cjs', exports: ['doThing'] }] },
      },
    };
    assert.equal(merge.isApiSignatureConflict(escalation, mergeState), false);
  });

  it('returns false when mergeState has no detection data', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/api.cjs' };
    const mergeState = {};
    assert.equal(merge.isApiSignatureConflict(escalation, mergeState), false);
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Phase 35: generateConflictId (MERGE-06)
// ────────────────────────────────────────────────────────────────

describe('generateConflictId', () => {
  it('returns file path as ID when escalation has file field', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/auth.cjs' };
    const result = merge.generateConflictId(escalation, 0, new Set());
    assert.equal(result, 'src/lib/auth.cjs');
  });

  it('returns conflict-{index} when escalation has no file field', () => {
    const merge = require('./merge.cjs');
    const escalation = { reason: 'some reason' };
    const result = merge.generateConflictId(escalation, 3, new Set());
    assert.equal(result, 'conflict-3');
  });

  it('appends :1, :2 suffix for duplicate file paths', () => {
    const merge = require('./merge.cjs');
    const escalation = { file: 'src/lib/auth.cjs' };
    const existingIds = new Set(['src/lib/auth.cjs']);
    const result1 = merge.generateConflictId(escalation, 1, existingIds);
    assert.equal(result1, 'src/lib/auth.cjs:1');

    existingIds.add('src/lib/auth.cjs:1');
    const result2 = merge.generateConflictId(escalation, 2, existingIds);
    assert.equal(result2, 'src/lib/auth.cjs:2');
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Phase 35: prepareResolverContext (MERGE-06)
// ────────────────────────────────────────────────────────────────

describe('prepareResolverContext', () => {
  it('produces string containing conflict file path, worktree path, and set ID', () => {
    const merge = require('./merge.cjs');
    const contextData = {
      conflictId: 'src/lib/auth.cjs',
      file: 'src/lib/auth.cjs',
      worktreePath: '/tmp/worktrees/auth-core',
      setId: 'auth-core',
      escalation: {
        file: 'src/lib/auth.cjs',
        confidence: 0.5,
        reason: 'Semantic overlap in auth logic',
        proposed_resolution: 'Merge both auth middlewares',
      },
      mergerAnalysis: 'The set-merger found overlapping authentication patterns in both sets.',
      contextPaths: {
        setAContext: '.planning/sets/auth-core/CONTEXT.md',
        setBContext: '.planning/sets/api-routes/CONTEXT.md',
      },
    };

    const result = merge.prepareResolverContext(contextData);
    assert.equal(typeof result, 'string');
    assert.ok(result.includes('src/lib/auth.cjs'), 'should contain conflict file path');
    assert.ok(result.includes('/tmp/worktrees/auth-core'), 'should contain worktree path');
    assert.ok(result.includes('auth-core'), 'should contain set ID');
    assert.ok(result.includes('Set-Merger Analysis'), 'should have Set-Merger Analysis section');
    assert.ok(result.includes('overlapping authentication'), 'should contain merger analysis text');
    assert.ok(result.includes('Original Escalation'), 'should have Original Escalation section');
    assert.ok(result.includes('0.5'), 'should contain escalation confidence');
    assert.ok(result.includes('Semantic overlap'), 'should contain escalation reason');
    assert.ok(result.includes('Context References'), 'should have Context References section');
    assert.ok(result.includes('CONTEXT.md'), 'should reference CONTEXT.md paths');
    assert.ok(result.includes('git log'), 'should include git log instruction');
  });

  it('truncates long analysis text to keep under token budget', () => {
    const merge = require('./merge.cjs');
    // Create a very long analysis string (over 800 tokens ~ 3200 chars)
    const longAnalysis = 'A'.repeat(4000);
    const contextData = {
      conflictId: 'src/lib/auth.cjs',
      file: 'src/lib/auth.cjs',
      worktreePath: '/tmp/worktrees/auth-core',
      setId: 'auth-core',
      escalation: {
        file: 'src/lib/auth.cjs',
        confidence: 0.5,
        reason: 'Overlap',
        proposed_resolution: 'Merge',
      },
      mergerAnalysis: longAnalysis,
      contextPaths: {
        setAContext: '.planning/sets/a/CONTEXT.md',
        setBContext: '.planning/sets/b/CONTEXT.md',
      },
    };

    const result = merge.prepareResolverContext(contextData);
    // The full result should not contain the full 4000-char analysis
    assert.ok(!result.includes(longAnalysis), 'should truncate long analysis');
    assert.ok(result.includes('[truncated]'), 'should indicate truncation');
  });

  it('includes L4 API detection data when available', () => {
    const merge = require('./merge.cjs');
    const contextData = {
      conflictId: 'src/lib/api.cjs',
      file: 'src/lib/api.cjs',
      worktreePath: '/tmp/worktrees/auth-core',
      setId: 'auth-core',
      escalation: {
        file: 'src/lib/api.cjs',
        confidence: 0.6,
        reason: 'Export change',
        proposed_resolution: 'Keep both',
      },
      mergerAnalysis: 'API export conflict detected.',
      contextPaths: {
        setAContext: '.planning/sets/a/CONTEXT.md',
        setBContext: '.planning/sets/b/CONTEXT.md',
      },
      apiDetection: { file: 'src/lib/api.cjs', exports: ['doThing', 'otherThing'] },
    };

    const result = merge.prepareResolverContext(contextData);
    assert.ok(result.includes('API Detection'), 'should have API Detection section');
    assert.ok(result.includes('doThing'), 'should include API detection details');
  });

  it('shows "No API conflicts" when apiDetection is absent', () => {
    const merge = require('./merge.cjs');
    const contextData = {
      conflictId: 'src/lib/auth.cjs',
      file: 'src/lib/auth.cjs',
      worktreePath: '/tmp/worktrees/auth-core',
      setId: 'auth-core',
      escalation: {
        file: 'src/lib/auth.cjs',
        confidence: 0.5,
        reason: 'Overlap',
        proposed_resolution: 'Merge',
      },
      mergerAnalysis: 'Analysis text.',
      contextPaths: {
        setAContext: '.planning/sets/a/CONTEXT.md',
        setBContext: '.planning/sets/b/CONTEXT.md',
      },
    };

    const result = merge.prepareResolverContext(contextData);
    assert.ok(result.includes('No API conflicts for this file'), 'should indicate no API conflicts');
  });
});

// ────────────────────────────────────────────────────────────────
// v2.2 Phase 35: parseConflictResolverReturn (MERGE-06)
// ────────────────────────────────────────────────────────────────

describe('parseConflictResolverReturn', () => {
  it('returns COMPLETE with data for valid COMPLETE return', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'COMPLETE',
      conflict_id: 'src/lib/auth.cjs',
      strategies_tried: [
        { approach: 'preserve-both', confidence: 0.45, reason: 'semantic overlap' },
        { approach: 'hybrid-merge', confidence: 0.81, reason: 'combines changes' },
      ],
      selected_strategy: 'hybrid-merge',
      resolution_summary: 'Combined both sets changes',
      confidence: 0.81,
      files_modified: ['src/lib/auth.cjs'],
      applied: true,
    };
    const result = merge.parseConflictResolverReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'COMPLETE');
    assert.ok(result.data);
    assert.equal(result.data.confidence, 0.81);
    assert.equal(result.data.selected_strategy, 'hybrid-merge');
  });

  it('returns BLOCKED with reason for BLOCKED return', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'BLOCKED',
      reason: 'Cannot resolve: both sets change return type contract',
    };
    const result = merge.parseConflictResolverReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason.includes('Cannot resolve') || result.reason.includes('BLOCKED'));
  });

  it('returns BLOCKED for malformed output (no RAPID:RETURN marker)', () => {
    const merge = require('./merge.cjs');
    const result = merge.parseConflictResolverReturn('This is just some text without a marker');
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason);
  });

  it('returns BLOCKED when status field is missing', () => {
    const merge = require('./merge.cjs');
    const result = merge.parseConflictResolverReturn('<!-- RAPID:RETURN {"foo": "bar"} -->');
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason.includes('status') || result.reason.includes('Missing'));
  });

  it('returns BLOCKED when COMPLETE has missing confidence field', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'COMPLETE',
      conflict_id: 'src/lib/auth.cjs',
      strategies_tried: [],
      selected_strategy: 'hybrid-merge',
      resolution_summary: 'Combined changes',
      // confidence intentionally missing
      files_modified: ['src/lib/auth.cjs'],
      applied: true,
    };
    const result = merge.parseConflictResolverReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason, 'should have a reason for missing confidence');
  });

  it('returns COMPLETE with confidence value present', () => {
    const merge = require('./merge.cjs');
    const returnData = {
      status: 'COMPLETE',
      conflict_id: 'src/lib/auth.cjs',
      strategies_tried: [{ approach: 'merge', confidence: 0.72, reason: 'works' }],
      selected_strategy: 'merge',
      resolution_summary: 'Merged cleanly',
      confidence: 0.72,
      files_modified: ['src/lib/auth.cjs'],
      applied: true,
    };
    const result = merge.parseConflictResolverReturn(`<!-- RAPID:RETURN ${JSON.stringify(returnData)} -->`);
    assert.equal(result.status, 'COMPLETE');
    assert.equal(result.data.confidence, 0.72);
  });
});

describe('merge.cjs module exports', () => {
  it('exports all v2.0 and preserved v1.0 functions', () => {
    const merge = require('./merge.cjs');

    const expectedExports = [
      // v2.0 detection
      'detectConflicts',
      'detectTextualConflicts',
      'detectStructuralConflicts',
      'detectDependencyConflicts',
      'detectAPIConflicts',
      // v2.0 resolution
      'tryDeterministicResolve',
      'tryHeuristicResolve',
      'resolveConflicts',
      // v2.0 state
      'MergeStateSchema',
      'writeMergeState',
      'readMergeState',
      'updateMergeState',
      'withMergeStateTransaction',
      'ensureMergeState',
      // v2.0 helpers
      'getChangedFiles',
      'extractFunctionNames',
      'extractDependencies',
      'extractExports',
      'parseConflictFiles',
      // preserved v1.0
      'getMergeOrder',
      'mergeSet',
      'runIntegrationTests',
      'runProgrammaticGate',
      'prepareReviewContext',
      'assembleReviewerPrompt',
      'writeReviewMd',
      'parseReviewVerdict',
      // v2.0 bisection (MERG-05)
      'bisectWave',
      'getPreWaveCommit',
      // v2.0 rollback (MERG-06)
      'revertSetMerge',
      'detectCascadeImpact',
      // v2.0 agent integration
      'integrateSemanticResults',
      'applyAgentResolutions',
      // v2.2 subagent infrastructure (MERGE-04, MERGE-05)
      'prepareMergerContext',
      'parseSetMergerReturn',
      'compressResult',
      'AgentPhaseEnum',
      // v2.2 Phase 35: conflict resolution helpers (MERGE-06)
      'routeEscalation',
      'isApiSignatureConflict',
      'generateConflictId',
      'prepareResolverContext',
      'parseConflictResolverReturn',
    ];

    for (const name of expectedExports) {
      if (name === 'MergeStateSchema' || name === 'AgentPhaseEnum') {
        assert.ok(merge[name], `should export ${name}`);
      } else {
        assert.equal(typeof merge[name], 'function', `should export ${name} as a function`);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────
// withMergeStateTransaction and ensureMergeState tests
// ────────────────────────────────────────────────────────────────

describe('withMergeStateTransaction', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-tx-'));
    const setDir = path.join(tmpDir, '.planning', 'sets', 'tx-test');
    fs.mkdirSync(setDir, { recursive: true });
    // Create .planning/.locks/
    fs.mkdirSync(path.join(tmpDir, '.planning', '.locks'), { recursive: true });
    // Write initial MERGE-STATE.json
    const mergeModule = require('./merge.cjs');
    mergeModule.writeMergeState(tmpDir, 'tx-test', {
      setId: 'tx-test',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    });
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('mutates state atomically', async () => {
    const mergeModule = require('./merge.cjs');
    const result = await mergeModule.withMergeStateTransaction(tmpDir, 'tx-test', (state) => {
      state.status = 'detecting';
    });
    assert.equal(result.status, 'detecting');
    // Verify on disk
    const onDisk = JSON.parse(fs.readFileSync(
      path.join(tmpDir, '.planning', 'sets', 'tx-test', 'MERGE-STATE.json'), 'utf-8'
    ));
    assert.equal(onDisk.status, 'detecting');
    assert.ok(onDisk.lastUpdatedAt, 'should have lastUpdatedAt');
  });

  it('validates state via Zod', async () => {
    const mergeModule = require('./merge.cjs');
    await assert.rejects(
      () => mergeModule.withMergeStateTransaction(tmpDir, 'tx-test', (state) => {
        state.status = 'invalid-status-value';
      }),
      (err) => {
        // Zod validation error
        assert.ok(err.message || err.issues, 'should throw validation error');
        return true;
      }
    );
  });

  it('throws if MERGE-STATE.json does not exist', async () => {
    const mergeModule = require('./merge.cjs');
    await assert.rejects(
      () => mergeModule.withMergeStateTransaction(tmpDir, 'no-such-set', (state) => {
        state.status = 'detecting';
      }),
      /No MERGE-STATE\.json/
    );
  });

  it('does not leave tmp files on success', async () => {
    const mergeModule = require('./merge.cjs');
    await mergeModule.withMergeStateTransaction(tmpDir, 'tx-test', (state) => {
      state.status = 'detecting';
    });
    const tmpPath = path.join(tmpDir, '.planning', 'sets', 'tx-test', 'MERGE-STATE.json.tmp');
    assert.ok(!fs.existsSync(tmpPath), 'tmp file should not remain after success');
  });

  it('releases lock even on error', async () => {
    const mergeModule = require('./merge.cjs');
    const lockModule = require('./lock.cjs');
    try {
      await mergeModule.withMergeStateTransaction(tmpDir, 'tx-test', () => {
        throw new Error('intentional test error');
      });
    } catch { /* expected */ }
    const locked = lockModule.isLocked(tmpDir, 'merge-state-tx-test');
    assert.equal(locked, false, 'lock should be released after error');
  });
});

describe('ensureMergeState', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-ensure-'));
    const setDir = path.join(tmpDir, '.planning', 'sets', 'tx-test');
    fs.mkdirSync(setDir, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', '.locks'), { recursive: true });
    const mergeModule = require('./merge.cjs');
    mergeModule.writeMergeState(tmpDir, 'tx-test', {
      setId: 'tx-test',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    });
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates state if none exists', async () => {
    const mergeModule = require('./merge.cjs');
    // Create the set directory for the new set
    const newSetDir = path.join(tmpDir, '.planning', 'sets', 'new-set');
    fs.mkdirSync(newSetDir, { recursive: true });
    const result = await mergeModule.ensureMergeState(tmpDir, 'new-set', {
      status: 'detecting',
      startedAt: new Date().toISOString(),
    });
    assert.ok(result, 'should return state');
    assert.equal(result.status, 'detecting');
    assert.equal(result.setId, 'new-set');
  });

  it('updates state if it exists', async () => {
    const mergeModule = require('./merge.cjs');
    const result = await mergeModule.ensureMergeState(tmpDir, 'tx-test', {
      status: 'merging',
    });
    assert.equal(result.status, 'merging');
    assert.equal(result.setId, 'tx-test');
  });
});
