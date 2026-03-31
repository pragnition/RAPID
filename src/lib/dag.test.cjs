'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  toposort,
  assignWaves,
  createDAG,
  validateDAG,
  getExecutionOrder,
  tryLoadDAG,
  DAG_CANONICAL_SUBPATH,
  createDAGv2,
  validateDAGv2,
  createDAGv3,
  validateDAGv3,
  migrateDAGv1toV3,
  migrateDAGv2toV3,
} = require('./dag.cjs');

// ────────────────────────────────────────────────────────────────
// toposort
// ────────────────────────────────────────────────────────────────
describe('toposort', () => {
  it('returns node IDs in dependency order for a simple linear chain', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ];
    const result = toposort(nodes, edges);
    assert.deepStrictEqual(result, ['A', 'B', 'C']);
  });

  it('returns valid order where all dependencies appear before dependents for a diamond DAG', () => {
    // A -> B, A -> C, B -> D, C -> D
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
    ];
    const result = toposort(nodes, edges);
    // A must come before B and C; B and C must come before D
    assert.ok(result.indexOf('A') < result.indexOf('B'), 'A before B');
    assert.ok(result.indexOf('A') < result.indexOf('C'), 'A before C');
    assert.ok(result.indexOf('B') < result.indexOf('D'), 'B before D');
    assert.ok(result.indexOf('C') < result.indexOf('D'), 'C before D');
    assert.equal(result.length, 4);
  });

  it('throws Error with involved node names when cycle detected', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ];
    assert.throws(
      () => toposort(nodes, edges),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('A'), 'Message should mention A');
        assert.ok(err.message.includes('B'), 'Message should mention B');
        return true;
      }
    );
  });

  it('returns all nodes for a DAG with no edges (all independent)', () => {
    const nodes = [{ id: 'X' }, { id: 'Y' }, { id: 'Z' }];
    const result = toposort(nodes, []);
    assert.equal(result.length, 3);
    assert.ok(result.includes('X'));
    assert.ok(result.includes('Y'));
    assert.ok(result.includes('Z'));
  });

  it('throws Error for edges referencing unknown node IDs', () => {
    const nodes = [{ id: 'A' }];
    const edges = [{ from: 'A', to: 'UNKNOWN' }];
    assert.throws(
      () => toposort(nodes, edges),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('UNKNOWN'), 'Message should mention unknown node');
        return true;
      }
    );
  });

  it('throws Error when from references an unknown node', () => {
    const nodes = [{ id: 'B' }];
    const edges = [{ from: 'GHOST', to: 'B' }];
    assert.throws(
      () => toposort(nodes, edges),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('GHOST'));
        return true;
      }
    );
  });

  it('handles a single node with no edges', () => {
    const result = toposort([{ id: 'solo' }], []);
    assert.deepStrictEqual(result, ['solo']);
  });

  it('handles a larger graph correctly', () => {
    // E depends on C and D; C depends on A; D depends on B; A and B are independent
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }];
    const edges = [
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'E' },
      { from: 'D', to: 'E' },
    ];
    const result = toposort(nodes, edges);
    assert.ok(result.indexOf('A') < result.indexOf('C'));
    assert.ok(result.indexOf('B') < result.indexOf('D'));
    assert.ok(result.indexOf('C') < result.indexOf('E'));
    assert.ok(result.indexOf('D') < result.indexOf('E'));
  });
});

// ────────────────────────────────────────────────────────────────
// assignWaves
// ────────────────────────────────────────────────────────────────
describe('assignWaves', () => {
  it('returns wave 1 for all nodes when no edges exist', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const result = assignWaves(nodes, []);
    assert.deepStrictEqual(result, { A: 1, B: 1, C: 1 });
  });

  it('assigns wave 1 to roots and wave 2 to their dependents', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges = [
      { from: 'A', to: 'C' },
      { from: 'B', to: 'C' },
    ];
    const result = assignWaves(nodes, edges);
    assert.equal(result['A'], 1);
    assert.equal(result['B'], 1);
    assert.equal(result['C'], 2);
  });

  it('handles diamond patterns correctly (A,B -> C: A=1, B=1, C=2)', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges = [
      { from: 'A', to: 'C' },
      { from: 'B', to: 'C' },
    ];
    const result = assignWaves(nodes, edges);
    assert.equal(result['A'], 1);
    assert.equal(result['B'], 1);
    assert.equal(result['C'], 2);
  });

  it('handles deep chains (A -> B -> C -> D: waves 1, 2, 3, 4)', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D' },
    ];
    const result = assignWaves(nodes, edges);
    assert.equal(result['A'], 1);
    assert.equal(result['B'], 2);
    assert.equal(result['C'], 3);
    assert.equal(result['D'], 4);
  });

  it('handles diamond with deep chain correctly', () => {
    // A -> C, B -> C, C -> D
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
    const edges = [
      { from: 'A', to: 'C' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D' },
    ];
    const result = assignWaves(nodes, edges);
    assert.equal(result['A'], 1);
    assert.equal(result['B'], 1);
    assert.equal(result['C'], 2);
    assert.equal(result['D'], 3);
  });
});

