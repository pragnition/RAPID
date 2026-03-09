---
description: Merge completed sets into main -- 5-level conflict detection, 4-tier resolution, DAG-ordered merging, bisection recovery, rollback
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion
---

# /rapid:merge -- Merge Pipeline Orchestrator (v2.0)

You are the RAPID merge orchestrator. This skill merges completed set branches into main via 5-level conflict detection, 4-tier resolution cascade, merger agent for semantic analysis, DAG-ordered merging with integration gates, automatic bisection recovery, and single-set rollback. You spawn the merger subagent using the Agent tool. Follow these steps IN ORDER. Do not skip steps.

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
node "${RAPID_TOOLS}" execute wave-status
```

Parse the merge order (wave-grouped arrays) and status. Identify which sets are ready to merge (phase=Done, mergeStatus=pending). Check MERGE-STATE.json for each set to enable idempotent re-entry -- skip sets that are already status='complete'.

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

## Step 3: Detection Pipeline

For each set in the current wave:

### 3a: Check idempotent re-entry

```bash
node "${RAPID_TOOLS}" merge merge-state {setName}
```

If the set's MERGE-STATE shows status='complete', skip to the next set. Display:
> [{waveNum}/{totalWaves}] {setName}: already merged (skipping)

### 3b: Update status and run detection

```bash
node "${RAPID_TOOLS}" merge update-status {setName} detecting
```

Run 5-level conflict detection:

```bash
node "${RAPID_TOOLS}" merge detect {setName}
```

Parse the JSON result. Display the detection summary:

> **Detection Report for {setName}:**
> - L1 Textual: {count} conflicts
> - L2 Structural: {count} conflicts
> - L3 Dependency: {count} conflicts
> - L4 API: {count} conflicts
> - L5 Semantic: pending (requires merger agent)

### 3c: Route based on detection results

- If zero conflicts across all levels (L1-L4 all empty), skip directly to Step 6 (merge). Display:
  > [{waveNum}/{totalWaves}] {setName}: no conflicts detected -- proceeding to merge

- If any conflicts found at any level, proceed to Step 4 (resolution cascade)

## Step 4: Resolution Cascade

### 4a: Run resolution

```bash
node "${RAPID_TOOLS}" merge update-status {setName} resolving
```

```bash
node "${RAPID_TOOLS}" merge resolve {setName}
```

Parse the JSON result. Display the resolution summary:

> **Resolution Summary for {setName}:**
> - Tier 1 (deterministic): {count} resolved
> - Tier 2 (heuristic): {count} resolved
> - Remaining for AI: {count}

### 4b: Route based on resolution results

- If all conflicts resolved by T1/T2 (unresolvedForAgent = 0), proceed to Step 5 (programmatic gate)
- If unresolved conflicts remain (unresolvedForAgent > 0), proceed to Step 4c (merger agent)

### 4c: Merger Agent

Spawn the merger agent via the Agent tool. First, prepare context.

Read the set's context and contracts:

```bash
node "${RAPID_TOOLS}" execute prepare-context {setName}
```

Read the set's detection report from MERGE-STATE:

```bash
node "${RAPID_TOOLS}" merge merge-state {setName}
```

Read the set's contracts:

```bash
cat .planning/sets/{setName}/CONTRACT.json 2>/dev/null || echo '{}'
```

Collect contexts of other sets already merged in this wave by reading their CONTEXT.md files.

Get the unresolved conflicts from the resolution result (filter results where `resolved: false`).

Build the merger agent prompt by populating the role-merger.md placeholders:
- `{SET_NAME}`: the set being merged
- `{BASE_BRANCH}`: the base branch (from `detectMainBranch`)
- `{SET_CONTEXT}`: the set's CONTEXT.md content
- `{OTHER_SET_CONTEXTS}`: contexts of sets already merged in this wave
- `{DETECTION_REPORT}`: the full detection report JSON from MERGE-STATE
- `{CONTRACTS}`: the set's CONTRACT.json content
- `{UNRESOLVED_CONFLICTS}`: JSON array of unresolved conflicts from resolution cascade

Assemble and spawn:

```bash
node "${RAPID_TOOLS}" assemble-agent merger
```

Print progress banner before spawning:
> Spawning merger agent for {setName}...

Spawn the merger agent using the Agent tool with the assembled prompt.

### 4d: Process merger agent results

Parse the RAPID:RETURN from the agent. Extract:
- `semantic_conflicts`: Display any L5 findings
- `resolutions`: Show how many resolved and with what confidence
- `escalations`: Show conflicts needing human input

Display merger agent results:

> **Merger Agent Results for {setName}:**
> - Semantic conflicts found: {count}
> - Resolutions applied (T3): {count}
> - Escalations to human (T4): {count}

### 4e: Handle escalations

For each escalation (confidence below threshold):

> **Conflict in {file}:** {description}
> **Confidence:** {score} (below threshold 0.7)
> **Proposed resolution:** {proposed_resolution}
> **Reason for escalation:** {reason}

Use AskUserQuestion:
- **question:** "Conflict escalation for {file}"
- **options:**
  - "Accept AI resolution" -- description: "Apply the AI's proposed resolution despite low confidence"
  - "Resolve manually" -- description: "Open the file and resolve this conflict yourself. Pipeline will pause."
  - "Skip conflict" -- description: "Leave conflict unresolved and continue to merge"

If the developer selects "Accept AI resolution":
- Apply the proposed resolution (write the file in the worktree)
- Continue to next escalation (or Step 5 if done)

If the developer selects "Resolve manually":
- Print "Pausing for manual resolution of {file}. Re-run `/rapid:merge {setName}` when done." and exit.

If the developer selects "Skip conflict":
- Log the skipped conflict and continue

## Step 5: Programmatic Gate

After detection and resolution are complete:

```bash
node "${RAPID_TOOLS}" merge review {setName}
```

Parse the JSON result:

- If `passed` is true: proceed to Step 6 (merge). Display:
  > [{waveNum}/{totalWaves}] {setName}: programmatic gate PASS

- If `passed` is false:
  - If ownership violations exist:
    > **BLOCKED:** Set '{setName}' has ownership violations:
    > {list violations}

  - If contract/test failure:
    > **BLOCKED:** Set '{setName}' failed contract/test validation:
    > {failure details}

  Use AskUserQuestion:
  - **question:** "Set blocked by programmatic gate"
  - **options:**
    - "View details" -- description: "Show full validation results for {setName}"
    - "Skip set, continue pipeline" -- description: "Skip {setName} and continue with remaining sets"
    - "Abort pipeline" -- description: "Exit merge pipeline entirely"

  If the developer selects "View details":
  - Display the full validation output
  - Then use a second AskUserQuestion:
    - **question:** "After reviewing validation results"
    - **options:**
      - "Skip set" -- description: "Skip {setName} and continue with remaining sets"
      - "Abort pipeline" -- description: "Exit merge pipeline entirely"

  If the developer selects "Skip set, continue pipeline" (or "Skip set"):
  - Continue to the next set in the wave

  If the developer selects "Abort pipeline":
  - Print "Merge pipeline cancelled." and exit

## Step 6: Merge Set

After a set passes the programmatic gate (or had zero conflicts):

```bash
node "${RAPID_TOOLS}" merge execute {setName}
```

Parse the JSON result:

- If `merged: true`:
  > [{waveNum}/{totalWaves}] {setName}: MERGED (commit {commitHash})

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

## Step 7: Post-Wave Integration Gate

After ALL sets in the current wave have been merged (or skipped):

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

Collect MERGE-STATE data for all sets to build final summary with detection/resolution stats:

```bash
for set in {all sets}; do node "${RAPID_TOOLS}" merge merge-state $set; done
```

Present final summary:

> **Merge Pipeline Complete**
>
> **Summary:**
> - Total sets merged: {count}
> - Total waves: {count}
> - Sets skipped (blocked): {list or "none"}
> - Sets rolled back: {list or "none"}
> - Conflicts detected: {total across all sets}
> - Conflicts auto-resolved (T1/T2): {count}
> - Conflicts AI-resolved (T3): {count}
> - Conflicts escalated (T4): {count}
> - Bisection runs: {count or "none"}

Use AskUserQuestion for next steps:
- **question:** "Merge pipeline complete"
- **options:**
  - "Run cleanup" -- description: "Remove completed worktrees with /rapid:cleanup"
  - "View status" -- description: "Show project status with /rapid:status"
  - "Done" -- description: "Exit merge pipeline"

## Important Notes

- **Agent tool usage:** This skill spawns only the merger subagent. The reviewer subagent from v1.0 is REMOVED -- review is now handled by Phase 22's review module (`/rapid:review`).
- **Sequential within waves:** Sets in the same wave merge one at a time. Each merge sees the result of the previous.
- **Bisection auto-triggers:** On integration gate failure, bisection runs AUTOMATICALLY without a pre-bisection user prompt. The user locked this decision.
- **Post-bisection control:** After bisection identifies the breaking set, the user chooses: rollback, investigate, or abort.
- **Cascade detection on rollback:** Before rolling back, cascade impact is checked. If dependent sets would be affected, the user is warned.
- **Conflict handling:** If a merge has conflicts, the developer is prompted with structured recovery options. Already-merged sets stay merged.
- **Worktrees preserved:** Merged worktrees are NOT auto-removed. Developer runs /rapid:cleanup explicitly.
- **Registry updates:** Merge status is always updated in both the registry and MERGE-STATE.json via CLI after each step. This ensures /rapid:status reflects current progress.
- **Idempotent re-entry:** If the pipeline is restarted, check MERGE-STATE.json to skip already-merged sets (status='complete'). Only process sets with status pending, detecting, resolving, or failed.
- **Never use `git add -A` or `git add .`** -- stage only specific files.
- **AskUserQuestion at every decision gate** -- all decisions are blocking until the user responds.
