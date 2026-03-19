'use strict';

const fs = require('fs');
const path = require('path');

/**
 * dag.cjs - Directed Acyclic Graph operations for RAPID set dependencies.
 *
 * Provides topological sort (Kahn's algorithm), wave assignment (BFS-based
 * level grouping), DAG creation/validation, and execution order extraction.
 *
 * Edge direction convention:
 *   { from: "auth", to: "api" }
 *   means "auth" is a dependency of "api" -- auth must complete before api starts.
 *   "from" = dependency (no incoming constraint), "to" = dependent (depends on "from").
 *
 * No external dependencies -- uses only Node.js built-ins.
 */

/**
 * Canonical subpath for DAG.json within a project root.
 * All DAG consumers must use this path (or tryLoadDAG) instead of
 * constructing paths manually.
 */
const DAG_CANONICAL_SUBPATH = path.join('.planning', 'sets', 'DAG.json');

/**
 * Topological sort using Kahn's algorithm (BFS-based).
 *
 * @param {Array<{id: string}>} nodes - Graph nodes (must have `id` property)
 * @param {Array<{from: string, to: string}>} edges - Directed edges (from=dependency, to=dependent)
 * @returns {string[]} Node IDs in dependency order (dependencies first)
 * @throws {Error} If edges reference unknown node IDs
 * @throws {Error} If a cycle is detected (lists involved nodes)
 */
function toposort(nodes, edges) {
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Validate edge endpoints
  const unknownIds = [];
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) unknownIds.push(edge.from);
    if (!nodeIds.has(edge.to)) unknownIds.push(edge.to);
  }
  if (unknownIds.length > 0) {
    const unique = [...new Set(unknownIds)];
    throw new Error(`Unknown node IDs in edges: ${unique.join(', ')}`);
  }

  // Build adjacency list and in-degree map
  const inDegree = {};
  const adjacency = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
  }

  for (const edge of edges) {
    adjacency[edge.from].push(edge.to);
    inDegree[edge.to]++;
  }

  // Start with nodes that have no incoming edges
  const queue = [];
  for (const node of nodes) {
    if (inDegree[node.id] === 0) queue.push(node.id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);

    for (const neighbor of adjacency[current]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== nodes.length) {
    const remaining = nodes.map((n) => n.id).filter((id) => !sorted.includes(id));
    throw new Error(`Cycle detected involving: ${remaining.join(', ')}`);
  }

  return sorted;
}

/**
 * Assign wave numbers to nodes based on DAG levels (BFS level assignment).
 * Wave 1 = nodes with no dependencies, Wave 2 = depends only on Wave 1, etc.
 *
 * @param {Array<{id: string}>} nodes - Graph nodes
 * @param {Array<{from: string, to: string}>} edges - Directed edges (from=dependency, to=dependent)
 * @returns {Object<string, number>} Map of nodeId -> wave number (1-indexed)
 */
function assignWaves(nodes, edges) {
  const waves = {};
  const inDegree = {};
  const adjacency = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
  }

  for (const edge of edges) {
    adjacency[edge.from].push(edge.to);
    inDegree[edge.to]++;
  }

  let currentWave = 1;
  let queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);

  while (queue.length > 0) {
    const nextQueue = [];
    for (const nodeId of queue) {
      waves[nodeId] = currentWave;
      for (const neighbor of adjacency[nodeId]) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) nextQueue.push(neighbor);
      }
    }
    queue = nextQueue;
    currentWave++;
  }

  return waves;
}

/**
 * Create a complete DAG.json structure from nodes and edges.
 *
 * Validates inputs, runs topological sort (cycle detection), assigns waves,
 * and builds the full DAG object with checkpoints and metadata.
 *
 * @param {Array<{id: string}>} nodes - Graph nodes (may have additional properties)
 * @param {Array<{from: string, to: string}>} edges - Directed edges (from=dependency, to=dependent)
 * @returns {Object} Complete DAG.json object
 * @throws {Error} If duplicate node IDs found
 * @throws {Error} If edges reference unknown nodes
 * @throws {Error} If cycle detected
 */
function createDAG(nodes, edges) {
  // Check for duplicate node IDs
  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.id)) {
      throw new Error(`Duplicate node ID: ${node.id}`);
    }
    seen.add(node.id);
  }

  // toposort validates edges and detects cycles
  toposort(nodes, edges);

  // Assign waves
  const waveMap = assignWaves(nodes, edges);

  // Build nodes with wave and status
  const dagNodes = nodes.map((node) => ({
    ...node,
    wave: waveMap[node.id],
    status: 'pending',
  }));

  // Group sets by wave
  const waveGroups = {};
  for (const [nodeId, wave] of Object.entries(waveMap)) {
    if (!waveGroups[wave]) waveGroups[wave] = [];
    waveGroups[wave].push(nodeId);
  }

  // Build waves object with checkpoints
  const waves = {};
  for (const [waveNum, sets] of Object.entries(waveGroups)) {
    waves[waveNum] = {
      sets,
      checkpoint: {
        contracts: sets.map((s) => `rapid://contracts/${s}`),
        artifacts: sets.map((s) => `.planning/sets/${s}/CONTRACT.json`),
      },
    };
  }

  // Calculate metadata
  const totalWaves = Object.keys(waveGroups).length;
  const waveValues = Object.values(waveGroups).map((s) => s.length);
  const maxParallelism = waveValues.length > 0 ? Math.max(...waveValues) : 0;

  return {
    nodes: dagNodes,
    edges,
    waves,
    metadata: {
      created: new Date().toISOString().split('T')[0],
      totalSets: nodes.length,
      totalWaves,
      maxParallelism,
    },
  };
}