// ────────────────────────────────────────────────────────────────
// createDAG
// ────────────────────────────────────────────────────────────────
describe('createDAG', () => {
  it('returns full DAG.json structure with nodes, edges, waves, and metadata', () => {
    const nodes = [{ id: 'auth' }, { id: 'data' }, { id: 'api' }];
    const edges = [
      { from: 'auth', to: 'api' },
      { from: 'data', to: 'api' },
    ];
    const dag = createDAG(nodes, edges);

    // Check top-level fields
    assert.ok(Array.isArray(dag.nodes));
    assert.ok(Array.isArray(dag.edges));
    assert.ok(typeof dag.waves === 'object');
    assert.ok(typeof dag.metadata === 'object');

    // Nodes have wave and status
    for (const node of dag.nodes) {
      assert.ok(typeof node.wave === 'number', `Node ${node.id} should have wave`);
      assert.equal(node.status, 'pending');
    }

    // Waves structure
    assert.ok(dag.waves['1']);
    assert.ok(dag.waves['2']);
    assert.ok(dag.waves['1'].sets.includes('auth'));
    assert.ok(dag.waves['1'].sets.includes('data'));
    assert.ok(dag.waves['2'].sets.includes('api'));

    // Checkpoints
    assert.ok(dag.waves['1'].checkpoint.contracts.includes('rapid://contracts/auth'));
    assert.ok(dag.waves['1'].checkpoint.artifacts.includes('.planning/sets/auth/CONTRACT.json'));

    // Metadata
    assert.equal(dag.metadata.totalSets, 3);
    assert.equal(dag.metadata.totalWaves, 2);
    assert.equal(dag.metadata.maxParallelism, 2);
    assert.ok(dag.metadata.created);
  });

  it('rejects duplicate node IDs with descriptive error', () => {
    const nodes = [{ id: 'A' }, { id: 'A' }];
    assert.throws(
      () => createDAG(nodes, []),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Duplicate'));
        assert.ok(err.message.includes('A'));
        return true;
      }
    );
  });

  it('rejects edges where from or to references an unknown node', () => {
    const nodes = [{ id: 'A' }];
    const edges = [{ from: 'A', to: 'MISSING' }];
    assert.throws(
      () => createDAG(nodes, edges),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('MISSING'));
        return true;
      }
    );
  });

  it('rejects cycles with descriptive error', () => {
    const nodes = [{ id: 'X' }, { id: 'Y' }];
    const edges = [
      { from: 'X', to: 'Y' },
      { from: 'Y', to: 'X' },
    ];
    assert.throws(
      () => createDAG(nodes, edges),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.toLowerCase().includes('cycle'));
        return true;
      }
    );
  });

  it('creates correct DAG for single node with no edges', () => {
    const dag = createDAG([{ id: 'solo' }], []);
    assert.equal(dag.nodes.length, 1);
    assert.equal(dag.nodes[0].wave, 1);
    assert.equal(dag.metadata.totalSets, 1);
    assert.equal(dag.metadata.totalWaves, 1);
    assert.equal(dag.metadata.maxParallelism, 1);
  });
});

