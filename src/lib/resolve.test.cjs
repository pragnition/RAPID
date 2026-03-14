'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { resolveSet, resolveWave } = require('./resolve.cjs');

// ────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-resolve-test-'));
}

/**
 * Create mock .planning/sets/ directories with given set names.
 */
function createMockSets(cwd, setNames) {
  const setsDir = path.join(cwd, '.planning', 'sets');
  fs.mkdirSync(setsDir, { recursive: true });
  for (const name of setNames) {
    fs.mkdirSync(path.join(setsDir, name), { recursive: true });
  }
}

/**
 * Create a .planning/STATE.json file with a valid ProjectState structure.
 * Each set gets status: 'pending' and waves: [].
 */
function createMockState(cwd, setNames) {
  const stateFile = path.join(cwd, '.planning', 'STATE.json');
  fs.mkdirSync(path.join(cwd, '.planning'), { recursive: true });
  const state = {
    version: 1,
    projectName: 'test-project',
    currentMilestone: 'v1.0',
    milestones: [{
      id: 'v1.0',
      name: 'v1.0',
      sets: setNames.map(name => ({ id: name, status: 'pending', waves: [] })),
    }],
    lastUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * Create a valid ProjectState object for wave resolution tests.
 */
function makeState(sets) {
  return {
    version: 1,
    projectName: 'test-project',
    currentMilestone: 'v1.0',
    milestones: [
      {
        id: 'v1.0',
        name: 'v1.0',
        sets: sets,
      },
    ],
    lastUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

let tmpDir;

beforeEach(() => {
  tmpDir = makeTmpDir();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ────────────────────────────────────────────────────────────────
// resolveSet -- numeric happy path (UX-01)
// ────────────────────────────────────────────────────────────────
describe('resolveSet -- numeric resolution (UX-01)', () => {
  it('resolves "1" to first milestone-ordered set', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    const result = resolveSet('1', tmpDir);
    assert.deepStrictEqual(result, {
      resolvedId: 'set-01-api',
      numericIndex: 1,
      wasNumeric: true,
    });
  });

  it('resolves "2" to second set', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    const result = resolveSet('2', tmpDir);
    assert.deepStrictEqual(result, {
      resolvedId: 'set-02-data',
      numericIndex: 2,
      wasNumeric: true,
    });
  });

  it('resolves "3" to third set', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    const result = resolveSet('3', tmpDir);
    assert.deepStrictEqual(result, {
      resolvedId: 'set-03-ui',
      numericIndex: 3,
      wasNumeric: true,
    });
  });

  it('resolves "1" with single set (boundary)', () => {
    createMockSets(tmpDir, ['only-set']);
    createMockState(tmpDir, ['only-set']);
    const result = resolveSet('1', tmpDir);
    assert.deepStrictEqual(result, {
      resolvedId: 'only-set',
      numericIndex: 1,
      wasNumeric: true,
    });
  });
});

// ────────────────────────────────────────────────────────────────
// resolveSet -- string ID happy path (UX-03)
// ────────────────────────────────────────────────────────────────
describe('resolveSet -- string ID backward compat (UX-03)', () => {
  it('resolves "set-02-data" with wasNumeric=false and correct numericIndex', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    const result = resolveSet('set-02-data', tmpDir);
    assert.deepStrictEqual(result, {
      resolvedId: 'set-02-data',
      numericIndex: 2,
      wasNumeric: false,
    });
  });

  it('resolves first set string ID with numericIndex=1', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    const result = resolveSet('set-01-api', tmpDir);
    assert.deepStrictEqual(result, {
      resolvedId: 'set-01-api',
      numericIndex: 1,
      wasNumeric: false,
    });
  });

  it('resolves last set string ID with correct numericIndex', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    const result = resolveSet('set-03-ui', tmpDir);
    assert.deepStrictEqual(result, {
      resolvedId: 'set-03-ui',
      numericIndex: 3,
      wasNumeric: false,
    });
  });
});

