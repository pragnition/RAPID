# Wave 1 PLAN: Fix All Status Literals and Prose References

## Objective

Correct every `state transition set` call, status enumeration list, prose reference, and status-check branch in the skill layer to use past-tense status literals that match the canonical `SET_TRANSITIONS` map in `src/lib/state-transitions.cjs`. Also add a `discussed -> discussed` self-transition to support the discuss-set re-entry path, and remove the `2>/dev/null || true` error suppression that was masking the bug.

## Context

The canonical set lifecycle is: `pending -> discussed -> planned -> executed -> complete -> merged`. Four SKILL.md files issue `state transition set` calls using present-tense names that do not exist in `SET_TRANSITIONS`. Status documentation and prose guidance in several other skills reference these same invalid names. The review skill attempts a `reviewing` transition that was removed in v3 and must be deleted entirely (not replaced).

**What NOT to change:**
- `WAVE_TRANSITIONS` and `JOB_TRANSITIONS` correctly use present-tense (`executing`) by design for the wave/job lifecycle. Do not touch these.
- `skills/pause/SKILL.md` references "executing" as an activity description and "Executing" as a registry phase name -- these are NOT SET_TRANSITIONS status literals and must not be changed.
- The `complete` transition call in execute-set/SKILL.md line 332 is already correct.
- The `merged` transition call in merge/SKILL.md line 364 is already correct.
- Wave-level `executing` references in execute-set/SKILL.md (e.g., line 246, 280, 403) are correct -- they describe WAVE_TRANSITIONS, not SET_TRANSITIONS.

## Tasks

### Task 1: Add `discussed` self-transition to `src/lib/state-transitions.cjs`

**File:** `src/lib/state-transitions.cjs`

**Action:** Change line 5 from:
```javascript
  discussed:   ['planned'],
```
to:
```javascript
  discussed:   ['planned', 'discussed'],
```

This allows re-discuss (discussed -> discussed) which is triggered when a user chooses to re-discuss a set that has already been discussed. The discuss-set skill already prompts the user to confirm this re-entry path via AskUserQuestion.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const { SET_TRANSITIONS, validateTransition } = require('./src/lib/state-transitions.cjs');
// Self-transition should work
validateTransition('discussed', 'discussed');
// Forward transition still works
validateTransition('discussed', 'planned');
console.log('PASS: discussed self-transition works');
"
```

**Do NOT** change WAVE_TRANSITIONS or JOB_TRANSITIONS -- those correctly use present-tense (`executing`) by design for the wave/job lifecycle.

---

### Task 2: Fix discuss-set/SKILL.md transition and prose

**File:** `skills/discuss-set/SKILL.md`

**Changes (4 edits):**

1. **Line 75** -- Status check prose. Change:
   ```
   - **If `discussing`:** Use AskUserQuestion:
   ```
   to:
   ```
   - **If `discussed`:** Use AskUserQuestion:
   ```

2. **Line 264** -- Prose describing the transition. Change:
   ```
   Transition set from 'pending' to 'discussing'. Use `2>/dev/null || true` to handle both fresh (pending -> discussing) and re-discuss (already discussing) scenarios gracefully:
   ```
   to:
   ```
   Transition set from 'pending' to 'discussed'. The self-transition (discussed -> discussed) is allowed in SET_TRANSITIONS, so this call succeeds for both fresh and re-discuss scenarios:
   ```

3. **Line 268** -- The actual transition call. Change:
   ```bash
   node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" discussing 2>/dev/null || true
   ```
   to:
   ```bash
   node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" discussed
   ```
   Note: Remove `2>/dev/null || true` since the transition will now succeed in all valid scenarios (pending -> discussed and discussed -> discussed).

4. **Line 324** -- Key principles prose. Change:
   ```
   - **Set-level state transitions:** Only use `state transition set` to move from pending to discussing. Never use wave-level transitions.
   ```
   to:
   ```
   - **Set-level state transitions:** Only use `state transition set` to move from pending to discussed. Never use wave-level transitions.
   ```

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -n 'discussing' skills/discuss-set/SKILL.md
```
Expected: zero matches.

---

### Task 3: Fix plan-set/SKILL.md transition and prose

**File:** `skills/plan-set/SKILL.md`

**Changes (5 edits):**

1. **Line 74** -- Status check prose. Change:
   ```
   - **If `discussing`:** This is the expected state. Continue to Step 3.
   ```
   to:
   ```
   - **If `discussed`:** This is the expected state. Continue to Step 3.
   ```

2. **Line 282** -- Prose describing the transition. Change:
   ```
   Transition set from 'discussing' to 'planning':
   ```
   to:
   ```
   Transition set from 'discussed' to 'planned':
   ```

3. **Line 286** -- The actual transition call. Change:
   ```bash
   node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" planning
   ```
   to:
   ```bash
   node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" planned
   ```

