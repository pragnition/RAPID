'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  partitionIntoGroups,
  annotateDAGWithGroups,
  generateGroupReport,
} = require('./group.cjs');
const { createDAGv3 } = require('./dag.cjs');

// ────────────────────────────────────────────────────────────────
// Helper: create a simple v3 DAG for testing
// ────────────────────────────────────────────────────────────────
function makeDag(nodeIds, edges = []) {
  return createDAGv3(
    nodeIds.map((id) => ({ id })),
    edges
  );
}

// ────────────────────────────────────────────────────────────────
// partitionIntoGroups
// ────────────────────────────────────────────────────────────────
describe('partitionIntoGroups', () => {
  it('assigns all sets to G1 when numDevelopers is 1', () => {
    const dag = makeDag(['alpha', 'beta', 'gamma']);
    const result = partitionIntoGroups(dag, {}, 1);

    assert.deepStrictEqual(Object.keys(result.groups), ['G1']);
    assert.equal(result.groups['G1'].sets.length, 3);
    for (const setId of ['alpha', 'beta', 'gamma']) {
      assert.equal(result.assignments[setId], 'G1');
    }
  });

  it('creates N groups when numDevelopers is N', () => {
    const dag = makeDag(['a', 'b', 'c', 'd']);
    const result = partitionIntoGroups(dag, {}, 3);

    assert.equal(Object.keys(result.groups).length, 3);
    assert.deepStrictEqual(Object.keys(result.groups).sort(), [
      'G1',
      'G2',
      'G3',
    ]);
  });

  it('produces deterministic output (run twice with same input, same result)', () => {
    const dag = makeDag(['x', 'y', 'z', 'w']);
    const contracts = {
      x: { fileOwnership: ['src/a.js', 'src/b.js'] },
      y: { fileOwnership: ['src/b.js', 'src/c.js'] },
      z: { fileOwnership: ['src/d.js'] },
      w: { fileOwnership: ['src/e.js'] },
    };

    const result1 = partitionIntoGroups(dag, contracts, 2);
    const result2 = partitionIntoGroups(dag, contracts, 2);

    assert.deepStrictEqual(result1.assignments, result2.assignments);
    assert.deepStrictEqual(result1.groups, result2.groups);
    assert.deepStrictEqual(result1.crossGroupEdges, result2.crossGroupEdges);
  });

  it('minimizes cross-group file conflicts (sets sharing files end up in same group)', () => {
    const dag = makeDag(['a', 'b', 'c']);
    // a and b share many files, c has no overlap
    const contracts = {
      a: {
        fileOwnership: ['shared1.js', 'shared2.js', 'shared3.js', 'a-own.js'],
      },
      b: {
        fileOwnership: ['shared1.js', 'shared2.js', 'shared3.js', 'b-own.js'],
      },
      c: { fileOwnership: ['c-own.js'] },
    };

    const result = partitionIntoGroups(dag, contracts, 2);

    // a and b should be in the same group since they share 3 files
    assert.equal(
      result.assignments['a'],
      result.assignments['b'],
      'Sets sharing files should be in the same group'
    );
    // c should be in a different group (balance)
    assert.notEqual(
      result.assignments['a'],
      result.assignments['c'],
      'Non-conflicting set should balance to other group'
    );
  });

  it('balances group sizes when no conflicts exist (4 sets, 2 groups = 2 each)', () => {
    const dag = makeDag(['a', 'b', 'c', 'd']);
    // No file ownership = no conflicts
    const result = partitionIntoGroups(dag, {}, 2);

    assert.equal(result.groups['G1'].sets.length, 2);
    assert.equal(result.groups['G2'].sets.length, 2);
  });

  it('handles sets with no contract data (no file ownership)', () => {
    const dag = makeDag(['a', 'b', 'c']);
    // a has contract, b and c do not
    const contracts = {
      a: { fileOwnership: ['src/x.js'] },
    };

    const result = partitionIntoGroups(dag, contracts, 2);

    // Should not throw, all sets assigned
    assert.equal(Object.keys(result.assignments).length, 3);
    assert.ok(result.assignments['a']);
    assert.ok(result.assignments['b']);
    assert.ok(result.assignments['c']);
  });

  it('handles numDevelopers >= number of sets (each set gets own group)', () => {
    const dag = makeDag(['a', 'b']);
    const result = partitionIntoGroups(dag, {}, 5);

    // 5 groups created, but only 2 have sets
    assert.equal(Object.keys(result.groups).length, 5);
    // Each set should be in its own group due to balance tiebreaker
    assert.notEqual(result.assignments['a'], result.assignments['b']);
  });

  it('cross-group edges are correctly identified', () => {
    const dag = makeDag(['a', 'b', 'c'], [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
    ]);
    // Force a and b into different groups by giving them no conflicts
    const result = partitionIntoGroups(dag, {}, 3);

    // With 3 sets and 3 groups, each gets its own group
    // Both edges should be cross-group
    assert.equal(result.crossGroupEdges.length, 2);
    for (const edge of result.crossGroupEdges) {
      assert.ok(edge.from);
      assert.ok(edge.to);
      assert.ok(edge.fromGroup);
      assert.ok(edge.toGroup);
      assert.notEqual(edge.fromGroup, edge.toGroup);
    }
  });

  it('assignments map contains all set IDs', () => {
    const dag = makeDag(['alpha', 'beta', 'gamma', 'delta']);
    const result = partitionIntoGroups(dag, {}, 2);

    const assignedIds = Object.keys(result.assignments).sort();
    assert.deepStrictEqual(assignedIds, [
      'alpha',
      'beta',
      'delta',
      'gamma',
    ]);
  });

  it('handles contracts with definition.ownedFiles format', () => {
    const dag = makeDag(['a', 'b']);
    const contracts = {
      a: { definition: { ownedFiles: ['src/shared.js', 'src/a.js'] } },
      b: { definition: { ownedFiles: ['src/shared.js', 'src/b.js'] } },
    };

    const result = partitionIntoGroups(dag, contracts, 2);

    // a and b share src/shared.js, so conflict-minimization puts them together
    assert.equal(
      result.assignments['a'],
      result.assignments['b'],
      'Sets sharing files via definition.ownedFiles should be in same group'
    );
  });

  it('handles null/undefined contracts gracefully', () => {
    const dag = makeDag(['a', 'b']);
    const result = partitionIntoGroups(dag, null, 2);
    assert.equal(Object.keys(result.assignments).length, 2);
  });

  it('no cross-group edges when all sets in same group', () => {
    const dag = makeDag(['a', 'b'], [{ from: 'a', to: 'b' }]);
    const result = partitionIntoGroups(dag, {}, 1);
    assert.equal(result.crossGroupEdges.length, 0);
  });
});

