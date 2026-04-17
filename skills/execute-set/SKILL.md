---
description: Execute all waves in a set -- parallel dispatch for independent waves, sequential commits, artifact-based re-entry
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, Read, Write, Glob, Grep
args:
  - name: set
    type: set-ref
    description: Set to execute
    required: true
categories: [human-in-loop]
---

# /rapid:execute-set -- Set Execution

You are the RAPID set execution orchestrator. This skill executes all waves in a set, dispatching independent waves in parallel where possible. Dependent waves execute in sequential batches. Git commit operations are serialized through the orchestrator to prevent index corruption. Each wave spawns one **rapid-executor** agent. Completion is detected via WAVE-COMPLETE.md marker files and git commit verification. After all waves complete, a **rapid-verifier** agent runs lean post-execution verification.

Follow these steps IN ORDER. Do not skip steps.

## Step 0: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
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

Parse the user's input for the `--gaps` flag. If present, set `GAPS_MODE=true`. Gap-closure mode:
- Relaxes status validation to accept `complete` and `merged` sets
- Only executes gap-closure waves (those with `<!-- gap-closure: true -->` header or waves numbered higher than the last WAVE-COMPLETE.md marker from the original execution)
- Skips ALL state transitions (the set remains in its current status)
- Does NOT trigger solo auto-merge

### Load Full State

```bash
# (env preamble here)
STATE_JSON=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$STATE_JSON"
```

Parse the JSON to find the resolved set within the current milestone. Extract `MILESTONE`.

### Validate Set Status

- **If `planned`:** Expected state for first execution. Continue.
- **If `executed`:** Re-entry scenario. Continue (will pick up from last complete wave).
- **If `pending` or `discussed`:** Error -- set is not ready for execution.
  Display: "Set '{SET_ID}' is in '{status}' state. Run /rapid:discuss-set and /rapid:plan-set first."
  Show error breadcrumb:
  ```
  init [done] > start-set [done] > discuss-set > plan-set > execute-set [FAILED: set not ready] > review > merge
  ```
  STOP.
- **If `--gaps` flag IS present but status is NOT `complete` or `merged`:**
  Display error: "The --gaps flag is only valid for sets in 'complete' or 'merged' status (current: {status}). Gap-closure is for addressing gaps in already-completed sets."
  STOP.
- **If `complete` or `merged` AND `--gaps` flag IS present:**
  - Validate that `.planning/sets/${SET_ID}/GAPS.md` exists. If missing, display error: "No GAPS.md found for set '{SET_ID}'. Run /rapid:plan-set {SET_INDEX} --gaps first to plan gap-closure waves." STOP.
  - Validate that gap-closure wave PLAN.md files exist (waves numbered higher than existing WAVE-COMPLETE markers, or containing `<!-- gap-closure: true -->` header). If none found, display: "No gap-closure wave plans found. Run /rapid:plan-set {SET_INDEX} --gaps first." STOP.
  - Display: "Gap-closure mode: executing gap-closure waves for set '{SET_ID}' (status: {status})."
  - Continue.

- **If `complete` or `merged` AND `--gaps` flag is NOT present:** Already done.
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

Check the registry for this set's entry:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" worktree status --json
```

Parse the JSON output to find the entry for `SET_ID`.

**If the entry has `solo: true`:** The worktree path is the project root (cwd). No `.rapid-worktrees/` directory involved.

**Otherwise:** The worktree path is `.rapid-worktrees/${SET_ID}` or the path from the registry entry.

---

## Step 2: Re-Entry Detection (Artifact-Based)

For each wave N (1 to total_waves):

1. Check if `.planning/sets/${SET_ID}/WAVE-${N}-COMPLETE.md` exists
2. If marker exists: read it, extract commit hashes, verify commits exist on worktree branch via `git -C {worktreePath} log --oneline main..HEAD | grep {commitHash}`
3. If marker exists AND commits verified: mark wave as complete (skip)
4. If marker missing OR commits don't match: mark wave for execution

Display re-entry summary. If wave is complete AND `wave-{N}-PLAN-DIGEST.md` exists, note "(digest available)":

```
Wave 1: complete (skipping) (digest available)
Wave 2: pending (will execute)
Wave 3: pending (will execute)
```

**Gap-closure mode note:** In gap-closure mode, previously completed waves (from original execution) are skipped via their WAVE-COMPLETE.md markers. Only newly planned gap-closure waves (without markers) are executed.

If ALL waves complete:
  **If `GAPS_MODE=true`:** Display: "All gap-closure waves for set '{SET_ID}' already complete. Gaps may be resolved -- check GAPS.md." Suggest: `/rapid:review {SET_INDEX}`. STOP.
  **If `GAPS_MODE=false`:** Display: "All waves in set '{SET_ID}' already complete." Suggest: `/rapid:review {SET_INDEX}`. STOP.

If not first run (some waves complete):
  Display: "Resuming execution from wave {N}..."

---

## Step 3: State Transition

**If `GAPS_MODE=true`:** Skip entirely. Display: "Gap-closure mode: skipping state transition (set remains in '{status}' status)."

**If `GAPS_MODE=false`:**

If set is in `planned` state:
```bash
# (env preamble here)
node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" executed
```

If set is already in `executed` state: skip transition (re-entry).

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

**If solo mode:** Git commits happen directly on the current branch (typically main). The commit convention is identical -- `type({SET_ID}): description`.

**If batch contains a single wave:** Spawn one **rapid-executor** agent with the standard task prompt (including git commit instructions).

For wave N > 1, prepend a **Prior Wave Context** section built from plan digests of completed waves:

```
Implement wave {N} for set '{SET_ID}'.

