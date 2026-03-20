# PLAN: solo-mode / Wave 1 -- Core Library Functions and Tests

## Objective

Add the three solo-mode lifecycle functions (`autoMergeSolo`, `detectSoloAndSkip`, `adjustReviewForSolo`) to `src/lib/worktree.cjs` and cover them with unit tests in `src/lib/worktree.test.cjs`. These functions are the building blocks that the skill files (Wave 2) will reference.

## Owned Files

| File | Action |
|------|--------|
| `src/lib/worktree.cjs` | Modify -- add 3 new exported functions |
| `src/lib/worktree.test.cjs` | Modify -- add test suites for new functions |

---

## Task 1: Add `autoMergeSolo()` to worktree.cjs

**What:** Add a function that transitions a solo set from `complete` to `merged` status. This will be called from execute-set Step 6 after the `complete` transition succeeds.

**Where:** `src/lib/worktree.cjs`, insert after the `getSetDiffBase()` function (after line 375), before the "Set Init Orchestration" section comment.

**Implementation:**

```javascript
/**
 * Auto-transition a solo set from complete to merged.
 * Solo sets have no branch to merge, so this is a state-only transition.
 * Uses retry logic (3 attempts, 2s pause) for lock contention safety.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {{ transitioned: boolean, error?: string }}
 */
function autoMergeSolo(cwd, setId) {
  if (!isSoloMode(cwd, setId)) {
    return { transitioned: false, error: 'Not a solo set' };
  }

  const { execSync } = require('child_process');

  // Find the milestone from STATE.json
  let milestone;
  try {
    const statePath = path.join(cwd, '.planning', 'STATE.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    milestone = state.milestone?.id;
    if (!milestone) {
      return { transitioned: false, error: 'No milestone found in STATE.json' };
    }
  } catch (err) {
    return { transitioned: false, error: `Failed to read STATE.json: ${err.message}` };
  }

  // Retry up to 3 times for lock contention
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const toolsPath = process.env.RAPID_TOOLS;
      if (!toolsPath) {
        return { transitioned: false, error: 'RAPID_TOOLS not set' };
      }
      execSync(
        `node "${toolsPath}" state transition set "${milestone}" "${setId}" merged`,
        { cwd, stdio: 'pipe', encoding: 'utf-8', timeout: 15000 }
      );
      return { transitioned: true };
    } catch (err) {
      if (attempt < 3) {
        // Sleep 2 seconds before retry (matches execute-set Step 6 pattern)
        execSync('sleep 2');
        continue;
      }
      return {
        transitioned: false,
        error: `State transition failed after 3 attempts: ${(err.stderr || err.message || '').toString().trim()}`,
      };
    }
  }
  return { transitioned: false, error: 'Unreachable' };
}
```

**Key details:**
- Guard with `isSoloMode()` check first -- returns early if not solo
- Read milestone ID from STATE.json (same pattern used by other state commands)
- Use `execSync` to call `rapid-tools state transition` (same CLI path as execute-set Step 6)
- 3-attempt retry with 2s pause (matches existing execute-set retry pattern)
- Return `{ transitioned: boolean, error?: string }` -- caller decides whether to warn or fail
- Do NOT throw on failure -- the design decision says "warn but succeed"

**Export:** Add `autoMergeSolo` to the `module.exports` block at the bottom of the file.

**Verification:**
```bash
node -e "const w = require('./src/lib/worktree.cjs'); console.log(typeof w.autoMergeSolo)"
# Expected: "function"
```

---

## Task 2: Add `detectSoloAndSkip()` to worktree.cjs

**What:** Add a function that detects whether a set is solo and returns an informational message for the merge skill to display.

**Where:** `src/lib/worktree.cjs`, insert immediately after `autoMergeSolo()`.

**Implementation:**

```javascript
/**
 * Detect if a set is solo and return skip information for merge skill.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {{ isSolo: boolean, message: string }}
 */
function detectSoloAndSkip(cwd, setId) {
  if (!isSoloMode(cwd, setId)) {
    return { isSolo: false, message: '' };
  }
  return {
    isSolo: true,
    message: `Set '${setId}' is a solo set -- already merged automatically after execution. No merge needed.`,
  };
}
```

**Key details:**
- Simple wrapper around `isSoloMode()` with a formatted message
- Returns `{ isSolo: boolean, message: string }` per CONTRACT.json
- Message text matches the UX decision from CONTEXT.md

**Export:** Add `detectSoloAndSkip` to the `module.exports` block.

**Verification:**
```bash
node -e "const w = require('./src/lib/worktree.cjs'); console.log(typeof w.detectSoloAndSkip)"
# Expected: "function"
```

---

## Task 3: Add `adjustReviewForSolo()` to worktree.cjs