// ────────────────────────────────────────────────────────────────
// annotateDAGWithGroups
// ────────────────────────────────────────────────────────────────
describe('annotateDAGWithGroups', () => {
  it('sets group field on each node from assignments', () => {
    const dag = makeDag(['a', 'b', 'c']);
    const groupResult = {
      groups: {
        G1: { sets: ['a', 'b'] },
        G2: { sets: ['c'] },
      },
      assignments: { a: 'G1', b: 'G1', c: 'G2' },
      crossGroupEdges: [],
    };

    const annotated = annotateDAGWithGroups(dag, groupResult);

    const nodeMap = {};
    for (const n of annotated.nodes) nodeMap[n.id] = n;

    assert.equal(nodeMap['a'].group, 'G1');
    assert.equal(nodeMap['b'].group, 'G1');
    assert.equal(nodeMap['c'].group, 'G2');
  });

  it('sets top-level groups field from groupResult.groups', () => {
    const dag = makeDag(['a', 'b']);
    const groupResult = {
      groups: {
        G1: { sets: ['a'] },
        G2: { sets: ['b'] },
      },
      assignments: { a: 'G1', b: 'G2' },
      crossGroupEdges: [],
    };

    const annotated = annotateDAGWithGroups(dag, groupResult);

    assert.deepStrictEqual(annotated.groups, groupResult.groups);
  });

  it('does not mutate the input DAG', () => {
    const dag = makeDag(['a', 'b']);
    const originalJSON = JSON.stringify(dag);

    const groupResult = {
      groups: { G1: { sets: ['a', 'b'] } },
      assignments: { a: 'G1', b: 'G1' },
      crossGroupEdges: [],
    };

    annotateDAGWithGroups(dag, groupResult);

    assert.equal(JSON.stringify(dag), originalJSON, 'Input DAG should not be mutated');
  });

  it('handles nodes not in assignments (group stays null)', () => {
    const dag = makeDag(['a', 'b', 'c']);
    const groupResult = {
      groups: { G1: { sets: ['a'] } },
      assignments: { a: 'G1' },
      crossGroupEdges: [],
    };

    const annotated = annotateDAGWithGroups(dag, groupResult);

    const nodeMap = {};
    for (const n of annotated.nodes) nodeMap[n.id] = n;

    assert.equal(nodeMap['a'].group, 'G1');
    assert.equal(nodeMap['b'].group, null);
    assert.equal(nodeMap['c'].group, null);
  });
});

