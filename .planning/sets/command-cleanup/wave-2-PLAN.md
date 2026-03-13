# Wave 2: Test Updates and Verification

## Objective

Update all test files to reflect the deprecated command removals from wave 1. Add negative-assertion tests confirming no deprecated keys survive. Run the full test suite to validate correctness.

## Tasks

### Task 1: Update display.test.cjs to remove deprecated stage assertions

**File:** `src/lib/display.test.cjs`

**Actions:**
1. Update ALL `expectedStages` arrays (lines 19, 54, 221, 241, 255) from the 14-element list to the 10-element list:
   - Remove: `'set-init'`, `'discuss'`, `'wave-plan'`, `'execute'`
   - Keep: `['init', 'plan-set', 'review', 'merge', 'start-set', 'discuss-set', 'execute-set', 'new-version', 'add-set', 'quick']`
2. In "has expected verb mappings" test (lines 32-48): Remove the 4 assertions for deprecated stages:
   - Remove: `assert.equal(display.STAGE_VERBS['set-init'], 'PREPARING');`
   - Remove: `assert.equal(display.STAGE_VERBS['discuss'], 'DISCUSSING');`
   - Remove: `assert.equal(display.STAGE_VERBS['wave-plan'], 'PLANNING');`
   - Remove: `assert.equal(display.STAGE_VERBS['execute'], 'EXECUTING');`
3. In "planning stages use blue background" tests (lines 67-76 for STAGE_BG, lines 269-279 for renderBanner): Remove deprecated stages from `planningStages` arrays:
   - Change from: `['init', 'set-init', 'discuss', 'wave-plan', 'plan-set', 'start-set', 'discuss-set', 'new-version', 'add-set']`
   - Change to: `['init', 'plan-set', 'start-set', 'discuss-set', 'new-version', 'add-set']`
4. In "execution stages use green background" tests (lines 79-89 for STAGE_BG, lines 281-291 for renderBanner): Remove `'execute'` from `executionStages` arrays:
   - Change from: `['execute', 'execute-set', 'quick']`
   - Change to: `['execute-set', 'quick']`
5. Update test description strings that say "14 stages" to say "10 stages":
   - Line 17: `'maps all 14 stages to uppercase verb strings'` -> `'maps all 10 stages to uppercase verb strings'`
   - Line 52: `'maps all 14 stages to ANSI background escape codes'` -> `'maps all 10 stages to ANSI background escape codes'`
   - Line 219: `'all 14 stages produce valid banner strings'` -> `'all 10 stages produce valid banner strings'`
6. Remove the `renderBanner("execute", "Wave 1.1")` test (lines 123-128) since `execute` is no longer a valid stage. Replace with a test for `execute-set`:
   ```javascript
   it('renderBanner("execute-set", "Wave 1.1") returns string containing "EXECUTING SET" and "Wave 1.1"', () => {
     const display = require(displayPath);
     const result = display.renderBanner('execute-set', 'Wave 1.1');
     assert.ok(result.includes('EXECUTING SET'), 'Banner should contain "EXECUTING SET"');
     assert.ok(result.includes('Wave 1.1'), 'Banner should contain "Wave 1.1"');
   });
   ```

**Verification:**
```bash
node --test src/lib/display.test.cjs
```

**What NOT to do:**
- Do NOT remove tests for `renderBanner("init")`, `renderBanner("review")`, `renderBanner("merge")`, `renderBanner("plan-set")` -- those stages are still active
- Do NOT remove the "unknown stage" fallback test

---

### Task 2: Update worktree.test.cjs to match new action strings

**File:** `src/lib/worktree.test.cjs`

**Actions:**
1. In the `deriveNextActions` test "suggests Initialize set for pending sets without worktree" (around line 1156):
   - Change: `actions.find(a => a.action.includes('/set-init'))` to `actions.find(a => a.action.includes('/rapid:start-set'))`
   - Update assertion message accordingly
2. In the test "suggests Start planning for pending sets with worktree" (around line 1174):
   - Change: `actions.find(a => a.action.includes('/discuss'))` to `actions.find(a => a.action.includes('/rapid:discuss-set'))`
