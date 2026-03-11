---
description: Run the wave planning pipeline -- research, wave plan, job plans, and contract validation
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

> **Internal skill.** This is invoked programmatically by `/rapid:plan` (plan-set). Users should not call this directly. It is not listed in `/rapid:help`.

# /rapid:wave-plan -- Wave Planning Pipeline

You are the RAPID wave planning orchestrator. This skill runs the full research-plan-validate pipeline for a wave: spawn a research agent, then a wave planner, then per-job planners, then validate all plans against contracts.

Follow these steps IN ORDER. Do not skip steps. Use AskUserQuestion at every decision point.

## Step 1: Environment Setup

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

## Display Stage Banner

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner wave-plan
```

---

## Step 2: Resolve Wave and Validate State

Accept wave ID argument. The user may invoke as:
- `/rapid:wave-plan 1.1` (numeric dot notation -- set 1, wave 1)
- `/rapid:wave-plan wave-1` (wave ID only -- auto-detect set)
- `/rapid:wave-plan auth wave-1` (set ID + wave ID)

### Resolve Wave Reference

Resolve the user's input through the numeric ID resolver:

**If the user provided dot notation (e.g., `1.1`) or a wave ID:**

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve wave "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
```

Parse the JSON result to extract `setId`, `waveId`, `setIndex`, `waveIndex`, and `wasNumeric`. Use these resolved string IDs for all subsequent operations.

**If the user provided a set ID + wave ID (two arguments, e.g., `auth wave-1`):**

Use the `--set` flag for single-call two-arg resolution:
```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve wave "<wave-input>" --set "<set-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
```

Parse the JSON result to extract `setId`, `waveId`, `setIndex`, `waveIndex`, and `wasNumeric`. Use these resolved string IDs for all subsequent operations.

**After resolution, load full wave data (milestoneId, jobs, status) from STATE.json:**

```bash
# (env preamble here)
WAVE_DATA=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$WAVE_DATA"
```

Parse the JSON to find the resolved set and wave within the current milestone. Extract `milestoneId`, `setId`, `waveId`, `waveStatus`, and `jobs` from the state data.

- **If the resolved wave is not found in STATE.json:** Display: "Wave not found in state. Ensure the set has been initialized." and STOP.

- **If `resolve wave` returned an ambiguous result** (wave ID string matches multiple sets): Present the matches using AskUserQuestion:
  ```
  "Wave '<waveId>' exists in multiple sets. Which set did you mean?"
  Options: one per match, e.g.:
  - "auth" -- "Set: auth, Wave status: pending"
  - "data-layer" -- "Set: data-layer, Wave status: pending"
  ```
  After selection, re-resolve with the set context.

- **If `error`:** Display the error and STOP.

- **If single match:** Extract `milestoneId`, `setId`, `waveId`, `waveStatus`, and `jobs`.

**Status check:** Verify wave status is `discussing` (has been discussed via /rapid:discuss).

- If status is `pending`: Inform the user: "Wave has not been discussed yet. Run /rapid:discuss first." Then STOP.
- If status is `planning` or later: Use AskUserQuestion:
  ```
  "Wave '{waveId}' already has plans (status: {status}). What would you like to do?"
  Options:
  - "Re-plan from scratch" -- "Discard existing plans and re-run the full pipeline"
  - "View existing plans" -- "Read the current WAVE-PLAN.md and JOB-PLAN.md files"
  - "Cancel" -- "Return without changes"
  ```
  If "View existing plans": Read and display `.planning/waves/{setId}/{waveId}/WAVE-PLAN.md`, then STOP.
  If "Cancel": STOP.
  If "Re-plan from scratch": Continue with the flow below.

**Verify WAVE-CONTEXT.md exists** at `.planning/waves/{setId}/{waveId}/WAVE-CONTEXT.md`. If missing: "Discussion context missing. Run /rapid:discuss first." Then STOP.

Record `MILESTONE_ID`, `SET_ID`, `WAVE_ID`, and `JOBS` for subsequent steps.

---

## Step 3: Spawn Wave Research Agent

Display progress: "Researching implementation specifics for wave {waveId}..."

Read context to provide to the agent:
- Read `.planning/waves/{setId}/{waveId}/WAVE-CONTEXT.md`
- Read `.planning/sets/{setId}/CONTRACT.json`
- Read `.planning/sets/{setId}/SET-OVERVIEW.md` (if exists)
- Read targeted source files referenced in CONTRACT.json exports (the `file` field in each export function)

Spawn the **rapid-wave-researcher** agent with this task:

```
Research implementation specifics for wave '{waveId}' in set '{setId}'.

## Wave Context
{WAVE-CONTEXT.md full contents}

## Contract
{CONTRACT.json full contents}

## Set Overview
{SET-OVERVIEW.md full contents, if exists}

## Source Files
{Source file contents for each export file}

## Jobs
{Job descriptions from the resolve step}

## Working Directory
{worktreePath}

## Instructions
Use Context7 MCP for documentation lookups. Write output to .planning/waves/{setId}/{waveId}/WAVE-RESEARCH.md
```

After agent completes:
- Verify `.planning/waves/{setId}/{waveId}/WAVE-RESEARCH.md` was created (use Read to check)
- Display brief summary (first 5 lines of the file after the header)
- If agent failed (BLOCKED return or file not created), use AskUserQuestion:
  ```
  "Research agent failed: {reason}. What would you like to do?"
  Options:
  - "Retry" -- "Spawn the research agent again"
  - "Skip research" -- "Continue without research (wave planner will work from context only)"
  - "Cancel" -- "Abort the planning pipeline"
  ```
  If "Retry": Re-spawn the research agent.
  If "Skip research": Continue to Step 4 without WAVE-RESEARCH.md.
  If "Cancel": STOP.

---

## Step 4: Spawn Wave Planner Agent

Display progress: "Creating wave plan for {waveId}..."

Read additional context:
- Read `.planning/waves/{setId}/{waveId}/WAVE-RESEARCH.md` (if it exists from Step 3)
- Read `.planning/sets/OWNERSHIP.json` (if exists)
- Get wave jobs from STATE.json:
  ```bash
  # (env preamble here)
  node "${RAPID_TOOLS}" state get wave "${MILESTONE_ID}" "${SET_ID}" "${WAVE_ID}"
  ```

Spawn the **rapid-wave-planner** agent with this task:

```
Produce WAVE-PLAN.md for wave '{waveId}' with per-job summaries, file assignments, and coordination notes.

## Wave Context
{WAVE-CONTEXT.md full contents}

## Wave Research
{WAVE-RESEARCH.md full contents, if exists}

## Contract
{CONTRACT.json full contents}

## Set Overview
{SET-OVERVIEW.md full contents, if exists}

## Ownership
{OWNERSHIP.json full contents, if exists}

## Wave Jobs
{Wave jobs JSON from state get command}

## Working Directory
{worktreePath}

## Output
Write output to .planning/waves/{setId}/{waveId}/WAVE-PLAN.md
```

After agent completes:
- Verify `.planning/waves/{setId}/{waveId}/WAVE-PLAN.md` was created (use Read to check)
- Display job count and complexity breakdown (extract from WAVE-PLAN.md Job Summaries section)
- If agent failed (BLOCKED return or file not created), use AskUserQuestion:
  ```
  "Wave planner failed: {reason}. What would you like to do?"
  Options:
  - "Retry" -- "Spawn the wave planner agent again"
  - "Cancel" -- "Abort the planning pipeline"
  ```
  If "Retry": Re-spawn the wave planner agent.
  If "Cancel": STOP.

---

## Step 5: Spawn Job Planner Agents (One Per Job)

Display progress: "Creating detailed plans for {N} jobs..."

Read WAVE-PLAN.md to extract job IDs and their summaries from the "## Job Summaries" section. Each job has a `### Job: {job-id}` subsection.