// ────────────────────────────────────────────────────────────────
// validateDAG
// ────────────────────────────────────────────────────────────────
describe('validateDAG', () => {
  it('returns { valid: true } for a well-formed DAG object', () => {
    const dag = createDAG(
      [{ id: 'A' }, { id: 'B' }],
      [{ from: 'A', to: 'B' }]
    );
    const result = validateDAG(dag);
    assert.deepStrictEqual(result, { valid: true });
  });

  it('returns { valid: false, errors: [...] } for missing nodes field', () => {
    const result = validateDAG({ edges: [], waves: {}, metadata: { totalSets: 0, totalWaves: 0 } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some((e) => e.includes('nodes')));
  });

  it('returns { valid: false } for missing edges field', () => {
    const result = validateDAG({ nodes: [], waves: {}, metadata: { totalSets: 0, totalWaves: 0 } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('edges')));
  });

  it('returns { valid: false } for missing waves field', () => {
    const result = validateDAG({ nodes: [], edges: [], metadata: { totalSets: 0, totalWaves: 0 } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('waves')));
  });

  it('returns { valid: false } for missing metadata field', () => {
    const result = validateDAG({ nodes: [], edges: [], waves: {} });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('metadata')));
  });

  it('returns { valid: false } for nodes missing id field', () => {
    const result = validateDAG({
      nodes: [{ wave: 1, status: 'pending' }],
      edges: [],
      waves: {},
      metadata: { totalSets: 1, totalWaves: 1 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('id')));
  });

  it('returns { valid: false } for nodes missing wave field', () => {
    const result = validateDAG({
      nodes: [{ id: 'A', status: 'pending' }],
      edges: [],
      waves: {},
      metadata: { totalSets: 1, totalWaves: 1 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('wave')));
  });

  it('returns { valid: false } for nodes missing status field', () => {
    const result = validateDAG({
      nodes: [{ id: 'A', wave: 1 }],
      edges: [],
      waves: {},
      metadata: { totalSets: 1, totalWaves: 1 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('status')));
  });

  it('returns { valid: false } for edges missing from field', () => {
    const result = validateDAG({
      nodes: [{ id: 'A', wave: 1, status: 'pending' }],
      edges: [{ to: 'A' }],
      waves: {},
      metadata: { totalSets: 1, totalWaves: 1 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('from')));
  });

  it('returns { valid: false } for edges missing to field', () => {
    const result = validateDAG({
      nodes: [{ id: 'A', wave: 1, status: 'pending' }],
      edges: [{ from: 'A' }],
      waves: {},
      metadata: { totalSets: 1, totalWaves: 1 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('to')));
  });

  it('returns { valid: false } for metadata missing totalSets', () => {
    const result = validateDAG({
      nodes: [],
      edges: [],
      waves: {},
      metadata: { totalWaves: 0 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('totalSets')));
  });

  it('returns { valid: false } for metadata missing totalWaves', () => {
    const result = validateDAG({
      nodes: [],
      edges: [],
      waves: {},
      metadata: { totalSets: 0 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('totalWaves')));
  });
});

// ────────────────────────────────────────────────────────────────
// getExecutionOrder
// ────────────────────────────────────────────────────────────────
describe('getExecutionOrder', () => {
  it('returns array of arrays representing execution waves', () => {
    const dag = createDAG(
      [{ id: 'auth' }, { id: 'data' }, { id: 'api' }],
      [
        { from: 'auth', to: 'api' },
        { from: 'data', to: 'api' },
      ]
    );
    const order = getExecutionOrder(dag);
    assert.ok(Array.isArray(order));
    assert.equal(order.length, 2);

    // Wave 1: auth and data (parallel)
    assert.ok(order[0].includes('auth'));
    assert.ok(order[0].includes('data'));
    assert.equal(order[0].length, 2);

    // Wave 2: api
    assert.deepStrictEqual(order[1], ['api']);
  });

  it('returns single wave for independent nodes', () => {
    const dag = createDAG([{ id: 'A' }, { id: 'B' }, { id: 'C' }], []);
    const order = getExecutionOrder(dag);
    assert.equal(order.length, 1);
    assert.equal(order[0].length, 3);
  });

  it('returns ordered waves for a deep chain', () => {
    const dag = createDAG(
      [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ]
    );
    const order = getExecutionOrder(dag);
    assert.equal(order.length, 3);
    assert.deepStrictEqual(order[0], ['A']);
    assert.deepStrictEqual(order[1], ['B']);
    assert.deepStrictEqual(order[2], ['C']);
  });
});

// ────────────────────────────────────────────────────────────────
// createDAGv2
// ────────────────────────────────────────────────────────────────
describe('createDAGv2', () => {
  it('returns version:2 DAG with typed nodes', () => {
    const nodes = [
      { id: 'auth', type: 'set' },
      { id: 'data', type: 'set' },
      { id: 'api', type: 'set' },
    ];
    const edges = [
      { from: 'auth', to: 'api' },
      { from: 'data', to: 'api' },
    ];
    const dag = createDAGv2(nodes, edges);

    assert.equal(dag.version, 2);
    assert.ok(Array.isArray(dag.nodes));
    assert.ok(Array.isArray(dag.edges));
    assert.ok(typeof dag.waves === 'object');
    assert.ok(typeof dag.metadata === 'object');

    // All nodes have wave, status, type
    for (const node of dag.nodes) {
      assert.ok(typeof node.wave === 'number', `Node ${node.id} should have wave`);
      assert.equal(node.status, 'pending');
      assert.ok(['set', 'wave', 'job'].includes(node.type), `Node ${node.id} should have valid type`);
    }
  });

  it('includes nodeTypes count in metadata', () => {
    const nodes = [
      { id: 'a', type: 'set' },
      { id: 'b', type: 'wave' },
      { id: 'c', type: 'job' },
      { id: 'd', type: 'job' },
    ];
    const dag = createDAGv2(nodes, []);

    assert.deepStrictEqual(dag.metadata.nodeTypes, { set: 1, wave: 1, job: 2 });
    assert.equal(dag.metadata.totalNodes, 4);
  });

  it('rejects nodes missing type field', () => {
    const nodes = [
      { id: 'a', type: 'set' },
      { id: 'b' }, // missing type
    ];
    assert.throws(
      () => createDAGv2(nodes, []),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('type'));
        return true;
      }
    );
  });

  it('rejects nodes with invalid type value', () => {
    const nodes = [{ id: 'a', type: 'invalid' }];
    assert.throws(
      () => createDAGv2(nodes, []),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('type'));
        return true;
      }
    );
  });

  it('rejects cross-type edges with descriptive error', () => {
    const nodes = [
      { id: 'a', type: 'set' },
      { id: 'b', type: 'job' },
    ];
    const edges = [{ from: 'a', to: 'b' }];
    assert.throws(
      () => createDAGv2(nodes, edges),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Cross-type edge'));
        assert.ok(err.message.includes('a'));
        assert.ok(err.message.includes('b'));
        assert.ok(err.message.includes('set'));
        assert.ok(err.message.includes('job'));
        return true;
      }
    );
  });

  it('allows same-type edges', () => {
    const nodes = [
      { id: 'a', type: 'job' },
      { id: 'b', type: 'job' },
    ];
    const edges = [{ from: 'a', to: 'b' }];
    const dag = createDAGv2(nodes, edges);
    assert.equal(dag.nodes.length, 2);
    assert.equal(dag.edges.length, 1);
  });

  it('assigns all nodes to wave 1 with no edges', () => {
    const nodes = [
      { id: 'x', type: 'set' },
      { id: 'y', type: 'wave' },
      { id: 'z', type: 'job' },
    ];
    const dag = createDAGv2(nodes, []);
    for (const node of dag.nodes) {
      assert.equal(node.wave, 1, `Node ${node.id} should be wave 1`);
    }
  });

  it('assigns correct waves for diamond pattern', () => {
    // A -> B, A -> C, B -> D, C -> D (all same type)
    const nodes = [
      { id: 'A', type: 'job' },
      { id: 'B', type: 'job' },
      { id: 'C', type: 'job' },
      { id: 'D', type: 'job' },
    ];
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
    ];
    const dag = createDAGv2(nodes, edges);

    const nodeMap = {};
    for (const n of dag.nodes) nodeMap[n.id] = n;

    assert.equal(nodeMap['A'].wave, 1);
    assert.equal(nodeMap['B'].wave, 2);
    assert.equal(nodeMap['C'].wave, 2);
    assert.equal(nodeMap['D'].wave, 3);
  });

  it('does not include set-specific checkpoint format in waves', () => {
    const nodes = [
      { id: 'a', type: 'job' },
      { id: 'b', type: 'job' },
    ];
    const edges = [{ from: 'a', to: 'b' }];
    const dag = createDAGv2(nodes, edges);

    // v2 waves should not have checkpoint.contracts or checkpoint.artifacts
    for (const waveKey of Object.keys(dag.waves)) {
      const wave = dag.waves[waveKey];
      assert.ok(!wave.checkpoint, `Wave ${waveKey} should not have v1 checkpoint format`);
    }
  });

  it('metadata includes created, totalNodes, totalWaves, maxParallelism', () => {
    const nodes = [
      { id: 'a', type: 'set' },
      { id: 'b', type: 'set' },
      { id: 'c', type: 'set' },
    ];
    const edges = [
      { from: 'a', to: 'c' },
      { from: 'b', to: 'c' },
    ];
    const dag = createDAGv2(nodes, edges);

    assert.ok(dag.metadata.created);
    assert.equal(dag.metadata.totalNodes, 3);
    assert.equal(dag.metadata.totalWaves, 2);
    assert.equal(dag.metadata.maxParallelism, 2);
  });

  it('preserves extra node properties', () => {
    const nodes = [{ id: 'a', type: 'job', parentId: 'parent1', label: 'My Job' }];
    const dag = createDAGv2(nodes, []);
    assert.equal(dag.nodes[0].parentId, 'parent1');
    assert.equal(dag.nodes[0].label, 'My Job');
  });
});

