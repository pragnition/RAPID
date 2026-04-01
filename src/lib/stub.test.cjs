'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const stubModule = require('./stub.cjs');

// ────────────────────────────────────────────────────────────────
// generateStub
// ────────────────────────────────────────────────────────────────
describe('generateStub', () => {
  it('first line is exactly // RAPID-STUB', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'hello', file: 'src/hello.cjs', params: [], returns: 'string' },
        ],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'test-set');
    const lines = result.split('\n');
    assert.equal(lines[0], '// RAPID-STUB');
  });

  it('produces realistic return values for common types', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'getString', file: 'src/a.cjs', params: [], returns: 'string' },
          { name: 'getNumber', file: 'src/a.cjs', params: [], returns: 'number' },
          { name: 'getBool', file: 'src/a.cjs', params: [], returns: 'boolean' },
          { name: 'getObj', file: 'src/a.cjs', params: [], returns: 'object' },
          { name: 'getArr', file: 'src/a.cjs', params: [], returns: 'array' },
        ],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'types-set');

    assert.ok(result.includes("return '';"), 'should return empty string for string type');
    assert.ok(result.includes('return 0;'), 'should return 0 for number type');
    assert.ok(result.includes('return false;'), 'should return false for boolean type');
    assert.ok(result.includes('return {};'), 'should return {} for object type');
    assert.ok(result.includes('return [];'), 'should return [] for array type');
    assert.ok(!result.includes('throw'), 'should NOT contain throw statements');
  });

  it('returns null for unrecognized types', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'getWidget', file: 'src/a.cjs', params: [], returns: 'CustomWidget' },
        ],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'widget-set');
    assert.ok(result.includes('return null;'), 'should return null for unrecognized type');
  });

  it('handles Promise<T> return types', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'fetchName', file: 'src/a.cjs', params: [], returns: 'Promise<string>' },
        ],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'async-set');
    assert.ok(result.includes("return Promise.resolve('');"), 'should return Promise.resolve(\'\') for Promise<string>');
  });

  it('handles nested Promise<Array<string>> types', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'fetchItems', file: 'src/a.cjs', params: [], returns: 'Promise<Array<string>>' },
        ],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'nested-set');
    assert.ok(result.includes('return Promise.resolve([]);'), 'should return Promise.resolve([]) for Promise<Array<string>>');
  });

  it('produces JSDoc @param and @returns annotations', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'getItem', file: 'src/store.cjs', params: [{ name: 'id', type: 'number' }], returns: 'object' },
        ],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'store-core');
    assert.ok(result.includes('@param {number} id'), 'should have @param for id');
    assert.ok(result.includes('@returns {object}'), 'should have @returns');
  });

  it('produces @typedef blocks from exports.types', () => {
    const contract = {
      exports: {
        functions: [],
        types: [
          {
            name: 'UserProfile',
            file: 'src/types.cjs',
            shape: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                age: { type: 'number' },
              },
            },
          },
        ],
      },
    };

    const result = stubModule.generateStub(contract, 'user-set');
    assert.ok(result.includes('@typedef {Object} UserProfile'), 'should have @typedef for UserProfile');
    assert.ok(result.includes('@property {string} id'), 'should have @property for id');
    assert.ok(result.includes('@property {string} name'), 'should have @property for name');
    assert.ok(result.includes('@property {number} age'), 'should have @property for age');
  });

  it('handles contract with no exports key gracefully', () => {
    const contract = {};
    const result = stubModule.generateStub(contract, 'bare-set');
    const lines = result.split('\n');
    assert.equal(lines[0], '// RAPID-STUB', 'should have RAPID-STUB marker');
    assert.ok(result.includes('module.exports'), 'should have module.exports');
  });

  it('handles new flat exports contract format', () => {
    const contract = {
      exports: {
        createUser: {
          type: 'function',
          signature: 'createUser(email: string, password: string): Promise<object>',
          description: 'Creates a new user account',
        },
        deleteUser: {
          type: 'function',
          signature: 'deleteUser(userId: string): boolean',
          description: 'Deletes a user by ID',
        },
      },
    };

    const result = stubModule.generateStub(contract, 'auth-set');
    const lines = result.split('\n');

    assert.equal(lines[0], '// RAPID-STUB', 'should have RAPID-STUB marker');
    assert.ok(result.includes('function createUser(email, password)'), 'should parse createUser signature');
    assert.ok(result.includes('function deleteUser(userId)'), 'should parse deleteUser signature');
    assert.ok(result.includes("return Promise.resolve({});"), 'should return Promise.resolve({}) for Promise<object>');
    assert.ok(result.includes('return false;'), 'should return false for boolean');
    assert.ok(result.includes('@param {string} email'), 'should have @param for email');
    assert.ok(result.includes('Creates a new user account'), 'should include description in JSDoc');
  });

  it('generated stub is require()-able and returns values instead of throwing', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'getName', file: 'src/a.cjs', params: [], returns: 'string' },
          { name: 'getCount', file: 'src/a.cjs', params: [], returns: 'number' },
          { name: 'isValid', file: 'src/a.cjs', params: [], returns: 'boolean' },
        ],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'callable-set');
    const tmpFile = path.join(os.tmpdir(), `stub-callable-${Date.now()}.cjs`);
    fs.writeFileSync(tmpFile, result, 'utf-8');

    try {
      const mod = require(tmpFile);
      assert.ok(typeof mod.getName === 'function', 'getName should be a function');
      assert.ok(typeof mod.getCount === 'function', 'getCount should be a function');
      assert.ok(typeof mod.isValid === 'function', 'isValid should be a function');

      // Should return values, not throw
      assert.equal(mod.getName(), '', 'getName should return empty string');
      assert.equal(mod.getCount(), 0, 'getCount should return 0');
      assert.equal(mod.isValid(), false, 'isValid should return false');
    } finally {
      fs.unlinkSync(tmpFile);
      // Clear require cache
      delete require.cache[tmpFile];
    }
  });
});

