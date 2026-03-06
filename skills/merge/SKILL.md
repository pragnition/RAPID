---
description: Merge completed sets into main -- orchestrates review, cleanup, and dependency-ordered merging with integration gates
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion
---

# /rapid:merge -- Merge Pipeline Orchestrator

You are the RAPID merge orchestrator. This skill merges completed set branches into main via automated review, optional cleanup, and dependency-ordered merging. You spawn reviewer and cleanup subagents using the Agent tool. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Load Merge Plan

Determine merge order from the DAG:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" merge order
```

Check current merge and execution status:

```bash
node "${RAPID_TOOLS}" merge status
```

```bash
node "${RAPID_TOOLS}" execute wave-status
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

Use AskUserQuestion to confirm:
- **question:** "Merge plan"
- **options:**
  - "Start merge" -- description: "Merge {count} sets across {waveCount} waves. Wave 1: {first wave set names}"
  - "Cancel" -- description: "Exit without merging"

If the developer selects "Cancel", print "Merge pipeline cancelled." and exit.

## Step 2: Process Each Wave

For each wave (in order), run Steps 3-7 for each set in the wave. Sets within a wave merge SEQUENTIALLY (not in parallel) -- each merge sees the result of the previous one.

## Step 3: Programmatic Gate

For each set in the current wave:

1. Update merge status:
   ```bash
   node "${RAPID_TOOLS}" merge update-status {setName} reviewing
   ```

2. Run programmatic validation:
   ```bash
   node "${RAPID_TOOLS}" merge review {setName}
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
   node "${RAPID_TOOLS}" execute prepare-context {setName}
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

5. Handle verdict with a verdict banner:

   - **APPROVE:**
     > :white_check_mark: **APPROVED** -- {1-line summary of review findings, e.g., "Clean implementation, all contracts satisfied, no issues found"}

     Proceed to Step 6 (merge).

   - **CHANGES:**
     > :wrench: **CHANGES REQUESTED** -- {fixable issue count} fixable issues found. Cleanup round 1/2 starting.

     Proceed to Step 5 (cleanup).

   - **BLOCK:**
     > :no_entry: **BLOCKED** -- {blocking findings summary from REVIEW.md}

     Use AskUserQuestion to present options:
     - **question:** "Set blocked by reviewer"
     - **options:**
       - "View full review" -- description: "Show complete REVIEW.md contents for {setName}"
       - "Skip set, continue pipeline" -- description: "Skip {setName} and continue with remaining sets"
       - "Abort pipeline" -- description: "Exit merge pipeline entirely"

     If the developer selects "View full review":
     - Display the full contents of `.planning/sets/{setName}/REVIEW.md`
     - Then use a second AskUserQuestion:
       - **question:** "After reviewing findings"
       - **options:**
         - "Skip set" -- description: "Skip {setName} and continue with remaining sets"
         - "Abort pipeline" -- description: "Exit merge pipeline entirely"

     If the developer selects "Skip set, continue pipeline" (or "Skip set" from second prompt):
     - Continue to the next set in the wave.

     If the developer selects "Abort pipeline" (from either prompt):
     - Print "Merge pipeline cancelled." and exit.

Display progress:
> [{waveNum}/{totalWaves}] {setName}: review verdict = {verdict}

## Step 5: Cleanup Loop (max 2 rounds)

If the reviewer returned CHANGES verdict:

For round = 1 to 2:

1. Display cleanup progress banner:
   > Cleanup round {round}/2 -- re-reviewing {setName}...

2. Read the REVIEW.md to get fixable findings:
   ```bash
   cat .planning/sets/{setName}/REVIEW.md
   ```

3. Update merge status:
   ```bash
   node "${RAPID_TOOLS}" merge update-status {setName} cleanup
   ```

4. Spawn cleanup subagent using the Agent tool. Get worktree path from registry:
   ```bash
   node "${RAPID_TOOLS}" worktree list 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));const w=d.worktrees||{};const e=(Array.isArray(w)?w:Object.values(w)).find(x=>x.setName==='{setName}');console.log(e?.path||'NOT_FOUND')"
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

5. After cleanup returns, re-run programmatic gate:
   ```bash
   node "${RAPID_TOOLS}" merge review {setName}
   ```

