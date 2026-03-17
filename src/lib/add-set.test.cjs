'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { addSetToMilestone, recalculateDAG } = require('./add-set.cjs');

/**
 * Create a temporary directory with a valid STATE.json containing
 * milestone "v1" with sets "set-a" and "set-b".
 */
function createTestState(tmpDir) {
  const state = {
    version: 1,
    projectName: 'test-project',
    currentMilestone: 'v1',
    milestones: [{
      id: 'v1',
      name: 'Version 1',
      sets: [
        { id: 'set-a', status: 'pending', waves: [] },
        { id: 'set-b', status: 'pending', waves: [] },
      ],
    }],
    lastUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.json'),
    JSON.stringify(state, null, 2)
  );
  return state;
}

/**
 * Read STATE.json from disk and return parsed object.
 */
function readStateFromDisk(tmpDir) {
  return JSON.parse(
    fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.json'), 'utf-8')
  );
}

/**
 * Write a CONTRACT.json file for a given set.
 */
function writeContract(tmpDir, setId, contractJson) {
  const setDir = path.join(tmpDir, '.planning', 'sets', setId);
  fs.mkdirSync(setDir, { recursive: true });
  fs.writeFileSync(
    path.join(setDir, 'CONTRACT.json'),
    JSON.stringify(contractJson, null, 2)
  );
}

describe('add-set', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-add-set-'));
    createTestState(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- addSetToMilestone tests ---

  describe('addSetToMilestone', () => {
    it('adds a new set to the specified milestone', async () => {
      const result = await addSetToMilestone(tmpDir, 'v1', 'set-c', 'Set C', []);

      assert.equal(result.setId, 'set-c');
      assert.equal(result.milestoneId, 'v1');
      assert.deepEqual(result.depsValidated, []);

      // Verify STATE.json on disk
      const state = readStateFromDisk(tmpDir);
      const milestone = state.milestones.find(m => m.id === 'v1');
      const setC = milestone.sets.find(s => s.id === 'set-c');
      assert.ok(setC, 'set-c should exist in milestone');
      assert.equal(setC.status, 'pending');
      assert.deepEqual(setC.waves, []);
    });

    it('throws on duplicate set ID', async () => {
      await assert.rejects(
        () => addSetToMilestone(tmpDir, 'v1', 'set-a', 'Set A', []),
        (err) => {
          assert.ok(err.message.match(/already exists/), `Expected 'already exists' in: ${err.message}`);
          return true;
        }
      );
    });

    it('throws on non-existent milestone', async () => {
      await assert.rejects(
        () => addSetToMilestone(tmpDir, 'v99', 'set-c', 'Set C', []),
        (err) => {
          assert.ok(err.message.match(/not found/i), `Expected 'not found' in: ${err.message}`);
          return true;
        }
      );
    });

    it('validates dependencies exist', async () => {
      const result = await addSetToMilestone(tmpDir, 'v1', 'set-c', 'Set C', ['set-a']);
      assert.deepEqual(result.depsValidated, ['set-a']);

      // Verify set-c was added
      const state = readStateFromDisk(tmpDir);
      const milestone = state.milestones.find(m => m.id === 'v1');
      assert.ok(milestone.sets.find(s => s.id === 'set-c'));
    });

    it('throws on non-existent dependency', async () => {
      await assert.rejects(
        () => addSetToMilestone(tmpDir, 'v1', 'set-c', 'Set C', ['nonexistent']),
        (err) => {
          assert.ok(err.message.match(/not found/i), `Expected 'not found' in: ${err.message}`);
          assert.ok(err.message.includes('nonexistent'), `Expected 'nonexistent' in: ${err.message}`);
          return true;
        }
      );
    });

    it('recalculates DAG.json after adding set', async () => {
      await addSetToMilestone(tmpDir, 'v1', 'set-c', 'Set C', []);

      const dagPath = path.join(tmpDir, '.planning', 'sets', 'DAG.json');
      assert.ok(fs.existsSync(dagPath), 'DAG.json should exist after add-set');

      const dag = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
      const nodeIds = dag.nodes.map(n => n.id);
      assert.ok(nodeIds.includes('set-a'), 'DAG should contain set-a');
      assert.ok(nodeIds.includes('set-b'), 'DAG should contain set-b');
      assert.ok(nodeIds.includes('set-c'), 'DAG should contain set-c');
      assert.equal(dag.nodes.length, 3);
    });

    it('recalculates OWNERSHIP.json after adding set', async () => {
      await addSetToMilestone(tmpDir, 'v1', 'set-c', 'Set C', []);

      const ownerPath = path.join(tmpDir, '.planning', 'sets', 'OWNERSHIP.json');
      assert.ok(fs.existsSync(ownerPath), 'OWNERSHIP.json should exist after add-set');

      const ownership = JSON.parse(fs.readFileSync(ownerPath, 'utf-8'));
      assert.equal(ownership.version, 1);
      assert.ok(ownership.ownership !== undefined, 'ownership map should exist');
    });
  });

  // --- recalculateDAG tests ---

  describe('recalculateDAG', () => {
    it('builds DAG from all sets in milestone', async () => {
      // Add a third set to state manually (so we have 3 sets)
      const state = readStateFromDisk(tmpDir);
      state.milestones[0].sets.push({ id: 'set-c', status: 'pending', waves: [] });
      fs.writeFileSync(
        path.join(tmpDir, '.planning', 'STATE.json'),
        JSON.stringify(state, null, 2)
      );

      const result = await recalculateDAG(tmpDir, 'v1');
      assert.equal(result.dag.nodes.length, 3);
      const nodeIds = result.dag.nodes.map(n => n.id);
      assert.ok(nodeIds.includes('set-a'));
      assert.ok(nodeIds.includes('set-b'));
      assert.ok(nodeIds.includes('set-c'));
    });

    it('reads edges from CONTRACT.json imports', async () => {
      // Create CONTRACT.json for set-b with dependency on set-a
      writeContract(tmpDir, 'set-b', {
        exports: { functions: [], types: [] },
        imports: {
          fromSets: [{ set: 'set-a' }],
        },
      });

      const result = await recalculateDAG(tmpDir, 'v1');
      assert.equal(result.dag.edges.length, 1);
      assert.deepEqual(result.dag.edges[0], { from: 'set-a', to: 'set-b' });
    });

    it('handles sets without CONTRACT.json gracefully', async () => {
      // No CONTRACT.json files created -- should not crash
      const result = await recalculateDAG(tmpDir, 'v1');
      assert.equal(result.dag.nodes.length, 2);
      assert.equal(result.dag.edges.length, 0);
    });

    it('writes OWNERSHIP.json based on CONTRACT.json fileOwnership', async () => {
      // Create CONTRACT.json with fileOwnership for set-a
      writeContract(tmpDir, 'set-a', {
        exports: { functions: [], types: [] },
        fileOwnership: ['src/lib/alpha.cjs', 'src/lib/alpha.test.cjs'],
      });

      const result = await recalculateDAG(tmpDir, 'v1');

      const ownerPath = path.join(tmpDir, '.planning', 'sets', 'OWNERSHIP.json');
      assert.ok(fs.existsSync(ownerPath));

      const ownership = JSON.parse(fs.readFileSync(ownerPath, 'utf-8'));
      assert.equal(ownership.ownership['src/lib/alpha.cjs'], 'set-a');
      assert.equal(ownership.ownership['src/lib/alpha.test.cjs'], 'set-a');
    });
  });
});
