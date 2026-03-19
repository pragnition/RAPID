---
description: Merge completed sets into main -- subagent delegation per set, fast-path merge-tree, 5-level conflict detection, 4-tier resolution, adaptive conflict resolution via resolver agents, DAG-ordered merging, bisection recovery, rollback
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion
---

# /rapid:merge -- Merge Pipeline Orchestrator (v2.2)

You are the RAPID merge orchestrator. This skill merges completed set branches into main via subagent delegation per set. Each set is dispatched to an isolated rapid-set-merger subagent for 5-level conflict detection, 4-tier resolution cascade, and programmatic gate validation. Clean merges skip subagent dispatch entirely via git merge-tree fast path. You spawn subagents using the Agent tool and collect structured RAPID:RETURN results. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Load Merge Plan

### 1a: Load environment

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
node "${RAPID_TOOLS}" display banner merge
```

### 1b: Determine merge order from the DAG

```bash
node "${RAPID_TOOLS}" merge order
```

### 1c: Check current merge and execution status

```bash
node "${RAPID_TOOLS}" merge status
```

```bash
node "${RAPID_TOOLS}" state get --all
```

Parse the merge order (wave-grouped arrays) and status. Identify which sets are ready to merge (status='complete' in STATE.json, mergeStatus=pending in MERGE-STATE). Check MERGE-STATE.json for each set to enable idempotent re-entry -- skip sets that are already status='complete' in MERGE-STATE.

### 1d: Detect solo sets

For each set in the merge plan, check the registry for solo entries:

```bash
node "${RAPID_TOOLS}" worktree status --json
```

Parse the JSON output. For each worktree entry with `solo: true`, mark that set as a solo set. Solo sets will be fast-pathed in Step 3 (no subagent dispatch, no conflict detection).

In the merge plan display, annotate solo sets:
> - Wave 1: {set-name} **(solo -- auto-merge)**

If a solo set is already in `merged` status in STATE.json (auto-merged after execution):
> Set '{set-name}' is a solo set -- already merged automatically after execution. No merge needed.
> **Next step:** `/rapid:review {set-index} --post-merge`

If the user specified a single solo set to merge and it is already merged, display this message and exit gracefully. Do not treat this as an error.

If a specific set name was provided (e.g., `/rapid:merge auth-set` or `/rapid:merge 1`):

#### Resolve Set Reference

Resolve the set argument through the numeric ID resolver:

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

Use `SET_NAME` for all subsequent operations. Then:

- Find that set and all its dependencies in the DAG
- Only merge the specified set and its unmerged dependencies (in DAG order)
- Inform the user which dependency sets will also be merged

Show the user the merge plan:

> **Merge Plan:**
> - Wave 1: {set names} (sequential merge)
> - Wave 2: {set names} (after Wave 1 integration gate)
> - ...
>
> **Sets ready:** {count}
> **Sets not ready:** {list with reasons}
> **Sets already merged:** {list, will be skipped}

Use AskUserQuestion to confirm:
- **question:** "Merge plan"
- **options:**
  - "Start merge" -- description: "Merge {count} sets across {waveCount} waves. Wave 1: {first wave set names}"
  - "Cancel" -- description: "Exit without merging"

If the developer selects "Cancel", print "Merge pipeline cancelled." and exit.

## Step 2: Process Each Wave

For each wave (in order), run Steps 3-8 for each set in the wave. Sets within a wave merge SEQUENTIALLY (not in parallel) -- each merge sees the result of the previous one.

Before starting each wave, record the pre-wave commit for potential bisection:

```bash
PRE_WAVE_COMMIT=$(git rev-parse HEAD)
```

Track merged sets per wave for integration gate and bisection.

Initialize two in-memory tracking structures at the start of each wave:
- **compressedResults** -- map: setName -> compressResult output (for Step 8 summary)
- **blockedSets** -- list: [{setName, reason, attempts}] (for post-wave recovery)

## Step 3: Dispatch Per-Set Merge

For each set in the current wave (sequential processing):

### 3a: Check idempotent re-entry

```bash
node "${RAPID_TOOLS}" merge merge-state {setName}
```

- If status='complete', skip this set. Display:
  > [{waveNum}/{totalWaves}] {setName}: already merged (skipping)

- If agentPhase1='done', skip to Step 6 (merge execute). Display:
  > [{waveNum}/{totalWaves}] {setName}: detection/resolution done, proceeding to merge

### 3a-solo: Solo set fast path

Before running merge-tree or dispatching a subagent, check if the set is a solo set via the registry:

If the set has `solo: true` in the registry:
> [{waveNum}/{totalWaves}] {setName}: solo set (no merge needed)

Skip directly to Step 6 (merge execute). The `merge execute` CLI command (via `mergeSet()`) already handles solo sets by returning `{ merged: true, solo: true }` immediately.

If the solo set is already in `merged` status in STATE.json:
> [{waveNum}/{totalWaves}] {setName}: solo set already merged (skipping)

Skip this set entirely -- do not call `merge execute`. Solo sets that were auto-merged during execute-set do not need any merge operations.

### 3b: Fast-path check

```bash
git merge-tree --write-tree HEAD rapid/{setName}
```

Check the exit code:
- **Exit code 0:** No conflicts. Skip subagent entirely. Display:
  > [{waveNum}/{totalWaves}] {setName}: clean merge (fast path)

  Go directly to Step 6 (merge execute).

- **Exit code 1:** Conflicts detected. Continue to 3c (dispatch subagent).

- **Exit code >1:** Error. Continue to 3c (let subagent diagnose).

### 3c: Update status and dispatch subagent

Update merge status and agent phase:

```bash
node "${RAPID_TOOLS}" merge update-status {setName} resolving --agent-phase spawned
```

Get launch briefing:

```bash
node "${RAPID_TOOLS}" merge prepare-context {setName}
```

Parse the JSON output to get the `briefing` string.

Display progress:
> [{waveNum}/{totalWaves}] {setName}: dispatching rapid-set-merger subagent...

Spawn the **rapid-set-merger** agent with this task:

```
Merge set '{setName}' branch 'rapid/{setName}' into '{baseBranch}'.

