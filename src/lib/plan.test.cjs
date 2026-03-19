'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  createSet,
  loadSet,
  listSets,
  decomposeIntoSets,
  writeDAG,
  writeOwnership,
  writeManifest,
  surfaceAssumptions,
} = require('./plan.cjs');

// ────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────

function makeSetDef(overrides = {}) {
  return {
    name: 'auth-system',
    scope: 'Authentication and authorization module',
    ownedFiles: ['src/auth/**', 'src/middleware/auth.js'],
    tasks: [
      { description: 'Implement JWT token generation', acceptance: 'jwt.test.cjs passes' },
      { description: 'Add login/logout endpoints', acceptance: 'api.test.cjs passes' },
    ],
    acceptance: ['All tasks complete with passing tests', 'CONTRACT.json satisfied'],
    wave: 1,
    parallelWith: ['data-layer'],
    contract: {
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
        types: [],
      },
    },
    ...overrides,
  };
}

function makeMinimalSetDefs() {
  return [
    makeSetDef({ name: 'auth-system', wave: 1, parallelWith: ['data-layer'], ownedFiles: ['src/auth/**'] }),
    makeSetDef({
      name: 'data-layer',
      scope: 'Data access layer',
      wave: 1,
      parallelWith: ['auth-system'],
      ownedFiles: ['src/data/**'],
      contract: {
        exports: {
          functions: [
            { name: 'createRecord', file: 'src/data/db.js', params: [{ name: 'data', type: 'object' }], returns: 'Promise<Record>' },
          ],
          types: [],
        },
      },
    }),
    makeSetDef({
      name: 'api-gateway',
      scope: 'API gateway routing',
      wave: 2,
      parallelWith: [],
      ownedFiles: ['src/api/**'],
      contract: {
        exports: {
          functions: [],
          types: [],
        },
        imports: {
          fromSets: [
            { set: 'auth-system', functions: ['authenticateUser'] },
            { set: 'data-layer', functions: ['createRecord'] },
          ],
        },
      },
    }),
  ];
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-plan-'));
  // Create minimal .planning structure
  fs.mkdirSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ────────────────────────────────────────────────────────────────
// createSet
// ────────────────────────────────────────────────────────────────
describe('createSet', () => {
  it('creates .planning/sets/{name}/ directory', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const setDir = path.join(tmpDir, '.planning', 'sets', 'auth-system');
    assert.ok(fs.existsSync(setDir), 'set directory should exist');
    assert.ok(fs.statSync(setDir).isDirectory(), 'should be a directory');
  });

  it('writes DEFINITION.md with correct set name heading', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const defPath = path.join(tmpDir, '.planning', 'sets', 'auth-system', 'DEFINITION.md');
    assert.ok(fs.existsSync(defPath), 'DEFINITION.md should exist');
    const content = fs.readFileSync(defPath, 'utf-8');
    assert.ok(content.includes('# Set: auth-system'), 'should include set name heading');
  });

  it('writes DEFINITION.md with scope section', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'sets', 'auth-system', 'DEFINITION.md'), 'utf-8');
    assert.ok(content.includes('## Scope'), 'should have Scope section');
    assert.ok(content.includes('Authentication and authorization module'), 'should include scope text');
  });

  it('writes DEFINITION.md with file ownership as bullet list', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'sets', 'auth-system', 'DEFINITION.md'), 'utf-8');
    assert.ok(content.includes('## File Ownership'), 'should have File Ownership section');
    assert.ok(content.includes('- src/auth/**'), 'should list owned file pattern');
    assert.ok(content.includes('- src/middleware/auth.js'), 'should list owned file');
  });

  it('writes DEFINITION.md with numbered tasks and acceptance criteria', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'sets', 'auth-system', 'DEFINITION.md'), 'utf-8');
    assert.ok(content.includes('## Tasks'), 'should have Tasks section');
    assert.ok(content.includes('1. Implement JWT token generation'), 'should have numbered task');
    assert.ok(content.includes('jwt.test.cjs passes'), 'should include task acceptance');
  });

  it('writes DEFINITION.md with wave assignment', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'sets', 'auth-system', 'DEFINITION.md'), 'utf-8');
    assert.ok(content.includes('## Wave Assignment'), 'should have Wave Assignment section');
    assert.ok(content.includes('Wave: 1'), 'should include wave number');
    assert.ok(content.includes('data-layer'), 'should include parallel sets');
  });

  it('writes DEFINITION.md with acceptance criteria as bullet list', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'sets', 'auth-system', 'DEFINITION.md'), 'utf-8');
    assert.ok(content.includes('## Acceptance Criteria'), 'should have Acceptance Criteria section');
    assert.ok(content.includes('- All tasks complete with passing tests'), 'should list acceptance criterion');
  });

  it('writes CONTRACT.json from setDef.contract', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const contractPath = path.join(tmpDir, '.planning', 'sets', 'auth-system', 'CONTRACT.json');
    assert.ok(fs.existsSync(contractPath), 'CONTRACT.json should exist');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
    assert.ok(contract.exports, 'should have exports');
    assert.equal(contract.exports.functions[0].name, 'authenticateUser');
  });

  it('writes contract.test.cjs generated from CONTRACT.json', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const testPath = path.join(tmpDir, '.planning', 'sets', 'auth-system', 'contract.test.cjs');
    assert.ok(fs.existsSync(testPath), 'contract.test.cjs should exist');
    const content = fs.readFileSync(testPath, 'utf-8');
    assert.ok(content.includes('AUTO-GENERATED'), 'should have auto-generated header');
    assert.ok(content.includes('auth-system'), 'should reference set name');
  });

  it('writes CONTRIBUTIONS.json when contributions are provided', () => {
    const def = makeSetDef({
      contributions: [
        { file: 'package.json', owner: 'data-layer', intent: 'Add express dependency' },
      ],
    });
    createSet(tmpDir, def);
    const contribPath = path.join(tmpDir, '.planning', 'sets', 'auth-system', 'CONTRIBUTIONS.json');
    assert.ok(fs.existsSync(contribPath), 'CONTRIBUTIONS.json should exist');
    const contrib = JSON.parse(fs.readFileSync(contribPath, 'utf-8'));
    assert.equal(contrib.set, 'auth-system');
    assert.equal(contrib.contributesTo.length, 1);
  });

  it('does not write CONTRIBUTIONS.json when contributions are absent', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const contribPath = path.join(tmpDir, '.planning', 'sets', 'auth-system', 'CONTRIBUTIONS.json');
    assert.ok(!fs.existsSync(contribPath), 'CONTRIBUTIONS.json should not exist');
  });

  it('returns { path, files } listing created files', () => {
    const def = makeSetDef();
    const result = createSet(tmpDir, def);
    assert.ok(result.path, 'should have path');
    assert.ok(result.path.includes('auth-system'), 'path should include set name');
    assert.ok(Array.isArray(result.files), 'files should be an array');
    assert.ok(result.files.includes('DEFINITION.md'), 'should list DEFINITION.md');
    assert.ok(result.files.includes('CONTRACT.json'), 'should list CONTRACT.json');
    assert.ok(result.files.includes('contract.test.cjs'), 'should list contract.test.cjs');
  });

  it('returns CONTRIBUTIONS.json in files list when contributions present', () => {
    const def = makeSetDef({
      contributions: [
        { file: 'package.json', owner: 'data-layer', intent: 'Add dep' },
      ],
    });
    const result = createSet(tmpDir, def);
    assert.ok(result.files.includes('CONTRIBUTIONS.json'), 'files should include CONTRIBUTIONS.json');
  });

  it('creates set directory with recursive: true (handles missing parents)', () => {
    // Remove the pre-created sets directory
    fs.rmSync(path.join(tmpDir, '.planning', 'sets'), { recursive: true, force: true });
    const def = makeSetDef();
    createSet(tmpDir, def);
    const setDir = path.join(tmpDir, '.planning', 'sets', 'auth-system');
    assert.ok(fs.existsSync(setDir), 'should create nested directory structure');
  });
});