// ────────────────────────────────────────────────────────────────
// resolveSet -- error cases
// ────────────────────────────────────────────────────────────────
describe('resolveSet -- error cases', () => {
  it('throws on index 0', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    assert.throws(
      () => resolveSet('0', tmpDir),
      { message: 'Invalid index: must be a positive integer.' }
    );
  });

  it('treats "-1" as string ID (not numeric), throws not found', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    assert.throws(
      () => resolveSet('-1', tmpDir),
      { message: /Set '-1' not found/ }
    );
  });

  it('throws on out-of-range index', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    assert.throws(
      () => resolveSet('99', tmpDir),
      { message: 'Set 99 not found. Valid range: 1-3. Use /rapid:status to see available sets.' }
    );
  });

  it('throws when no sets exist', () => {
    // Create STATE.json with empty sets array
    createMockState(tmpDir, []);
    assert.throws(
      () => resolveSet('1', tmpDir),
      { message: "No sets found in current milestone 'v1.0'. Run /rapid:init first." }
    );
  });

  it('throws when no STATE.json exists', () => {
    // No STATE.json on disk -- should throw a clear init message
    assert.throws(
      () => resolveSet('1', tmpDir),
      { message: 'No STATE.json found. Run /rapid:init first to initialize the project.' }
    );
  });

  it('throws on nonexistent string ID with available sets listed', () => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    assert.throws(
      () => resolveSet('nonexistent', tmpDir),
      { message: "Set 'nonexistent' not found. Available sets: set-01-api, set-02-data, set-03-ui" }
    );
  });
});

// ────────────────────────────────────────────────────────────────
// resolveSet -- explicit state parameter
// ────────────────────────────────────────────────────────────────
describe('resolveSet -- explicit state parameter', () => {
  it('resolves numeric index from provided state', () => {
    const state = makeState([
      { id: 'alpha', status: 'pending', waves: [] },
      { id: 'beta', status: 'pending', waves: [] },
      { id: 'gamma', status: 'pending', waves: [] },
    ]);
    const result = resolveSet('2', tmpDir, state);
    assert.deepStrictEqual(result, {
      resolvedId: 'beta',
      numericIndex: 2,
      wasNumeric: true,
    });
  });

  it('resolves string ID from provided state', () => {
    const state = makeState([
      { id: 'alpha', status: 'pending', waves: [] },
      { id: 'beta', status: 'pending', waves: [] },
      { id: 'gamma', status: 'pending', waves: [] },
    ]);
    const result = resolveSet('gamma', tmpDir, state);
    assert.deepStrictEqual(result, {
      resolvedId: 'gamma',
      numericIndex: 3,
      wasNumeric: false,
    });
  });

  it('uses milestone ordering, not alphabetical', () => {
    const state = makeState([
      { id: 'zebra', status: 'pending', waves: [] },
      { id: 'apple', status: 'pending', waves: [] },
      { id: 'mango', status: 'pending', waves: [] },
    ]);
    const result = resolveSet('1', tmpDir, state);
    assert.deepStrictEqual(result, {
      resolvedId: 'zebra',
      numericIndex: 1,
      wasNumeric: true,
    });
  });

  it('throws on out-of-range with state-provided sets', () => {
    const state = makeState([
      { id: 'alpha', status: 'pending', waves: [] },
      { id: 'beta', status: 'pending', waves: [] },
    ]);
    assert.throws(
      () => resolveSet('5', tmpDir, state),
      { message: 'Set 5 not found. Valid range: 1-2. Use /rapid:status to see available sets.' }
    );
  });
});

// ────────────────────────────────────────────────────────────────
// resolveWave -- numeric dot notation happy path (UX-02)
// ────────────────────────────────────────────────────────────────
describe('resolveWave -- numeric dot notation (UX-02)', () => {
  const threeSetState = makeState([
    {
      id: 'set-01-api',
      status: 'pending',
      waves: [
        { id: 'wave-01', status: 'pending', jobs: [] },
        { id: 'wave-02', status: 'pending', jobs: [] },
      ],
    },
    {
      id: 'set-02-data',
      status: 'pending',
      waves: [
        { id: 'wave-01', status: 'pending', jobs: [] },
        { id: 'wave-02', status: 'pending', jobs: [] },
        { id: 'wave-03', status: 'pending', jobs: [] },
      ],
    },
    {
      id: 'set-03-ui',
      status: 'pending',
      waves: [
        { id: 'wave-01', status: 'pending', jobs: [] },
      ],
    },
  ]);

  beforeEach(() => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data', 'set-03-ui']);
  });

  it('resolves "1.1" to set 1, wave 1', () => {
    const result = resolveWave('1.1', threeSetState, tmpDir);
    assert.deepStrictEqual(result, {
      setId: 'set-01-api',
      waveId: 'wave-01',
      setIndex: 1,
      waveIndex: 1,
      wasNumeric: true,
    });
  });

  it('resolves "1.2" to set 1, wave 2', () => {
    const result = resolveWave('1.2', threeSetState, tmpDir);
    assert.deepStrictEqual(result, {
      setId: 'set-01-api',
      waveId: 'wave-02',
      setIndex: 1,
      waveIndex: 2,
      wasNumeric: true,
    });
  });

  it('resolves "2.3" to set 2, wave 3', () => {
    const result = resolveWave('2.3', threeSetState, tmpDir);
    assert.deepStrictEqual(result, {
      setId: 'set-02-data',
      waveId: 'wave-03',
      setIndex: 2,
      waveIndex: 3,
      wasNumeric: true,
    });
  });

  it('resolves "3.1" to set 3, wave 1', () => {
    const result = resolveWave('3.1', threeSetState, tmpDir);
    assert.deepStrictEqual(result, {
      setId: 'set-03-ui',
      waveId: 'wave-01',
      setIndex: 3,
      waveIndex: 1,
      wasNumeric: true,
    });
  });
});

