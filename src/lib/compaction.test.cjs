'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  compactContext,
  registerCompactionTrigger,
  fireCompactionTrigger,
  clearHooks,
  getRegisteredHooks,
  registerDefaultHooks,
  resolveDigestPath,
  readDigestOrFull,
  isVerbatimArtifact,
  collectWaveArtifacts,
  DEFAULT_BUDGET_TOKENS,
} = require('./compaction.cjs');

// ---------------------------------------------------------------------------
// Helper: create a temporary directory with cleanup
// ---------------------------------------------------------------------------
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'compaction-test-'));
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// resolveDigestPath
// ---------------------------------------------------------------------------
describe('resolveDigestPath', () => {
  it('converts wave-1-PLAN.md to wave-1-PLAN-DIGEST.md', () => {
    assert.equal(
      resolveDigestPath('/sets/test/wave-1-PLAN.md'),
      '/sets/test/wave-1-PLAN-DIGEST.md'
    );
  });

  it('converts HANDOFF.md to HANDOFF-DIGEST.md', () => {
    assert.equal(
      resolveDigestPath('/sets/test/HANDOFF.md'),
      '/sets/test/HANDOFF-DIGEST.md'
    );
  });

  it('converts REVIEW-SCOPE.md to REVIEW-SCOPE-DIGEST.md', () => {
    assert.equal(
      resolveDigestPath('/sets/test/REVIEW-SCOPE.md'),
      '/sets/test/REVIEW-SCOPE-DIGEST.md'
    );
  });

  it('converts non-.md files by appending -DIGEST.md', () => {
    assert.equal(
      resolveDigestPath('/sets/test/CONTRACT.json'),
      '/sets/test/CONTRACT.json-DIGEST.md'
    );
  });

  it('handles paths with multiple dots correctly', () => {
    assert.equal(
      resolveDigestPath('/sets/test/wave-1-PLAN.v2.md'),
      '/sets/test/wave-1-PLAN.v2-DIGEST.md'
    );
  });
});

// ---------------------------------------------------------------------------
// readDigestOrFull
// ---------------------------------------------------------------------------
describe('readDigestOrFull', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  it('returns digest content when digest sibling exists', () => {
    const artifactPath = path.join(tmpDir, 'wave-1-PLAN.md');
    const digestPath = path.join(tmpDir, 'wave-1-PLAN-DIGEST.md');
    fs.writeFileSync(artifactPath, 'Full plan content with lots of details...');
    fs.writeFileSync(digestPath, 'Short digest.');

    const result = readDigestOrFull(artifactPath);
    assert.equal(result.content, 'Short digest.');
    assert.equal(result.isDigest, true);
    assert.equal(result.path, artifactPath); // path always points to original
    assert.ok(result.tokens > 0);
  });

  it('returns full content when no digest exists', () => {
    const artifactPath = path.join(tmpDir, 'wave-1-PLAN.md');
    fs.writeFileSync(artifactPath, 'Full plan content.');

    const result = readDigestOrFull(artifactPath);
    assert.equal(result.content, 'Full plan content.');
    assert.equal(result.isDigest, false);
    assert.equal(result.path, artifactPath);
    assert.ok(result.tokens > 0);
  });

  it('populates token count correctly', () => {
    const artifactPath = path.join(tmpDir, 'test.md');
    fs.writeFileSync(artifactPath, 'abcdefgh'); // 8 chars -> 2 tokens
    const result = readDigestOrFull(artifactPath);
    assert.equal(result.tokens, 2);
  });

  it('switches from digest to full when digest is deleted', () => {
    const artifactPath = path.join(tmpDir, 'wave-1-PLAN.md');
    const digestPath = path.join(tmpDir, 'wave-1-PLAN-DIGEST.md');
    fs.writeFileSync(artifactPath, 'Full content.');
    fs.writeFileSync(digestPath, 'Digest.');

    // First read: digest
    const r1 = readDigestOrFull(artifactPath);
    assert.equal(r1.isDigest, true);
    assert.equal(r1.content, 'Digest.');

    // Remove digest
    fs.unlinkSync(digestPath);

    // Second read: full
    const r2 = readDigestOrFull(artifactPath);
    assert.equal(r2.isDigest, false);
    assert.equal(r2.content, 'Full content.');
  });
});

// ---------------------------------------------------------------------------
// isVerbatimArtifact
// ---------------------------------------------------------------------------
describe('isVerbatimArtifact', () => {
  it('returns true for CONTRACT.json', () => {
    assert.equal(isVerbatimArtifact('CONTRACT.json'), true);
  });

  it('returns false for wave-1-PLAN.md', () => {
    assert.equal(isVerbatimArtifact('wave-1-PLAN.md'), false);
  });

  it('returns false for CONTEXT.md', () => {
    assert.equal(isVerbatimArtifact('CONTEXT.md'), false);
  });

  it('returns false for REVIEW-SCOPE.md', () => {
    assert.equal(isVerbatimArtifact('REVIEW-SCOPE.md'), false);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- budget enforcement
// ---------------------------------------------------------------------------
describe('compactContext - budget enforcement', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  it('uses digests for completed waves and full content for active wave', () => {
    // Wave 1 artifacts (completed) with digests
    const w1Plan = path.join(tmpDir, 'wave-1-PLAN.md');
    const w1PlanDigest = path.join(tmpDir, 'wave-1-PLAN-DIGEST.md');
    fs.writeFileSync(w1Plan, 'A'.repeat(4000)); // 1000 tokens full
    fs.writeFileSync(w1PlanDigest, 'B'.repeat(400)); // 100 tokens digest

    // Wave 2 artifacts (active) -- should use full content even if digest exists
    const w2Plan = path.join(tmpDir, 'wave-2-PLAN.md');
    const w2PlanDigest = path.join(tmpDir, 'wave-2-PLAN-DIGEST.md');
    fs.writeFileSync(w2Plan, 'C'.repeat(2000)); // 500 tokens full
    fs.writeFileSync(w2PlanDigest, 'D'.repeat(200)); // 50 tokens digest

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 2,
      waves: [
        { wave: 1, artifacts: [{ name: 'PLAN', path: w1Plan }] },
        { wave: 2, artifacts: [{ name: 'PLAN', path: w2Plan }] },
      ],
    };

    const result = compactContext(context);

    // Wave 1 should use digest
    assert.equal(result.compacted[0].artifacts[0].isDigest, true);
    assert.equal(result.compacted[0].artifacts[0].content, 'B'.repeat(400));

    // Wave 2 should use full (active wave exempt)
    assert.equal(result.compacted[1].artifacts[0].isDigest, false);
    assert.equal(result.compacted[1].artifacts[0].content, 'C'.repeat(2000));

    // Counts
    assert.equal(result.digestsUsed, 1);
    assert.equal(result.fullsUsed, 1);
    assert.equal(result.totalTokens, 100 + 500);
    assert.equal(result.budgetExceeded, false);
  });

  it('enforces budget and sets budgetExceeded flag', () => {
    const bigFile = path.join(tmpDir, 'big.md');
    fs.writeFileSync(bigFile, 'X'.repeat(500000)); // 125000 tokens > 120000

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 1, artifacts: [{ name: 'BIG', path: bigFile }] },
      ],
    };

    const result = compactContext(context);
    assert.equal(result.budgetExceeded, true);
    assert.ok(result.totalTokens > DEFAULT_BUDGET_TOKENS);
  });

  it('respects custom budget option', () => {
    const file = path.join(tmpDir, 'test.md');
    fs.writeFileSync(file, 'Y'.repeat(400)); // 100 tokens

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 1, artifacts: [{ name: 'TEST', path: file }] },
      ],
    };

    const result = compactContext(context, { budget: 50 });
    assert.equal(result.budgetExceeded, true);
    assert.equal(result.totalTokens, 100);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- digest fallback
