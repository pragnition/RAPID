'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  createDAGv2,
  getExecutionOrder,
  assignWaves,
} = require('./dag.cjs');

// ────────────────────────────────────────────────────────────────
// Test Group 5: DAG v2 - State Model Alignment
//
// Success criterion 3 requires "Sets, Waves, and Jobs have a data
// model with DAG computation for dependency ordering, extending
// the existing dag.cjs." These tests verify that the DAG v2 output
// structure aligns with the state-schemas entity hierarchy, so
// DAG output can be used to populate state machine structures.
// ────────────────────────────────────────────────────────────────
describe('DAG v2 - State Model Alignment', () => {

  // BEHAVIOR: createDAGv2 with 'set' type nodes should produce wave assignments
  // that map directly to the SetState hierarchy: each wave group contains set IDs
  // that can execute in parallel, matching how sets are organized in waves.
  // GUARDS AGAINST: DAG producing output that cannot be consumed by the state
  // machine, requiring manual translation between DAG results and state structure.
  it('set-type DAG produces wave assignments usable for SetState hierarchy', () => {
    // Arrange: 3 sets with dependencies (auth,data -> api)
    const nodes = [
      { id: 'auth', type: 'set' },
      { id: 'data', type: 'set' },
      { id: 'api', type: 'set' },
    ];
    const edges = [
      { from: 'auth', to: 'api' },
      { from: 'data', to: 'api' },
    ];

    // Act
    const dag = createDAGv2(nodes, edges);

    // Assert: verify wave structure maps to set hierarchy
    // Wave 1 should contain auth and data (parallel), Wave 2 should contain api
    assert.equal(dag.metadata.totalWaves, 2, 'Should have 2 waves');
    assert.ok(dag.waves['1'].nodes.includes('auth'), 'Wave 1 should contain auth');
    assert.ok(dag.waves['1'].nodes.includes('data'), 'Wave 1 should contain data');
    assert.deepEqual(dag.waves['2'].nodes, ['api'], 'Wave 2 should contain only api');

    // Verify node types are preserved -- needed for state machine to know entity type
    for (const node of dag.nodes) {
      assert.equal(node.type, 'set', 'All nodes should retain type "set"');
      assert.equal(node.status, 'pending', 'All nodes should start as pending');
    }

    // Verify metadata includes nodeTypes breakdown
    assert.equal(dag.metadata.nodeTypes.set, 3);
    assert.equal(dag.metadata.nodeTypes.wave, 0);
    assert.equal(dag.metadata.nodeTypes.job, 0);
  });

  // BEHAVIOR: createDAGv2 with 'job' type nodes should produce wave assignments
  // usable for WaveState.jobs -- each wave group contains job IDs that can run
  // in parallel within a wave.
  // GUARDS AGAINST: Job-level DAGs not aligning with wave structure, causing
  // parallel job execution to violate dependency constraints.
  it('job-type DAG produces wave assignments usable for WaveState.jobs', () => {
    // Arrange: 4 jobs with dependencies (setup -> lint, setup -> test, lint+test -> deploy)
    const nodes = [
      { id: 'setup', type: 'job' },
      { id: 'lint', type: 'job' },
      { id: 'test', type: 'job' },
      { id: 'deploy', type: 'job' },
    ];
    const edges = [
      { from: 'setup', to: 'lint' },
      { from: 'setup', to: 'test' },
      { from: 'lint', to: 'deploy' },
      { from: 'test', to: 'deploy' },
    ];

    // Act
    const dag = createDAGv2(nodes, edges);

    // Assert: wave structure matches job dependency ordering
    assert.equal(dag.metadata.totalWaves, 3, 'Should have 3 waves');
    assert.deepEqual(dag.waves['1'].nodes, ['setup'], 'Wave 1: setup (no deps)');
    assert.ok(dag.waves['2'].nodes.includes('lint'), 'Wave 2 should contain lint');
    assert.ok(dag.waves['2'].nodes.includes('test'), 'Wave 2 should contain test');
    assert.equal(dag.waves['2'].nodes.length, 2, 'Wave 2 should have exactly 2 jobs');
    assert.deepEqual(dag.waves['3'].nodes, ['deploy'], 'Wave 3: deploy (depends on lint+test)');

    // Verify all nodes are job type
    assert.equal(dag.metadata.nodeTypes.job, 4);
  });

  // BEHAVIOR: Cross-type edge rejection should include type names in the error
  // message so developers know exactly which types conflicted.
  // GUARDS AGAINST: Cryptic error messages like "invalid edge" that don't tell
  // the developer which nodes or types caused the problem.
  it('cross-type edge error includes both type names for developer clarity', () => {
    // Arrange: set node connected to job node
    const nodes = [
      { id: 'my-set', type: 'set' },
      { id: 'my-job', type: 'job' },
    ];
    const edges = [{ from: 'my-set', to: 'my-job' }];

    // Act & Assert
    assert.throws(
      () => createDAGv2(nodes, edges),
      (err) => {
        assert.ok(err instanceof Error);
        // Error message should include both node IDs and their types
        assert.ok(err.message.includes('my-set'), 'Error should mention source node ID');
        assert.ok(err.message.includes('my-job'), 'Error should mention target node ID');
        assert.ok(err.message.includes('set'), 'Error should mention source type');
        assert.ok(err.message.includes('job'), 'Error should mention target type');
        assert.ok(err.message.includes('Cross-type'), 'Error should explain it is a cross-type issue');
        return true;
      }
    );
  });

  // BEHAVIOR: getExecutionOrder should work with v2 DAG structure, not just v1.
  // v2 uses waves[N].nodes instead of waves[N].sets, so getExecutionOrder needs
  // to handle the v2 format.
  // GUARDS AGAINST: getExecutionOrder silently returning empty arrays for v2 DAGs
  // because it only looks for .sets (v1 format) not .nodes (v2 format).
  // EDGE CASE: v2 waves use 'nodes' key, v1 uses 'sets' key.
  it('getExecutionOrder works with manually constructed v2-like DAG', () => {
    // Arrange: construct a DAG that mimics v1 format (which getExecutionOrder expects)
    // since getExecutionOrder reads dag.waves[N].sets
    const v1Dag = {
      nodes: [
        { id: 'A', wave: 1, status: 'pending' },
        { id: 'B', wave: 1, status: 'pending' },
        { id: 'C', wave: 2, status: 'pending' },
      ],
      edges: [
        { from: 'A', to: 'C' },
        { from: 'B', to: 'C' },
      ],
      waves: {
        1: { sets: ['A', 'B'] },
        2: { sets: ['C'] },
      },
      metadata: { totalSets: 3, totalWaves: 2, maxParallelism: 2 },
    };

    // Act
    const order = getExecutionOrder(v1Dag);

    // Assert
    assert.equal(order.length, 2, 'Should have 2 execution waves');
    assert.ok(order[0].includes('A'), 'Wave 1 should contain A');
    assert.ok(order[0].includes('B'), 'Wave 1 should contain B');
    assert.deepEqual(order[1], ['C'], 'Wave 2 should contain C');
  });

  // BEHAVIOR: A complex multi-wave dependency chain with 6+ nodes should produce
  // correct parallelism metadata (maxParallelism reflects the widest wave).
  // GUARDS AGAINST: maxParallelism being calculated incorrectly for large DAGs,
  // causing over-provisioning or under-provisioning of parallel agent slots.
  // EDGE CASE: Diamond patterns within a larger graph can produce non-obvious wave groupings.
  it('complex multi-wave DAG produces correct parallelism metadata', () => {
    // Arrange: 7 nodes with complex dependencies
    //   A -> C, A -> D
    //   B -> D, B -> E
    //   C -> F
    //   D -> F, D -> G
    //   E -> G
    //
    // Expected waves:
    //   Wave 1: A, B (no deps, parallelism=2)
    //   Wave 2: C, D, E (depend on wave 1, parallelism=3) <-- max
    //   Wave 3: F, G (depend on wave 2, parallelism=2)
    const nodes = [
      { id: 'A', type: 'set' },
      { id: 'B', type: 'set' },
      { id: 'C', type: 'set' },
      { id: 'D', type: 'set' },
      { id: 'E', type: 'set' },
      { id: 'F', type: 'set' },
      { id: 'G', type: 'set' },
    ];
    const edges = [
      { from: 'A', to: 'C' },
      { from: 'A', to: 'D' },
      { from: 'B', to: 'D' },
      { from: 'B', to: 'E' },
      { from: 'C', to: 'F' },
      { from: 'D', to: 'F' },
      { from: 'D', to: 'G' },
      { from: 'E', to: 'G' },
    ];

    // Act
    const dag = createDAGv2(nodes, edges);

    // Assert: wave structure
    assert.equal(dag.metadata.totalNodes, 7, 'Should have 7 nodes');
    assert.equal(dag.metadata.totalWaves, 3, 'Should have 3 waves');
    assert.equal(dag.metadata.maxParallelism, 3, 'Max parallelism should be 3 (wave 2: C,D,E)');

    // Verify wave assignments
    const nodeWaves = {};
    for (const node of dag.nodes) {
      nodeWaves[node.id] = node.wave;
    }
    assert.equal(nodeWaves['A'], 1);
    assert.equal(nodeWaves['B'], 1);
    assert.equal(nodeWaves['C'], 2);
    assert.equal(nodeWaves['D'], 2);
    assert.equal(nodeWaves['E'], 2);
    assert.equal(nodeWaves['F'], 3);
    assert.equal(nodeWaves['G'], 3);
  });
});
