---
description: Run unit test pipeline on a scoped set -- reads REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion, Glob, Grep
---

# /rapid:unit-test -- Unit Test Pipeline

You are the RAPID unit test skill. This skill runs the unit test pipeline on a scoped set. It reads `REVIEW-SCOPE.md` (produced by `/rapid:review`) as its input. Follow these steps IN ORDER. Do not skip steps. Do NOT include stage selection prompting, bug hunt logic, or UAT logic.

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
node "${RAPID_TOOLS}" display banner unit-test
```

### 0c: Load test runner config

```bash
# Load testFrameworks from config.json
CONFIG_PATH=".planning/config.json"
if [ -f "$CONFIG_PATH" ]; then
  TEST_FRAMEWORKS=$(node -e "const c=JSON.parse(require('fs').readFileSync('$CONFIG_PATH','utf-8')); console.log(JSON.stringify(c.testFrameworks || []))")
else
  TEST_FRAMEWORKS="[]"
fi
```

The skill uses `TEST_FRAMEWORKS` to select the appropriate runner for each file being tested. Runner selection logic:
1. Determine the file's language from its extension (.js/.cjs/.mjs/.ts/.tsx -> javascript/typescript, .py -> python, .go -> go, .rs -> rust)
2. Find the matching entry in `TEST_FRAMEWORKS` by `lang`
3. If found, use that entry's `runner` and `framework`
4. If not found (no config entry for this language), the agent autonomously picks the best test framework for that language

### 0b: Parse arguments

The user invokes this skill with: `/rapid:unit-test <set-id>` or numeric shorthand like `/rapid:unit-test 1`.

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
- **question:** "Which set to run unit tests for?"
- **options:** List available sets from STATE.json by running:
  ```bash
  node "${RAPID_TOOLS}" state get --all
  ```

#### Detect `--post-merge` flag

Check if the user invoked with `--post-merge` flag: `/rapid:unit-test <set-id> --post-merge`

If `--post-merge` is present, set `POST_MERGE=true`. Post-merge mode reads REVIEW-SCOPE.md from the post-merge artifact directory.

### 0d: Check Review State

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Check if unit-test has already been completed for this set:

```bash
REVIEW_STATE=$(node "${RAPID_TOOLS}" review state "${SET_NAME}" 2>&1)
```

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

## Step 1: Load REVIEW-SCOPE.md

Determine the scope file path:

1. **If `POST_MERGE=true`** (explicit `--post-merge` flag was provided): Use `.planning/post-merge/{setId}/REVIEW-SCOPE.md` directly.

2. **If `POST_MERGE` is not set** (no flag): Auto-detect by checking paths in order:
   - First, try standard path: `.planning/sets/{setId}/REVIEW-SCOPE.md`
   - If not found, try post-merge path: `.planning/post-merge/{setId}/REVIEW-SCOPE.md`
   - If found at the post-merge path, set `POST_MERGE=true` so downstream artifact writes (REVIEW-UNIT.md, issue logging) use the post-merge directory.

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
Extract file paths and wave attribution from the `## Changed Files` table. Each row has `| file | wave |` format.

### Dependent Files
Extract file paths from the `## Dependent Files` table.

### Directory Chunks
Extract chunks from `## Directory Chunks` section. Each chunk is a `### Chunk N: dirName` subsection with bulleted file lists.

### Concern Scoping
If `useConcernScoping` is true in SCOPE-META, parse the `## Concern Scoping` section:
- Extract concern groups (each `### ConcernName` subsection with file lists)
- Extract cross-cutting files from `### Cross-Cutting Files`
- Build concern groups: for each concern, the file list is the concern's own files PLUS all cross-cutting files

### Acceptance Criteria
Extract criteria from the `## Acceptance Criteria` numbered list.

## Step 3: Unit Test Plan Generation

Determine the agent dispatch strategy based on scope:

### If concern scoping is active (`useConcernScoping = true`):
- Dispatch concern groups in batches. Batch size = `ceil(totalGroups / 3)` (always approximately 3 batches regardless of group count).
- For each batch:
  1. Spawn one `rapid-unit-tester` agent per concern group in the batch
  2. Collect results from all agents in the batch
  3. If all tests in the batch passed, auto-continue to the next batch
  4. If any test in the batch failed, use AskUserQuestion:
     - **question:** "Batch {N}/{totalBatches} has {failedCount} test failure(s). Continue to next batch or stop to review?"
     - **options:** ["Continue to next batch", "Stop and review failures"]
     - If "Stop": proceed to Step 5a retry flow with the failures so far
  5. After the final batch completes, merge all batch results and continue to Step 4
- Each agent receives the concern group's files (concern files + cross-cutting files)
- Agent ID format: `unit-test-{concernName}` (kebab-case concern name)

### If fallback / no concern scoping:
- If 1 or fewer directory chunks: spawn a single `rapid-unit-tester` agent with all files
- If multiple directory chunks: spawn one `rapid-unit-tester` agent per directory chunk
- Agent ID format: `unit-test-chunk-{N}`

**Agent prompt template for each agent:**

```
Unit test set '{setId}' -- {concern/chunk description}.

## Files to Test
{file list for this concern/chunk}

## Working Directory
{worktreePath from SCOPE-META, or cwd if post-merge}

## Acceptance Criteria
{relevant acceptance criteria}

## Instructions
1. Read all files in your scope
2. Generate a test plan: for each file, list what functions/behaviors to test
3. Return the test plan via:
<!-- RAPID:RETURN {"status":"COMPLETE","phase":"plan","data":{"testPlan":[...]}} -->

Each test plan entry should include:
- file: the file path
- tests: array of { name, description, type } where type is 'unit' or 'integration'
```

Collect test plans from all agents. Merge into a combined test plan.

## Step 4: Present Test Plan for Approval

Display the combined test plan grouped by concern/chunk:

```
--- Unit Test Plan ---
Set: {setId}
Total tests: {count}

[Concern/Chunk 1: name]
  - file.cjs: testFunctionA (unit), testFunctionB (unit)

[Concern/Chunk 2: name]
  - other.cjs: testIntegration (integration)
-----------------------
```

Use AskUserQuestion to present the plan:
- **question:** "Approve the unit test plan?"
- **options:** ["Approve", "Modify", "Skip"]

- **Approve:** Proceed to Step 5
- **Modify:** Ask user for modifications, update the plan, re-display
- **Skip:** Skip to Step 8 with empty results

## Step 5: Execute Tests

Spawn `rapid-unit-tester` agents for the execution phase. Use the same dispatch strategy as Step 3 (concern-scoped or chunk-scoped).

**Agent prompt template for execution:**

```
Execute unit tests for set '{setId}' -- {concern/chunk description}.

## Files to Test
{file list}

## Test Plan
{approved test plan for this concern/chunk}

## Working Directory
{worktreePath or cwd}

## Instructions
1. Write test files using the `{framework}` framework
2. Test file naming: `{originalFile}.test.{ext}` in the same directory (use the appropriate extension for the language: .cjs for JS, .test.py for Python, _test.go for Go, etc.)
3. Run tests with: {runner} {testFile}
4. Return results via:
<!-- RAPID:RETURN {"status":"COMPLETE","phase":"execute","data":{"results":[{"file":"...","testFile":"...","passed":N,"failed":N,"errors":[]}]}} -->
```

Merge results across all agents/chunks/concerns.

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
4. Re-run each fixed test with: {runner} {testFile}
5. Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"results":[{"file":"...","testFile":"...","passed":N,"failed":N,"errors":[]}]}} -->
```

2. Merge the retry results with the previous passing results (replace entries for retried test files)
3. Increment `retryCount`
4. If failures remain and `retryCount < 2`, loop back to the top of Step 5a (display summary and ask again)
5. If failures remain and `retryCount >= 2`, proceed to Step 6 with the best results achieved

**If user chooses "Accept results as-is":** Proceed to Step 6 with the current results.

## Step 6: Write REVIEW-UNIT.md

Write the unit test results to:

- **Standard mode:** `.planning/sets/{setId}/REVIEW-UNIT.md`
- **Post-merge mode:** `.planning/post-merge/{setId}/REVIEW-UNIT.md`

This write is idempotent -- if REVIEW-UNIT.md already exists, overwrite it.

Format:

```markdown
# REVIEW-UNIT: {setId}