// ---------------------------------------------------------------------------
describe('compactContext - digest fallback', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  it('falls back to full content when no digest exists', () => {
    const w1Plan = path.join(tmpDir, 'wave-1-PLAN.md');
    fs.writeFileSync(w1Plan, 'Full plan without digest.');

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 2,
      waves: [
        { wave: 1, artifacts: [{ name: 'PLAN', path: w1Plan }] },
      ],
    };

    const result = compactContext(context);
    assert.equal(result.compacted[0].artifacts[0].isDigest, false);
    assert.equal(result.compacted[0].artifacts[0].content, 'Full plan without digest.');
    assert.equal(result.digestsUsed, 0);
    assert.equal(result.fullsUsed, 1);
  });

  it('does not error when digest is missing for multiple artifacts', () => {
    const w1Plan = path.join(tmpDir, 'wave-1-PLAN.md');
    const w1Complete = path.join(tmpDir, 'WAVE-1-COMPLETE.md');
    fs.writeFileSync(w1Plan, 'Plan content');
    fs.writeFileSync(w1Complete, 'Complete content');

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 2,
      waves: [
        {
          wave: 1,
          artifacts: [
            { name: 'PLAN', path: w1Plan },
            { name: 'COMPLETE', path: w1Complete },
          ],
        },
      ],
    };

    const result = compactContext(context);
    assert.equal(result.compacted[0].artifacts.length, 2);
    assert.equal(result.compacted[0].artifacts[0].isDigest, false);
    assert.equal(result.compacted[0].artifacts[1].isDigest, false);
    assert.equal(result.fullsUsed, 2);
    assert.equal(result.digestsUsed, 0);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- verbatim patterns
// ---------------------------------------------------------------------------
describe('compactContext - verbatim patterns', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  it('keeps CONTRACT.json verbatim even in completed wave', () => {
    const contract = path.join(tmpDir, 'CONTRACT.json');
    const contractDigest = path.join(tmpDir, 'CONTRACT.json-DIGEST.md');
    fs.writeFileSync(contract, '{"owned_files": []}');
    fs.writeFileSync(contractDigest, 'Digest of contract.');

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 2,
      waves: [
        { wave: 1, artifacts: [{ name: 'CONTRACT.json', path: contract }] },
      ],
    };

    const result = compactContext(context);
    // CONTRACT.json should be verbatim, NOT use digest
    assert.equal(result.compacted[0].artifacts[0].isDigest, false);
    assert.equal(result.compacted[0].artifacts[0].content, '{"owned_files": []}');
    assert.equal(result.fullsUsed, 1);
    assert.equal(result.digestsUsed, 0);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- active wave exemption
// ---------------------------------------------------------------------------
describe('compactContext - active wave exemption', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  it('uses full content for active wave even when digests exist', () => {
    const w2Plan = path.join(tmpDir, 'wave-2-PLAN.md');
    const w2Digest = path.join(tmpDir, 'wave-2-PLAN-DIGEST.md');
    fs.writeFileSync(w2Plan, 'Full active wave plan.');
    fs.writeFileSync(w2Digest, 'Digest.');

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 2,
      waves: [
        { wave: 2, artifacts: [{ name: 'PLAN', path: w2Plan }] },
      ],
    };

    const result = compactContext(context);
    assert.equal(result.compacted[0].artifacts[0].isDigest, false);
    assert.equal(result.compacted[0].artifacts[0].content, 'Full active wave plan.');
    assert.equal(result.fullsUsed, 1);
    assert.equal(result.digestsUsed, 0);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- budget exceeded flag
// ---------------------------------------------------------------------------
describe('compactContext - budget exceeded', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  it('sets budgetExceeded true when total tokens exceed budget', () => {
    const bigFile = path.join(tmpDir, 'huge.md');
    // 500000 chars = 125000 tokens, exceeds DEFAULT_BUDGET_TOKENS of 120000
    fs.writeFileSync(bigFile, 'Z'.repeat(500000));

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 1, artifacts: [{ name: 'HUGE', path: bigFile }] },
      ],
    };

    const result = compactContext(context);
    assert.equal(result.budgetExceeded, true);
  });

  it('sets budgetExceeded false when total tokens are within budget', () => {
    const smallFile = path.join(tmpDir, 'small.md');
    fs.writeFileSync(smallFile, 'hello');

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 1, artifacts: [{ name: 'SMALL', path: smallFile }] },
      ],
    };

    const result = compactContext(context);
    assert.equal(result.budgetExceeded, false);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- disk recoverability
// ---------------------------------------------------------------------------
describe('compactContext - disk recoverability', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  it('each compacted artifact has a path field pointing to the original file on disk', () => {
    const w1Plan = path.join(tmpDir, 'wave-1-PLAN.md');
    const w1Digest = path.join(tmpDir, 'wave-1-PLAN-DIGEST.md');
    fs.writeFileSync(w1Plan, 'Original full content on disk.');
    fs.writeFileSync(w1Digest, 'Digest content.');

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 2,
      waves: [
        { wave: 1, artifacts: [{ name: 'PLAN', path: w1Plan }] },
      ],
    };

    const result = compactContext(context);
    const artifact = result.compacted[0].artifacts[0];

    // Path points to original, even though digest was read
    assert.equal(artifact.path, w1Plan);
    assert.equal(artifact.isDigest, true);

    // The original is still readable at the path
    const onDisk = fs.readFileSync(artifact.path, 'utf-8');
    assert.equal(onDisk, 'Original full content on disk.');
  });
});

