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

  it('fires 0 handlers for unknown event name', async () => {
    const result = await fireCompactionTrigger('nonexistent-event');
    assert.equal(result.fired, 0);
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