## Prior Wave Context (Compacted)
{For each completed wave M < N: read wave-{M}-PLAN-DIGEST.md if it exists, otherwise skip.
 Format as: "Wave {M}: {digest content}"}

## Your PLAN
{Full content of wave-{N}-PLAN.md}

## Commit Convention
After each task, commit with: type({SET_ID}): description
Where type is feat|fix|refactor|test|docs|chore

## Digest Production
After completing all tasks in this wave, produce digest files for large artifacts:
- If you wrote or modified a wave-{N}-PLAN.md (you did not -- it was your input), skip.
- For any WAVE-{N}-HANDOFF.md you produce: also write a WAVE-{N}-HANDOFF-DIGEST.md sibling
  containing a 5-10 line summary with: key decisions made, files modified, tasks completed/remaining.
- Digest files go in the same directory as the original artifact.
- Do NOT produce digests for small files under 500 tokens (~2000 chars).

## Working Directory
{worktreePath}
```

**If batch contains multiple waves:** Spawn all **rapid-executor** agents in the batch simultaneously using parallel tool calls. Each agent receives its own wave's PLAN.md content.

CRITICAL: Executors in parallel batches must NOT commit to git. Instead, they make file changes and report what they changed in their RAPID:RETURN. The orchestrator commits sequentially after all executors in a batch complete.

For each parallel executor, use this task prompt:

```
Implement wave {N} for set '{SET_ID}'.

## Prior Wave Context (Compacted)
{For each completed wave M < N: read wave-{M}-PLAN-DIGEST.md if it exists, otherwise skip.
 Format as: "Wave {M}: {digest content}"}

## Your PLAN
{Full content of wave-{N}-PLAN.md}

## Commit Convention
DO NOT run git commit. Make your file changes only.
The orchestrator will commit your changes after verification.
Report all modified files in your RAPID:RETURN artifacts list.

## Digest Production
After completing all tasks in this wave, produce digest files for large artifacts:
- If you wrote or modified a wave-{N}-PLAN.md (you did not -- it was your input), skip.
- For any WAVE-{N}-HANDOFF.md you produce: also write a WAVE-{N}-HANDOFF-DIGEST.md sibling
  containing a 5-10 line summary with: key decisions made, files modified, tasks completed/remaining.
- Digest files go in the same directory as the original artifact.
- Do NOT produce digests for small files under 500 tokens (~2000 chars).

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

4. Also write a `wave-{N}-PLAN-DIGEST.md` to `.planning/sets/${SET_ID}/wave-${N}-PLAN-DIGEST.md`:

   ```markdown
   # Wave {N} Plan Digest

   **Objective:** {1-line summary from the wave plan's ## Objective}
   **Tasks:** {N} tasks completed
   **Key files:** {comma-separated list of primary files created/modified}
   **Approach:** {1-2 line summary of the implementation approach}
   **Status:** Complete
   ```

   This plan digest is generated by the orchestrator (this skill), not by the executor agent, because the orchestrator has the wave plan content and completion status.

5. Display: "Wave {N}: complete."
6. Optionally transition wave state: call `node "${RAPID_TOOLS}" state transition wave "${MILESTONE}" "${SET_ID}" "wave-{N}" executing` then `complete`
7. Continue to next batch.

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
   d. Write `wave-{N}-PLAN-DIGEST.md` to `.planning/sets/${SET_ID}/wave-${N}-PLAN-DIGEST.md` (same format as single-wave batch above)
   e. Optionally transition wave state: call `node "${RAPID_TOOLS}" state transition wave "${MILESTONE}" "${SET_ID}" "wave-{N}" executing` then `complete`

4. **Continue:** Move to the next batch.

This sequential commit approach prevents git index corruption. Even though waves executed in parallel, their commits are serialized through the orchestrator.

---

## Step 5: Post-Execution Verification

After ALL waves complete:

**If `GAPS_MODE=false` (normal mode):**

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

**If `GAPS_MODE=true` (gap-closure mode):**

1. Read the existing `.planning/sets/${SET_ID}/GAPS.md` as verification input.

2. Spawn the **rapid-verifier** agent:

   ```
   Verify gap-closure execution for set '{SET_ID}'.

   ## Gap-Closure Verification
   Verify that the specific gaps listed in GAPS.md have been resolved by the gap-closure wave implementations.

   ## GAPS.md (verification input)
   {full GAPS.md contents}

   ## Gap-Closure Wave Plans and Objectives
   {For each gap-closure wave-N-PLAN.md: wave N objective summary}

   ## Working Directory
   {worktreePath}

   ## Instructions
   For each gap listed in GAPS.md, check whether the gap-closure waves resolved it.
   Return COMPLETE with a `resolved_gaps` and `unresolved_gaps` array.
   ```

