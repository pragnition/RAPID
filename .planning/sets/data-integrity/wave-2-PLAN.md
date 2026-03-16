# Wave 2: CLI Rewiring, MERGE-STATE Transaction Wrapper, and update-phase Audit

## Objective
Three parallel sub-goals:
1. Rewire both CLI resume entry points (`handleResume` and `execute resume`) to delegate to `resumeSet()` from Wave 1.
2. Create `withMergeStateTransaction()` in merge.cjs and migrate all 14 MERGE-STATE write sites (12 in rapid-tools.cjs, 2 in merge.cjs).
3. Audit `execute update-phase` and add a validation guard for STATE.json inconsistency.

## Files Modified
| File | Action |
|------|--------|
| src/bin/rapid-tools.cjs | Rewire handleResume + execute resume; migrate merge state call sites; add update-phase guard |
| src/lib/merge.cjs | Add `withMergeStateTransaction()`, migrate internal call sites, deprecation JSDoc |
| src/lib/merge.test.cjs | Add tests for `withMergeStateTransaction()` |
| src/bin/rapid-tools.test.cjs | Add behavioral enforcement tests |

---

## Task 1: Create withMergeStateTransaction() in merge.cjs

### What
Add `withMergeStateTransaction(cwd, setId, mutationFn)` that mirrors the `withStateTransaction()` pattern from state-machine.cjs: acquire lock, read, mutate in-place, Zod validate, atomic write (tmp+rename), release.

Also add `ensureMergeState(cwd, setId, initialState)` helper for call sites that use the try-update/catch-create pattern.

### Implementation Details

**New import needed:** At the top of merge.cjs, add:
```javascript
const { acquireLock } = require('./lock.cjs');
```
Place after the existing `const plan = require('./plan.cjs');` line (line 32).

**Function 1: `withMergeStateTransaction(cwd, setId, mutationFn)`**

Add immediately after the `updateMergeState()` function (after line 191), before the subagent infrastructure section.

```javascript
/**
 * Execute a MERGE-STATE mutation within a transaction.
 * Acquires per-set lock, reads state, calls mutationFn(state) to mutate in-place,
 * validates with MergeStateSchema.parse, updates lastUpdatedAt, writes atomically
 * via tmp+rename, and releases lock. Returns validated state.
 *
 * CRITICAL: Do NOT call writeMergeState/updateMergeState from mutationFn -- it would bypass the lock.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Function} mutationFn - Function that receives state and mutates in-place
 * @returns {Promise<object>} The validated state after mutation
 */
async function withMergeStateTransaction(cwd, setId, mutationFn) {
  const release = await acquireLock(cwd, `merge-state-${setId}`);
  try {
    const current = readMergeState(cwd, setId);
    if (!current) {
      throw new Error(`No MERGE-STATE.json found for set ${setId}`);
    }
    mutationFn(current);
    const validated = MergeStateSchema.parse(current);
    validated.lastUpdatedAt = new Date().toISOString();
    const statePath = path.join(cwd, '.planning', 'sets', setId, 'MERGE-STATE.json');
    const tmpPath = statePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(validated, null, 2), 'utf-8');
    fs.renameSync(tmpPath, statePath);
    return validated;
  } finally {
    await release();
  }
}
```

**Function 2: `ensureMergeState(cwd, setId, initialState)`**

Add immediately after `withMergeStateTransaction()`.

```javascript
/**
 * Ensure a MERGE-STATE.json exists for a set. If it exists, update with the
 * provided fields via transaction. If not, create it with writeMergeState().
 *
 * This replaces the common try-updateMergeState/catch-writeMergeState pattern.
 *
 * @param {string} cwd - Project root directory
 * @param {string} setId - Set identifier
 * @param {Object} fields - Fields to set/update
 * @returns {Promise<object>} The validated state
 */
async function ensureMergeState(cwd, setId, fields) {
  const existing = readMergeState(cwd, setId);
  if (existing) {
    return withMergeStateTransaction(cwd, setId, (state) => {
      Object.assign(state, fields);
    });
  } else {
    // No existing state -- create with writeMergeState (already validates via Zod)
    const newState = {
      setId,
      lastUpdatedAt: new Date().toISOString(),
      ...fields,
    };
    writeMergeState(cwd, setId, newState);
    return readMergeState(cwd, setId);
  }
}
```

**Deprecation JSDoc:** Add `@deprecated Use withMergeStateTransaction() or ensureMergeState() instead.` to both `writeMergeState()` and `updateMergeState()` JSDoc blocks.

