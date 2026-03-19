'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  extractExports,
  extractFunctionNames,
  compressResult,
  parseSetMergerReturn,
  prepareMergerContext,
  getMergeOrder,
  detectCascadeImpact,
  readMergeState,
  writeMergeState,
} = require('./merge.cjs');

// ---------------------------------------------------------------------------
// extractExports
// ---------------------------------------------------------------------------
describe('extractExports', () => {
  it('extracts names from module.exports = { ... } block', () => {
    const content = `
module.exports = {
  enrichedPrepareSetContext,
  detectConflicts,
  mergeSet,
};
`;
    const exports = extractExports(content);
    assert.ok(exports.includes('enrichedPrepareSetContext'));
    assert.ok(exports.includes('detectConflicts'));
    assert.ok(exports.includes('mergeSet'));
  });

  it('handles "name: value" exports', () => {
    const content = `module.exports = { foo: bar, baz };`;
    const exports = extractExports(content);
    assert.ok(exports.includes('foo'));
    assert.ok(exports.includes('baz'));
  });

  it('extracts ESM export function declarations', () => {
    const content = `
export function hello() {}
export async function fetchData() {}
`;
    const exports = extractExports(content);
    assert.ok(exports.includes('hello'));
    assert.ok(exports.includes('fetchData'));
  });

  it('extracts ESM export const/let/var', () => {
    const content = `
export const MY_CONST = 42;
export let myLet = 'hi';
export var myVar = true;
`;
    const exports = extractExports(content);
    assert.ok(exports.includes('MY_CONST'));
    assert.ok(exports.includes('myLet'));
    assert.ok(exports.includes('myVar'));
  });

  it('extracts ESM named exports with aliases', () => {
    const content = `export { foo, bar as baz };`;
    const exports = extractExports(content);
    assert.ok(exports.includes('foo'));
    assert.ok(exports.includes('bar')); // original name, not alias
  });

  it('deduplicates export names', () => {
    const content = `
export function hello() {}
export { hello };
`;
    const exports = extractExports(content);
    const helloCount = exports.filter(e => e === 'hello').length;
    assert.equal(helloCount, 1);
  });

  it('returns empty array for no exports', () => {
    const content = `const x = 42; function internal() {}`;
    const exports = extractExports(content);
    assert.deepStrictEqual(exports, []);
  });
});

// ---------------------------------------------------------------------------
// extractFunctionNames
// ---------------------------------------------------------------------------
describe('extractFunctionNames', () => {
  it('extracts function declarations from diff lines', () => {
    const diff = `
+function myFunc() {
-function oldFunc() {
+async function asyncFunc() {
`;
    const names = extractFunctionNames(diff);
    assert.ok(names.includes('myFunc'));
    assert.ok(names.includes('oldFunc'));
    assert.ok(names.includes('asyncFunc'));
  });

  it('extracts arrow function exports from diff', () => {
    const diff = `+const handler = async (req) => {
+let processor = function() {
-var old = () => {}
`;
    const names = extractFunctionNames(diff);
    assert.ok(names.includes('handler'));
    assert.ok(names.includes('processor'));
    assert.ok(names.includes('old'));
  });

  it('deduplicates function names', () => {
    const diff = `+function dup() {}\n-function dup() {}`;
    const names = extractFunctionNames(diff);
    const dupCount = names.filter(n => n === 'dup').length;
    assert.equal(dupCount, 1);
  });

  it('returns empty for context lines (no +/- prefix)', () => {
    const diff = ` function contextOnly() {}`;
    const names = extractFunctionNames(diff);
    assert.deepStrictEqual(names, []);
  });
});