// ────────────────────────────────────────────────────────────────
// loadSet
// ────────────────────────────────────────────────────────────────
describe('loadSet', () => {
  it('returns definition, contract, and contributions for an existing set', () => {
    const def = makeSetDef({
      contributions: [
        { file: 'package.json', owner: 'data-layer', intent: 'Add dep' },
      ],
    });
    createSet(tmpDir, def);
    const loaded = loadSet(tmpDir, 'auth-system');
    assert.ok(typeof loaded.definition === 'string', 'definition should be a string');
    assert.ok(loaded.definition.includes('# Set: auth-system'), 'definition should contain heading');
    assert.ok(typeof loaded.contract === 'object', 'contract should be an object');
    assert.equal(loaded.contract.exports.functions[0].name, 'authenticateUser');
    assert.ok(loaded.contributions, 'should have contributions');
    assert.equal(loaded.contributions.set, 'auth-system');
  });

  it('returns undefined contributions when CONTRIBUTIONS.json does not exist', () => {
    const def = makeSetDef();
    createSet(tmpDir, def);
    const loaded = loadSet(tmpDir, 'auth-system');
    assert.equal(loaded.contributions, undefined, 'contributions should be undefined');
  });

  it('throws Error when set directory does not exist', () => {
    assert.throws(() => loadSet(tmpDir, 'nonexistent-set'), /does not exist|ENOENT/);
  });

  it('returns null definition when DEFINITION.md is missing', () => {
    // Create set directory with only CONTRACT.json (no DEFINITION.md)
    const setDir = path.join(tmpDir, '.planning', 'sets', 'no-def-set');
    fs.mkdirSync(setDir, { recursive: true });
    const contract = { exports: { functions: [], types: [] }, imports: { fromSets: [] } };
    fs.writeFileSync(path.join(setDir, 'CONTRACT.json'), JSON.stringify(contract, null, 2), 'utf-8');

    const loaded = loadSet(tmpDir, 'no-def-set');
    assert.equal(loaded.definition, null, 'definition should be null when DEFINITION.md is missing');
    assert.ok(typeof loaded.contract === 'object', 'contract should still be a valid object');
    assert.deepStrictEqual(loaded.contract.exports.functions, []);
  });

  it('emits warning to stderr when DEFINITION.md is missing', () => {
    const setDir = path.join(tmpDir, '.planning', 'sets', 'warn-set');
    fs.mkdirSync(setDir, { recursive: true });
    const contract = { exports: { functions: [], types: [] }, imports: { fromSets: [] } };
    fs.writeFileSync(path.join(setDir, 'CONTRACT.json'), JSON.stringify(contract, null, 2), 'utf-8');

    const calls = [];
    const origError = console.error;
    try {
      console.error = (...args) => calls.push(args.join(' '));
      loadSet(tmpDir, 'warn-set');
    } finally {
      console.error = origError;
    }
    assert.ok(calls.length > 0, 'console.error should have been called');
    assert.ok(calls[0].includes('DEFINITION.md not found'), 'warning should mention DEFINITION.md not found');
  });

  it('still throws when CONTRACT.json is missing', () => {
    const setDir = path.join(tmpDir, '.planning', 'sets', 'no-contract-set');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'DEFINITION.md'), '# Set: no-contract-set\n', 'utf-8');

    assert.throws(() => loadSet(tmpDir, 'no-contract-set'), /ENOENT|CONTRACT/);
  });
});

