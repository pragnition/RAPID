---
description: Run user acceptance testing on a scoped set -- reads REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion, Glob, Grep
---

# /rapid:uat -- User Acceptance Testing

You are the RAPID UAT skill. This skill runs user acceptance testing on a scoped set. It reads `REVIEW-SCOPE.md` (produced by `/rapid:review`) as its input. UAT runs ONCE on the full scope -- it is never chunked or concern-scoped. Follow these steps IN ORDER. Do not skip steps. Do NOT include stage selection prompting, unit test logic, or bug hunt logic.

## Step 0: Environment + Set Resolution

### 0a: Load environment

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

### Display Stage Banner

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner uat
```

### 0b: Parse arguments

The user invokes this skill with: `/rapid:uat <set-id>` or numeric shorthand like `/rapid:uat 1`.

#### Resolve Set Reference

If `<set-id>` was provided, resolve it through the numeric ID resolver:

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<set-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
SET_NAME=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
```

Use `SET_NAME` for all subsequent operations.

If `<set-id>` was not provided, use AskUserQuestion to ask:
- **question:** "Which set to run UAT for?"
- **options:** List available sets from STATE.json by running:
  ```bash
  node "${RAPID_TOOLS}" state get --all
  ```

#### Detect `--post-merge` flag

Check if the user invoked with `--post-merge` flag: `/rapid:uat <set-id> --post-merge`

If `--post-merge` is present, set `POST_MERGE=true`. Post-merge mode reads REVIEW-SCOPE.md from the post-merge artifact directory.

### 0d: Check Review State

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Check if UAT has already been completed for this set:

```bash
REVIEW_STATE=$(node "${RAPID_TOOLS}" review state "${SET_NAME}" 2>&1)
```

Parse the JSON output. If the response contains a `stages` array, find the `uat` entry.

**If uat is already complete** (status: "complete"), use **AskUserQuestion** to prompt:
- **question:** "UAT stage has already been completed for this set (verdict: {verdict}). What would you like to do?"
- **options:** ["Re-run UAT", "Skip and exit"]

If user chooses "Skip and exit": print "UAT stage already complete." and exit.
If user chooses "Re-run UAT": continue to Step 1.

**If scope is not complete** (scope entry missing or status not "complete") and `POST_MERGE` is not set:
- Print error: "Cannot run UAT: scope stage has not been completed. Run /rapid:review {set-id} first."
- Exit. Do NOT continue.

**If unit-test is not complete** (unit-test entry missing or status not "complete") and `POST_MERGE` is not set:
- Print error: "Cannot run UAT: unit-test stage has not been completed. Run /rapid:unit-test {set-id} first."
- Exit. Do NOT continue.

If no review state exists and `POST_MERGE` is not set:
- Print error: "Cannot run UAT: no review state found. Run /rapid:review {set-id} first."
- Exit.

## Step 1: Load REVIEW-SCOPE.md

Determine the scope file path:

1. **If `POST_MERGE=true`** (explicit `--post-merge` flag was provided): Use `.planning/post-merge/{setId}/REVIEW-SCOPE.md` directly.

2. **If `POST_MERGE` is not set** (no flag): Auto-detect by checking paths in order:
   - First, try standard path: `.planning/sets/{setId}/REVIEW-SCOPE.md`
   - If not found, try post-merge path: `.planning/post-merge/{setId}/REVIEW-SCOPE.md`
   - If found at the post-merge path, set `POST_MERGE=true` so downstream artifact writes (REVIEW-UAT.md, issue logging) use the post-merge directory.

**Guard check:** If neither path contains the file, display error and STOP:

```
[RAPID ERROR] REVIEW-SCOPE.md not found for set '{setId}'.
Checked: .planning/sets/{setId}/REVIEW-SCOPE.md
         .planning/post-merge/{setId}/REVIEW-SCOPE.md
Run `/rapid:review {setId}` first to generate the review scope.
```