// ────────────────────────────────────────────────────────────────
// isRapidStub
// ────────────────────────────────────────────────────────────────
describe('isRapidStub', () => {
  it('returns true for content starting with // RAPID-STUB', () => {
    const content = '// RAPID-STUB\n// Generated from CONTRACT.json\n\'use strict\';\n';
    assert.equal(stubModule.isRapidStub(content), true);
  });

  it('returns false for content starting with other comments', () => {
    assert.equal(stubModule.isRapidStub('// AUTO-GENERATED stub for set: foo\n'), false);
    assert.equal(stubModule.isRapidStub('// Some other comment\n'), false);
    assert.equal(stubModule.isRapidStub("'use strict';\n"), false);
  });

  it('returns false for empty string', () => {
    assert.equal(stubModule.isRapidStub(''), false);
  });

  it('returns false for null and undefined', () => {
    assert.equal(stubModule.isRapidStub(null), false);
    assert.equal(stubModule.isRapidStub(undefined), false);
  });

  it('handles Windows line endings (\\r\\n)', () => {
    const content = '// RAPID-STUB\r\n// Generated from CONTRACT.json\r\n';
    assert.equal(stubModule.isRapidStub(content), true);
  });
});

// ────────────────────────────────────────────────────────────────
// generateStubFiles
// ────────────────────────────────────────────────────────────────
describe('generateStubFiles', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-stub-files-'));

    // Create .planning/sets/ structure
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    // Create .planning/worktrees/ directory and registry
    const wtRegDir = path.join(tmpDir, '.planning', 'worktrees');
    fs.mkdirSync(wtRegDir, { recursive: true });

    // Create .rapid-worktrees/ directory
    const wtDir = path.join(tmpDir, '.rapid-worktrees');
    fs.mkdirSync(wtDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when set has no imports', () => {
    // Create the consumer set with no imports
    const consumerDir = path.join(tmpDir, '.planning', 'sets', 'consumer-set');
    fs.mkdirSync(consumerDir, { recursive: true });
    fs.writeFileSync(path.join(consumerDir, 'DEFINITION.md'), '# Set: consumer-set\n## Scope\nTest\n', 'utf-8');
    fs.writeFileSync(path.join(consumerDir, 'CONTRACT.json'), JSON.stringify({
      exports: { functions: [], types: [] },
    }), 'utf-8');

    // Create worktree dir for consumer
    const wtPath = path.join(tmpDir, '.rapid-worktrees', 'consumer-set');
    fs.mkdirSync(wtPath, { recursive: true });

    // Create registry with consumer-set
    const registry = {
      version: 1,
      worktrees: {
        'consumer-set': {
          setName: 'consumer-set',
          branch: 'rapid/consumer-set',
          path: '.rapid-worktrees/consumer-set',
          phase: 'Created',
          status: 'active',
        },
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'worktrees', 'REGISTRY.json'),
      JSON.stringify(registry, null, 2),
      'utf-8'
    );

    const result = stubModule.generateStubFiles(tmpDir, 'consumer-set');
    assert.ok(Array.isArray(result), 'should return an array');
    assert.equal(result.length, 0, 'should return empty array when no imports');
  });

  it('creates .rapid-stubs/ with correct files and sidecar files (legacy format)', () => {
    // Create the provider set (auth-core) with exported functions
    const authDir = path.join(tmpDir, '.planning', 'sets', 'auth-core');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'DEFINITION.md'), '# Set: auth-core\n## Scope\nAuth\n', 'utf-8');
    fs.writeFileSync(path.join(authDir, 'CONTRACT.json'), JSON.stringify({
      exports: {
        functions: [
          { name: 'verifyToken', file: 'src/auth/verify.cjs', params: [{ name: 'token', type: 'string' }], returns: 'boolean' },
        ],
        types: [],
      },
    }), 'utf-8');

    // Create the consumer set that imports from auth-core
    const consumerDir = path.join(tmpDir, '.planning', 'sets', 'api-set');
    fs.mkdirSync(consumerDir, { recursive: true });
    fs.writeFileSync(path.join(consumerDir, 'DEFINITION.md'), '# Set: api-set\n## Scope\nAPI\n', 'utf-8');
    fs.writeFileSync(path.join(consumerDir, 'CONTRACT.json'), JSON.stringify({
      exports: { functions: [], types: [] },
      imports: {
        fromSets: [
          { set: 'auth-core', functions: ['verifyToken'] },
        ],
      },
    }), 'utf-8');

    // Create worktree dir for the consumer
    const wtPath = path.join(tmpDir, '.rapid-worktrees', 'api-set');
    fs.mkdirSync(wtPath, { recursive: true });

    // Create registry
    const registry = {
      version: 1,
      worktrees: {
        'api-set': {
          setName: 'api-set',
          branch: 'rapid/api-set',
          path: '.rapid-worktrees/api-set',
          phase: 'Created',
          status: 'active',
        },
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'worktrees', 'REGISTRY.json'),
      JSON.stringify(registry, null, 2),
      'utf-8'
    );

    const result = stubModule.generateStubFiles(tmpDir, 'api-set');

    // Should return array of {stub, sidecar} objects
    assert.ok(Array.isArray(result), 'should return an array');
    assert.equal(result.length, 1, 'should create 1 stub entry');
    assert.ok(result[0].stub, 'entry should have stub property');
    assert.ok(result[0].sidecar, 'entry should have sidecar property');

    // Check the stub file exists
    const stubPath = path.join(wtPath, '.rapid-stubs', 'auth-core-stub.cjs');
    assert.ok(fs.existsSync(stubPath), 'stub file should exist at .rapid-stubs/auth-core-stub.cjs');

    // Check sidecar file exists and is zero-byte
    const sidecarPath = `${stubPath}.rapid-stub`;
    assert.ok(fs.existsSync(sidecarPath), 'sidecar file should exist');
    const sidecarStat = fs.statSync(sidecarPath);
    assert.equal(sidecarStat.size, 0, 'sidecar file should be zero-byte');

    // Check stub content has RAPID-STUB marker
    const content = fs.readFileSync(stubPath, 'utf-8');
    assert.ok(content.startsWith('// RAPID-STUB'), 'stub should start with // RAPID-STUB');
    assert.ok(content.includes('verifyToken'), 'stub should contain verifyToken function');
  });

  it('handles new flat import format', () => {
    // Create the provider set
    const providerDir = path.join(tmpDir, '.planning', 'sets', 'dag-grouping');
    fs.mkdirSync(providerDir, { recursive: true });
    fs.writeFileSync(path.join(providerDir, 'DEFINITION.md'), '# Set: dag-grouping\n## Scope\nDAG\n', 'utf-8');
    fs.writeFileSync(path.join(providerDir, 'CONTRACT.json'), JSON.stringify({
      exports: {
        functions: [
          { name: 'partitionGroups', file: 'src/dag.cjs', params: [{ name: 'dag', type: 'object' }], returns: 'object' },
        ],
        types: [],
      },
    }), 'utf-8');

    // Create the consumer set with new flat import format
    const consumerDir = path.join(tmpDir, '.planning', 'sets', 'scaffold-set');
    fs.mkdirSync(consumerDir, { recursive: true });
    fs.writeFileSync(path.join(consumerDir, 'DEFINITION.md'), '# Set: scaffold-set\n## Scope\nScaffold\n', 'utf-8');
    fs.writeFileSync(path.join(consumerDir, 'CONTRACT.json'), JSON.stringify({
      exports: { functions: [], types: [] },
      imports: {
        partitionGroups: {
          fromSet: 'dag-grouping',
          type: 'function',
          signature: 'partitionGroups(dag: object): object',
          description: 'Partition sets into groups',
        },
      },
    }), 'utf-8');

    // Create worktree dir for the consumer
    const wtPath = path.join(tmpDir, '.rapid-worktrees', 'scaffold-set');
    fs.mkdirSync(wtPath, { recursive: true });

    // Create registry
    const registry = {
      version: 1,
      worktrees: {
        'scaffold-set': {
          setName: 'scaffold-set',
          branch: 'rapid/scaffold-set',
          path: '.rapid-worktrees/scaffold-set',
          phase: 'Created',
          status: 'active',
        },
      },
    };
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'worktrees', 'REGISTRY.json'),
      JSON.stringify(registry, null, 2),
      'utf-8'
    );

    const result = stubModule.generateStubFiles(tmpDir, 'scaffold-set');

    assert.ok(Array.isArray(result), 'should return an array');
    assert.equal(result.length, 1, 'should create 1 stub entry');
    assert.ok(result[0].stub.endsWith('dag-grouping-stub.cjs'), 'stub should be for dag-grouping');

    // Verify sidecar exists
    assert.ok(fs.existsSync(result[0].sidecar), 'sidecar should exist');
  });
});