## Launch Briefing
{briefing from prepare-context}

## Instructions
1. Run L1-L4 detection: `node "${RAPID_TOOLS}" merge detect {setName}`
2. If conflicts found, run T1-T2 resolution: `node "${RAPID_TOOLS}" merge resolve {setName}`
3. If unresolved conflicts remain, perform L5 semantic analysis and T3/T4 resolution inline (per your role instructions)
4. Run programmatic gate: `node "${RAPID_TOOLS}" merge review {setName}`
5. Return structured RAPID:RETURN with results

## Working Directory
{worktreePath}

## Return Format
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"semantic_conflicts":[...],"resolutions":[...],"escalations":[...],"gate_passed":<boolean>,"all_resolved":<boolean>}} -->
```

### 3d: Collect and route return

Parse the agent's output using parseSetMergerReturn logic:

**COMPLETE:**
- Update status and agent phase:
  ```bash
  node "${RAPID_TOOLS}" merge update-status {setName} resolved --agent-phase done
  ```
- Read MERGE-STATE to get data for compression:
  ```bash
  node "${RAPID_TOOLS}" merge merge-state {setName}
  ```
- Store the compressResult output in the in-memory `compressedResults` map.
- Check the `gate_passed` field from the return data:
  - If `gate_passed` is false: add to `blockedSets` with reason "programmatic gate failed". Continue to next set.
  - If `gate_passed` is true: continue to Step 3e.

**CHECKPOINT (attempt 1):**
- Auto-retry once with checkpoint data included in re-dispatch prompt:

  ```
  Merge set '{setName}' branch 'rapid/{setName}' into '{baseBranch}'.

  ## Checkpoint (continuing from previous attempt)
  - Done: {handoff.done}
  - Remaining: {handoff.remaining}
  - Resume from: {handoff.resume}

  ## Launch Briefing
  {briefing from prepare-context}

  ## Instructions
  1. Run L1-L4 detection: `node "${RAPID_TOOLS}" merge detect {setName}`
  2. If conflicts found, run T1-T2 resolution: `node "${RAPID_TOOLS}" merge resolve {setName}`
  3. If unresolved conflicts remain, perform L5 semantic analysis and T3/T4 resolution inline (per your role instructions)
  4. Run programmatic gate: `node "${RAPID_TOOLS}" merge review {setName}`
  5. Return structured RAPID:RETURN with results

  ## Working Directory
  {worktreePath}

  ## Return Format
  <!-- RAPID:RETURN {"status":"COMPLETE","data":{"semantic_conflicts":[...],"resolutions":[...],"escalations":[...],"gate_passed":<boolean>,"all_resolved":<boolean>}} -->
  ```

- Parse the retry's return:
  - If COMPLETE: handle as above (update status, store compressedResult, check gate_passed).
  - If CHECKPOINT again or BLOCKED: set agentPhase1='failed', add to blockedSets.
    ```bash
    node "${RAPID_TOOLS}" merge update-status {setName} failed --agent-phase failed
    ```

**BLOCKED or malformed:**
- Update status:
  ```bash
  node "${RAPID_TOOLS}" merge update-status {setName} failed --agent-phase failed
  ```
- Add to `blockedSets` with reason from parseSetMergerReturn (or "malformed return" if parsing failed).
- Continue to next set in the wave.

### 3e: Handle escalations from return data (Adaptive Conflict Resolution)

If return data contains escalations (conflicts from set-merger with confidence scores):

#### 3e-i: Classify escalations

For each escalation in the return data:
- Generate a conflict ID: use the escalation's `file` field as the ID. If multiple escalations share the same file, append `:1`, `:2` suffix.
- Route the escalation:
  - Check if the escalated file appears in the set's MERGE-STATE `detection.api.conflicts`. If yes -> classify as `human-api-gate` (regardless of confidence).
  - If confidence < 0.3 -> classify as `human-direct`
  - If confidence >= 0.3 AND confidence <= 0.8 -> classify as `resolver-agent`
  - If confidence > 0.8 -> classify as `auto-accept`

Group escalations into four buckets: `resolverBound`, `humanApiGate`, `humanDirect`, `autoAccept`.

#### 3e-ii: Auto-accept high-confidence escalations

For escalations classified as `auto-accept` (confidence > 0.8 that somehow reached escalation):
- The set-merger already applied these. Log them and continue.

#### 3e-iii: Dispatch resolver agents (parallel)

For escalations classified as `resolver-agent`:
- Group by file. If multiple escalations target the same file, combine them into a single resolver dispatch (avoids parallel write conflicts).
- For each unique file (or group):
  - Update agentPhase2:
    ```bash
    node "${RAPID_TOOLS}" merge update-status {setName} resolving --agent-phase2 {conflictId} spawned
    ```
  - Prepare resolver context inline from the return data: include conflict details, set-merger's analysis, worktree path, paths to both sets' CONTEXT.md, any L4 API detection data for context.
  - Spawn `rapid-conflict-resolver` agent using the Agent tool with prompt:
    ```
    Resolve conflict '{conflictId}' in file '{file}' for set '{setName}'.

    ## Launch Briefing
    {resolver context assembled above}

    ## Working Directory
    {worktreePath}

    ## Return Format
    <!-- RAPID:RETURN {"status":"COMPLETE","data":{"conflict_id":"...","strategies_tried":[{"approach":"...","confidence":0.X,"reason":"..."}],"selected_strategy":"...","resolution_summary":"...","confidence":0.X,"files_modified":["..."],"applied":true}} -->
    ```

ALL resolver Agent tool calls happen in the same response for parallel dispatch. Then collect all returns.

#### 3e-iv: Collect resolver results and route

For each resolver return:
- Parse the return (default-to-BLOCKED safety).
- If COMPLETE with confidence >= 0.7:
  - Auto-accept: resolution already applied to worktree by resolver.
  - Update agentPhase2:
    ```bash
    node "${RAPID_TOOLS}" merge update-status {setName} resolving --agent-phase2 {conflictId} done
    ```
  - Log: "Conflict {conflictId} resolved by resolver (confidence {X})"
- If COMPLETE with confidence < 0.7:
  - Escalate to human with resolver's deeper analysis attached.
  - Add to `humanEscalations` list with the resolver's analysis, proposed resolution, and diff.
  - Update agentPhase2:
    ```bash
    node "${RAPID_TOOLS}" merge update-status {setName} resolving --agent-phase2 {conflictId} done
    ```
- If BLOCKED or malformed:
  - Escalate to human immediately.
  - Add to `humanEscalations` list with the failure reason.
  - Update agentPhase2:
    ```bash
    node "${RAPID_TOOLS}" merge update-status {setName} resolving --agent-phase2 {conflictId} failed
    ```

#### 3e-v: Present human-bound conflicts

Combine all human-bound conflicts: `humanApiGate` + `humanDirect` + resolver escalations (confidence < 0.7 or BLOCKED).

For API-signature conflicts (`humanApiGate`):
- Use AskUserQuestion:
  - **question:** "API-signature conflict in {file} -- choose merge direction"
  - **options:**
    - "Keep Set A" -- description: "Use set A's API changes, discard set B's conflicting changes"
    - "Keep Set B" -- description: "Use set B's API changes, discard set A's conflicting changes"
    - "Merge both" -- description: "Attempt to keep both sets' API changes (may need manual review)"
  - Execute the chosen direction automatically (apply the resolution to the worktree file).

For direct human conflicts (`humanDirect` -- confidence < 0.3):
- Use AskUserQuestion:
  - **question:** "Low-confidence conflict in {file} (confidence: {X})"
  - **options:**
    - "Accept AI resolution" -- description: "Apply the proposed resolution: {proposed_resolution}"
    - "Skip conflict" -- description: "Leave conflict unresolved and continue"

For resolver-escalated conflicts (resolver confidence < 0.7):
- Show the resolver's deeper analysis and proposed resolution diff.
- Use AskUserQuestion:
  - **question:** "Resolver analysis for {file} (confidence: {X})"
  - **options:**
    - "Accept" -- description: "Accept the resolver's proposed resolution (already applied to worktree)"
    - "Reject" -- description: "Revert the resolver's changes and skip this conflict"
    - "Edit manually" -- description: "Keep the resolver's changes as a starting point, edit further"

#### 3e-vi: Re-run programmatic gate (post-resolver)

After all resolvers complete and human decisions are made, re-run the programmatic gate to validate the combined changes:
```bash
node "${RAPID_TOOLS}" merge review {setName}
```
If the gate fails, present the failure to the user and offer to continue or abort.

After all escalations handled, proceed to Step 6 (merge execute).

## Step 6: Merge Set

After a set passes dispatch (COMPLETE with gate_passed=true, or fast path, or re-entry from agentPhase1=done):

```bash
node "${RAPID_TOOLS}" merge execute {setName}
```

Parse the JSON result:

- If `merged: true`:
  Auto-transition the set status to 'merged':
  ```bash
  node "${RAPID_TOOLS}" state transition set <milestone> <setName> merged
  ```
  > [{waveNum}/{totalWaves}] {setName}: MERGED and status updated to 'merged' (commit {commitHash})
  > Tip: Run `/rapid:review {setIndex} --post-merge` to review this set's merged code.

  Add this set to the wave's merged-sets list for integration gate tracking.

- If `merged: false, reason: 'conflict'`:
  > **Merge conflict** in set '{setName}'
  > Conflicting files: {list}

  Use AskUserQuestion:
  - **question:** "Merge conflict"
  - **options:**
    - "Resolve manually" -- description: "View conflicting files and resolve commands"
    - "Show diff" -- description: "Display the diff output for conflicting files"
    - "Abort pipeline" -- description: "Exit merge pipeline. Already-merged sets remain."

  If "Resolve manually":
  - Display the conflicting file list and resolve commands:
    > **Conflicting files:**
    > {file list}
    >
    > **To resolve:**
    > 1. Edit the conflicting files to resolve markers
    > 2. `git add {files}`
    > 3. `git merge --continue`
  - Then use a second AskUserQuestion:
    - **question:** "Conflict resolution"
    - **options:**
      - "Resolved -- continue pipeline" -- description: "Conflicts resolved, continue merging"
      - "Still stuck -- abort" -- description: "Exit merge pipeline"

  If "Show diff":
  - Run `git diff` and display output
  - Then present resolve/abort options as above

  If "Abort pipeline":
  - Print "Merge pipeline cancelled. Already-merged sets in this wave remain merged." and exit

- If `merged: false, reason: 'error'`:
  > **Merge error** for set '{setName}'
  > Detail: {detail}

  Use AskUserQuestion:
  - **question:** "Merge error"
  - **options:**
    - "Retry merge" -- description: "Attempt the merge again for {setName}"
    - "Skip set" -- description: "Continue pipeline without this set"
    - "Abort pipeline" -- description: "Exit merge pipeline entirely"

  If "Retry merge": re-run `node "${RAPID_TOOLS}" merge execute {setName}` and re-parse.
  If "Skip set": continue to next set.
  If "Abort pipeline": exit.

- If `merged: false, reason: 'feature_regression'`:
  > **Feature regression detected** in set '{setName}'
  > The merge was automatically reverted because exported symbols were lost.
  > Detail: {detail}
  >
  > **Regressions:**
  > {for each regression in regressions: "- `{file}`: lost exports [{missing joined by ', '}]"}

  Use AskUserQuestion:
  - **question:** "Feature regression in {setName}"
  - **options:**
    - "Investigate" -- description: "View file diffs and exported symbols for the regressed files"
    - "Re-dispatch resolver" -- description: "Send back to set-merger for semantic re-analysis of affected files"
    - "Force merge" -- description: "Override regression check and merge anyway (not recommended)"
    - "Abort pipeline" -- description: "Exit merge pipeline"

  If "Investigate": display the regression details (base exports, set exports, merged exports for each file) and show `git diff` for affected files between preMergeHead and the set branch. Then present resolve/abort options.
  If "Re-dispatch resolver": re-run Step 3c for this set with the regression data included in the launch briefing.
  If "Force merge": re-run `node "${RAPID_TOOLS}" merge execute {setName}` -- but note the regression check will fire again. To truly force, the user must resolve the export loss first.
  If "Abort pipeline": exit.

## Post-Wave: Blocked Set Recovery

After all sets in the wave have been processed (dispatched + collected OR fast-pathed + merged):

If `blockedSets` is not empty, display the blocked summary:

> **Blocked sets in Wave {waveNum}:**
> {for each blocked set: "- {setName}: {reason} ({attempts} attempt(s))"}

For each blocked set (max 2 total attempts per set across initial dispatch + retries):

Use AskUserQuestion:
- **question:** "Set '{setName}' blocked: {reason}"
- **options:**
  - "Retry" -- description: "Re-dispatch subagent for {setName} (attempt {attempts+1}/2)"
  - "Skip" -- description: "Skip {setName}, continue pipeline"
  - "Abort" -- description: "Exit merge pipeline"

If "Retry":
- Re-run Step 3c-3d for this set (reset agentPhase1 to spawned, re-dispatch with fresh launch briefing).
- If retry returns COMPLETE with gate_passed=true: proceed to Step 6 for this set. Remove from blockedSets.
- If retry also fails (BLOCKED/CHECKPOINT/gate_passed=false): present skip/abort only (max retries exceeded).
  Use AskUserQuestion:
  - **question:** "Set '{setName}' retry failed: {reason}"
  - **options:**
    - "Skip" -- description: "Skip {setName}, continue pipeline"
    - "Abort" -- description: "Exit merge pipeline"

If "Skip": continue to next blocked set or integration gate.
If "Abort": print "Merge pipeline cancelled." and exit.

## Step 7: Post-Wave Integration Gate

After ALL sets in the current wave have been merged (or skipped), and blocked set recovery is complete:

### 7a: Run integration tests

```bash
node "${RAPID_TOOLS}" merge integration-test
```

### 7b: Handle results

- If `passed: true`:
  > **Wave {waveNum} integration gate: PASS**
  > All tests pass after merging Wave {waveNum} sets.

  If there are more waves, use AskUserQuestion:
  - **question:** "Wave {waveNum} complete"
  - **options:**
    - "Continue to Wave {waveNum+1}" -- description: "Proceed to merge Wave {waveNum+1} sets"
    - "Pause pipeline" -- description: "Pause merge pipeline after Wave {waveNum}. Resume with /rapid:merge."

  If "Pause pipeline": print "Merge pipeline paused after Wave {waveNum}. Resume with `/rapid:merge`." and exit.

- If `passed: false`:
  > **Wave {waveNum} integration gate: FAIL**
  > Tests failing after merging Wave {waveNum} sets.
  > Output: {test output}

  **Auto-trigger bisection recovery** (per user locked decision -- no pre-bisection AskUserQuestion):
  > Integration tests failed. Running bisection recovery automatically...

  ```bash
  node "${RAPID_TOOLS}" merge bisect {waveNum}
  ```

  Parse the bisection result and display:
  > **Bisection result:** Breaking set: {breakingSet} (found in {iterations} iterations)

  ### 7c: Post-bisection decision

  Use AskUserQuestion:
  - **question:** "Bisection identified breaking set: {breakingSet}"
  - **options:**
    - "Rollback breaking set" -- description: "Revert {breakingSet}'s merge commit"
    - "Investigate manually" -- description: "Pause for manual investigation of the breaking set"
    - "Abort pipeline" -- description: "Exit without reverting"

  If "Rollback breaking set": proceed to Step 7d (rollback).
  If "Investigate manually": print "Pausing for investigation. Re-run `/rapid:merge` after fixing." and exit.
  If "Abort pipeline": print "Merge pipeline cancelled. Wave {waveNum} merges remain." and exit.

### 7d: Rollback

If rollback requested for a set:

```bash
node "${RAPID_TOOLS}" merge rollback {setName}
```

Parse the JSON result:

- If `cascadeWarning: true` (has dependent sets already merged):
  > **Cascade impact detected:**
  > Dependent sets affected: {affectedSets}
  > Recommendation: {recommendation}

  Use AskUserQuestion:
  - **question:** "Cascade impact for {setName} rollback"
  - **options:**
    - "Proceed with rollback" -- description: "Revert {setName}. Dependent sets may need manual fixing."
    - "Cancel rollback" -- description: "Keep the merge, investigate instead"

  If "Proceed with rollback": run `node "${RAPID_TOOLS}" merge rollback {setName} --force` and continue.
  If "Cancel rollback": print "Rollback cancelled. Investigate manually." and exit.

- If `rolledBack: true`:
  > {setName} reverted (commit: {revertCommit})

  Run integration tests again to verify the rollback fixed the issue:

  ```bash
  node "${RAPID_TOOLS}" merge integration-test
  ```

  If tests pass:
  > Integration tests pass after rollback.

  Continue to next wave.

  If tests still fail:
  > Integration tests still failing after rollback.

  Use AskUserQuestion:
  - **question:** "Tests still failing after rollback"
  - **options:**
    - "Investigate manually" -- description: "Pause for manual investigation"
    - "Abort pipeline" -- description: "Exit merge pipeline"

- If `rolledBack: false`:
  > Rollback failed for {setName}: {reason}
  > Detail: {detail}

  Use AskUserQuestion:
  - **question:** "Rollback failed"
  - **options:**
    - "Investigate manually" -- description: "Pause for manual investigation"
    - "Abort pipeline" -- description: "Exit merge pipeline"

## Step 8: Pipeline Complete

After all waves complete:

```bash
node "${RAPID_TOOLS}" merge status
```

Build the final summary from the in-memory `compressedResults` collected during Step 3d. For each set, the compressedResult contains: `setId`, `status`, `conflictCounts` (L1-L5), `resolutionCounts` (T1-T3, escalated), and `commitSha`.

Present final summary:

> **Merge Pipeline Complete**
>
> | Set | Status | L1 | L2 | L3 | L4 | L5 | T1 | T2 | T3 | Escalated | Commit |
> |-----|--------|----|----|----|----|----|----|----|----|-----------|----|
> | {setId} | {status} | {L1} | {L2} | {L3} | {L4} | {L5} | {T1} | {T2} | {T3} | {escalated} | {commitSha} |
>
> **Summary:**
> - Total sets merged: {count}
> - Total waves: {count}
> - Sets skipped (blocked): {list or "none"}
> - Sets rolled back: {list or "none"}
> - Sets fast-pathed (no conflicts): {count}
> - Conflicts detected: {total across all sets}
> - Conflicts auto-resolved (T1/T2): {count}
> - Conflicts AI-resolved (T3): {count}
> - Conflicts escalated (T4): {count}
> - Bisection runs: {count or "none"}

Display the available next steps:

> **Next steps:**
> - `/rapid:review {setIndex} --post-merge` -- *Run post-merge review on merged sets (recommended)*
> - `/rapid:cleanup` -- *Remove completed worktrees*
> - `/rapid:status` -- *View project state*
> - `/rapid:new-version` -- *Start planning next version (if all sets merged)*

## Important Notes

- **Solo sets skip the entire merge pipeline.** Solo sets have `solo: true` in the registry. Solo sets are auto-merged to `merged` status during execute-set Step 6. If a user runs `/rapid:merge` on a solo set, the pipeline detects the `merged` status and displays an informational message: "Set '{name}' is a solo set -- already merged automatically after execution. No merge needed." The merge execute command also handles solo sets gracefully by returning `{ merged: true, solo: true }` immediately without git operations. No subagent is dispatched, no conflict detection runs, no integration tests are needed for solo-only waves.
- **Subagent dispatch:** This skill spawns **rapid-set-merger** subagents (one per set) for detection, resolution, and gate validation, and **rapid-conflict-resolver** subagents (one per conflict) for mid-confidence escalation resolution. The Agent tool is the only mechanism for subagent dispatch.
- **Fast path via git merge-tree:** Before dispatching a subagent, `git merge-tree --write-tree HEAD rapid/{setName}` checks for conflicts without touching the index or working tree. Exit code 0 means clean merge -- skip subagent entirely. This is the common case for well-isolated sets.
- **Sequential within waves:** Sets in the same wave merge one at a time. Each merge sees the result of the previous. HEAD advances after each Step 6, so merge-tree fast-path checks are always against current HEAD.
- **agentPhase1 tracking:** Set-merger agent lifecycle is tracked via `update-status --agent-phase` CLI calls. Transitions: idle -> spawned (before dispatch) -> done/failed (after return). No path should leave a set as 'spawned' after dispatch completes.
- **agentPhase2 tracking:** Conflict-resolver agent lifecycle is tracked via `update-status --agent-phase2 <conflictId> <phase>` CLI calls. agentPhase2 is an object map `{ [conflictId]: 'idle'|'spawned'|'done'|'failed' }` tracking each conflict independently.
- **Adaptive conflict resolution (Step 3e):** Escalations are routed by confidence band: API-signature conflicts always go to human direction gate, confidence < 0.3 goes to human directly, 0.3-0.8 dispatched to rapid-conflict-resolver agents, > 0.8 auto-accepted. Resolver results with confidence >= 0.7 are auto-accepted, < 0.7 escalated to human with deeper analysis.
- **Retry logic:** CHECKPOINT returns are auto-retried ONCE with checkpoint data in the re-dispatch prompt. Max 2 total attempts per set (initial + 1 retry). Retry counter is in-memory (not persisted) -- each `/rapid:merge` invocation starts fresh. Resolver agents do NOT retry -- failed resolvers escalate to human immediately (they are already a second pass).
- **compressedResult in memory:** Step 3d stores compressResult output (~100 tokens per set) for use in Step 8 summary. Full detection/resolution details remain only in MERGE-STATE.json on disk.
- **Bisection auto-triggers:** On integration gate failure, bisection runs AUTOMATICALLY without a pre-bisection user prompt. The user locked this decision.
- **Post-bisection control:** After bisection identifies the breaking set, the user chooses: rollback, investigate, or abort.
- **Cascade detection on rollback:** Before rolling back, cascade impact is checked. If dependent sets would be affected, the user is warned.
- **Conflict handling:** If a merge has conflicts at Step 6, the developer is prompted with structured recovery options. Already-merged sets stay merged.
- **Worktrees preserved:** Merged worktrees are NOT auto-removed. Developer runs /rapid:cleanup explicitly.
- **Registry updates:** Merge status is always updated in both the registry and MERGE-STATE.json via CLI after each step. This ensures /rapid:status reflects current progress.
- **Idempotent re-entry:** If the pipeline is restarted, check MERGE-STATE.json to skip already-merged sets (status='complete') and already-resolved sets (agentPhase1='done'). Only process sets with status pending, detecting, resolving, or failed.
- **Never use `git add -A` or `git add .`** -- stage only specific files.
- **AskUserQuestion at every decision gate** -- all decisions are blocking until the user responds.
- **No "Resolve manually" in post-wave recovery** -- blocked set recovery options are Retry, Skip, and Abort only (per user locked decision).
- **Set status auto-transitions to 'merged' after successful merge.** This is the terminal set lifecycle state. After `merge execute` returns `merged: true`, the orchestrator runs `state transition set` to move the set to 'merged' status in STATE.json.
- **Post-merge review suggestion:** After successful merge, the pipeline suggests running `/rapid:review <set> --post-merge` for post-merge review. This is optional but recommended to catch integration issues and verify merge correctness. Post-merge review scopes files from the merge commit diff and does not require a worktree.
- **Pre-merge artifact cleanup.** Before running `git merge --no-ff`, the `mergeSet()` function automatically detects and commits any untracked files under `.planning/` on the base branch. This prevents merge failures caused by stale planning artifacts (WAVE-COMPLETE.md, PLAN-DIGEST.md, etc.) that were created during execution and landed on main as untracked files. The cleanup scopes to `.planning/` only and handles artifacts from ALL sets, not just the merging set.
