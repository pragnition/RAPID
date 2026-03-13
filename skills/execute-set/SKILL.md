---
description: Execute all waves in a set -- one executor per wave, sequential, artifact-based re-entry
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
---

# /rapid:execute-set -- Set Execution

You are the RAPID set execution orchestrator. This skill executes all waves in a set sequentially. Each wave spawns one **rapid-executor** agent. Completion is detected via WAVE-COMPLETE.md marker files and git commit verification. After all waves complete, a **rapid-verifier** agent runs lean post-execution verification.

Follow these steps IN ORDER. Do not skip steps.

## Step 0: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

Display the stage banner:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" display banner execute-set
```

---

## Step 1: Resolve Set and Validate Preconditions

Accept set identifier. The user invokes as:
- `/rapid:execute-set 1` (numeric index)
- `/rapid:execute-set auth-system` (string set ID)
- `/rapid:execute-set 1 --gaps` (gap closure mode)

### Resolve Set Reference

If `<set-id>` was provided, resolve it through the numeric ID resolver:

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
SET_ID=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
SET_INDEX=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.setIndex)")
```

Use `SET_ID` for all subsequent operations.

If `<set-id>` was not provided, use AskUserQuestion to ask:
- **question:** "Which set to execute?"
- **options:** List available sets from STATE.json

### Check for --gaps Flag

Parse the user's input for the `--gaps` flag. If present, only execute waves without WAVE-COMPLETE.md markers (gap closure mode). This is used after gap resolution planning to execute only the newly planned gap-closure waves.

### Load Full State

```bash
# (env preamble here)
STATE_JSON=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$STATE_JSON"
```

Parse the JSON to find the resolved set within the current milestone. Extract `MILESTONE`.

### Validate Set Status

- **If `planning`:** Expected state for first execution. Continue.
- **If `executing`:** Re-entry scenario. Continue (will pick up from last complete wave).
- **If `pending` or `discussing`:** Error -- set is not ready for execution.
  Display: "Set '{SET_ID}' is in '{status}' state. Run /rapid:discuss-set and /rapid:plan-set first."
  Show error breadcrumb:
  ```
  init [done] > start-set [done] > discuss-set > plan-set > execute-set [FAILED: set not ready] > review > merge
  ```
  STOP.
- **If `complete` or `merged`:** Already done.
  Display: "Set '{SET_ID}' is already '{status}'."
  Suggest: `/rapid:review {SET_INDEX}`
  Show breadcrumb:
  ```
  init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge
  ```
  STOP.

### Read PLAN.md Files

Glob `.planning/sets/${SET_ID}/wave-*-PLAN.md` to find all wave plans.

If no PLAN.md files found:
  Display: "No wave plans found for set '{SET_ID}'. Run /rapid:plan-set {SET_INDEX} first."
  Show error breadcrumb:
  ```
  init [done] > start-set [done] > discuss-set [done] > plan-set > execute-set [FAILED: no plans] > review > merge
  ```
  STOP.

Count total waves from PLAN.md files.

### Determine Worktree Path

Determine the worktree path for this set. Check `.rapid-worktrees/{SET_ID}` or equivalent worktree directory.

---

## Step 2: Re-Entry Detection (Artifact-Based)

For each wave N (1 to total_waves):

1. Check if `.planning/sets/${SET_ID}/WAVE-${N}-COMPLETE.md` exists
2. If marker exists: read it, extract commit hashes, verify commits exist on worktree branch via `git -C {worktreePath} log --oneline main..HEAD | grep {commitHash}`
3. If marker exists AND commits verified: mark wave as complete (skip)
4. If marker missing OR commits don't match: mark wave for execution

Display re-entry summary:

```
Wave 1: complete (skipping)
Wave 2: pending (will execute)
Wave 3: pending (will execute)
```

If ALL waves complete:
  Display: "All waves in set '{SET_ID}' already complete."
  Suggest: `/rapid:review {SET_INDEX}`
  STOP.

If not first run (some waves complete):
  Display: "Resuming execution from wave {N}..."

---

## Step 3: State Transition

If set is in `planning` state:
```bash
# (env preamble here)
node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" executing
```

If set is already in `executing` state: skip transition (re-entry).

---

## Step 4: Execute Waves

### 4a: Analyze Wave Dependencies

Build a wave dependency graph from the plan files. For each wave-N-PLAN.md, check if it declares dependencies on other waves (e.g., "Depends on: Wave 1" or explicit wave dependency declarations).

**Default behavior:** If no explicit inter-wave dependencies are declared, treat all waves as independent (single parallel batch containing all waves). This is safe because wave plans produced by the planner already encode dependency through file ownership -- Wave 2 builds on Wave 1's outputs.

