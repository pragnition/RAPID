'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const stubModule = require('./stub.cjs');

// ────────────────────────────────────────────────────────────────
// generateStub
// ────────────────────────────────────────────────────────────────
describe('generateStub', () => {
  it('produces valid CommonJS module from contract with 2 functions', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'createUser', file: 'src/auth/user.cjs', params: [{ name: 'email', type: 'string' }, { name: 'password', type: 'string' }], returns: 'object' },
          { name: 'deleteUser', file: 'src/auth/user.cjs', params: [{ name: 'userId', type: 'string' }], returns: 'boolean' },
        ],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'auth-core');

    // Should be a string
    assert.ok(typeof result === 'string', 'result should be a string');

    // Should contain the auto-generated header
    assert.ok(result.includes('AUTO-GENERATED stub for set: auth-core'), 'should have auto-generated header');
    assert.ok(result.includes('DO NOT EDIT'), 'should have DO NOT EDIT warning');

    // Should contain 'use strict'
    assert.ok(result.includes("'use strict'"), 'should have use strict');

    // Should contain function definitions
    assert.ok(result.includes('function createUser(email, password)'), 'should have createUser function');
    assert.ok(result.includes('function deleteUser(userId)'), 'should have deleteUser function');

    // Should contain throw statements with correct set name
    assert.ok(result.includes("Stub: createUser not yet implemented by set auth-core"), 'createUser should throw with correct message');
    assert.ok(result.includes("Stub: deleteUser not yet implemented by set auth-core"), 'deleteUser should throw with correct message');

    // Should contain module.exports
    assert.ok(result.includes('module.exports'), 'should export functions');
    assert.ok(result.includes('createUser'), 'should export createUser');
    assert.ok(result.includes('deleteUser'), 'should export deleteUser');

    // Should be require()-able
    const tmpFile = path.join(os.tmpdir(), `stub-test-${Date.now()}.cjs`);
    fs.writeFileSync(tmpFile, result, 'utf-8');
    try {
      const mod = require(tmpFile);
      assert.ok(typeof mod.createUser === 'function', 'createUser should be a function');
      assert.ok(typeof mod.deleteUser === 'function', 'deleteUser should be a function');

      // Should throw when called
      assert.throws(() => mod.createUser('a@b.com', 'pass'), {
        message: /Stub: createUser not yet implemented by set auth-core/,
      });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('produces module with JSDoc param and returns annotations', () => {
    const contract = {
      exports: {
        functions: [
          { name: 'getItem', file: 'src/store.cjs', params: [{ name: 'id', type: 'number' }], returns: 'object' },
        ],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'store-core');

    // Should have JSDoc
    assert.ok(result.includes('@param {number} id'), 'should have @param for id');
    assert.ok(result.includes('@returns {object}'), 'should have @returns');
  });

  it('produces empty module when exports.functions is empty', () => {
    const contract = {
      exports: {
        functions: [],
        types: [],
      },
    };

    const result = stubModule.generateStub(contract, 'empty-set');

    assert.ok(result.includes('AUTO-GENERATED stub for set: empty-set'), 'should have header');
    assert.ok(result.includes('module.exports'), 'should have module.exports');
    // Should be valid (can be require()'d)
    const tmpFile = path.join(os.tmpdir(), `stub-empty-${Date.now()}.cjs`);
    fs.writeFileSync(tmpFile, result, 'utf-8');
    try {
      const mod = require(tmpFile);
      assert.ok(typeof mod === 'object', 'should export an object');
      assert.equal(Object.keys(mod).length, 0, 'should have no exports');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('produces @typedef JSDoc blocks from exports.types', () => {
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
    assert.ok(result.includes('AUTO-GENERATED stub for set: bare-set'), 'should have header');
    assert.ok(result.includes('module.exports'), 'should have module.exports');
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

  it('creates .rapid-stubs/ with correct files when set has imports', () => {
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

    assert.ok(Array.isArray(result), 'should return an array');
    assert.equal(result.length, 1, 'should create 1 stub file');

    // Check the stub file exists
    const stubPath = path.join(wtPath, '.rapid-stubs', 'auth-core-stub.cjs');
    assert.ok(fs.existsSync(stubPath), 'stub file should exist at .rapid-stubs/auth-core-stub.cjs');

    // Check stub content is valid
    const content = fs.readFileSync(stubPath, 'utf-8');
    assert.ok(content.includes('verifyToken'), 'stub should contain verifyToken function');
    assert.ok(content.includes('auth-core'), 'stub should reference auth-core set name');
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

  it('removes .rapid-stubs/ directory and returns count', () => {
    // Create .rapid-stubs/ with some files
    const stubsDir = path.join(tmpDir, '.rapid-stubs');
    fs.mkdirSync(stubsDir, { recursive: true });
    fs.writeFileSync(path.join(stubsDir, 'auth-core-stub.cjs'), '// stub', 'utf-8');
    fs.writeFileSync(path.join(stubsDir, 'db-core-stub.cjs'), '// stub', 'utf-8');

    const result = stubModule.cleanupStubFiles(tmpDir);

    assert.deepStrictEqual(result, { cleaned: true, count: 2 });
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