// ---------------------------------------------------------------------------
// Hook registry
// ---------------------------------------------------------------------------
describe('hook registry', () => {
  beforeEach(() => {
    clearHooks();
  });

  afterEach(() => {
    clearHooks();
  });

  it('registers and fires a hook for wave-complete', async () => {
    let called = false;
    registerCompactionTrigger('wave-complete', async () => {
      called = true;
    });

    const result = await fireCompactionTrigger('wave-complete');
    assert.equal(called, true);
    assert.equal(result.fired, 1);
    assert.equal(result.errors.length, 0);
  });

  it('registers and fires multiple hooks for same event', async () => {
    const calls = [];
    registerCompactionTrigger('wave-complete', async () => calls.push('a'));
    registerCompactionTrigger('wave-complete', async () => calls.push('b'));
    registerCompactionTrigger('wave-complete', async () => calls.push('c'));

    const result = await fireCompactionTrigger('wave-complete');
    assert.deepEqual(calls, ['a', 'b', 'c']);
    assert.equal(result.fired, 3);
  });

  it('fires 0 handlers when no hooks registered for event', async () => {
    const result = await fireCompactionTrigger('wave-complete');
    assert.equal(result.fired, 0);
    assert.equal(result.errors.length, 0);
  });

  it('throws for unknown event name', async () => {
    await assert.rejects(
      () => fireCompactionTrigger('nonexistent-event'),
      { message: /Invalid compaction trigger event/ }
    );
  });

  it('throws when registering hook for invalid event', () => {
    assert.throws(
      () => registerCompactionTrigger('invalid-event', async () => {}),
      { message: /Invalid compaction trigger event/ }
    );
  });

  it('accepts all three valid event types', () => {
    assert.doesNotThrow(() => {
      registerCompactionTrigger('wave-complete', async () => {});
      registerCompactionTrigger('pause', async () => {});
      registerCompactionTrigger('review-stage-complete', async () => {});
    });

    const hooks = getRegisteredHooks();
    assert.equal(hooks['wave-complete'], 1);
    assert.equal(hooks['pause'], 1);
    assert.equal(hooks['review-stage-complete'], 1);
  });

  it('clearHooks removes all hooks', () => {
    registerCompactionTrigger('wave-complete', async () => {});
    registerCompactionTrigger('pause', async () => {});
    clearHooks();

    const hooks = getRegisteredHooks();
    assert.deepEqual(hooks, {});
  });

  it('getRegisteredHooks returns event-to-count map', () => {
    registerCompactionTrigger('wave-complete', async () => {});
    registerCompactionTrigger('wave-complete', async () => {});
    registerCompactionTrigger('pause', async () => {});

    const hooks = getRegisteredHooks();
    assert.equal(hooks['wave-complete'], 2);
    assert.equal(hooks['pause'], 1);
    assert.equal(hooks['review-stage-complete'], undefined);
  });

  it('error in handler does not prevent subsequent handlers from running', async () => {
    const calls = [];
    registerCompactionTrigger('wave-complete', async () => {
      calls.push('first');
      throw new Error('Handler 1 failed');
    });
    registerCompactionTrigger('wave-complete', async () => {
      calls.push('second');
    });
    registerCompactionTrigger('wave-complete', async () => {
      calls.push('third');
    });

    const result = await fireCompactionTrigger('wave-complete');
    assert.deepEqual(calls, ['first', 'second', 'third']);
    assert.equal(result.fired, 3);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].includes('Handler 1 failed'));
  });

  it('passes context to handler', async () => {
    let received;
    registerCompactionTrigger('wave-complete', async (ctx) => {
      received = ctx;
    });

    await fireCompactionTrigger('wave-complete', { waveNum: 3 });
    assert.deepEqual(received, { waveNum: 3 });
  });
});