// ---------------------------------------------------------------------------
// compressResult
// ---------------------------------------------------------------------------
describe('compressResult', () => {
  it('handles completely empty detection and resolution', () => {
    const mergeState = {
      setId: 'empty-set',
      status: 'complete',
      detection: {},
      resolution: {},
      mergeCommit: null,
    };
    const result = compressResult(mergeState);
    assert.equal(result.setId, 'empty-set');
    assert.equal(result.status, 'complete');
    assert.deepStrictEqual(result.conflictCounts, { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 });
    assert.deepStrictEqual(result.resolutionCounts, { T1: 0, T2: 0, T3: 0, escalated: 0 });
    assert.equal(result.commitSha, null);
  });

  it('handles missing detection and resolution fields', () => {
    const mergeState = {
      setId: 'minimal',
      status: 'pending',
    };
    const result = compressResult(mergeState);
    assert.deepStrictEqual(result.conflictCounts, { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 });
    assert.deepStrictEqual(result.resolutionCounts, { T1: 0, T2: 0, T3: 0, escalated: 0 });
  });

  it('correctly counts conflicts from populated detection', () => {
    const mergeState = {
      setId: 'conflict-set',
      status: 'detecting',
      detection: {
        textual: { ran: true, conflicts: [{ file: 'a.cjs', type: 'content' }] },
        structural: { ran: true, conflicts: [] },
        api: { ran: true, conflicts: [{ file: 'b.cjs', exports: ['fn1'] }, { file: 'c.cjs', exports: ['fn2'] }] },
      },
      resolution: {
        tier1Count: 1,
        tier2Count: 2,
        tier3Count: 0,
        escalatedConflicts: [{ id: 'esc-1' }],
      },
      mergeCommit: 'abc123',
    };
    const result = compressResult(mergeState);
    assert.equal(result.conflictCounts.L1, 1);
    assert.equal(result.conflictCounts.L2, 0);
    assert.equal(result.conflictCounts.L4, 2);
    assert.equal(result.resolutionCounts.T1, 1);
    assert.equal(result.resolutionCounts.T2, 2);
    assert.equal(result.resolutionCounts.escalated, 1);
    assert.equal(result.commitSha, 'abc123');
  });
});

// ---------------------------------------------------------------------------
// parseSetMergerReturn
// ---------------------------------------------------------------------------
describe('parseSetMergerReturn', () => {
  it('parses COMPLETE return with data', () => {
    const output = `Some agent output\n<!-- RAPID:RETURN {"status":"COMPLETE","data":{"merged":true}} -->`;
    const result = parseSetMergerReturn(output);
    assert.equal(result.status, 'COMPLETE');
    assert.ok(result.data);
    assert.equal(result.data.data.merged, true);
  });

  it('returns BLOCKED for missing marker', () => {
    const output = 'No marker here, just text';
    const result = parseSetMergerReturn(output);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason);
  });

  it('returns BLOCKED for missing status field', () => {
    const output = '<!-- RAPID:RETURN {"data":"no status"} -->';
    const result = parseSetMergerReturn(output);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason.includes('Missing status'));
  });

  it('handles CHECKPOINT status', () => {
    const output = '<!-- RAPID:RETURN {"status":"CHECKPOINT","progress":50} -->';
    const result = parseSetMergerReturn(output);
    assert.equal(result.status, 'CHECKPOINT');
    assert.ok(result.data);
  });

  it('handles BLOCKED status from agent', () => {
    const output = '<!-- RAPID:RETURN {"status":"BLOCKED","reason":"cannot proceed"} -->';
    const result = parseSetMergerReturn(output);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.reason, 'cannot proceed');
  });

  it('rejects non-array semantic_conflicts field', () => {
    const output = '<!-- RAPID:RETURN {"status":"COMPLETE","semantic_conflicts":"not-an-array"} -->';
    const result = parseSetMergerReturn(output);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.reason.includes('semantic_conflicts'));
  });

  it('handles whitespace-padded RAPID:RETURN', () => {
    const output = '  \n  <!-- RAPID:RETURN   {"status":"COMPLETE","ok":true}   -->  \n  ';
    const result = parseSetMergerReturn(output);
    assert.equal(result.status, 'COMPLETE');
    assert.equal(result.data.ok, true);
  });
});

// ---------------------------------------------------------------------------
// prepareMergerContext
// ---------------------------------------------------------------------------
describe('prepareMergerContext', () => {
  it('assembles launch briefing with files and conflicts', () => {
    const ctx = {
      setId: 'auth-core',
      worktreePath: '/tmp/wt/auth-core',
      files: [{ path: 'src/auth.cjs', summary: 'Auth module' }],
      conflicts: [{ file: 'src/auth.cjs', type: 'content', detail: 'line 42' }],
      contractPath: '/tmp/contract.json',
    };
    const result = prepareMergerContext(ctx);
    assert.ok(result.includes('## Set: auth-core'));
    assert.ok(result.includes('Worktree: /tmp/wt/auth-core'));
    assert.ok(result.includes('src/auth.cjs: Auth module'));
    assert.ok(result.includes('[content] src/auth.cjs: line 42'));
    assert.ok(result.includes('Contract: /tmp/contract.json'));
  });

  it('handles empty files and conflicts', () => {
    const ctx = {
      setId: 'empty',
      worktreePath: '/tmp/wt/empty',
      files: [],
      conflicts: [],
    };
    const result = prepareMergerContext(ctx);
    assert.ok(result.includes('### Files (0 total)'));
    assert.ok(result.includes('### Conflicts (0 total)'));
    assert.ok(result.includes('Contract: none'));
  });

  it('truncates file list at 15 entries', () => {
    const files = Array.from({ length: 20 }, (_, i) => ({ path: `file${i}.cjs` }));
    const ctx = {
      setId: 'big',
      worktreePath: '/tmp/wt/big',
      files,
      conflicts: [],
    };
    const result = prepareMergerContext(ctx);
    assert.ok(result.includes('### Files (20 total)'));
    assert.ok(result.includes('... and 5 more files'));
    // Should include file0 but not file19
    assert.ok(result.includes('file0.cjs'));
    assert.ok(!result.includes('file19.cjs'));
  });

  it('shows (no summary) for files without summary', () => {
    const ctx = {
      setId: 'nosummary',
      worktreePath: '/tmp/wt/nosummary',
      files: [{ path: 'bare.cjs' }],
      conflicts: [],
    };
    const result = prepareMergerContext(ctx);
    assert.ok(result.includes('bare.cjs: (no summary)'));
  });

  it('shows (details in worktree) for conflicts without detail', () => {
    const ctx = {
      setId: 'nodetail',
      worktreePath: '/tmp/wt/nodetail',
      files: [],
      conflicts: [{ file: 'x.cjs', type: 'modify' }],
    };
    const result = prepareMergerContext(ctx);
    assert.ok(result.includes('(details in worktree)'));
  });
});

