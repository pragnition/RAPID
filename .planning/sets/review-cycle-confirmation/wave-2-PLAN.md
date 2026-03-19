# Wave 2 PLAN: Unit-Test and UAT Retry Gates + CONTRACT Update

## Objective

Add retry-on-failure confirmation gates to both the unit-test and UAT skills. After test execution completes with failures, the user is prompted to either retry (with automatic test-code fixes) or accept results as-is. Also update CONTRACT.json to include `skills/uat/SKILL.md` in ownedFiles, since CONTEXT.md explicitly expanded scope to cover UAT.

## Owned Files

| File | Action |
|------|--------|
| `skills/unit-test/SKILL.md` | Modify |
| `skills/uat/SKILL.md` | Modify |
| `.planning/sets/review-cycle-confirmation/CONTRACT.json` | Modify |

## Task 1: Insert Step 5a -- Unit-Test Retry Confirmation Gate

**File:** `skills/unit-test/SKILL.md`
**Location:** Between Step 5 (Execute Tests) and Step 6 (Write REVIEW-UNIT.md)

After the paragraph `Merge results across all agents/chunks/concerns.` (end of Step 5, line 200), and before `## Step 6: Write REVIEW-UNIT.md` (line 202), insert a new step.

### Content to Insert

```markdown
## Step 5a: Retry on Failure Confirmation

**This step fires only if there are test failures** in the merged results from Step 5. If all tests passed, skip directly to Step 6.

**Retry limit:** Up to 2 retries after the initial execution (3 total attempts maximum). Track `retryCount` starting at 0.

**Display failure summary:**

```
--- Unit Test Failures ---
Passed: {passed} | Failed: {failed}
Failed tests:
  - {testFile}: {testName} -- {error summary}
```

Use AskUserQuestion:
- **question:** "Unit test execution has {failed} failure(s) out of {total} tests (attempt {retryCount + 1} of 3).\n\nRetrying will attempt to fix test code (not source code) and re-run."
- **options:** ["Retry (fix test code and re-run)", "Accept results as-is"]

**If user chooses "Retry...":**
1. Spawn a `rapid-test-fixer` agent with the failed test details:

```
Fix failing unit tests for set '{setId}' -- Retry attempt {retryCount + 1}.

## Failed Tests
{JSON array of failed test results with testFile, testName, error}

## Working Directory
{worktreePath or cwd}

## Instructions
1. Read each failing test file
2. Fix the TEST CODE ONLY -- do NOT modify the source code under test
3. Common fixes: incorrect assertions, wrong mock setup, missing test fixtures, async handling errors
4. Re-run each fixed test with: node --test {testFile}
5. Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"results":[{"file":"...","testFile":"...","passed":N,"failed":N,"errors":[]}]}} -->
```

2. Merge the retry results with the previous passing results (replace entries for retried test files)
3. Increment `retryCount`
4. If failures remain and `retryCount < 2`, loop back to the top of Step 5a (display summary and ask again)
5. If failures remain and `retryCount >= 2`, proceed to Step 6 with the best results achieved

**If user chooses "Accept results as-is":** Proceed to Step 6 with the current results.
```

### Verification

- Read `skills/unit-test/SKILL.md` and confirm Step 5a exists between Steps 5 and 6
- Confirm it checks for failures before activating
- Confirm retry limit is 2 (3 total attempts)
- Confirm the fixer agent prompt specifies "fix TEST CODE ONLY -- do NOT modify the source code under test"
- Confirm AskUserQuestion has exactly two options

## Task 2: Add Unit-Test Important Note

**File:** `skills/unit-test/SKILL.md`
**Location:** The `## Important Notes` section at the bottom (lines 281-289)

Add a new bullet to the Important Notes section:

```markdown
- **Retry on failure with confirmation.** When test execution produces failures, the user is prompted to retry or accept. Retries spawn a fixer agent that modifies test code only (never source code under test). Maximum 2 retries (3 total attempts). The user can accept results at any point to proceed to REVIEW-UNIT.md writing.
```

### Verification

- Read `## Important Notes` and confirm the new bullet exists
- Confirm it mentions "test code only" and "3 total attempts"

## Task 3: Insert Step 7a -- UAT Retry Confirmation Gate

**File:** `skills/uat/SKILL.md`
**Location:** Between the `### Handle CHECKPOINT Returns` subsection (end of Step 7, around line 243) and `## Step 8: Write REVIEW-UAT.md` (line 245)

After the CHECKPOINT handling block and before Step 8, insert a new step. The retry gate for UAT applies only to automated scenario failures -- human "Fail" verdicts from CHECKPOINT resolution are final and not eligible for retry.

### Content to Insert

