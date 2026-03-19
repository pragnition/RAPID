'use strict';

/**
 * plan.cjs - Planning orchestration library for RAPID set decomposition.
 *
 * Ties together DAG and contract operations into set-level workflows:
 * set creation (DEFINITION.md + CONTRACT.json per set), DAG/ownership/
 * manifest persistence, and assumptions surfacing.
 *
 * Depends on:
 *   - dag.cjs: createDAG for topological sort and wave assignment
 *   - contract.cjs: generateContractTest, createManifest, createOwnershipMap, createContribution
 *   - core.cjs: output/error utilities (optional, for logging)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dag = require('./dag.cjs');
const { DAG_CANONICAL_SUBPATH } = require('./dag.cjs');
const contract = require('./contract.cjs');

// ────────────────────────────────────────────────────────────────
// Project Root Resolution
// ────────────────────────────────────────────────────────────────

/**
 * Resolve the true project root from any working directory, including
 * git worktrees. Uses `git rev-parse --path-format=absolute --git-common-dir`
 * to find the shared .git directory, then derives the project root from it.
 *
 * Falls back to `cwd` when:
 * - Not inside a git repository (e.g., unit test temp dirs)
 * - The resolved root does not contain `.planning/sets/`
 *
 * @param {string} cwd - Current working directory (may be a worktree path)
 * @returns {string} Resolved project root path
 */