**Exports:** Add `withMergeStateTransaction` and `ensureMergeState` to the `module.exports` object at the bottom of merge.cjs.

### What NOT to do
- Do NOT remove `writeMergeState` or `updateMergeState` from exports -- other code may still reference them during migration.
- Do NOT change the MergeStateSchema -- some call sites write fields that get stripped by Zod's default behavior; this is a known issue, not something to fix here.
- Do NOT use `readMergeState` inside `mutationFn` -- it is already read by the transaction wrapper.

### Verification
```bash
cd /home/kek/Projects/RAPID && node -e "const m = require('./src/lib/merge.cjs'); console.log(typeof m.withMergeStateTransaction, typeof m.ensureMergeState)"
# Expected: "function function"
```

---

## Task 2: Add unit tests for withMergeStateTransaction() in merge.test.cjs

### What
Add a `describe('withMergeStateTransaction', ...)` block to merge.test.cjs.

### Implementation Details

Add at the end of merge.test.cjs before file close.

**Test setup (inside describe):**
```javascript
let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-merge-tx-'));
  const setDir = path.join(tmpDir, '.planning', 'sets', 'tx-test');
  fs.mkdirSync(setDir, { recursive: true });
  // Create .planning/.locks/
  fs.mkdirSync(path.join(tmpDir, '.planning', '.locks'), { recursive: true });
  // Write initial MERGE-STATE.json
  const mergeModule = require('./merge.cjs');
  mergeModule.writeMergeState(tmpDir, 'tx-test', {
    setId: 'tx-test',
    status: 'pending',
    lastUpdatedAt: new Date().toISOString(),
  });
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

**Tests:**

1. **`it('mutates state atomically')`** -- Call `withMergeStateTransaction(tmpDir, 'tx-test', (state) => { state.status = 'detecting'; })`. Assert returned state has `status === 'detecting'`. Read the file from disk and assert it also has `status === 'detecting'` and a `lastUpdatedAt` field.

2. **`it('validates state via Zod')`** -- Call with mutation that sets `status` to an invalid value like `'invalid-status'`. Assert the promise rejects (Zod validation error).

3. **`it('throws if MERGE-STATE.json does not exist')`** -- Call with a non-existent set ID `'no-such-set'`. Assert rejects with error matching `/No MERGE-STATE.json/`.

4. **`it('does not leave tmp files on success')`** -- After a successful transaction, assert that `MERGE-STATE.json.tmp` does NOT exist on disk.

5. **`it('releases lock even on error')`** -- Call with a mutation that throws. Assert the lock file is not held after (use `require('./lock.cjs').isLocked(tmpDir, 'merge-state-tx-test')` to check -- should return `false`).

**Tests for ensureMergeState:**

6. **`it('creates state if none exists')`** -- Call `ensureMergeState(tmpDir, 'new-set', { status: 'detecting', startedAt: new Date().toISOString() })`. Assert file is created and readable with correct status.

7. **`it('updates state if it exists')`** -- Call `ensureMergeState(tmpDir, 'tx-test', { status: 'merging' })`. Assert status changed to `'merging'` and `setId` is still `'tx-test'`.

### Verification
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/merge.test.cjs 2>&1 | tail -5
# Expected: all tests pass
```

---

## Task 3: Migrate MERGE-STATE write sites in rapid-tools.cjs to use transaction wrapper

### What
Replace all 12 MERGE-STATE write call sites in rapid-tools.cjs with calls to `merge.withMergeStateTransaction()` or `merge.ensureMergeState()`.

### Implementation Details

**IMPORTANT:** All these cases are inside `async` functions, so `await` is available.

**Call site mapping (line numbers are approximate -- locate by context):**

**Case `merge execute` (around lines 2183-2198):**
Replace the try-updateMergeState/catch-writeMergeState with:
```javascript
await merge.ensureMergeState(cwd, setName, {
  status: 'complete',
  mergeCommit: result.commitHash,
  completedAt: new Date().toISOString(),
});
```

**Case `merge update-status` (around lines 2288-2306):**
Replace the try-updateMergeState/catch-writeMergeState with:
```javascript
await merge.ensureMergeState(cwd, setName, stateUpdates);
```
Where `stateUpdates` is already built in the preceding code. This replaces both the `try { merge.updateMergeState(...) } catch { merge.writeMergeState(...) }` block.

