---
description: Merge completed sets into main -- orchestrates review, cleanup, and dependency-ordered merging with integration gates
allowed-tools: Read, Write, Bash, Agent
---

# /rapid:merge -- Merge Pipeline Orchestrator

You are the RAPID merge orchestrator. This skill merges completed set branches into main via automated review, optional cleanup, and dependency-ordered merging. You spawn reviewer and cleanup subagents using the Agent tool. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Load Merge Plan

Determine merge order from the DAG:

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" merge order
```

Check current merge and execution status:

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" merge status
```

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" execute wave-status
```

Parse the merge order (wave-grouped arrays) and status. Identify which sets are ready to merge (phase=Done, mergeStatus=pending).

If a specific set name was provided (e.g., `/rapid:merge auth-set`):
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

Ask: "Ready to begin merge pipeline? (yes/no)"

## Step 2: Process Each Wave

For each wave (in order), run Steps 3-7 for each set in the wave. Sets within a wave merge SEQUENTIALLY (not in parallel) -- each merge sees the result of the previous one.

## Step 3: Programmatic Gate

For each set in the current wave:

1. Update merge status:
   ```bash
   node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" merge update-status {setName} reviewing
   ```

2. Run programmatic validation:
   ```bash
   node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" merge review {setName}
   ```

3. Parse the JSON result. If `passed` is false:
   - If ownership violations exist: this is a hard block. Skip agent review.
     > **BLOCKED:** Set '{setName}' has ownership violations:
     > {list violations}
     > These must be resolved manually. Skipping this set.
   - If contract/test failure: write REVIEW.md with verdict=BLOCK, skip agent review
   - Continue to next set in the wave

4. If `passed` is true: proceed to Step 4 (agent review)

Display progress:
> [{waveNum}/{totalWaves}] Reviewing {setName}... programmatic gate: PASS

## Step 4: Agent Review

Spawn the reviewer agent as a subagent using the Agent tool:

1. Prepare the reviewer prompt. Read the set's context:
   ```bash
   node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" execute prepare-context {setName}
   ```

2. Read the existing REVIEW.md (from Step 3):
   ```bash
   cat .planning/sets/{setName}/REVIEW.md
   ```

3. Spawn reviewer subagent with the Agent tool. Build the prompt:

   > You are reviewing set '{setName}' for merge readiness.
   >
   > ## Changed Files
   > {Read changed files from REVIEW.md or run: git -C {worktreePath} diff --name-only {baseBranch}...HEAD}
   >
   > ## Contract
   > {Read .planning/sets/{setName}/CONTRACT.json}
   >
   > ## Programmatic Results (already passed)
   > - Contract schema: PASS
   > - Contract tests: PASS
   > - Ownership: PASS
   >
   > ## Your Task
   > Perform deep code review in the worktree at {worktreePath}. Check:
   > 1. Code style matches project conventions
   > 2. Logic correctness (no bugs, race conditions, unhandled errors)
   > 3. Contract behavioral compliance (not just schema -- does the code DO what the contract specifies?)
   > 4. Test coverage for critical paths (exported functions, error paths)
   > 5. No hardcoded secrets or environment-specific paths
   >
   > ## Output
   > Write your review to `.planning/sets/{setName}/REVIEW.md` with this format:
   > - Heading: # Review: {setName}
   > - **Reviewed:** {ISO timestamp}
   > - **Verdict:** APPROVE | CHANGES | BLOCK
   > - <!-- VERDICT:{verdict} --> on its own line
   > - Sections: Contract Validation, Ownership Check, Test Results, Findings
   > - Findings subsections: Blocking, Fixable (auto-cleanup eligible), Suggestions
   >
   > Then emit a RAPID:RETURN with status COMPLETE.

4. After reviewer returns, parse the verdict:
   - Read `.planning/sets/{setName}/REVIEW.md` and find the `<!-- VERDICT:X -->` marker

5. Handle verdict:
   - **APPROVE:** Proceed to Step 6 (merge)
   - **CHANGES:** Proceed to Step 5 (cleanup)
   - **BLOCK:** Report to user, skip this set
     > **BLOCKED:** Set '{setName}' blocked by reviewer.
     > {Show blocking findings from REVIEW.md}

Display progress:
> [{waveNum}/{totalWaves}] {setName}: review verdict = {verdict}

## Step 5: Cleanup Loop (max 2 rounds)

If the reviewer returned CHANGES verdict:

For round = 1 to 2:

1. Read the REVIEW.md to get fixable findings:
   ```bash
   cat .planning/sets/{setName}/REVIEW.md
   ```

2. Update merge status:
   ```bash
   node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" merge update-status {setName} cleanup
   ```

3. Spawn cleanup subagent using the Agent tool. Get worktree path from registry:
   ```bash
   node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" worktree list 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));const w=d.worktrees||{};const e=(Array.isArray(w)?w:Object.values(w)).find(x=>x.setName==='{setName}');console.log(e?.path||'NOT_FOUND')"
   ```

   Build the cleanup prompt:

   > You are the cleanup agent for set '{setName}'. Work in the worktree at {worktreePath}.
   >
   > ## Fixable Issues (from REVIEW.md)
   > {Extract fixable findings from REVIEW.md}
   >
   > ## Rules
   > - Fix ONLY the listed fixable issues
   > - For style fixes: commit as `fix({setName}): {description}`
   > - For test generation: commit as `test({setName}): {description}`
   > - NEVER use `git add .` or `git add -A`
   > - Do NOT change logic, APIs, or architecture
   > - Run tests after changes to verify nothing broke
   >
   > When done, emit a RAPID:RETURN with status COMPLETE.

4. After cleanup returns, re-run programmatic gate:
   ```bash
   node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" merge review {setName}
   ```

5. If programmatic gate still passes, re-spawn reviewer (same prompt as Step 4) to re-evaluate.

6. Parse new verdict:
   - **APPROVE:** Break loop, proceed to Step 6
   - **CHANGES:** Continue to next round (or escalate if round 2)
   - **BLOCK:** Report to user, skip this set

If still CHANGES after round 2:
> **Escalated:** Set '{setName}' still has issues after 2 cleanup rounds.
> {Show remaining findings}
> Please fix manually and re-run `/rapid:merge {setName}`.

Skip this set and continue to the next.

Display progress:
> [{waveNum}/{totalWaves}] {setName}: cleanup round {round}/2 -- {verdict}

## Step 6: Merge Set

After a set is approved (or was approved from the start):

1. Execute the merge:
   ```bash
   node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" merge execute {setName}
   ```

2. Parse the JSON result:
   - If `merged: true`:
     > Merged '{setName}' -> {baseBranch} (commit: {commitHash})
   - If `merged: false, reason: 'conflict'`:
     > **MERGE CONFLICT:** Set '{setName}' has conflicts with {baseBranch}.
     > Detail: {detail}
     >
     > **Pipeline halted.** Already-merged sets in this wave remain merged.
     > Resolve conflicts manually, then re-run `/rapid:merge` to continue.
     **STOP the entire pipeline.** Do not continue to the next set or wave.
   - If `merged: false, reason: 'error'`:
     > **MERGE ERROR:** Set '{setName}' failed to merge.
     > Detail: {detail}
     **STOP the entire pipeline.**

Display progress:
> [{waveNum}/{totalWaves}] {setName}: MERGED (commit {commitHash})

## Step 7: Post-Wave Integration Gate

After ALL sets in the current wave have been merged (or skipped):

1. Run integration tests on main:
   ```bash
   node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" merge integration-test
   ```

2. Parse result:
   - If `passed: true`:
     > **Wave {waveNum} integration gate: PASS**
     > All tests pass on {baseBranch} after merging Wave {waveNum} sets.
     Continue to next wave.
   - If `passed: false`:
     > **Wave {waveNum} integration gate: FAIL**
     > Tests failing on {baseBranch} after merging Wave {waveNum} sets.
     > Output: {test output}
     >
     > **Pipeline halted before Wave {waveNum+1}.** Investigate test failures on {baseBranch}.
     **STOP.** Do not proceed to the next wave.

3. Confirm with user before proceeding:
   > Wave {waveNum} complete. Continue to Wave {waveNum+1}? (yes/no)

## Step 8: Pipeline Complete

After all waves complete:

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/rapid/src/bin/rapid-tools.cjs}" merge status
```

Present final summary:

> **Merge Pipeline Complete**
>
> **Summary:**
> - Total sets merged: {count}
> - Total waves: {count}
> - Sets skipped (blocked): {list or "none"}
> - Sets skipped (cleanup escalation): {list or "none"}
>
> **Next steps:**
> - Worktrees are preserved -- run `/rapid:cleanup` to remove them when ready
> - Run `/rapid:status` to see final state
> - All merged sets are on {baseBranch}

## Important Notes

- **Agent tool usage:** This skill spawns reviewer and cleanup subagents. Subagents cannot spawn other subagents.
- **Sequential within waves:** Sets in the same wave merge one at a time. Each merge sees the result of the previous.
- **Halt on conflict:** If any merge fails, the entire pipeline stops. Already-merged sets stay merged.
- **Max 2 cleanup rounds:** After 2 rounds of cleanup without APPROVE, escalate to human.
- **Worktrees preserved:** Merged worktrees are NOT auto-removed. Developer runs /rapid:cleanup explicitly.
- **Registry updates:** Always update merge status in registry via CLI after each step. This ensures /rapid:status reflects current progress.
- **Idempotent re-entry:** If the pipeline is restarted, check merge status to skip already-merged sets. Only re-review and re-merge sets with mergeStatus=pending.
