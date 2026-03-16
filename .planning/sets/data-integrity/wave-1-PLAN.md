# Wave 1: Resume Deduplication

## Objective
Extract the duplicated resume logic from `handleResume()` (lines 1613-1702) and `execute resume` (lines 1917-1990) in rapid-tools.cjs into a single `resumeSet()` function in execute.cjs. Both CLI entry points become thin wrappers delegating to `resumeSet()`.

## Files Modified
| File | Action |
|------|--------|
| src/lib/execute.cjs | Add `resumeSet()` function, export it |
| src/lib/execute.test.cjs | Add unit tests for `resumeSet()` |

## Task 1: Add resumeSet() to execute.cjs

### What
Create `async function resumeSet(cwd, setId, options = {})` in execute.cjs that contains the unified resume logic currently duplicated across two code paths.

### Implementation Details

**Function location:** Add immediately after the `parseHandoff()` function (after line 421), before the wave reconciliation section.

**New imports needed at top of execute.cjs:**
- Add `const sm = require('./state-machine.cjs');` after the existing `const contract = require('./contract.cjs');` line (line 24). Use lazy require inside the function body instead to avoid any potential circular dependency: `const sm = require('./state-machine.cjs');` inside the function.

**Function signature:**
```javascript
async function resumeSet(cwd, setId, options = {}) {
  // options.infoOnly: boolean (default false) - skip registry update, return resumed:false
  // Returns: { resumed, setName, handoff, stateContext, definitionPath, contractPath, pauseCycles }
}
```

**Function body -- implement these steps in order:**

1. **Validate setId exists:** If `!setId`, throw `new Error('resumeSet requires a setId')`.

2. **Load registry and validate entry:**
   ```javascript
   const registry = worktree.loadRegistry(cwd);
   const entry = registry.worktrees[setId];
   if (!entry) throw new Error(`No worktree registered for set "${setId}"`);
   if (entry.phase !== 'Paused') throw new Error(`Set "${setId}" is in phase "${entry.phase}", not Paused`);
   ```

3. **Validate HANDOFF.md exists:**
   ```javascript
   const handoffPath = path.join(cwd, '.planning', 'sets', setId, 'HANDOFF.md');
   if (!fs.existsSync(handoffPath)) throw new Error(`No HANDOFF.md found for set "${setId}"`);
   ```

4. **Parse HANDOFF.md:**
   ```javascript
   const handoffRaw = fs.readFileSync(handoffPath, 'utf-8');
   const handoff = parseHandoff(handoffRaw);
   if (!handoff) throw new Error(`Failed to parse HANDOFF.md for set "${setId}"`);
   ```
   Note: `parseHandoff` is already defined in the same file -- call it directly, not via `execute.parseHandoff()`.

5. **Read STATE.json for set context:**
   ```javascript
   let stateContext = null;
   try {
     const sm = require('./state-machine.cjs');
     const stateResult = await sm.readState(cwd);
     if (stateResult && stateResult.valid) {
       for (const milestone of stateResult.state.milestones) {
         const setData = (milestone.sets || []).find(s => s.id === setId);
         if (setData) {
           stateContext = { milestoneId: milestone.id, setId: setData.id, status: setData.status, waves: setData.waves || [] };
           break;
         }
       }
     }
   } catch { /* Graceful -- STATE.json may not exist */ }
   ```

6. **Build paths:**
   ```javascript
   const definitionPath = path.join('.planning', 'sets', setId, 'DEFINITION.md');
   const contractPath = path.join('.planning', 'sets', setId, 'CONTRACT.json');
   ```

7. **Update registry (unless infoOnly):**
   ```javascript
   if (!options.infoOnly) {
     await worktree.registryUpdate(cwd, (reg) => {
       if (reg.worktrees[setId]) {
         reg.worktrees[setId].phase = 'Executing';
         reg.worktrees[setId].updatedAt = new Date().toISOString();
       }
       return reg;
     });
   }
   ```

8. **Return unified result:**
   ```javascript
   return {
     resumed: !options.infoOnly,
     setName: setId,
     handoff,
     stateContext,
     definitionPath,
     contractPath,
     pauseCycles: entry.pauseCycles || 0,
   };
   ```

**Export:** Add `resumeSet` to the `module.exports` object at the bottom of execute.cjs.

### What NOT to do
- Do NOT call `process.exit()` inside `resumeSet()`. Throw errors instead. The CLI wrappers handle exit.
- Do NOT import state-machine.cjs at the module top level -- use lazy require inside the function to avoid potential circular imports.
- Do NOT change the return shape. Both existing callers produce identical JSON keys; the return must match: `{ resumed, setName, handoff, stateContext, definitionPath, contractPath, pauseCycles }`.