// ────────────────────────────────────────────────────────────────
// resolveWave -- string ID delegation (UX-03)
// ────────────────────────────────────────────────────────────────
describe('resolveWave -- string ID backward compat (UX-03)', () => {
  const state = makeState([
    {
      id: 'set-01-api',
      status: 'pending',
      waves: [
        { id: 'wave-01', status: 'pending', jobs: [] },
        { id: 'wave-02', status: 'pending', jobs: [] },
      ],
    },
    {
      id: 'set-02-data',
      status: 'pending',
      waves: [
        { id: 'wave-01', status: 'pending', jobs: [] },
      ],
    },
  ]);

  beforeEach(() => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data']);
  });

  it('resolves string wave ID "wave-02" with wasNumeric=false', () => {
    const result = resolveWave('wave-02', state, tmpDir);
    assert.equal(result.waveId, 'wave-02');
    assert.equal(result.setId, 'set-01-api');
    assert.equal(result.wasNumeric, false);
    assert.equal(result.setIndex, 1);
    assert.equal(result.waveIndex, 2);
  });
});

// ────────────────────────────────────────────────────────────────
// resolveWave -- error cases
// ────────────────────────────────────────────────────────────────
describe('resolveWave -- error cases', () => {
  const state = makeState([
    {
      id: 'set-01-api',
      status: 'pending',
      waves: [
        { id: 'wave-01', status: 'pending', jobs: [] },
        { id: 'wave-02', status: 'pending', jobs: [] },
      ],
    },
  ]);

  beforeEach(() => {
    createMockSets(tmpDir, ['set-01-api']);
    createMockState(tmpDir, ['set-01-api']);
  });

  it('throws on malformed "1." input', () => {
    assert.throws(
      () => resolveWave('1.', state, tmpDir),
      { message: 'Invalid wave reference. Use N.N format (e.g., 1.1 = set 1, wave 1).' }
    );
  });

  it('throws on malformed ".1" input', () => {
    assert.throws(
      () => resolveWave('.1', state, tmpDir),
      { message: 'Invalid wave reference. Use N.N format (e.g., 1.1 = set 1, wave 1).' }
    );
  });

  it('throws on zero wave index "1.0"', () => {
    assert.throws(
      () => resolveWave('1.0', state, tmpDir),
      { message: 'Invalid index: must be a positive integer.' }
    );
  });

  it('throws on zero set index "0.1"', () => {
    assert.throws(
      () => resolveWave('0.1', state, tmpDir),
      { message: 'Invalid index: must be a positive integer.' }
    );
  });

  it('treats "1.1.1" as string (no match for dot notation), throws wave not found', () => {
    assert.throws(
      () => resolveWave('1.1.1', state, tmpDir),
      { message: /Wave '1\.1\.1' not found/ }
    );
  });

  it('throws on out-of-range wave index', () => {
    assert.throws(
      () => resolveWave('1.99', state, tmpDir),
      { message: "Wave 99 not found in set 'set-01-api'. Valid range: 1-2." }
    );
  });

  it('throws on out-of-range set index (delegates to resolveSet error)', () => {
    assert.throws(
      () => resolveWave('99.1', state, tmpDir),
      { message: /Set 99 not found/ }
    );
  });
});