```markdown
## Step 7a: Retry on Failure Confirmation

**This step fires only if there are automated scenario failures** in the execution results from Step 7. Human verification failures (scenarios where the user marked "Fail" during CHECKPOINT resolution) are NOT eligible for retry -- those verdicts are final. If all automated scenarios passed (or there are only human failures), skip directly to Step 8.

**Retry limit:** Up to 2 retries after the initial execution (3 total attempts maximum). Track `retryCount` starting at 0.

**Display failure summary:**

```
--- UAT Automated Failures ---
Passed: {passed} | Failed (automated): {failedAuto} | Failed (human): {failedHuman}
Failed automated scenarios:
  - {scenario name}: {failure detail}
```

Use AskUserQuestion:
- **question:** "UAT execution has {failedAuto} automated scenario failure(s) (attempt {retryCount + 1} of 3).\n\n{failedHuman > 0 ? failedHuman + ' human-verified failure(s) are final and will not be retried.\n\n' : ''}Retrying will attempt to fix test code and re-run failed automated scenarios."
- **options:** ["Retry (fix test code and re-run)", "Accept results as-is"]

**If user chooses "Retry...":**
1. Spawn a `rapid-uat-fixer` agent with the failed automated scenario details:

```
Fix failing UAT automated scenarios for set '{setId}' -- Retry attempt {retryCount + 1}.

## Failed Automated Scenarios
{JSON array of failed automated scenario results}

## Working Directory
{worktreePath or cwd}

## Browser Automation
{browserConfig}

## Instructions
1. Review each failing automated scenario
2. Fix the TEST CODE ONLY -- do NOT modify the source code under test
3. Re-run the fixed scenarios
4. Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"results":[{"name":"...","criterion":"...","type":"automated","status":"pass|fail","steps":[...],"notes":"..."}]}} -->
```

2. Merge the retry results with the previous results (replace entries for retried scenarios; keep human-verified results unchanged)
3. Increment `retryCount`
4. If automated failures remain and `retryCount < 2`, loop back to the top of Step 7a
5. If automated failures remain and `retryCount >= 2`, proceed to Step 8 with the best results achieved

**If user chooses "Accept results as-is":** Proceed to Step 8 with the current results.
```

### Verification

- Read `skills/uat/SKILL.md` and confirm Step 7a exists between Step 7 CHECKPOINT handling and Step 8
- Confirm it only retries automated failures (human verdicts are explicitly excluded)
- Confirm retry limit is 2 (3 total attempts)
- Confirm the fixer agent prompt specifies "fix TEST CODE ONLY"
- Confirm AskUserQuestion has exactly two options

## Task 4: Add UAT Important Note

**File:** `skills/uat/SKILL.md`
**Location:** The `## Important Notes` section at the bottom (lines 342-351)

Add a new bullet to the Important Notes section:

```markdown
- **Retry on failure with confirmation.** When automated scenario execution produces failures, the user is prompted to retry or accept. Retries spawn a fixer agent that modifies test code only (never source code under test). Maximum 2 retries (3 total attempts). Human verification failures (user marked "Fail" during CHECKPOINT) are final and never retried. The user can accept results at any point to proceed to REVIEW-UAT.md writing.
```

### Verification

- Read `## Important Notes` and confirm the new bullet exists
- Confirm it mentions human failures are final and not retried

## Task 5: Update CONTRACT.json Owned Files

**File:** `.planning/sets/review-cycle-confirmation/CONTRACT.json`
**Location:** The `definition.ownedFiles` array (line 29-32)

Add `skills/uat/SKILL.md` to the `ownedFiles` array. Also add a new task entry for the UAT retry gate.

### Changes

Update `ownedFiles` from:
```json
"ownedFiles": [
  "skills/bug-hunt/SKILL.md",
  "skills/unit-test/SKILL.md"
]
```

To:
```json
"ownedFiles": [
  "skills/bug-hunt/SKILL.md",
  "skills/unit-test/SKILL.md",
  "skills/uat/SKILL.md"
]
```

Add a new task entry to the `tasks` array:
```json
{ "description": "Add retry-on-failure confirmation to UAT skill", "acceptance": "UAT prompts user before retrying automated failures" }
```

Add `"UAT prompts for retry confirmation on automated failures"` to the `acceptance` array.

### Verification

- Read CONTRACT.json and confirm `skills/uat/SKILL.md` is in ownedFiles
- Confirm the new task entry exists
- Confirm the new acceptance criterion exists

## Success Criteria

1. Step 5a exists in unit-test SKILL.md between Steps 5 and 6
2. Step 7a exists in UAT SKILL.md between Step 7 CHECKPOINT handling and Step 8
3. Both retry gates fire only on failures, with 2-retry limit (3 total attempts)
4. Both retry gates use AskUserQuestion with "Retry" and "Accept" options
5. Both fixer agents are instructed to fix test code only, never source code
6. UAT retry gate explicitly excludes human verification failures from retry
7. Important Notes sections in both skills document the retry behavior
8. CONTRACT.json includes `skills/uat/SKILL.md` in ownedFiles
9. CONTRACT.json has a task entry and acceptance criterion for UAT retry