3. In the test "suggests Continue executing for sets in executing state" (around line 1187):
   - Change: `actions.find(a => a.action.includes('/execute'))` to `actions.find(a => a.action.includes('/rapid:execute-set'))`

**Verification:**
```bash
node --test src/lib/worktree.test.cjs 2>&1 | tail -5
```

---

### Task 3: Add negative-assertion test for deprecated keys in tool-docs.test.cjs

**File:** `src/lib/tool-docs.test.cjs`

**Actions:**
1. After the existing "contains known essential commands" test (around line 47), add a new test:
   ```javascript
   it('does not contain any deprecated command keys', () => {
     const deprecated = [
       'set-init-create', 'set-init-list',
       'wave-plan-resolve', 'wave-plan-create-dir',
       'wave-plan-validate', 'wave-plan-list-jobs',
     ];
     for (const key of deprecated) {
       assert.ok(!(key in TOOL_REGISTRY), `Deprecated key "${key}" should not be in TOOL_REGISTRY`);
     }
   });
   ```
2. After the existing ROLE_TOOL_MAP tests, add a negative assertion:
   ```javascript
   it('no role references deprecated tool keys', () => {
     const deprecated = [
       'set-init-create', 'set-init-list',
       'wave-plan-resolve', 'wave-plan-create-dir',
       'wave-plan-validate', 'wave-plan-list-jobs',
     ];
     for (const [role, keys] of Object.entries(ROLE_TOOL_MAP)) {
       for (const key of keys) {
         assert.ok(
           !deprecated.includes(key),
           `ROLE_TOOL_MAP["${role}"] references deprecated key "${key}"`
         );
       }
     }
   });
   ```

**Verification:**
```bash
node --test src/lib/tool-docs.test.cjs
```

---

### Task 4: Update build-agents.test.cjs comment (minor)

**File:** `src/lib/build-agents.test.cjs`

**Actions:**
1. On line 26, update the comment to reflect the current removed roles:
   - Before: `// Removed 5 v2 roles: wave-researcher, wave-planner, job-planner, job-executor, wave-analyzer`
   - After: `// Removed 5 v2 roles: wave-researcher, wave-planner, job-planner, job-executor, wave-analyzer; v3.1 removed set-init/wave-plan CLI commands`

This is a low-priority documentation-only change. Skip if it provides no value.

**Verification:**
```bash
node --test src/lib/build-agents.test.cjs 2>&1 | tail -3
```

---

### Task 5: Run full test suite and verify no deprecated references remain

**Actions:**
1. Run the complete test suite to confirm no regressions:
   ```bash
   node --test src/lib/tool-docs.test.cjs src/lib/display.test.cjs src/lib/worktree.test.cjs src/lib/build-agents.test.cjs
   ```
2. Run a final grep audit to confirm no deprecated command references remain in src/ (excluding archives, comments about removal, and the `wt.setInit()` library function):
   ```bash
   grep -rn "set-init-create\|set-init-list\|wave-plan-resolve\|wave-plan-create-dir\|wave-plan-validate\|wave-plan-list-jobs" src/ && echo "FAIL: deprecated TOOL_REGISTRY keys found" && exit 1 || echo "OK: no deprecated registry keys"
   grep -rn "'set-init'" src/lib/display.cjs src/lib/tool-docs.cjs src/bin/rapid-tools.cjs && echo "FAIL: deprecated set-init stage/command found" && exit 1 || echo "OK: no deprecated set-init"
   grep -rn "handleSetInit" src/ && echo "FAIL: handleSetInit still exists" && exit 1 || echo "OK: handleSetInit removed"
   ```

**Verification:** All commands above exit 0.

---

## Success Criteria

1. `node --test src/lib/tool-docs.test.cjs` -- all tests pass including new negative assertions
2. `node --test src/lib/display.test.cjs` -- all tests pass with 10-stage arrays
3. `node --test src/lib/worktree.test.cjs` -- all tests pass with updated action strings
4. `node --test src/lib/build-agents.test.cjs` -- all tests pass
5. Grep audit confirms zero deprecated command key references in `src/` source files (excluding the `wt.setInit()` library function which is NOT deprecated)
6. TOOL_REGISTRY count is exactly 53
7. STAGE_VERBS and STAGE_BG each have exactly 10 entries
