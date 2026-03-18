# PLAN: state-execution / Wave 1

## Objective

Fix the `executed` status dead zone in the set lifecycle. Sets that finish execution currently cannot be reviewed because the review skill rejects `executed` status, and the `executed -> executed` self-transition is not allowed, preventing idempotent re-entry. This wave adds the self-loop transition and relaxes the review skill's status gate.

## Tasks

### Task 1: Add `executed` self-loop to SET_TRANSITIONS

**Files:**
- `src/lib/state-transitions.cjs`

**Action:**
In `src/lib/state-transitions.cjs`, line 7, change the `executed` transition array from `['complete']` to `['complete', 'executed']`. This allows the `executed -> executed` self-transition for idempotent re-entry when execute-set is re-run on an already-executed set.

Do NOT modify any other transition in the map. Only change the `executed` key's array.

**Verification:**
```bash
node -e "const t = require('./src/lib/state-transitions.cjs'); const e = t.SET_TRANSITIONS.executed; console.log(JSON.stringify(e)); if (e.length !== 2 || e[0] !== 'complete' || e[1] !== 'executed') { process.exit(1); } console.log('PASS')"
```

**Done when:** `SET_TRANSITIONS.executed` is `['complete', 'executed']` and the verification prints `PASS`.

---

### Task 2: Update tests for the `executed` self-loop

**Files:**
- `src/lib/state-transitions.test.cjs`

**Action:**
Three changes are needed in `src/lib/state-transitions.test.cjs`:

1. **Line 27-28:** Change the test `'executed -> complete only'` to reflect the new transition. Update the test name to `'executed -> complete or executed (allows re-execution)'` and change the assertion from:
   ```js
   assert.deepEqual(SET_TRANSITIONS.executed, ['complete']);
   ```
   to:
   ```js
   assert.deepEqual(SET_TRANSITIONS.executed, ['complete', 'executed']);
   ```

2. **Add a new test** in the `'validateTransition - valid transitions'` describe block (after the `'executed -> complete succeeds'` test around line 57-59). Add:
   ```js
   it('executed -> executed succeeds (idempotent re-entry)', () => {
     assert.doesNotThrow(() => validateTransition('executed', 'executed'));
   });
   ```

3. **Remove the test that would now be invalid** -- check if any test in the `'validateTransition - invalid transitions'` block asserts that `executed -> executed` throws. The current test at line 113-115 tests `executed -> planned` (which remains invalid), so no removal is needed there. However, verify no test asserts `executed -> executed` is invalid.

Do NOT change any other test assertions. Only the `executed` transition tests change.

**Verification:**
```bash
node --test src/lib/state-transitions.test.cjs
```

**Done when:** All tests pass, including the new `executed -> executed` self-loop test and the updated assertion.

---

### Task 3: Relax review skill to accept `executed` status

**Files:**
- `skills/review/SKILL.md`

**Action:**
In `skills/review/SKILL.md`, Step 0c (around line 122), change the status validation to accept both `complete` and `executed`:

1. Change line 122 from:
   ```
   Parse the JSON output and find the target set. The set status MUST be `complete`. If the set is in any other status (e.g., `pending`, `planned`, `executed`):
   ```
   to:
   ```
   Parse the JSON output and find the target set. The set status MUST be `complete` or `executed`. If the set is in any other status (e.g., `pending`, `planned`):
   ```

2. Change line 124 from:
   ```
   > Cannot review set '{set-id}' -- current status is '{status}'. Set must be in 'complete' state. Run `/rapid:execute-set {set-id}` first.
   ```
   to:
   ```
   > Cannot review set '{set-id}' -- current status is '{status}'. Set must be in 'complete' or 'executed' state. Run `/rapid:execute-set {set-id}` first.
   ```

3. In Step 0d (around line 131-132), change:
   ```
   The set must be in `complete` state to proceed.
   ```
   to:
   ```
   The set must be in `complete` or `executed` state to proceed.
   ```

This is a silent acceptance -- no warning banner needed. The review itself IS the verification step, so the distinction between `executed` and `complete` is irrelevant at review time.

Do NOT add any conditional logic or warning banners. Treat `executed` identically to `complete`.

**Verification:**
```bash
grep -n 'executed' skills/review/SKILL.md | head -20
```

Verify that:
- `executed` no longer appears in the "other status" rejection examples
- `executed` appears alongside `complete` in the acceptance criteria
- No warning banners were added

**Done when:** The review skill accepts sets in both `complete` and `executed` status, with no warning banners or special handling for `executed`.

---

## Success Criteria

1. `SET_TRANSITIONS.executed` equals `['complete', 'executed']`
2. `validateTransition('executed', 'executed')` does not throw
3. `node --test src/lib/state-transitions.test.cjs` passes all tests
4. Review skill Step 0c accepts both `complete` and `executed` status
5. No other transition paths or test assertions were changed
