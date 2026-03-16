---
description: Run user acceptance testing on a scoped set -- reads REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion, Glob, Grep
---

# /rapid:uat -- User Acceptance Testing

You are the RAPID UAT skill. This skill runs user acceptance testing on a scoped set. It reads `REVIEW-SCOPE.md` (produced by `/rapid:review`) as its input. UAT runs ONCE on the full scope -- it is never chunked or concern-scoped. Follow these steps IN ORDER. Do not skip steps. Do NOT include stage selection prompting, unit test logic, or bug hunt logic.

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

## Step 4: Determine Browser Automation Tool

Check if a browser automation tool is configured:

```bash
# Check .planning/config.json for browser automation preference
if [ -f ".planning/config.json" ]; then
  BROWSER_TOOL=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('.planning/config.json','utf-8'));console.log(c.browserAutomation||'')}catch{console.log('')}")
fi
```

If `BROWSER_TOOL` is not set or empty, use AskUserQuestion:
- **question:** "Which browser automation tool should UAT use for automated UI tests (if applicable)?"
- **options:** ["Chrome DevTools MCP", "Playwright MCP", "Skip automated browser tests"]

Store the choice as `browserConfig`:
- `"chrome-devtools"` -- Use Chrome DevTools Protocol via MCP
- `"playwright"` -- Use Playwright browser automation via MCP
- `"none"` -- Skip browser-based automated tests; all UI tests are tagged as human verification

## Step 5: Spawn UAT Agent -- Test Plan Phase

Spawn a single `rapid-uat` agent with the full scope:

```
User acceptance testing for set '{setId}' -- Test Plan Phase.

## All Changed Files
{complete list of changed files}

## All Dependent Files
{complete list of dependent files}

## Acceptance Criteria
{numbered list of acceptance criteria with wave attribution}

## Set Context
{CONTEXT.md content if available, or 'No additional context available.'}

## Browser Automation
{browserConfig: chrome-devtools | playwright | none}

## Working Directory
{worktreePath from SCOPE-META, or cwd if post-merge}

## Instructions
Generate a comprehensive UAT test plan based on the acceptance criteria.

For each acceptance criterion:
1. Create one or more test scenarios
2. For each scenario, specify:
   - name: descriptive test name
   - criterion: which acceptance criterion it validates (e.g., "[wave-1] Criterion text")
   - type: "automated" or "human" (use "human" for subjective or visual tests, or if browser automation is "none" for UI tests)
   - steps: ordered list of test steps
   - expected: expected outcome
   - files: which source files are relevant

Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","phase":"plan","data":{"testPlan":[{"name":"...","criterion":"...","type":"automated|human","steps":["..."],"expected":"...","files":["..."]}]}} -->
```

## Step 6: Present Test Plan for Approval

Display the test plan with automated/human tags:

```
--- UAT Test Plan ---
Set: {setId}
Total Scenarios: {count}
Automated: {autoCount} | Human Verification: {humanCount}

[automated] Scenario 1: {name}
  Criterion: {criterion}
  Steps: {step count} steps
  Files: {file list}

[human] Scenario 2: {name}
  Criterion: {criterion}
  Steps: {step count} steps

---------------------
```

Use AskUserQuestion to present the plan:
- **question:** "Approve the UAT test plan?"
- **options:** ["Approve", "Modify tags", "Skip"]

- **Approve:** Proceed to Step 7
- **Modify tags:** Allow user to change automated/human tags on specific scenarios. Re-display and re-ask.
- **Skip:** Skip to Step 8 with empty results

## Step 7: Spawn UAT Agent -- Execution Phase

Spawn a single `rapid-uat` agent for execution:

```
User acceptance testing for set '{setId}' -- Execution Phase.

## Approved Test Plan
{JSON of approved test plan}

## Browser Automation
{browserConfig}

## Working Directory
{worktreePath or cwd}

## Instructions
Execute the approved test plan:

For AUTOMATED scenarios:
1. Execute the test steps programmatically
2. If browser automation is configured, use it for UI-related tests
3. Record pass/fail for each step
4. Capture error details for failures

For HUMAN verification scenarios:
1. Describe what the human tester should verify
2. Return with status CHECKPOINT for each human verification step
3. Wait for the skill to relay the human's response

Return via:
<!-- RAPID:RETURN {"status":"COMPLETE|CHECKPOINT","data":{"results":[{"name":"...","criterion":"...","type":"...","status":"pass|fail|pending-human","steps":[{"step":"...","status":"pass|fail|skipped","error":"..."}],"notes":"..."}],"pendingHuman":[{"name":"...","description":"..."}]}} -->
```

