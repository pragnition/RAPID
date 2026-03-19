# PLAN: init-config -- Wave 1

## Objective

Make `loadSet()` in `src/lib/plan.cjs` gracefully handle missing DEFINITION.md and audit all 9 callsites for null-safety. This is the foundation for Wave 2 because the init skill currently bypasses `createSet()` (the roadmapper returns contracts but not definitions), so DEFINITION.md is missing after init. Before adding generation, the system must be resilient to its absence.

## Tasks

### Task 1: Make loadSet() return null definition when DEFINITION.md is missing

**File:** `src/lib/plan.cjs` (lines 194-216)

**Action:** Modify `loadSet()` to gracefully handle missing DEFINITION.md:

1. Wrap the `fs.readFileSync` for DEFINITION.md (line 202) in a try/catch or `fs.existsSync` check
2. When DEFINITION.md is absent, set `definition` to `null` (not empty string, not a stub)
3. Emit a `console.error` warning: `[RAPID] Warning: DEFINITION.md not found for set "${setName}" at ${defPath}`
4. Keep the existing behavior for CONTRACT.json -- it must still throw if missing
5. Keep the existing behavior for the set directory check -- it must still throw if the directory is missing
6. Update the JSDoc `@returns` to reflect `definition: string | null`

**Pattern to follow:** The existing CONTRIBUTIONS.json loading (lines 210-213) already uses a graceful pattern. Apply the same approach to DEFINITION.md but with `null` instead of `undefined` and a console.error warning.

**What NOT to do:**
- Do NOT return an empty string -- callers that do `.length` or `.match()` on null will get a clear TypeError at development time, while empty string silently passes
- Do NOT return a stub/placeholder definition -- `null` is the canonical "not present" signal
- Do NOT remove the throw for missing CONTRACT.json or missing set directory

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/plan.test.cjs 2>&1 | tail -20
```

---

### Task 2: Add null-safety guards to all loadSet() callsites

**Files to modify (4 files with 5 callsites needing guards):**

#### 2a: `src/commands/execute.cjs` (line 25)

Current code: `definitionLength: context.definition.length`

Fix: Use optional chaining with fallback: `definitionLength: context.definition?.length ?? 0`

#### 2b: `src/lib/execute.cjs` (lines 44-46)

Current code: `definition: setData.definition` is returned and embedded in agent prompts.

Fix: Default to a descriptive fallback:
```javascript
definition: setData.definition || '(DEFINITION.md not found for this set)',
```

This prevents the string "null" from appearing in agent prompts.

#### 2c: `src/lib/merge.cjs` (line 1360)

Current code: `definition: setData.definition` in `prepareReviewContext()` return value.

Fix: Default to a descriptive fallback:
```javascript
definition: setData.definition || '(DEFINITION.md not found for this set)',
```

This value is embedded in the reviewer prompt at line 1402.

#### 2d: `src/lib/plan.cjs` (line 367)

Current code in `surfaceAssumptions()`: `def.match(/## Scope\n([\s\S]*?)(?=\n##|$)/)` -- calling `.match()` on null will crash.

Fix: Add an early return guard at the top of the function body (after line 361):
```javascript
if (!def) {
  return '(No DEFINITION.md found for this set -- assumptions cannot be surfaced)';
}
```

**Callsites that are already safe (no changes needed):**
- `src/lib/worktree.cjs:665` -- only uses `setData.contract`
- `src/lib/stub.cjs:100,121` -- only uses `setData.contract`
- `src/lib/merge.cjs:1218` -- only uses `setData.contract`

**What NOT to do:**
- Do NOT change callsites that only access `.contract` -- they are already safe
- Do NOT use `??` for string fields that could be `null` -- use `||` since empty string should also trigger the fallback

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/plan.test.cjs 2>&1 | tail -20
```

---

### Task 3: Add tests for loadSet() graceful degradation

**File:** `src/lib/plan.test.cjs`

**Action:** Add new test cases within or adjacent to the existing `describe('loadSet', ...)` block (currently at line 247):

1. **Test: returns null definition when DEFINITION.md is missing**
   - Setup: Create a set directory with only CONTRACT.json (no DEFINITION.md)
   - Assert: `loaded.definition` is `null`
   - Assert: `loaded.contract` is a valid object
   - Assert: No exception thrown

2. **Test: emits warning to stderr when DEFINITION.md is missing**
   - Setup: Create a set directory with only CONTRACT.json
   - Intercept `console.error` (save original, replace with mock, restore in finally)
   - Assert: console.error was called with a message matching `/DEFINITION\.md not found/`

3. **Test: still throws when CONTRACT.json is missing**
   - Setup: Create a set directory with only DEFINITION.md (no CONTRACT.json)
   - Assert: `loadSet()` throws an error (ENOENT or parse error)

4. **Test: still throws when set directory does not exist**
   - This test already exists (line 271-273), so just verify it still passes after changes

**Test pattern to follow:** Match the existing test style in plan.test.cjs -- use `node:test` describe/it blocks, `assert.throws`, and the shared `tmpDir` setup/teardown.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/plan.test.cjs 2>&1 | tail -30
```

---

### Task 4: Add test for surfaceAssumptions() with null definition

**File:** `src/lib/plan.test.cjs`

**Action:** Find or create a `describe('surfaceAssumptions', ...)` block and add:

1. **Test: returns fallback message when DEFINITION.md is missing**
   - Setup: Create a set directory with only CONTRACT.json (no DEFINITION.md)
   - Call `surfaceAssumptions(tmpDir, 'setName')`
   - Assert: Return value includes "(No DEFINITION.md found" or similar non-crash string
   - Assert: No exception thrown

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test src/lib/plan.test.cjs 2>&1 | tail -30
```

---

## Success Criteria

1. `loadSet()` returns `{ definition: null, contract: {...} }` when DEFINITION.md is missing
2. `loadSet()` still throws when CONTRACT.json or the set directory is missing
3. `surfaceAssumptions()` does not crash when DEFINITION.md is missing
4. `src/commands/execute.cjs`, `src/lib/execute.cjs`, and `src/lib/merge.cjs` handle null definition without crashing or producing "null" in output
5. All existing tests in plan.test.cjs continue to pass
6. All new tests pass: `node --test src/lib/plan.test.cjs`

## File Ownership

| File | Action |
|------|--------|
| `src/lib/plan.cjs` | Modify (loadSet + surfaceAssumptions) |
| `src/lib/plan.test.cjs` | Modify (add tests) |
| `src/commands/execute.cjs` | Modify (null-safety) |
| `src/lib/execute.cjs` | Modify (null-safety) |
| `src/lib/merge.cjs` | Modify (null-safety) |