**What:** Add a function that detects solo+merged sets and signals the review skill to use post-merge mode automatically.

**Where:** `src/lib/worktree.cjs`, insert immediately after `detectSoloAndSkip()`.

**Implementation:**

```javascript
/**
 * Detect if a set is solo and should use post-merge review mode.
 * Solo sets that have reached 'merged' status should automatically
 * route to post-merge review without requiring --post-merge flag.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @returns {{ postMerge: boolean }}
 */
function adjustReviewForSolo(cwd, setId) {
  if (!isSoloMode(cwd, setId)) {
    return { postMerge: false };
  }

  // Check if the set is in merged status
  try {
    const statePath = path.join(cwd, '.planning', 'STATE.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    const sets = state.milestone?.sets || {};
    const setStatus = sets[setId]?.status;
    if (setStatus === 'merged') {
      return { postMerge: true };
    }
  } catch {
    // If we can't read state, fall through to default
  }

  return { postMerge: false };
}
```

**Key details:**
- Guards with `isSoloMode()` first
- Reads STATE.json to check if the set has already reached `merged` status
- Only returns `postMerge: true` when BOTH conditions are met: solo AND merged
- Returns `{ postMerge: boolean }` per CONTRACT.json
- If STATE.json is unreadable, defaults to `{ postMerge: false }` (safe fallback)

**Export:** Add `adjustReviewForSolo` to the `module.exports` block.

**Verification:**
```bash
node -e "const w = require('./src/lib/worktree.cjs'); console.log(typeof w.adjustReviewForSolo)"
# Expected: "function"
```

---

## Task 4: Add unit tests for all three functions

**What:** Add test suites for `autoMergeSolo`, `detectSoloAndSkip`, and `adjustReviewForSolo` to the existing test file.

**Where:** `src/lib/worktree.test.cjs`, insert new `describe` blocks before the final closing `});` of the file (after the `reconcileRegistry solo guard` test block around line 1606).

**Test structure:**

### 4a: Tests for `detectSoloAndSkip`

```javascript
describe('detectSoloAndSkip', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'worktrees'), { recursive: true });
  });

  afterEach(() => { cleanupRepo(tmpDir); });

  it('returns isSolo: false for non-solo set', () => {
    worktree.writeRegistry(tmpDir, {
      version: 1,
      worktrees: {
        'normal-set': { setName: 'normal-set', branch: 'rapid/normal-set', path: '.rapid-worktrees/normal-set', status: 'active', phase: 'Created' },
      },
    });
    const result = worktree.detectSoloAndSkip(tmpDir, 'normal-set');
    assert.equal(result.isSolo, false);
    assert.equal(result.message, '');
  });

  it('returns isSolo: false for unknown set', () => {
    worktree.writeRegistry(tmpDir, { version: 1, worktrees: {} });
    const result = worktree.detectSoloAndSkip(tmpDir, 'unknown');
    assert.equal(result.isSolo, false);
  });

  it('returns isSolo: true with informational message for solo set', () => {
    worktree.writeRegistry(tmpDir, {
      version: 1,
      worktrees: {
        'my-solo': { setName: 'my-solo', solo: true, branch: 'main', path: '.', status: 'active', phase: 'Created', startCommit: 'abc123' },
      },
    });
    const result = worktree.detectSoloAndSkip(tmpDir, 'my-solo');
    assert.equal(result.isSolo, true);
    assert.ok(result.message.includes('my-solo'));
    assert.ok(result.message.includes('solo set'));
    assert.ok(result.message.includes('No merge needed'));
  });
});
```

### 4b: Tests for `adjustReviewForSolo`

```javascript
describe('adjustReviewForSolo', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempRepo();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'worktrees'), { recursive: true });
  });

  afterEach(() => { cleanupRepo(tmpDir); });

  it('returns postMerge: false for non-solo set', () => {
    worktree.writeRegistry(tmpDir, {
      version: 1,
      worktrees: {
        'normal-set': { setName: 'normal-set', branch: 'rapid/normal-set', path: '.rapid-worktrees/normal-set', status: 'active', phase: 'Created' },
      },
    });
    const result = worktree.adjustReviewForSolo(tmpDir, 'normal-set');
    assert.equal(result.postMerge, false);
  });

  it('returns postMerge: false for solo set NOT in merged status', () => {
    worktree.writeRegistry(tmpDir, {
      version: 1,
      worktrees: {
        'my-solo': { setName: 'my-solo', solo: true, branch: 'main', path: '.', status: 'active', phase: 'Created', startCommit: 'abc123' },
      },
    });
    // Write STATE.json with set in 'complete' (not merged yet)
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.json'), JSON.stringify({
      milestone: { id: 'v1', sets: { 'my-solo': { status: 'complete' } } },
    }));
    const result = worktree.adjustReviewForSolo(tmpDir, 'my-solo');
    assert.equal(result.postMerge, false);
  });

  it('returns postMerge: true for solo set in merged status', () => {
    worktree.writeRegistry(tmpDir, {
      version: 1,
      worktrees: {
        'my-solo': { setName: 'my-solo', solo: true, branch: 'main', path: '.', status: 'active', phase: 'Created', startCommit: 'abc123' },
      },
    });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.json'), JSON.stringify({
      milestone: { id: 'v1', sets: { 'my-solo': { status: 'merged' } } },
    }));
    const result = worktree.adjustReviewForSolo(tmpDir, 'my-solo');
    assert.equal(result.postMerge, true);
  });

  it('returns postMerge: false when STATE.json is missing', () => {
    worktree.writeRegistry(tmpDir, {
      version: 1,
      worktrees: {
        'my-solo': { setName: 'my-solo', solo: true, branch: 'main', path: '.', status: 'active', phase: 'Created', startCommit: 'abc123' },
      },
    });
    // No STATE.json written -- should not throw
    const result = worktree.adjustReviewForSolo(tmpDir, 'my-solo');
    assert.equal(result.postMerge, false);
  });
});
```