// ────────────────────────────────────────────────────────────────
// generateGroupReport
// ────────────────────────────────────────────────────────────────
describe('generateGroupReport', () => {
  it('returns markdown string with group headers', () => {
    const groupResult = {
      groups: {
        G1: { sets: ['auth', 'api'] },
        G2: { sets: ['data'] },
      },
      assignments: { auth: 'G1', api: 'G1', data: 'G2' },
      crossGroupEdges: [],
    };

    const report = generateGroupReport(groupResult);

    assert.ok(report.includes('## Developer Group Assignments'));
    assert.ok(report.includes('### G1'));
    assert.ok(report.includes('### G2'));
    assert.ok(report.includes('- api'));
    assert.ok(report.includes('- auth'));
    assert.ok(report.includes('- data'));
  });

  it('includes cross-group dependencies table when edges exist', () => {
    const groupResult = {
      groups: {
        G1: { sets: ['a'] },
        G2: { sets: ['b'] },
      },
      assignments: { a: 'G1', b: 'G2' },
      crossGroupEdges: [
        { from: 'a', to: 'b', fromGroup: 'G1', toGroup: 'G2' },
      ],
    };

    const report = generateGroupReport(groupResult);

    assert.ok(report.includes('### Cross-Group Dependencies'));
    assert.ok(report.includes('| From | To | From Group | To Group |'));
    assert.ok(report.includes('| a | b | G1 | G2 |'));
  });

  it('omits cross-group section when no cross-group edges', () => {
    const groupResult = {
      groups: { G1: { sets: ['a', 'b'] } },
      assignments: { a: 'G1', b: 'G1' },
      crossGroupEdges: [],
    };

    const report = generateGroupReport(groupResult);

    assert.ok(!report.includes('### Cross-Group Dependencies'));
    assert.ok(!report.includes('| From |'));
  });

  it('includes summary line with correct counts', () => {
    const groupResult = {
      groups: {
        G1: { sets: ['a', 'b'] },
        G2: { sets: ['c'] },
      },
      assignments: { a: 'G1', b: 'G1', c: 'G2' },
      crossGroupEdges: [
        { from: 'a', to: 'c', fromGroup: 'G1', toGroup: 'G2' },
      ],
    };

    const report = generateGroupReport(groupResult);

    assert.ok(
      report.includes('**2 groups, 3 sets, 1 cross-group dependencies**'),
      `Report should contain summary line. Got:\n${report}`
    );
  });
});
