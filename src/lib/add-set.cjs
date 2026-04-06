'use strict';

/**
 * add-set.cjs - Add a new set to a milestone and recalculate DAG/OWNERSHIP.
 *
 * Provides:
 *   - addSetToMilestone(cwd, milestoneId, setId, setName, deps) -- atomic set insertion
 *   - recalculateDAG(cwd, milestoneId) -- rebuild DAG.json and OWNERSHIP.json from state + CONTRACT.json
 *
 * Uses withStateTransaction for atomic STATE.json mutation with lock protection.
 * CONTRACT.json is the source of truth for dependency edges and file ownership.
 */

const fs = require('fs');
const path = require('path');
const { readState, withStateTransaction, findMilestone } = require('./state-machine.cjs');
const { createDAG, tryLoadDAG } = require('./dag.cjs');
const { createOwnershipMap } = require('./contract.cjs');
const { writeDAG, writeOwnership } = require('./plan.cjs');
const { partitionIntoGroups, annotateDAGWithGroups } = require('./group.cjs');

/**
 * Add a new set to a milestone atomically, then recalculate DAG and OWNERSHIP.
 *
 * @param {string} cwd - Project root directory
 * @param {string} milestoneId - Target milestone ID
 * @param {string} setId - Unique set ID to add
 * @param {string} setName - Human-readable set name (reserved for DEFINITION.md)
 * @param {string[]|string} [deps=[]] - Dependency set IDs (array or comma-separated string)
 * @returns {Promise<{setId: string, milestoneId: string, depsValidated: string[]}>}
 * @throws {Error} If set ID already exists in the milestone
 * @throws {Error} If any dependency set ID is not found in the milestone
 */
async function addSetToMilestone(cwd, milestoneId, setId, setName, deps) {
  // Normalize deps to an array
  let depList = [];
  if (deps) {
    if (typeof deps === 'string') {
      depList = deps.split(',').map(d => d.trim()).filter(Boolean);
    } else if (Array.isArray(deps)) {
      depList = deps;
    }
  }

  await withStateTransaction(cwd, (state) => {
    const milestone = findMilestone(state, milestoneId);

    // Check for duplicate set ID
    if (milestone.sets.some(s => s.id === setId)) {
      throw new Error(`Set "${setId}" already exists in milestone "${milestoneId}"`);
    }

    // Validate dependencies exist in the milestone
    for (const dep of depList) {
      if (!milestone.sets.some(s => s.id === dep)) {
        const available = milestone.sets.map(s => s.id).join(', ') || '(none)';
        throw new Error(
          `Dependency "${dep}" not found in milestone "${milestoneId}". Available sets: ${available}`
        );
      }
    }

    // Add the new set
    milestone.sets.push({
      id: setId,
      status: 'pending',
      waves: [],
    });
  });

  // After transaction completes, recalculate DAG and OWNERSHIP
  await recalculateDAG(cwd, milestoneId);

  // Auto-regroup if team size > 1
  await autoRegroup(cwd);

  return { setId, milestoneId, depsValidated: depList };
}

/**
 * Rebuild DAG.json and OWNERSHIP.json from current STATE.json and CONTRACT.json files.
 *
 * Reads all sets from the milestone, builds DAG nodes, extracts edges from
 * each set's CONTRACT.json imports.fromSets, and rebuilds ownership from
 * CONTRACT.json fileOwnership arrays.
 *
 * Sets without CONTRACT.json are handled gracefully (no edges, no ownership).
 *
 * @param {string} cwd - Project root directory
 * @param {string} milestoneId - Milestone to recalculate for
 * @returns {Promise<{dag: Object, ownership: Object}>}
 */
