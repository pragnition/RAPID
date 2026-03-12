---
description: Review completed sets -- orchestrates unit test, bug hunt, and UAT pipeline
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion
---

# /rapid:review -- Review Pipeline Orchestrator

You are the RAPID review orchestrator. This skill runs the full review pipeline on a completed set: unit testing, adversarial bug hunting (hunter/advocate/judge), and user acceptance testing. The review operates at the set level -- all changed files across all waves are scoped together. A scoper agent categorizes files by concern area before unit test and bug hunt stages, so each review agent receives only relevant files. Directory chunking applies within each concern group if it exceeds 15 files. The user controls which stages to run. Follow these steps IN ORDER. Do not skip steps.

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
node "${RAPID_TOOLS}" display banner review
```

### 0b: Parse arguments

The user invokes this skill with: `/rapid:review <set-id>` or numeric shorthand like `/rapid:review 1`.

**Wave-specific review is no longer supported.** If the user passes a wave argument (e.g., `/rapid:review 1 1.1`), ignore it with a note: "Wave-specific review is no longer supported. Reviewing entire set."

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
- **question:** "Which set to review?"
- **options:** List available sets from STATE.json by running:
  ```bash
  node "${RAPID_TOOLS}" state get --all
  ```

Parse the set-id from the user's invocation.

### 0c: Validate set status

Read STATE.json to verify the target set exists and is in a reviewable state:

```bash
node "${RAPID_TOOLS}" state get --all
```

Parse the JSON output and find the target set. The set status MUST be `complete` or `reviewing`. If the set is in any other status (e.g., `pending`, `planning`, `executing`):

> Cannot review set '{set-id}' -- current status is '{status}'. Set must be in 'complete' or 'reviewing' state. Run `/rapid:execute-set {set-id}` first.

Exit.

### 0d: Transition set to 'reviewing'

If the set is currently in `complete` state, transition it to `reviewing`:

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

## Step 2: Scope Set Files

Scope all changed files across the entire set in a single call:

```bash
SCOPE_RESULT=$(node "${RAPID_TOOLS}" review scope <set-id>)
```

Parse the JSON output: `{ changedFiles, dependentFiles, totalFiles, chunks, waveAttribution }`.

- `changedFiles` -- array of files changed in the set branch vs main
- `dependentFiles` -- array of files that import changed files (one-hop dependents)
- `totalFiles` -- total count of changed + dependent files
- `chunks` -- array of `{ dir, files }` directory groups (pre-computed by the scope command using the 15-file threshold)
- `waveAttribution` -- map of `{ filePath: waveId }` derived from JOB-PLAN.md file lists across all waves

Print a banner:

```
--- RAPID Review ---
Set: {setId}
Scope: {totalFiles} files ({changedFiles.length} changed + {dependentFiles.length} dependents)
Chunks: {chunks.length} directory group(s)
Stages: {selected stages, comma-separated}
--------------------
```

Store `chunks` and `waveAttribution` for use in subsequent stages.

## Step 2.5: Concern-Based Scoping (Bug Hunt + Unit Test only)

Skip this step entirely if NEITHER bug hunt NOR unit test was selected in Step 1. UAT always uses full scope and is never concern-scoped.

Spawn the **rapid-scoper** agent with the full scoped file list from Step 2:

```
Review set '{setId}' -- categorize {totalFiles} files by concern area.

## Scoped Files
{list of ALL files from review scope (changedFiles + dependentFiles)}

## Working Directory
{worktreePath}

