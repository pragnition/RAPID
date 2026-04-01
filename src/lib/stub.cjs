'use strict';

/**
 * stub.cjs - Contract stub generator for RAPID set dependencies.
 *
 * Generates valid CommonJS stub modules from CONTRACT.json exports.
 * Stubs allow dependent sets to require() contract interfaces during
 * development before the provider set has been implemented.
 *
 * Each stub function returns a realistic default value based on the
 * return type annotation, making stubs safe to call during development.
 * Every stub file starts with `// RAPID-STUB` on its first line for
 * merge auto-resolution detection.
 *
 * Depends on:
 *   - plan.cjs: loadSet to read CONTRACT.json for imported sets
 *   - worktree.cjs: readRegistry to find worktree paths
 */

const fs = require('fs');
const path = require('path');

/**
 * Get a realistic default return value expression for a given type string.
 *
 * Internal helper -- not exported. Unit-testable via generated stub output.
 *
 * @param {string} typeStr - The type annotation string (e.g. 'string', 'Promise<number>')
 * @returns {string} A JavaScript expression string for the default return value
 */
function getDefaultReturnValue(typeStr) {
  if (!typeStr) return 'null';

  const trimmed = typeStr.trim();

  // Handle Promise<X> by recursively resolving X
  const promiseMatch = trimmed.match(/^Promise<(.+)>$/i);
  if (promiseMatch) {
    const innerType = promiseMatch[1];
    const innerValue = getDefaultReturnValue(innerType);
    return `Promise.resolve(${innerValue})`;
  }

  // Match common primitives case-insensitively
  const lower = trimmed.toLowerCase();

  if (lower === 'string') return "''";
  if (lower === 'number') return '0';
  if (lower === 'boolean') return 'false';
  if (lower === 'object') return '{}';
  if (lower === 'array' || lower.startsWith('array<')) return '[]';
  if (lower === 'void' || lower === 'undefined') return 'undefined';
  if (lower === 'null') return 'null';

  // Unrecognized type -> null (safe fallback per CONTEXT.md decision)
  return 'null';
}

/**
 * Parse a function signature string to extract name, params, and return type.
 *
 * Handles signatures like:
 *   "functionName(param1: type1, param2: type2): ReturnType"
 *
 * @param {string} signature - The function signature string
 * @returns {{ name: string, params: Array<{name: string, type: string}>, returns: string }}
 */