// ────────────────────────────────────────────────────────────────
// Edge cases
// ────────────────────────────────────────────────────────────────
describe('resolveWave -- edge cases', () => {
  it('handles single set with single wave', () => {
    createMockSets(tmpDir, ['only-set']);
    createMockState(tmpDir, ['only-set']);
    const state = makeState([
      {
        id: 'only-set',
        status: 'pending',
        waves: [
          { id: 'wave-01', status: 'pending', jobs: [] },
        ],
      },
    ]);
    const result = resolveWave('1.1', state, tmpDir);
    assert.deepStrictEqual(result, {
      setId: 'only-set',
      waveId: 'wave-01',
      setIndex: 1,
      waveIndex: 1,
      wasNumeric: true,
    });
  });

  it('resolveWave with set not in state throws descriptive error', () => {
    createMockSets(tmpDir, ['set-01-api']);
    createMockState(tmpDir, ['set-01-api']);
    // State has no sets in milestone -- emptyState passed explicitly overrides disk
    const emptyState = makeState([]);
    assert.throws(
      () => resolveWave('1.1', emptyState, tmpDir),
      { message: /No sets found in current milestone/ }
    );
  });
});

// ────────────────────────────────────────────────────────────────
// resolveWave -- with setId parameter (FLOW-01)
// ────────────────────────────────────────────────────────────────
describe('resolveWave -- with setId parameter (FLOW-01)', () => {
  const state = makeState([
    {
      id: 'set-01-api',
      status: 'pending',
      waves: [
        { id: 'wave-01', status: 'pending', jobs: [] },
        { id: 'wave-02', status: 'pending', jobs: [] },
      ],
    },
    {
      id: 'set-02-data',
      status: 'pending',
      waves: [
        { id: 'wave-01', status: 'pending', jobs: [] },
        { id: 'wave-02', status: 'pending', jobs: [] },
        { id: 'wave-03', status: 'pending', jobs: [] },
      ],
    },
  ]);

  beforeEach(() => {
    createMockSets(tmpDir, ['set-01-api', 'set-02-data']);
    createMockState(tmpDir, ['set-01-api', 'set-02-data']);
  });

  it('resolves string setId + string waveId correctly', () => {
    const result = resolveWave('wave-01', state, tmpDir, 'set-01-api');
    assert.deepStrictEqual(result, {
      setId: 'set-01-api',
      waveId: 'wave-01',
      setIndex: 1,
      waveIndex: 1,
      wasNumeric: false,
    });
  });

  it('resolves second wave in first set via setId', () => {
    const result = resolveWave('wave-02', state, tmpDir, 'set-01-api');
    assert.deepStrictEqual(result, {
      setId: 'set-01-api',
      waveId: 'wave-02',
      setIndex: 1,
      waveIndex: 2,
      wasNumeric: false,
    });
  });

  it('resolves wave in second set via string setId', () => {
    const result = resolveWave('wave-03', state, tmpDir, 'set-02-data');
    assert.deepStrictEqual(result, {
      setId: 'set-02-data',
      waveId: 'wave-03',
      setIndex: 2,
      waveIndex: 3,
      wasNumeric: false,
    });
  });

  it('resolves numeric setId + string waveId correctly', () => {
    const result = resolveWave('wave-01', state, tmpDir, '1');
    assert.deepStrictEqual(result, {
      setId: 'set-01-api',
      waveId: 'wave-01',
      setIndex: 1,
      waveIndex: 1,
      wasNumeric: false,
    });
  });

  it('resolves numeric setId "2" + string waveId correctly', () => {
    const result = resolveWave('wave-02', state, tmpDir, '2');
    assert.deepStrictEqual(result, {
      setId: 'set-02-data',
      waveId: 'wave-02',
      setIndex: 2,
      waveIndex: 2,
      wasNumeric: false,
    });
  });

  it('throws on nonexistent wave in valid set with available waves listed', () => {
    assert.throws(
      () => resolveWave('nonexistent-wave', state, tmpDir, 'set-01-api'),
      { message: /Wave 'nonexistent-wave' not found in set 'set-01-api'. Available waves: wave-01, wave-02/ }
    );
  });

  it('throws on nonexistent set (delegates to resolveSet error)', () => {
    assert.throws(
      () => resolveWave('wave-01', state, tmpDir, 'nonexistent-set'),
      { message: /Set 'nonexistent-set' not found/ }
    );
  });

  it('backward compat: resolveWave without setId still works with dot notation', () => {
    const result = resolveWave('1.1', state, tmpDir);
    assert.deepStrictEqual(result, {
      setId: 'set-01-api',
      waveId: 'wave-01',
      setIndex: 1,
      waveIndex: 1,
      wasNumeric: true,
    });
  });

  it('backward compat: resolveWave without setId still works with string wave ID', () => {
    const result = resolveWave('wave-02', state, tmpDir);
    assert.equal(result.waveId, 'wave-02');
    assert.equal(result.setId, 'set-01-api');
    assert.equal(result.wasNumeric, false);
  });
});