6. If programmatic gate still passes, re-spawn reviewer (same prompt as Step 4) to re-evaluate.

7. Parse new verdict and display verdict banner:
   - **APPROVE:**
     > :white_check_mark: **APPROVED** -- {1-line summary}

     Break loop, proceed to Step 6.

   - **CHANGES:**
     > :wrench: **CHANGES REQUESTED** -- {fixable issue count} issues remain. Cleanup round {round}/2.

     Continue to next round (or escalate if round 2).

   - **BLOCK:**
     > :no_entry: **BLOCKED** -- {blocking findings summary}

     Use AskUserQuestion:
     - **question:** "Set blocked by reviewer"
     - **options:**
       - "View full review" -- description: "Show complete REVIEW.md contents for {setName}"
       - "Skip set, continue pipeline" -- description: "Skip {setName} and continue with remaining sets"
       - "Abort pipeline" -- description: "Exit merge pipeline entirely"

     Handle the same way as Step 4 BLOCK verdict.

If still CHANGES after round 2:

> :wrench: **Cleanup escalation** -- Set '{setName}' still has issues after 2 cleanup rounds.
> {Show remaining findings from REVIEW.md}

Use AskUserQuestion:
- **question:** "Cleanup escalation"
- **options:**
  - "Fix manually" -- description: "Resolve remaining issues in your terminal, then re-run /rapid:merge {setName}"
  - "Skip set" -- description: "Continue pipeline without this set"
  - "Abort pipeline" -- description: "Exit merge pipeline entirely"

If the developer selects "Fix manually":
- Print "Pausing for manual fix. Re-run `/rapid:merge {setName}` when ready." and exit.

If the developer selects "Skip set":
- Continue to the next set in the wave.

If the developer selects "Abort pipeline":
- Print "Merge pipeline cancelled." and exit.

Display progress:
> [{waveNum}/{totalWaves}] {setName}: cleanup round {round}/2 -- {verdict}

## Step 6: Merge Set

After a set is approved (or was approved from the start):

1. Execute the merge:
   ```bash
   node "${RAPID_TOOLS}" merge execute {setName}
   ```

2. Parse the JSON result:
   - If `merged: true`:
     > Merged '{setName}' -> {baseBranch} (commit: {commitHash})

   - If `merged: false, reason: 'conflict'`:
     > :warning: **Merge conflict** in set '{setName}'
     > Conflicting files: {list conflicting files from detail}

     Use AskUserQuestion:
     - **question:** "Merge conflict"
     - **options:**
       - "Resolve manually" -- description: "View conflicting files and resolve commands (git add, git merge --continue)"
       - "Show diff" -- description: "Display the diff output for conflicting files"
       - "Abort pipeline" -- description: "Exit merge pipeline. Already-merged sets in this wave remain merged."

     If the developer selects "Resolve manually":
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
         - "Resolved -- continue pipeline" -- description: "Conflicts are resolved, continue merging remaining sets"
         - "Still stuck -- abort" -- description: "Exit merge pipeline"

       If "Resolved -- continue pipeline": continue to next set.
       If "Still stuck -- abort": print "Merge pipeline cancelled." and exit.

     If the developer selects "Show diff":
     - Run `git diff` and display the output.
     - Then use a second AskUserQuestion:
       - **question:** "After viewing diff"
       - **options:**
         - "Resolve manually" -- description: "View resolve commands and fix conflicts"
         - "Abort pipeline" -- description: "Exit merge pipeline"

       If "Resolve manually": show the resolve commands and follow-up prompt as above.
       If "Abort pipeline": print "Merge pipeline cancelled." and exit.

     If the developer selects "Abort pipeline":
     - Print "Merge pipeline cancelled. Already-merged sets in this wave remain merged." and exit.

   - If `merged: false, reason: 'error'`:
     > :x: **Merge error** for set '{setName}'
     > Detail: {detail}

     Use AskUserQuestion:
     - **question:** "Merge error"
     - **options:**
       - "Retry merge" -- description: "Attempt the merge again for {setName}"
       - "Skip set" -- description: "Continue pipeline without this set"
       - "Abort pipeline" -- description: "Exit merge pipeline entirely"

     If "Retry merge": re-run `node "${RAPID_TOOLS}" merge execute {setName}` and re-parse result.
     If "Skip set": continue to next set.
     If "Abort pipeline": print "Merge pipeline cancelled." and exit.