### Verification
```bash
cd /home/kek/Projects/RAPID && node -e "const e = require('./src/lib/execute.cjs'); console.log(typeof e.resumeSet)"
# Expected: "function"
```

---

## Task 2: Add unit tests for resumeSet() in execute.test.cjs

### What
Add a new `describe('resumeSet', ...)` block to execute.test.cjs that tests the happy path and key error cases.

### Implementation Details

Add the test block at the end of execute.test.cjs, before the file closes. The tests need a mock project with a registry entry in Paused phase and a HANDOFF.md file.

**Test helper setup (inside describe block):**
```javascript
let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-resume-'));
  // Create .planning/sets/test-set/
  const setDir = path.join(tmpDir, '.planning', 'sets', 'test-set');
  fs.mkdirSync(setDir, { recursive: true });
  // Create HANDOFF.md
  fs.writeFileSync(path.join(setDir, 'HANDOFF.md'), [
    '---',
    'set: test-set',
    'paused_at: 2026-01-01T00:00:00.000Z',
    'pause_cycle: 1',
    'tasks_completed: 2',
    'tasks_total: 4',
    '---',
    '',
    '## Completed Work',
    'Tasks 1-2 done',
    '',
    '## Remaining Work',
    'Tasks 3-4 remain',
    '',
    '## Resume Instructions',
    'Continue from task 3',
  ].join('\n'), 'utf-8');
  // Create .planning/worktrees/REGISTRY.json with Paused entry
  const wtDir = path.join(tmpDir, '.planning', 'worktrees');
  fs.mkdirSync(wtDir, { recursive: true });
  fs.writeFileSync(path.join(wtDir, 'REGISTRY.json'), JSON.stringify({
    worktrees: {
      'test-set': {
        setName: 'test-set',
        branch: 'rapid/test-set',
        path: '.rapid-worktrees/test-set',
        phase: 'Paused',
        status: 'active',
        pauseCycles: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  }, null, 2), 'utf-8');
  // Create .planning/.locks/ for lock infrastructure
  fs.mkdirSync(path.join(tmpDir, '.planning', '.locks'), { recursive: true });
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

**Tests to write:**

1. **`it('returns resume data for a paused set')`** -- Call `resumeSet(tmpDir, 'test-set')`. Assert:
   - `result.resumed === true`
   - `result.setName === 'test-set'`
   - `result.handoff` is an object with `pauseCycle === 1`
   - `result.definitionPath` contains `'test-set'`
   - `result.contractPath` contains `'test-set'`
   - `result.pauseCycles === 1`

2. **`it('returns resumed:false with infoOnly option')`** -- Call `resumeSet(tmpDir, 'test-set', { infoOnly: true })`. Assert `result.resumed === false`. Verify registry still shows `Paused` phase (read registry file and check).

3. **`it('throws if setId is missing')`** -- Call `resumeSet(tmpDir, '')`. Assert rejects with error matching `/requires a setId/`.

4. **`it('throws if set is not Paused')`** -- Modify registry entry to `phase: 'Executing'` before calling. Assert rejects with error matching `/not Paused/`.

5. **`it('throws if HANDOFF.md is missing')`** -- Delete the HANDOFF.md file before calling. Assert rejects with error matching `/No HANDOFF.md/`.

6. **`it('handles pauseCycles being undefined')`** -- Remove `pauseCycles` from registry entry. Assert `result.pauseCycles === 0`.

### Verification
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/execute.test.cjs 2>&1 | tail -5
# Expected: all tests pass (check for "# pass" count increase, "# fail 0")
```

---

## Task 3: Rewrite handleResume() and execute resume in rapid-tools.cjs

**IMPORTANT: This task is in Wave 2, not Wave 1.** The wave-2-PLAN.md covers the CLI rewiring. Wave 1 focuses only on creating the library function and its tests.

---

## Success Criteria
1. `resumeSet` is exported from execute.cjs and callable as an async function
2. All 6 unit tests in execute.test.cjs pass
3. Existing execute.test.cjs tests continue to pass (no regressions)
4. `node -e "const e = require('./src/lib/execute.cjs'); console.log(typeof e.resumeSet)"` prints `function`

## Commit Format
```
feat(data-integrity): extract resumeSet() into execute.cjs
test(data-integrity): add unit tests for resumeSet()
```
