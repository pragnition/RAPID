---
name: wave-plan
description: Run the wave planning pipeline -- research, wave plan, job plans, and contract validation
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

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

---

## Step 2: Resolve Wave and Validate State

Accept wave ID argument. The user may invoke as:
- `/rapid:wave-plan wave-1` (wave ID only -- auto-detect set)
- `/rapid:wave-plan auth wave-1` (set ID + wave ID)

Run the resolve command:

```bash
# (env preamble here)
WAVE_RESULT=$(node "${RAPID_TOOLS}" wave-plan resolve-wave <waveId>)
echo "$WAVE_RESULT"
```

Parse the JSON result:

- **If `ambiguous: true`:** Present the matches using AskUserQuestion:
  ```
  "Wave '<waveId>' exists in multiple sets. Which set did you mean?"
  Options: one per match, e.g.:
  - "auth" -- "Set: auth, Wave status: pending"
  - "data-layer" -- "Set: data-layer, Wave status: pending"
  ```
  After selection, re-resolve with the set context to get full wave data.

- **If `error`:** Display the error (which lists available waves) and STOP.

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

**Transition wave to planning:**

```bash
# (env preamble here)
node "${RAPID_TOOLS}" state transition wave "${MILESTONE_ID}" "${SET_ID}" "${WAVE_ID}" planning
```

Record `MILESTONE_ID`, `SET_ID`, `WAVE_ID`, and `JOBS` for subsequent steps.

---

## Step 3: Spawn Wave Research Agent

Display progress: "Researching implementation specifics for wave {waveId}..."

Read context to provide to the agent:
- Read `.planning/waves/{setId}/{waveId}/WAVE-CONTEXT.md`
- Read `.planning/sets/{setId}/CONTRACT.json`
- Read `.planning/sets/{setId}/SET-OVERVIEW.md` (if exists)
- Read targeted source files referenced in CONTRACT.json exports (the `file` field in each export function)

Use the Agent tool to spawn the wave-researcher:

```
Agent tool call:
- Prompt: Include the full contents of src/modules/roles/role-wave-researcher.md as instructions
- Task: "Research implementation specifics for wave '{waveId}' in set '{setId}'. Write WAVE-RESEARCH.md."
- Context: Provide all read context inline:
  - WAVE-CONTEXT.md full contents
  - CONTRACT.json full contents
  - SET-OVERVIEW.md full contents (if exists)
  - Source file contents for each export file
  - Job descriptions from the resolve step
- Instruction: "Use Context7 MCP for documentation lookups. Write output to .planning/waves/{setId}/{waveId}/WAVE-RESEARCH.md"
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

Use the Agent tool to spawn the wave-planner:

```
Agent tool call:
- Prompt: Include the full contents of src/modules/roles/role-wave-planner.md as instructions
- Task: "Produce WAVE-PLAN.md for wave '{waveId}' with per-job summaries, file assignments, and coordination notes."
- Context: Provide all read context inline:
  - WAVE-CONTEXT.md full contents
  - WAVE-RESEARCH.md full contents (if exists)
  - CONTRACT.json full contents
  - SET-OVERVIEW.md full contents (if exists)
  - OWNERSHIP.json full contents (if exists)
  - Wave jobs JSON from state get command
- Instruction: "Write output to .planning/waves/{setId}/{waveId}/WAVE-PLAN.md"
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

For each job, use the Agent tool:

```
Agent tool call (per job):
- Prompt: Include the full contents of src/modules/roles/role-job-planner.md as instructions
- Task: "Produce {jobId}-PLAN.md for job '{jobId}' with detailed implementation steps."
- Context: Provide all context inline:
  - WAVE-PLAN.md full contents (with a note highlighting which job section is for this agent)
  - WAVE-RESEARCH.md full contents
  - WAVE-CONTEXT.md full contents
  - CONTRACT.json full contents
  - Source file contents for files assigned to this job in WAVE-PLAN.md
- Instruction: "Write output to .planning/waves/{setId}/{waveId}/{jobId}-PLAN.md"
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

## Step 7: Commit and Present Results

Commit all planning artifacts:

```bash
# (env preamble here)
git add ".planning/waves/${SET_ID}/${WAVE_ID}/"
if [ -f ".planning/sets/${SET_ID}/VALIDATION-REPORT.md" ]; then
  git add ".planning/sets/${SET_ID}/VALIDATION-REPORT.md"
fi
JOB_COUNT=$(ls ".planning/waves/${SET_ID}/${WAVE_ID}/"*-PLAN.md 2>/dev/null | wc -l)
git commit -m "plan(${SET_ID}): wave ${WAVE_ID} planning complete -- research, wave plan, ${JOB_COUNT} job plans, validation"
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

Present next steps using AskUserQuestion:

```
"What would you like to do next?"
Options:
- "Run /rapid:execute" -- "Start executing this wave's jobs"
- "Plan another wave" -- "Run /rapid:wave-plan for a different wave"
- "View job plans" -- "Display the detailed JOB-PLAN.md files"
- "View /rapid:status" -- "See current project state and all wave statuses"
```

Based on selection:
- "/rapid:execute": Inform the user to run `/rapid:execute {waveId}`
- "Plan another wave": Inform the user to run `/rapid:wave-plan` with another wave ID
- "View job plans": Read and display each JOB-PLAN.md file from `.planning/waves/{setId}/{waveId}/`
- "/rapid:status": Inform the user to run `/rapid:status`

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
- **Contract validation gate:** Plans are validated BEFORE execution begins. Major violations are escalated to the user.
- **Graceful degradation:** If research fails, planning can continue from WAVE-CONTEXT.md alone. If some job planners fail, remaining plans are still validated.
- **State transitions:** Only `discussing -> planning` is handled here. The `planning -> executing` transition happens in /rapid:execute.
- **All CLI calls via RAPID_TOOLS:** Never edit STATE.json directly. All state transitions via `node "${RAPID_TOOLS}" state transition` CLI.