// ────────────────────────────────────────────────────────────────
// validateDAGv2
// ────────────────────────────────────────────────────────────────
describe('validateDAGv2', () => {
  it('returns { valid: true } for a well-formed v2 DAG', () => {
    const dag = createDAGv2(
      [{ id: 'A', type: 'job' }, { id: 'B', type: 'job' }],
      [{ from: 'A', to: 'B' }]
    );
    const result = validateDAGv2(dag);
    assert.deepStrictEqual(result, { valid: true });
  });

  it('returns { valid: false } if version is not 2', () => {
    const dag = createDAGv2(
      [{ id: 'A', type: 'job' }],
      []
    );
    dag.version = 1;
    const result = validateDAGv2(dag);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('version')));
  });

  it('returns { valid: false } for nodes missing type field', () => {
    const result = validateDAGv2({
      version: 2,
      nodes: [{ id: 'A', wave: 1, status: 'pending' }],
      edges: [],
      waves: { 1: { nodes: ['A'] } },
      metadata: { totalNodes: 1, totalWaves: 1, nodeTypes: { set: 0, wave: 0, job: 0 } },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('type')));
  });

  it('returns { valid: false } for nodes with invalid type value', () => {
    const result = validateDAGv2({
      version: 2,
      nodes: [{ id: 'A', wave: 1, status: 'pending', type: 'invalid' }],
      edges: [],
      waves: { 1: { nodes: ['A'] } },
      metadata: { totalNodes: 1, totalWaves: 1, nodeTypes: { set: 0, wave: 0, job: 0 } },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('type')));
  });

  it('returns { valid: false } for missing required top-level fields', () => {
    const result = validateDAGv2({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('returns { valid: false } for missing node id', () => {
    const result = validateDAGv2({
      version: 2,
      nodes: [{ wave: 1, status: 'pending', type: 'job' }],
      edges: [],
      waves: {},
      metadata: { totalNodes: 1, totalWaves: 1 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('id')));
  });

  it('returns { valid: false } for missing node wave', () => {
    const result = validateDAGv2({
      version: 2,
      nodes: [{ id: 'A', status: 'pending', type: 'job' }],
      edges: [],
      waves: {},
      metadata: { totalNodes: 1, totalWaves: 1 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('wave')));
  });

  it('returns { valid: false } for missing node status', () => {
    const result = validateDAGv2({
      version: 2,
      nodes: [{ id: 'A', wave: 1, type: 'job' }],
      edges: [],
      waves: {},
      metadata: { totalNodes: 1, totalWaves: 1 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('status')));
  });

  it('returns { valid: false } for edges missing from/to', () => {
    const result = validateDAGv2({
      version: 2,
      nodes: [{ id: 'A', wave: 1, status: 'pending', type: 'job' }],
      edges: [{ to: 'A' }],
      waves: {},
      metadata: { totalNodes: 1, totalWaves: 1 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('from')));
  });

  it('validates metadata for totalNodes and totalWaves', () => {
    const result = validateDAGv2({
      version: 2,
      nodes: [],
      edges: [],
      waves: {},
      metadata: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('totalNodes')));
    assert.ok(result.errors.some(e => e.includes('totalWaves')));
  });
});

// ────────────────────────────────────────────────────────────────
// tryLoadDAG
// ────────────────────────────────────────────────────────────────
describe('tryLoadDAG', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-dag-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null dag when DAG.json does not exist', () => {
    const result = tryLoadDAG(tmpDir);
    assert.equal(result.dag, null);
    assert.ok(result.path.endsWith(path.join('.planning', 'sets', 'DAG.json')));
  });

  it('returns parsed DAG when file exists and is valid JSON', () => {
    const dag = createDAG(
      [{ id: 'auth' }, { id: 'api' }],
      [{ from: 'auth', to: 'api' }]
    );
    const dagPath = path.join(tmpDir, '.planning', 'sets', 'DAG.json');
    fs.writeFileSync(dagPath, JSON.stringify(dag, null, 2));

    const result = tryLoadDAG(tmpDir);
    assert.ok(result.dag !== null, 'dag should not be null');
    assert.ok(Array.isArray(result.dag.nodes), 'dag.nodes should be an array');
    assert.equal(result.dag.nodes.length, 2);
    assert.ok(result.path.endsWith(DAG_CANONICAL_SUBPATH));
  });

  it('throws SyntaxError on malformed JSON (not ENOENT)', () => {
    const dagPath = path.join(tmpDir, '.planning', 'sets', 'DAG.json');
    fs.writeFileSync(dagPath, '{ broken json');

    assert.throws(
      () => tryLoadDAG(tmpDir),
      (err) => {
        assert.ok(err instanceof SyntaxError, 'should be a SyntaxError');
        return true;
      }
    );
  });

  it('returns canonical path string even on ENOENT', () => {
    const result = tryLoadDAG(tmpDir);
    const expectedPath = path.join(tmpDir, '.planning', 'sets', 'DAG.json');
    assert.equal(result.path, expectedPath);
  });

  it('DAG_CANONICAL_SUBPATH is the expected value', () => {
    assert.equal(DAG_CANONICAL_SUBPATH, path.join('.planning', 'sets', 'DAG.json'));
  });
});

// ────────────────────────────────────────────────────────────────
// createDAGv3
// ────────────────────────────────────────────────────────────────
describe('createDAGv3', () => {
  it('returns version:3 DAG with group fields on nodes', () => {
    const nodes = [{ id: 'auth' }, { id: 'data' }, { id: 'api' }];
    const edges = [
      { from: 'auth', to: 'api' },
      { from: 'data', to: 'api' },
    ];
    const dag = createDAGv3(nodes, edges);

    assert.equal(dag.version, 3);
    assert.ok(Array.isArray(dag.nodes));
    assert.ok(Array.isArray(dag.edges));
    assert.ok(typeof dag.waves === 'object');
    assert.ok(typeof dag.groups === 'object');
    assert.ok(typeof dag.metadata === 'object');

    for (const node of dag.nodes) {
      assert.ok(typeof node.wave === 'number', `Node ${node.id} should have wave`);
      assert.equal(node.status, 'pending');
      assert.equal(node.group, null);
      assert.equal(node.priority, null);
      assert.equal(node.description, null);
    }
  });

  it('nodes default to type set when type not provided', () => {
    const dag = createDAGv3([{ id: 'a' }, { id: 'b' }], []);
    for (const node of dag.nodes) {
      assert.equal(node.type, 'set');
    }
  });

  it('preserves explicit node type when provided', () => {
    const dag = createDAGv3([{ id: 'a', type: 'job' }], []);
    assert.equal(dag.nodes[0].type, 'job');
  });

  it('groups default to {} when no options passed', () => {
    const dag = createDAGv3([{ id: 'a' }], []);
    assert.deepStrictEqual(dag.groups, {});
  });

  it('groups populated when options.groups is provided', () => {
    const groups = {
      backend: { sets: ['auth', 'api'], description: 'Backend services' },
    };
    const dag = createDAGv3(
      [{ id: 'auth' }, { id: 'api' }],
      [{ from: 'auth', to: 'api' }],
      { groups }
    );
    assert.deepStrictEqual(dag.groups, groups);
  });

  it('nodes have group: null, priority: null, description: null by default', () => {
    const dag = createDAGv3([{ id: 'x' }], []);
    assert.equal(dag.nodes[0].group, null);
    assert.equal(dag.nodes[0].priority, null);
    assert.equal(dag.nodes[0].description, null);
  });

  it('waves use nodes key (not sets)', () => {
    const dag = createDAGv3([{ id: 'a' }, { id: 'b' }], []);
    assert.ok(dag.waves['1'].nodes, 'Wave should have nodes key');
    assert.equal(dag.waves['1'].sets, undefined, 'Wave should NOT have sets key');
  });

  it('metadata has totalNodes (not totalSets)', () => {
    const dag = createDAGv3([{ id: 'a' }, { id: 'b' }], []);
    assert.equal(dag.metadata.totalNodes, 2);
    assert.equal(dag.metadata.totalSets, undefined);
  });

  it('rejects duplicate node IDs', () => {
    assert.throws(
      () => createDAGv3([{ id: 'a' }, { id: 'a' }], []),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Duplicate'));
        return true;
      }
    );
  });

  it('rejects cycles', () => {
    assert.throws(
      () =>
        createDAGv3(
          [{ id: 'a' }, { id: 'b' }],
          [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'a' },
          ]
        ),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.toLowerCase().includes('cycle'));
        return true;
      }
    );
  });

  it('preserves extra node properties', () => {
    const dag = createDAGv3([{ id: 'a', label: 'My Node', custom: 42 }], []);
    assert.equal(dag.nodes[0].label, 'My Node');
    assert.equal(dag.nodes[0].custom, 42);
  });
});