Read the file content. Parse the `<!-- SCOPE-META {...} -->` JSON block to extract metadata:
- `setId`, `date`, `postMerge`, `worktreePath`, `totalFiles`, `useConcernScoping`

## Step 2: Parse Scope Data

Parse the following sections from REVIEW-SCOPE.md:

### Changed Files
Extract ALL file paths from the `## Changed Files` table. UAT uses the full file list.

### Dependent Files
Extract ALL file paths from the `## Dependent Files` table.

### Acceptance Criteria
Extract criteria from the `## Acceptance Criteria` numbered list. These are the primary input for UAT.

**Important:** UAT operates on the FULL scope (all changed files + all dependent files). It does NOT split by concern groups or directory chunks. This is by design -- acceptance testing evaluates the set holistically.

## Step 3: Load Context

### Acceptance Criteria
The acceptance criteria extracted in Step 2 are the primary test basis. Each criterion originates from a wave's PLAN.md and is prefixed with `[wave-N]`.

### Optional Context
If the set has a CONTEXT.md file (`.planning/sets/{setId}/CONTEXT.md`), read it to understand the set's implementation decisions and domain context. This helps the UAT agent generate more targeted test scenarios.

## Step 4: Spawn UAT Agent -- Test Plan Generation

Spawn a single `rapid-uat` agent with the full scope:

```
User acceptance testing for set '{setId}' -- Test Plan Generation.

## All Changed Files
{complete list of changed files}

## All Dependent Files
{complete list of dependent files}

## Acceptance Criteria
{numbered list of acceptance criteria with wave attribution}

## Set Context
{CONTEXT.md content if available, or 'No additional context available.'}

## Working Directory
{worktreePath from SCOPE-META, or cwd if post-merge}

## Instructions
Generate a comprehensive UAT test plan with detailed step-by-step human verification instructions for each acceptance criterion.

For each acceptance criterion:
1. Create one or more test scenarios
2. For each scenario, specify:
   - name: descriptive test name
   - criterion: which acceptance criterion it validates (e.g., "[wave-1] Criterion text")
   - steps: array of objects, each with:
     - instruction: specific human-actionable instruction (e.g., "Navigate to http://localhost:3000/login in your web portal")
     - expected: specific observable outcome (e.g., "The page displays a login form with email and password fields")
   - files: which source files are relevant

Group scenarios under the acceptance criterion they validate. Duplicate cross-cutting scenarios under each criterion they touch.

Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"testPlan":[{"name":"...","criterion":"[wave-N] ...","steps":[{"instruction":"...","expected":"..."}],"files":["..."]}]}} -->
```

## Step 5: Present Test Plan for Approval

Display the test plan summary:

```
--- UAT Test Plan ---
Set: {setId}
Total Scenarios: {count}
Total Steps: {totalSteps}

Scenario 1: {name}
  Criterion: {criterion}
  Steps: {step count} steps
  Files: {file list}

Scenario 2: {name}
  Criterion: {criterion}
  Steps: {step count} steps
  Files: {file list}

---------------------
```

Use AskUserQuestion to present the plan:
- **question:** "Approve the UAT test plan?"
- **options:** ["Approve", "Modify", "Skip"]

- **Approve:** Proceed to Step 6
- **Modify:** Allow user to request changes, re-spawn agent with modifications, re-display
- **Skip:** Skip to Step 7 (artifact writing) with empty results

## Step 6: Human Verification Loop

This is the core interaction loop. The skill drives a sequential walk through ALL steps of ALL scenarios, collecting human verdicts one at a time.

### Implementation

1. Flatten all scenarios' steps into a sequential list with metadata:
   ```
   {scenarioName, criterion, stepIndex, totalSteps, instruction, expected, files}
   ```

2. Initialize counters: `passed = 0`, `failed = 0`, `skipped = 0`, `failures = []`

