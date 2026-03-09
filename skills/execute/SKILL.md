---
description: Execute jobs within waves -- dispatches parallel subagents per job, tracks progress, reconciles per wave
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion
---

# /rapid:execute -- Job Execution Orchestrator

You are the RAPID execution orchestrator. This skill executes all waves in a given set sequentially. Each wave dispatches parallel subagents (one per job), tracks per-job progress, reconciles deliverables, and prompts for next action. Jobs are defined by JOB-PLAN.md files produced by `/rapid:discuss` and `/rapid:wave-plan`. Follow these steps IN ORDER. Do not skip steps.

## Step 0: Environment + Precondition Check

### 0a: Load environment

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

### 0b: Parse set-id argument

The user invokes this skill with a set identifier: `/rapid:execute <set-id>` (e.g., `/rapid:execute auth-system` or `/rapid:execute 1`).

#### Resolve Set Reference

If `<set-id>` was provided, resolve it through the numeric ID resolver before any other operations:

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
SET_NAME=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
```

Use `SET_NAME` for all subsequent operations. The numeric input has been resolved to a string ID.

If `<set-id>` was not provided, use AskUserQuestion to ask:
- **question:** "Which set to execute?"
- **options:** List available sets from STATE.json

### 0b.1: Check for --fix-issues flag

If the user invoked `/rapid:execute <set-id> --fix-issues`, enter issue fix mode instead of normal execution:

1. Load all open issues:
   ```bash
   node "${RAPID_TOOLS}" review list-issues <set-id> --status open
   ```

2. If no open issues: inform user "No open issues for set '{set-id}'." and exit.

3. Present issue summary to user using AskUserQuestion:
   - **question:** "{N} open issue(s) across {W} waves. Fix all or select?"
   - **options:**
     - "Fix all" -- description: "Spawn bugfix agent for all {N} open issues"
     - "Select issues" -- description: "Choose which issues to fix"
     - "Cancel" -- description: "Exit without fixing"

4. For "Fix all" or selected issues: spawn a bugfix subagent (role: bugfix) with the issues as input. The bugfix agent will:
   - Read each issue's file and description
   - Apply targeted fixes
   - Commit atomically
   - Return COMPLETE with fixed/unfixable arrays

5. After bugfix returns, update issue statuses:
   ```bash
   node "${RAPID_TOOLS}" review update-issue <set-id> <wave-id> <issue-id> fixed
   ```

6. Print summary of fixes and exit.

### 0c: Read STATE.json for set and wave information

```bash
node "${RAPID_TOOLS}" state get --all
```

Parse the JSON output to find the target set and its waves. Identify the milestone ID, set ID, and all wave IDs within the set.

### 0d: Verify JOB-PLAN.md files exist

For each wave in the set, check that JOB-PLAN.md files exist:

```bash
node "${RAPID_TOOLS}" wave-plan list-jobs <set-id> <wave-id>
```

Parse the JSON output. If no JOB-PLAN.md files exist for ANY wave in the set, inform the user:

> No job plans found for set '{set-id}'. Run `/rapid:discuss` and `/rapid:wave-plan` first to create job plans.

Then use AskUserQuestion:
- **question:** "No job plans found"
- **options:**
  - "Run discuss" -- description: "Exit to run /rapid:discuss and /rapid:wave-plan first"
  - "Cancel" -- description: "Exit without action"

Do NOT auto-trigger `/rapid:discuss` or `/rapid:wave-plan`. Exit after the user responds.

## Step 1: Detect Execution Mode

Check if agent teams mode is available:

```bash
node "${RAPID_TOOLS}" execute detect-mode
```

Parse the JSON output to get `agentTeamsAvailable`.

**If `agentTeamsAvailable` is true:**
Use AskUserQuestion to prompt the developer:
- **question:** "Exec mode"
- **options:**
  - "Agent Teams" -- description: "Faster parallel execution via Claude Code agent teams. Locked for entire run."
  - "Subagents" -- description: "Proven stable execution via subagent spawning. Locked for entire run."

If the developer selects "Agent Teams", set `executionMode = 'Agent Teams'`.
If the developer selects "Subagents", set `executionMode = 'Subagents'`.

**If `agentTeamsAvailable` is false:**
Silently set `executionMode = 'Subagents'`. Do NOT prompt or inform the user about agent teams.

**Mode is locked for the entire execution run.** Do not re-detect or re-prompt during wave processing.

## Step 2: Smart Re-entry

Read all job statuses across all waves in this set:

```bash
node "${RAPID_TOOLS}" execute job-status <set-id>
```

Parse the JSON output. For each wave, classify every job:

| Current Status | Action | Display |
|---------------|--------|---------|
| `complete` | Skip | "already complete" |
| `failed` | Re-execute | "retrying, previously failed" |
| `executing` | Treat as stale/failed, re-execute | "stale state, re-executing" |
| `pending` | Normal execution | "pending" |

Show a summary of what will be executed vs skipped:

```
--- Re-entry Summary ---
Wave {waveId}:
  {jobId}: pending
  {jobId}: already complete (skip)
  {jobId}: retrying, previously failed