Also: the `agentPhase2` merge logic (lines 2277-2286) that reads current state and builds existingPhase2 must move INSIDE the transaction to avoid TOCTOU. Refactor to:
```javascript
if (agentPhase2Update) {
  await merge.withMergeStateTransaction(cwd, setName, (state) => {
    const existingPhase2 = state.agentPhase2 || {};
    existingPhase2[agentPhase2Update.conflictId] = agentPhase2Update.phase;
    state.agentPhase2 = existingPhase2;
    Object.assign(state, { status });
    if (agentPhase1 !== undefined) state.agentPhase1 = agentPhase1;
  }).catch(() => {
    // No existing state -- create minimal
    return merge.ensureMergeState(cwd, setName, {
      status,
      startedAt: new Date().toISOString(),
      ...(agentPhase1 !== undefined ? { agentPhase1 } : {}),
      ...(agentPhase2Update ? { agentPhase2: { [agentPhase2Update.conflictId]: agentPhase2Update.phase } } : {}),
    });
  });
} else {
  await merge.ensureMergeState(cwd, setName, stateUpdates);
}
```

**Case `merge detect` (around lines 2326-2358):**
Replace the try-updateMergeState/catch-writeMergeState for initial status with:
```javascript
await merge.ensureMergeState(cwd, setName, { status: 'detecting', startedAt: new Date().toISOString() });
```
Replace the `merge.updateMergeState(cwd, setName, { detection: ... })` (line 2338) with:
```javascript
await merge.withMergeStateTransaction(cwd, setName, (state) => {
  state.detection = { /* same detection object as currently built */ };
});
```

**Case `merge resolve` (around lines 2376, 2423):**
Replace `merge.updateMergeState(cwd, setName, { status: 'resolving' })` with:
```javascript
await merge.withMergeStateTransaction(cwd, setName, (state) => { state.status = 'resolving'; });
```
Replace `merge.updateMergeState(cwd, setName, { resolution: ... })` with:
```javascript
await merge.withMergeStateTransaction(cwd, setName, (state) => {
  state.resolution = { /* same resolution object */ };
});
```

**Case `merge bisect` (around line 2499):**
Replace `merge.updateMergeState(cwd, result.breakingSet, { bisection: ... })` with:
```javascript
try {
  await merge.withMergeStateTransaction(cwd, result.breakingSet, (state) => {
    state.bisection = { isBreaking: true, iterations: result.iterations, detectedAt: new Date().toISOString() };
  });
} catch { /* may not have MERGE-STATE */ }
```

**Case `merge rollback` (around lines 2537-2543):**
Replace try-updateMergeState/catch-writeMergeState with:
```javascript
await merge.ensureMergeState(cwd, setName, { status: 'reverted' });
```

### What NOT to do
- Do NOT change `readMergeState` call sites -- reads are unlocked by design.
- Do NOT change the JSON output shape of any CLI command -- only the internal write mechanism changes.
- Do NOT remove the `merge.readMergeState` import/usage from the `agentPhase2` section entirely -- the initial read is fine for building the non-transactional parts; only the write must be transactional.

### Verification
```bash
cd /home/kek/Projects/RAPID && grep -n 'merge\.writeMergeState\|merge\.updateMergeState' src/bin/rapid-tools.cjs | wc -l
# Expected: 0 (all migrated)
cd /home/kek/Projects/RAPID && grep -n 'merge\.ensureMergeState\|merge\.withMergeStateTransaction' src/bin/rapid-tools.cjs | wc -l
# Expected: >= 8 (all write sites use transaction wrappers)
```

---

## Task 4: Migrate internal MERGE-STATE writes in merge.cjs (bisectWave)

### What
Replace the 2 internal write sites in merge.cjs `bisectWave()` function (around lines 1698, 1708 in the persisted output) with `withMergeStateTransaction` and `ensureMergeState`.

### Implementation Details

In the `bisectWave()` function, find the section "6. Update MERGE-STATE.json with bisection results" (approximately line 1694-1722 in the raw file).

Replace:
```javascript
try {
  const currentState = readMergeState(cwd, breakingSet);
  if (currentState) {
    updateMergeState(cwd, breakingSet, { ... });
  } else {
    writeMergeState(cwd, breakingSet, { ... });
  }
} catch { ... }
```

With:
```javascript
try {
  await ensureMergeState(cwd, breakingSet, {
    status: 'failed',
    bisection: {
      triggered: true,
      breakingSet,
      iterations,
      completedAt: new Date().toISOString(),
    },
  });
} catch {
  // Non-critical: bisection result is still returned even if state write fails
}
```

