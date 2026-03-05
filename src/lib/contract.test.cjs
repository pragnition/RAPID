'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  CONTRACT_META_SCHEMA,
  compileContract,
  generateContractTest,
  createManifest,
  createOwnershipMap,
  checkOwnership,
  createContribution,
} = require('./contract.cjs');

// ────────────────────────────────────────────────────────────────
// Sample data used across tests
// ────────────────────────────────────────────────────────────────
function validContract() {
  return {
    exports: {
      functions: [
        {
          name: 'authenticateUser',
          file: 'src/auth/login.js',
          params: [
            { name: 'email', type: 'string' },
            { name: 'password', type: 'string' },
          ],
          returns: 'Promise<AuthToken>',
        },
      ],
      types: [
        {
          name: 'AuthToken',
          file: 'src/auth/types.js',
          shape: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              expiresAt: { type: 'number' },
            },
            required: ['token', 'expiresAt'],
          },
        },
      ],
    },
  };
}

function validContractWithImports() {
  return {
    ...validContract(),
    imports: {
      fromSets: [
        { set: 'data-layer', functions: ['queryUser'] },
      ],
    },
  };
}

// ────────────────────────────────────────────────────────────────
// CONTRACT_META_SCHEMA
// ────────────────────────────────────────────────────────────────
describe('CONTRACT_META_SCHEMA', () => {
  it('is a JSON Schema object', () => {
    assert.ok(typeof CONTRACT_META_SCHEMA === 'object');
    assert.ok(CONTRACT_META_SCHEMA.type || CONTRACT_META_SCHEMA.properties);
  });

  it('requires exports field', () => {
    assert.ok(
      Array.isArray(CONTRACT_META_SCHEMA.required) &&
      CONTRACT_META_SCHEMA.required.includes('exports')
    );
  });
});

// ────────────────────────────────────────────────────────────────
// compileContract
// ────────────────────────────────────────────────────────────────
describe('compileContract', () => {
  it('returns { valid: true, validate: Function } for a valid CONTRACT.json', () => {
    const result = compileContract(validContract());
    assert.equal(result.valid, true);
    assert.equal(typeof result.validate, 'function');
  });

  it('returns { valid: false, errors: [...] } when contract fails meta-schema validation', () => {
    const badContract = {
      exports: {
        functions: [
          {
            name: 'foo',
            // missing file, params, returns
          },
        ],
      },
    };
    const result = compileContract(badContract);
    assert.equal(result.valid, false);
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.length > 0);
  });

  it('returns { valid: false, errors: [...] } for contracts missing required "exports" field', () => {
    const result = compileContract({ behavioral: { invariants: [] } });
    assert.equal(result.valid, false);
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.length > 0);
  });

  it('accepts a contract with only exports.functions (no types)', () => {
    const contract = {
      exports: {
        functions: [
          {
            name: 'doSomething',
            file: 'src/lib/do.js',
            params: [],
            returns: 'void',
          },
        ],
      },
    };
    const result = compileContract(contract);
    assert.equal(result.valid, true);
  });

  it('accepts a contract with optional metadata fields', () => {
    const contract = {
      ...validContract(),
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'rapid://contracts/auth-system',
      title: 'auth-system Contract',
      description: 'Interface contract for auth-system',
    };
    const result = compileContract(contract);
    assert.equal(result.valid, true);
  });

  it('accepts a contract with behavioral section', () => {
    const contract = {
      ...validContract(),
      behavioral: {
        invariants: ['Tokens expire after 1 hour'],
        sideEffects: ['Writes to audit log'],
      },
    };
    const result = compileContract(contract);
    assert.equal(result.valid, true);
  });

  it('accepts a contract with imports section', () => {
    const result = compileContract(validContractWithImports());
    assert.equal(result.valid, true);
  });
});

