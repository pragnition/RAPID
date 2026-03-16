'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('./args.cjs');

describe('args.cjs -- parseArgs', () => {
  // ── Basic string flag ──
  it('parses a basic string flag', () => {
    const result = parseArgs(['--branch', 'main'], { branch: 'string' });
    assert.deepStrictEqual(result, {
      flags: { branch: 'main' },
      positional: [],
    });
  });

  // ── Boolean flag present ──
  it('parses a boolean flag when present', () => {
    const result = parseArgs(['--force'], { force: 'boolean' });
    assert.deepStrictEqual(result, {
      flags: { force: true },
      positional: [],
    });
  });

  // ── Boolean flag absent defaults to false ──
  it('defaults missing boolean flag to false', () => {
    const result = parseArgs([], { force: 'boolean' });
    assert.deepStrictEqual(result, {
      flags: { force: false },
      positional: [],
    });
  });

  // ── --flag=value syntax ──
  it('parses --flag=value syntax for string flags', () => {
    const result = parseArgs(['--branch=develop'], { branch: 'string' });
    assert.deepStrictEqual(result, {
      flags: { branch: 'develop' },
      positional: [],
    });
  });

  // ── Multi-value flag ──
  it('parses multi:2 flag consuming two values', () => {
    const result = parseArgs(
      ['--agent-phase2', 'conflict-1', 'done'],
      { 'agent-phase2': 'multi:2' }
    );
    assert.deepStrictEqual(result, {
      flags: { 'agent-phase2': ['conflict-1', 'done'] },
      positional: [],
    });
  });

  // ── Missing string value (last token) ──
  it('returns undefined when string flag has no following value', () => {
    const result = parseArgs(['--branch'], { branch: 'string' });
    assert.deepStrictEqual(result, {
      flags: { branch: undefined },
      positional: [],
    });
  });

  // ── Mixed positional and flags ──
  it('separates positional args from flags', () => {
    const result = parseArgs(
      ['setName', '--branch', 'main', 'extra'],
      { branch: 'string' }
    );
    assert.deepStrictEqual(result, {
      flags: { branch: 'main' },
      positional: ['setName', 'extra'],
    });
  });

  // ── Unknown flags treated as positional ──
  it('treats unknown --flags as positional args', () => {
    const result = parseArgs(['--unknown', 'val'], { branch: 'string' });
    assert.deepStrictEqual(result, {
      flags: { branch: undefined },
      positional: ['--unknown', 'val'],
    });
  });

  // ── Empty args ──
  it('handles empty args array', () => {
    const result = parseArgs([], { branch: 'string' });
    assert.deepStrictEqual(result, {
      flags: { branch: undefined },
      positional: [],
    });
  });

  // ── Multiple flags together ──
  it('parses multiple flags of different types', () => {
    const result = parseArgs(
      ['--branch', 'main', '--force', '--mode', 'solo'],
      { branch: 'string', force: 'boolean', mode: 'string' }
    );
    assert.deepStrictEqual(result, {
      flags: { branch: 'main', force: true, mode: 'solo' },
      positional: [],
    });
  });

  // ── Boolean --flag=value syntax ──
  it('parses --flag=true and --flag=false for boolean flags', () => {
    const trueResult = parseArgs(['--force=true'], { force: 'boolean' });
    assert.strictEqual(trueResult.flags.force, true);

    const falseResult = parseArgs(['--force=false'], { force: 'boolean' });
    assert.strictEqual(falseResult.flags.force, false);
  });

  // ── Monolith pattern: --test in verify-artifacts (string, may be missing) ──
  it('matches monolith --test pattern: string flag with value', () => {
    const result = parseArgs(
      ['file1.cjs', '--test', 'npm test', 'file2.cjs'],
      { test: 'string' }
    );
    assert.strictEqual(result.flags.test, 'npm test');
    assert.deepStrictEqual(result.positional, ['file1.cjs', 'file2.cjs']);
  });

  // ── Monolith pattern: --branch with default handled by caller ──
  it('matches monolith --branch pattern: caller provides default', () => {
    const result = parseArgs(['setName'], { branch: 'string' });
    const branch = result.flags.branch || 'main'; // caller default
    assert.strictEqual(branch, 'main');
    assert.deepStrictEqual(result.positional, ['setName']);
  });

  // ── Monolith pattern: --mode used as presence check (>= 0) ──
  it('matches monolith --mode presence check pattern', () => {
    const result = parseArgs(['--mode', 'solo'], { mode: 'string' });
    const hasMode = result.flags.mode !== undefined;
    assert.strictEqual(hasMode, true);
    assert.strictEqual(result.flags.mode, 'solo');
  });

  // ── Monolith pattern: --agent-phase2 consuming 2 values ──
  it('matches monolith --agent-phase2 multi:2 pattern', () => {
    const result = parseArgs(
      ['setName', 'merged', '--agent-phase2', 'conflict-abc', 'resolution-phase'],
      { 'agent-phase2': 'multi:2' }
    );
    assert.deepStrictEqual(result.flags['agent-phase2'], ['conflict-abc', 'resolution-phase']);
    assert.deepStrictEqual(result.positional, ['setName', 'merged']);
  });

  // ── Monolith pattern: --status string flag ──
  it('matches monolith --status pattern', () => {
    const result = parseArgs(['--status', 'merged'], { status: 'string' });
    assert.strictEqual(result.flags.status, 'merged');
  });

  // ── Monolith pattern: --set string flag at end of args ──
  it('matches monolith --set pattern in display command', () => {
    const result = parseArgs(
      ['progress', '--set', 'auth-module'],
      { set: 'string' }
    );
    assert.strictEqual(result.flags.set, 'auth-module');
    assert.deepStrictEqual(result.positional, ['progress']);
  });

  // ── Multi flag with insufficient remaining tokens ──
  it('handles multi:3 flag with fewer remaining tokens', () => {
    const result = parseArgs(
      ['--multi', 'only-one'],
      { multi: 'multi:3' }
    );
    assert.deepStrictEqual(result.flags.multi, ['only-one']);
  });

  // ── Empty schema: everything is positional ──
  it('treats all tokens as positional when schema is empty', () => {
    const result = parseArgs(['--foo', 'bar', 'baz'], {});
    assert.deepStrictEqual(result.positional, ['--foo', 'bar', 'baz']);
    assert.deepStrictEqual(result.flags, {});
  });
});
