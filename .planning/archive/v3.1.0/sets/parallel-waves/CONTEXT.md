# CONTEXT: parallel-waves

**Set:** parallel-waves
**Generated:** 2026-03-13
**Mode:** interactive

<domain>
## Set Boundary
Enable concurrent execution of independent waves within a set. Fix the pre-existing bug where transitionWave() and transitionJob() are called by the CLI but not exported from state-machine.cjs. Add wave independence detection using the existing DAG module's BFS level grouping. Modify the execute-set skill to dispatch independent waves concurrently while serializing git operations to prevent index corruption.

Dependencies: Set 1 (status-rename) -- modifies the same state machine, transition, and schema files.
</domain>

<decisions>
## Implementation Decisions

### Wave/Job State Tracking
- Extend STATE.json schema (single source of truth)
- Add waves/jobs arrays to SetState in state-schemas.cjs Zod schema
- transitionWave() and transitionJob() operate on STATE.json directly, validated by Zod
- Wave-level transition map: pending -> executing -> complete (validated like set transitions)
- Per-job granularity included since contract exports transitionJob()

### Parallel Dispatch Strategy
- Skill-level dispatch: execute-set skill spawns multiple rapid-executor Task agents in parallel using Claude Code's native parallel tool calls
- No new Node.js orchestrator runtime -- keep it in the skill prompt layer
- DAG module's getExecutionOrder() already returns string[][] (array of parallel groups) -- use this directly
- No artificial concurrency limit -- dispatch all independent waves in a group simultaneously
- On partial failure: keep completed wave results, mark failed wave for re-execution

### Git Serialization Mechanism
- Orchestrator commits: executors make changes but do NOT commit
- Execute-set orchestrator commits sequentially after each executor completes
- No git locking needed since only the orchestrator touches the git index
- Each executor returns its changes; orchestrator stages, commits, and writes WAVE-COMPLETE.md markers
- This naturally serializes all git operations through the single orchestrator thread

### execute-set Skill Rewrite
- Auto-detect from DAG (default behavior): always analyze wave dependencies from plan files
- Dispatch independent wave groups in parallel automatically
- Sequential execution is the natural degenerate case for linear DAGs (no flag needed)
- Full rewrite of Step 4 (Execute Waves) in the skill to support parallel dispatch
- Re-entry detection (Step 2) still works via WAVE-COMPLETE.md markers

### Claude's Discretion
- Exact Zod schema shape for WaveState and JobState (will follow existing SetState pattern)
- Wave transition map details (simple linear: pending -> executing -> complete)
- detectIndependentWaves() implementation details (will use assignWaves from dag.cjs)
- Error recovery strategy for partial parallel execution failures
- WAVE-COMPLETE.md marker format updates (if any needed for parallel context)
</decisions>

<specifics>
## Specific Ideas
- Reuse dag.cjs assignWaves() and getExecutionOrder() -- already returns the parallel grouping needed
- transitionWave/transitionJob should use withStateTransaction() for atomic updates (existing pattern)
- Execute-set orchestrator pattern: for each wave group, spawn N agents in parallel, await all, then commit each sequentially
- The skill prompt change is mostly in Step 4 -- Steps 1-3 and 5-6 stay largely the same
</specifics>

<code_context>
## Existing Code Insights

### state-machine.cjs (src/lib/state-machine.cjs)
- Exports: createInitialState, readState, writeState, withStateTransaction, findMilestone, findSet, transitionSet, addMilestone, validateDiskArtifacts, detectCorruption, recoverFromGit, commitState
- Missing: transitionWave, transitionJob (contract requires these)
- withStateTransaction() provides lock-protected atomic state mutations -- ideal for wave/job transitions
- findSet() exists but no findWave() or findJob() helpers yet

### state-schemas.cjs (src/lib/state-schemas.cjs)
- SetStatus: z.enum(['pending', 'discussing', 'planning', 'executing', 'complete', 'merged'])
- SetState: z.object({ id, status }) -- needs extension for waves/jobs arrays
- No WaveStatus or JobStatus schemas exist yet

### state-transitions.cjs (src/lib/state-transitions.cjs)
- SET_TRANSITIONS map defines valid set transitions
- validateTransition() validates against this map
- Needs WAVE_TRANSITIONS and JOB_TRANSITIONS maps added

### dag.cjs (src/lib/dag.cjs)
- assignWaves(): BFS-level assignment, returns { nodeId: waveNumber }
- getExecutionOrder(): returns string[][] of parallel wave groups
- createDAGv2(): supports typed nodes (set/wave/job) with cross-type edge rejection
- These functions already provide the wave independence detection needed

### execute-set skill (skills/execute-set/SKILL.md)
- Step 4 is purely sequential: "For each wave N that needs execution"
- Uses WAVE-COMPLETE.md markers for re-entry detection
- Spawns rapid-executor agents via Task tool
- Needs rewrite of Step 4 for parallel group dispatch
</code_context>

<deferred>
## Deferred Ideas
- Per-wave worktrees for true git isolation (mentioned but rejected in favor of orchestrator commits)
- Node.js-level orchestrator runtime (rejected in favor of skill-level dispatch)
- Concurrency limits for large wave groups (not needed now, can add later if wave groups get large)
</deferred>
