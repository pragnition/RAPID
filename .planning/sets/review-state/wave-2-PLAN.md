# PLAN: review-state / wave-2

## Objective

Wire the review state library (from wave-1) into the CLI command handler and all four SKILL.md files. The CLI gains a `state` subcommand for inspection. Each skill gains entry-point state checks (skip/re-run prompt) and exit-point state writes (mark stage complete).

## Owned Files

| File | Action |
|------|--------|
| `src/commands/review.cjs` | Extend |
| `src/commands/review.test.cjs` | Extend |
| `skills/review/SKILL.md` | Modify |
| `skills/unit-test/SKILL.md` | Modify |
| `skills/bug-hunt/SKILL.md` | Modify |
| `skills/uat/SKILL.md` | Modify |

## Task 1: Add `state` CLI subcommand

**File:** `src/commands/review.cjs`

### 1a: Add `state` case to the switch statement

Add a new case `'state'` before the `default` case (before line 281). Implementation:

```javascript
case 'state': {
  const { positional: statePos } = parseArgs(args, {});
  const setId = statePos[0];
  if (!setId) {
    throw new CliError('Usage: rapid-tools review state <set-id>');
  }
  const state = review.readReviewState(cwd, setId);
  if (!state) {
    output(JSON.stringify({ setId, message: 'No review state found. Run /rapid:review to start.' }));
    break;
  }
  // Build table-friendly output
  const stages = ['scope', 'unit-test', 'bug-hunt', 'uat'];
  const table = stages.map(s => {
    const entry = state.stages[s];
    return {
      stage: s,
      status: entry && entry.completed ? 'complete' : 'pending',
      verdict: entry && entry.completed ? entry.verdict : '-',
    };
  });
  output(JSON.stringify({ setId, stages: table, lastUpdatedAt: state.lastUpdatedAt }));
  break;
}
```

### 1b: Add `mark-stage` case to the switch statement

Add a new case `'mark-stage'` after the `state` case. This allows CLI-driven stage completion (used by skills via bash commands).

```javascript
case 'mark-stage': {
  const { positional: markPos } = parseArgs(args, {});
  const setId = markPos[0];
  const stage = markPos[1];
  const verdict = markPos[2];
  if (!setId || !stage || !verdict) {
    throw new CliError('Usage: rapid-tools review mark-stage <set-id> <stage> <verdict>');
  }
  try {
    const updated = review.markStageComplete(cwd, setId, stage, verdict);
    output(JSON.stringify({ marked: true, stage, verdict, setId }));
  } catch (err) {
    throw new CliError(err.message);
  }
  break;
}
```

### 1c: Update the default error message

Update the default case error message to include the new subcommands:

Change:
```
Unknown review subcommand: ${subcommand}. Use: scope, log-issue, list-issues, update-issue, lean, summary
```
To:
```
Unknown review subcommand: ${subcommand}. Use: scope, log-issue, list-issues, update-issue, lean, summary, state, mark-stage
```

**Verification:**
```bash
node src/bin/rapid-tools.cjs review state test-set 2>&1 | head -5
```

## Task 2: Add CLI subcommand tests

**File:** `src/commands/review.test.cjs`

Add test groups at the end of the file using the existing `setupTestProject` helper and `parseOutput` function.

### 2a: `review state` tests

```
describe('review state', () => {
  it('returns no-state message when REVIEW-STATE.json does not exist');
  it('returns stage table when REVIEW-STATE.json exists');
});
```

For the "exists" test:
- Create a valid `REVIEW-STATE.json` in the test project's `.planning/sets/{setId}/` directory
- Run `node ${CLI_PATH} review state {setId}` with `cwd` set to the test project
- Parse output and assert `stages` array has 4 entries with correct status/verdict values

### 2b: `review mark-stage` tests

```
describe('review mark-stage', () => {
  it('creates state and marks scope complete');
  it('rejects mark-stage with missing args');
  it('rejects uat without unit-test prerequisite');
});
```

For the prerequisite test:
- Mark scope complete first
- Attempt to mark uat without unit-test
- Assert the command exits with non-zero and error message contains "unit-test"