function parseSignature(signature) {
  if (!signature) return { name: '', params: [], returns: 'void' };

  // Extract function name (everything before the first parenthesis)
  const parenIdx = signature.indexOf('(');
  if (parenIdx === -1) return { name: signature.trim(), params: [], returns: 'void' };

  const name = signature.substring(0, parenIdx).trim();

  // Extract the params section (between first '(' and its matching ')')
  let depth = 0;
  let closeParenIdx = -1;
  for (let i = parenIdx; i < signature.length; i++) {
    if (signature[i] === '(') depth++;
    else if (signature[i] === ')') {
      depth--;
      if (depth === 0) { closeParenIdx = i; break; }
    }
  }

  if (closeParenIdx === -1) return { name, params: [], returns: 'void' };

  const paramsStr = signature.substring(parenIdx + 1, closeParenIdx).trim();
  const params = [];

  if (paramsStr.length > 0) {
    // Split params by comma, but respect angle brackets and curly braces
    const paramParts = [];
    let current = '';
    let bracketDepth = 0;
    for (let i = 0; i < paramsStr.length; i++) {
      const ch = paramsStr[i];
      if (ch === '<' || ch === '{' || ch === '(') bracketDepth++;
      else if (ch === '>' || ch === '}' || ch === ')') bracketDepth--;
      else if (ch === ',' && bracketDepth === 0) {
        paramParts.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) paramParts.push(current.trim());

    for (const part of paramParts) {
      // Handle optional params like "options?: {language?: string}"
      const colonIdx = part.indexOf(':');
      if (colonIdx !== -1) {
        const paramName = part.substring(0, colonIdx).replace('?', '').trim();
        const paramType = part.substring(colonIdx + 1).trim();
        params.push({ name: paramName, type: paramType });
      } else {
        params.push({ name: part.trim(), type: 'any' });
      }
    }
  }

  // Extract return type (after the closing paren and colon)
  const afterParen = signature.substring(closeParenIdx + 1).trim();
  let returns = 'void';
  if (afterParen.startsWith(':')) {
    returns = afterParen.substring(1).trim();
  }

  return { name, params, returns };
}

/**
 * Generate a CommonJS stub module string from a CONTRACT.json object.
 *
 * Each exported function becomes a stub that returns a realistic default value.
 * Each exported type becomes a JSDoc @typedef comment.
 * The first line is always `// RAPID-STUB` for merge auto-resolution detection.
 *
 * Supports both legacy and new contract formats:
 * - Legacy: contractJson.exports.functions[] and contractJson.exports.types[]
 * - New: contractJson.exports as flat object with {type, signature, description}
 *
 * @param {Object} contractJson - Parsed CONTRACT.json object
 * @param {string} setName - Name of the set providing the contract
 * @returns {string} Valid CommonJS module source code
 */
function generateStub(contractJson, setName) {
  const exportsData = contractJson.exports || {};

  const lines = [];

  // Header -- first line must be exactly // RAPID-STUB
  lines.push('// RAPID-STUB');
  lines.push(`// Generated from CONTRACT.json for set: ${setName} -- DO NOT EDIT`);
  lines.push("'use strict';");
  lines.push('');

  // Detect contract format
  const isLegacyFormat = Array.isArray(exportsData.functions) || Array.isArray(exportsData.types);

  if (isLegacyFormat) {
    // Legacy format: exports.functions[] and exports.types[]
    const functions = exportsData.functions || [];
    const types = exportsData.types || [];

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

    // Function stubs with realistic return values
    for (const fn of functions) {
      // JSDoc
      lines.push('/**');
      for (const param of fn.params) {
        lines.push(` * @param {${param.type}} ${param.name}`);
      }
      lines.push(` * @returns {${fn.returns}}`);
      lines.push(' */');

      // Function definition with realistic return value
      const paramNames = fn.params.map(p => p.name).join(', ');
      const returnExpr = getDefaultReturnValue(fn.returns);
      lines.push(`function ${fn.name}(${paramNames}) {`);
      if (returnExpr === 'undefined') {
        lines.push('  return;');
      } else {
        lines.push(`  return ${returnExpr};`);
      }
      lines.push('}');
      lines.push('');
    }

    // Module exports
    const exportNames = functions.map(fn => fn.name).join(', ');
    lines.push(`module.exports = { ${exportNames} };`);
    lines.push('');
  } else {
    // New flat format: exports is an object where each key is an export name
    // and value has {type, signature, description}
    const functionEntries = [];
    const typeEntries = [];

    for (const [exportName, exportDef] of Object.entries(exportsData)) {
      if (exportDef.type === 'function') {
        const parsed = parseSignature(exportDef.signature);
        functionEntries.push({
          name: parsed.name || exportName,
          params: parsed.params,
          returns: parsed.returns,
          description: exportDef.description,
        });
      } else if (exportDef.type === 'type') {
        typeEntries.push({
          name: exportName,
          description: exportDef.description,
        });
      }
      // Skip non-function, non-type exports (e.g., 'endpoint', 'file')
    }

    // Type stubs as JSDoc @typedef blocks
    for (const type of typeEntries) {
      lines.push('/**');
      lines.push(` * @typedef {Object} ${type.name}`);
      if (type.description) {
        lines.push(` * ${type.description}`);
      }
      lines.push(' */');
      lines.push('');
    }

    // Function stubs with realistic return values
    for (const fn of functionEntries) {
      // JSDoc
      lines.push('/**');
      if (fn.description) {
        lines.push(` * ${fn.description}`);
      }
      for (const param of fn.params) {
        lines.push(` * @param {${param.type}} ${param.name}`);
      }
      lines.push(` * @returns {${fn.returns}}`);
      lines.push(' */');

      // Function definition with realistic return value
      const paramNames = fn.params.map(p => p.name).join(', ');
      const returnExpr = getDefaultReturnValue(fn.returns);
      lines.push(`function ${fn.name}(${paramNames}) {`);
      if (returnExpr === 'undefined') {
        lines.push('  return;');
      } else {
        lines.push(`  return ${returnExpr};`);
      }
      lines.push('}');
      lines.push('');
    }

    // Module exports
    const exportNames = functionEntries.map(fn => fn.name).join(', ');
    lines.push(`module.exports = { ${exportNames} };`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check whether file content represents a RAPID stub.
 *
 * Returns true if the first line is exactly `// RAPID-STUB`.
 * Handles Windows line endings (\r\n).
 * Defensive against null, undefined, and empty string input.
 *
 * @param {string} fileContent - The file content to check
 * @returns {boolean} True if the content is a RAPID stub
 */
function isRapidStub(fileContent) {
  if (!fileContent || typeof fileContent !== 'string') return false;

  const firstNewline = fileContent.indexOf('\n');
  const firstLine = firstNewline === -1 ? fileContent : fileContent.substring(0, firstNewline);

  // Trim trailing \r to handle Windows line endings
  return firstLine.replace(/\r$/, '') === '// RAPID-STUB';
}

/**
 * Generate stub files for all sets that a given set imports from.
 *
 * Reads the set's CONTRACT.json to find imports, then for each imported set,
 * generates a stub file at .rapid-stubs/{importedSetName}-stub.cjs inside
 * the set's worktree. Also creates a zero-byte .rapid-stub sidecar file
 * alongside each stub for language-agnostic detection.
 *
 * Supports both import formats:
 * - Legacy: imports.fromSets[] with {set, functions}
 * - New: imports as flat object with {fromSet, type, signature, description}
 *
 * @param {string} cwd - Project root directory
 * @param {string} setName - Name of the set that needs stubs
 * @returns {Array<{stub: string, sidecar: string}>} Array of stub/sidecar path pairs
 */
function generateStubFiles(cwd, setName) {
  const plan = require('./plan.cjs');
  const worktree = require('./worktree.cjs');

  // Load the consuming set's contract
  const setData = plan.loadSet(cwd, setName);
  const importsData = setData.contract.imports;

  // Determine which sets to import from, supporting both formats
  let importedSets = [];

  if (importsData) {
    if (Array.isArray(importsData.fromSets)) {
      // Legacy format: imports.fromSets is an array of {set, functions}
      importedSets = importsData.fromSets.map(entry => entry.set);
    } else if (typeof importsData === 'object' && !importsData.fromSets) {
      // New format: imports is a flat object where values have fromSet property
      const setNames = new Set();
      for (const [, importDef] of Object.entries(importsData)) {
        if (importDef && importDef.fromSet) {
          setNames.add(importDef.fromSet);
        }
      }
      importedSets = Array.from(setNames);
    }
  }

  if (importedSets.length === 0) {
    return [];
  }

  // Find the worktree path for this set
  const registry = worktree.readRegistry(cwd);
  const entry = registry.worktrees[setName];
  if (!entry) {
    throw new Error(`No worktree registered for set "${setName}"`);
  }

  const worktreePath = path.resolve(cwd, entry.path);
  const stubsDir = path.join(worktreePath, '.rapid-stubs');
  fs.mkdirSync(stubsDir, { recursive: true });

  const results = [];

  for (const importedSetName of importedSets) {
    const importedSetData = plan.loadSet(cwd, importedSetName);
    const stubContent = generateStub(importedSetData.contract, importedSetName);
    const stubFile = path.join(stubsDir, `${importedSetName}-stub.cjs`);
    const sidecarFile = `${stubFile}.rapid-stub`;

    fs.writeFileSync(stubFile, stubContent, 'utf-8');
    fs.writeFileSync(sidecarFile, '', 'utf-8'); // Zero-byte sidecar

    results.push({ stub: stubFile, sidecar: sidecarFile });
  }

  return results;
}

/**
 * Remove all stub files from a worktree's .rapid-stubs/ directory.
 *
 * Counts only .cjs stub files (not .rapid-stub sidecars) in the returned count,
 * so the count reflects the number of logical stubs removed.
 *
 * @param {string} worktreePath - Absolute path to the worktree directory
 * @returns {{ cleaned: true, count: number } | { cleaned: false, reason: string }}
 */
function cleanupStubFiles(worktreePath) {
  const stubsDir = path.join(worktreePath, '.rapid-stubs');

  if (!fs.existsSync(stubsDir)) {
    return { cleaned: false, reason: 'not_found' };
  }

  // Count only .cjs files (not .rapid-stub sidecars)
  const entries = fs.readdirSync(stubsDir);
  const cjsCount = entries.filter(e => {
    return e.endsWith('.cjs') && fs.statSync(path.join(stubsDir, e)).isFile();
  }).length;

  // Remove the entire directory
  fs.rmSync(stubsDir, { recursive: true, force: true });

  return { cleaned: true, count: cjsCount };
}

/**
 * Find and remove .rapid-stub sidecar files from an arbitrary directory tree.
 *
 * For each .rapid-stub sidecar found, removes both the sidecar AND the
 * corresponding source file (the sidecar path minus the .rapid-stub suffix).
 * This is used during merge-time cleanup where stubs may have been copied
 * into the worktree source tree.
 *
 * @param {string} targetDir - Directory to search recursively
 * @returns {{ cleaned: number, files: string[] }} cleaned count and list of source files removed
 */
function cleanupStubSidecars(targetDir) {
  if (!fs.existsSync(targetDir)) {
    return { cleaned: 0, files: [] };
  }

  const removedFiles = [];

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.rapid-stub')) {
        // Found a sidecar file -- remove it and the corresponding source file
        const sourceFile = fullPath.slice(0, -'.rapid-stub'.length);

        // Remove the source file if it exists
        if (fs.existsSync(sourceFile)) {
          fs.unlinkSync(sourceFile);
          removedFiles.push(sourceFile);
        }

        // Remove the sidecar file
        fs.unlinkSync(fullPath);
      }
    }
  }

  walkDir(targetDir);

  return { cleaned: removedFiles.length, files: removedFiles };
}

module.exports = { generateStub, generateStubFiles, cleanupStubFiles, cleanupStubSidecars, isRapidStub };
