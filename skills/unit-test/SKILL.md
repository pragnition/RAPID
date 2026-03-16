---
description: Run unit test pipeline on a scoped set -- reads REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion, Glob, Grep
---

# /rapid:unit-test -- Unit Test Pipeline

You are the RAPID unit test skill. This skill runs the unit test pipeline on a scoped set. It reads `REVIEW-SCOPE.md` (produced by `/rapid:review`) as its input. Follow these steps IN ORDER. Do not skip steps. Do NOT include stage selection prompting, bug hunt logic, or UAT logic.

## Step 0: Environment + Set Resolution

### 0a: Load environment

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

### Display Stage Banner

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner unit-test
```

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

## Step 1: Load REVIEW-SCOPE.md

Determine the scope file path based on mode:

- **Standard mode:** `.planning/sets/{setId}/REVIEW-SCOPE.md`
- **Post-merge mode:** `.planning/post-merge/{setId}/REVIEW-SCOPE.md`

**Guard check:** If the file does not exist, display error and STOP:

```
[RAPID ERROR] REVIEW-SCOPE.md not found for set '{setId}'.
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
- Spawn one `rapid-unit-tester` agent per concern group (up to 5 concern groups maximum)
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
1. Write test files using `node --test` framework (node:test + node:assert/strict)
2. Test file naming: `{originalFile}.test.cjs` in the same directory
3. Run tests with: node --test {testFile}
4. Return results via:
<!-- RAPID:RETURN {"status":"COMPLETE","phase":"execute","data":{"results":[{"file":"...","testFile":"...","passed":N,"failed":N,"errors":[]}]}} -->
```

Merge results across all agents/chunks/concerns.

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

For each failed test, log an issue using the `review log-issue` CLI command:

```bash
node "${RAPID_TOOLS}" review log-issue \
  --set-id "{setId}" \
  --type "test" \
  --severity "{severity}" \
  --file "{testFile}" \
  --description "{test failure description}" \
  --source "unit-test"
```

If in post-merge mode, issues are logged to `.planning/post-merge/{setId}/REVIEW-ISSUES.json`.

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

Then exit. Do NOT prompt for stage selection.

## Important Notes

- **Each agent runs in its own context.** Agents do not share state -- each receives its file list and returns structured results. The skill merges results across agents.
- **Concern groups include cross-cutting files.** When concern scoping is active, each concern group's file list includes the concern's own files PLUS all cross-cutting files from the scoper output.
- **Idempotent overwrite.** Re-running `/rapid:unit-test` overwrites REVIEW-UNIT.md and any test files. Previous results are not accumulated.
- **Uses `node --test` framework.** All tests use Node.js built-in test runner (`node:test`) with `node:assert/strict`. No external test frameworks.
- **REVIEW-SCOPE.md is the sole input.** This skill does not scope files itself -- it reads the scope produced by `/rapid:review`. If the scope is stale, re-run `/rapid:review` first.
- **No stage selection.** This skill runs unit tests only. It does not prompt the user to select bug hunt or UAT.