3. Parse RAPID:RETURN from verifier.

4. Update GAPS.md in-place: for each resolved gap, add a `**Status:** Resolved` marker. For unresolved gaps, add `**Status:** Unresolved` with details.

5. Continue to Step 6.

---

## Step 6: Complete Set

**If `GAPS_MODE=true`:** Skip state transition AND solo auto-merge entirely. Display: "Gap-closure mode: skipping completion transition (set remains in '{status}' status)."

Still commit marker files (WAVE-COMPLETE.md for gap-closure waves, updated GAPS.md):

```bash
git add ".planning/sets/${SET_ID}/WAVE-*-COMPLETE.md" 2>/dev/null || true
git add ".planning/sets/${SET_ID}/GAPS.md" 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "execute-set(${SET_ID}): gap-closure execution complete"
else
  echo "No marker files to commit (already committed in wave execution)."
fi
```

Display gap-closure summary: "Gap-closure for set '{SET_ID}' complete. {N} gap-closure waves executed."

Display the completion footer (next command depends on gap status):

If all gaps resolved:
```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:review {SET_INDEX}" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge [done] > gap-closure [done]"
```

If gaps remain:
```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:plan-set {SET_INDEX} --gaps" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge [done] > gap-closure [done]"
```

**Skip the rest of Step 6 below** (state transition, solo auto-merge, normal commit, normal summary).

---

**If `GAPS_MODE=false`:**

Transition set to complete. Use the project root (not the worktree) for state commands:

```bash
# (env preamble here)
# Determine project root (parent of .rapid-worktrees if in a worktree, otherwise cwd)
PROJECT_ROOT=$(cd "$(git rev-parse --show-toplevel)" && pwd)
if [ -d "$PROJECT_ROOT/../.planning" ]; then
  PROJECT_ROOT=$(cd "$PROJECT_ROOT/.." && pwd)
fi

# Transition state BEFORE git operations (prevents stuck-in-executing if commit fails)
node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" complete
```

If the state transition fails with a lock contention error, retry up to 2 more times with a 2-second pause:

```bash
# Retry logic for state transition (lock contention)
for attempt in 1 2 3; do
  if node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" complete 2>/dev/null; then
    break
  fi
  if [ "$attempt" -lt 3 ]; then
    sleep 2
  else
    echo "WARNING: State transition failed after 3 attempts. Set may still be in 'executing' state."
  fi
done
```

### Solo Auto-Merge

If this is a solo set, auto-transition from `complete` to `merged`. Solo sets have no branch to merge, so the merge step is skipped entirely:

```bash
# Check if this is a solo set
REGISTRY=$(cat .planning/worktrees/REGISTRY.json 2>/dev/null || echo '{}')
IS_SOLO=$(echo "$REGISTRY" | node -e "
  const d = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
  const e = d.worktrees && d.worktrees['${SET_ID}'];
  console.log(e && e.solo === true ? 'true' : 'false');
")

if [ "$IS_SOLO" = "true" ]; then
  echo "Solo set detected -- auto-transitioning to merged status."
  for attempt in 1 2 3; do
    if node "${RAPID_TOOLS}" state transition set "${MILESTONE}" "${SET_ID}" merged 2>/dev/null; then
      echo "Set '${SET_ID}' auto-merged (solo mode)."
      break
    fi
    if [ "$attempt" -lt 3 ]; then
      sleep 2
    else
      echo "WARNING: Solo auto-merge transition failed after 3 attempts. Set is complete but not merged. Run: node \"\${RAPID_TOOLS}\" state transition set \"\${MILESTONE}\" \"\${SET_ID}\" merged"
    fi
  done
fi
```

If auto-merge succeeded, update the final summary and next step display:
- Change "execution complete" to "execution complete (auto-merged)"
- Change next step from `/rapid:review {SET_INDEX}` to `/rapid:review {SET_INDEX}` (same -- review is the next step regardless)
- Update the progress breadcrumb to show merge as done:

```
init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge [auto]
```

Commit marker files and GAPS.md (if any). Use --allow-empty to avoid failure if files were already committed:

```bash
git add ".planning/sets/${SET_ID}/WAVE-*-COMPLETE.md" 2>/dev/null || true
git add ".planning/sets/${SET_ID}/GAPS.md" 2>/dev/null || true
# Only commit if there are staged changes
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -m "execute-set(${SET_ID}): complete execution" || echo "WARNING: Git commit failed. Marker files may not be committed."
else
  echo "No marker files to commit (already committed in wave execution)."
fi
```

Display final summary:

```
Set '{SET_ID}' execution complete.
Waves: {completed}/{total}
```

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:review {SET_INDEX}" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set [done] > review > merge"
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