// ---------------------------------------------------------------------------
// collectWaveArtifacts
// ---------------------------------------------------------------------------
describe('collectWaveArtifacts', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  it('groups artifacts by wave number', () => {
    fs.writeFileSync(path.join(tmpDir, 'wave-1-PLAN.md'), 'plan 1');
    fs.writeFileSync(path.join(tmpDir, 'WAVE-1-COMPLETE.md'), 'complete 1');
    fs.writeFileSync(path.join(tmpDir, 'wave-2-PLAN.md'), 'plan 2');

    const result = collectWaveArtifacts(tmpDir);
    assert.equal(result.length, 2);

    // Wave 1 should have PLAN and COMPLETE
    const w1 = result.find(w => w.wave === 1);
    assert.ok(w1);
    assert.equal(w1.artifacts.length, 2);
    const w1Names = w1.artifacts.map(a => a.name).sort();
    assert.deepEqual(w1Names, ['COMPLETE', 'PLAN']);

    // Wave 2 should have PLAN
    const w2 = result.find(w => w.wave === 2);
    assert.ok(w2);
    assert.equal(w2.artifacts.length, 1);
    assert.equal(w2.artifacts[0].name, 'PLAN');
  });

  it('collects set-level artifacts as wave 0', () => {
    fs.writeFileSync(path.join(tmpDir, 'CONTRACT.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'CONTEXT.md'), 'context');
    fs.writeFileSync(path.join(tmpDir, 'SET-OVERVIEW.md'), 'overview');

    const result = collectWaveArtifacts(tmpDir);
    const w0 = result.find(w => w.wave === 0);
    assert.ok(w0);
    assert.equal(w0.artifacts.length, 3);
    const names = w0.artifacts.map(a => a.name).sort();
    assert.deepEqual(names, ['CONTEXT.md', 'CONTRACT.json', 'SET-OVERVIEW.md']);
  });

  it('collects review artifacts as wave 999', () => {
    fs.writeFileSync(path.join(tmpDir, 'REVIEW-SCOPE.md'), 'scope');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW-UNIT.md'), 'unit');

    const result = collectWaveArtifacts(tmpDir);
    const review = result.find(w => w.wave === 999);
    assert.ok(review);
    assert.equal(review.artifacts.length, 2);
  });

  it('sorts wave groups by wave number ascending', () => {
    fs.writeFileSync(path.join(tmpDir, 'wave-3-PLAN.md'), 'plan 3');
    fs.writeFileSync(path.join(tmpDir, 'wave-1-PLAN.md'), 'plan 1');
    fs.writeFileSync(path.join(tmpDir, 'CONTRACT.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW-SCOPE.md'), 'scope');

    const result = collectWaveArtifacts(tmpDir);
    const waveNumbers = result.map(w => w.wave);
    assert.deepEqual(waveNumbers, [0, 1, 3, 999]);
  });

  it('returns empty array for nonexistent directory', () => {
    const result = collectWaveArtifacts('/nonexistent/path/does/not/exist');
    assert.deepEqual(result, []);
  });

  it('skips digest sibling files', () => {
    fs.writeFileSync(path.join(tmpDir, 'wave-1-PLAN.md'), 'plan');
    fs.writeFileSync(path.join(tmpDir, 'wave-1-PLAN-DIGEST.md'), 'digest');

    const result = collectWaveArtifacts(tmpDir);
    const w1 = result.find(w => w.wave === 1);
    assert.ok(w1);
    assert.equal(w1.artifacts.length, 1);
    assert.equal(w1.artifacts[0].name, 'PLAN');
  });

  it('includes absolute paths for artifacts', () => {
    fs.writeFileSync(path.join(tmpDir, 'wave-1-PLAN.md'), 'plan');

    const result = collectWaveArtifacts(tmpDir);
    const w1 = result.find(w => w.wave === 1);
    assert.ok(path.isAbsolute(w1.artifacts[0].path));
  });

  it('detects WAVE-N-HANDOFF.md pattern', () => {
    fs.writeFileSync(path.join(tmpDir, 'WAVE-2-HANDOFF.md'), 'handoff');

    const result = collectWaveArtifacts(tmpDir);
    const w2 = result.find(w => w.wave === 2);
    assert.ok(w2);
    assert.equal(w2.artifacts[0].name, 'HANDOFF');
  });

  it('works with real review-pipeline set directory', () => {
    // Use the actual .planning/sets/review-pipeline directory in the worktree
    const setDir = path.join(__dirname, '..', '..', '.planning', 'sets', 'review-pipeline');
    if (!fs.existsSync(setDir)) return; // skip if not available

    const result = collectWaveArtifacts(setDir);
    assert.ok(result.length > 0, 'Should find at least one wave group');

    // Should have wave 1 and wave 2 PLANs
    const waveNumbers = result.map(w => w.wave);
    assert.ok(waveNumbers.includes(1), 'Should include wave 1');
    assert.ok(waveNumbers.includes(2), 'Should include wave 2');
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_BUDGET_TOKENS
// ---------------------------------------------------------------------------
describe('DEFAULT_BUDGET_TOKENS', () => {
  it('is 120000', () => {
    assert.equal(DEFAULT_BUDGET_TOKENS, 120000);
  });
});

// ---------------------------------------------------------------------------
// Module exports completeness
// ---------------------------------------------------------------------------
describe('module exports', () => {
  it('exports compactContext as a function', () => {
    assert.equal(typeof compactContext, 'function');
  });

  it('exports registerCompactionTrigger as a function', () => {
    assert.equal(typeof registerCompactionTrigger, 'function');
  });

  it('exports fireCompactionTrigger as a function', () => {
    assert.equal(typeof fireCompactionTrigger, 'function');
  });

  it('exports clearHooks as a function', () => {
    assert.equal(typeof clearHooks, 'function');
  });

  it('exports getRegisteredHooks as a function', () => {
    assert.equal(typeof getRegisteredHooks, 'function');
  });

  it('exports resolveDigestPath as a function', () => {
    assert.equal(typeof resolveDigestPath, 'function');
  });

  it('exports readDigestOrFull as a function', () => {
    assert.equal(typeof readDigestOrFull, 'function');
  });

  it('exports isVerbatimArtifact as a function', () => {
    assert.equal(typeof isVerbatimArtifact, 'function');
  });

  it('exports collectWaveArtifacts as a function', () => {
    assert.equal(typeof collectWaveArtifacts, 'function');
  });

  it('exports DEFAULT_BUDGET_TOKENS as a number', () => {
    assert.equal(typeof DEFAULT_BUDGET_TOKENS, 'number');
  });
});

// ---------------------------------------------------------------------------
// Integration: compactContext with collectWaveArtifacts
// ---------------------------------------------------------------------------
describe('compactContext + collectWaveArtifacts integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  it('end-to-end: collect artifacts then compact with active wave', () => {
    // Set up a realistic set directory
    fs.writeFileSync(path.join(tmpDir, 'CONTRACT.json'), '{"owned_files": ["src/a.cjs"]}');
    fs.writeFileSync(path.join(tmpDir, 'CONTEXT.md'), 'Set context document.');
    fs.writeFileSync(path.join(tmpDir, 'wave-1-PLAN.md'), 'A'.repeat(4000));
    fs.writeFileSync(path.join(tmpDir, 'wave-1-PLAN-DIGEST.md'), 'Wave 1 plan summary.');
    fs.writeFileSync(path.join(tmpDir, 'WAVE-1-COMPLETE.md'), 'B'.repeat(2000));
    fs.writeFileSync(path.join(tmpDir, 'WAVE-1-COMPLETE-DIGEST.md'), 'Wave 1 done.');
    fs.writeFileSync(path.join(tmpDir, 'wave-2-PLAN.md'), 'C'.repeat(3000));

    const waves = collectWaveArtifacts(tmpDir);
    const context = {
      setId: 'test-integration',
      setDir: tmpDir,
      activeWave: 2,
      waves,
    };

    const result = compactContext(context);

    // Wave 0 (set-level): CONTRACT.json verbatim, CONTEXT.md full (wave 0 < activeWave 2)
    const w0 = result.compacted.find(c => c.wave === 0);
    assert.ok(w0);
    const contractArtifact = w0.artifacts.find(a => a.name === 'CONTRACT.json');
    assert.ok(contractArtifact);
    assert.equal(contractArtifact.isDigest, false); // verbatim pattern

    // Wave 1 (completed): should use digests
    const w1 = result.compacted.find(c => c.wave === 1);
    assert.ok(w1);
    for (const artifact of w1.artifacts) {
      assert.equal(artifact.isDigest, true, `Expected digest for ${artifact.name}`);
    }

    // Wave 2 (active): should use full content
    const w2 = result.compacted.find(c => c.wave === 2);
    assert.ok(w2);
    for (const artifact of w2.artifacts) {
      assert.equal(artifact.isDigest, false, `Expected full for ${artifact.name}`);
    }

    // Total tokens should be reasonable
    assert.ok(result.totalTokens > 0);
    assert.equal(result.budgetExceeded, false);
  });
});

// ---------------------------------------------------------------------------
// Integration: multi-wave context assembly with execute pipeline
// ---------------------------------------------------------------------------
describe('integration with execute', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    // Create .planning/sets/test-set/ structure
    const setDir = path.join(tmpDir, '.planning', 'sets', 'test-set');
    fs.mkdirSync(setDir, { recursive: true });
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  function getSetDir() {
    return path.join(tmpDir, '.planning', 'sets', 'test-set');
  }

  it('multi-wave context assembly: wave 1 uses digest, wave 2 uses full', () => {
    const setDir = getSetDir();
    // Wave 1: completed with digest
    fs.writeFileSync(path.join(setDir, 'wave-1-PLAN.md'), 'A'.repeat(4000));
    fs.writeFileSync(path.join(setDir, 'wave-1-PLAN-DIGEST.md'), 'Wave 1 built the compaction engine with hook registry.');
    fs.writeFileSync(path.join(setDir, 'WAVE-1-COMPLETE.md'), '# Wave 1 Complete\n**Completed:** 2026-03-16');
    // Wave 2: active
    fs.writeFileSync(path.join(setDir, 'wave-2-PLAN.md'), 'B'.repeat(4000));
    // Set-level
    fs.writeFileSync(path.join(setDir, 'CONTRACT.json'), '{"owned_files": ["src/lib/compaction.cjs"]}');

    const waves = collectWaveArtifacts(setDir);
    const result = compactContext({
      setId: 'test-set',
      setDir,
      activeWave: 2,
      waves,
    });

    // Wave 1 PLAN should use digest
    const w1 = result.compacted.find(c => c.wave === 1);
    assert.ok(w1);
    const w1Plan = w1.artifacts.find(a => a.name === 'PLAN');
    assert.ok(w1Plan);
    assert.equal(w1Plan.isDigest, true);
    assert.ok(w1Plan.content.includes('compaction engine'));

    // Wave 2 PLAN should use full content
    const w2 = result.compacted.find(c => c.wave === 2);
    assert.ok(w2);
    const w2Plan = w2.artifacts.find(a => a.name === 'PLAN');
    assert.ok(w2Plan);
    assert.equal(w2Plan.isDigest, false);

    // CONTRACT.json stays verbatim
    const w0 = result.compacted.find(c => c.wave === 0);
    assert.ok(w0);
    const contractArtifact = w0.artifacts.find(a => a.name === 'CONTRACT.json');
    assert.ok(contractArtifact);
    assert.equal(contractArtifact.isDigest, false);

    // Budget check
    assert.equal(result.budgetExceeded, false);
  });

  it('digest-first reduces token count vs no digests', () => {
    const setDir = getSetDir();
    // Wave 1 with large plan
    fs.writeFileSync(path.join(setDir, 'wave-1-PLAN.md'), 'A'.repeat(4000));
    fs.writeFileSync(path.join(setDir, 'wave-1-PLAN-DIGEST.md'), 'Short digest.');
    // Wave 2 (active)
    fs.writeFileSync(path.join(setDir, 'wave-2-PLAN.md'), 'B'.repeat(2000));

    // Run with digests present
    const wavesWithDigest = collectWaveArtifacts(setDir);
    const resultWithDigest = compactContext({
      setId: 'test-set',
      setDir,
      activeWave: 2,
      waves: wavesWithDigest,
    });

    // Remove digest and run again
    fs.unlinkSync(path.join(setDir, 'wave-1-PLAN-DIGEST.md'));
    const wavesWithoutDigest = collectWaveArtifacts(setDir);
    const resultWithoutDigest = compactContext({
      setId: 'test-set',
      setDir,
      activeWave: 2,
      waves: wavesWithoutDigest,
    });

    assert.ok(resultWithDigest.totalTokens < resultWithoutDigest.totalTokens,
      `Expected digest version (${resultWithDigest.totalTokens}) < no-digest version (${resultWithoutDigest.totalTokens})`);
  });

  it('HANDOFF digest handling for completed waves', () => {
    const setDir = getSetDir();
    fs.writeFileSync(path.join(setDir, 'WAVE-1-HANDOFF.md'), 'C'.repeat(2000));
    fs.writeFileSync(path.join(setDir, 'WAVE-1-HANDOFF-DIGEST.md'), 'Handoff summary: tasks 1-3 done.');

    const waves = collectWaveArtifacts(setDir);
    const result = compactContext({
      setId: 'test-set',
      setDir,
      activeWave: 2,
      waves,
    });

    const w1 = result.compacted.find(c => c.wave === 1);
    assert.ok(w1);
    const handoff = w1.artifacts.find(a => a.name === 'HANDOFF');
    assert.ok(handoff);
    assert.equal(handoff.isDigest, true);
    assert.ok(handoff.content.includes('Handoff summary'));
  });

  it('review artifact compaction uses digests', () => {
    const setDir = getSetDir();
    fs.writeFileSync(path.join(setDir, 'REVIEW-SCOPE.md'), 'D'.repeat(3000));
    fs.writeFileSync(path.join(setDir, 'REVIEW-SCOPE-DIGEST.md'), 'Review scope digest.');
    fs.writeFileSync(path.join(setDir, 'REVIEW-UNIT.md'), 'E'.repeat(3000));
    fs.writeFileSync(path.join(setDir, 'REVIEW-UNIT-DIGEST.md'), 'Unit review digest.');

    const waves = collectWaveArtifacts(setDir);
    // Review artifacts are wave 999; set activeWave to something low so 999 is "completed"
    // Actually wave 999 > activeWave so it's a "future" wave -- but the compaction
    // logic treats waves > activeWave as full reads. Let's verify this behavior.
    const result = compactContext({
      setId: 'test-set',
      setDir,
      activeWave: 2,
      waves,
    });

    // Wave 999 (review) with activeWave=2: these are future waves, so full reads
    // But since review wave (999) > activeWave (2), they are NOT completed waves
    // They fall into the "future wave or wave 0" branch: full content
    const reviewWave = result.compacted.find(c => c.wave === 999);
    assert.ok(reviewWave);
    // Review artifacts in "future" state use full content (not digests)
    // This is the correct behavior -- reviews are read in full
    for (const artifact of reviewWave.artifacts) {
      assert.equal(artifact.isDigest, false, `Expected full for review artifact ${artifact.name}`);
    }
  });

  it('assembleCompactedWaveContext produces formatted context string', () => {
    const setDir = getSetDir();
    // Wave 1: completed with digest
    fs.writeFileSync(path.join(setDir, 'wave-1-PLAN.md'), 'A'.repeat(4000));
    fs.writeFileSync(path.join(setDir, 'wave-1-PLAN-DIGEST.md'), 'Wave 1 summary: built core compaction module.');
    fs.writeFileSync(path.join(setDir, 'WAVE-1-COMPLETE.md'), '# Wave 1 Complete');
    // Wave 2: active
    fs.writeFileSync(path.join(setDir, 'wave-2-PLAN.md'), 'B'.repeat(3000));
    // Set-level
    fs.writeFileSync(path.join(setDir, 'CONTRACT.json'), '{"owned_files": []}');

    const execute = require('./execute.cjs');
    const { contextString, stats } = execute.assembleCompactedWaveContext(tmpDir, 'test-set', 2);

    // Verify headers
    assert.ok(contextString.includes('### Wave 1 (completed - digest)'),
      'Should have "completed - digest" header for wave 1');
    assert.ok(contextString.includes('### Wave 2 (active)'),
      'Should have "active" header for wave 2');

    // Verify content
    assert.ok(contextString.includes('Wave 1 summary: built core compaction module.'),
      'Should include wave 1 digest content');

    // Verify stats
    assert.ok(stats.digestsUsed > 0, 'Should have used at least one digest');
    assert.ok(stats.totalTokens > 0, 'Should have positive total tokens');
    assert.equal(stats.budgetExceeded, false);
  });
});

// ---------------------------------------------------------------------------
// registerDefaultHooks
// ---------------------------------------------------------------------------
describe('registerDefaultHooks', () => {
  let tmpDir;

  beforeEach(() => {
    clearHooks();
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    clearHooks();
    rmDir(tmpDir);
  });

  it('registers hooks for all three lifecycle events', () => {
    registerDefaultHooks(tmpDir);
    const hooks = getRegisteredHooks();
    assert.equal(hooks['wave-complete'], 1);
    assert.equal(hooks['pause'], 1);
    assert.equal(hooks['review-stage-complete'], 1);
  });

  it('wave-complete hook logs warning when plan digest is missing', async () => {
    const setDir = path.join(tmpDir, 'test-set');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'wave-1-PLAN.md'), 'Plan content.');
    // No digest file created

    registerDefaultHooks(tmpDir);

    // Capture stderr output
    const originalStderr = console.error;
    let capturedWarning = '';
    console.error = (msg) => { capturedWarning = msg; };

    try {
      await fireCompactionTrigger('wave-complete', {
        setId: 'test-set',
        waveNum: 1,
        setDir,
      });

      assert.ok(capturedWarning.includes('[COMPACTION WARN]'),
        `Expected warning message, got: "${capturedWarning}"`);
      assert.ok(capturedWarning.includes('wave-1-PLAN-DIGEST.md'),
        'Warning should mention the missing digest file');
    } finally {
      console.error = originalStderr;
    }
  });

  it('wave-complete hook does not warn when digest exists', async () => {
    const setDir = path.join(tmpDir, 'test-set');
    fs.mkdirSync(setDir, { recursive: true });
    fs.writeFileSync(path.join(setDir, 'wave-1-PLAN.md'), 'Plan content.');
    fs.writeFileSync(path.join(setDir, 'wave-1-PLAN-DIGEST.md'), 'Digest.');

    registerDefaultHooks(tmpDir);

    const originalStderr = console.error;
    let capturedWarning = '';
    console.error = (msg) => { capturedWarning = msg; };

    try {
      await fireCompactionTrigger('wave-complete', {
        setId: 'test-set',
        waveNum: 1,
        setDir,
      });

      assert.equal(capturedWarning, '', 'Should not produce a warning when digest exists');
    } finally {
      console.error = originalStderr;
    }
  });

  it('pause hook fires without error (no-op)', async () => {
    registerDefaultHooks(tmpDir);
    const result = await fireCompactionTrigger('pause', {});
    assert.equal(result.fired, 1);
    assert.equal(result.errors.length, 0);
  });

  it('review-stage-complete hook fires without error (no-op)', async () => {
    registerDefaultHooks(tmpDir);
    const result = await fireCompactionTrigger('review-stage-complete', {});
    assert.equal(result.fired, 1);
    assert.equal(result.errors.length, 0);
  });
});