3. For each step in the flattened list:

   a. Use AskUserQuestion:
      - **question:** `"Step {globalIndex}/{totalGlobalSteps} -- {criterion}\n\n**Scenario:** {scenarioName}\n\n**{instruction}**\n\nExpected: {expected}\n\nDoes this pass?"`
      - **options:** `["Pass", "Fail", "Skip", "Pass all remaining"]`

   b. On **Pass**: increment `passed`, continue to next step.

   c. On **Fail**: increment `failed`, then prompt for severity:
      - Use AskUserQuestion:
        - **question:** `"Step {globalIndex} FAILED.\n\nWhat severity level?"`
        - **options:** `["Critical", "High", "Medium", "Low"]`
      - Record the severity from the user's choice.
      - Build the failure object:
        ```json
        {
          "id": "<setId>-uat-<globalIndex>",
          "criterion": "<criterion text>",
          "step": "<instruction>",
          "description": "Expected: <expected>. Step: <instruction>",
          "severity": "<userChoice lowercase>",
          "relevantFiles": ["<files array>"],
          "userNotes": "",
          "expectedBehavior": "<expected>",
          "actualBehavior": "Failed (human reported)"
        }
        ```
      - Push the failure object to `failures` array.
      - Continue to next step.

   d. On **Skip**: increment `skipped`, continue to next step.

   e. On **Pass all remaining**: set all remaining steps to passed (add remaining count to `passed`), break the loop. This is the escape hatch for large test plans.

### Notes on AskUserQuestion
- AskUserQuestion only supports predefined options, not freeform text input.
- The `userNotes` field is set to empty string because freeform input is not available.
- The `description` field is auto-populated from the step's `instruction` and `expected` fields.
- The `actualBehavior` is set to `"Failed (human reported)"` as the default.

## Step 7: Write REVIEW-UAT.md

Write the UAT results to:

- **Standard mode:** `.planning/sets/{setId}/REVIEW-UAT.md`
- **Post-merge mode:** `.planning/post-merge/{setId}/REVIEW-UAT.md`

This write is idempotent -- if REVIEW-UAT.md already exists, overwrite it.

Format:

```markdown
# REVIEW-UAT: {setId}

## Summary
| Metric | Value |
|--------|-------|
| Total Scenarios | {count} |
| Passed | {passed} |
| Failed | {failed} |
| Skipped | {skipped} |
| Human Verified | {passed + failed + skipped} |

## Criteria Coverage
| Criterion | Scenarios | Status |
|-----------|-----------|--------|
| [wave-1] Criterion text | 2 | PASS |
| [wave-2] Criterion text | 1 | FAIL |

## Scenario Results

### PASS: {scenario name}
- **Criterion:** {criterion}
- **Steps:** {passed}/{total}

### FAIL: {scenario name}
- **Criterion:** {criterion}
- **Steps:** {passed}/{total}
- **Failed Steps:**
  - Step 3: {step description} -- {error}

## Failed Scenarios Detail

### {scenario name}
- **Criterion:** {criterion}
- **Error:** {error description}
- **Relevant Files:** {file list}
```

### Step 7b: Write UAT-FAILURES.md

**Only if `failures.length > 0`.** If there are no failures, do NOT write UAT-FAILURES.md (no file = no failures).

Write to:
- **Standard mode:** `.planning/sets/{setId}/UAT-FAILURES.md`
- **Post-merge mode:** `.planning/post-merge/{setId}/UAT-FAILURES.md`

If re-running and a previous UAT-FAILURES.md exists, overwrite it (clean overwrite).

The content follows the format locked in Wave 1:

```markdown
# UAT-FAILURES

<!-- UAT-FORMAT:v2 -->

<!-- UAT-FAILURES-META {JSON object with "failures" array} -->

## Failures

### {id}: {criterion}
- **Step:** {step instruction}
- **Severity:** {severity}
- **Description:** {description}
- **User Notes:** {userNotes, if non-empty}
```