4. **Line 365** -- Anti-patterns prose. Change:
   ```
   - Do NOT reference per-wave state transitions. Use `state transition set` only (discussing -> planning).
   ```
   to:
   ```
   - Do NOT reference per-wave state transitions. Use `state transition set` only (discussed -> planned).
   ```

5. **Line 381** -- Key principles prose. Change:
   ```
   - **Set-level state only:** One state transition: discussing -> planning. No wave-level or job-level state.
   ```
   to:
   ```
   - **Set-level state only:** One state transition: discussed -> planned. No wave-level or job-level state.
   ```

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -n 'discussing' skills/plan-set/SKILL.md && echo "FAIL: discussing still present" || echo "PASS: no discussing" && grep -n 'state transition set.*planning' skills/plan-set/SKILL.md && echo "FAIL: planning in transition call" || echo "PASS: no planning in transition calls"
```

---

### Task 4: Fix execute-set/SKILL.md transition and prose

**File:** `skills/execute-set/SKILL.md`

**Changes (6 edits):**

1. **Line 78** -- Status check prose. Change:
   ```
   - **If `planning`:** Expected state for first execution. Continue.
   ```
   to:
   ```
   - **If `planned`:** Expected state for first execution. Continue.
   ```

2. **Line 79** -- Status check prose. Change:
   ```
   - **If `executing`:** Re-entry scenario. Continue (will pick up from last complete wave).
   ```
   to:
   ```
   - **If `executed`:** Re-entry scenario. Continue (will pick up from last complete wave).
   ```

3. **Line 80** -- Status check error message prose. Change:
   ```
   - **If `pending` or `discussing`:** Error -- set is not ready for execution.
   ```
   to:
   ```
   - **If `pending` or `discussed`:** Error -- set is not ready for execution.
   ```

4. **Line 145** -- Prose before transition call. Change:
   ```
   If set is in `planning` state:
   ```
   to:
   ```
   If set is in `planned` state:
   ```

5. **Line 148** -- The actual transition call. Change:
   ```bash
   node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" executing
   ```
   to:
   ```bash
   node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" executed
   ```

6. **Line 151** -- Re-entry prose. Change:
   ```
   If set is already in `executing` state: skip transition (re-entry).
   ```
   to:
   ```
   If set is already in `executed` state: skip transition (re-entry).
   ```

**Do NOT change line 403** -- it correctly references `pending -> executing -> complete` for WAVE transitions (past-tense `planned -> executed` for SET transitions on the same line is already correct).

**Do NOT change lines 246, 280** -- these reference wave-level transitions (`state transition wave ... executing`) which correctly use present-tense.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -n 'state transition set.*executing' skills/execute-set/SKILL.md && echo "FAIL" || echo "PASS: no executing in set transition calls"
```

---

### Task 5: Remove review/SKILL.md transition section entirely

**File:** `skills/review/SKILL.md`

Per the CONTEXT.md decision: Remove the `reviewing` transition call entirely. Do NOT replace it with a new status. Review is optional and should not modify set status.

**Changes (5 edits):**

1. **Line 77** -- Status validation prose. Change:
   ```
   Parse the JSON output and find the target set. The set status MUST be `complete` or `reviewing`. If the set is in any other status (e.g., `pending`, `planning`, `executing`):
   ```
   to:
   ```
   Parse the JSON output and find the target set. The set status MUST be `complete`. If the set is in any other status (e.g., `pending`, `planned`, `executed`):
   ```

2. **Line 79** -- Error message. Change:
   ```
   > Cannot review set '{set-id}' -- current status is '{status}'. Set must be in 'complete' or 'reviewing' state. Run `/rapid:execute-set {set-id}` first.
   ```
   to:
   ```
   > Cannot review set '{set-id}' -- current status is '{status}'. Set must be in 'complete' state. Run `/rapid:execute-set {set-id}` first.
   ```

3. **Lines 83-93** -- Remove the entire "Transition set to 'reviewing'" subsection (Step 0d). Replace with:
   ```markdown
   ### 0d: Validate review eligibility

   **If `POST_MERGE=true`:** Skip this step entirely. Post-merge review does not require any specific set status -- it operates on already-merged sets. Proceed directly to Step 1.

   The set must be in `complete` state to proceed. No state transition is performed -- review is a non-mutating operation on set status.
   ```

4. **Line 1020** -- Key principles prose. Change:
   ```
   - **Review state is set-level.** The set transitions `complete` -> `reviewing`. The review does not modify individual wave states.
   ```
   to:
   ```
   - **Review does not modify set status.** Review operates on sets in `complete` state without transitioning them. The review skill is a non-mutating observation step.
   ```

