---
description: Review completed waves/sets -- orchestrates unit test, bug hunt, and UAT pipeline
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion
---

# /rapid:review -- Review Pipeline Orchestrator

You are the RAPID review orchestrator. This skill runs the full review pipeline on completed waves within a set: unit testing, adversarial bug hunting (hunter/advocate/judge), and user acceptance testing. The user controls which stages to run. Follow these steps IN ORDER. Do not skip steps.

## Step 0: Environment + Set Resolution

### 0a: Load environment

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

### 0b: Parse arguments

The user invokes this skill with: `/rapid:review <set-id>` (all waves) or `/rapid:review <set-id> <wave-id>` (specific wave).

If `<set-id>` was not provided, use AskUserQuestion to ask:
- **question:** "Which set to review?"
- **options:** List available sets from STATE.json by running:
  ```bash
  node "${RAPID_TOOLS}" state get --all
  ```

Parse the set-id (and optional wave-id) from the user's invocation.

### 0c: Validate set status

Read STATE.json to verify the target set exists and is in a reviewable state:

```bash
node "${RAPID_TOOLS}" state get --all
```

Parse the JSON output and find the target set. The set status MUST be `executing` or `reviewing`. If the set is in any other status (e.g., `pending`, `planning`, `discussing`):

> Cannot review set '{set-id}' -- current status is '{status}'. Set must be in 'executing' or 'reviewing' state. Run `/rapid:execute {set-id}` first.

Exit.

### 0d: Transition set to 'reviewing'

If the set is currently in `executing` state, transition it to `reviewing`:

```bash
node "${RAPID_TOOLS}" state transition set <milestone> <set-id> reviewing
```

If the set is already in `reviewing` state, skip this transition (idempotent re-entry for resuming a previous review session).

## Step 1: Stage Selection

Use AskUserQuestion to let the user choose which review stages to run:

- **question:** "Which review stages to run for set '{set-id}'?"
- **options:**
  - "All stages" -- description: "Run unit test, bug hunt, and UAT in order (recommended for first review)"
  - "Unit test only" -- description: "Generate test plan, write tests, run and report"
  - "Bug hunt only" -- description: "Static analysis with adversarial verification (hunter/advocate/judge)"
  - "UAT only" -- description: "Acceptance testing with browser automation"
  - "Unit test + Bug hunt" -- description: "Testing and bug hunting, skip UAT"
  - "Bug hunt + UAT" -- description: "Bug hunting and acceptance testing, skip unit tests"

Record the selected stages as a list. The stage order is always: unit test, then bug hunt, then UAT (regardless of selection order).

| Selection | Unit Test | Bug Hunt | UAT |
|-----------|-----------|----------|-----|
| All stages | yes | yes | yes |
| Unit test only | yes | no | no |
| Bug hunt only | no | yes | no |
| UAT only | no | no | yes |
| Unit test + Bug hunt | yes | yes | no |
| Bug hunt + UAT | no | yes | yes |

## Step 2: Resolve Waves

Determine which waves to review:

**If the user specified a wave-id:** Review only that wave.

**Otherwise:** Read STATE.json (already loaded in Step 0c) and iterate through the set's waves. Only include waves in `complete` or `reconciling` status -- skip waves that are `pending` or `executing` (they haven't finished yet).

```bash
node "${RAPID_TOOLS}" state get --all
```

Parse the set's waves and filter by status. If no reviewable waves are found:

> No reviewable waves in set '{set-id}'. All waves must be in 'complete' or 'reconciling' status. Run `/rapid:execute {set-id}` to complete pending waves.

Exit.

Build the wave list for iteration. Record total wave count for progress display.

## Step 3: For Each Wave (Sequential)

Process waves sequentially. For each wave:

### Step 3.0: Compute review scope

```bash
node "${RAPID_TOOLS}" review scope <set-id> <wave-id>
```

Parse the JSON output: `{ changedFiles, dependentFiles, totalFiles }`.