**If dependencies exist:** Group waves into parallel batches using BFS level assignment:
- Batch 1: Waves with no dependencies (level 0)
- Batch 2: Waves depending only on Batch 1 waves (level 1)
- etc.

Display the execution plan:

```
Wave execution plan:
  Batch 1 (parallel): Wave 1, Wave 3
  Batch 2 (parallel): Wave 2, Wave 4
  Batch 3 (sequential): Wave 5
```

For most sets, waves have linear dependencies (Wave 2 depends on Wave 1, etc.), which produces one wave per batch -- effectively sequential execution. This is the expected degenerate case.

### 4b: Execute Wave Batches

For each batch in order:

**If batch contains a single wave:** Spawn one **rapid-executor** agent with the standard task prompt (including git commit instructions):

```
Implement wave {N} for set '{SET_ID}'.

## Your PLAN
{Full content of wave-{N}-PLAN.md}

## Commit Convention
After each task, commit with: type({SET_ID}): description
Where type is feat|fix|refactor|test|docs|chore

## Working Directory
{worktreePath}
```

**If batch contains multiple waves:** Spawn all **rapid-executor** agents in the batch simultaneously using parallel tool calls. Each agent receives its own wave's PLAN.md content.

CRITICAL: Executors in parallel batches must NOT commit to git. Instead, they make file changes and report what they changed in their RAPID:RETURN. The orchestrator commits sequentially after all executors in a batch complete.

For each parallel executor, use this task prompt:

```
Implement wave {N} for set '{SET_ID}'.

## Your PLAN
{Full content of wave-{N}-PLAN.md}

## Commit Convention
DO NOT run git commit. Make your file changes only.
The orchestrator will commit your changes after verification.
Report all modified files in your RAPID:RETURN artifacts list.

## Working Directory
{worktreePath}
```

### 4c: Process Batch Results

After all executors in a batch return, parse the `<!-- RAPID:RETURN {...} -->` marker from each executor output.

**For single-wave batches (sequential):**

Process the RAPID:RETURN exactly as follows:

**If COMPLETE:**

1. Verify at least one commit exists: `git -C {worktreePath} log --oneline main..HEAD` (must have commits since execution start)
2. Check no uncommitted changes: `git -C {worktreePath} status --porcelain` (should be empty or only untracked)
3. If both pass: Write WAVE-{N}-COMPLETE.md marker to `.planning/sets/${SET_ID}/WAVE-${N}-COMPLETE.md`:

   ```markdown
   # Wave {N} Complete

   **Set:** {SET_ID}
   **Wave:** {N}
   **Completed:** {ISO timestamp}
   **Executor commits:** {comma-separated commit hashes from git log}
   **Branch:** rapid/{SET_ID}
   **Reconciliation:** basic-pass
   ```

4. Display: "Wave {N}: complete."
5. Optionally transition wave state: call `node "${RAPID_TOOLS}" state transition wave "${MILESTONE}" "${SET_ID}" "wave-{N}" executing` then `complete`
6. Continue to next batch.

**If CHECKPOINT:**

1. Write handoff file to `.planning/sets/${SET_ID}/WAVE-${N}-HANDOFF.md` with checkpoint data (completed work, remaining work, resume instructions)
2. Display: "Wave {N}: paused at checkpoint. Resume with /rapid:execute-set {SET_INDEX}"
3. STOP.

**If BLOCKED:**

1. Display blocker: "Wave {N}: BLOCKED ({category}: {detail})"
2. STOP.

**If no RAPID:RETURN found:**

1. Display: "Warning: Wave {N} executor returned without RAPID:RETURN marker."
2. Check if executor made commits anyway (`git -C {worktreePath} log --oneline main..HEAD`). If commits exist, write marker and continue. If no commits, STOP with error.

**For multi-wave batches (parallel):**

After ALL executors in the batch return:

1. **Collect results:** Parse RAPID:RETURN from each executor.

2. **Handle failures:** If ANY executor in the batch returned BLOCKED or had errors:
   - Completed waves in the batch are still committed (their work is not lost)
   - Failed waves are reported with their blocker
   - Execution stops after committing successful waves

3. **Sequential commit:** For each COMPLETE executor in the batch, IN WAVE ORDER:
   a. Stage the executor's modified files: `git -C {worktreePath} add {file1} {file2} ...` (using the artifacts list from RAPID:RETURN)
   b. Commit: `git -C {worktreePath} commit -m "feat({SET_ID}): implement wave {N}"`
   c. Write WAVE-{N}-COMPLETE.md marker to `.planning/sets/${SET_ID}/WAVE-${N}-COMPLETE.md` (same format as single-wave batch above)
   d. Optionally transition wave state: call `node "${RAPID_TOOLS}" state transition wave "${MILESTONE}" "${SET_ID}" "wave-{N}" executing` then `complete`