Wave {waveId}:
  {jobId}: pending
  {jobId}: stale state, re-executing
------------------------
```

**If ALL jobs across ALL waves are complete**, inform the user:

> All jobs in set '{set-id}' are already complete. Nothing to execute.

Use AskUserQuestion:
- **question:** "All jobs complete"
- **options:**
  - "View status" -- description: "Run /rapid:status to review"
  - "Done" -- description: "Exit"

Exit after the user responds.

**If there are jobs to execute**, use AskUserQuestion:
- **question:** "Begin execution?"
- **options:**
  - "Begin execution" -- description: "Execute {N} pending/failed jobs across {M} waves"
  - "Cancel" -- description: "Exit without executing"

If the developer selects "Cancel", print "Execution cancelled." and exit.

## Step 3: Process Each Wave (Sequential)

For each wave in order (Wave 1, Wave 2, etc.), perform Steps 3a through 3i. If a wave has no jobs needing execution (all complete), skip it with a message: "Wave {waveId}: all jobs complete, skipping."

### Step 3a: Transition wave to 'executing'

```bash
node "${RAPID_TOOLS}" state transition wave <milestone> <set-id> <wave-id> executing
```

### Step 3b: Load job plans for this wave

```bash
node "${RAPID_TOOLS}" wave-plan list-jobs <set-id> <wave-id>
```

Parse the JSON output to get the list of JOB-PLAN.md file paths. Read each JOB-PLAN.md file to get its content, file ownership assignments, and implementation steps.

### Step 3c: Print initial progress banner

```
--- RAPID Execute ---
Wave {waveId} ({waveIndex}/{totalWaves})
  {jobId}: Pending
  {jobId}: Pending
  {jobId}: Complete (skipped)