### Handle CHECKPOINT Returns

If the agent returns with `CHECKPOINT` status and `pendingHuman` entries:
- For each pending human verification:
  - Use AskUserQuestion:
    - **question:** "Human verification needed:\n\n**{scenario name}**\n{description}\n\nDoes this pass acceptance?"
    - **options:** ["Pass", "Fail", "Skip"]
  - Record the human's response
- Resume the agent with human verification results, or compile final results if all human steps are resolved

## Step 8: Write REVIEW-UAT.md

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
| Human Verified | {humanCount} |
| Browser Automation | {browserConfig} |

## Criteria Coverage
| Criterion | Scenarios | Status |
|-----------|-----------|--------|
| [wave-1] Criterion text | 2 | PASS |
| [wave-2] Criterion text | 1 | FAIL |

## Scenario Results

### PASS: {scenario name}
- **Criterion:** {criterion}
- **Type:** automated
- **Steps:** {passed}/{total}

### FAIL: {scenario name}
- **Criterion:** {criterion}
- **Type:** human
- **Steps:** {passed}/{total}
- **Failed Steps:**
  - Step 3: {step description} -- {error}

## Failed Scenarios Detail

### {scenario name}
- **Criterion:** {criterion}
- **Error:** {error description}
- **Relevant Files:** {file list}
```

## Step 9: Log Failed Steps

For each failed UAT scenario, log an issue:

```bash
node "${RAPID_TOOLS}" review log-issue \
  --set-id "{setId}" \
  --type "uat" \
  --severity "{severity based on criterion importance}" \
  --file "{primary relevant file}" \
  --description "UAT failure: {scenario name} -- {failure detail}" \
  --source "uat"
```

Severity heuristic:
- Failed criterion from wave-1 (core functionality) -> high
- Failed criterion from later waves -> medium
- Skipped scenarios -> low

If in post-merge mode, issues are logged to `.planning/post-merge/{setId}/REVIEW-ISSUES.json`.

## Step 10: Completion Banner

Print the completion banner:

```
--- RAPID UAT Complete ---
Set: {setId}{postMerge ? ' (post-merge)' : ''}
Scenarios: {passed}/{total} passed
Failed: {failed}
Human Verified: {humanCount}
Criteria Coverage: {coveredCriteria}/{totalCriteria}
Issues Logged: {issueCount}

Output: {path to REVIEW-UAT.md}

Next steps:
  /rapid:unit-test {setIndex}  -- Run unit tests
  /rapid:bug-hunt {setIndex}   -- Run adversarial bug hunt
  /rapid:review summary {setIndex} -- Generate review summary
----------------------------
```

Then exit. Do NOT prompt for stage selection.

## Important Notes

- **UAT runs ONCE on full scope.** Unlike unit tests and bug hunt, UAT is never chunked or concern-scoped. It evaluates the entire set holistically against acceptance criteria. This is by design -- acceptance criteria span the whole set.
- **Acceptance criteria are the primary input.** The test plan is generated from the acceptance criteria extracted from wave PLAN.md files. Each criterion maps to one or more test scenarios.
- **Human verification is first-class.** Some acceptance criteria require subjective evaluation. The skill supports CHECKPOINT returns from the UAT agent to pause for human verification.
- **Browser automation is optional.** The skill asks for browser tool preference on first run. If no browser tool is configured, all UI tests are tagged as human verification.
- **Idempotent overwrite.** Re-running `/rapid:uat` overwrites REVIEW-UAT.md. Previous UAT results are not accumulated.
- **REVIEW-SCOPE.md is the sole input.** This skill does not scope files itself -- it reads the scope produced by `/rapid:review`. If the scope is stale, re-run `/rapid:review` first.
- **No stage selection.** This skill runs UAT only. It does not prompt the user to select unit test or bug hunt stages.