// ────────────────────────────────────────────────────────────────
// listSets
// ────────────────────────────────────────────────────────────────
describe('listSets', () => {
  it('returns array of set names from .planning/sets/ directory', () => {
    createSet(tmpDir, makeSetDef({ name: 'set-a' }));
    createSet(tmpDir, makeSetDef({ name: 'set-b' }));
    const sets = listSets(tmpDir);
    assert.deepStrictEqual(sets, ['set-a', 'set-b']);
  });

  it('filters out non-directory entries (like DAG.json)', () => {
    createSet(tmpDir, makeSetDef({ name: 'my-set' }));
    // Write a JSON file that should be excluded
    fs.writeFileSync(path.join(tmpDir, '.planning', 'sets', 'DAG.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'sets', 'OWNERSHIP.json'), '{}');
    const sets = listSets(tmpDir);
    assert.deepStrictEqual(sets, ['my-set']);
  });

  it('returns empty array when no sets exist', () => {
    const sets = listSets(tmpDir);
    assert.deepStrictEqual(sets, []);
  });

  it('returns sorted array of set names', () => {
    createSet(tmpDir, makeSetDef({ name: 'zebra' }));
    createSet(tmpDir, makeSetDef({ name: 'alpha' }));
    createSet(tmpDir, makeSetDef({ name: 'middle' }));
    const sets = listSets(tmpDir);
    assert.deepStrictEqual(sets, ['alpha', 'middle', 'zebra']);
  });
});

// ────────────────────────────────────────────────────────────────
// writeDAG
// ────────────────────────────────────────────────────────────────
describe('writeDAG', () => {
  it('writes DAG object to .planning/sets/DAG.json', () => {
    const dag = { nodes: [{ id: 'a', wave: 1, status: 'pending' }], edges: [], waves: {}, metadata: {} };
    writeDAG(tmpDir, dag);
    const dagPath = path.join(tmpDir, '.planning', 'sets', 'DAG.json');
    assert.ok(fs.existsSync(dagPath), 'DAG.json should exist');
    const loaded = JSON.parse(fs.readFileSync(dagPath, 'utf-8'));
    assert.deepStrictEqual(loaded, dag);
  });

  it('writes DAG with pretty-printed JSON (2-space indent)', () => {
    const dag = { nodes: [], edges: [], waves: {}, metadata: {} };
    writeDAG(tmpDir, dag);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'sets', 'DAG.json'), 'utf-8');
    assert.ok(content.includes('\n'), 'should be pretty-printed with newlines');
    // 2-space indent means the keys should be indented
    assert.ok(content.includes('  "nodes"'), 'should use 2-space indentation');
  });
});

