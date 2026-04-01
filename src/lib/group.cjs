'use strict';

/**
 * group.cjs - Developer group partitioning for RAPID DAGs.
 *
 * Partitions DAG sets into N developer groups using a conflict-minimization
 * strategy based on file ownership data from contracts. Groups are assigned
 * deterministically using a greedy algorithm with balance tiebreaking.
 *
 * No external dependencies -- uses only Node.js built-ins.
 */

/**
 * Partition DAG sets into developer groups using conflict-minimization.
 *
 * Algorithm (deterministic, conflict-first with balance tiebreaker):
 * 1. Build file-to-set ownership map from contracts.
 * 2. Build conflict graph (pairs of sets sharing files).
 * 3. Initialize N empty groups.
 * 4. Sort sets alphabetically for determinism.
 * 5. Greedy assignment: pick group with min conflict, then min size, then min ID.
 * 6. Collect cross-group DAG edges.
 *
 * @param {Object} dag - v3 DAG object with `nodes` and `edges` arrays
 * @param {Object} contracts - Map of setId -> contract data with fileOwnership or definition.ownedFiles
 * @param {number} numDevelopers - Number of groups to create (>= 1)
 * @returns {{ groups: Record<string, {sets: string[], description?: string}>, crossGroupEdges: Array<{from: string, to: string, fromGroup: string, toGroup: string}>, assignments: Record<string, string> }}
 */
function partitionIntoGroups(dag, contracts, numDevelopers) {
  const setIds = dag.nodes.map((n) => n.id);

  // --- Step 1: Build file-to-set ownership map ---
  const fileToSets = new Map(); // filePath -> Set<setId>
  const setToFiles = new Map(); // setId -> string[]

  for (const setId of setIds) {
    const contract = contracts && contracts[setId];
    let files = [];
    if (contract) {
      if (Array.isArray(contract.fileOwnership)) {
        files = contract.fileOwnership;
      } else if (
        contract.definition &&
        Array.isArray(contract.definition.ownedFiles)
      ) {
        files = contract.definition.ownedFiles;
      }
    }
    setToFiles.set(setId, files);
    for (const filePath of files) {
      if (!fileToSets.has(filePath)) {
        fileToSets.set(filePath, new Set());
      }
      fileToSets.get(filePath).add(setId);
    }
  }

  // --- Step 2: Build conflict graph ---
  // conflictGraph: Map<setId, Map<setId, conflictCount>>
  const conflictGraph = new Map();
  for (const setId of setIds) {
    conflictGraph.set(setId, new Map());
  }

  for (const [, owners] of fileToSets) {
    if (owners.size < 2) continue;
    const ownerArr = [...owners];
    for (let i = 0; i < ownerArr.length; i++) {
      for (let j = i + 1; j < ownerArr.length; j++) {
        const a = ownerArr[i];
        const b = ownerArr[j];
        const aMap = conflictGraph.get(a);
        const bMap = conflictGraph.get(b);
        aMap.set(b, (aMap.get(b) || 0) + 1);
        bMap.set(a, (bMap.get(a) || 0) + 1);
      }
    }
  }

  // --- Step 3: Initialize groups ---
  const groups = [];
  for (let i = 0; i < numDevelopers; i++) {
    groups.push({
      id: `G${i + 1}`,
      sets: [],
      fileSet: new Set(),
    });
  }

  // --- Step 4: Sort sets alphabetically for determinism ---
  const sortedSets = [...setIds].sort();

  // --- Step 5: Greedy assignment ---
  // Strategy: maximize file overlap within groups (co-locate conflicting sets)
  // to minimize cross-group merge conflicts. Tiebreak by smallest group size
  // (balance), then smallest group ID (determinism).
  const assignments = {};

  for (const setId of sortedSets) {
    const ownedFiles = setToFiles.get(setId) || [];

    let bestGroup = null;
    let bestAffinityScore = -1;
    let bestSize = Infinity;

    for (const group of groups) {
      // Affinity score: number of this set's files already in this group.
      // Higher = more reason to co-locate (fewer cross-group conflicts).
      let affinityScore = 0;
      for (const filePath of ownedFiles) {
        if (group.fileSet.has(filePath)) {
          affinityScore++;
        }
      }

      if (
        affinityScore > bestAffinityScore ||
        (affinityScore === bestAffinityScore && group.sets.length < bestSize) ||
        (affinityScore === bestAffinityScore &&
          group.sets.length === bestSize &&
          (bestGroup === null || group.id < bestGroup.id))
      ) {
        bestGroup = group;
        bestAffinityScore = affinityScore;
        bestSize = group.sets.length;
      }
    }

    bestGroup.sets.push(setId);
    for (const filePath of ownedFiles) {
      bestGroup.fileSet.add(filePath);
    }
    assignments[setId] = bestGroup.id;
  }

  // --- Step 6: Build cross-group edges ---
  const crossGroupEdges = [];
  for (const edge of dag.edges) {
    const fromGroup = assignments[edge.from];
    const toGroup = assignments[edge.to];
    if (fromGroup && toGroup && fromGroup !== toGroup) {
      crossGroupEdges.push({
        from: edge.from,
        to: edge.to,
        fromGroup,
        toGroup,
      });
    }
  }

  // --- Step 7: Build return object ---
  const groupsResult = {};
  for (const group of groups) {
    groupsResult[group.id] = {
      sets: group.sets,
    };
  }

  return {
    groups: groupsResult,
    crossGroupEdges,
    assignments,
  };
}