4. **Continue:** Move to the next batch.

This sequential commit approach prevents git index corruption. Even though waves executed in parallel, their commits are serialized through the orchestrator.

---

## Step 5: Post-Execution Verification

After ALL waves complete:

1. Read success criteria from ROADMAP.md for this set (parse the set description and success criteria section).

2. Spawn the **rapid-verifier** agent:

   ```
   Verify execution of set '{SET_ID}'.

   ## Success Criteria (from ROADMAP.md)
   {success criteria for this set}

   ## Wave Plans and Objectives
   {For each wave-N-PLAN.md: wave N objective summary}

   ## Working Directory
   {worktreePath}

   ## Instructions
   Check each success criterion against the actual implementation.
   For each criterion: verify the stated behavior works (run tests, check files exist, verify connections).
   Return COMPLETE with a `gaps` array listing any unmet criteria (empty if all pass).
   ```

3. Parse RAPID:RETURN from verifier.

4. If `gaps` array is empty: All criteria met. Continue to Step 6.

5. If `gaps` array has items:
   - Write GAPS.md to `.planning/sets/${SET_ID}/GAPS.md` listing unmet criteria
   - Display: "{N} gaps found. See GAPS.md."
   - Display: "To close gaps: /rapid:plan-set {SET_INDEX} --gaps then /rapid:execute-set {SET_INDEX} --gaps"
   - Continue to Step 6 (verification is non-blocking).

---

## Step 6: Complete Set

Transition set to complete:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" complete
```

Commit marker files and GAPS.md (if any):

```bash
git add ".planning/sets/${SET_ID}/WAVE-*-COMPLETE.md"
git add ".planning/sets/${SET_ID}/GAPS.md" 2>/dev/null || true
git commit -m "execute-set(${SET_ID}): complete execution"
```

Display final summary:

```
Set '{SET_ID}' execution complete.
Waves: {completed}/{total}
```

Display next step:

> **Next step:** `/rapid:review {SET_INDEX}`

Display progress breadcrumb:

```
init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge
```

---

## Error Handling

### Critical Errors (STOP immediately)

- `RAPID_TOOLS` not set: Show error and suggest `/rapid:install`
- `STATE.json` missing or invalid: Show error and suggest `/rapid:init`
- No PLAN.md files: Suggest `/rapid:plan-set` first
- Set in wrong state: Show breadcrumb with failure point

### Error Breadcrumb

On ANY error, show the progress breadcrumb with the failure point:

```
init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [FAILED: {brief error}] > review > merge
What's done: {what completed before failure}
Next: {what to run to recover}
```

---

## Anti-Patterns -- Do NOT Do These

- Do NOT reference v2 per-job plan files -- v3 uses per-wave PLAN.md only
- Do NOT let parallel executors run git commit -- only the orchestrator commits
- Do NOT dispatch dependent waves in the same parallel batch -- respect DAG ordering
- Do NOT detect or prompt for dual execution modes -- v3 uses subagents only
- Do NOT use any v2 execute or wave-plan CLI subcommands (all removed in v3)
- Do NOT run per-wave reconciliation reports or lean review per wave
- Do NOT prompt between waves on success -- auto-advance. Only CHECKPOINT or BLOCKED stops.
- Do NOT use per-job file ownership checks or commit format validation
- Do NOT spawn sub-subagents from rapid-executor -- this skill is the sole dispatcher

---

## Key Principles

- **One executor per wave, parallel-where-possible.** Each wave gets one rapid-executor agent. Independent waves within a batch execute concurrently. Dependent waves execute in sequential batches.
- **Artifact-based re-entry.** WAVE-COMPLETE.md markers + git commit verification detect completed waves on re-entry. No wave/job state needed.
- **RAPID:RETURN protocol.** Structured executor returns (COMPLETE, CHECKPOINT, BLOCKED) drive the control flow.
- **Subagents only.** No dual-mode execution. One rapid-executor per wave via the Agent tool.
- **Set and wave-level state.** Set transitions: `planned -> executed` (at start) and `executed -> complete` (after all waves + verification). Wave transitions: `pending -> executing -> complete` tracked per-wave.
- **Non-blocking verification.** GAPS.md report after execution. User decides whether to close gaps or proceed to review.
- **Git serialization.** Parallel executors do not commit. The orchestrator commits each wave's changes sequentially after batch completion, preventing git index corruption.
- **Auto-advance on success.** Waves auto-advance without prompting. Only CHECKPOINT or BLOCKED halts execution.
- **Progress breadcrumbs.** Shown at completion and on every error.