// ────────────────────────────────────────────────────────────────
// writeOwnership
// ────────────────────────────────────────────────────────────────
describe('writeOwnership', () => {
  it('writes ownership map to .planning/sets/OWNERSHIP.json', () => {
    const ownership = { version: 1, generated: '2026-03-04', ownership: { 'src/a.js': 'set-a' } };
    writeOwnership(tmpDir, ownership);
    const ownerPath = path.join(tmpDir, '.planning', 'sets', 'OWNERSHIP.json');
    assert.ok(fs.existsSync(ownerPath), 'OWNERSHIP.json should exist');
    const loaded = JSON.parse(fs.readFileSync(ownerPath, 'utf-8'));
    assert.deepStrictEqual(loaded, ownership);
  });
});

// ────────────────────────────────────────────────────────────────
// writeManifest
// ────────────────────────────────────────────────────────────────
describe('writeManifest', () => {
  it('writes manifest to .planning/contracts/MANIFEST.json', () => {
    const manifest = { version: 1, generated: '2026-03-04', contracts: [] };
    writeManifest(tmpDir, manifest);
    const manifestPath = path.join(tmpDir, '.planning', 'contracts', 'MANIFEST.json');
    assert.ok(fs.existsSync(manifestPath), 'MANIFEST.json should exist');
    const loaded = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.deepStrictEqual(loaded, manifest);
  });

  it('creates .planning/contracts/ directory if it does not exist', () => {
    const contractsDir = path.join(tmpDir, '.planning', 'contracts');
    assert.ok(!fs.existsSync(contractsDir), 'contracts dir should not exist initially');
    writeManifest(tmpDir, { version: 1, contracts: [] });
    assert.ok(fs.existsSync(contractsDir), 'contracts dir should be created');
  });
});