## Instructions
Read the scoped files and categorize each by concern area.
Return via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{...ScoperOutput...}} -->
```

Parse the scoper's RAPID:RETURN output.

### Cross-Cutting Fallback Check

If `crossCuttingCount > totalFiles * 0.5`:
- Log warning: "Cross-cutting files ({crossCuttingCount}/{totalFiles}) exceed 50% threshold. Falling back to directory chunking."
- Set `useConcernScoping = false` -- Steps 4a and 4b will use the directory chunks from Step 2 (existing behavior)

If `crossCuttingCount <= totalFiles * 0.5`:
- Set `useConcernScoping = true`
- Build concern groups: for each concern, the file list is the concern's own files PLUS all cross-cutting files
- Within each concern group, if the group exceeds 15 files (CHUNK_THRESHOLD), apply `chunkByDirectory` to split it further
- Store the concern groups for Steps 4a and 4b

Print concern scope banner:

```
--- Concern Scoping ---
Set: {setId}
Concerns: {concernCount} ({concern names, comma-separated})
Cross-cutting: {crossCuttingCount} file(s)
Scoping: {'concern-based' if useConcernScoping else 'directory chunking (fallback)'}
-----------------------
```

## Step 3: Load Acceptance Criteria

Read ALL JOB-PLAN.md files from the set's planning directory to extract acceptance criteria. Iterate wave directories:

```bash
# For each wave in the set, list job plans
node "${RAPID_TOOLS}" wave-plan list-jobs <set-id> <wave-id>
```

For each wave directory found under `.planning/waves/{setId}/`, call `wave-plan list-jobs` to get job plan file paths, then read each JOB-PLAN.md to extract acceptance criteria sections.

Aggregate acceptance criteria from all waves into a single list. This provides context for unit test and UAT stages. Tag each criterion with its originating wave for traceability.

## Step 4: Run Selected Stages on Set Scope

### Step 4a: Unit Test Stage (if selected)

Skip this step if unit testing was not selected in Step 1.

#### 4a.1: Plan generation

**If `useConcernScoping` is true:**

Instead of using directory chunks from Step 2, use concern groups from Step 2.5. Spawn one **rapid-unit-tester** agent PER CONCERN GROUP in parallel (up to 5 concurrent). Each agent gets its concern group's files (concern files + cross-cutting files). If a concern group exceeds 15 files, it was already sub-chunked by directory in Step 2.5 -- spawn one agent per sub-chunk.

```
Review set '{setId}', concern: {concernName} ({files.length} files) -- Phase 1: Test Plan Generation.