// ────────────────────────────────────────────────────────────────
// validateDAGv3
// ────────────────────────────────────────────────────────────────
describe('validateDAGv3', () => {
  it('returns { valid: true } for well-formed v3 DAG', () => {
    const dag = createDAGv3(
      [{ id: 'A' }, { id: 'B' }],
      [{ from: 'A', to: 'B' }]
    );
    const result = validateDAGv3(dag);
    assert.deepStrictEqual(result, { valid: true });
  });

  it('returns { valid: false } when version is not 3', () => {
    const dag = createDAGv3([{ id: 'A' }], []);
    dag.version = 2;
    const result = validateDAGv3(dag);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('version')));
  });

  it('returns { valid: false } for missing nodes', () => {
    const result = validateDAGv3({
      version: 3,
      edges: [],
      waves: {},
      metadata: { totalNodes: 0, totalWaves: 0 },
      groups: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('nodes')));
  });

  it('returns { valid: false } for missing edges', () => {
    const result = validateDAGv3({
      version: 3,
      nodes: [],
      waves: {},
      metadata: { totalNodes: 0, totalWaves: 0 },
      groups: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('edges')));
  });

  it('returns { valid: false } for missing waves', () => {
    const result = validateDAGv3({
      version: 3,
      nodes: [],
      edges: [],
      metadata: { totalNodes: 0, totalWaves: 0 },
      groups: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('waves')));
  });

  it('returns { valid: false } for missing metadata', () => {
    const result = validateDAGv3({
      version: 3,
      nodes: [],
      edges: [],
      waves: {},
      groups: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('metadata')));
  });

  it('returns { valid: false } for missing groups', () => {
    const result = validateDAGv3({
      version: 3,
      nodes: [],
      edges: [],
      waves: {},
      metadata: { totalNodes: 0, totalWaves: 0 },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('groups')));
  });

  it('validates node required fields (id, wave, status)', () => {
    const result = validateDAGv3({
      version: 3,
      nodes: [{ foo: 'bar' }],
      edges: [],
      waves: {},
      metadata: { totalNodes: 1, totalWaves: 1 },
      groups: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('id')));
    assert.ok(result.errors.some((e) => e.includes('wave')));
    assert.ok(result.errors.some((e) => e.includes('status')));
  });

  it('validates edge required fields (from, to)', () => {
    const result = validateDAGv3({
      version: 3,
      nodes: [{ id: 'A', wave: 1, status: 'pending' }],
      edges: [{ x: 'y' }],
      waves: {},
      metadata: { totalNodes: 1, totalWaves: 1 },
      groups: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('from')));
    assert.ok(result.errors.some((e) => e.includes('to')));
  });

  it('validates metadata required fields (totalNodes, totalWaves)', () => {
    const result = validateDAGv3({
      version: 3,
      nodes: [],
      edges: [],
      waves: {},
      metadata: {},
      groups: {},
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('totalNodes')));
    assert.ok(result.errors.some((e) => e.includes('totalWaves')));
  });
});