// ────────────────────────────────────────────────────────────────
// decomposeIntoSets
// ────────────────────────────────────────────────────────────────
describe('decomposeIntoSets', () => {
  it('creates set directories for all definitions', () => {
    const defs = makeMinimalSetDefs();
    decomposeIntoSets(tmpDir, defs);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'sets', 'auth-system')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'sets', 'data-layer')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'sets', 'api-gateway')));
  });

  it('writes DAG.json to .planning/sets/', () => {
    const defs = makeMinimalSetDefs();
    decomposeIntoSets(tmpDir, defs);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'sets', 'DAG.json')));
  });

  it('writes OWNERSHIP.json to .planning/sets/', () => {
    const defs = makeMinimalSetDefs();
    decomposeIntoSets(tmpDir, defs);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'sets', 'OWNERSHIP.json')));
  });

  it('writes MANIFEST.json to .planning/contracts/', () => {
    const defs = makeMinimalSetDefs();
    decomposeIntoSets(tmpDir, defs);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'contracts', 'MANIFEST.json')));
  });

  it('returns summary with sets, dag, ownership, manifest', () => {
    const defs = makeMinimalSetDefs();
    const result = decomposeIntoSets(tmpDir, defs);
    assert.ok(result.sets, 'should have sets');
    assert.ok(result.dag, 'should have dag');
    assert.ok(result.ownership, 'should have ownership');
    assert.ok(result.manifest, 'should have manifest');
  });

  it('creates edges from contract imports.fromSets', () => {
    const defs = makeMinimalSetDefs();
    const result = decomposeIntoSets(tmpDir, defs);
    // api-gateway imports from auth-system and data-layer
    const edges = result.dag.edges;
    assert.ok(edges.some(e => e.from === 'auth-system' && e.to === 'api-gateway'), 'should have auth->api edge');
    assert.ok(edges.some(e => e.from === 'data-layer' && e.to === 'api-gateway'), 'should have data->api edge');
  });

  it('throws on ownership conflicts (propagates from createOwnershipMap)', () => {
    const defs = [
      makeSetDef({ name: 'set-a', ownedFiles: ['src/shared.js'] }),
      makeSetDef({ name: 'set-b', ownedFiles: ['src/shared.js'] }),
    ];
    assert.throws(() => decomposeIntoSets(tmpDir, defs), /Ownership conflict/);
  });

  it('throws on DAG cycles (propagates from createDAG)', () => {
    const defs = [
      makeSetDef({
        name: 'a',
        ownedFiles: ['src/a/**'],
        contract: {
          exports: { functions: [], types: [] },
          imports: { fromSets: [{ set: 'b' }] },
        },
      }),
      makeSetDef({
        name: 'b',
        ownedFiles: ['src/b/**'],
        contract: {
          exports: { functions: [], types: [] },
          imports: { fromSets: [{ set: 'a' }] },
        },
      }),
    ];
    assert.throws(() => decomposeIntoSets(tmpDir, defs), /Cycle detected/);
  });
});