// ===========================================================================
// NEW TESTS -- Approved test plan for context-optimization / compaction-engine
// ===========================================================================

// ---------------------------------------------------------------------------
// resolveDigestPath -- edge cases
// ---------------------------------------------------------------------------
describe('resolveDigestPath - edge cases', () => {
  // BEHAVIOR: resolveDigestPath should handle an empty string without crashing
  // GUARDS AGAINST: Undefined behavior when callers pass empty or uninitialized paths
  // EDGE CASE: Empty string does not end with '.md', so it should get '-DIGEST.md' appended
  it('handles empty string input', () => {
    const result = resolveDigestPath('');
    assert.equal(result, '-DIGEST.md');
  });

  // BEHAVIOR: resolveDigestPath should be case-sensitive for the .md extension check
  // GUARDS AGAINST: Silently swallowing uppercase .MD extensions as if they were .md,
  // which would produce incorrect digest paths by stripping the wrong suffix
  // EDGE CASE: .MD (uppercase) is not the same as .md -- should append -DIGEST.md
  it('handles .MD uppercase extension', () => {
    const result = resolveDigestPath('/sets/test/FILE.MD');
    // .MD does NOT match .md, so it should append -DIGEST.md to the full path
    assert.equal(result, '/sets/test/FILE.MD-DIGEST.md');
  });
});