/**
 * Annotate a DAG with group assignments.
 *
 * Returns a new DAG (deep clone) with group fields populated on each node
 * and the top-level groups field set from the groupResult.
 *
 * @param {Object} dag - v3 DAG object
 * @param {Object} groupResult - Return value from partitionIntoGroups()
 * @returns {Object} New DAG with group annotations (input not mutated)
 */
function annotateDAGWithGroups(dag, groupResult) {
  // Deep clone the DAG to avoid mutation
  const cloned = JSON.parse(JSON.stringify(dag));

  // Set group on each node
  for (const node of cloned.nodes) {
    node.group = groupResult.assignments[node.id] || null;
  }

  // Set top-level groups
  cloned.groups = groupResult.groups;

  return cloned;
}

/**
 * Generate a markdown report of group assignments.
 *
 * @param {Object} groupResult - Return value from partitionIntoGroups()
 * @returns {string} Markdown string with group assignments and cross-group dependencies
 */
function generateGroupReport(groupResult) {
  const lines = [];

  lines.push('## Developer Group Assignments');
  lines.push('');

  // Sort groups by ID
  const groupIds = Object.keys(groupResult.groups).sort();

  for (const groupId of groupIds) {
    const group = groupResult.groups[groupId];
    lines.push(`### ${groupId}`);
    lines.push('');
    const sortedSets = [...group.sets].sort();
    for (const setId of sortedSets) {
      lines.push(`- ${setId}`);
    }
    lines.push('');
  }

  // Cross-group dependencies
  if (groupResult.crossGroupEdges.length > 0) {
    lines.push('### Cross-Group Dependencies');
    lines.push('');
    lines.push('| From | To | From Group | To Group |');
    lines.push('|------|-----|------------|----------|');
    for (const edge of groupResult.crossGroupEdges) {
      lines.push(
        `| ${edge.from} | ${edge.to} | ${edge.fromGroup} | ${edge.toGroup} |`
      );
    }
    lines.push('');
  }

  // Summary line
  const totalSets = Object.values(groupResult.assignments).length;
  const totalGroups = groupIds.length;
  const totalCrossGroup = groupResult.crossGroupEdges.length;
  lines.push(
    `**${totalGroups} groups, ${totalSets} sets, ${totalCrossGroup} cross-group dependencies**`
  );

  return lines.join('\n');
}

module.exports = {
  partitionIntoGroups,
  annotateDAGWithGroups,
  generateGroupReport,
};