### 4c: Tests for `autoMergeSolo`

Testing `autoMergeSolo` is more complex because it calls `rapid-tools` via `execSync`. Write tests that cover the guard conditions (non-solo set, missing STATE.json, missing RAPID_TOOLS) without requiring the full CLI to be present:

```javascript
describe('autoMergeSolo', () => {
  let tmpDir;
  let originalRapidTools;

  beforeEach(() => {
    tmpDir = createTempRepo();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'worktrees'), { recursive: true });
    originalRapidTools = process.env.RAPID_TOOLS;
  });

  afterEach(() => {
    cleanupRepo(tmpDir);
    if (originalRapidTools !== undefined) {
      process.env.RAPID_TOOLS = originalRapidTools;
    } else {
      delete process.env.RAPID_TOOLS;
    }
  });

  it('returns transitioned: false for non-solo set', () => {
    worktree.writeRegistry(tmpDir, {
      version: 1,
      worktrees: {
        'normal-set': { setName: 'normal-set', branch: 'rapid/normal-set', path: '.rapid-worktrees/normal-set', status: 'active', phase: 'Created' },
      },
    });
    const result = worktree.autoMergeSolo(tmpDir, 'normal-set');
    assert.equal(result.transitioned, false);
    assert.ok(result.error.includes('Not a solo set'));
  });

  it('returns transitioned: false when STATE.json is missing', () => {
    worktree.writeRegistry(tmpDir, {
      version: 1,
      worktrees: {
        'my-solo': { setName: 'my-solo', solo: true, branch: 'main', path: '.', status: 'active', phase: 'Created', startCommit: 'abc123' },
      },
    });
    const result = worktree.autoMergeSolo(tmpDir, 'my-solo');
    assert.equal(result.transitioned, false);
    assert.ok(result.error.includes('STATE.json'));
  });

  it('returns transitioned: false when RAPID_TOOLS is not set', () => {
    delete process.env.RAPID_TOOLS;
    worktree.writeRegistry(tmpDir, {
      version: 1,
      worktrees: {
        'my-solo': { setName: 'my-solo', solo: true, branch: 'main', path: '.', status: 'active', phase: 'Created', startCommit: 'abc123' },
      },
    });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.json'), JSON.stringify({
      milestone: { id: 'v1', sets: { 'my-solo': { status: 'complete' } } },
    }));
    const result = worktree.autoMergeSolo(tmpDir, 'my-solo');
    assert.equal(result.transitioned, false);
    assert.ok(result.error.includes('RAPID_TOOLS'));
  });
});
```

**What NOT to do:**
- Do NOT mock the `worktree` module itself -- use real temp repos with real REGISTRY.json files (same pattern as existing tests)
- Do NOT try to test the full `autoMergeSolo` happy path without the rapid-tools CLI available -- the guard condition tests provide sufficient coverage. Integration testing of the happy path happens at Wave 2 (skill-level) or in end-to-end testing
- Do NOT add tests for `formatStatusTable` or `formatMarkIIStatus` -- those already handle solo annotation correctly (confirmed in research)

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/worktree.test.cjs 2>&1 | tail -20
# Expected: All tests pass, including new solo-mode tests
```

---

## Success Criteria

1. `autoMergeSolo`, `detectSoloAndSkip`, and `adjustReviewForSolo` are exported from `src/lib/worktree.cjs`
2. All three functions follow the signatures defined in CONTRACT.json
3. `isSoloMode()` is the single guard for all solo-specific behavior
4. All existing tests continue to pass
5. New tests pass for guard conditions and solo detection logic
6. `node --test src/lib/worktree.test.cjs` exits with code 0