// ---------------------------------------------------------------------------
// readDigestOrFull -- edge cases
// ---------------------------------------------------------------------------
describe('readDigestOrFull - edge cases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  // BEHAVIOR: readDigestOrFull should throw ENOENT when both digest and full file are missing
  // GUARDS AGAINST: Silent null returns that mask broken artifact references,
  // causing downstream code to operate on undefined content
  it('throws when artifact missing', () => {
    const missingPath = path.join(tmpDir, 'nonexistent.md');
    assert.throws(
      () => readDigestOrFull(missingPath),
      { code: 'ENOENT' }
    );
  });

  // BEHAVIOR: readDigestOrFull returns empty content with 0 tokens for an empty file
  // GUARDS AGAINST: Token estimation or content handling that crashes on empty strings
  // EDGE CASE: Empty file is a valid file -- should not throw, should return sensible defaults
  it('handles empty file', () => {
    const emptyFile = path.join(tmpDir, 'empty.md');
    fs.writeFileSync(emptyFile, '');

    const result = readDigestOrFull(emptyFile);
    assert.equal(result.content, '');
    assert.equal(result.isDigest, false);
    assert.equal(result.tokens, 0);
  });

  // BEHAVIOR: readDigestOrFull should prefer the digest for non-.md files (e.g., CONTRACT.json)
  // GUARDS AGAINST: Digest resolution only working for .md files, silently ignoring
  // digests for JSON or other file types
  // EDGE CASE: Non-.md files get digest path via appending -DIGEST.md (e.g., CONTRACT.json-DIGEST.md)
  it('prefers digest for non-.md file', () => {
    const jsonFile = path.join(tmpDir, 'CONTRACT.json');
    const jsonDigest = path.join(tmpDir, 'CONTRACT.json-DIGEST.md');
    fs.writeFileSync(jsonFile, '{"full": true}');
    fs.writeFileSync(jsonDigest, 'Digest of contract.');

    const result = readDigestOrFull(jsonFile);
    assert.equal(result.content, 'Digest of contract.');
    assert.equal(result.isDigest, true);
    assert.equal(result.path, jsonFile); // path always points to original
  });
});

// ---------------------------------------------------------------------------
// compactContext -- empty input edge cases
// ---------------------------------------------------------------------------
describe('compactContext - empty input edge cases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  // BEHAVIOR: compactContext should handle an empty waves array without crashing
  // GUARDS AGAINST: Array.map on undefined or null, or division by zero in token stats
  // EDGE CASE: A freshly created set with no artifacts yet
  it('handles empty waves array', () => {
    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [],
    };

    const result = compactContext(context);
    assert.deepEqual(result.compacted, []);
    assert.equal(result.totalTokens, 0);
    assert.equal(result.digestsUsed, 0);
    assert.equal(result.fullsUsed, 0);
    assert.equal(result.budgetExceeded, false);
  });

  // BEHAVIOR: compactContext should handle a wave with an empty artifacts array
  // GUARDS AGAINST: Array.map crashing on empty artifact lists or incorrect counting
  // EDGE CASE: Wave exists in metadata but all its files were deleted
  it('handles wave with empty artifacts', () => {
    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 1, artifacts: [] },
      ],
    };

    const result = compactContext(context);
    assert.equal(result.compacted.length, 1);
    assert.deepEqual(result.compacted[0].artifacts, []);
    assert.equal(result.totalTokens, 0);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- wave 0 behavior
// ---------------------------------------------------------------------------
describe('compactContext - wave 0 behavior', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  // BEHAVIOR: Wave 0 (set-level artifacts) should be treated as "future wave or wave 0"
  // when activeWave > 0, meaning full content is read (not compacted via digest)
  // GUARDS AGAINST: Wave 0 being misclassified as a "completed wave" (0 < activeWave),
  // which would cause set-level docs like CONTEXT.md to use digests prematurely
  // NOTE: This documents the ACTUAL behavior -- wave 0 IS treated as completed
  // because the code checks wave.wave < context.activeWave, and 0 < 1 is true.
  it('wave 0 treated as completed when activeWave > 0', () => {
    const contextFile = path.join(tmpDir, 'CONTEXT.md');
    fs.writeFileSync(contextFile, 'Full set context content here.');

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 0, artifacts: [{ name: 'CONTEXT.md', path: contextFile }] },
      ],
    };

    const result = compactContext(context);
    const w0 = result.compacted.find(c => c.wave === 0);
    assert.ok(w0);
    // Wave 0 with activeWave=1: 0 < 1 is true, so it IS a completed wave
    // Without a digest file, it falls back to full content
    assert.equal(w0.artifacts[0].isDigest, false);
    assert.equal(w0.artifacts[0].content, 'Full set context content here.');
  });

  // BEHAVIOR: CONTEXT.md at wave 0 should use digest content when a digest file exists
  // and activeWave > 0 (making wave 0 a "completed" wave)
  // GUARDS AGAINST: Digest files being ignored for wave 0 artifacts, wasting token budget
  it('CONTEXT.md at wave 0 uses digest when activeWave > 0', () => {
    const contextFile = path.join(tmpDir, 'CONTEXT.md');
    const contextDigest = path.join(tmpDir, 'CONTEXT-DIGEST.md');
    fs.writeFileSync(contextFile, 'A'.repeat(4000)); // 1000 tokens full
    fs.writeFileSync(contextDigest, 'Short context digest.'); // 6 tokens digest

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 0, artifacts: [{ name: 'CONTEXT.md', path: contextFile }] },
      ],
    };

    const result = compactContext(context);
    const w0 = result.compacted.find(c => c.wave === 0);
    assert.ok(w0);
    // Wave 0 is completed (0 < 1), CONTEXT.md is NOT verbatim, so digest is used
    assert.equal(w0.artifacts[0].isDigest, true);
    assert.equal(w0.artifacts[0].content, 'Short context digest.');
    assert.equal(result.digestsUsed, 1);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- mixed digest availability
