---
description: Execute sets in wave order -- drives discuss/plan/execute lifecycle per set via subagent spawning, with pause/resume and wave reconciliation
allowed-tools: Read, Write, Bash, Agent
---

# /rapid:execute -- Set Execution Orchestrator

You are the RAPID execution orchestrator. This skill executes sets in dependency-ordered waves. Each set goes through a full discuss -> plan -> execute lifecycle via subagent invocations. You spawn one subagent per set per lifecycle phase using the Agent tool. Follow these steps IN ORDER. Do not skip steps.

## Step 0: Detect Execution Mode

Check if agent teams mode is available:

```bash
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" execute detect-mode
```

Parse the JSON output to get `agentTeamsAvailable`.

**If `agentTeamsAvailable` is true:**
Prompt the user (per user decision -- clean prompt, no explanation of detection source):

> Agent teams available. Use teams or subagents?
> 1. **Agent Teams** -- Enhanced parallel execution via Claude Code agent teams
> 2. **Subagents** -- Standard execution via subagent spawning

If the user chooses Agent Teams, set `executionMode = 'Agent Teams'`.
If the user chooses Subagents, set `executionMode = 'Subagents'`.

**If `agentTeamsAvailable` is false:**
Silently set `executionMode = 'Subagents'`. Do NOT prompt or inform the user about agent teams.

**Mode is locked for the entire execution run.** Do not re-detect or re-prompt during wave processing.

## Step 1: Load Execution Plan

Read the DAG to determine wave order:

```bash
node "${RAPID_TOOLS}" plan list-sets
```

Then load the DAG for wave ordering:

```bash
cat "$(node "${RAPID_TOOLS}" plan list-sets 2>/dev/null | node -e "const j=require('fs').readFileSync('/dev/stdin','utf-8');const d=JSON.parse(j);console.log(d.projectRoot || '.')")/.planning/sets/DAG.json" 2>/dev/null || echo '{"waves":{}}'
```

Parse the DAG to get waves. Each wave contains a list of sets that can execute in parallel. Waves execute sequentially (Wave 1 before Wave 2).

Also check current execution state:

```bash
node "${RAPID_TOOLS}" execute wave-status
```

Show the user the execution plan:

> **Execution Plan:**
> - Wave 1: {set names} (parallel)
> - Wave 2: {set names} (depends on Wave 1)
> - ...
>
> **Current progress:** {wave-status summary}

Ask the user: "Ready to begin execution? (yes/no)" If they want to start from a specific wave or skip already-completed sets, accommodate that.

## Step 1.5: Check for Paused Sets

After loading the DAG and wave status, check for any sets with HANDOFF.md files:

```bash
ls .planning/sets/*/HANDOFF.md 2>/dev/null
```

If any HANDOFF.md files exist, read each one to get pause details:

```bash
node "${RAPID_TOOLS}" execute resume {setName} 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));console.log(JSON.stringify(d.handoff,null,2))"
```

**Do NOT actually run `execute resume` yet** -- just read the HANDOFF.md directly to inspect it:

```bash
cat .planning/sets/{setName}/HANDOFF.md
```

Parse the frontmatter to get `tasks_completed`, `tasks_total`, and `pause_cycle`.

Present the paused sets to the user:

> **Paused sets detected:**
> - {setName}: paused at task {tasks_completed}/{tasks_total}, cycle {pause_cycle}
>
> Options:
> 1. **Resume** -- Continue from where execution left off
> 2. **Restart** -- Discard handoff and re-execute from scratch
> 3. **Skip** -- Proceed with other sets, leave paused set for later

If the user chooses **Resume**:
- Run the resume command:
  ```bash
  node "${RAPID_TOOLS}" execute resume {setName}
  ```
- Parse the JSON output to get the handoff data
- When spawning the executor subagent in Step 7, prepend the handoff content to the prompt (see Step 7 for the resume prompt template)

If the user chooses **Restart**:
- Delete the HANDOFF.md:
  ```bash
  rm .planning/sets/{setName}/HANDOFF.md
  ```
