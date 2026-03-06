'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  resolveWave,
  createWaveDir,
  writeWaveContext,
  validateJobPlans,
} = require('./wave-planning.cjs');

// ────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-wave-test-'));
}

function makeState(overrides = {}) {
  return {
    version: 1,
    projectName: 'test-project',
    currentMilestone: 'v1.0',
    milestones: [
      {
        id: 'v1.0',
        name: 'v1.0',
        sets: [
          {
            id: 'auth',
            status: 'pending',
            waves: [
              {
                id: 'wave-1',
                status: 'pending',
                jobs: [
                  { id: 'job-1', status: 'pending' },
                  { id: 'job-2', status: 'pending' },
                ],
              },
              {
                id: 'wave-2',
                status: 'pending',
                jobs: [
                  { id: 'job-3', status: 'pending' },
                ],
              },
            ],
          },
          {
            id: 'data-layer',
            status: 'pending',
            waves: [
              {
                id: 'wave-1',
                status: 'pending',
                jobs: [
                  { id: 'job-4', status: 'pending' },
                ],
              },
            ],
          },
        ],
      },
    ],
    lastUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────
// resolveWave
// ────────────────────────────────────────────────────────────────
describe('resolveWave', () => {
  it('returns single match when waveId is unique', () => {
    const state = makeState();
    const result = resolveWave(state, 'wave-2');
    assert.equal(result.milestoneId, 'v1.0');
    assert.equal(result.setId, 'auth');
    assert.equal(result.waveId, 'wave-2');
    assert.ok(result.wave);
    assert.ok(result.set);
    assert.ok(result.milestone);
  });

  it('returns array of matches when waveId is ambiguous (exists in multiple sets)', () => {
    const state = makeState();
    // wave-1 exists in both auth and data-layer
    const result = resolveWave(state, 'wave-1');
    assert.ok(Array.isArray(result), 'Should return array for ambiguous wave');
    assert.equal(result.length, 2);
    assert.equal(result[0].setId, 'auth');
    assert.equal(result[1].setId, 'data-layer');
  });

  it('throws Error when waveId not found, listing available wave IDs', () => {
    const state = makeState();
    assert.throws(
      () => resolveWave(state, 'nonexistent-wave'),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('nonexistent-wave'), 'Error should mention the missing wave ID');
        assert.ok(err.message.includes('wave-1') || err.message.includes('wave-2'), 'Error should list available waves');
        return true;
      }
    );
  });

  it('handles state with no milestones gracefully', () => {
    const state = makeState({ milestones: [] });
    assert.throws(
      () => resolveWave(state, 'wave-1'),
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      }
    );
  });

  it('handles state with empty sets gracefully', () => {
    const state = makeState();
    state.milestones[0].sets = [];
    assert.throws(
      () => resolveWave(state, 'wave-1'),
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      }
    );
  });
});

// ────────────────────────────────────────────────────────────────
// createWaveDir
// ────────────────────────────────────────────────────────────────
describe('createWaveDir', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    // Create .planning dir to simulate project root
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .planning/waves/{setId}/{waveId}/ directory and returns absolute path', () => {
    const result = createWaveDir(tmpDir, 'auth', 'wave-1');
    const expected = path.join(tmpDir, '.planning', 'waves', 'auth', 'wave-1');
    assert.equal(result, expected);
    assert.ok(fs.existsSync(expected), 'Directory should exist');
    assert.ok(fs.statSync(expected).isDirectory(), 'Should be a directory');
  });

  it('is idempotent -- returns path without error if directory already exists', () => {
    const result1 = createWaveDir(tmpDir, 'auth', 'wave-1');
    const result2 = createWaveDir(tmpDir, 'auth', 'wave-1');
    assert.equal(result1, result2);
    assert.ok(fs.existsSync(result1), 'Directory should still exist');
  });

  it('creates nested directories recursively', () => {
    const result = createWaveDir(tmpDir, 'data-layer', 'wave-3');
    assert.ok(fs.existsSync(result));
    // Verify parent dirs also exist
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'waves', 'data-layer')));
  });
});

// ────────────────────────────────────────────────────────────────
// writeWaveContext
// ────────────────────────────────────────────────────────────────
describe('writeWaveContext', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'waves', 'auth', 'wave-1'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes WAVE-CONTEXT.md to the wave directory', () => {
    const contextData = {
      waveGoal: 'Implement authentication endpoints',
      grayAreas: [
        { area: 'Token refresh strategy', decision: 'Use rotating refresh tokens' },
      ],
      decisions: [
        { topic: 'JWT library', choice: 'jose', rationale: 'Lightweight and maintained' },
      ],
      deferredIdeas: ['Rate limiting per user'],
      codeContext: 'The auth module builds on existing middleware patterns.',
    };

    writeWaveContext(tmpDir, 'auth', 'wave-1', contextData);

    const contextFile = path.join(tmpDir, '.planning', 'waves', 'auth', 'wave-1', 'WAVE-CONTEXT.md');
    assert.ok(fs.existsSync(contextFile), 'WAVE-CONTEXT.md should exist');

    const content = fs.readFileSync(contextFile, 'utf-8');
    assert.ok(content.includes('WAVE-CONTEXT'), 'Should contain WAVE-CONTEXT header');
    assert.ok(content.includes('Implement authentication endpoints'), 'Should contain wave goal');
    assert.ok(content.includes('Token refresh strategy'), 'Should contain gray areas');
    assert.ok(content.includes('jose'), 'Should contain decisions');
    assert.ok(content.includes('Rate limiting per user'), 'Should contain deferred ideas');
    assert.ok(content.includes('existing middleware patterns'), 'Should contain code context');
  });

  it('creates wave directory if it does not exist', () => {
    const contextData = {
      waveGoal: 'Test goal',
      grayAreas: [],
      decisions: [],
      deferredIdeas: [],
      codeContext: '',
    };

    writeWaveContext(tmpDir, 'auth', 'wave-new', contextData);

    const contextFile = path.join(tmpDir, '.planning', 'waves', 'auth', 'wave-new', 'WAVE-CONTEXT.md');
    assert.ok(fs.existsSync(contextFile), 'Should create directory and write file');
  });
});