// ────────────────────────────────────────────────────────────────
// migrateDAGv1toV3
// ────────────────────────────────────────────────────────────────
describe('migrateDAGv1toV3', () => {
  function makeV1DAG() {
    return createDAG(
      [{ id: 'auth' }, { id: 'data' }, { id: 'api' }],
      [
        { from: 'auth', to: 'api' },
        { from: 'data', to: 'api' },
      ]
    );
  }

  it('converts v1 DAG to v3 with correct version', () => {
    const v1 = makeV1DAG();
    const v3 = migrateDAGv1toV3(v1);
    assert.equal(v3.version, 3);
  });

  it('converts waves[N].sets to waves[N].nodes', () => {
    const v1 = makeV1DAG();
    const v3 = migrateDAGv1toV3(v1);
    for (const waveKey of Object.keys(v3.waves)) {
      assert.ok(Array.isArray(v3.waves[waveKey].nodes), `Wave ${waveKey} should have nodes array`);
      assert.equal(v3.waves[waveKey].sets, undefined, `Wave ${waveKey} should NOT have sets key`);
    }
  });

  it('removes checkpoint from waves', () => {
    const v1 = makeV1DAG();
    const v3 = migrateDAGv1toV3(v1);
    for (const waveKey of Object.keys(v3.waves)) {
      assert.equal(v3.waves[waveKey].checkpoint, undefined, `Wave ${waveKey} should NOT have checkpoint`);
    }
  });

  it('adds group/priority/description to nodes', () => {
    const v1 = makeV1DAG();
    const v3 = migrateDAGv1toV3(v1);
    for (const node of v3.nodes) {
      assert.equal(node.type, 'set');
      assert.equal(node.group, null);
      assert.equal(node.priority, null);
      assert.equal(node.description, null);
    }
  });

  it('renames metadata.totalSets to metadata.totalNodes', () => {
    const v1 = makeV1DAG();
    const v3 = migrateDAGv1toV3(v1);
    assert.equal(v3.metadata.totalNodes, 3);
    assert.equal(v3.metadata.totalSets, undefined);
  });

  it('adds groups: {}', () => {
    const v1 = makeV1DAG();
    const v3 = migrateDAGv1toV3(v1);
    assert.deepStrictEqual(v3.groups, {});
  });

  it('does not mutate input', () => {
    const v1 = makeV1DAG();
    const originalJSON = JSON.stringify(v1);
    migrateDAGv1toV3(v1);
    assert.equal(JSON.stringify(v1), originalJSON);
  });

  it('result passes validateDAGv3', () => {
    const v1 = makeV1DAG();
    const v3 = migrateDAGv1toV3(v1);
    const result = validateDAGv3(v3);
    assert.deepStrictEqual(result, { valid: true });
  });
});