Print a banner:

```
--- RAPID Review ---
Set: {setId}
Wave: {waveId} ({index}/{total})
Scope: {totalFiles} files ({changedFiles} changed + {dependentFiles} dependents)
Stages: {selected stages, comma-separated}
--------------------
```

### Step 3a: Unit Test Stage (if selected)

Skip this step if unit testing was not selected in Step 1.

#### 3a.1: Extract acceptance criteria

Read JOB-PLAN.md files for this wave to extract acceptance criteria:

```bash
node "${RAPID_TOOLS}" wave-plan list-jobs <set-id> <wave-id>
```

Parse the JSON output to get the list of JOB-PLAN.md file paths. Read each JOB-PLAN.md file and extract acceptance criteria sections.

#### 3a.2: Spawn unit-tester subagent (test plan phase)

Spawn the unit-tester subagent via the Agent tool. Read the role module first:

```bash
cat src/modules/roles/role-unit-tester.md
```

Pass to the Agent tool:
- The role module content
- The scoped file list (from review scope in Step 3.0)
- The acceptance criteria extracted from JOB-PLAN.md files
- Instruction to generate a test plan and return it via RAPID:RETURN with `status=CHECKPOINT`

The subagent prompt should include:

```
You are a unit-tester reviewing wave '{waveId}' in set '{setId}'.

## Your Role
{content of role-unit-tester.md}

## Scoped Files
{list of files from review scope}

## Acceptance Criteria
{acceptance criteria from JOB-PLAN.md files}

## Phase 1: Test Plan Generation
Generate a test plan listing every test case. Return it via:
<!-- RAPID:RETURN {"status":"CHECKPOINT","data":{"testPlan":[{"file":"...","testCase":"...","description":"...","expectedBehavior":"..."}]}} -->
```

#### 3a.3: Present test plan for approval

Parse RAPID:RETURN from subagent output. If `status=CHECKPOINT` (test plan ready):

Display the test plan to the user in a readable format:

```
--- Unit Test Plan ---
{For each test case:}
  [{index}] {file}: {testCase}
       {description}
       Expected: {expectedBehavior}
----------------------
```

Use AskUserQuestion:
- **question:** "Approve test plan for wave {waveId}? ({N} test cases)"
- **options:**
  - "Approve" -- description: "Proceed with writing and running tests"
  - "Modify" -- description: "Describe changes to the test plan"
  - "Skip unit tests" -- description: "Skip testing for this wave"

**If "Approve":** Proceed to Step 3a.4.

**If "Modify":** Use AskUserQuestion to collect the user's modifications:
- **question:** "Describe modifications to the test plan"
Re-invoke the unit-tester subagent with the user's feedback appended to the prompt. Repeat Step 3a.3.

**If "Skip":** Move to Step 3b (bug hunt) or 3c (UAT) depending on selected stages.

#### 3a.4: Spawn unit-tester subagent (execution phase)

Re-invoke the unit-tester subagent with approval signal:

```
You are a unit-tester for wave '{waveId}' in set '{setId}'.

## Your Role
{content of role-unit-tester.md}

## Approved Test Plan
{the approved test plan}

## Phase 2: Write and Execute Tests
Write the test files according to the approved plan. Run them with `node --test`.
Return results via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"testsWritten":N,"testsPassed":N,"testsFailed":N,"output":"...","testFiles":["..."]}} -->
```

#### 3a.5: Process unit test results

Parse RAPID:RETURN from subagent output. Extract `{ testsWritten, testsPassed, testsFailed, output, testFiles }`.

Print results:

```
--- Unit Test Results ---
Wave: {waveId}
Tests written: {testsWritten}
Tests passed: {testsPassed}
Tests failed: {testsFailed}
-------------------------
```

#### 3a.6: Write REVIEW-UNIT.md

Write unit test results to `.planning/waves/{setId}/{waveId}/REVIEW-UNIT.md`:

```markdown
# Unit Test Review - Wave {waveId}

**Date:** {ISO timestamp}
**Scope:** {totalFiles} files ({changedFiles} changed + {dependentFiles} dependents)

## Summary

| Metric | Count |
|--------|-------|
| Tests written | {testsWritten} |
| Tests passed | {testsPassed} |
| Tests failed | {testsFailed} |

## Test Files

{list of test files created}

## Test Output

```
{test runner output}
```

## Failed Tests

{if any failed tests, list them with failure details}
```

#### 3a.7: Log test failures as issues

For each failed test, log it as a review issue:

```bash
echo '{"type":"test-failure","severity":"high","source":"unit-test","file":"<test-file>","description":"<failure description>","evidence":"<error output>"}' | node "${RAPID_TOOLS}" review log-issue <set-id> <wave-id>
```

### Step 3b: Bug Hunt Stage (if selected)

Skip this step if bug hunting was not selected in Step 1.

Run the adversarial pipeline with up to 3 bugfix iteration cycles.

#### Bug Hunt Cycle Loop (max 3 iterations)

Initialize: `cycle = 1`, `modifiedFiles = []` (empty for cycle 1).

**For cycle = 1 to 3:**

##### 3b.1: Determine scope

- **Cycle 1:** Use the full review scope (all changed files + dependents from Step 3.0).
- **Cycle 2+:** Narrow scope to ONLY the files modified by the bugfix agent in the previous cycle (`modifiedFiles` from previous iteration). If `modifiedFiles` is empty, break the loop (nothing was changed, no new bugs to find).

##### 3b.2: Spawn bug-hunter subagent

Read the role module:

```bash
cat src/modules/roles/role-bug-hunter.md
```

Spawn bug-hunter subagent via Agent tool:

```
You are a bug-hunter analyzing wave '{waveId}' in set '{setId}' (cycle {cycle}).

## Your Role
{content of role-bug-hunter.md}

## Scoped Files (ONLY report bugs in these files)
{scoped file list for this cycle}

## Wave Context
{wave context: what changed and why}

## Instructions
Analyze each scoped file for bugs, logic errors, and code quality issues.
Return findings via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"findings":[{"id":"F-{N}","file":"...","line":N,"category":"...","description":"...","risk":"critical|high|medium|low","confidence":"high|medium|low","evidence":"..."}],"totalFindings":N}} -->
```

Parse RAPID:RETURN: `{ findings, totalFindings }`.

##### 3b.3: Check for zero findings

If `totalFindings` is 0: print message and break the cycle loop.

```
Bug hunt cycle {cycle}: no findings. Codebase clean.
```

##### 3b.4: Spawn devils-advocate subagent

Read the role module:

```bash
cat src/modules/roles/role-devils-advocate.md
```

Spawn devils-advocate subagent via Agent tool:

```
You are a devils-advocate challenging findings for wave '{waveId}' in set '{setId}'.

## Your Role
{content of role-devils-advocate.md}

## Hunter Findings
{JSON array of findings from bug-hunter}

## Scoped Files
{same scoped file list}

## Instructions
Challenge each finding with counter-evidence from the code. You are read-only.
Return assessments via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"assessments":[{"findingId":"F-{N}","challenge":"...","counterEvidence":"...","verdict":"agree|disagree|uncertain"}]}} -->
```

Parse RAPID:RETURN: `{ assessments }`.

##### 3b.5: Spawn judge subagent

Read the role module:

```bash
cat src/modules/roles/role-judge.md
```

Spawn judge subagent via Agent tool:

```
You are the judge ruling on findings for wave '{waveId}' in set '{setId}'.

## Your Role
{content of role-judge.md}

## Hunter Findings
{JSON array of findings}

## Advocate Assessments
{JSON array of assessments}

## Instructions
For each finding, weigh hunter evidence against advocate challenge and rule:
- ACCEPTED: real bug, should be fixed
- DISMISSED: false positive or cosmetic
- DEFERRED: insufficient evidence, needs human input

Return rulings via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"rulings":[{"findingId":"F-{N}","ruling":"ACCEPTED|DISMISSED|DEFERRED","reasoning":"..."}],"accepted":N,"dismissed":N,"deferred":N}} -->
```