// ────────────────────────────────────────────────────────────────
// cleanupStubFiles
// ────────────────────────────────────────────────────────────────
describe('cleanupStubFiles', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-stub-cleanup-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes .rapid-stubs/ directory and counts only .cjs files', () => {
    // Create .rapid-stubs/ with stub files and sidecars
    const stubsDir = path.join(tmpDir, '.rapid-stubs');
    fs.mkdirSync(stubsDir, { recursive: true });
    fs.writeFileSync(path.join(stubsDir, 'auth-core-stub.cjs'), '// RAPID-STUB\n', 'utf-8');
    fs.writeFileSync(path.join(stubsDir, 'auth-core-stub.cjs.rapid-stub'), '', 'utf-8');
    fs.writeFileSync(path.join(stubsDir, 'db-core-stub.cjs'), '// RAPID-STUB\n', 'utf-8');
    fs.writeFileSync(path.join(stubsDir, 'db-core-stub.cjs.rapid-stub'), '', 'utf-8');

    const result = stubModule.cleanupStubFiles(tmpDir);

    assert.deepStrictEqual(result, { cleaned: true, count: 2 }, 'count should reflect .cjs files only, not sidecars');
    assert.ok(!fs.existsSync(stubsDir), '.rapid-stubs/ should be removed');
  });

  it('returns not_found when .rapid-stubs/ does not exist', () => {
    const result = stubModule.cleanupStubFiles(tmpDir);
    assert.deepStrictEqual(result, { cleaned: false, reason: 'not_found' });
  });

  it('returns count 0 when .rapid-stubs/ is empty', () => {
    const stubsDir = path.join(tmpDir, '.rapid-stubs');
    fs.mkdirSync(stubsDir, { recursive: true });

    const result = stubModule.cleanupStubFiles(tmpDir);
    assert.deepStrictEqual(result, { cleaned: true, count: 0 });
    assert.ok(!fs.existsSync(stubsDir), '.rapid-stubs/ should be removed');
  });
});