// ────────────────────────────────────────────────────────────────
// migrateDAGv2toV3
// ────────────────────────────────────────────────────────────────
describe('migrateDAGv2toV3', () => {
  function makeV2DAG() {
    return createDAGv2(
      [
        { id: 'auth', type: 'set' },
        { id: 'data', type: 'set' },
        { id: 'api', type: 'set' },
      ],
      [
        { from: 'auth', to: 'api' },
        { from: 'data', to: 'api' },
      ]
    );
  }

  it('converts v2 DAG to v3 with correct version', () => {
    const v2 = makeV2DAG();
    const v3 = migrateDAGv2toV3(v2);
    assert.equal(v3.version, 3);
  });

  it('adds group/priority/description to nodes', () => {
    const v2 = makeV2DAG();
    const v3 = migrateDAGv2toV3(v2);
    for (const node of v3.nodes) {
      assert.equal(node.group, null);
      assert.equal(node.priority, null);
      assert.equal(node.description, null);
    }
  });

  it('preserves existing node type', () => {
    const v2 = makeV2DAG();
    const v3 = migrateDAGv2toV3(v2);
    for (const node of v3.nodes) {
      assert.equal(node.type, 'set');
    }
  });

  it('waves already use nodes -- preserved', () => {
    const v2 = makeV2DAG();
    const v3 = migrateDAGv2toV3(v2);
    for (const waveKey of Object.keys(v3.waves)) {
      assert.ok(Array.isArray(v3.waves[waveKey].nodes), `Wave ${waveKey} should have nodes array`);
    }
  });

  it('adds groups: {}', () => {
    const v2 = makeV2DAG();
    const v3 = migrateDAGv2toV3(v2);
    assert.deepStrictEqual(v3.groups, {});
  });

  it('does not mutate input', () => {
    const v2 = makeV2DAG();
    const originalJSON = JSON.stringify(v2);
    migrateDAGv2toV3(v2);
    assert.equal(JSON.stringify(v2), originalJSON);
  });

  it('result passes validateDAGv3', () => {
    const v2 = makeV2DAG();
    const v3 = migrateDAGv2toV3(v2);
    const result = validateDAGv3(v3);
    assert.deepStrictEqual(result, { valid: true });
  });
});