Parse RAPID:RETURN: `{ rulings, accepted, dismissed, deferred }`.

Print ruling summary:

```
Bug hunt cycle {cycle}: {accepted} accepted, {dismissed} dismissed, {deferred} deferred
```

##### 3b.6: Handle DEFERRED rulings

For each ruling where `ruling === "DEFERRED"`, present the evidence to the developer for a final call.

For each DEFERRED finding:

1. Find the original finding from the hunter (by `findingId`).
2. Find the advocate assessment for this finding.
3. Use AskUserQuestion:
   - **question:** "Finding {findingId}: {description} ({file}:{line})"
   - Display context: "Hunter says: {evidence}" and "Advocate says: {counterEvidence}"
   - **options:**
     - "Accept (real bug)" -- description: "Bug is real, should be fixed"
     - "Dismiss (false positive)" -- description: "Not a real bug, skip it"
     - "Defer (fix later)" -- description: "Log for later review"

4. Based on user response:
   - "Accept": Change ruling to ACCEPTED, add to accepted bugs list.
   - "Dismiss": Change ruling to DISMISSED.
   - "Defer": Keep as DEFERRED, log as issue for later:
     ```bash
     echo '{"type":"bug","severity":"{risk}","source":"bug-hunt","file":"{file}","line":{line},"description":"{description}","evidence":"{evidence}","status":"deferred"}' | node "${RAPID_TOOLS}" review log-issue <set-id> <wave-id>
     ```

##### 3b.7: Write REVIEW-BUGS.md

Write bug hunt results to `.planning/waves/{setId}/{waveId}/REVIEW-BUGS.md`:

```markdown
# Bug Hunt Review - Wave {waveId}

**Date:** {ISO timestamp}
**Cycles completed:** {cycle}
**Scope:** {totalFiles} files

## Summary

| Ruling | Count |
|--------|-------|
| Accepted | {accepted} |
| Dismissed | {dismissed} |
| Deferred | {deferred} |

## Findings and Rulings

{For each finding/ruling:}
### {findingId}: {description}
- **File:** {file}:{line}
- **Risk:** {risk} | **Confidence:** {confidence}
- **Category:** {category}
- **Hunter evidence:** {evidence}
- **Advocate challenge:** {challenge}
- **Ruling:** {ruling}
- **Reasoning:** {reasoning}
```

##### 3b.8: Collect ACCEPTED bugs and spawn bugfix agent

Collect all ACCEPTED bugs (including those upgraded from DEFERRED by the user in Step 3b.6).

**If no ACCEPTED bugs:** Print "No bugs to fix." and break the cycle loop.

**If ACCEPTED bugs exist:**

Read the bugfix role module:

```bash
cat src/modules/roles/role-bugfix.md
```

Spawn bugfix subagent via Agent tool:

```
You are a bugfix agent fixing accepted bugs for wave '{waveId}' in set '{setId}'.

## Your Role
{content of role-bugfix.md}

## Accepted Bugs
{JSON array of accepted bug findings with full evidence}

## Instructions
For each accepted bug:
1. Read the target file
2. Apply a targeted, minimal fix
3. Verify the fix doesn't break existing behavior
4. Commit: git add <file> && git commit -m "fix({setId}): {brief description}"

Return results via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"fixed":[{"findingId":"F-{N}","file":"...","description":"..."}],"unfixable":[{"findingId":"F-{N}","reason":"..."}],"modifiedFiles":["..."]}} -->
```

Parse RAPID:RETURN: `{ fixed, unfixable, modifiedFiles }`.