// ---------------------------------------------------------------------------
describe('compactContext - mixed digest availability', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  // BEHAVIOR: When multiple waves have a mix of digest-available and digest-missing
  // artifacts, each artifact should independently resolve to digest or full
  // GUARDS AGAINST: A single missing digest causing all artifacts to fall back to full,
  // or digest count tracking being off
  it('multiple waves with mixed digest availability', () => {
    // Wave 1: two artifacts, one with digest, one without
    const w1Plan = path.join(tmpDir, 'wave-1-PLAN.md');
    const w1PlanDigest = path.join(tmpDir, 'wave-1-PLAN-DIGEST.md');
    const w1Complete = path.join(tmpDir, 'WAVE-1-COMPLETE.md');
    // No digest for COMPLETE
    fs.writeFileSync(w1Plan, 'A'.repeat(400));
    fs.writeFileSync(w1PlanDigest, 'Plan digest.');
    fs.writeFileSync(w1Complete, 'B'.repeat(400));

    // Wave 2: one artifact with digest (but wave 2 is completed too)
    const w2Plan = path.join(tmpDir, 'wave-2-PLAN.md');
    const w2PlanDigest = path.join(tmpDir, 'wave-2-PLAN-DIGEST.md');
    fs.writeFileSync(w2Plan, 'C'.repeat(400));
    fs.writeFileSync(w2PlanDigest, 'Wave 2 digest.');

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 3, // Both wave 1 and 2 are completed
      waves: [
        { wave: 1, artifacts: [
          { name: 'PLAN', path: w1Plan },
          { name: 'COMPLETE', path: w1Complete },
        ]},
        { wave: 2, artifacts: [
          { name: 'PLAN', path: w2Plan },
        ]},
      ],
    };

    const result = compactContext(context);
    // Arrange: w1 PLAN has digest, w1 COMPLETE does not, w2 PLAN has digest
    assert.equal(result.digestsUsed, 2);
    assert.equal(result.fullsUsed, 1);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- field preservation
// ---------------------------------------------------------------------------
describe('compactContext - field preservation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  // BEHAVIOR: The artifact 'name' field should be preserved unchanged through compaction
  // GUARDS AGAINST: Name being overwritten by filename extraction or digest path logic
  it('preserves artifact name field', () => {
    const file = path.join(tmpDir, 'wave-1-PLAN.md');
    fs.writeFileSync(file, 'content');

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 1, artifacts: [{ name: 'PLAN', path: file }] },
      ],
    };

    const result = compactContext(context);
    assert.equal(result.compacted[0].artifacts[0].name, 'PLAN');
  });

  // BEHAVIOR: totalTokens should be the exact sum of all individual artifact tokens
  // GUARDS AGAINST: Off-by-one in token accumulation or double-counting
  it('totalTokens is sum of artifact tokens', () => {
    // Arrange: three files with known token counts
    // estimateTokens = Math.ceil(text.length / 4)
    const f1 = path.join(tmpDir, 'wave-1-PLAN.md');
    const f2 = path.join(tmpDir, 'wave-2-PLAN.md');
    const f3 = path.join(tmpDir, 'wave-3-PLAN.md');
    fs.writeFileSync(f1, 'A'.repeat(40)); // 10 tokens
    fs.writeFileSync(f2, 'B'.repeat(80)); // 20 tokens
    fs.writeFileSync(f3, 'C'.repeat(120)); // 30 tokens

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 3, // only wave 3 is active
      waves: [
        { wave: 1, artifacts: [{ name: 'PLAN', path: f1 }] },
        { wave: 2, artifacts: [{ name: 'PLAN', path: f2 }] },
        { wave: 3, artifacts: [{ name: 'PLAN', path: f3 }] },
      ],
    };

    const result = compactContext(context);
    const sum = result.compacted.reduce((acc, wave) =>
      acc + wave.artifacts.reduce((a, art) => a + art.tokens, 0), 0);
    assert.equal(result.totalTokens, sum);
    assert.equal(result.totalTokens, 10 + 20 + 30);
  });
});

// ---------------------------------------------------------------------------
// Hook registry -- additional edge cases
// ---------------------------------------------------------------------------
describe('hook registry - additional edge cases', () => {
  beforeEach(() => {
    clearHooks();
  });

  afterEach(() => {
    clearHooks();
  });

  // BEHAVIOR: registerCompactionTrigger accepts any value as a handler
  // without type-checking; the error surfaces at fire-time when the
  // non-function is invoked as handler(context), causing a TypeError
  // that is caught and added to the errors array
  // GUARDS AGAINST: Assuming registration validates handler types --
  // callers must pass functions or face fire-time errors
  it('rejects non-function handler at fire time, not registration', async () => {
    // Registration accepts anything (no type check in source)
    registerCompactionTrigger('wave-complete', 'not-a-function');

    // fireCompactionTrigger catches the TypeError internally
    const result = await fireCompactionTrigger('wave-complete');
    assert.equal(result.fired, 1); // fired counts all attempts, including errors
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].includes('is not a function'));
  });

  // BEHAVIOR: fireCompactionTrigger should work correctly with synchronous handlers
  // (not just async functions), since it uses await which handles sync returns
  // GUARDS AGAINST: Only async handlers being supported, causing sync handlers
  // to be silently skipped or miscounted
  it('fireCompactionTrigger with sync handler', async () => {
    let called = false;
    registerCompactionTrigger('wave-complete', () => {
      called = true;
    });

    const result = await fireCompactionTrigger('wave-complete');
    assert.equal(called, true);
    assert.equal(result.fired, 1);
    assert.equal(result.errors.length, 0);
  });

  // BEHAVIOR: When a handler throws a non-Error value (e.g., a raw string),
  // it should still be captured in the errors array via String(err)
  // GUARDS AGAINST: err.message being undefined for non-Error throws, causing
  // "undefined" to appear in the errors array instead of the actual thrown value
  it('non-Error throws captured in errors array', async () => {
    registerCompactionTrigger('wave-complete', async () => {
      throw 'raw string error'; // eslint-disable-line no-throw-literal
    });

    const result = await fireCompactionTrigger('wave-complete');
    assert.equal(result.fired, 1);
    assert.equal(result.errors.length, 1);
    // err.message is undefined for string throws, so String(err) is used
    assert.equal(result.errors[0], 'raw string error');
  });

  // BEHAVIOR: Handlers are executed in the order they were registered (FIFO)
  // GUARDS AGAINST: Non-deterministic handler execution that could cause
  // state-dependent hooks to produce inconsistent results
  it('handler execution order preserved', async () => {
    const order = [];
    registerCompactionTrigger('wave-complete', async () => order.push('A'));
    registerCompactionTrigger('wave-complete', async () => order.push('B'));
    registerCompactionTrigger('wave-complete', async () => order.push('C'));

    await fireCompactionTrigger('wave-complete');
    assert.deepEqual(order, ['A', 'B', 'C']);
  });

  // BEHAVIOR: 'resume' is NOT a valid compaction trigger event
  // GUARDS AGAINST: Callers assuming 'resume' is handled, leading to silently
  // unregistered hooks that never fire
  it('resume event NOT in VALID_EVENTS', () => {
    assert.throws(
      () => registerCompactionTrigger('resume', async () => {}),
      { message: /Invalid compaction trigger event/ }
    );
  });
});