// ────────────────────────────────────────────────────────────────
// tryLoadDAG - migration
// ────────────────────────────────────────────────────────────────
describe('tryLoadDAG - migration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-dag-migrate-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns migrated: false when DAG.json does not exist', () => {
    const result = tryLoadDAG(tmpDir);
    assert.equal(result.dag, null);
    assert.equal(result.migrated, false);
  });

  it('returns migrated: true for v1 DAG (and dag is now v3)', () => {
    const v1 = createDAG(
      [{ id: 'a' }, { id: 'b' }],
      [{ from: 'a', to: 'b' }]
    );
    const dagPath = path.join(tmpDir, '.planning', 'sets', 'DAG.json');
    fs.writeFileSync(dagPath, JSON.stringify(v1, null, 2));

    const result = tryLoadDAG(tmpDir);
    assert.equal(result.migrated, true);
    assert.equal(result.dag.version, 3);
    assert.ok(result.dag.groups);
  });

  it('returns migrated: true for v2 DAG (and dag is now v3)', () => {
    const v2 = createDAGv2(
      [{ id: 'a', type: 'set' }, { id: 'b', type: 'set' }],
      [{ from: 'a', to: 'b' }]
    );
    const dagPath = path.join(tmpDir, '.planning', 'sets', 'DAG.json');
    fs.writeFileSync(dagPath, JSON.stringify(v2, null, 2));

    const result = tryLoadDAG(tmpDir);
    assert.equal(result.migrated, true);
    assert.equal(result.dag.version, 3);
    assert.ok(result.dag.groups);
  });

  it('returns migrated: false for v3 DAG', () => {
    const v3 = createDAGv3(
      [{ id: 'a' }, { id: 'b' }],
      [{ from: 'a', to: 'b' }]
    );
    const dagPath = path.join(tmpDir, '.planning', 'sets', 'DAG.json');
    fs.writeFileSync(dagPath, JSON.stringify(v3, null, 2));

    const result = tryLoadDAG(tmpDir);
    assert.equal(result.migrated, false);
    assert.equal(result.dag.version, 3);
  });

  it('migrated v1 DAG passes validateDAGv3', () => {
    const v1 = createDAG(
      [{ id: 'x' }, { id: 'y' }],
      [{ from: 'x', to: 'y' }]
    );
    const dagPath = path.join(tmpDir, '.planning', 'sets', 'DAG.json');
    fs.writeFileSync(dagPath, JSON.stringify(v1, null, 2));

    const result = tryLoadDAG(tmpDir);
    const validation = validateDAGv3(result.dag);
    assert.deepStrictEqual(validation, { valid: true });
  });
});

// ────────────────────────────────────────────────────────────────
// getExecutionOrder - v2/v3 compat
// ────────────────────────────────────────────────────────────────
describe('getExecutionOrder - v2/v3 compat', () => {
  it('works with v2 DAG (waves use .nodes)', () => {
    const dag = createDAGv2(
      [
        { id: 'a', type: 'set' },
        { id: 'b', type: 'set' },
        { id: 'c', type: 'set' },
      ],
      [
        { from: 'a', to: 'c' },
        { from: 'b', to: 'c' },
      ]
    );
    const order = getExecutionOrder(dag);
    assert.equal(order.length, 2);
    assert.ok(order[0].includes('a'));
    assert.ok(order[0].includes('b'));
    assert.deepStrictEqual(order[1], ['c']);
  });

  it('works with v3 DAG (waves use .nodes)', () => {
    const dag = createDAGv3(
      [{ id: 'x' }, { id: 'y' }, { id: 'z' }],
      [
        { from: 'x', to: 'z' },
        { from: 'y', to: 'z' },
      ]
    );
    const order = getExecutionOrder(dag);
    assert.equal(order.length, 2);
    assert.ok(order[0].includes('x'));
    assert.ok(order[0].includes('y'));
    assert.deepStrictEqual(order[1], ['z']);
  });

  it('still works with v1 DAG (waves use .sets)', () => {
    const dag = createDAG(
      [{ id: 'p' }, { id: 'q' }, { id: 'r' }],
      [
        { from: 'p', to: 'r' },
        { from: 'q', to: 'r' },
      ]
    );
    const order = getExecutionOrder(dag);
    assert.equal(order.length, 2);
    assert.ok(order[0].includes('p'));
    assert.ok(order[0].includes('q'));
    assert.deepStrictEqual(order[1], ['r']);
  });
});