## Summary
| Metric | Value |
|--------|-------|
| Total Tests | {count} |
| Passed | {passed} |
| Failed | {failed} |
| Coverage | {concern/chunk count} concern groups |

## Results by Concern/Chunk

### {ConcernName / Chunk N}

| Test File | Passed | Failed | Errors |
|-----------|--------|--------|--------|
| `file.test.cjs` | 5 | 1 | Error message |

## Failed Tests

### {TestName}
- **File:** `path/to/file.test.cjs`
- **Error:** Error description
- **Severity:** high/medium/low

## Test Files Created
- `path/to/file.test.cjs`
```

## Step 7: Log Issues

For each failed test, log an issue using the `review log-issue` CLI command.

**CLI Flags (recommended):**
```bash
node "${RAPID_TOOLS}" review log-issue "{setId}" \
  --type "test" \
  --severity "{severity}" \
  --file "{testFile}" \
  --description "{test failure description}" \
  --source "unit-test"
```

**Stdin JSON alternative:**
```bash
echo '{"id":"<uuid>","type":"test","severity":"{severity}","file":"{testFile}","description":"{test failure description}","source":"unit-test","createdAt":"<iso-timestamp>"}' | \
  node "${RAPID_TOOLS}" review log-issue "{setId}"
```

The CLI flag interface auto-generates `id` and `createdAt`. The stdin JSON interface requires all fields including `id` and `createdAt`.

If in post-merge mode, issues are logged to `.planning/post-merge/{setId}/REVIEW-ISSUES.json`.

### Step 7b: Record Unit Test Completion

**If `POST_MERGE=true`:** Skip this step. Post-merge reviews do not track pipeline state.

Determine the verdict based on test results:
- All tests passed: verdict is `pass`
- Some tests failed: verdict is `partial`
- All tests failed or critical failures: verdict is `fail`

Mark the unit-test stage as complete:

```bash
node "${RAPID_TOOLS}" review mark-stage "${SET_NAME}" unit-test {verdict}
```

Where `{verdict}` is one of `pass`, `fail`, or `partial` based on the test results above.

## Step 8: Completion Banner

Print the completion banner:

```
--- RAPID Unit Test Complete ---
Set: {setId}{postMerge ? ' (post-merge)' : ''}
Tests: {passed}/{total} passed
Failed: {failed}
Issues Logged: {issueCount}

Output: {path to REVIEW-UNIT.md}

Next steps:
  /rapid:bug-hunt {setIndex}   -- Run adversarial bug hunt
  /rapid:uat {setIndex}        -- Run user acceptance testing
  /rapid:review summary {setIndex} -- Generate review summary
---------------------------------
```

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:bug-hunt {setIndex}" --breadcrumb "review [done] > unit-test [done] > bug-hunt > uat"
```

Then exit. Do NOT prompt for stage selection.

## Important Notes

- **Each agent runs in its own context.** Agents do not share state -- each receives its file list and returns structured results. The skill merges results across agents.
- **Concern groups include cross-cutting files.** When concern scoping is active, each concern group's file list includes the concern's own files PLUS all cross-cutting files from the scoper output.
- **Idempotent overwrite.** Re-running `/rapid:unit-test` overwrites REVIEW-UNIT.md and any test files. Previous results are not accumulated.
- **Framework-agnostic test runner.** The test framework is auto-detected during `/rapid:init` and stored in `.planning/config.json` under `testFrameworks`. Each language uses its configured runner (e.g., `node --test` for JS, `pytest` for Python, `cargo test` for Rust, `go test` for Go). If no configuration exists for a language, the agent autonomously selects the best framework for that language.
- **REVIEW-SCOPE.md is the sole input.** This skill does not scope files itself -- it reads the scope produced by `/rapid:review`. If the scope is stale, re-run `/rapid:review` first.
- **No stage selection.** This skill runs unit tests only. It does not prompt the user to select bug hunt or UAT.
- **Retry on failure with confirmation.** When test execution produces failures, the user is prompted to retry or accept. Retries spawn a fixer agent that modifies test code only (never source code under test). Maximum 2 retries (3 total attempts). The user can accept results at any point to proceed to REVIEW-UNIT.md writing.