// ---------------------------------------------------------------------------
// getMergeOrder
// ---------------------------------------------------------------------------
describe('getMergeOrder', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns wave-grouped arrays from valid DAG', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    const dagObj = {
      nodes: [{ id: 'auth' }, { id: 'data' }, { id: 'api' }],
      edges: [{ from: 'auth', to: 'api' }, { from: 'data', to: 'api' }],
      waves: {
        '1': { sets: ['auth', 'data'] },
        '2': { sets: ['api'] },
      },
      metadata: { generatedAt: new Date().toISOString() },
    };
    fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify(dagObj), 'utf-8');

    const result = getMergeOrder(tmpDir);
    assert.deepStrictEqual(result, [['auth', 'data'], ['api']]);
  });

  it('throws when DAG.json is missing', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    assert.throws(() => getMergeOrder(tmpDir), (err) => {
      assert.ok(err.message.includes('DAG.json not found'));
      return true;
    });
  });
});

// ---------------------------------------------------------------------------
// detectCascadeImpact
// ---------------------------------------------------------------------------
describe('detectCascadeImpact', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-cascade-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns hasCascade:false when no DAG exists', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    const result = detectCascadeImpact(tmpDir, 'some-set');
    assert.equal(result.hasCascade, false);
    assert.deepStrictEqual(result.affectedSets, []);
    assert.ok(result.recommendation.includes('No DAG.json found'));
  });

  it('uses canonical path, not old .planning/DAG.json (regression)', () => {
    // Create DAG at the WRONG path (.planning/DAG.json)
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    const wrongDag = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b' }],
      waves: { '1': { sets: ['a'] }, '2': { sets: ['b'] } },
    };
    fs.writeFileSync(path.join(planningDir, 'DAG.json'), JSON.stringify(wrongDag), 'utf-8');

    // Create sets dir but NO DAG.json at the correct canonical path
    const setsDir = path.join(planningDir, 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    // Should NOT find the DAG (it is at the wrong path)
    const result = detectCascadeImpact(tmpDir, 'a');
    assert.equal(result.hasCascade, false);
    assert.ok(result.recommendation.includes('No DAG.json found'));
  });

  it('finds dependent sets that are already merged', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    // Create DAG where 'auth' -> 'api' (api depends on auth)
    const dagObj = {
      nodes: [{ id: 'auth' }, { id: 'api' }, { id: 'ui' }],
      edges: [{ from: 'auth', to: 'api' }, { from: 'auth', to: 'ui' }],
      waves: { '1': { sets: ['auth'] }, '2': { sets: ['api', 'ui'] } },
      metadata: { generatedAt: new Date().toISOString() },
    };
    fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify(dagObj), 'utf-8');

    // Create MERGE-STATE.json for 'api' showing it is already merged (complete)
    writeMergeState(tmpDir, 'api', {
      setId: 'api',
      status: 'complete',
      lastUpdatedAt: new Date().toISOString(),
    });

    // 'ui' has no MERGE-STATE (not merged yet)

    const result = detectCascadeImpact(tmpDir, 'auth');
    assert.equal(result.hasCascade, true);
    assert.deepStrictEqual(result.affectedSets, ['api']);
    assert.ok(result.recommendation.includes('api'));
  });

  it('returns safe-to-rollback when dependents exist but none merged', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    // DAG: auth -> api, auth -> ui
    const dagObj = {
      nodes: [{ id: 'auth' }, { id: 'api' }, { id: 'ui' }],
      edges: [{ from: 'auth', to: 'api' }, { from: 'auth', to: 'ui' }],
      waves: { '1': { sets: ['auth'] }, '2': { sets: ['api', 'ui'] } },
      metadata: { generatedAt: new Date().toISOString() },
    };
    fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify(dagObj), 'utf-8');

    // Create MERGE-STATE for 'api' with status 'pending' (not yet merged)
    writeMergeState(tmpDir, 'api', {
      setId: 'api',
      status: 'pending',
      lastUpdatedAt: new Date().toISOString(),
    });

    // 'ui' has no MERGE-STATE at all

    const result = detectCascadeImpact(tmpDir, 'auth');
    assert.equal(result.hasCascade, false);
    assert.deepStrictEqual(result.affectedSets, []);
    assert.ok(result.recommendation.includes('safe to rollback'));
  });

  it('returns no-cascade when set has no dependents in DAG', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    // DAG: auth -> api (api is a leaf -- nothing depends on it)
    const dagObj = {
      nodes: [{ id: 'auth' }, { id: 'api' }],
      edges: [{ from: 'auth', to: 'api' }],
      waves: { '1': { sets: ['auth'] }, '2': { sets: ['api'] } },
      metadata: { generatedAt: new Date().toISOString() },
    };
    fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify(dagObj), 'utf-8');

    // Rolling back 'api' -- nothing depends on 'api'
    const result = detectCascadeImpact(tmpDir, 'api');
    assert.equal(result.hasCascade, false);
    assert.deepStrictEqual(result.affectedSets, []);
    assert.ok(result.recommendation.includes('No dependent sets'));
  });
});