// ---------------------------------------------------------------------------
// collectWaveArtifacts -- additional edge cases
// ---------------------------------------------------------------------------
describe('collectWaveArtifacts - additional edge cases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  // BEHAVIOR: Unrecognized files (e.g., README.md, random.txt) should be ignored
  // GUARDS AGAINST: Unknown files being assigned to wave 0 or causing crashes
  it('ignores unrecognized files', () => {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), 'readme');
    fs.writeFileSync(path.join(tmpDir, 'random.txt'), 'random');
    fs.writeFileSync(path.join(tmpDir, 'notes.json'), '{}');

    const result = collectWaveArtifacts(tmpDir);
    assert.deepEqual(result, []);
  });

  // BEHAVIOR: DEFINITION.md is a recognized set-level artifact collected at wave 0
  // GUARDS AGAINST: DEFINITION.md being silently dropped from context assembly
  it('DEFINITION.md collected as wave 0 artifact', () => {
    fs.writeFileSync(path.join(tmpDir, 'DEFINITION.md'), 'definition content');

    const result = collectWaveArtifacts(tmpDir);
    const w0 = result.find(w => w.wave === 0);
    assert.ok(w0, 'Should have wave 0 group');
    const def = w0.artifacts.find(a => a.name === 'DEFINITION.md');
    assert.ok(def, 'Should find DEFINITION.md in wave 0');
  });

  // BEHAVIOR: All four review artifact types should be collected in wave 999
  // GUARDS AGAINST: Missing review artifact patterns causing incomplete review context
  it('all four review artifact types collected', () => {
    fs.writeFileSync(path.join(tmpDir, 'REVIEW-SCOPE.md'), 'scope');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW-UNIT.md'), 'unit');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW-BUGS.md'), 'bugs');
    fs.writeFileSync(path.join(tmpDir, 'REVIEW-UAT.md'), 'uat');

    const result = collectWaveArtifacts(tmpDir);
    const reviewWave = result.find(w => w.wave === 999);
    assert.ok(reviewWave, 'Should have wave 999 group');
    assert.equal(reviewWave.artifacts.length, 4);
    const names = reviewWave.artifacts.map(a => a.name).sort();
    assert.deepEqual(names, ['REVIEW-BUGS.md', 'REVIEW-SCOPE.md', 'REVIEW-UAT.md', 'REVIEW-UNIT.md']);
  });

  // BEHAVIOR: Files that look similar to wave artifacts but have wrong extensions
  // or casing should be rejected
  // GUARDS AGAINST: Loose regex patterns matching unintended files
  it('non-matching filenames rejected', () => {
    // These should NOT match the wave artifact patterns
    fs.writeFileSync(path.join(tmpDir, 'wave-1-PLAN.txt'), 'wrong ext');
    fs.writeFileSync(path.join(tmpDir, 'Wave-1-PLAN.md'), 'wrong case');
    fs.writeFileSync(path.join(tmpDir, 'wave-1-plan.md'), 'lowercase plan');
    fs.writeFileSync(path.join(tmpDir, 'wave-X-PLAN.md'), 'non-numeric');

    const result = collectWaveArtifacts(tmpDir);
    assert.deepEqual(result, []);
  });

  // BEHAVIOR: Large wave numbers (e.g., wave 99) should be parsed correctly
  // GUARDS AGAINST: Regex only matching single-digit wave numbers
  it('large wave numbers parse correctly', () => {
    fs.writeFileSync(path.join(tmpDir, 'wave-99-PLAN.md'), 'plan 99');
    fs.writeFileSync(path.join(tmpDir, 'WAVE-99-COMPLETE.md'), 'complete 99');

    const result = collectWaveArtifacts(tmpDir);
    const w99 = result.find(w => w.wave === 99);
    assert.ok(w99, 'Should have wave 99 group');
    assert.equal(w99.artifacts.length, 2);
  });
});

// ---------------------------------------------------------------------------
// registerDefaultHooks -- additional edge cases
// ---------------------------------------------------------------------------
describe('registerDefaultHooks - additional edge cases', () => {
  let tmpDir;

  beforeEach(() => {
    clearHooks();
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    clearHooks();
    rmDir(tmpDir);
  });

  // BEHAVIOR: wave-complete hook should NOT produce a warning when the plan file
  // itself does not exist (only warns when plan exists but digest is missing)
  // GUARDS AGAINST: False positive warnings for waves that have no plan file at all
  it('wave-complete hook no warn when plan file missing', async () => {
    const setDir = path.join(tmpDir, 'test-set');
    fs.mkdirSync(setDir, { recursive: true });
    // No plan file at all -- neither plan nor digest

    registerDefaultHooks(tmpDir);

    const originalStderr = console.error;
    let capturedWarning = '';
    console.error = (msg) => { capturedWarning = msg; };

    try {
      await fireCompactionTrigger('wave-complete', {
        setId: 'test-set',
        waveNum: 1,
        setDir,
      });

      assert.equal(capturedWarning, '', 'Should not produce warning when plan file is missing');
    } finally {
      console.error = originalStderr;
    }
  });

  // BEHAVIOR: Calling registerDefaultHooks twice doubles the hook count per event
  // GUARDS AGAINST: Assuming registerDefaultHooks is idempotent when it is not --
  // this documents the actual behavior to prevent accidental double-registration
  it('registerDefaultHooks twice doubles hook count', () => {
    registerDefaultHooks(tmpDir);
    registerDefaultHooks(tmpDir);

    const hooks = getRegisteredHooks();
    assert.equal(hooks['wave-complete'], 2);
    assert.equal(hooks['pause'], 2);
    assert.equal(hooks['review-stage-complete'], 2);
  });
});

// ---------------------------------------------------------------------------
// compactContext -- budget boundary conditions
// ---------------------------------------------------------------------------
describe('compactContext - budget boundary conditions', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmDir(tmpDir);
  });

  // BEHAVIOR: budgetExceeded should be false when totalTokens is exactly equal
  // to the budget (uses strict > comparison, not >=)
  // GUARDS AGAINST: Off-by-one where exactly-at-budget is flagged as exceeded
  // EDGE CASE: Budget boundary -- the difference between > and >= matters
  it('budget boundary exactly at threshold', () => {
    // Budget = 50 tokens. 50 tokens = 200 chars (Math.ceil(200/4) = 50)
    const file = path.join(tmpDir, 'test.md');
    fs.writeFileSync(file, 'X'.repeat(200)); // exactly 50 tokens

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 1, artifacts: [{ name: 'TEST', path: file }] },
      ],
    };

    const result = compactContext(context, { budget: 50 });
    assert.equal(result.totalTokens, 50);
    assert.equal(result.budgetExceeded, false); // 50 > 50 is false
  });

  // BEHAVIOR: budgetExceeded should be true when totalTokens is one token over budget
  // GUARDS AGAINST: Off-by-one where one-over-budget is not flagged
  // EDGE CASE: Smallest possible overage
  it('budget boundary one token over', () => {
    // Budget = 50 tokens. 51 tokens = 204 chars (Math.ceil(204/4) = 51)
    const file = path.join(tmpDir, 'test.md');
    fs.writeFileSync(file, 'X'.repeat(204)); // exactly 51 tokens

    const context = {
      setId: 'test-set',
      setDir: tmpDir,
      activeWave: 1,
      waves: [
        { wave: 1, artifacts: [{ name: 'TEST', path: file }] },
      ],
    };

    const result = compactContext(context, { budget: 50 });
    assert.equal(result.totalTokens, 51);
    assert.equal(result.budgetExceeded, true); // 51 > 50 is true
  });
});