[HH:MM]
---------------------
```

Derive the timestamp from `date +%H:%M`. Show all jobs in the wave -- mark complete jobs as "Complete (skipped)" and jobs to execute as "Pending".

### Step 3d: Dispatch parallel jobs

Filter jobs that need execution (status is `pending`, `failed`, or stale `executing`). Dispatch them based on the execution mode.

#### Subagent Mode

For each job that needs execution:

1. **Transition job to 'executing':**
   ```bash
   node "${RAPID_TOOLS}" state transition job <milestone> <set-id> <wave-id> <job-id> executing
   ```

2. **Print updated progress** showing this job as "Executing":
   ```
   --- RAPID Execute ---
   Wave {waveId} ({waveIndex}/{totalWaves})
     {jobId}: Executing
     {jobId}: Pending
   [HH:MM]
   ---------------------
   ```

3. **Spawn subagent** using the Agent tool with the job executor prompt:

   ```
   You are implementing job '{jobId}' in set '{setId}'.

   ## Your JOB-PLAN
   {Full content of {jobId}-PLAN.md}

   ## File Ownership
   You may ONLY modify these files:
   {File list from WAVE-PLAN.md or JOB-PLAN.md file assignments}

   ## Commit Convention
   After each implementation step, commit with:
     git add <specific files>
     git commit -m "type({setId}): description"
   Where type is feat|fix|refactor|test|docs|chore

   ## Working Directory
   {worktreePath -- from the set's worktree}

   ## Completion
   When all steps are complete, emit your final output in this format:

   ## COMPLETE

   | Field | Value |
   |-------|-------|
   | Status | COMPLETE |
   | Artifacts | `file1`, `file2` |
   | Commits | abc1234, def5678 |
   | Tasks | N/N |

   <!-- RAPID:RETURN {"status":"COMPLETE","artifacts":["file1","file2"],"commits":["abc1234","def5678"],"tasks_completed":N,"tasks_total":N} -->

   If your context window is running low and you have remaining work:
   <!-- RAPID:RETURN {"status":"CHECKPOINT","tasks_completed":N,"tasks_total":M,"handoff_done":"...","handoff_remaining":"...","handoff_resume":"..."} -->

   If blocked on something outside your scope:
   <!-- RAPID:RETURN {"status":"BLOCKED","category":"DEPENDENCY|PERMISSION|CLARIFICATION|ERROR","detail":"description"} -->
   ```

**All jobs in a wave are spawned in parallel** (multiple Agent tool calls in a single response). If rate limits are hit (Agent tool errors with rate-limit-like messages such as 429, "rate limit", or "too many"), fall back to sequential execution within the wave and inform the user:

> Warning: Rate limit hit. Falling back to sequential job execution for this wave.

#### Agent Teams Mode

Same prompt as subagent mode, but dispatched via agent teams:

1. **Determine team name:**
   ```
   rapid-{setId}-{waveId}
   ```

2. **For each job**, prepare teammate config using the same executor prompt as subagent mode. Each teammate works in the set's worktree directory.

3. **Spawn all teammates** in the team simultaneously.

4. **Track completions.** As each teammate completes, print updated progress.

**If any team operation fails** (team spawn, teammate crash, any error):

Print a visible warning:
> **Warning:** Agent teams failed for wave {waveId}. Falling back to subagent execution.

Then re-execute the ENTIRE wave using subagent mode (above). This is a generic fallback -- do not inspect or special-case the error type.

### Step 3e: Collect returns and transition jobs

After each subagent/teammate returns, process the output:

**Parse the RAPID:RETURN marker** from the subagent output. Look for `<!-- RAPID:RETURN {...} -->` in the output text and parse the JSON.

**If status is COMPLETE:**
- Transition job to 'complete':
  ```bash
  node "${RAPID_TOOLS}" state transition job <milestone> <set-id> <wave-id> <job-id> complete
  ```
- Print updated progress showing this job as "Complete"

**If status is CHECKPOINT:**
- Generate a job handoff file at `.planning/waves/{setId}/{waveId}/{jobId}-HANDOFF.md` containing the handoff data (completed work, remaining work, resume instructions, task counts)
- Job status stays as 'executing' in STATE.json (the skill notes it as paused for retry)
- Print updated progress showing this job as "Paused (checkpoint)"

**If status is BLOCKED:**
- Transition job to 'failed':
  ```bash
  node "${RAPID_TOOLS}" state transition job <milestone> <set-id> <wave-id> <job-id> failed
  ```
- Print updated progress showing this job as "BLOCKED ({category}: {detail})"

**If no RAPID:RETURN marker found in the output:**
- Transition job to 'failed':
  ```bash
  node "${RAPID_TOOLS}" state transition job <milestone> <set-id> <wave-id> <job-id> failed
  ```
- Print warning: "Warning: Job '{jobId}' returned without a RAPID:RETURN marker. Marking as failed."
- Print updated progress showing this job as "Failed (no return marker)"

### Step 3f: Commit STATE.json after all jobs in wave resolve

After all jobs in the wave have returned (complete, failed, or checkpointed):

```bash
node "${RAPID_TOOLS}" execute commit-state "chore({setId}): complete wave {waveId} execution"
```

### Step 3g: Reconcile wave

Run job-level wave reconciliation:

```bash
node "${RAPID_TOOLS}" execute reconcile-jobs <set-id> <wave-id> --branch main --mode "{executionMode}"
```

Parse the JSON output for:
- `overall`: PASS, PASS_WITH_WARNINGS, or FAIL
- `hardBlocks`: list of hard blocking issues
- `softBlocks`: list of soft blocking issues (missing files, commit format violations)
- `jobResults`: per-job reconciliation details

Present results to the user:

```
--- Wave {waveId} Reconciliation ---
Overall: {PASS/PASS_WITH_WARNINGS/FAIL}

{For each job:}
  {jobId}: {filesDelivered}/{filesPlanned} files
    Missing: {list or "none"}
    Commit violations: {list or "none"}

Hard blocks: {count or "none"}
Soft blocks: {count or "none"}
---------------------------------
```

### Step 3g.1: Lean wave review

After successful reconciliation (PASS or PASS_WITH_WARNINGS), run lean review automatically:

```bash
node "${RAPID_TOOLS}" review lean <set-id> <wave-id>
```

Parse the JSON output for `{ issues, autoFixed, needsAttention }`.

**If autoFixed > 0 and needsAttention is empty:** Print silently:
> Lean review: {autoFixed} issue(s) auto-fixed.

Continue to next step.

**If needsAttention is not empty:** Present each issue briefly, then use AskUserQuestion:
- **question:** "Lean review found {N} issue(s) that could not be auto-fixed"
- **options:**
  - "Log and continue" -- description: "Record issues for later review via /rapid:review. Recommended."
  - "Pause execution" -- description: "Stop here to investigate. Resume with /rapid:execute {set-id}."

If "Log and continue": proceed to next step (issues are already logged in REVIEW-ISSUES.json).
If "Pause execution": commit state and exit with resume instructions.

**If reconciliation was FAIL:** Skip lean review entirely (wave needs re-execution first).

### Step 3h: Transition wave status

After reconciliation, transition wave status:

```bash
node "${RAPID_TOOLS}" state transition wave <milestone> <set-id> <wave-id> reconciling
```

If reconciliation result is PASS or PASS_WITH_WARNINGS:
```bash
node "${RAPID_TOOLS}" state transition wave <milestone> <set-id> <wave-id> complete
```

If reconciliation result is FAIL, leave wave in 'reconciling' state for retry.

### Step 3i: User decision after wave reconciliation

Use AskUserQuestion with dynamic options based on the reconciliation result:

**If PASS:**
- **question:** "Wave {waveId} reconciliation passed"
- **options:**
  - "Continue to next wave" -- description: "All deliverables verified. Proceed to wave {nextWaveId}."
  - "Pause here" -- description: "Save state and exit. Resume with /rapid:execute {set-id}."

**If PASS_WITH_WARNINGS:**
- **question:** "Wave {waveId} reconciliation passed with warnings"
- **options:**
  - "Continue anyway" -- description: "Accept warnings and proceed to wave {nextWaveId}"
  - "Retry failed jobs" -- description: "Re-execute only the jobs with issues in this wave"
  - "Pause" -- description: "Save state and exit. Resume with /rapid:execute {set-id}."

**If FAIL:**
- **question:** "Wave {waveId} reconciliation failed"
- **options:**
  - "Retry failed jobs" -- description: "Re-execute failed jobs in this wave"
  - "Cancel execution" -- description: "Save state and exit"

**Action based on user choice:**
- "Continue" / "Continue anyway": Proceed to the next wave (back to Step 3a for next wave)
- "Retry failed jobs": Re-execute only failed jobs in this wave (go back to Step 3d for those jobs only, with other jobs showing as complete)
- "Pause" / "Pause here": Commit state and print resume instructions:
  > Execution paused after wave {waveId}. Resume with `/rapid:execute {set-id}`.
  Exit.
- "Cancel execution": Commit state and exit:
  > Execution cancelled. State saved. Resume with `/rapid:execute {set-id}`.
  Exit.

## Step 4: Final Summary

After all waves in the set complete:

```
--- RAPID Execute Complete ---
Set: {setId}
Waves: {completedWaves}/{totalWaves}
Jobs: {completedJobs}/{totalJobs}
Execution mode: {executionMode}
-------------------------------
```

Show per-wave breakdown:
```
Wave {waveId}: {status}
  {jobId}: {status}
  {jobId}: {status}
```

Use AskUserQuestion for next steps:
- **question:** "Execution complete"
- **options:**
  - "View status" -- description: "Run /rapid:status to review detailed state"
  - "Start review" -- description: "Begin review pipeline for completed work"
  - "Done" -- description: "Exit -- work committed on worktree branch"

## Important Notes

- **Agent tool isolation:** This skill uses the Agent tool to spawn subagents. Each subagent runs in its own context window. Subagents CANNOT spawn sub-subagents -- this skill (the orchestrator) is the sole dispatcher.
- **Rate limiting:** If spawning multiple parallel subagents causes rate limit errors, reduce to sequential execution within the wave and inform the user. Do not retry the parallel batch -- switch to sequential for the remainder of the wave.
- **Smart re-entry:** On every invocation, read STATE.json first. Skip complete jobs, retry failed jobs, re-execute stale 'executing' jobs. This makes the skill idempotent and crash-safe.
- **File ownership enforcement:** Each job may only modify files listed in its JOB-PLAN.md. File ownership violations are caught during wave reconciliation (Step 3g). The orchestrator does not enforce this at dispatch time -- it is the job executor's responsibility.
- **Git commits:** Parallel job agents commit to the same branch in the same worktree. Each stages only its own files via `git add <specific files>`. If a commit fails with a HEAD race (`error: cannot lock ref 'HEAD'`), the job executor should retry once.
- **STATE.json committed at workflow boundaries:** STATE.json is committed after each wave completes (Step 3f), not after every individual job transition. Individual job transitions write to STATE.json in-memory/on-disk but the git commit happens at the wave boundary.
- **Backward compatibility:** The existing `role-executor.md` stays for v1.0 set-level execution. New job-level execution uses `role-job-executor.md`. Both are registered in the assembler.
- **Discuss and plan are NOT part of this skill.** If JOB-PLAN.md files are missing, prompt the user to run `/rapid:discuss` and `/rapid:wave-plan` first. Do NOT auto-trigger those commands.
- **Dual-mode execution:** Mode is detected once at Step 1 and locked for the entire run. Agent teams mode creates one team per wave with one teammate per job. Both modes use identical prompt templates, reconciliation, and progress output.
- **Teams fallback:** If any agent teams operation fails mid-execution, the entire wave is re-executed using subagent mode. The fallback is generic -- do not inspect or special-case the error type. A visible warning is printed when fallback occurs.
- **No inter-agent messaging:** Job executor subagents work in isolation. They share a branch but modify different files. There is no inter-agent communication channel. File ownership from WAVE-PLAN.md prevents conflicts.
- **Handoff storage:** Job-level handoffs are stored at `.planning/waves/{setId}/{waveId}/{jobId}-HANDOFF.md`, separate from v1.0 set-level handoffs at `.planning/sets/{setName}/HANDOFF.md`.