**IMPORTANT:** The `bisectWave()` function is currently synchronous. Check if making this one call async requires changing the function signature. If `bisectWave` is sync, the simplest approach is to keep the existing try/catch and just use the synchronous `writeMergeState` path wrapped in the `ensureMergeState` since `ensureMergeState` is async. Alternative: leave bisectWave's internal writes as-is and document as "will be migrated when bisectWave becomes async". Check the function signature first.

If `bisectWave` is synchronous, do NOT make it async in this set -- that would change the public API. Instead, document the two remaining sites with a `// TODO(data-integrity): migrate to withMergeStateTransaction when bisectWave becomes async` comment and move on.

### Verification
```bash
cd /home/kek/Projects/RAPID && grep -n 'updateMergeState\|writeMergeState' src/lib/merge.cjs | grep -v '^\s*//' | grep -v 'function ' | grep -v '@deprecated' | grep -v 'module.exports'
# Check output: only the function definitions + internal helper usage by withMergeStateTransaction should remain
```

---

## Task 5: Rewire handleResume() and execute resume in rapid-tools.cjs

### What
Replace the duplicated logic in `handleResume()` (lines 1613-1702) and `execute resume` case (lines 1917-1990) with thin wrappers that delegate to `execute.resumeSet()`.

### Implementation Details

**Rewrite handleResume() (lines 1613-1702):**
```javascript
async function handleResume(cwd, args) {
  const execute = require('../lib/execute.cjs');

  const infoOnly = args.includes('--info-only');
  const positionalArgs = args.filter(a => !a.startsWith('--'));
  const setName = positionalArgs[0];
  if (!setName) {
    error('Usage: rapid-tools resume <set-name> [--info-only]');
    process.exit(1);
  }

  try {
    const result = await execute.resumeSet(cwd, setName, { infoOnly });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}
```

**Rewrite execute resume case (lines 1917-1990):**
```javascript
case 'resume': {
  const setName = args[0];
  if (!setName) {
    error('Usage: rapid-tools execute resume <set-name>');
    process.exit(1);
  }
  try {
    const result = await execute.resumeSet(cwd, setName);
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
  break;
}
```

**Output shape:** The `worktreePath` field that `handleResume()` previously included is NOT present in either existing output (confirmed by reading both code paths). The output shape `{ resumed, setName, handoff, stateContext, definitionPath, contractPath, pauseCycles }` is identical across both callers.

### What NOT to do
- Do NOT remove the `require('../lib/execute.cjs')` from inside `handleResume` -- it uses a local require pattern consistent with other handler functions.
- Do NOT change the error message strings beyond what is necessary. The error messages now come from `resumeSet()` throw messages, which are semantically equivalent.
- Do NOT change the `handleResume` function signature -- it must still accept `(cwd, args)`.

### Verification
```bash
cd /home/kek/Projects/RAPID && node -e "
const src = require('fs').readFileSync('src/bin/rapid-tools.cjs', 'utf-8');
const resumeCount = (src.match(/execute\.resumeSet/g) || []).length;
const oldPatternCount = (src.match(/entry\.phase !== 'Paused'/g) || []).length;
console.log('resumeSet calls:', resumeCount, '(expect >= 2)');
console.log('old pattern remnants:', oldPatternCount, '(expect 0)');
"
```

---

## Task 6: Add update-phase STATE.json validation guard

### What
Add a warning to `execute update-phase` (around line 1834) that checks for STATE.json inconsistency after registry phase changes.

### Implementation Details

After the `registryUpdate` call (line 1863) and before the JSON output (line 1864), add:

```javascript
// Validation guard: warn if registry phase implies STATE.json inconsistency
try {
  const sm = require('../lib/state-machine.cjs');
  const stateResult = await sm.readState(cwd);
  if (stateResult && stateResult.valid) {
    for (const milestone of stateResult.state.milestones) {
      const setData = (milestone.sets || []).find(s => s.id === setName);
      if (setData) {
        // Phase-status consistency rules:
        // Done registry phase should correspond to 'executed' or 'merged' status
        // Error registry phase should not have 'executing' status
        const phaseStatusWarnings = [];
        if (phase === 'Done' && !['executed', 'merged'].includes(setData.status)) {
          phaseStatusWarnings.push(`Registry phase "Done" but STATE.json status is "${setData.status}" (expected "executed" or "merged")`);
        }
        if (phase === 'Error' && setData.status === 'executing') {
          phaseStatusWarnings.push(`Registry phase "Error" but STATE.json status is still "executing"`);
        }
        if (phase === 'Executing' && setData.status === 'merged') {
          phaseStatusWarnings.push(`Registry phase "Executing" but STATE.json status is already "merged"`);
        }
        for (const w of phaseStatusWarnings) {
          process.stderr.write(`[WARN] Phase/status inconsistency for "${setName}": ${w}\n`);
        }
        break;
      }
    }
  }
} catch {
  // Graceful -- STATE.json may not exist
}
```