// ────────────────────────────────────────────────────────────────
// surfaceAssumptions
// ────────────────────────────────────────────────────────────────
describe('surfaceAssumptions', () => {
  it('returns structured text with scope understanding', () => {
    createSet(tmpDir, makeSetDef());
    const text = surfaceAssumptions(tmpDir, 'auth-system');
    assert.ok(typeof text === 'string', 'should return a string');
    assert.ok(text.includes('Scope Understanding'), 'should have Scope Understanding section');
    assert.ok(text.includes('Authentication and authorization module'), 'should include scope from DEFINITION.md');
  });

  it('includes file boundary assumptions', () => {
    createSet(tmpDir, makeSetDef());
    const text = surfaceAssumptions(tmpDir, 'auth-system');
    assert.ok(text.includes('File Boundaries'), 'should have File Boundaries section');
    assert.ok(text.includes('src/auth/**'), 'should list owned files');
  });

  it('includes contract assumptions with exports', () => {
    createSet(tmpDir, makeSetDef());
    const text = surfaceAssumptions(tmpDir, 'auth-system');
    assert.ok(text.includes('Contract Assumptions'), 'should have Contract Assumptions section');
    assert.ok(text.includes('authenticateUser'), 'should list exported function');
  });

  it('includes dependency assumptions when imports exist', () => {
    const def = makeSetDef({
      contract: {
        exports: { functions: [], types: [] },
        imports: { fromSets: [{ set: 'data-layer', functions: ['query'] }] },
      },
    });
    createSet(tmpDir, def);
    const text = surfaceAssumptions(tmpDir, 'auth-system');
    assert.ok(text.includes('Dependency Assumptions'), 'should have Dependency Assumptions section');
    assert.ok(text.includes('data-layer'), 'should reference dependency set');
  });

  it('includes risk factors section', () => {
    createSet(tmpDir, makeSetDef());
    const text = surfaceAssumptions(tmpDir, 'auth-system');
    assert.ok(text.includes('Risk Factors'), 'should have Risk Factors section');
  });

  it('throws when set does not exist', () => {
    assert.throws(() => surfaceAssumptions(tmpDir, 'nonexistent'), /does not exist|ENOENT/);
  });

  it('returns fallback message when DEFINITION.md is missing', () => {
    // Create set directory with only CONTRACT.json (no DEFINITION.md)
    const setDir = path.join(tmpDir, '.planning', 'sets', 'no-def-assumptions');
    fs.mkdirSync(setDir, { recursive: true });
    const contract = { exports: { functions: [], types: [] }, imports: { fromSets: [] } };
    fs.writeFileSync(path.join(setDir, 'CONTRACT.json'), JSON.stringify(contract, null, 2), 'utf-8');

    const text = surfaceAssumptions(tmpDir, 'no-def-assumptions');
    assert.ok(typeof text === 'string', 'should return a string');
    assert.ok(text.includes('No DEFINITION.md found'), 'should mention missing DEFINITION.md');
  });
});

// ────────────────────────────────────────────────────────────────
// resolveProjectRoot and worktree-aware loadSet
// ────────────────────────────────────────────────────────────────
describe('resolveProjectRoot and worktree-aware loadSet', () => {
  it('resolveProjectRoot falls back to cwd when no git repo', () => {
    // tmpDir is a plain temp dir with no git init -- resolveProjectRoot
    // should fall back to cwd, so loadSet still works with .planning/sets/<name>/ in tmpDir
    const def = makeSetDef({ name: 'fallback-set' });
    createSet(tmpDir, def);
    const loaded = loadSet(tmpDir, 'fallback-set');
    assert.ok(loaded.definition.includes('# Set: fallback-set'), 'should load definition via cwd fallback');
    assert.ok(loaded.contract.exports, 'should load contract via cwd fallback');
  });

  it('loadSet error message includes cwd and resolved root', () => {
    try {
      loadSet(tmpDir, 'nonexistent-set');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('cwd:'), `error message should contain "cwd:" but got: ${err.message}`);
      assert.ok(err.message.includes('resolved root:'), `error message should contain "resolved root:" but got: ${err.message}`);
      assert.ok(err.message.includes('nonexistent-set'), `error message should contain set name but got: ${err.message}`);
    }
  });

  it('listSets works from non-git temp dir context (fallback)', () => {
    createSet(tmpDir, makeSetDef({ name: 'alpha' }));
    createSet(tmpDir, makeSetDef({ name: 'beta' }));
    const sets = listSets(tmpDir);
    assert.deepStrictEqual(sets, ['alpha', 'beta']);
  });
});