async function recalculateDAG(cwd, milestoneId) {
  const readResult = await readState(cwd);
  if (!readResult || !readResult.valid) {
    throw new Error('Cannot recalculate DAG: STATE.json is missing or invalid');
  }

  const state = readResult.state;
  const milestone = findMilestone(state, milestoneId);

  // Load existing DAG.json to preserve annotations (group, priority, description, etc.)
  const existingDAG = tryLoadDAG(cwd);
  const existingNodeMap = {};
  if (existingDAG.dag && Array.isArray(existingDAG.dag.nodes)) {
    for (const node of existingDAG.dag.nodes) {
      existingNodeMap[node.id] = node;
    }
  }

  // Build DAG nodes from all sets in the milestone, preserving existing annotations
  const nodes = milestone.sets.map(s => {
    const existing = existingNodeMap[s.id];
    if (existing) {
      return { ...existing, id: s.id };
    }
    return { id: s.id };
  });

  // Build edges from CONTRACT.json imports
  const edges = [];
  for (const set of milestone.sets) {
    const contractPath = path.join(cwd, '.planning', 'sets', set.id, 'CONTRACT.json');
    if (!fs.existsSync(contractPath)) {
      continue; // No CONTRACT.json -- skip gracefully
    }

    let contractJson;
    try {
      contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
    } catch {
      continue; // Malformed CONTRACT.json -- skip gracefully
    }

    const imports = contractJson.imports;
    if (imports && Array.isArray(imports.fromSets)) {
      for (const imp of imports.fromSets) {
        // Only add edge if the dependency set is a node in the DAG
        if (nodes.some(n => n.id === imp.set)) {
          edges.push({ from: imp.set, to: set.id });
        }
      }
    }
  }

  // Create DAG (handles toposort, wave assignment, cycle detection)
  const dagObj = createDAG(nodes, edges);

  // Build ownership from CONTRACT.json fileOwnership arrays
  const ownershipSets = [];
  for (const set of milestone.sets) {
    const contractPath = path.join(cwd, '.planning', 'sets', set.id, 'CONTRACT.json');
    let ownedFiles = [];

    if (fs.existsSync(contractPath)) {
      try {
        const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
        if (Array.isArray(contractJson.fileOwnership)) {
          ownedFiles = contractJson.fileOwnership;
        }
      } catch {
        // Malformed CONTRACT.json -- skip
      }
    }

    ownershipSets.push({ name: set.id, ownedFiles });
  }

  const ownershipObj = createOwnershipMap(ownershipSets);

  // Persist DAG.json and OWNERSHIP.json
  writeDAG(cwd, dagObj);
  writeOwnership(cwd, ownershipObj);

  return { dag: dagObj, ownership: ownershipObj };
}

/**
 * Auto-regroup DAG sets into developer groups based on teamSize from STATE.json.
 * Skips gracefully when teamSize <= 1 (solo mode) or when STATE.json/DAG is missing.
 *
 * @param {string} cwd - Project root directory
 */
async function autoRegroup(cwd) {
  // Read teamSize from STATE.json (top-level field, added during init)
  const readResult = await readState(cwd);
  if (!readResult || !readResult.valid) return; // graceful skip

  const teamSize = readResult.state.teamSize;
  if (!teamSize || teamSize <= 1) return; // solo mode -- skip regrouping

  const { dag, path: dagPath } = tryLoadDAG(cwd);
  if (!dag) return; // no DAG -- skip gracefully

  // Load contracts for all sets in the DAG
  const contracts = {};
  for (const node of dag.nodes) {
    const contractPath = path.join(cwd, '.planning', 'sets', node.id, 'CONTRACT.json');
    try {
      const raw = fs.readFileSync(contractPath, 'utf-8');
      contracts[node.id] = JSON.parse(raw);
    } catch {
      // Missing or malformed contract -- skip
    }
  }

  const groupResult = partitionIntoGroups(dag, contracts, teamSize);
  const annotatedDag = annotateDAGWithGroups(dag, groupResult);
  writeDAG(cwd, annotatedDag);
}

module.exports = { addSetToMilestone, recalculateDAG, autoRegroup };
