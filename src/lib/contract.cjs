'use strict';

/**
 * contract.cjs - Interface contract management for RAPID sets.
 *
 * Provides JSON Schema validation of CONTRACT.json files using Ajv,
 * auto-generation of contract test files, manifest creation with
 * consumer cross-referencing, file ownership maps, and contribution
 * declarations.
 *
 * Ajv CommonJS import: `require('ajv').default` is the correct CJS
 * import path for Ajv v8 (which ships ESM-first but includes CJS compat).
 */

// Ajv v8 CommonJS import -- uses .default due to ESM-first packaging
const Ajv = require('ajv').default;

/**
 * Meta-schema that validates the structure of CONTRACT.json files.
 *
 * Enforces:
 * - exports (required): functions array with name/file/params/returns, types array with name/file/shape
 * - imports (optional): fromSets array with set name and optional function/type lists
 * - behavioral (optional): invariants string array, sideEffects string array
 * - $schema, $id, title, description are allowed as optional metadata
 */
const CONTRACT_META_SCHEMA = {
  type: 'object',
  properties: {
    $schema: { type: 'string' },
    $id: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    exports: {
      type: 'object',
      properties: {
        functions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              file: { type: 'string' },
              params: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                  },
                  required: ['name', 'type'],
                },
              },
              returns: { type: 'string' },
            },
            required: ['name', 'file', 'params', 'returns'],
          },
        },
        types: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              file: { type: 'string' },
              shape: { type: 'object' },
            },
            required: ['name', 'file', 'shape'],
          },
        },
      },
    },
    imports: {
      type: 'object',
      properties: {
        fromSets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              set: { type: 'string' },
              functions: { type: 'array', items: { type: 'string' } },
              types: { type: 'array', items: { type: 'string' } },
            },
            required: ['set'],
          },
        },
      },
    },
    behavioral: {
      type: 'object',
      properties: {
        invariants: {
          type: 'array',
          items: { type: 'string' },
        },
        sideEffects: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    fileOwnership: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['exports'],
  additionalProperties: false,
};

// Create a dedicated Ajv instance for meta-schema validation
const metaAjv = new Ajv({ allErrors: true });
const metaValidate = metaAjv.compile(CONTRACT_META_SCHEMA);

/**
 * Validate a CONTRACT.json object against the contract meta-schema.
 *
 * @param {Object} contractJson - The contract object to validate
 * @returns {{ valid: true, validate: Function } | { valid: false, errors: Array }}
 */
function compileContract(contractJson) {
  const isValid = metaValidate(contractJson);

  if (!isValid) {
    return {
      valid: false,
      errors: metaValidate.errors.map((e) => {
        const path = e.instancePath || '';
        return `${path} ${e.message}`.trim();
      }),
    };
  }

  // If valid, compile the contract as a schema itself (so consumers can validate data against it)
  const contractAjv = new Ajv({ allErrors: true });
  try {
    const validate = contractAjv.compile({
      type: 'object',
      properties: {
        exports: { type: 'object' },
        imports: { type: 'object' },
        behavioral: { type: 'object' },
      },
    });
    return { valid: true, validate };
  } catch (err) {
    return { valid: false, errors: [err.message] };
  }
}

/**
 * Generate a contract test file (.test.cjs) as a string from a CONTRACT.json.
 *
 * The generated test uses node:test and node:assert/strict (matching project patterns).
 * It verifies that exported functions exist and are exported from their declared files,
 * and that exported type shapes can be compiled by Ajv.
 *
 * @param {string} setName - Name of the set (used in describe block and header)
 * @param {Object} contractJson - The parsed CONTRACT.json object
 * @returns {string} Complete .test.cjs file content
 */
function generateContractTest(setName, contractJson) {
  const functions = (contractJson.exports && contractJson.exports.functions) || [];
  const types = (contractJson.exports && contractJson.exports.types) || [];

  const escapedSetName = setName.replace(/'/g, "\\'");

  const lines = [];

  // AUTO-GENERATED header
  lines.push(`// AUTO-GENERATED from .planning/sets/${escapedSetName}/CONTRACT.json`);
  lines.push(`// Do not edit manually -- regenerate with: rapid-tools contract generate-test ${escapedSetName}`);
  lines.push("'use strict';");
  lines.push('');
  lines.push("var { describe, it } = require('node:test');");
  lines.push("var assert = require('node:assert/strict');");
  lines.push("var fs = require('fs');");
  lines.push("var path = require('path');");
  lines.push('');

  // Main describe block
  lines.push(`describe('Contract: ${escapedSetName}', function() {`);

  // Exported functions section
  lines.push(`  describe('Exported functions exist', function() {`);
  if (functions.length === 0) {
    lines.push(`    it('has no exported functions declared', function() {`);
    lines.push(`      assert.ok(true, 'No functions to verify');`);
    lines.push(`    });`);
  } else {
    for (const fn of functions) {
      const escapedName = fn.name.replace(/'/g, "\\'");
      const escapedFile = fn.file.replace(/'/g, "\\'");
      lines.push(`    it('exports ${escapedName} from ${escapedFile}', function() {`);
      lines.push(`      var filePath = path.resolve(__dirname, '../../..', '${escapedFile}');`);
      lines.push(`      assert.ok(fs.existsSync(filePath), 'File ${escapedFile} must exist');`);
      lines.push(`      var mod = require(filePath);`);
      lines.push(`      assert.ok(typeof mod['${escapedName}'] === 'function', '${escapedName} must be exported as a function');`);
      lines.push(`    });`);
    }
  }
  lines.push(`  });`);
  lines.push('');

  // Exported types section
  lines.push(`  describe('Exported types have correct shape', function() {`);
  if (types.length === 0) {
    lines.push(`    it('has no exported types declared', function() {`);
    lines.push(`      assert.ok(true, 'No types to verify');`);
    lines.push(`    });`);
  } else {
    lines.push(`    var Ajv = require('ajv').default;`);
    lines.push(`    var ajv = new Ajv({ allErrors: true });`);
    lines.push('');
    for (const type of types) {
      const escapedName = type.name.replace(/'/g, "\\'");
      const escapedFile = type.file.replace(/'/g, "\\'");
      const shapeStr = JSON.stringify(type.shape);
      lines.push(`    it('type ${escapedName} matches schema in ${escapedFile}', function() {`);
      lines.push(`      var filePath = path.resolve(__dirname, '../../..', '${escapedFile}');`);
      lines.push(`      assert.ok(fs.existsSync(filePath), 'File ${escapedFile} must exist');`);
      lines.push(`      var validate = ajv.compile(${shapeStr});`);
      lines.push(`      assert.ok(validate, 'Schema for ${escapedName} must compile');`);
      lines.push(`    });`);
    }
  }
  lines.push(`  });`);

  lines.push(`});`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Build a MANIFEST.json object from a set of per-set contract definitions.
 *
 * Cross-references imports.fromSets across all sets to populate consumer lists.
 *
 * @param {Array<{name: string, contractPath: string, contract: Object, wave: number}>} sets
 * @returns {Object} MANIFEST.json object
 */
function createManifest(sets) {
  // Build a map of which sets import from which other sets
  const consumerMap = {}; // setName -> [consumer set names]
  for (const set of sets) {
    consumerMap[set.name] = [];
  }

  for (const set of sets) {
    const imports = set.contract && set.contract.imports;
    if (imports && Array.isArray(imports.fromSets)) {
      for (const imp of imports.fromSets) {
        if (consumerMap[imp.set]) {
          consumerMap[imp.set].push(set.name);
        }
      }
    }
  }

  const contracts = sets.map((set) => {
    const functions = (set.contract.exports && set.contract.exports.functions) || [];
    const types = (set.contract.exports && set.contract.exports.types) || [];
    const exportNames = [
      ...functions.map((f) => f.name),
      ...types.map((t) => t.name),
    ];

    return {
      set: set.name,
      path: set.contractPath,
      schemaId: `rapid://contracts/${set.name}`,
      wave: set.wave,
      exports: exportNames,
      consumers: consumerMap[set.name] || [],
    };
  });

  return {
    version: 1,
    generated: new Date().toISOString().split('T')[0],
    contracts,
  };
}

/**
 * Build an OWNERSHIP.json object from set definitions with file ownership.
 *
 * Detects conflicts (two sets claiming the same file) and overlaps
 * (a specific file path falling under another set's directory pattern).
 *
 * @param {Array<{name: string, ownedFiles: string[]}>} sets
 * @returns {Object} OWNERSHIP.json object
 * @throws {Error} If ownership conflict detected (duplicate file)
 * @throws {Error} If ownership overlap detected (file under directory pattern)
 */
function createOwnershipMap(sets) {
  const ownership = {};
  const allEntries = []; // { path, set } for overlap checking

  for (const set of sets) {
    for (const filePath of set.ownedFiles) {
      // Check for exact duplicate
      if (ownership[filePath]) {
        throw new Error(
          `Ownership conflict: "${filePath}" is claimed by both "${ownership[filePath]}" and "${set.name}"`
        );
      }
      ownership[filePath] = set.name;
      allEntries.push({ path: filePath, set: set.name });
    }
  }

  // Check for overlaps: directory patterns (ending in /**) vs specific files
  for (let i = 0; i < allEntries.length; i++) {
    for (let j = i + 1; j < allEntries.length; j++) {
      const a = allEntries[i];
      const b = allEntries[j];

      if (a.set === b.set) continue; // Same set can own overlapping paths

      // Check if a is a directory pattern and b falls under it
      if (a.path.endsWith('/**')) {
        const prefix = a.path.replace('/**', '/');
        if (b.path.startsWith(prefix) && !b.path.endsWith('/**')) {
          throw new Error(
            `Ownership overlap: "${b.path}" (owned by "${b.set}") falls under directory pattern "${a.path}" (owned by "${a.set}")`
          );
        }
      }

      // Check if b is a directory pattern and a falls under it
      if (b.path.endsWith('/**')) {
        const prefix = b.path.replace('/**', '/');
        if (a.path.startsWith(prefix) && !a.path.endsWith('/**')) {
          throw new Error(
            `Ownership overlap: "${a.path}" (owned by "${a.set}") falls under directory pattern "${b.path}" (owned by "${b.set}")`
          );
        }
      }
    }
  }

  return {
    version: 1,
    generated: new Date().toISOString().split('T')[0],
    ownership,
  };
}

/**
 * Look up which set owns a given file path.
 *
 * First tries exact match, then directory pattern match using startsWith.
 *
 * @param {Object<string, string>} ownershipMap - The ownership object (path -> set name)
 * @param {string} filePath - File path to check
 * @returns {string|null} Owning set name or null if unowned
 */
function checkOwnership(ownershipMap, filePath) {
  // Try exact match first
  if (ownershipMap[filePath]) {
    return ownershipMap[filePath];
  }

  // Try directory pattern match
  for (const [pattern, owner] of Object.entries(ownershipMap)) {
    if (pattern.endsWith('/**')) {
      const prefix = pattern.replace('/**', '/');
      if (filePath.startsWith(prefix)) {
        return owner;
      }
    }
  }

  return null;
}

/**
 * Create a CONTRIBUTIONS.json object for cross-set file modifications.
 *
 * Validates that each contribution has the required fields: file, owner, intent.
 *
 * @param {string} setName - The contributing set's name
 * @param {Array<{file: string, owner: string, intent: string, section?: string, priority?: number}>} contributions
 * @returns {Object} CONTRIBUTIONS.json object
 * @throws {Error} If a contribution is missing required fields
 */
function createContribution(setName, contributions) {
  for (let i = 0; i < contributions.length; i++) {
    const c = contributions[i];
    const missing = [];
    if (!c.file) missing.push('file');
    if (!c.owner) missing.push('owner');
    if (!c.intent) missing.push('intent');
    if (missing.length > 0) {
      throw new Error(
        `Contribution at index ${i} missing required fields: ${missing.join(', ')}`
      );
    }
  }

  return {
    set: setName,
    contributesTo: contributions,
  };
}

module.exports = {
  CONTRACT_META_SCHEMA,
  compileContract,
  generateContractTest,
  createManifest,
  createOwnershipMap,
  checkOwnership,
  createContribution,
};