// ---------------------------------------------------------------------------
// getMergeOrder - tryLoadDAG canonical path tests (supplement)
// ---------------------------------------------------------------------------
describe('getMergeOrder - canonical DAG path', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-order-path-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads DAG from .planning/sets/DAG.json (canonical path)', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    const dagObj = {
      nodes: [{ id: 'set-a' }, { id: 'set-b' }],
      edges: [{ from: 'set-a', to: 'set-b' }],
      waves: { '1': { sets: ['set-a'] }, '2': { sets: ['set-b'] } },
      metadata: { generatedAt: new Date().toISOString() },
    };
    fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify(dagObj), 'utf-8');

    const result = getMergeOrder(tmpDir);
    assert.deepStrictEqual(result, [['set-a'], ['set-b']]);
  });

  it('ignores DAG.json at wrong path .planning/DAG.json (regression)', () => {
    // Place DAG at the OLD wrong path
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    const dagObj = {
      nodes: [{ id: 'x' }],
      edges: [],
      waves: { '1': { sets: ['x'] } },
      metadata: { generatedAt: new Date().toISOString() },
    };
    fs.writeFileSync(path.join(planningDir, 'DAG.json'), JSON.stringify(dagObj), 'utf-8');

    // Create sets dir but NO DAG.json at canonical path
    const setsDir = path.join(planningDir, 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    // Should throw because tryLoadDAG only looks at .planning/sets/DAG.json
    assert.throws(() => getMergeOrder(tmpDir), (err) => {
      assert.ok(err.message.includes('DAG.json not found'));
      return true;
    });
  });
});

// ---------------------------------------------------------------------------
// detectCascadeImpact - tryLoadDAG canonical path tests (supplement)
// ---------------------------------------------------------------------------
describe('detectCascadeImpact - canonical DAG path', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cascade-path-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads DAG from .planning/sets/DAG.json (canonical path)', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });

    const dagObj = {
      nodes: [{ id: 'base' }, { id: 'dep' }],
      edges: [{ from: 'base', to: 'dep' }],
      waves: { '1': { sets: ['base'] }, '2': { sets: ['dep'] } },
      metadata: { generatedAt: new Date().toISOString() },
    };
    fs.writeFileSync(path.join(setsDir, 'DAG.json'), JSON.stringify(dagObj), 'utf-8');

    // dep is not merged, so no cascade
    const result = detectCascadeImpact(tmpDir, 'base');
    assert.equal(result.hasCascade, false);
    // But it should find the dependent set
    assert.ok(result.recommendation.includes('safe to rollback'));
  });

  it('returns no-cascade when DAG.json is missing', () => {
    const setsDir = path.join(tmpDir, '.planning', 'sets');
    fs.mkdirSync(setsDir, { recursive: true });
    // No DAG.json at all
    const result = detectCascadeImpact(tmpDir, 'any-set');
    assert.equal(result.hasCascade, false);
    assert.ok(result.recommendation.includes('No DAG.json found'));
  });
});