// ────────────────────────────────────────────────────────────────
// generateContractTest
// ────────────────────────────────────────────────────────────────
describe('generateContractTest', () => {
  it('returns a string containing valid node:test JavaScript code', () => {
    const code = generateContractTest('auth-system', validContract());
    assert.ok(typeof code === 'string');
    assert.ok(code.includes("require('node:test')"));
    assert.ok(code.includes("require('node:assert/strict')"));
  });

  it('contains AUTO-GENERATED header comment with set name', () => {
    const code = generateContractTest('auth-system', validContract());
    assert.ok(code.includes('AUTO-GENERATED'));
    assert.ok(code.includes('auth-system'));
  });

  it('contains describe block for "Exported functions exist"', () => {
    const code = generateContractTest('auth-system', validContract());
    assert.ok(code.includes('Exported functions exist'));
  });

  it('contains describe block for "Exported types have correct shape"', () => {
    const code = generateContractTest('auth-system', validContract());
    assert.ok(code.includes('Exported types have correct shape'));
  });

  it('contains it() blocks for each function checking file existence and export', () => {
    const code = generateContractTest('auth-system', validContract());
    assert.ok(code.includes('authenticateUser'));
    assert.ok(code.includes('src/auth/login.js'));
  });

  it('contains it() blocks for each type checking shape compilation', () => {
    const code = generateContractTest('auth-system', validContract());
    assert.ok(code.includes('AuthToken'));
    assert.ok(code.includes('src/auth/types.js'));
  });

  it('generates syntactically valid JavaScript (can be parsed by node)', () => {
    const code = generateContractTest('auth-system', validContract());
    // Using Function constructor to parse (not execute) for syntax check
    // This checks that the code can be parsed without SyntaxError
    assert.doesNotThrow(() => {
      new Function(code);
    });
  });

  it('handles contract with no types array', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'fn1', file: 'src/a.js', params: [], returns: 'void' },
        ],
      },
    };
    const code = generateContractTest('minimal-set', contract);
    assert.ok(typeof code === 'string');
    assert.ok(code.includes('fn1'));
  });

  it('handles contract with no functions array', () => {
    const contract = {
      exports: {
        types: [
          {
            name: 'MyType',
            file: 'src/types.js',
            shape: { type: 'object' },
          },
        ],
      },
    };
    const code = generateContractTest('types-only', contract);
    assert.ok(typeof code === 'string');
    assert.ok(code.includes('MyType'));
  });
});

// ────────────────────────────────────────────────────────────────
// createManifest
// ────────────────────────────────────────────────────────────────
describe('createManifest', () => {
  it('builds a MANIFEST.json object from array of set entries', () => {
    const sets = [
      {
        name: 'auth-system',
        contractPath: '.planning/sets/auth-system/CONTRACT.json',
        contract: validContract(),
        wave: 1,
      },
    ];
    const manifest = createManifest(sets);
    assert.equal(manifest.version, 1);
    assert.ok(manifest.generated);
    assert.ok(Array.isArray(manifest.contracts));
    assert.equal(manifest.contracts.length, 1);
  });

  it('populates exports array from contract.exports.functions[].name', () => {
    const sets = [
      {
        name: 'auth-system',
        contractPath: '.planning/sets/auth-system/CONTRACT.json',
        contract: validContract(),
        wave: 1,
      },
    ];
    const manifest = createManifest(sets);
    assert.ok(manifest.contracts[0].exports.includes('authenticateUser'));
  });

  it('uses rapid://contracts/{setName} for schemaId', () => {
    const sets = [
      {
        name: 'auth-system',
        contractPath: '.planning/sets/auth-system/CONTRACT.json',
        contract: validContract(),
        wave: 1,
      },
    ];
    const manifest = createManifest(sets);
    assert.equal(manifest.contracts[0].schemaId, 'rapid://contracts/auth-system');
  });

  it('populates consumers array by cross-referencing imports.fromSets', () => {
    const sets = [
      {
        name: 'auth-system',
        contractPath: '.planning/sets/auth-system/CONTRACT.json',
        contract: validContract(),
        wave: 1,
      },
      {
        name: 'api-gateway',
        contractPath: '.planning/sets/api-gateway/CONTRACT.json',
        contract: {
          exports: {
            functions: [{ name: 'handleRequest', file: 'src/api/handler.js', params: [], returns: 'Response' }],
          },
          imports: {
            fromSets: [{ set: 'auth-system', functions: ['authenticateUser'] }],
          },
        },
        wave: 2,
      },
    ];
    const manifest = createManifest(sets);
    const authEntry = manifest.contracts.find((c) => c.set === 'auth-system');
    assert.ok(authEntry.consumers.includes('api-gateway'));
  });

  it('returns empty consumers for sets nobody imports from', () => {
    const sets = [
      {
        name: 'isolated',
        contractPath: '.planning/sets/isolated/CONTRACT.json',
        contract: { exports: { functions: [] } },
        wave: 1,
      },
    ];
    const manifest = createManifest(sets);
    assert.deepStrictEqual(manifest.contracts[0].consumers, []);
  });
});