**Verification:**
```bash
node --test src/commands/review.test.cjs
```

## Task 3: Update review SKILL.md (scope stage)

**File:** `skills/review/SKILL.md`

### 3a: Add state check after Step 0d (before Step 1)

Insert a new section `### 0e: Check Review State` between the existing Step 0d ("Validate review eligibility") and Step 1 ("Scope Set Files").

Content:

```markdown
### 0e: Check Review State

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Check if a review has already been started for this set:

\`\`\`bash
REVIEW_STATE=$(node "${RAPID_TOOLS}" review state "${SET_NAME}" 2>&1)
\`\`\`

Parse the JSON output. If the response contains a `stages` array (not the "no review state" message), check if the `scope` stage has `status: "complete"`:

If scope is already complete, use **AskUserQuestion** to prompt:
- **question:** "Review scope has already been completed for this set (verdict: {verdict}). What would you like to do?"
- **options:** ["Re-run scope (overwrites existing)", "Skip scope and exit"]

If user chooses "Skip scope and exit": print "Scope already complete. Use /rapid:unit-test, /rapid:bug-hunt, or /rapid:uat to continue the review pipeline." and exit.

If user chooses "Re-run scope": continue to Step 1.

If no review state exists or scope is not complete: continue to Step 1 (no prompt).
```

### 3b: Add state write before completion banner (before Step 5)

Insert a new section `### Step 4b: Record Scope Completion` between Step 4 ("Generate REVIEW-SCOPE.md") and Step 5 ("Completion Banner").

Content:

```markdown
### Step 4b: Record Scope Completion

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Mark the scope stage as complete:

\`\`\`bash
node "${RAPID_TOOLS}" review mark-stage "${SET_NAME}" scope pass
\`\`\`

The scope stage always records verdict `pass` because scoping itself cannot fail -- if we reached this point, the scope was successfully generated.
```

**What NOT to do:**
- Do not modify any other part of the skill file
- Do not add conditional logic around the mark-stage call -- it is idempotent

## Task 4: Update unit-test SKILL.md

**File:** `skills/unit-test/SKILL.md`

### 4a: Add state check after Step 0b (after set resolution, before Step 1)

Insert a new section `### 0d: Check Review State` between Step 0b and Step 1.

Content:

```markdown
### 0d: Check Review State

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Check if unit-test has already been completed for this set:

\`\`\`bash
REVIEW_STATE=$(node "${RAPID_TOOLS}" review state "${SET_NAME}" 2>&1)
\`\`\`

Parse the JSON output. If the response contains a `stages` array, find the `unit-test` entry.

**If unit-test is already complete** (status: "complete"), use **AskUserQuestion** to prompt:
- **question:** "Unit test stage has already been completed for this set (verdict: {verdict}). What would you like to do?"
- **options:** ["Re-run unit tests", "Skip and exit"]

If user chooses "Skip and exit": print "Unit test stage already complete." and exit.
If user chooses "Re-run unit tests": continue to Step 1.

**If scope is not complete** (scope entry missing or status not "complete") and `POST_MERGE` is not set:
- Print error: "Cannot run unit tests: scope stage has not been completed. Run /rapid:review {set-id} first."
- Exit. Do NOT continue.

If no review state exists and `POST_MERGE` is not set:
- Print error: "Cannot run unit tests: no review state found. Run /rapid:review {set-id} first."
- Exit.
```

### 4b: Add state write before completion banner

Insert a new section `### Step 7b: Record Unit Test Completion` before Step 8 ("Completion Banner").

Content:

```markdown
### Step 7b: Record Unit Test Completion

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Determine the verdict based on test results:
- All tests passed: verdict is `pass`
- Some tests failed: verdict is `partial`
- All tests failed or critical failures: verdict is `fail`

Mark the unit-test stage as complete:

\`\`\`bash
node "${RAPID_TOOLS}" review mark-stage "${SET_NAME}" unit-test {verdict}
\`\`\`

Where `{verdict}` is one of `pass`, `fail`, or `partial` based on the test results above.
```

## Task 5: Update bug-hunt SKILL.md

