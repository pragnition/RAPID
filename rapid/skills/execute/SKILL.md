---
description: Execute sets in wave order -- drives discuss/plan/execute lifecycle per set via subagent spawning
allowed-tools: Read, Write, Bash, Agent
---

# /rapid:execute -- Set Execution Orchestrator

You are the RAPID execution orchestrator. This skill executes sets in dependency-ordered waves. Each set goes through a full discuss -> plan -> execute lifecycle via subagent invocations. You spawn one subagent per set per lifecycle phase using the Agent tool. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Load Execution Plan

Read the DAG to determine wave order:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs plan list-sets
```

Then load the DAG for wave ordering:

```bash
cat "$(node ~/RAPID/rapid/src/bin/rapid-tools.cjs plan list-sets 2>/dev/null | node -e "const j=require('fs').readFileSync('/dev/stdin','utf-8');const d=JSON.parse(j);console.log(d.projectRoot || '.')")/.planning/sets/DAG.json" 2>/dev/null || echo '{"waves":{}}'
```

Parse the DAG to get waves. Each wave contains a list of sets that can execute in parallel. Waves execute sequentially (Wave 1 before Wave 2).

Also check current execution state:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute wave-status
```

Show the user the execution plan:

> **Execution Plan:**
> - Wave 1: {set names} (parallel)
> - Wave 2: {set names} (depends on Wave 1)
> - ...
>
> **Current progress:** {wave-status summary}

Ask the user: "Ready to begin execution? (yes/no)" If they want to start from a specific wave or skip already-completed sets, accommodate that.

## Step 2: Process Each Wave

For each wave (in order), perform Steps 3-7. If a wave's sets are already in 'Done' phase (per registry), skip that wave and inform the user.

Before starting a wave, check the planning gate:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs plan check-gate {waveNumber}
```

If the gate is not open, STOP and inform the user:
> Planning gate for Wave {N} is not open. All sets in this wave must complete their planning phase first.
> Missing: {list of sets that haven't completed planning}
> Run `/rapid:plan` to complete set planning before execution.

## Step 3: Create Worktrees (if needed)

For each set in the current wave, check if a worktree already exists. If not, create one:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs worktree create {setName}
```

If the worktree already exists (created in a previous session), that is fine -- continue.

## Step 4: Generate Contract Stubs

For each set in the wave that has cross-set imports, generate stub files:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute generate-stubs {setName}
```

This creates `.rapid-stubs/` in the set's worktree with stub modules for each imported set's exports. The executor subagent can `require()` these stubs during development.

## Step 5: Discuss Phase (Per-Wave Batch)

For each set in the current wave, run the discuss phase. Present all sets' questions to the user before proceeding to planning.

For each set:

1. Prepare the discuss prompt:
   ```bash
   node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute prepare-context {setName}
   ```

2. Update registry phase:
   ```bash
   node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute update-phase {setName} Discussing
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
   node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute update-phase {setName} Planning
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

## Step 7: Execute Phase (Per-Wave Parallel)

For each set in the current wave, spawn an executor subagent. All sets in a wave can be spawned simultaneously (but be aware of rate limits -- if you encounter errors, reduce parallelism).

For each set:

1. Generate scoped CLAUDE.md for the worktree:
   ```bash
   node ~/RAPID/rapid/src/bin/rapid-tools.cjs worktree generate-claude-md {setName}
   ```

2. Update registry phase:
   ```bash
   node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute update-phase {setName} Executing
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

4. After the subagent returns, parse the structured return and run verification:
   ```bash
   node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute verify {setName} --branch main
   ```

   (Note: Replace 'main' with the actual base branch name)

5. Update registry phase based on results:
   ```bash
   # On success:
   node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute update-phase {setName} Done

   # On failure:
   node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute update-phase {setName} Error
   ```

6. Clean up stubs:
   ```bash
   node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute cleanup-stubs {setName}
   ```

## Step 8: Wave Completion

After all sets in the wave complete, present results:

> **Wave {N} Execution Results:**
>
> | Set | Status | Tasks | Commits | Issues |
> |-----|--------|-------|---------|--------|
> | {name} | {COMPLETE/BLOCKED/ERROR} | {N/M} | {count} | {any verification failures} |
>
> **Verification Summary:**
> - Passed: {count}
> - Failed: {count}
> - {details of any failures}

If any set failed verification:
> **Verification failures detected.** Options:
> 1. **Review failures** -- I will show the specific issues for each failed set
> 2. **Re-execute failed sets** -- Re-run execution for sets that failed
> 3. **Accept as-is** -- Proceed despite failures (user accepts responsibility)
> 4. **Cancel** -- Stop execution

If all sets passed, move to the next wave (back to Step 2).

## Step 9: Execution Complete

After all waves complete:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute wave-status
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
>
> **Next steps:**
> - Run `/rapid:status` to review worktree state
> - Each set's changes are on their respective `rapid/{set-name}` branches
> - Run the merge pipeline when ready (Phase 8)

## Important Notes

- **Agent tool usage:** This skill uses the Agent tool to spawn subagents. Each subagent runs in its own context window. Subagents CANNOT spawn other subagents -- this skill (the orchestrator) drives all 3 lifecycle phases.
- **Rate limiting:** If spawning multiple parallel subagents causes rate limit errors, reduce to sequential execution within the wave and inform the user.
- **Registry updates:** Always update the worktree registry phase after each lifecycle transition via the CLI. This ensures `/rapid:status` reflects current progress.
- **Stub cleanup:** Always clean up stub files after execution completes, even if execution failed. Stubs should not be committed.
- **Idempotent re-entry:** If execution is interrupted and restarted, check registry state to determine which sets/phases have already completed. Skip completed work and resume from the current point.