## Scoped Files (this concern only)
{concern group's file list}

## Concern Area
{concernName}

## Acceptance Criteria
{acceptance criteria relevant to this concern's files}

## Working Directory
{worktreePath}

## Phase 1: Test Plan Generation
Generate a test plan for your concern's files only. Return it via:
<!-- RAPID:RETURN {"status":"CHECKPOINT","data":{"testPlan":[{"file":"...","testCase":"...","description":"...","expectedBehavior":"..."}]}} -->
```

Collect all test plans from all concern groups.

**If `useConcernScoping` is false (fallback):**

Use existing directory chunking behavior (no change to fallback logic):

**If chunks.length <= 1 (single chunk or no chunking):**

Spawn ONE **rapid-unit-tester** agent with the full file list and aggregated acceptance criteria:

```
Review set '{setId}' -- Phase 1: Test Plan Generation.

## Scoped Files
{list of ALL files from review scope}

## Acceptance Criteria
{aggregated acceptance criteria from all waves}

## Working Directory
{worktreePath}

## Phase 1: Test Plan Generation
Generate a test plan listing every test case. Return it via:
<!-- RAPID:RETURN {"status":"CHECKPOINT","data":{"testPlan":[{"file":"...","testCase":"...","description":"...","expectedBehavior":"..."}]}} -->
```

**If chunks.length > 1 (multiple chunks):**

Spawn one **rapid-unit-tester** agent PER CHUNK in parallel (up to 5 concurrent via Agent tool). Each agent gets its chunk's files plus acceptance criteria relevant to those files:

```
Review set '{setId}', chunk: {chunk.dir} ({chunk.files.length} files) -- Phase 1: Test Plan Generation.

## Scoped Files (this chunk only)
{chunk.files list}

## Acceptance Criteria
{acceptance criteria relevant to this chunk's files}

## Working Directory
{worktreePath}

## Phase 1: Test Plan Generation
Generate a test plan for your chunk's files only. Return it via:
<!-- RAPID:RETURN {"status":"CHECKPOINT","data":{"testPlan":[{"file":"...","testCase":"...","description":"...","expectedBehavior":"..."}]}} -->
```

Collect all test plans from all chunks.

#### 4a.2: Present test plan for approval

Present the combined test plan, grouped by directory chunk:

```
--- Unit Test Plan ---
[{chunk.dir}] ({N} tests)
  [{index}] {file}: {testCase}
       {description}
       Expected: {expectedBehavior}

[{chunk.dir}] ({N} tests)
  [{index}] {file}: {testCase}
       ...
----------------------
```

Use AskUserQuestion:
- **question:** "Approve test plan for set {setId}? ({totalN} test cases across {chunks.length} chunk(s))"
- **options:**
  - "Approve" -- description: "Proceed with writing and running tests"
  - "Modify" -- description: "Describe changes to the test plan"
  - "Skip unit tests" -- description: "Skip testing for this set"

**If "Approve":** Proceed to Step 4a.3.

**If "Modify":** Use AskUserQuestion to collect the user's modifications. Re-invoke the unit-tester subagent(s) with the user's feedback appended to the prompt. Repeat Step 4a.2.

**If "Skip":** Move to Step 4b (bug hunt) or 4c (UAT) depending on selected stages.

#### 4a.3: Execute tests

**If single chunk:** Re-invoke the **rapid-unit-tester** agent:

```
Execute approved tests for set '{setId}' -- Phase 2: Write and Execute Tests.

## Approved Test Plan
{the approved test plan}

## Working Directory
{worktreePath}

## Phase 2: Write and Execute Tests
Write the test files according to the approved plan. Run them with `node --test`.
Return results via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"testsWritten":N,"testsPassed":N,"testsFailed":N,"output":"...","testFiles":["..."]}} -->
```

**If multiple chunks:** Spawn execution agents per chunk in parallel (up to 5 concurrent). Each agent writes and runs tests for its chunk's files only.

Merge results across chunks: sum `testsWritten`, `testsPassed`, `testsFailed` across all chunks.

#### 4a.4: Process unit test results

Print results:

```
--- Unit Test Results ---
Set: {setId}
Tests written: {testsWritten}
Tests passed: {testsPassed}
Tests failed: {testsFailed}
-------------------------
```

#### 4a.5: Write REVIEW-UNIT.md

Write unit test results to `.planning/waves/{setId}/REVIEW-UNIT.md`:

```markdown
# Unit Test Review - Set {setId}

**Date:** {ISO timestamp}
**Scope:** {totalFiles} files ({changedFiles.length} changed + {dependentFiles.length} dependents)
**Chunks:** {chunks.length} directory group(s)

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

#### 4a.6: Log test failures as issues

For each failed test, log it as a review issue. Look up `originatingWave` from the `waveAttribution` map for the test's target file:

```bash
echo '{"id":"SET-{setId}-unit-{N}","type":"test","severity":"high","source":"unit-test","file":"<test-file>","description":"<failure description>","originatingWave":"<from waveAttribution>","status":"open","createdAt":"<ISO timestamp>"}' | node "${RAPID_TOOLS}" review log-issue <set-id>
```

### Step 4b: Bug Hunt Stage (if selected)

Skip this step if bug hunting was not selected in Step 1.

Run the adversarial pipeline with up to 3 bugfix iteration cycles.

#### Bug Hunt Cycle Loop (max 3 iterations)

Initialize: `cycle = 1`, `modifiedFiles = []` (empty for cycle 1).

**For cycle = 1 to 3:**

##### 4b.1: Determine scope

- **Cycle 1:** Use the full review scope. If `chunks.length > 1`, use chunked scope. If single chunk, use flat scope.
- **Cycle 2+:** Narrow scope to ONLY the files modified by the bugfix agent in the previous cycle (`modifiedFiles` from previous iteration). If `modifiedFiles` is empty, break the loop (nothing was changed, no new bugs to find). **No re-chunking for cycles 2-3** -- always flat scope on modified files only.

##### 4b.2: Spawn bug-hunter subagent(s)

**Cycle 1 with `useConcernScoping = true`:**

Spawn one **rapid-bug-hunter** agent PER CONCERN GROUP in parallel (up to 5 concurrent). Each hunter gets ONLY its concern group's files (concern files + cross-cutting files):

```
Analyze set '{setId}', concern: {concernName} ({files.length} files) (cycle {cycle}).

## Scoped Files (ONLY report bugs in these files)
{concern group's file list}

## Concern Area
{concernName}

## Set Context
{set context: what changed and why}

## Working Directory
{worktreePath}

## Instructions
Analyze each scoped file for bugs, logic errors, and code quality issues.
Tag each finding with concern: "{concernName}".
Return findings via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"findings":[{"id":"CON-{concernIndex}-F-{N}","file":"...","line":N,"category":"...","description":"...","risk":"critical|high|medium|low","confidence":"high|medium|low","evidence":"...","concern":"{concernName}"}],"totalFindings":N}} -->
```

Use concern index prefix for finding IDs to prevent collisions: `CON-1-F-001`, `CON-2-F-001`, etc.

If more than 5 concern groups exist, batch them (first 5, then remaining) -- same pattern as existing directory chunk batching.

**Cycle 1 with `useConcernScoping = false` (fallback):**

Use existing per-directory-chunk behavior:

**If chunks.length > 1 (multiple chunks):**

Spawn one **rapid-bug-hunter** agent PER CHUNK in parallel (up to 5 concurrent):

```
Analyze set '{setId}', chunk: {chunk.dir} ({chunk.files.length} files) (cycle {cycle}).

## Scoped Files (ONLY report bugs in these files)
{chunk.files list}

## Set Context
{set context: what changed and why}

## Working Directory
{worktreePath}

## Instructions
Analyze each scoped file for bugs, logic errors, and code quality issues.
Return findings via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"findings":[{"id":"C{chunkIndex}-F-{N}","file":"...","line":N,"category":"...","description":"...","risk":"critical|high|medium|low","confidence":"high|medium|low","evidence":"..."}],"totalFindings":N}} -->
```

Prefix chunk index to finding IDs to prevent collisions: `C1-F-001`, `C2-F-001`, etc.

**If single chunk:**

Spawn ONE **rapid-bug-hunter** agent with the full scoped file list:

```
Analyze set '{setId}' (cycle {cycle}).

## Scoped Files (ONLY report bugs in these files)
{scoped file list for this cycle}

## Set Context
{set context: what changed and why}

## Working Directory
{worktreePath}

## Instructions
Analyze each scoped file for bugs, logic errors, and code quality issues.
Return findings via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"findings":[{"id":"F-{N}","file":"...","line":N,"category":"...","description":"...","risk":"critical|high|medium|low","confidence":"high|medium|low","evidence":"..."}],"totalFindings":N}} -->
```

**Cycles 2-3:** No concern scoping. Narrow scope to modified files from previous cycle only. Single flat-scope hunter. (No change to existing cycle 2-3 behavior.)

Collect all findings from all hunters and merge into a single array.

##### 4b.2.5: Merge and Deduplicate Findings

After collecting all findings from all hunters (whether concern-scoped or chunk-scoped):

1. Merge all findings into a single array
2. Deduplicate: findings with the same file AND description similarity >0.7 (normalized Levenshtein) are duplicates
3. When deduplicating: higher severity wins. Equal severity: keep the finding with longer evidence/codeSnippet
4. Preserve the `concern` tag on the surviving finding
5. Log the deduplication count: "Merged {totalRaw} findings from {groupCount} {concerns|chunks}. After deduplication: {dedupCount} unique findings."

The deduplicated findings set is used for ALL subsequent steps (4b.3 through 4b.9).

##### 4b.3: Check for zero findings

If `totalFindings` is 0 (across all chunks): print message and break the cycle loop.

```
Bug hunt cycle {cycle}: no findings. Codebase clean.
```

##### 4b.4: Spawn devils-advocate subagent

Spawn ONE **rapid-devils-advocate** agent on the merged findings:

```
Challenge findings for set '{setId}' (cycle {cycle}).

## Hunter Findings
{JSON array of merged findings from all hunters}

## Scoped Files
{full scoped file list}

## Working Directory
{worktreePath}

## Instructions
Challenge each finding with counter-evidence from the code. You are read-only.
Return assessments via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"assessments":[{"findingId":"...","challenge":"...","counterEvidence":"...","verdict":"agree|disagree|uncertain"}]}} -->
```

Parse RAPID:RETURN: `{ assessments }`.

##### 4b.5: Spawn judge subagent

Spawn ONE **rapid-judge** agent on merged findings + advocate assessments:

```
Rule on findings for set '{setId}' (cycle {cycle}).

## Hunter Findings
{JSON array of findings}

## Advocate Assessments
{JSON array of assessments}

## Working Directory
{worktreePath}

## Instructions
For each finding, weigh hunter evidence against advocate challenge and rule:
- ACCEPTED: real bug, should be fixed
- DISMISSED: false positive or cosmetic
- DEFERRED: insufficient evidence, needs human input

Return rulings via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"rulings":[{"findingId":"...","ruling":"ACCEPTED|DISMISSED|DEFERRED","reasoning":"..."}],"accepted":N,"dismissed":N,"deferred":N}} -->
```

Parse RAPID:RETURN: `{ rulings, accepted, dismissed, deferred }`.

Print ruling summary:

```
Bug hunt cycle {cycle}: {accepted} accepted, {dismissed} dismissed, {deferred} deferred
```

##### 4b.6: Handle DEFERRED rulings

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
   - "Defer": Keep as DEFERRED, log as issue for later. Look up `originatingWave` from `waveAttribution` for the finding's file:
     ```bash
     echo '{"id":"SET-{setId}-hunt-{N}","type":"bug","severity":"{risk}","source":"bug-hunt","file":"{file}","line":{line},"description":"{description}","evidence":"{evidence}","originatingWave":"<from waveAttribution>","status":"deferred","createdAt":"<ISO timestamp>"}' | node "${RAPID_TOOLS}" review log-issue <set-id>
     ```

##### 4b.7: Write REVIEW-BUGS.md

Write bug hunt results to `.planning/waves/{setId}/REVIEW-BUGS.md`:

```markdown
# Bug Hunt Review - Set {setId}

**Date:** {ISO timestamp}
**Cycles completed:** {cycle}
**Scope:** {totalFiles} files across {chunks.length} chunk(s)

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
- **Concern:** {concern or "N/A"}
- **Originating wave:** {originatingWave from waveAttribution}
- **Hunter evidence:** {evidence}
- **Advocate challenge:** {challenge}
- **Ruling:** {ruling}
- **Reasoning:** {reasoning}
```

##### 4b.8: Collect ACCEPTED bugs and spawn bugfix agent

Collect all ACCEPTED bugs (including those upgraded from DEFERRED by the user in Step 4b.6).

**If no ACCEPTED bugs:** Print "No bugs to fix." and break the cycle loop.

**If ACCEPTED bugs exist:**

Log each accepted bug as an issue. Look up `originatingWave` from `waveAttribution`:

```bash
echo '{"id":"SET-{setId}-hunt-{N}","type":"bug","severity":"{risk}","source":"bug-hunt","file":"{file}","line":{line},"description":"{description}","evidence":"{evidence}","originatingWave":"<from waveAttribution>","concern":"{concern}","status":"open","createdAt":"<ISO timestamp>"}' | node "${RAPID_TOOLS}" review log-issue <set-id>
```

Spawn the **rapid-bugfix** agent:

```
Fix accepted bugs for set '{setId}' (cycle {cycle}).

## Accepted Bugs
{JSON array of accepted bug findings with full evidence}

## Working Directory
{worktreePath}

## Instructions
For each accepted bug:
1. Read the target file
2. Apply a targeted, minimal fix
3. Verify the fix doesn't break existing behavior
4. Commit: git add <file> && git commit -m "fix({setId}): {brief description}"

Return results via:
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"fixed":[{"findingId":"...","file":"...","description":"..."}],"unfixable":[{"findingId":"...","reason":"..."}],"modifiedFiles":["..."]}} -->
```

Parse RAPID:RETURN: `{ fixed, unfixable, modifiedFiles }`.

**Log unfixable bugs as issues:**
```bash
echo '{"id":"SET-{setId}-hunt-{N}","type":"bug","severity":"high","source":"bug-hunt","file":"{file}","description":"Unfixable: {reason}","originatingWave":"<from waveAttribution>","status":"open","createdAt":"<ISO timestamp>"}' | node "${RAPID_TOOLS}" review log-issue <set-id>
```

**Update issue status for fixed bugs:**
```bash
node "${RAPID_TOOLS}" review update-issue <set-id> <issue-id> fixed
```

**Record modifiedFiles** for scope narrowing in the next cycle.

Print cycle results:

```
Bugfix cycle {cycle}: {fixed.length} fixed, {unfixable.length} unfixable
```

**Continue to next cycle** (increment `cycle`, go back to Step 4b.1).

##### 4b.9: After cycle 3 with remaining unfixed bugs

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
  echo '{"id":"SET-{setId}-hunt-{N}","type":"bug","severity":"high","source":"bug-hunt","file":"{file}","description":"Manual fix needed: {description}","originatingWave":"<from waveAttribution>","status":"open","createdAt":"<ISO timestamp>"}' | node "${RAPID_TOOLS}" review log-issue <set-id>
  ```
- "Defer": Log as issue with status `deferred`
- "Dismiss": Log as issue with status `dismissed`

### Step 4c: UAT Stage (if selected)

Skip this step if UAT was not selected in Step 1.

UAT runs ONCE on the full set scope -- it is NOT chunked. UAT tests user workflows, not individual files.

#### 4c.1: Load context for test scenario derivation

Read JOB-PLAN.md acceptance criteria (already loaded in Step 3 if it ran, otherwise load now using the same approach from Step 3).

Also read WAVE-CONTEXT.md files from all waves for design decisions that inform test scenarios:

```bash
# For each wave directory
cat .planning/waves/{setId}/{waveId}/WAVE-CONTEXT.md 2>/dev/null
```

#### 4c.2: Determine browser automation tool

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

#### 4c.3: Spawn UAT subagent (test plan phase)

Spawn the **rapid-uat** agent with the full set scope and all acceptance criteria:

```
UAT for set '{setId}' -- Phase 1: Test Plan Generation.

## Acceptance Criteria
{ALL aggregated acceptance criteria from all waves}

## User Decisions
{decisions from WAVE-CONTEXT.md files across all waves}

## Scoped Files
{ALL files from review scope -- full set scope, not chunked}

## Browser Automation Tool
{chosen tool: Chrome DevTools MCP / Playwright MCP / None}

## Working Directory
{worktreePath}

## Phase 1: Test Plan Generation
Generate a UAT test plan with each step tagged as [automated] or [human].
Return via:
<!-- RAPID:RETURN {"status":"CHECKPOINT","data":{"testPlan":[{"step":N,"description":"...","type":"automated|human","expectedResult":"...","automationDetails":"..."}]}} -->
```

#### 4c.4: Present UAT test plan for approval

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
- **question:** "Approve UAT test plan for set {setId}? ({N} steps: {automated} automated, {human} human)"
- **options:**
  - "Approve" -- description: "Run the test plan as tagged"
  - "Modify tags" -- description: "Change which steps are automated vs human"
  - "Skip UAT" -- description: "Skip acceptance testing for this set"

**If "Approve":** Proceed to Step 4c.5.

**If "Modify tags":** Use AskUserQuestion to collect modifications. Re-invoke UAT subagent with updated tags. Repeat Step 4c.4.

**If "Skip":** Move to Step 5.

#### 4c.5: Spawn UAT subagent (execution phase)

Re-invoke the **rapid-uat** agent:

```
Execute approved UAT tests for set '{setId}' -- Phase 2: Execute Tests.

## Approved Test Plan
{the approved test plan with step types}

## Browser Automation Tool
{chosen tool}

## Working Directory
{worktreePath}

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

#### 4c.6: Write REVIEW-UAT.md

Write UAT results to `.planning/waves/{setId}/REVIEW-UAT.md`:

```markdown
# UAT Review - Set {setId}

**Date:** {ISO timestamp}
**Browser tool:** {chosen tool}
**Scope:** {totalFiles} files (full set scope)

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

#### 4c.7: Log failed UAT steps as issues

For each failed UAT step, log it as a review issue:

```bash
echo '{"id":"SET-{setId}-uat-{N}","type":"uat","severity":"high","source":"uat","file":"N/A","description":"UAT step {N} failed: {description}","evidence":"{failure details}","originatingWave":"unattributed","status":"open","createdAt":"<ISO timestamp>"}' | node "${RAPID_TOOLS}" review log-issue <set-id>
```

## Step 5: Generate Review Summary

After all selected stages have completed, generate a consolidated review summary:

```bash
node "${RAPID_TOOLS}" review summary <set-id>
```

This writes `REVIEW-SUMMARY.md` to `.planning/waves/{setId}/REVIEW-SUMMARY.md`.

Print the completion banner:

```
--- RAPID Review Complete ---
Set: {setId}
Scope: {totalFiles} files across {chunks.length} chunk(s)
Unit tests: {passed} passed, {failed} failed
Bug hunt: {accepted} accepted, {dismissed} dismissed, {deferred} deferred
UAT: {passed} passed, {failed} failed, {skipped} skipped
Open issues: {count}

Review artifacts:
  .planning/waves/{setId}/REVIEW-SUMMARY.md
  .planning/waves/{setId}/REVIEW-UNIT.md
  .planning/waves/{setId}/REVIEW-BUGS.md
  .planning/waves/{setId}/REVIEW-UAT.md
-----------------------------
```

Only list artifact paths for stages that were actually run. If a stage was skipped, omit its artifact line.

## Step 6: Next Steps

Display the available next steps. Extract the setIndex from the resolve step at Step 0b:

> **Next steps:**
> - `/rapid:merge {setIndex}` -- *Set is ready, proceed to merge*
> - `/rapid:review {setIndex}` -- *Re-run review cycle on this set*

Where `{setIndex}` is the numeric index of the set resolved at Step 0.

Then exit. Do NOT prompt for selection.

## Important Notes

- **Directory chunking groups files by parent directory when scope exceeds 15 files.** Each chunk is processed by a separate agent in parallel (up to 5 concurrent). Small directories (< 3 files) merge into neighboring chunks. If chunking results in only 1 chunk, a single-agent pass is used regardless of file count.
- **Wave attribution tags findings with their originating wave.** Attribution is derived from JOB-PLAN.md file lists across all waves in the set. Files not in any job plan are tagged as `"unattributed"`. This is best-effort -- the `waveAttribution` map is built by the scope command.
- **Agent tool isolation:** This skill uses the Agent tool to spawn subagents. Each subagent runs in its own context window. Subagents CANNOT spawn sub-subagents -- this skill (the orchestrator) is the sole dispatcher.
- **Adversarial pipeline is the quality gate.** The hunter finds, the advocate challenges, the judge rules. This is not a rubber-stamp process. The three agents are independent and adversarial by design.
- **DEFERRED rulings ALWAYS require human input.** The skill pauses and presents evidence from both the hunter and the advocate. The developer makes the final call -- accept, dismiss, or defer.
- **Iteration limit is 3 bugfix cycles.** After 3 hunt-fix-re-hunt cycles, remaining bugs are presented to the user with per-bug options: fix manually, defer, or dismiss. This prevents infinite fix loops.
- **Re-hunts narrow scope.** Cycles 2 and 3 only analyze files the bugfix agent modified in the previous cycle. No re-chunking for re-hunts -- flat scope on modified files only. This prevents scope creep and ensures the re-hunt is targeted.
- **UAT runs once on the full set scope.** UAT tests user workflows across the entire set, not individual files or chunks. It is never chunked.
- **UAT browser automation depends on MCP tool availability.** If the configured browser automation tool is not available at runtime, automated steps should be converted to human steps. The UAT subagent handles this gracefully.
- **Review state is set-level.** The set transitions `complete` -> `reviewing`. The review does not modify individual wave states.
- **All review artifacts are committed at the end.** After all stages complete and REVIEW-SUMMARY.md is generated, the orchestrator should commit review artifacts alongside STATE.json.
- **Stage ordering is fixed.** When multiple stages are selected, they always run in order: unit test, then bug hunt, then UAT. This ensures unit test failures inform the bug hunt, and both inform UAT.
- **Idempotent re-entry.** If a previous review session was interrupted, re-invoking `/rapid:review` picks up where it left off. The set is already in `reviewing` state, and existing REVIEW-*.md artifacts are preserved (overwritten only if the stage runs again).
- **Token cost awareness.** The 3-agent adversarial bug hunt is the most expensive stage. Chunked parallel execution multiplies cost by chunk count per cycle. Users can control costs by selecting only the stages they need.
- **Concern-based scoping runs for unit test and bug hunt stages only.** A scoper agent categorizes files by concern area as Step 2.5. Each concern group includes cross-cutting files. If cross-cutting files exceed 50% of total, concern scoping falls back to directory chunking with a warning.
- **Deduplication runs before the adversarial pipeline.** After concern-scoped (or chunk-scoped) hunters complete, findings are merged and deduplicated. Same file + similar description (>0.7 Levenshtein similarity) = duplicate. Higher severity wins. This saves tokens by running ONE advocate and ONE judge on the deduplicated set.
- **Concern tags trace code health by area.** Each finding includes a `concern` field from the scoper. This appears in REVIEW-BUGS.md and in logged issues for understanding which concern areas surface the most bugs.
