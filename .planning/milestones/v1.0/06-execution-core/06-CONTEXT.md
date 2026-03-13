# Phase 6: Execution Core - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Sets execute independently in isolated subagent contexts, each going through its own development lifecycle with clean git history. This phase builds the execution engine that spawns per-set subagents, drives their lifecycle, and verifies results. Requirements: EXEC-01, EXEC-02, EXEC-03.

Phase 7 (Execution Lifecycle) handles cross-set status dashboards, pause/resume, sync gate enforcement, and wave reconciliation. Phase 8 (Merge Pipeline) handles code review and merging. This phase focuses on making a single wave of sets execute correctly.

</domain>

<decisions>
## Implementation Decisions

### Subagent spawning model
- Use Claude Code's Task tool to spawn one subagent per set
- All sets within a wave launch simultaneously as concurrent Task subagents (parallel execution)
- Each subagent receives minimal context: scoped CLAUDE.md + CONTRACT.json + DEFINITION.md (lean context budget)
- Orchestrator collects results by parsing structured returns (RAPID:RETURN JSON) from subagent output using existing returns.cjs

### Per-set lifecycle design
- Full GSD-style lifecycle: discuss -> plan -> execute per set
- Orchestrator drives the lifecycle by spawning 3 sequential subagents per set per phase (discuss, plan, execute)
- The "discuss" phase prompts the user for implementation questions about each set individually
- User is prompted per-wave batch: before a wave starts, orchestrator runs discuss for all sets in that wave, then plan, then execute
- This aligns with the existing planning gate model (all sets planned before any executes)

### Commit strategy & enforcement
- Agent instruction mandates one commit per task (already in rapid-executor.md agent template)
- Commit message format: `type(set-name): description` (e.g., `feat(auth-api): implement JWT token generation`)
- Post-execution verification: check commit count matches task count using git log
- On commit count mismatch: flag the discrepancy and ask the user to decide (accept as-is, re-run, or manually fix)
- Post-execution ownership check: diff the set's branch vs base and verify all changed files are in the set's ownership list

### Context isolation boundaries
- Physical isolation via git worktrees (worktree.cjs already built -- no changes needed)
- Lock contention handled by existing lock.cjs (mkdir-based atomic locks, PID tracking, stale lock recovery)
- Cross-set bleed prevention: verify at assembly time that subagent prompt contains ONLY the set's contracts/definition/scoped CLAUDE.md -- log warning if other sets' artifacts are referenced
- Import dependencies resolved via contract stubs: before a dependent set executes, generate stubs from imported set's CONTRACT.json -- dependent sets code against contract interfaces, not actual implementations

### Claude's Discretion
- Internal execution engine architecture (library structure, function signatures)
- Error handling and retry logic for subagent failures
- Contract stub generation format and mechanism
- Assembly-time cross-set bleed detection implementation

</decisions>

<specifics>
## Specific Ideas

- The orchestrator should feel like a build system: launch parallel tasks, collect results, gate on success before next wave
- Per-wave batch prompting means the user gets asked about all Wave 1 sets, then all Wave 1 sets plan, then all Wave 1 sets execute -- clear phase boundaries
- Contract stubs let dependent sets develop against stable interfaces even while their dependencies are still being implemented in parallel (within the same wave for future cross-wave scenarios)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assembler.cjs`: assembleAgent() with context injection (project, contracts, style, contextFiles) -- use for subagent prompt assembly
- `worktree.cjs`: createWorktree(), generateScopedClaudeMd(), registryUpdate(), formatStatusTable() -- worktree lifecycle already complete
- `plan.cjs`: loadSet(), listSets(), checkPlanningGate(), updateGate() -- set and gate management ready
- `dag.cjs`: getExecutionOrder() -- returns wave-ordered parallel groups for spawning
- `returns.cjs`: structured return parsing (COMPLETE/CHECKPOINT/BLOCKED)
- `verify.cjs`: filesystem artifact verification
- `rapid-executor.md`: executor agent template with atomic commit instructions
- `rapid-orchestrator.md`: orchestrator agent template with spawn/gate/merge responsibilities

### Established Patterns
- Agent prompts assembled from composable modules (core + role + context) via assembleAgent()
- Structured returns with hybrid Markdown table + JSON payload (RAPID:RETURN marker)
- State access exclusively through rapid-tools.cjs CLI (never direct file edits)
- Worktree registry with lock-protected updates (registryUpdate with acquireLock)

### Integration Points
- Execution engine reads DAG.json for wave-based execution order
- Execution engine reads GATES.json to verify planning gates are open before launching execution
- Execution engine updates worktree REGISTRY.json phase/status as sets progress
- Execution engine calls createWorktree() for each set (if not already created by Phase 5 worktree orchestration)
- Execution engine uses generateScopedClaudeMd() to build per-set context

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 06-execution-core*
*Context gathered: 2026-03-04*