**File:** `skills/bug-hunt/SKILL.md`

### 5a: Add state check after Step 0b (after set resolution, before Step 1)

Insert a new section `### 0d: Check Review State` using the same pattern as Task 4a, but checking for `bug-hunt` stage instead of `unit-test`. The prerequisite check is the same: scope must be complete (but unit-test is NOT required for bug-hunt).

Content follows the same template as Task 4a with these substitutions:
- Stage name: `bug-hunt` instead of `unit-test`
- AskUserQuestion question: "Bug hunt stage has already been completed for this set (verdict: {verdict}). What would you like to do?"
- Options: ["Re-run bug hunt", "Skip and exit"]
- Skip message: "Bug hunt stage already complete."
- Prerequisite error: "Cannot run bug hunt: scope stage has not been completed. Run /rapid:review {set-id} first."
- No-state error: "Cannot run bug hunt: no review state found. Run /rapid:review {set-id} first."

### 5b: Add state write at the end of the pipeline

The bug-hunt SKILL.md does not have a clearly numbered final step like the others. Insert a new section `### Record Bug Hunt Completion` immediately before the `## Important Notes` section (before line 452).

Content:

```markdown
### Record Bug Hunt Completion

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Determine the verdict based on bug hunt results:
- No accepted bugs found: verdict is `pass`
- Accepted bugs found but all auto-fixed: verdict is `pass`
- Accepted bugs found, some unfixed: verdict is `partial`
- Critical bugs found and unfixed: verdict is `fail`

Mark the bug-hunt stage as complete:

\`\`\`bash
node "${RAPID_TOOLS}" review mark-stage "${SET_NAME}" bug-hunt {verdict}
\`\`\`
```

## Task 6: Update uat SKILL.md

**File:** `skills/uat/SKILL.md`

### 6a: Add state check after Step 0b (after set resolution, before Step 1)

Insert a new section `### 0d: Check Review State` using the same pattern as Task 4a, but checking for `uat` stage. The prerequisite check is stricter: BOTH scope AND unit-test must be complete.

Content follows the same template as Task 4a with these substitutions:
- Stage name: `uat` instead of `unit-test`
- AskUserQuestion question: "UAT stage has already been completed for this set (verdict: {verdict}). What would you like to do?"
- Options: ["Re-run UAT", "Skip and exit"]
- Skip message: "UAT stage already complete."
- **Two prerequisite checks** (check scope first, then unit-test):
  - Scope prerequisite error: "Cannot run UAT: scope stage has not been completed. Run /rapid:review {set-id} first."
  - Unit-test prerequisite error: "Cannot run UAT: unit-test stage has not been completed. Run /rapid:unit-test {set-id} first."
- No-state error: "Cannot run UAT: no review state found. Run /rapid:review {set-id} first."

### 6b: Add state write before completion banner

Insert a new section `### Step 9b: Record UAT Completion` before Step 10 ("Completion Banner").

Content:

```markdown
### Step 9b: Record UAT Completion

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Determine the verdict based on UAT results:
- All scenarios passed and all criteria covered: verdict is `pass`
- Some scenarios failed or criteria not fully covered: verdict is `partial`
- Critical failures or major criteria gaps: verdict is `fail`

Mark the UAT stage as complete:

\`\`\`bash
node "${RAPID_TOOLS}" review mark-stage "${SET_NAME}" uat {verdict}
\`\`\`
```

## Success Criteria

1. `rapid-tools review state <set-id>` outputs JSON with stage/status/verdict table or "no review state" message
2. `rapid-tools review mark-stage <set-id> <stage> <verdict>` creates/updates REVIEW-STATE.json correctly
3. Prerequisite errors from `mark-stage` propagate as CliError with actionable messages
4. All four SKILL.md files have entry-point state checks with AskUserQuestion skip/re-run prompts
5. All four SKILL.md files have exit-point state writes via `review mark-stage`
6. Post-merge mode skips all state operations in all skills
7. All new and existing tests pass: `node --test src/commands/review.test.cjs`
8. All existing tests still pass: `node --test src/lib/review.test.cjs`