The `<!-- UAT-FAILURES-META -->` block contains a JSON object with a `failures` array. Each failure object has these fields:
- `id`: Unique identifier (`<setId>-uat-<stepIndex>`)
- `criterion`: The acceptance criterion text
- `step`: The step instruction that failed
- `description`: Combined description (`"Expected: {expected}. Step: {instruction}"`)
- `severity`: One of `critical`, `high`, `medium`, `low`
- `relevantFiles`: Array of relevant source file paths
- `userNotes`: Empty string (freeform input not available via AskUserQuestion)
- `expectedBehavior`: The `expected` field from the step
- `actualBehavior`: `"Failed (human reported)"`

## Step 8: Log Failed Steps

For each failed UAT scenario, log an issue.

**CLI Flags (recommended):**
```bash
node "${RAPID_TOOLS}" review log-issue "{setId}" \
  --type "uat" \
  --severity "{severity from human's choice in Step 6}" \
  --file "{primary relevant file}" \
  --description "UAT failure: {scenario name} -- {failure detail}" \
  --source "uat"
```

**Stdin JSON alternative:**
```bash
echo '{"id":"<uuid>","type":"uat","severity":"{severity}","file":"{primary relevant file}","description":"UAT failure: {scenario name} -- {failure detail}","source":"uat","createdAt":"<iso-timestamp>"}' | \
  node "${RAPID_TOOLS}" review log-issue "{setId}"
```

The CLI flag interface auto-generates `id` and `createdAt`. The stdin JSON interface requires all fields including `id` and `createdAt`.

Use the severity the human selected in Step 6 for each failure. Do not apply a heuristic -- the human's verdict is authoritative.

If in post-merge mode, issues are logged to `.planning/post-merge/{setId}/REVIEW-ISSUES.json`.

### Step 8b: Record UAT Completion

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Determine the verdict based on UAT results:
- All scenarios passed and all criteria covered: verdict is `pass`
- Some scenarios failed or criteria not fully covered: verdict is `partial`
- Critical failures or major criteria gaps: verdict is `fail`

Mark the UAT stage as complete:

```bash
node "${RAPID_TOOLS}" review mark-stage "${SET_NAME}" uat {verdict}
```

## Step 9: Completion Banner

Print the completion banner:

```
--- RAPID UAT Complete ---
Set: {setId}{postMerge ? ' (post-merge)' : ''}
Scenarios: {passed}/{total} passed
Failed: {failed}
Skipped: {skipped}
Human Verified: {passed + failed + skipped}
Criteria Coverage: {coveredCriteria}/{totalCriteria}
Issues Logged: {issueCount}
Failures Logged: {failures.length}

Output: {path to REVIEW-UAT.md}

Next steps:
  /rapid:bug-hunt {setIndex}   -- Run adversarial bug hunt
  /rapid:review summary {setIndex} -- Generate review summary
----------------------------
```

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:review summary {setIndex}" --breadcrumb "review [done] > unit-test [done] > bug-hunt [done] > uat [done]"
```

Then exit. Do NOT prompt for stage selection.

## Important Notes

- **UAT runs ONCE on full scope.** Unlike unit tests and bug hunt, UAT is never chunked or concern-scoped. It evaluates the entire set holistically against acceptance criteria. This is by design -- acceptance criteria span the whole set.
- **Acceptance criteria are the primary input.** The test plan is generated from the acceptance criteria extracted from wave PLAN.md files. Each criterion maps to one or more test scenarios.
- **All testing is human-driven.** Each step is presented individually via AskUserQuestion. The "Pass all remaining" option provides an escape hatch for large test plans.
- **Idempotent overwrite.** Re-running `/rapid:uat` overwrites REVIEW-UAT.md and UAT-FAILURES.md. Previous results are not accumulated. Git history preserves previous versions.
- **REVIEW-SCOPE.md is the sole input.** This skill does not scope files itself -- it reads the scope produced by `/rapid:review`. If the scope is stale, re-run `/rapid:review` first.
- **No stage selection.** This skill runs UAT only. It does not prompt the user to select unit test or bug hunt stages.