/**
 * Validate a DAG object for required structure and fields.
 *
 * @param {Object} dag - DAG object to validate
 * @returns {{ valid: true } | { valid: false, errors: string[] }}
 */
function validateDAG(dag) {
  const errors = [];

  // Check top-level required fields
  if (!dag || typeof dag !== 'object') {
    return { valid: false, errors: ['DAG must be an object'] };
  }

  if (!Array.isArray(dag.nodes)) {
    errors.push('Missing required field: nodes (must be an array)');
  }
  if (!Array.isArray(dag.edges)) {
    errors.push('Missing required field: edges (must be an array)');
  }
  if (!dag.waves || typeof dag.waves !== 'object' || Array.isArray(dag.waves)) {
    errors.push('Missing required field: waves (must be an object)');
  }
  if (!dag.metadata || typeof dag.metadata !== 'object' || Array.isArray(dag.metadata)) {
    errors.push('Missing required field: metadata (must be an object)');
  }

  // If top-level fields missing, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate each node
  for (let i = 0; i < dag.nodes.length; i++) {
    const node = dag.nodes[i];
    if (!node.id) errors.push(`Node at index ${i} missing required field: id`);
    if (node.wave === undefined || node.wave === null) {
      errors.push(`Node at index ${i} missing required field: wave`);
    }
    if (!node.status) errors.push(`Node at index ${i} missing required field: status`);
  }

  // Validate each edge
  for (let i = 0; i < dag.edges.length; i++) {
    const edge = dag.edges[i];
    if (!edge.from) errors.push(`Edge at index ${i} missing required field: from`);
    if (!edge.to) errors.push(`Edge at index ${i} missing required field: to`);
  }

  // Validate metadata
  if (dag.metadata.totalSets === undefined || dag.metadata.totalSets === null) {
    errors.push('Metadata missing required field: totalSets');
  }
  if (dag.metadata.totalWaves === undefined || dag.metadata.totalWaves === null) {
    errors.push('Metadata missing required field: totalWaves');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Extract execution order from a DAG as an array of parallel wave groups.
 *
 * @param {Object} dag - Complete DAG object (from createDAG or loaded from file)
 * @returns {string[][]} Array of arrays, each inner array contains set IDs that can run in parallel
 */
function getExecutionOrder(dag) {
  const waveNumbers = Object.keys(dag.waves)
    .map(Number)
    .sort((a, b) => a - b);

  return waveNumbers.map((waveNum) => dag.waves[waveNum].sets);
}

/**
 * Load DAG.json from the canonical path within a project root.
 *
 * Returns `{ dag, path }` where `dag` is the parsed object or null if the
 * file does not exist. Always returns `path` (the canonical location) for
 * logging and error messages.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ dag: object|null, path: string }}
 * @throws {SyntaxError} If the file exists but contains malformed JSON
 * @throws {Error} If the file cannot be read for reasons other than ENOENT
 */
function tryLoadDAG(cwd) {
  const canonicalPath = path.join(cwd, DAG_CANONICAL_SUBPATH);
  let raw;
  try {
    raw = fs.readFileSync(canonicalPath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { dag: null, path: canonicalPath };
    }
    throw err;
  }
  return { dag: JSON.parse(raw), path: canonicalPath };
}

/**
 * Valid node types for v2.0 DAGs.
 */
const VALID_NODE_TYPES = ['set', 'wave', 'job'];

/**
 * Create a v2.0 DAG with type-aware nodes (set/wave/job).
 *
 * Validates node types, rejects cross-type edges, reuses existing
 * toposort/assignWaves for cycle detection and wave computation.
 *
 * @param {Array<{id: string, type: string}>} nodes - Typed graph nodes
 * @param {Array<{from: string, to: string}>} edges - Directed edges (same-type only)
 * @returns {Object} v2.0 DAG object with version, nodes, edges, waves, metadata
 * @throws {Error} If nodes missing type or have invalid type
 * @throws {Error} If cross-type edges found
 * @throws {Error} If duplicate node IDs, unknown edge refs, or cycles detected
 */
function createDAGv2(nodes, edges) {
  // Check for duplicate node IDs
  const seen = new Set();
  for (const node of nodes) {
    if (seen.has(node.id)) {
      throw new Error(`Duplicate node ID: ${node.id}`);
    }
    seen.add(node.id);
  }

  // Validate all nodes have valid type
  for (const node of nodes) {
    if (!node.type || !VALID_NODE_TYPES.includes(node.type)) {
      throw new Error(
        `Node "${node.id}" has invalid or missing type: "${node.type || undefined}". Must be one of: ${VALID_NODE_TYPES.join(', ')}`
      );
    }
  }

  // Build node lookup for cross-type edge validation
  const nodeMap = {};
  for (const node of nodes) {
    nodeMap[node.id] = node;
  }

  // Validate edge references exist and only connect same-type nodes
  for (const edge of edges) {
    const fromNode = nodeMap[edge.from];
    const toNode = nodeMap[edge.to];
    if (!fromNode) {
      throw new Error(`Edge references unknown node: ${edge.from}`);
    }
    if (!toNode) {
      throw new Error(`Edge references unknown node: ${edge.to}`);
    }
    if (fromNode.type !== toNode.type) {
      throw new Error(
        `Cross-type edge not allowed: ${edge.from} (${fromNode.type}) -> ${edge.to} (${toNode.type})`
      );
    }
  }

  // Reuse existing toposort for cycle detection and validation
  toposort(nodes, edges);

  // Reuse existing assignWaves for wave computation
  const waveMap = assignWaves(nodes, edges);

  // Build nodes with wave and status
  const dagNodes = nodes.map((node) => ({
    ...node,
    wave: waveMap[node.id],
    status: 'pending',
  }));

  // Group nodes by wave
  const waveGroups = {};
  for (const [nodeId, wave] of Object.entries(waveMap)) {
    if (!waveGroups[wave]) waveGroups[wave] = [];
    waveGroups[wave].push(nodeId);
  }

  // Build waves object (without v1 set-specific checkpoint format)
  const waves = {};
  for (const [waveNum, nodeIds] of Object.entries(waveGroups)) {
    waves[waveNum] = {
      nodes: nodeIds,
    };
  }

  // Calculate metadata
  const totalWaves = Object.keys(waveGroups).length;
  const waveValuesV2 = Object.values(waveGroups).map((g) => g.length);
  const maxParallelism = waveValuesV2.length > 0 ? Math.max(...waveValuesV2) : 0;

  // Count node types
  const nodeTypes = { set: 0, wave: 0, job: 0 };
  for (const node of nodes) {
    nodeTypes[node.type]++;
  }

  return {
    version: 2,
    nodes: dagNodes,
    edges,
    waves,
    metadata: {
      created: new Date().toISOString().split('T')[0],
      totalNodes: nodes.length,
      totalWaves,
      maxParallelism,
      nodeTypes,
    },
  };
}

/**
 * Validate a v2.0 DAG object for required structure and fields.
 *
 * @param {Object} dag - v2.0 DAG object to validate
 * @returns {{ valid: true } | { valid: false, errors: string[] }}
 */
function validateDAGv2(dag) {
  const errors = [];

  // Check top-level required fields
  if (!dag || typeof dag !== 'object') {
    return { valid: false, errors: ['DAG must be an object'] };
  }

  if (dag.version !== 2) {
    errors.push('DAG version must be 2');
  }

  if (!Array.isArray(dag.nodes)) {
    errors.push('Missing required field: nodes (must be an array)');
  }
  if (!Array.isArray(dag.edges)) {
    errors.push('Missing required field: edges (must be an array)');
  }
  if (!dag.waves || typeof dag.waves !== 'object' || Array.isArray(dag.waves)) {
    errors.push('Missing required field: waves (must be an object)');
  }
  if (!dag.metadata || typeof dag.metadata !== 'object' || Array.isArray(dag.metadata)) {
    errors.push('Missing required field: metadata (must be an object)');
  }

  // If top-level fields missing, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate each node (v2 requires id, wave, status, type)
  for (let i = 0; i < dag.nodes.length; i++) {
    const node = dag.nodes[i];
    if (!node.id) errors.push(`Node at index ${i} missing required field: id`);
    if (node.wave === undefined || node.wave === null) {
      errors.push(`Node at index ${i} missing required field: wave`);
    }
    if (!node.status) errors.push(`Node at index ${i} missing required field: status`);
    if (!node.type) {
      errors.push(`Node at index ${i} missing required field: type`);
    } else if (!VALID_NODE_TYPES.includes(node.type)) {
      errors.push(`Node at index ${i} has invalid type: "${node.type}". Must be one of: ${VALID_NODE_TYPES.join(', ')}`);
    }
  }

  // Validate each edge
  for (let i = 0; i < dag.edges.length; i++) {
    const edge = dag.edges[i];
    if (!edge.from) errors.push(`Edge at index ${i} missing required field: from`);
    if (!edge.to) errors.push(`Edge at index ${i} missing required field: to`);
  }

  // Validate metadata
  if (dag.metadata.totalNodes === undefined || dag.metadata.totalNodes === null) {
    errors.push('Metadata missing required field: totalNodes');
  }
  if (dag.metadata.totalWaves === undefined || dag.metadata.totalWaves === null) {
    errors.push('Metadata missing required field: totalWaves');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = {
  toposort,
  assignWaves,
  createDAG,
  validateDAG,
  getExecutionOrder,
  tryLoadDAG,
  DAG_CANONICAL_SUBPATH,
  createDAGv2,
  validateDAGv2,
};