- Proceed with normal execution for that set

If the user chooses **Skip**:
- Leave the set paused
- Continue with other sets in the wave

## Step 2: Process Each Wave

For each wave (in order), perform Steps 3-7. If a wave's sets are already in 'Done' phase (per registry), skip that wave and inform the user.

Before starting a wave, check the planning gate:

```bash
node "${RAPID_TOOLS}" plan check-gate {waveNumber}
```

If the gate is not open, check the JSON output for details. The output includes `missingArtifacts` for disk-level verification:

- If the gate is blocked and the user wants to override:
  ```bash
  # Log the override for audit trail
  node -e "const p=require(process.env.RAPID_TOOLS ? require('path').resolve(process.env.RAPID_TOOLS, '..', '..', 'lib', 'plan.cjs') : (process.env.HOME + '/RAPID/src/lib/plan.cjs'));p.logGateOverride(process.cwd(), {waveNumber}, {missingSetsList})"
  ```
  Show the override confirmation prompt:
  > Gate blocked: {sets without plans}. Ready: {planned sets}.
  > Override? This will proceed despite incomplete planning.
  > Sets that would execute without plans: {list}
  > [yes/no]:

- If the user confirms override, proceed. If not, STOP and inform:
  > Planning gate for Wave {N} is not open. All sets in this wave must complete their planning phase first.
  > Missing: {list of sets that haven't completed planning}
  > Run `/rapid:plan` to complete set planning before execution.

## Step 3: Create Worktrees (if needed)

For each set in the current wave, check if a worktree already exists. If not, create one:

```bash
node "${RAPID_TOOLS}" worktree create {setName}
```

If the worktree already exists (created in a previous session), that is fine -- continue.

## Step 4: Generate Contract Stubs

For each set in the wave that has cross-set imports, generate stub files:

```bash
node "${RAPID_TOOLS}" execute generate-stubs {setName}
```

This creates `.rapid-stubs/` in the set's worktree with stub modules for each imported set's exports. The executor subagent can `require()` these stubs during development.

## Step 5: Discuss Phase (Per-Wave Batch)

For each set in the current wave, run the discuss phase. Present all sets' questions to the user before proceeding to planning.

For each set:

1. Prepare the discuss prompt:
   ```bash
   node "${RAPID_TOOLS}" execute prepare-context {setName}
   ```

2. Update registry phase:
   ```bash
   node "${RAPID_TOOLS}" execute update-phase {setName} Discussing
   ```

3. Spawn a discuss subagent using the Agent tool. The subagent should:
   - Receive the contract and definition for this set
   - Ask the developer clarifying questions about implementation approach
   - For simple/clear sets: state that no questions are needed and summarize the planned approach

   Build the subagent prompt from `assembleExecutorPrompt(cwd, setName, 'discuss')` -- but since you are a skill (not a library), construct the prompt inline:

   **Discuss subagent prompt template:**
   > You are reviewing the '{setName}' set before implementation. Here is the set's contract and definition.
   >
   > ## Contract
   > {Read .planning/sets/{setName}/CONTRACT.json}
   >
   > ## Definition
   > {Read .planning/sets/{setName}/DEFINITION.md}
   >
   > Review the above and ask the developer any clarifying questions about implementation approach, edge cases, or integration points. If everything is clear, state your understanding and the approach you would take.

4. Collect the user's answers and the subagent's summary. Store these as the "discuss decisions" for this set.

After all sets in the wave have been discussed, present a summary:
> **Discussion complete for Wave {N}:**
> - {setName}: {brief summary of decisions/approach}
> - ...
>
> Ready to proceed to planning? (yes/no)

**Lightweight discuss option:** For sets with clear, unambiguous definitions (few tasks, no cross-set dependencies), you may skip the subagent and directly ask the user: "Set '{setName}' has a clear definition. Any questions before we plan it?" This saves a subagent invocation for simple sets.

## Step 6: Plan Phase (Per-Wave Batch)

For each set in the current wave, spawn a planning subagent:

1. Update registry phase:
   ```bash
   node "${RAPID_TOOLS}" execute update-phase {setName} Planning
   ```

2. Spawn a plan subagent using the Agent tool. The subagent should:
   - Receive the contract, definition, and discuss decisions
   - Create a step-by-step implementation plan
   - Output the plan in a structured format

   **Plan subagent prompt template:**
   > You are creating an implementation plan for the '{setName}' set.
   >
   > ## Contract
   > {CONTRACT.json content}
   >
   > ## Definition
   > {DEFINITION.md content}
   >
   > ## Discussion Decisions
   > {decisions from Step 5}
   >
   > Create a step-by-step implementation plan. For each step specify:
   > 1. Files to create or modify
   > 2. What to implement
   > 3. How to verify it works
   > 4. What to commit (type(setName): description format)
   >
   > Each commit must leave the codebase in a working state.

3. Present the plan to the user for review. The user can approve, request changes, or skip.

After all sets are planned, present a summary and ask for approval:
> **Plans ready for Wave {N}:**
> - {setName}: {N tasks planned}
> - ...
>
> Approve all plans and begin execution? (yes/modify/cancel)

If modify: collect changes and re-plan the affected set.
If cancel: STOP execution.

## Step 7: Execute Phase (Per-Wave)

Execution dispatch depends on the mode selected in Step 0.

### Step 7a: Teams Mode Dispatch

If `executionMode` is 'Agent Teams':

For the current wave, create a team and spawn teammates:

1. Note the team name for this wave:
   The team follows the convention `rapid-wave-{waveNum}`.

2. For each set in the wave, prepare the teammate:
   - Generate scoped CLAUDE.md:
     ```bash
     node "${RAPID_TOOLS}" worktree generate-claude-md {setName}
     ```
   - Update registry phase:
     ```bash
     node "${RAPID_TOOLS}" execute update-phase {setName} Executing
     ```

3. Use the Agent tool to create a team and spawn teammates. For each set in the wave, spawn a teammate with the same executor prompt as subagent mode (read from the set's worktree CLAUDE.md + implementation plan). Each teammate works in its own worktree directory.

   **Teammate prompt template** (identical to subagent executor prompt):
   > You are implementing the '{setName}' set in the worktree at {worktreePath}.
   >
   > {Content of scoped CLAUDE.md}
   >
   > ## Implementation Plan
   > {plan from Step 6}
   >
   > ## Execution Instructions
   > - Work ONLY in the worktree directory: {worktreePath}
   > - Commit after each task: `git add <specific files> && git commit -m "type({setName}): description"`
   > - NEVER use `git add .` or `git add -A`
   > - If you need imports from other sets, use stub files in .rapid-stubs/
   > - Run verification after each task
   > - When complete, emit a RAPID:RETURN with status COMPLETE

4. Track teammate completion. Check the tracking file for completions:
   ```bash
   cat .planning/teams/rapid-wave-{waveNum}-completions.jsonl 2>/dev/null | wc -l
   ```

   Wait until all teammates have completed (completions count equals number of sets in wave).

5. Clean up team tracking:
   ```bash
   rm -f .planning/teams/rapid-wave-{waveNum}-completions.jsonl
   ```

6. For each set, run verification (same as subagent mode):
   ```bash
   node "${RAPID_TOOLS}" execute verify {setName} --branch main
   ```
   Update registry phase based on results.

7. Clean up stubs for completed sets.

**If any team operation fails (team spawn fails, teammate crashes, any error):**

Print a visible warning:
> **Warning:** Agent teams failed for wave {waveNum}. Falling back to subagent execution.

Then execute the ENTIRE wave using subagent mode (Step 7b below). This is a generic fallback -- do not inspect or special-case the error type.

### Step 7b: Subagent Mode Dispatch

If `executionMode` is 'Subagents', OR if teams mode failed and we are falling back:

For each set in the current wave, spawn an executor subagent. All sets in a wave can be spawned simultaneously (but be aware of rate limits -- if you encounter errors, reduce parallelism).

For each set:

1. Generate scoped CLAUDE.md for the worktree:
   ```bash
   node "${RAPID_TOOLS}" worktree generate-claude-md {setName}
   ```

2. Update registry phase:
   ```bash
   node "${RAPID_TOOLS}" execute update-phase {setName} Executing
   ```

3. Spawn an executor subagent using the Agent tool. The subagent should:
   - Work in the set's worktree directory ({worktreePath} from registry)
   - Receive the scoped CLAUDE.md (contract, ownership, deny list, style guide)
   - Receive the implementation plan from Step 6
   - Implement each task, committing atomically per task
   - Return COMPLETE with artifacts and commit hashes via RAPID:RETURN

   **Executor subagent prompt template:**
   > You are implementing the '{setName}' set in the worktree at {worktreePath}.
   >
   > {Content of scoped CLAUDE.md -- read from {worktreePath}/CLAUDE.md}
   >
   > ## Implementation Plan
   > {plan from Step 6}
   >
   > ## Execution Instructions
   > - Work ONLY in the worktree directory: {worktreePath}
   > - Commit after each task: `git add <specific files> && git commit -m "type({setName}): description"`
   > - NEVER use `git add .` or `git add -A`
   > - If you need imports from other sets, use stub files in .rapid-stubs/ -- do NOT read other sets' actual implementations
   > - Run verification after each task
   > - When complete, emit a RAPID:RETURN with status COMPLETE listing all artifacts and commit hashes
   > - If blocked, emit RAPID:RETURN with status BLOCKED and the appropriate category
   >
   > ## Context Window Management
   > If you are approaching your context window limit and have more tasks to complete:
   > 1. Commit all current work
   > 2. Emit a RAPID:RETURN with status CHECKPOINT and include:
   >    - handoff_done: bullet list of completed tasks with commit hashes
   >    - handoff_remaining: bullet list of remaining tasks
   >    - handoff_resume: specific instructions for the next session
   >    - tasks_completed: number of tasks finished
   >    - tasks_total: total tasks in the plan
   > 3. This will trigger an automatic pause and your state will be saved

   **If resuming from a pause (HANDOFF.md exists):**

   Prepend the following to the executor prompt before the Implementation Plan section:

   > ## Resuming from Pause
   > You are continuing execution of set '{setName}' from a previous session.
   >
   > ### Previously Completed
   > {handoff.completedWork}
   >
   > ### Remaining Work
   > {handoff.remainingWork}
   >
   > ### Resume Instructions
   > {handoff.resumeInstructions}
   >
   > Start from the first incomplete task. Do NOT redo completed work.

4. After the subagent returns, check the return status:

   **If return status is COMPLETE:**
   - Parse the structured return and run verification:
     ```bash
     node "${RAPID_TOOLS}" execute verify {setName} --branch main
     ```
     (Note: Replace 'main' with the actual base branch name)
   - Update registry phase based on results:
     ```bash
     # On success:
     node "${RAPID_TOOLS}" execute update-phase {setName} Done

     # On failure:
     node "${RAPID_TOOLS}" execute update-phase {setName} Error
     ```

   **If return status is CHECKPOINT (context window limit reached):**
   - Pipe the checkpoint data to the pause CLI:
     ```bash
     echo '{"handoff_done":"...","handoff_remaining":"...","handoff_resume":"...","tasks_completed":N,"tasks_total":M}' | node "${RAPID_TOOLS}" execute pause {setName}
     ```
   - Inform the user:
     > Set '{setName}' was paused (context limit reached). Resume with `/rapid:execute` or manage with `/rapid:pause`.
   - Mark the set as paused and move on to the next set in the wave (do NOT stop the whole wave)

   **If return status is BLOCKED:**
   - Update registry phase to Error:
     ```bash
     node "${RAPID_TOOLS}" execute update-phase {setName} Error
     ```

5. Clean up stubs (for COMPLETE and BLOCKED, not for CHECKPOINT/paused):
   ```bash
   node "${RAPID_TOOLS}" execute cleanup-stubs {setName}
   ```

## Step 8: Wave Reconciliation

After all sets in a wave complete (or are paused), run mandatory reconciliation:

1. Run reconciliation (passing execution mode for wave summary metadata):
   ```bash
   node "${RAPID_TOOLS}" execute reconcile {waveNumber} --mode "{executionMode}"
   ```

2. Parse the JSON output for overall result and details.

3. Present results to the user:

   > **Wave {N} Reconciliation Results:**
   >
   > **Overall:** {PASS/PASS_WITH_WARNINGS/FAIL}
   >
   > {Per-set details from WAVE-{N}-SUMMARY.md}
   >
   > **Hard Blocks:** {list or "None"}
   > **Soft Blocks:** {list or "None"}

4. Handle based on result:

   **If hard blocks exist:**
   > Hard blocks must be resolved before Wave {N+1} can proceed.
   > Options:
   > 1. **Fix** -- Re-execute the failed sets
   > 2. **Cancel** -- Stop execution

   **If only soft blocks:**
   > Soft blocks detected. Options:
   > 1. **Proceed** -- Accept soft blocks and continue to Wave {N+1}
   > 2. **Fix** -- Re-execute to address soft blocks

   **If PASS:**
   > All contract obligations satisfied. Proceeding to Wave {N+1}.

5. Wait for developer acknowledgment before proceeding to next wave. Even for PASS, confirm:
   > Wave {N} reconciliation complete. Continue to Wave {N+1}? (yes/no)

Then move to the next wave (back to Step 2).

## Step 9: Execution Complete

After all waves complete:

```bash
node "${RAPID_TOOLS}" execute wave-status
```

Present final summary:

> **Execution Complete**
>
> All {N} sets across {M} waves have been executed.
>
> **Summary:**
> - Total sets: {N}
> - Total commits: {sum}
> - Verification: {pass/fail counts}
> - Paused sets: {count, if any}
>
> **Execution mode used:** {executionMode}
>
> **Next steps:**
> - Run `/rapid:status` to review worktree state
> - Each set's changes are on their respective `rapid/{set-name}` branches
> - If any sets are paused, run `/rapid:execute` again to resume them
> - Run the merge pipeline when ready (Phase 8)

## Important Notes

- **Agent tool usage:** This skill uses the Agent tool to spawn subagents. Each subagent runs in its own context window. Subagents CANNOT spawn other subagents -- this skill (the orchestrator) drives all 3 lifecycle phases.
- **Rate limiting:** If spawning multiple parallel subagents causes rate limit errors, reduce to sequential execution within the wave and inform the user.
- **Registry updates:** Always update the worktree registry phase after each lifecycle transition via the CLI. This ensures `/rapid:status` reflects current progress.
- **Stub cleanup:** Always clean up stub files after execution completes, even if execution failed. Stubs should not be committed. Do NOT clean up stubs for paused sets (they may need them on resume).
- **Idempotent re-entry:** If execution is interrupted and restarted, check registry state to determine which sets/phases have already completed. Skip completed work and resume from the current point.
- **Pause handling:** CHECKPOINT returns trigger automatic pause via the pause CLI. The handoff file preserves state for the next session. Paused sets do not block the rest of the wave.
- **Wave reconciliation:** Mandatory after every wave. Contract test failures are hard blocks (must fix). Missing artifacts are soft blocks (can be overridden). Developer must acknowledge results before the next wave proceeds.
- **Gate overrides:** If the planning gate is blocked but the user wants to proceed, log the override for audit trail and show explicit confirmation before continuing.
- **Dual-mode execution:** Mode is detected once at Step 0 and locked for the entire run. Teams mode creates one team per wave with one teammate per set. Both modes use identical verification, reconciliation, and status output.
- **Teams fallback:** If any team operation fails mid-execution, the entire wave is re-executed using subagent mode. The fallback is generic and does not inspect error types. A visible warning is printed when fallback occurs.
- **No inter-teammate messaging:** Teammates work in isolation. Contracts replace the need for communication (per user decision).