**Log unfixable bugs as issues:**
```bash
echo '{"type":"bug","severity":"high","source":"bug-hunt","file":"{file}","description":"Unfixable: {reason}","status":"open"}' | node "${RAPID_TOOLS}" review log-issue <set-id> <wave-id>
```

**Update issue status for fixed bugs:**
```bash
node "${RAPID_TOOLS}" review update-issue <set-id> <wave-id> <issue-id> fixed
```

**Record modifiedFiles** for scope narrowing in the next cycle.

Print cycle results:

```
Bugfix cycle {cycle}: {fixed.length} fixed, {unfixable.length} unfixable
```

**Continue to next cycle** (increment `cycle`, go back to Step 3b.1).

##### 3b.9: After cycle 3 with remaining unfixed bugs

After completing 3 cycles, if there are still ACCEPTED bugs that were not fixed (unfixable from any cycle):

Present each remaining bug to the user:

For each remaining unfixed bug, use AskUserQuestion:
- **question:** "Remaining bug: {description} ({file}:{line})"
- **options:**
  - "Fix manually" -- description: "You will fix this yourself"
  - "Defer" -- description: "Log and move on"
  - "Dismiss" -- description: "Not worth fixing"

Update issue statuses based on user response:
- "Fix manually": Log as issue with status `open`:
  ```bash
  echo '{"type":"bug","severity":"high","source":"bug-hunt","file":"{file}","description":"Manual fix needed: {description}","status":"open"}' | node "${RAPID_TOOLS}" review log-issue <set-id> <wave-id>
  ```
- "Defer": Log as issue with status `deferred`
- "Dismiss": Log as issue with status `dismissed`

### Step 3c: UAT Stage (if selected)

Skip this step if UAT was not selected in Step 1.

#### 3c.1: Load context for test scenario derivation

Read JOB-PLAN.md acceptance criteria (already loaded in Step 3a.1 if unit test ran, otherwise load now):

```bash
node "${RAPID_TOOLS}" wave-plan list-jobs <set-id> <wave-id>
```

Read each JOB-PLAN.md file to extract acceptance criteria.

Also read WAVE-CONTEXT.md for design decisions that inform test scenarios:

```bash
cat .planning/waves/{setId}/{waveId}/WAVE-CONTEXT.md 2>/dev/null
```

#### 3c.2: Determine browser automation tool

Check `.planning/config.json` for a `browserAutomation` field:

```bash
cat .planning/config.json 2>/dev/null
```

Parse the JSON. If `browserAutomation` is set, use that value.

If `browserAutomation` is NOT set, use AskUserQuestion:
- **question:** "Which browser automation tool to use for UAT?"
- **options:**
  - "Chrome DevTools MCP" -- description: "Use Chrome DevTools Protocol (default, recommended)"
  - "Playwright MCP" -- description: "Use Playwright for browser automation"
  - "Skip automated steps" -- description: "Run only human-verified steps"

Record the chosen tool.

#### 3c.3: Spawn UAT subagent (test plan phase)

Read the role module:

```bash
cat src/modules/roles/role-uat.md
```

Spawn UAT subagent via Agent tool:

```
You are a UAT agent for wave '{waveId}' in set '{setId}'.

## Your Role
{content of role-uat.md}

## Acceptance Criteria
{acceptance criteria from JOB-PLAN.md files}

## User Decisions
{decisions from WAVE-CONTEXT.md}

## Browser Automation Tool
{chosen tool: Chrome DevTools MCP / Playwright MCP / None}

## Phase 1: Test Plan Generation
Generate a UAT test plan with each step tagged as [automated] or [human].
Return via:
<!-- RAPID:RETURN {"status":"CHECKPOINT","data":{"testPlan":[{"step":N,"description":"...","type":"automated|human","expectedResult":"...","automationDetails":"..."}]}} -->
```

#### 3c.4: Present UAT test plan for approval

Parse RAPID:RETURN from subagent output. Display the test plan:

```
--- UAT Test Plan ---
{For each step:}
  [{index}] [{type}] {description}
       Expected: {expectedResult}
       {if automated: "Automation: {automationDetails}"}
---------------------
```

Use AskUserQuestion:
- **question:** "Approve UAT test plan for wave {waveId}? ({N} steps: {automated} automated, {human} human)"
- **options:**
  - "Approve" -- description: "Run the test plan as tagged"
  - "Modify tags" -- description: "Change which steps are automated vs human"
  - "Skip UAT" -- description: "Skip acceptance testing for this wave"

**If "Approve":** Proceed to Step 3c.5.

**If "Modify tags":** Use AskUserQuestion to collect modifications. Re-invoke UAT subagent with updated tags. Repeat Step 3c.4.

**If "Skip":** Move to next wave or Step 4.

#### 3c.5: Spawn UAT subagent (execution phase)

Re-invoke the UAT subagent with the approved plan:

```
You are a UAT agent executing approved tests for wave '{waveId}' in set '{setId}'.

## Your Role
{content of role-uat.md}

## Approved Test Plan
{the approved test plan with step types}

## Browser Automation Tool
{chosen tool}

## Phase 2: Execute Tests
For [automated] steps: execute via the configured browser automation tool.
For [human] steps: return CHECKPOINT with verification instructions.
Return via:
<!-- RAPID:RETURN {"status":"COMPLETE|CHECKPOINT","data":{...}} -->
```

**Processing subagent output:**

**If status is CHECKPOINT** (human verification step needed):
- The subagent pauses at a [human] tagged step
- Display the step description and what to verify
- Use AskUserQuestion:
  - **question:** "UAT Step {N}: {description}"
  - **options:**
    - "Pass" -- description: "Step verified successfully"
    - "Fail" -- description: "Step failed -- describe the issue"
- If "Fail": Use AskUserQuestion to collect failure description
- Re-invoke UAT subagent with the pass/fail result to continue remaining steps
- Repeat until all steps are processed

**If status is COMPLETE:**
- Parse results: `{ stepsPassed, stepsFailed, stepsSkipped, results }`

#### 3c.6: Write REVIEW-UAT.md

Write UAT results to `.planning/waves/{setId}/{waveId}/REVIEW-UAT.md`:

```markdown
# UAT Review - Wave {waveId}

**Date:** {ISO timestamp}
**Browser tool:** {chosen tool}
**Scope:** {totalFiles} files

## Summary

| Metric | Count |
|--------|-------|
| Steps passed | {stepsPassed} |
| Steps failed | {stepsFailed} |
| Steps skipped | {stepsSkipped} |

## Test Results

{For each step:}
### Step {N}: {description}
- **Type:** {automated|human}
- **Result:** {pass|fail|skip}
- **Details:** {result details or failure description}
```

#### 3c.7: Log failed UAT steps as issues

For each failed UAT step, log it as a review issue:

```bash
echo '{"type":"uat-failure","severity":"high","source":"uat","file":"N/A","description":"UAT step {N} failed: {description}","evidence":"{failure details}"}' | node "${RAPID_TOOLS}" review log-issue <set-id> <wave-id>
```

### Step 3d: Wave review complete

Print wave completion message:

```
--- Wave {waveId} Review Complete ---
{if unit test ran:} Unit tests: {passed} passed, {failed} failed
{if bug hunt ran:}  Bug hunt: {accepted} accepted, {dismissed} dismissed, {deferred} deferred
{if UAT ran:}       UAT: {passed} passed, {failed} failed, {skipped} skipped
-------------------------------------
```

Continue to next wave (back to Step 3.0).

## Step 4: Generate Review Summary

After all waves have been reviewed, generate a consolidated review summary:

```bash
node "${RAPID_TOOLS}" review summary <set-id>
```

This writes `REVIEW-SUMMARY.md` to `.planning/waves/{setId}/REVIEW-SUMMARY.md`.

Print the summary to the user:

```
--- RAPID Review Complete ---
Set: {setId}
Waves reviewed: {N}
Unit tests: {totalPassed} passed, {totalFailed} failed
Bug hunt: {totalAccepted} accepted, {totalDismissed} dismissed, {totalDeferred} deferred
UAT: {totalPassed} passed, {totalFailed} failed, {totalSkipped} skipped
Open issues: {count}

Review artifacts:
  .planning/waves/{setId}/REVIEW-SUMMARY.md
  .planning/waves/{setId}/{waveId}/REVIEW-UNIT.md
  .planning/waves/{setId}/{waveId}/REVIEW-BUGS.md
  .planning/waves/{setId}/{waveId}/REVIEW-UAT.md
-----------------------------
```

Only list artifact paths for stages that were actually run. If a stage was skipped, omit its artifact line.

## Step 5: Next Action

Use AskUserQuestion:
- **question:** "Review complete for set '{set-id}'. What's next?"
- **options:**
  - "Proceed to merge" -- description: "Set is ready. Run /rapid:merge {set-id}"
  - "Re-run review" -- description: "Run another review cycle on this set"
  - "Fix issues first" -- description: "Run /rapid:execute {set-id} --fix-issues to address remaining issues"
  - "Done for now" -- description: "Exit. Review artifacts saved."

**If "Proceed to merge":** Print instructions:
> Ready for merge. Run `/rapid:merge {set-id}` to begin the merge process.
Exit.

**If "Re-run review":** Go back to Step 1 (stage selection). Do not re-transition state (already in `reviewing`).

**If "Fix issues first":** Print instructions:
> Run `/rapid:execute {set-id} --fix-issues` to batch-fix logged issues.
Exit.

**If "Done for now":** Print:
> Review complete. Artifacts saved. Resume with `/rapid:review {set-id}` at any time.
Exit.

## Important Notes

- **Agent tool isolation:** This skill uses the Agent tool to spawn subagents. Each subagent runs in its own context window. Subagents CANNOT spawn sub-subagents -- this skill (the orchestrator) is the sole dispatcher.
- **Adversarial pipeline is the quality gate.** The hunter finds, the advocate challenges, the judge rules. This is not a rubber-stamp process. The three agents are independent and adversarial by design.
- **DEFERRED rulings ALWAYS require human input.** The skill pauses and presents evidence from both the hunter and the advocate. The developer makes the final call -- accept, dismiss, or defer.
- **Iteration limit is 3 bugfix cycles.** After 3 hunt-fix-re-hunt cycles, remaining bugs are presented to the user with per-bug options: fix manually, defer, or dismiss. This prevents infinite fix loops.
- **Re-hunts narrow scope.** Cycles 2 and 3 only analyze files the bugfix agent modified in the previous cycle. This prevents scope creep and ensures the re-hunt is targeted.
- **UAT browser automation depends on MCP tool availability.** If the configured browser automation tool is not available at runtime, automated steps should be converted to human steps. The UAT subagent handles this gracefully.
- **Review state is set-level.** The set transitions `executing` -> `reviewing`. Wave states are unchanged -- waves stay in their current status (`complete` or `reconciling`). Review does not modify wave state.
- **All review artifacts are committed at the end.** After all waves are reviewed and REVIEW-SUMMARY.md is generated, the orchestrator should commit review artifacts alongside STATE.json.
- **Stage ordering is fixed.** When multiple stages are selected, they always run in order: unit test, then bug hunt, then UAT. This ensures unit test failures inform the bug hunt, and both inform UAT.
- **Idempotent re-entry.** If a previous review session was interrupted, re-invoking `/rapid:review` picks up where it left off. The set is already in `reviewing` state, and existing REVIEW-*.md artifacts are preserved (overwritten only if the stage runs again).
- **Token cost awareness.** The 3-agent adversarial bug hunt is the most expensive stage ($15-45 per cycle). Users can control costs by selecting only the stages they need and reviewing specific waves instead of entire sets.