### What NOT to do
- Do NOT auto-mutate STATE.json. This is intentionally informational only.
- Do NOT block or fail the command based on inconsistency. The warning is on stderr.
- Do NOT add STATE.json validation for phases other than Done, Error, Executing -- those have clear expected state correspondences.

### Verification
```bash
cd /home/kek/Projects/RAPID && grep -c 'Phase/status inconsistency' src/bin/rapid-tools.cjs
# Expected: 1 (the warning template string)
```

---

## Task 7: Add behavioral enforcement tests in rapid-tools.test.cjs

### What
Add grep-based invariant tests that ensure the codebase adheres to the data integrity contracts.

### Implementation Details

Add a new `describe('data-integrity behavioral enforcement', ...)` block to rapid-tools.test.cjs.

```javascript
describe('data-integrity behavioral enforcement', () => {
  const rapidToolsSrc = fs.readFileSync(
    path.join(__dirname, 'rapid-tools.cjs'), 'utf-8'
  );
  const mergeSrc = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'merge.cjs'), 'utf-8'
  );

  it('handleResume delegates to execute.resumeSet', () => {
    // Find the handleResume function body
    const handleResumeMatch = rapidToolsSrc.match(/async function handleResume[\s\S]*?^}/m);
    assert.ok(handleResumeMatch, 'handleResume function found');
    assert.ok(
      handleResumeMatch[0].includes('resumeSet'),
      'handleResume must delegate to resumeSet()'
    );
  });

  it('execute resume case delegates to execute.resumeSet', () => {
    // Find "case 'resume'" inside handleExecute
    const resumeCaseMatch = rapidToolsSrc.match(/case 'resume':[\s\S]*?break;\s*}/);
    assert.ok(resumeCaseMatch, 'execute resume case found');
    assert.ok(
      resumeCaseMatch[0].includes('resumeSet'),
      'execute resume must delegate to resumeSet()'
    );
  });

  it('rapid-tools.cjs has no direct writeMergeState calls', () => {
    // Allow readMergeState but not writeMergeState or updateMergeState
    const writeMatches = rapidToolsSrc.match(/merge\.(writeMergeState|updateMergeState)\s*\(/g) || [];
    assert.equal(
      writeMatches.length, 0,
      `Found ${writeMatches.length} direct merge state write calls in rapid-tools.cjs -- all should use withMergeStateTransaction or ensureMergeState`
    );
  });

  it('merge.cjs exports withMergeStateTransaction', () => {
    assert.ok(
      mergeSrc.includes('withMergeStateTransaction'),
      'merge.cjs must export withMergeStateTransaction'
    );
  });

  it('update-phase includes STATE.json validation guard', () => {
    assert.ok(
      rapidToolsSrc.includes('Phase/status inconsistency'),
      'update-phase must include STATE.json validation warning'
    );
  });
});
```

### Verification
```bash
cd /home/kek/Projects/RAPID && node --test src/bin/rapid-tools.test.cjs 2>&1 | tail -5
# Expected: all tests pass
```

---

## Success Criteria
1. `grep -c 'merge\.writeMergeState\|merge\.updateMergeState' src/bin/rapid-tools.cjs` returns 0
2. `grep -c 'merge\.ensureMergeState\|merge\.withMergeStateTransaction' src/bin/rapid-tools.cjs` returns >= 8
3. Both `handleResume()` and `execute resume` contain `resumeSet` delegation
4. All existing tests pass: `node --test src/lib/execute.test.cjs && node --test src/lib/merge.test.cjs && node --test src/bin/rapid-tools.test.cjs`
5. `update-phase` emits stderr warning on phase/status mismatch
6. Behavioral enforcement tests pass

## Commit Format
```
feat(data-integrity): add withMergeStateTransaction and ensureMergeState to merge.cjs
test(data-integrity): add transaction wrapper tests
refactor(data-integrity): migrate all MERGE-STATE writes to transaction wrapper
refactor(data-integrity): rewire handleResume and execute resume to use resumeSet
feat(data-integrity): add update-phase STATE.json validation guard
test(data-integrity): add behavioral enforcement tests
```