// ────────────────────────────────────────────────────────────────
// cleanupStubSidecars
// ────────────────────────────────────────────────────────────────
describe('cleanupStubSidecars', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-stub-sidecar-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes sidecar and corresponding source file', () => {
    // Create a source file and its sidecar
    fs.writeFileSync(path.join(tmpDir, 'foo.cjs'), '// RAPID-STUB\nmodule.exports = {};\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'foo.cjs.rapid-stub'), '', 'utf-8');

    const result = stubModule.cleanupStubSidecars(tmpDir);

    assert.equal(result.cleaned, 1, 'should report 1 cleaned');
    assert.deepStrictEqual(result.files, [path.join(tmpDir, 'foo.cjs')], 'should list source file');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'foo.cjs')), 'source file should be removed');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'foo.cjs.rapid-stub')), 'sidecar should be removed');
  });

  it('recursively walks subdirectories', () => {
    // Create nested directory structure with sidecars
    const subDir = path.join(tmpDir, 'src', 'lib');
    fs.mkdirSync(subDir, { recursive: true });

    fs.writeFileSync(path.join(tmpDir, 'top.cjs'), '// RAPID-STUB\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'top.cjs.rapid-stub'), '', 'utf-8');
    fs.writeFileSync(path.join(subDir, 'deep.cjs'), '// RAPID-STUB\n', 'utf-8');
    fs.writeFileSync(path.join(subDir, 'deep.cjs.rapid-stub'), '', 'utf-8');

    const result = stubModule.cleanupStubSidecars(tmpDir);

    assert.equal(result.cleaned, 2, 'should report 2 cleaned');
    assert.ok(result.files.includes(path.join(tmpDir, 'top.cjs')), 'should list top.cjs');
    assert.ok(result.files.includes(path.join(subDir, 'deep.cjs')), 'should list deep.cjs');
  });

  it('returns empty result for non-existent directory', () => {
    const result = stubModule.cleanupStubSidecars(path.join(tmpDir, 'nonexistent'));
    assert.deepStrictEqual(result, { cleaned: 0, files: [] });
  });
});