5. **Line 1023** -- Idempotent re-entry prose. Change:
   ```
   - **Idempotent re-entry.** If a previous review session was interrupted, re-invoking `/rapid:review` picks up where it left off. The set is already in `reviewing` state, and existing REVIEW-*.md artifacts are preserved (overwritten only if the stage runs again).
   ```
   to:
   ```
   - **Idempotent re-entry.** If a previous review session was interrupted, re-invoking `/rapid:review` picks up where it left off. The set remains in `complete` state, and existing REVIEW-*.md artifacts are preserved (overwritten only if the stage runs again).
   ```

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -n 'reviewing' skills/review/SKILL.md && echo "FAIL: reviewing still present" || echo "PASS: no reviewing references"
```

---

### Task 6: Fix status/SKILL.md documentation

**File:** `skills/status/SKILL.md`

**Changes (3 edits):**

1. **Line 30** -- Status enumeration. Change:
   ```
   The set statuses are: `pending`, `discussing`, `planning`, `executing`, `complete`, `merged`.
   ```
   to:
   ```
   The set statuses are: `pending`, `discussed`, `planned`, `executed`, `complete`, `merged`.
   ```

2. **Line 76** -- Status column description. Change:
   ```
   - **Status**: Set status from STATE.json (pending, discussing, planning, executing, complete, merged)
   ```
   to:
   ```
   - **Status**: Set status from STATE.json (pending, discussed, planned, executed, complete, merged)
   ```

3. **Lines 99-101** -- Status-to-action table. Change:
   ```
   | discussing | `/rapid:discuss-set {N}` |
   | planning | `/rapid:plan-set {N}` |
   | executing | `/rapid:execute-set {N}` |
   ```
   to:
   ```
   | discussed | `/rapid:discuss-set {N}` |
   | planned | `/rapid:plan-set {N}` |
   | executed | `/rapid:execute-set {N}` |
   ```

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -n '`discussing`\|`planning`\|`executing`' skills/status/SKILL.md && echo "FAIL" || echo "PASS: no backtick-quoted present-tense statuses"
```

---

### Task 7: Fix new-version/SKILL.md documentation

**File:** `skills/new-version/SKILL.md`

**Changes (1 edit):**

1. **Line 47** -- Status enumeration in parenthetical list. Change:
   ```
   - **Set statuses:** List each set with its id and status (pending/discussing/planning/executing/complete/merged)
   ```
   to:
   ```
   - **Set statuses:** List each set with its id and status (pending/discussed/planned/executed/complete/merged)
   ```

Note: Other occurrences of "planning" in this file (e.g., "planning artifacts", "planning infrastructure") refer to the activity of planning, not a status literal. These must NOT be changed.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -n 'discussing\|pending/discussing' skills/new-version/SKILL.md && echo "FAIL" || echo "PASS: no status enumeration uses present-tense"
```

---

## Wave 1 Success Criteria

1. All 4 `state transition set` calls in SKILL.md files use valid SET_TRANSITIONS status literals (`discussed`, `planned`, `executed`)
2. The `reviewing` transition call in review/SKILL.md is completely removed (entire Step 0d rewritten)
3. The `2>/dev/null || true` error suppression in discuss-set/SKILL.md is removed
4. `discussed -> discussed` self-transition is allowed in SET_TRANSITIONS
5. All prose references to present-tense set statuses (`discussing`, `planning`, `executing`, `reviewing`) as backtick-quoted status values in `skills/*/SKILL.md` are corrected to past-tense equivalents
6. Wave/job lifecycle references to `executing` (present-tense, correctly used for waves/jobs) are NOT changed
7. `pause/SKILL.md` is NOT modified (its "executing" references are activity descriptions and registry phase names)
8. The `complete` transition call in execute-set line 332 is NOT changed (already correct)
9. The `merged` transition call in merge/SKILL.md is NOT changed (already correct)

## Verification (aggregate)

Run this single verification command after all tasks are complete:

```bash
cd /home/kek/Projects/RAPID && echo "=== Check 1: No invalid transition calls ===" && grep -rn 'state transition set.*discussing\|state transition set.*planning\b\|state transition set.*executing\|state transition set.*reviewing' skills/ && echo "FAIL: found invalid transition calls" && exit 1 || echo "PASS: no invalid transition calls" && echo "" && echo "=== Check 2: No backtick-quoted present-tense set statuses ===" && grep -rn '`discussing`\|`reviewing`' skills/ && echo "FAIL: found backtick-quoted invalid statuses" && exit 1 || echo "PASS: no backtick-quoted invalid statuses" && echo "" && echo "=== Check 3: discussed self-transition ===" && node -e "const { validateTransition } = require('./src/lib/state-transitions.cjs'); validateTransition('discussed', 'discussed'); console.log('PASS: self-transition works');" && echo "" && echo "=== Check 4: Existing tests still pass ===" && node --test src/lib/state-schemas.test.cjs
```

## Files Modified (exclusive ownership)

- `src/lib/state-transitions.cjs` (Task 1)
- `skills/discuss-set/SKILL.md` (Task 2)
- `skills/plan-set/SKILL.md` (Task 3)
- `skills/execute-set/SKILL.md` (Task 4)
- `skills/review/SKILL.md` (Task 5)
- `skills/status/SKILL.md` (Task 6)
- `skills/new-version/SKILL.md` (Task 7)