Display progress:
> [{waveNum}/{totalWaves}] {setName}: MERGED (commit {commitHash})

## Step 7: Post-Wave Integration Gate

After ALL sets in the current wave have been merged (or skipped):

1. Run integration tests on main:
   ```bash
   node "${RAPID_TOOLS}" merge integration-test
   ```

2. Parse result:
   - If `passed: true`:
     > **Wave {waveNum} integration gate: PASS**
     > All tests pass on {baseBranch} after merging Wave {waveNum} sets.
   - If `passed: false`:
     > **Wave {waveNum} integration gate: FAIL**
     > Tests failing on {baseBranch} after merging Wave {waveNum} sets.
     > Output: {test output}

     Use AskUserQuestion:
     - **question:** "Integration gate failed"
     - **options:**
       - "Investigate" -- description: "View test output and pause for manual fix"
       - "Revert wave" -- description: "Undo all merges from Wave {waveNum} (destructive)"
       - "Abort pipeline" -- description: "Exit without reverting"

     If the developer selects "Investigate":
     - Display the full test output.
     - Print "Pausing for investigation. Re-run `/rapid:merge` to continue after fixing." and exit.

     If the developer selects "Revert wave":
     - Use a second AskUserQuestion for double confirmation:
       - **question:** "Confirm wave revert"
       - **options:**
         - "Confirm revert" -- description: "This will revert merges for {list of sets merged in this wave}. This action cannot be undone."
         - "Cancel" -- description: "Return without reverting"

       If "Confirm revert": execute the revert and print "Wave {waveNum} merges reverted." Then exit.
       If "Cancel": return to the integration gate failed prompt.

     If the developer selects "Abort pipeline":
     - Print "Merge pipeline cancelled. Wave {waveNum} merges remain on {baseBranch}." and exit.

3. If integration gate passed, confirm with user before proceeding:

   Use AskUserQuestion:
   - **question:** "Wave {waveNum} complete"
   - **options:**
     - "Continue to Wave {waveNum+1}" -- description: "Proceed to merge Wave {waveNum+1} sets"
     - "Pause pipeline" -- description: "Pause merge pipeline after Wave {waveNum}. Resume with /rapid:merge."

   If the developer selects "Pause pipeline", print "Merge pipeline paused after Wave {waveNum}. Resume with `/rapid:merge`." and exit.

## Step 8: Pipeline Complete

After all waves complete:

```bash
node "${RAPID_TOOLS}" merge status
```

Present final summary:

> **Merge Pipeline Complete**
>
> **Summary:**
> - Total sets merged: {count}
> - Total waves: {count}
> - Sets skipped (blocked): {list or "none"}
> - Sets skipped (cleanup escalation): {list or "none"}

Use AskUserQuestion for next steps:
- **question:** "Merge pipeline complete"
- **options:**
  - "Run cleanup" -- description: "Remove completed worktrees with /rapid:cleanup"
  - "View status" -- description: "Show project status with /rapid:status"
  - "Done" -- description: "Exit merge pipeline"

## Important Notes

- **Agent tool usage:** This skill spawns reviewer and cleanup subagents. Subagents cannot spawn other subagents.
- **Sequential within waves:** Sets in the same wave merge one at a time. Each merge sees the result of the previous.
- **Conflict handling:** If a merge has conflicts, the developer is prompted with structured recovery options. Already-merged sets stay merged.
- **Max 2 cleanup rounds:** After 2 rounds of cleanup without APPROVE, escalate to human with structured options.
- **Worktrees preserved:** Merged worktrees are NOT auto-removed. Developer runs /rapid:cleanup explicitly.
- **Registry updates:** Always update merge status in registry via CLI after each step. This ensures /rapid:status reflects current progress.
- **Idempotent re-entry:** If the pipeline is restarted, check merge status to skip already-merged sets. Only re-review and re-merge sets with mergeStatus=pending.