// ────────────────────────────────────────────────────────────────
// validateJobPlans
// ────────────────────────────────────────────────────────────────
describe('validateJobPlans', () => {
  it('detects missing export coverage (export file not in any job plan)', () => {
    const contractJson = {
      exports: {
        functions: [
          { name: 'authenticateUser', file: 'src/auth/login.js', params: [], returns: 'void' },
          { name: 'refreshToken', file: 'src/auth/refresh.js', params: [], returns: 'void' },
        ],
      },
    };
    const jobPlans = [
      { jobId: 'job-1', filesToModify: ['src/auth/login.js'] },
    ];

    const result = validateJobPlans(contractJson, jobPlans, {});
    assert.ok(result.autoFixes.length > 0, 'Should have auto-fixes for missing coverage');
    const missingCoverage = result.autoFixes.find(f => f.type === 'missing-export-coverage');
    assert.ok(missingCoverage, 'Should classify as missing-export-coverage');
    assert.ok(missingCoverage.detail.includes('refreshToken'), 'Should mention the uncovered export');
  });

  it('reports no violations when all exports are covered', () => {
    const contractJson = {
      exports: {
        functions: [
          { name: 'authenticateUser', file: 'src/auth/login.js', params: [], returns: 'void' },
        ],
      },
    };
    const jobPlans = [
      { jobId: 'job-1', filesToModify: ['src/auth/login.js'] },
    ];

    const result = validateJobPlans(contractJson, jobPlans, {});
    assert.equal(result.violations.length, 0);
    assert.equal(result.autoFixes.length, 0);
  });

  it('detects cross-set import of function not exported by source set', () => {
    const contractJson = {
      exports: { functions: [] },
      imports: {
        fromSets: [
          { set: 'data-layer', functions: ['queryUser', 'deleteUser'] },
        ],
      },
    };
    const jobPlans = [];
    const allSetContracts = {
      'data-layer': {
        exports: {
          functions: [
            { name: 'queryUser', file: 'src/data/queries.js', params: [], returns: 'void' },
          ],
        },
      },
    };

    const result = validateJobPlans(contractJson, jobPlans, allSetContracts);
    assert.ok(result.violations.length > 0, 'Should detect missing import');
    const violation = result.violations.find(v => v.detail.includes('deleteUser'));
    assert.ok(violation, 'Should detect deleteUser is not exported');
    assert.equal(violation.severity, 'major');
  });

  it('uses case-insensitive matching for cross-set imports', () => {
    const contractJson = {
      exports: { functions: [] },
      imports: {
        fromSets: [
          { set: 'data-layer', functions: ['QueryUser'] },
        ],
      },
    };
    const jobPlans = [];
    const allSetContracts = {
      'data-layer': {
        exports: {
          functions: [
            { name: 'queryUser', file: 'src/data/queries.js', params: [], returns: 'void' },
          ],
        },
      },
    };

    const result = validateJobPlans(contractJson, jobPlans, allSetContracts);
    // Should NOT report violation because of case-insensitive matching
    const violation = result.violations.find(v => v.detail.includes('QueryUser'));
    assert.equal(violation, undefined, 'Case-insensitive match should not produce violation');
  });

  it('classifies missing cross-set import as major violation', () => {
    const contractJson = {
      exports: { functions: [] },
      imports: {
        fromSets: [
          { set: 'missing-set', functions: ['someFunction'] },
        ],
      },
    };

    const result = validateJobPlans(contractJson, [], {});
    assert.ok(result.violations.length > 0);
    assert.equal(result.violations[0].severity, 'major');
    assert.ok(result.violations[0].detail.includes('missing-set'));
  });

  it('classifies missing export coverage as auto-fix severity', () => {
    const contractJson = {
      exports: {
        functions: [
          { name: 'someFunc', file: 'src/some/file.js', params: [], returns: 'void' },
        ],
      },
    };

    const result = validateJobPlans(contractJson, [], {});
    assert.ok(result.autoFixes.length > 0);
    assert.equal(result.autoFixes[0].type, 'missing-export-coverage');
  });

  it('handles empty contract gracefully', () => {
    const result = validateJobPlans({ exports: {} }, [], {});
    assert.equal(result.violations.length, 0);
    assert.equal(result.autoFixes.length, 0);
  });

  it('handles contract with no imports gracefully', () => {
    const contractJson = {
      exports: {
        functions: [
          { name: 'foo', file: 'src/foo.js', params: [], returns: 'void' },
        ],
      },
    };
    const jobPlans = [{ jobId: 'job-1', filesToModify: ['src/foo.js'] }];

    const result = validateJobPlans(contractJson, jobPlans, {});
    assert.equal(result.violations.length, 0);
    assert.equal(result.autoFixes.length, 0);
  });
});
