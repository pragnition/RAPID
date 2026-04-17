'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { handleSetInit } = require('./set-init.cjs');

// Capture stdout for the duration of a single handler invocation.
async function captureStdout(fn) {
  const original = process.stdout.write;
  let captured = '';
  process.stdout.write = (chunk) => { captured += chunk; return true; };
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return captured;
}

// Write a minimal-but-valid STATE.json into a fixture dir.
// `sets` is an ordered array of { id, status } records (STATE.json insertion order).
function writeState(cwd, sets) {
  const planningDir = path.join(cwd, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  const state = {
    version: 1,
    projectName: 'test-project',
    currentMilestone: 'M1',
    milestones: [
      {
        id: 'M1',
        name: 'Test Milestone',
        sets: sets.map((s) => ({
          id: s.id,
          status: s.status,
          waves: [],
        })),
      },
    ],
    createdAt: '2026-04-17T00:00:00.000Z',
    lastUpdatedAt: '2026-04-17T00:00:00.000Z',
  };
  fs.writeFileSync(path.join(planningDir, 'STATE.json'), JSON.stringify(state, null, 2));
}

// Write a minimal v3 DAG.json with the given wave layout.
// `waves` is an array of arrays of set IDs -- exactly what getExecutionOrder returns.
// Nodes are assigned wave numbers 1..N based on position.
function writeDAG(cwd, waves) {
  const setsDir = path.join(cwd, '.planning', 'sets');
  fs.mkdirSync(setsDir, { recursive: true });

  const nodes = [];
  const wavesObj = {};
  waves.forEach((waveSets, idx) => {
    const waveNum = idx + 1;
    wavesObj[waveNum] = { nodes: [...waveSets] };
    for (const setId of waveSets) {
      nodes.push({
        id: setId,
        type: 'set',
        wave: waveNum,
        status: 'pending',
        group: null,
        priority: null,
        description: null,
      });
    }
  });

  const dag = {
    version: 3,
    nodes,
    edges: [],
    waves: wavesObj,
    groups: {},
    metadata: {
      created: '2026-04-17',
      totalNodes: nodes.length,
      totalWaves: waves.length,
      maxParallelism: waves.reduce((m, w) => Math.max(m, w.length), 0),
    },
  };
  fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify(dag, null, 2));
}

// Write an empty worktree registry (no sets registered).
function writeEmptyRegistry(cwd) {
  const regDir = path.join(cwd, '.planning', 'worktrees');
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(
    path.join(regDir, 'REGISTRY.json'),
    JSON.stringify({ version: 1, worktrees: {} }, null, 2) + '\n',
  );
}

describe('set-init list-available DAG-wave ordering', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-set-init-test-'));
    writeEmptyRegistry(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Case 1: DAG present, multi-wave -- DAG order wins ─────────

  it('emits pending sets in DAG wave order (multi-wave DAG present)', async () => {
    // STATE.json insertion order: A, B, C, D
    writeState(tmpDir, [
      { id: 'set-A', status: 'pending' },
      { id: 'set-B', status: 'pending' },
      { id: 'set-C', status: 'pending' },
      { id: 'set-D', status: 'pending' },
    ]);
    // DAG waves: [B, D] in wave 1, [A, C] in wave 2
    writeDAG(tmpDir, [
      ['set-B', 'set-D'],
      ['set-A', 'set-C'],
    ]);

    const captured = await captureStdout(() => handleSetInit(tmpDir, 'list-available', []));
    const parsed = JSON.parse(captured.trim());

    assert.ok(Array.isArray(parsed.available), 'available must be an array');
    const ids = parsed.available.map((s) => s.id);
    assert.deepStrictEqual(
      ids,
      ['set-B', 'set-D', 'set-A', 'set-C'],
      'Expected DAG wave order (B, D, A, C), not STATE insertion order (A, B, C, D)',
    );
  });

  // ── Case 2: DAG absent (ENOENT) -- fallback to STATE order ────

  it('falls back to STATE.json insertion order when DAG.json is absent', async () => {
    writeState(tmpDir, [
      { id: 'set-A', status: 'pending' },
      { id: 'set-B', status: 'pending' },
      { id: 'set-C', status: 'pending' },
      { id: 'set-D', status: 'pending' },
    ]);
    // Deliberately do NOT write DAG.json.

    const captured = await captureStdout(() => handleSetInit(tmpDir, 'list-available', []));
    const parsed = JSON.parse(captured.trim());

    assert.ok(Array.isArray(parsed.available), 'available must be an array');
    const ids = parsed.available.map((s) => s.id);
    assert.deepStrictEqual(
      ids,
      ['set-A', 'set-B', 'set-C', 'set-D'],
      'Expected STATE.json insertion order fallback',
    );
  });

  // ── Case 3: DAG present but missing a set -- never drop sets ──

  it('appends sets missing from DAG after wave-ordered sets (never drops)', async () => {
    // STATE.json: A, B, C (insertion order)
    writeState(tmpDir, [
      { id: 'set-A', status: 'pending' },
      { id: 'set-B', status: 'pending' },
      { id: 'set-C', status: 'pending' },
    ]);
    // DAG mentions only A and C, both in wave 1 (order A, C).
    writeDAG(tmpDir, [['set-A', 'set-C']]);

    const captured = await captureStdout(() => handleSetInit(tmpDir, 'list-available', []));
    const parsed = JSON.parse(captured.trim());

    assert.ok(Array.isArray(parsed.available), 'available must be an array');
    const ids = parsed.available.map((s) => s.id);
    assert.deepStrictEqual(
      ids,
      ['set-A', 'set-C', 'set-B'],
      'DAG-ordered sets first, then STATE-only leftover (set-B) appended',
    );
  });

  // ── Case 4: Zero pending sets -- empty array regardless of DAG ─

  it('emits empty array when no sets are pending (DAG present)', async () => {
    writeState(tmpDir, [
      { id: 'set-A', status: 'planned' },
      { id: 'set-B', status: 'executed' },
      { id: 'set-C', status: 'complete' },
    ]);
    writeDAG(tmpDir, [['set-A', 'set-B', 'set-C']]);

    const captured = await captureStdout(() => handleSetInit(tmpDir, 'list-available', []));
    const parsed = JSON.parse(captured.trim());

    assert.ok(Array.isArray(parsed.available), 'available must be an array');
    assert.deepStrictEqual(parsed.available, [], 'Expected empty array when nothing pending');
  });

  it('emits empty array when no sets are pending (DAG absent)', async () => {
    writeState(tmpDir, [
      { id: 'set-A', status: 'planned' },
      { id: 'set-B', status: 'executed' },
    ]);
    // No DAG.json.

    const captured = await captureStdout(() => handleSetInit(tmpDir, 'list-available', []));
    const parsed = JSON.parse(captured.trim());

    assert.ok(Array.isArray(parsed.available), 'available must be an array');
    assert.deepStrictEqual(parsed.available, [], 'Expected empty array when nothing pending');
  });
});
