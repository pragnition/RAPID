'use strict';

/**
 * stub.cjs - Contract stub generator for RAPID set dependencies.
 *
 * Generates valid CommonJS stub modules from CONTRACT.json exports.
 * Stubs allow dependent sets to require() contract interfaces during
 * development before the provider set has been implemented.
 *
 * Each stub function throws an informative error when called,
 * making it clear which set needs to implement the function.
 *
 * Depends on:
 *   - plan.cjs: loadSet to read CONTRACT.json for imported sets
 *   - worktree.cjs: loadRegistry to find worktree paths
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate a CommonJS stub module string from a CONTRACT.json object.
 *
 * Each exported function becomes a stub that throws when called.
 * Each exported type becomes a JSDoc @typedef comment.
 *
 * @param {Object} contractJson - Parsed CONTRACT.json object
 * @param {string} setName - Name of the set providing the contract
 * @returns {string} Valid CommonJS module source code
 */
function generateStub(contractJson, setName) {
  const exports = contractJson.exports || {};
  const functions = exports.functions || [];
  const types = exports.types || [];

  const lines = [];

  // Header
  lines.push(`// AUTO-GENERATED stub for set: ${setName}`);
  lines.push('// Generated from CONTRACT.json -- DO NOT EDIT');
  lines.push("'use strict';");
  lines.push('');

  // Type stubs as JSDoc @typedef blocks
  for (const type of types) {
    lines.push('/**');
    lines.push(` * @typedef {Object} ${type.name}`);
    if (type.shape && type.shape.properties) {
      for (const [propName, propDef] of Object.entries(type.shape.properties)) {
        const propType = propDef.type || 'any';
        lines.push(` * @property {${propType}} ${propName}`);
      }
    }
    lines.push(' */');
    lines.push('');
  }

  // Function stubs
  for (const fn of functions) {
    // JSDoc
    lines.push('/**');
    for (const param of fn.params) {
      lines.push(` * @param {${param.type}} ${param.name}`);
    }
    lines.push(` * @returns {${fn.returns}}`);
    lines.push(' */');

    // Function definition
    const paramNames = fn.params.map(p => p.name).join(', ');
    lines.push(`function ${fn.name}(${paramNames}) {`);
    lines.push(`  throw new Error('Stub: ${fn.name} not yet implemented by set ${setName}');`);
    lines.push('}');
    lines.push('');
  }

  // Module exports
  const exportNames = functions.map(fn => fn.name).join(', ');
  lines.push(`module.exports = { ${exportNames} };`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate stub files for all sets that a given set imports from.
 *
 * Reads the set's CONTRACT.json to find imports.fromSets, then for each
 * imported set, generates a stub file at .rapid-stubs/{importedSetName}-stub.cjs
 * inside the set's worktree.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set that needs stubs
 * @returns {string[]} Array of absolute file paths written
 */
function generateStubFiles(cwd, setName) {
  const plan = require('./plan.cjs');
  const worktree = require('./worktree.cjs');

  // Load the consuming set's contract
  const setData = plan.loadSet(cwd, setName);
  const imports = (setData.contract.imports && setData.contract.imports.fromSets) || [];

  if (imports.length === 0) {
    return [];
  }

  // Find the worktree path for this set
  const registry = worktree.loadRegistry(cwd);
  const entry = registry.worktrees[setName];
  if (!entry) {
    throw new Error(`No worktree registered for set "${setName}"`);
  }

  const worktreePath = path.resolve(cwd, entry.path);
  const stubsDir = path.join(worktreePath, '.rapid-stubs');
  fs.mkdirSync(stubsDir, { recursive: true });

  const writtenPaths = [];

  for (const imp of imports) {
    const importedSetData = plan.loadSet(cwd, imp.set);
    const stubContent = generateStub(importedSetData.contract, imp.set);
    const stubFile = path.join(stubsDir, `${imp.set}-stub.cjs`);
    fs.writeFileSync(stubFile, stubContent, 'utf-8');
    writtenPaths.push(stubFile);
  }

  return writtenPaths;
}

/**
 * Remove all stub files from a worktree's .rapid-stubs/ directory.
 *
 * @param {string} worktreePath - Absolute path to the worktree directory
 * @returns {{ cleaned: true, count: number } | { cleaned: false, reason: string }}
 */
function cleanupStubFiles(worktreePath) {
  const stubsDir = path.join(worktreePath, '.rapid-stubs');

  if (!fs.existsSync(stubsDir)) {
    return { cleaned: false, reason: 'not_found' };
  }

  // Count files before removal
  const entries = fs.readdirSync(stubsDir);
  const fileCount = entries.filter(e => {
    const stat = fs.statSync(path.join(stubsDir, e));
    return stat.isFile();
  }).length;

  // Remove the entire directory
  fs.rmSync(stubsDir, { recursive: true, force: true });

  return { cleaned: true, count: fileCount };
}

module.exports = { generateStub, generateStubFiles, cleanupStubFiles };
