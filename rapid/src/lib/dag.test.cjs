'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  toposort,
  assignWaves,
  createDAG,
  validateDAG,
  getExecutionOrder,
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