// ────────────────────────────────────────────────────────────────
// createOwnershipMap
// ────────────────────────────────────────────────────────────────
describe('createOwnershipMap', () => {
  it('builds OWNERSHIP.json from array of set entries', () => {
    const sets = [
      { name: 'auth', ownedFiles: ['src/auth/**', 'src/middleware/auth.js'] },
      { name: 'data', ownedFiles: ['src/data/**'] },
    ];
    const map = createOwnershipMap(sets);
    assert.equal(map.version, 1);
    assert.ok(map.generated);
    assert.equal(map.ownership['src/auth/**'], 'auth');
    assert.equal(map.ownership['src/middleware/auth.js'], 'auth');
    assert.equal(map.ownership['src/data/**'], 'data');
  });

  it('throws Error when two sets claim the same file path', () => {
    const sets = [
      { name: 'set-a', ownedFiles: ['package.json'] },
      { name: 'set-b', ownedFiles: ['package.json'] },
    ];
    assert.throws(
      () => createOwnershipMap(sets),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('package.json'));
        assert.ok(err.message.includes('set-a'));
        assert.ok(err.message.includes('set-b'));
        return true;
      }
    );
  });

  it('throws Error when two sets claim overlapping directory patterns', () => {
    const sets = [
      { name: 'set-a', ownedFiles: ['src/auth/**'] },
      { name: 'set-b', ownedFiles: ['src/auth/login.js'] },
    ];
    assert.throws(
      () => createOwnershipMap(sets),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('src/auth'));
        return true;
      }
    );
  });

  it('allows non-overlapping paths', () => {
    const sets = [
      { name: 'set-a', ownedFiles: ['src/auth/**'] },
      { name: 'set-b', ownedFiles: ['src/data/**'] },
    ];
    assert.doesNotThrow(() => createOwnershipMap(sets));
  });
});

// ────────────────────────────────────────────────────────────────
// checkOwnership
// ────────────────────────────────────────────────────────────────
describe('checkOwnership', () => {
  const ownershipMap = {
    'src/auth/**': 'auth-system',
    'src/middleware/auth.js': 'auth-system',
    'src/data/**': 'data-layer',
    'package.json': 'data-layer',
  };

  it('returns owning set name for an exact file match', () => {
    const result = checkOwnership(ownershipMap, 'package.json');
    assert.equal(result, 'data-layer');
  });

  it('returns owning set name for an exact specific file match', () => {
    const result = checkOwnership(ownershipMap, 'src/middleware/auth.js');
    assert.equal(result, 'auth-system');
  });

  it('returns owning set name for a file under a directory pattern', () => {
    const result = checkOwnership(ownershipMap, 'src/auth/login.js');
    assert.equal(result, 'auth-system');
  });

  it('returns owning set for deeply nested file under directory pattern', () => {
    const result = checkOwnership(ownershipMap, 'src/data/models/user.js');
    assert.equal(result, 'data-layer');
  });

  it('returns null for unowned files', () => {
    const result = checkOwnership(ownershipMap, 'src/ui/component.js');
    assert.equal(result, null);
  });

  it('returns null for empty ownership map', () => {
    const result = checkOwnership({}, 'anything.js');
    assert.equal(result, null);
  });
});

// ────────────────────────────────────────────────────────────────
// createContribution
// ────────────────────────────────────────────────────────────────
describe('createContribution', () => {
  it('returns a valid CONTRIBUTIONS.json object', () => {
    const contributions = [
      {
        file: 'package.json',
        owner: 'data-layer',
        intent: 'Add express dependency',
        section: 'dependencies',
        priority: 2,
      },
    ];
    const result = createContribution('api-gateway', contributions);
    assert.equal(result.set, 'api-gateway');
    assert.ok(Array.isArray(result.contributesTo));
    assert.equal(result.contributesTo.length, 1);
    assert.equal(result.contributesTo[0].file, 'package.json');
    assert.equal(result.contributesTo[0].owner, 'data-layer');
    assert.equal(result.contributesTo[0].intent, 'Add express dependency');
    assert.equal(result.contributesTo[0].section, 'dependencies');
    assert.equal(result.contributesTo[0].priority, 2);
  });

  it('validates each contribution has required fields (file, owner, intent)', () => {
    assert.throws(
      () => createContribution('set-a', [{ file: 'package.json' }]),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('owner') || err.message.includes('intent'));
        return true;
      }
    );
  });

  it('handles multiple contributions', () => {
    const contributions = [
      { file: 'package.json', owner: 'data', intent: 'Add dep A' },
      { file: 'tsconfig.json', owner: 'core', intent: 'Add path alias' },
    ];
    const result = createContribution('my-set', contributions);
    assert.equal(result.contributesTo.length, 2);
  });

  it('preserves optional fields (section, priority)', () => {
    const contributions = [
      {
        file: 'package.json',
        owner: 'core',
        intent: 'Add deps',
        section: 'dependencies',
        priority: 1,
      },
    ];
    const result = createContribution('my-set', contributions);
    assert.equal(result.contributesTo[0].section, 'dependencies');
    assert.equal(result.contributesTo[0].priority, 1);
  });
});