function resolveProjectRoot(cwd) {
  try {
    const gitCommonDir = execSync(
      'git rev-parse --path-format=absolute --git-common-dir',
      { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    // gitCommonDir points to the .git directory (e.g., /path/to/project/.git)
    // Strip the trailing /.git to get the project root
    let projectRoot;
    if (gitCommonDir.endsWith(`${path.sep}.git`) || gitCommonDir.endsWith('/.git')) {
      projectRoot = gitCommonDir.slice(0, -path.sep.length - '.git'.length);
    } else if (gitCommonDir === '.git') {
      // Relative .git (shouldn't happen with --path-format=absolute, but handle it)
      projectRoot = cwd;
    } else {
      // Unexpected format -- try stripping /.git anyway
      const idx = gitCommonDir.lastIndexOf('/.git');
      if (idx !== -1) {
        projectRoot = gitCommonDir.slice(0, idx);
      } else {
        projectRoot = cwd;
      }
    }

    // Verify the resolved root contains .planning/sets/
    if (fs.existsSync(path.join(projectRoot, '.planning', 'sets'))) {
      return projectRoot;
    }

    // Fallback to cwd if .planning/sets/ not found at resolved root
    return cwd;
  } catch {
    // git rev-parse failed (not a git repo, etc.) -- fall back to cwd
    return cwd;
  }
}

// ────────────────────────────────────────────────────────────────
// Set Creation
// ────────────────────────────────────────────────────────────────

/**
 * Create a set directory with DEFINITION.md, CONTRACT.json, contract.test.cjs,
 * and optionally CONTRIBUTIONS.json.
 *
 * @param {string} cwd - Project root directory
 * @param {Object} setDef - Set definition
 * @param {string} setDef.name - Set name (used as directory name)
 * @param {string} setDef.scope - Description of what this set covers
 * @param {string[]} setDef.ownedFiles - File paths this set owns exclusively
 * @param {Array<{description: string, acceptance: string}>} setDef.tasks - Tasks with acceptance criteria
 * @param {string[]} setDef.acceptance - Overall acceptance criteria
 * @param {number} setDef.wave - Wave number for parallel execution
 * @param {string[]} setDef.parallelWith - Names of sets running in parallel
 * @param {Object} setDef.contract - CONTRACT.json content
 * @param {Array} [setDef.contributions] - Optional cross-set contributions
 * @returns {{ path: string, files: string[] }} Created directory path and file list
 */
function createSet(cwd, setDef) {
  const setDir = path.join(cwd, '.planning', 'sets', setDef.name);
  fs.mkdirSync(setDir, { recursive: true });

  const files = [];

  // Write DEFINITION.md
  const definitionContent = generateDefinition(setDef);
  fs.writeFileSync(path.join(setDir, 'DEFINITION.md'), definitionContent, 'utf-8');
  files.push('DEFINITION.md');

  // Write CONTRACT.json
  fs.writeFileSync(
    path.join(setDir, 'CONTRACT.json'),
    JSON.stringify(setDef.contract, null, 2),
    'utf-8'
  );
  files.push('CONTRACT.json');

  // Write contract.test.cjs (auto-generated from CONTRACT.json)
  const testContent = contract.generateContractTest(setDef.name, setDef.contract);
  fs.writeFileSync(path.join(setDir, 'contract.test.cjs'), testContent, 'utf-8');
  files.push('contract.test.cjs');

  // Write CONTRIBUTIONS.json if contributions are provided
  if (setDef.contributions && setDef.contributions.length > 0) {
    const contribObj = contract.createContribution(setDef.name, setDef.contributions);
    fs.writeFileSync(
      path.join(setDir, 'CONTRIBUTIONS.json'),
      JSON.stringify(contribObj, null, 2),
      'utf-8'
    );
    files.push('CONTRIBUTIONS.json');
  }

  return { path: setDir, files };
}

/**
 * Generate DEFINITION.md content from a set definition.
 *
 * @param {Object} setDef - Set definition object
 * @returns {string} Markdown content
 */
function generateDefinition(setDef) {
  const lines = [];

  lines.push(`# Set: ${setDef.name}`);
  lines.push('');
  lines.push('## Scope');
  lines.push(setDef.scope);
  lines.push('');
  lines.push('## File Ownership');
  lines.push('Files this set owns (exclusive write access):');
  for (const f of setDef.ownedFiles) {
    lines.push(`- ${f}`);
  }
  lines.push('');
  lines.push('## Tasks');
  for (let i = 0; i < setDef.tasks.length; i++) {
    const task = setDef.tasks[i];
    lines.push(`${i + 1}. ${task.description}`);
    if (task.acceptance) {
      lines.push(`   - Acceptance: ${task.acceptance}`);
    }
  }
  lines.push('');
  lines.push('## Interface Contract');
  lines.push('See: CONTRACT.json (adjacent file)');
  lines.push('');
  lines.push('## Wave Assignment');
  const parallelText = setDef.parallelWith && setDef.parallelWith.length > 0
    ? setDef.parallelWith.join(', ')
    : 'none';
  lines.push(`Wave: ${setDef.wave} (parallel with: ${parallelText})`);
  lines.push('');
  lines.push('## Acceptance Criteria');
  for (const criterion of setDef.acceptance) {
    lines.push(`- ${criterion}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Set Loading
// ────────────────────────────────────────────────────────────────

/**
 * Load a set's definition, contract, and optional contributions from disk.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set to load
 * @returns {{ definition: string | null, contract: Object, contributions?: Object }}
 * @throws {Error} If set directory or CONTRACT.json does not exist
 */
function loadSet(cwd, setName) {
  const projectRoot = resolveProjectRoot(cwd);
  const setDir = path.join(projectRoot, '.planning', 'sets', setName);

  if (!fs.existsSync(setDir)) {
    throw new Error(`Set "${setName}" does not exist at ${setDir} (cwd: ${cwd}, resolved root: ${projectRoot})`);
  }

  // DEFINITION.md is optional -- init creates sets via contracts before definitions exist
  const defPath = path.join(setDir, 'DEFINITION.md');
  let definition = null;
  if (fs.existsSync(defPath)) {
    definition = fs.readFileSync(defPath, 'utf-8');
  } else {
    console.error(`[RAPID] Warning: DEFINITION.md not found for set "${setName}" at ${defPath}`);
  }

  const contractJson = JSON.parse(
    fs.readFileSync(path.join(setDir, 'CONTRACT.json'), 'utf-8')
  );

  const result = { definition, contract: contractJson };

  // Load contributions if present
  const contribPath = path.join(setDir, 'CONTRIBUTIONS.json');
  if (fs.existsSync(contribPath)) {
    result.contributions = JSON.parse(fs.readFileSync(contribPath, 'utf-8'));
  }

  return result;
}

/**
 * List all set names from .planning/sets/ directory.
 * Filters out non-directory entries (DAG.json, OWNERSHIP.json, etc.).
 *
 * @param {string} cwd - Project root directory
 * @returns {string[]} Sorted array of set directory names
 */
function listSets(cwd) {
  const setsDir = path.join(resolveProjectRoot(cwd), '.planning', 'sets');

  if (!fs.existsSync(setsDir)) {
    return [];
  }

  const entries = fs.readdirSync(setsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// ────────────────────────────────────────────────────────────────
// Persistence: DAG, Ownership, Manifest
// ────────────────────────────────────────────────────────────────

/**
 * Write a DAG object to .planning/sets/DAG.json.
 *
 * @param {string} cwd - Project root directory
 * @param {Object} dagObj - DAG object from createDAG
 */
function writeDAG(cwd, dagObj) {
  const dagPath = path.join(cwd, DAG_CANONICAL_SUBPATH);
  fs.writeFileSync(dagPath, JSON.stringify(dagObj, null, 2), 'utf-8');
}

/**
 * Write an ownership map to .planning/sets/OWNERSHIP.json.
 *
 * @param {string} cwd - Project root directory
 * @param {Object} ownership - Ownership map from createOwnershipMap
 */
function writeOwnership(cwd, ownership) {
  const ownerPath = path.join(cwd, '.planning', 'sets', 'OWNERSHIP.json');
  fs.writeFileSync(ownerPath, JSON.stringify(ownership, null, 2), 'utf-8');
}

/**
 * Write a manifest to .planning/contracts/MANIFEST.json.
 * Creates .planning/contracts/ directory if needed.
 *
 * @param {string} cwd - Project root directory
 * @param {Object} manifest - Manifest from createManifest
 */
function writeManifest(cwd, manifest) {
  const contractsDir = path.join(cwd, '.planning', 'contracts');
  fs.mkdirSync(contractsDir, { recursive: true });
  const manifestPath = path.join(contractsDir, 'MANIFEST.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

// ────────────────────────────────────────────────────────────────
// Decomposition Orchestration
// ────────────────────────────────────────────────────────────────

/**
 * Orchestrate full decomposition: create sets, build DAG, ownership, manifest.
 *
 * @param {string} cwd - Project root directory
 * @param {Object[]} setDefs - Array of set definition objects
 * @returns {{ sets: Object[], dag: Object, ownership: Object, manifest: Object }}
 * @throws {Error} On ownership conflicts or DAG cycles (propagated from underlying libraries)
 */
function decomposeIntoSets(cwd, setDefs) {
  // Ensure directories exist
  fs.mkdirSync(path.join(cwd, '.planning', 'sets'), { recursive: true });
  fs.mkdirSync(path.join(cwd, '.planning', 'contracts'), { recursive: true });

  // Create each set
  const setResults = [];
  for (const def of setDefs) {
    const result = createSet(cwd, def);
    setResults.push(result);
  }

  // Build nodes and edges for DAG
  const nodes = setDefs.map((s) => ({ id: s.name }));
  const edges = [];

  for (const def of setDefs) {
    const imports = def.contract && def.contract.imports;
    if (imports && Array.isArray(imports.fromSets)) {
      for (const imp of imports.fromSets) {
        edges.push({ from: imp.set, to: def.name });
      }
    }
  }

  // Create DAG (throws on cycles)
  const dagObj = dag.createDAG(nodes, edges);

  // Create ownership map (throws on conflicts)
  const ownershipObj = contract.createOwnershipMap(
    setDefs.map((s) => ({ name: s.name, ownedFiles: s.ownedFiles }))
  );

  // Create manifest
  const manifestObj = contract.createManifest(
    setDefs.map((s) => ({
      name: s.name,
      contractPath: `.planning/sets/${s.name}/CONTRACT.json`,
      contract: s.contract,
      wave: s.wave,
    }))
  );

  // Persist everything
  writeDAG(cwd, dagObj);
  writeOwnership(cwd, ownershipObj);
  writeManifest(cwd, manifestObj);

  return {
    sets: setResults,
    dag: dagObj,
    ownership: ownershipObj,
    manifest: manifestObj,
  };
}

// ────────────────────────────────────────────────────────────────
// Assumptions Surfacing
// ────────────────────────────────────────────────────────────────

/**
 * Surface assumptions about a set based on its DEFINITION.md and CONTRACT.json.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set
 * @returns {string} Structured assumptions text
 * @throws {Error} If set does not exist
 */
function surfaceAssumptions(cwd, setName) {
  const loaded = loadSet(cwd, setName);
  const def = loaded.definition;
  const contractJson = loaded.contract;

  if (!def) {
    return '(No DEFINITION.md found for this set -- assumptions cannot be surfaced)';
  }

  const lines = [];

  // Parse scope from DEFINITION.md
  const scopeMatch = def.match(/## Scope\n([\s\S]*?)(?=\n##|$)/);
  const scope = scopeMatch ? scopeMatch[1].trim() : '(no scope found)';

  // Parse file ownership
  const ownershipMatch = def.match(/## File Ownership\n[\s\S]*?\n((?:- .+\n?)*)/);
  const ownedFiles = ownershipMatch
    ? ownershipMatch[1].trim().split('\n').map((l) => l.replace(/^- /, ''))
    : [];

  // Parse wave assignment
  const waveMatch = def.match(/Wave: (\d+)/);
  const wave = waveMatch ? waveMatch[1] : '(unknown)';

  // Extract exports from contract
  const functions = (contractJson.exports && contractJson.exports.functions) || [];
  const types = (contractJson.exports && contractJson.exports.types) || [];

  // Extract imports from contract
  const imports = (contractJson.imports && contractJson.imports.fromSets) || [];

  // Build structured output
  lines.push(`# Assumptions Analysis: ${setName}`);
  lines.push('');

  // Scope Understanding
  lines.push('## Scope Understanding');
  lines.push(`This set covers: ${scope}`);
  lines.push(`Assigned to Wave ${wave}.`);
  lines.push('');

  // File Boundaries
  lines.push('## File Boundaries');
  lines.push('Files this set owns (exclusive write access):');
  for (const f of ownedFiles) {
    lines.push(`- ${f}`);
  }
  if (ownedFiles.length === 0) {
    lines.push('- (no files specified)');
  }
  if (ownedFiles.some((f) => f.includes('/**'))) {
    lines.push('');
    lines.push('Note: Directory-level ownership patterns (/**) grant broad write access. Ensure no other set needs files under these directories.');
  }
  lines.push('');

  // Contract Assumptions
  lines.push('## Contract Assumptions');
  if (functions.length > 0) {
    lines.push('Exported functions:');
    for (const fn of functions) {
      const params = fn.params.map((p) => `${p.name}: ${p.type}`).join(', ');
      lines.push(`- ${fn.name}(${params}) -> ${fn.returns} [from ${fn.file}]`);
    }
  } else {
    lines.push('No functions exported.');
  }
  if (types.length > 0) {
    lines.push('Exported types:');
    for (const t of types) {
      lines.push(`- ${t.name} [from ${t.file}]`);
    }
  }
  lines.push('');

  // Dependency Assumptions
  lines.push('## Dependency Assumptions');
  if (imports.length > 0) {
    lines.push('This set depends on:');
    for (const imp of imports) {
      const fns = imp.functions ? imp.functions.join(', ') : '(all exports)';
      lines.push(`- ${imp.set}: ${fns}`);
    }
    lines.push('');
    lines.push('These dependencies must be available (via contract stubs or completed implementation) before this set can execute.');
  } else {
    lines.push('This set has no dependencies on other sets. It can execute independently.');
  }
  if (functions.length > 0 || types.length > 0) {
    lines.push('');
    const exportCount = functions.length + types.length;
    lines.push(`This set provides ${exportCount} export(s) that downstream sets may depend on.`);
  }
  lines.push('');

  // Risk Factors
  lines.push('## Risk Factors');
  const risks = [];

  if (imports.length >= 3) {
    risks.push('Many cross-set dependencies (' + imports.length + ' imports) -- higher coordination overhead');
  }
  if (ownedFiles.length >= 5) {
    risks.push('Large file ownership scope (' + ownedFiles.length + ' entries) -- potential for boundary disputes');
  }
  if (ownedFiles.some((f) => f.includes('/**'))) {
    risks.push('Uses directory-level ownership patterns -- other sets may need files under these directories');
  }
  if (functions.length === 0 && types.length === 0) {
    risks.push('No exports declared -- this set may be isolated or its contract may be incomplete');
  }

  if (risks.length > 0) {
    for (const risk of risks) {
      lines.push(`- ${risk}`);
    }
  } else {
    lines.push('No significant risk factors identified.');
  }
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  createSet,
  loadSet,
  listSets,
  decomposeIntoSets,
  writeDAG,
  writeOwnership,
  writeManifest,
  surfaceAssumptions,
};