For each job in the wave:
- Read the job's section from WAVE-PLAN.md
- Read targeted source files for this specific job (from the job's "Key Files" in WAVE-PLAN.md)

**Spawning strategy:**
- If 3 or more jobs: Spawn all job planner agents **in parallel** using multiple Agent tool calls in a single response.
- If 1-2 jobs: Spawn them sequentially.

For each job, spawn the **rapid-job-planner** agent with this task:

```
Produce {jobId}-PLAN.md for job '{jobId}' with detailed implementation steps.

## Your Job Section
{Job section from WAVE-PLAN.md highlighted for this specific job}

## Wave Plan
{WAVE-PLAN.md full contents}

## Wave Research
{WAVE-RESEARCH.md full contents}

## Wave Context
{WAVE-CONTEXT.md full contents}

## Contract
{CONTRACT.json full contents}

## Source Files
{Source file contents for files assigned to this job in WAVE-PLAN.md}

## Working Directory
{worktreePath}

## Output
Write output to .planning/waves/{setId}/{waveId}/{jobId}-PLAN.md
```

After all agents complete:
- List which JOB-PLAN.md files were created (use Glob to check `.planning/waves/{setId}/{waveId}/*-PLAN.md`)
- Display a summary table: job ID, file created (yes/no), estimated complexity
- If any agent failed, use AskUserQuestion:
  ```
  "Some job plans failed to generate:
  - {jobId}: {reason}

  What would you like to do?"
  Options:
  - "Retry failed" -- "Re-spawn only the failed job planner agents"
  - "Continue without them" -- "Proceed to validation with the plans that were generated"
  - "Cancel" -- "Abort the planning pipeline"
  ```
  If "Retry failed": Re-spawn only the failed agents.
  If "Continue without them": Proceed to Step 6 with available plans.
  If "Cancel": STOP.

---

## Step 5.5: Plan Verification

Display progress: "Verifying job plans for {waveId}..."

Read all context needed for the verifier:
- Read `.planning/waves/{setId}/{waveId}/WAVE-PLAN.md`
- Read `.planning/waves/{setId}/{waveId}/WAVE-CONTEXT.md`
- Read all JOB-PLAN.md files from `.planning/waves/{setId}/{waveId}/` (use Glob to discover `*-PLAN.md` files, then Read each one)

Concatenate all JOB-PLAN.md contents with `### {filename}` headers between them.

Spawn the **rapid-plan-verifier** agent with this task:

```
Verify all job plans for wave '{waveId}' in set '{setId}'.

## Wave Plan
{WAVE-PLAN.md full contents}

## Wave Context
{WAVE-CONTEXT.md full contents}

## Job Plans
{All JOB-PLAN.md file contents, each preceded by ### {filename} header}

## Working Directory
{worktreePath from Step 2}

## Output
Write VERIFICATION-REPORT.md to .planning/waves/{setId}/{waveId}/VERIFICATION-REPORT.md
```

After agent completes:
- Read the structured return to extract `verdict` and `failingJobs`
- Read `.planning/waves/{setId}/{waveId}/VERIFICATION-REPORT.md`

**If verdict is PASS:**
Display: "All plans verified. Proceeding to contract validation."
Continue to Step 6.

**If verdict is PASS_WITH_GAPS:**
Display the gaps from the report's Summary section as a warning.
Display: "Plans verified with minor gaps (see VERIFICATION-REPORT.md). Proceeding."
Continue to Step 6.

**If verdict is FAIL:**
Display the failures from the report's Summary section.

Use AskUserQuestion:
```
"Plan verification FAILED for wave {waveId}:

{Summary section from VERIFICATION-REPORT.md}

Failing jobs: {failingJobs list}

What would you like to do?"
Options:
- "Re-plan failing jobs" -- "Re-spawn job planners only for the failing jobs ({failingJobs}), then re-verify"
- "Override" -- "Proceed despite failures (you take responsibility for plan issues)"
- "Cancel" -- "Stop and investigate (wave stays in discussing state)"
```

If "Re-plan failing jobs":
  - Re-read WAVE-PLAN.md and WAVE-RESEARCH.md
  - For each job ID in `failingJobs`, re-spawn the **rapid-job-planner** agent with the same task prompt as Step 5 but only for that specific job
  - After all re-planned job planners complete, re-run the verification by spawning the **rapid-plan-verifier** agent again
  - If the re-verification also returns FAIL, present AskUserQuestion with only "Override" and "Cancel" options (no second re-plan -- maximum 1 re-plan attempt)
  - If re-verification returns PASS or PASS_WITH_GAPS, continue to Step 6

If "Override":
  Log the override in the terminal: "Proceeding with plan verification overridden by user."
  Continue to Step 6.

If "Cancel":
  Display: "Planning cancelled. Wave remains in 'discussing' state. Investigate the issues in VERIFICATION-REPORT.md and re-run /rapid:wave-plan when ready."
  STOP.

---

## Step 6: Contract Validation Gate

Display progress: "Validating job plans against contracts..."

Run the contract validation via CLI:

```bash
# (env preamble here)
VALIDATION_RESULT=$(node "${RAPID_TOOLS}" wave-plan validate-contracts "${SET_ID}" "${WAVE_ID}")
echo "$VALIDATION_RESULT"
```

Parse the JSON output (`violations`, `autoFixes`, `jobPlansFound`).

Determine the result:
- **PASS** (no violations, no autoFixes): Display "All job plans validated successfully against contracts."
- **PASS_WITH_WARNINGS** (autoFixes but no major violations): Display auto-fixes noted and minor issues. Continue.
- **FAIL** (any major violations): Display major violations and escalate to the user.

**For PASS_WITH_WARNINGS:** Display each auto-fix:
```
"Contract validation passed with {N} auto-fix suggestions:
- {autoFix.type}: {autoFix.detail} -> Fix: {autoFix.fix}"
```

**For FAIL:** For each major violation, use AskUserQuestion:
```
"Contract violation: {violation.detail}"
Options:
- "Fix plan" -- "Remove the problematic import/export and find an alternative approach"
- "Update contract" -- "Add the missing export to the source set's contract"
- "Override" -- "Proceed anyway -- may be resolved during execution"
```
If "Fix plan": Note the fix needed and update the relevant JOB-PLAN.md.
If "Update contract": Note the contract update needed for the other set.
If "Override": Log the override and continue.

**Write VALIDATION-REPORT.md** to `.planning/sets/{setId}/VALIDATION-REPORT.md`:

```markdown
# VALIDATION-REPORT: {waveId}

**Set:** {setId}
**Wave:** {waveId}
**Validated:** {date}
**Result:** {PASS | PASS_WITH_WARNINGS | FAIL (overridden)}

## Job Plans Validated

{N} job plans found and validated.

## Violations

| # | Severity | Detail | Resolution |
|---|----------|--------|------------|
| {n} | {major/minor} | {detail} | {fix/update/override/auto-fixed} |

## Auto-Fixes Suggested

| # | Type | Detail | Suggested Fix |
|---|------|--------|---------------|
| {n} | {type} | {detail} | {fix} |

## Cross-Set Dependency Check

{Summary of cross-set import validation results}
```

---

## Step 6.5: Transition Wave to Planning

All validation complete. Transition the wave state:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" state transition wave "${MILESTONE_ID}" "${SET_ID}" "${WAVE_ID}" planning
```

This transition was deferred from Step 2 to ensure verification passes before the wave enters `planning` state.

---

## Step 7: Commit and Present Results

Commit all planning artifacts:

```bash
# (env preamble here)
git add ".planning/waves/${SET_ID}/${WAVE_ID}/"
if [ -f ".planning/sets/${SET_ID}/VALIDATION-REPORT.md" ]; then
  git add ".planning/sets/${SET_ID}/VALIDATION-REPORT.md"
fi
JOB_COUNT=$(ls ".planning/waves/${SET_ID}/${WAVE_ID}/"*-PLAN.md 2>/dev/null | wc -l)
git commit -m "plan(${SET_ID}): wave ${WAVE_ID} planning complete -- research, wave plan, ${JOB_COUNT} job plans, verification, validation"
```

Display summary:

```
"Wave planning complete for {waveId} in set {setId}!

- Wave plan: {N} jobs with complexity breakdown ({S count} S, {M count} M, {L count} L)
- Job plans: {N} created
  - {jobId-1}-PLAN.md
  - {jobId-2}-PLAN.md
  ...
- Validation: {PASS / PASS_WITH_WARNINGS / FAIL (overridden)}
- Auto-fixes suggested: {N}
- Violations found: {N major}, {N minor}"
```

Display the next step using the setIndex and waveIndex already resolved in Step 2:

> **Next step:** `/rapid:execute {setIndex}`
> *(Execute wave {waveIndex} of {setId})*

---

## Error Handling

- If RAPID_TOOLS is not set: Show error and suggest running `/rapid:install`
- If STATE.json is missing or invalid: Show error and suggest running `/rapid:init` first
- If WAVE-CONTEXT.md is missing: Show error and suggest running `/rapid:discuss` first
- If CONTRACT.json is missing: Warn but continue -- validation step will be limited
- If any agent returns BLOCKED: Display the blocker reason and offer retry/skip/cancel via AskUserQuestion
- All errors should be descriptive with clear next steps for the user

## Key Principles

- **Sequential pipeline:** Research -> Wave Plan -> Job Plans -> Validation. Each stage depends on the prior output.
- **Parallel job planners:** When 3+ jobs exist, spawn Job Planner agents in parallel for faster pipeline completion.
- **Plan verification gate:** Plans are verified for coverage, implementability, and consistency BEFORE contract validation. FAIL blocks state transition.
- **Contract validation gate:** Plans are validated BEFORE execution begins. Major violations are escalated to the user.
- **Graceful degradation:** If research fails, planning can continue from WAVE-CONTEXT.md alone. If some job planners fail, remaining plans are still validated.
- **State transitions:** `discussing -> planning` is deferred until AFTER plan verification and contract validation both pass. This ensures a FAIL verdict blocks execution.
- **All CLI calls via RAPID_TOOLS:** Never edit STATE.json directly. All state transitions via `node "${RAPID_TOOLS}" state transition` CLI.
