# Phase 9: Agent Teams Integration - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

RAPID detects EXPERIMENTAL_AGENT_TEAMS when available and offers agent teams execution mode for enhanced parallel execution, with graceful subagent fallback. The developer experience is identical regardless of execution mode -- same commands, same status output, same merge pipeline. This phase adds a second execution path alongside the existing subagent pipeline; it does not replace or modify the subagent path.

</domain>

<decisions>
## Implementation Decisions

### Detection & mode selection
- Detection uses both settings.json (to set the env var) AND runtime env var check
- Check happens once at `/rapid:execute` start -- mode is locked for the entire execution run
- When agent teams are detected, prompt the user via AskUserQuestion: "Agent teams available. Use teams or subagents?"
- Prompt is clean -- no explanation of detection source, just the choice
- If env var is not set or detection fails, silently use subagent mode (no prompt)

### Team-to-set mapping
- One team per wave -- create a team when a wave starts, teammates are the sets in that wave, team dissolves after wave completes
- Each teammate gets its own worktree, same as subagent mode -- reuse existing worktree.cjs infrastructure
- No inter-teammate messaging -- teammates work in isolation, contracts replace the need for communication
- Track teammate completion using agent teams' native TaskCompleted events

### Unified status output
- /rapid:status shows a mode indicator line: "Execution mode: Agent Teams" or "Execution mode: Subagents"
- wave-status and reconcile commands use the same logic in both modes -- read worktree registry, run contract tests, produce same output format
- Teams mode changes HOW sets execute, not how we verify or report
- Wave summaries (WAVE-{N}-SUMMARY.md) include which execution mode was used for that wave

### Fallback triggers
- Fallback occurs at both detection time AND mid-execution
- If team operation fails mid-execution (team spawn fails, teammate crashes), auto-retry the failed wave using subagent mode
- Print a visible warning when fallback happens: "Agent teams failed for wave N. Falling back to subagent execution."
- Generic fallback for any failure -- do not special-case bug #23506 or any specific error signature
- Mode prompt (AskUserQuestion) uses the standard Claude Code pattern with two options

### Claude's Discretion
- Internal architecture for the dual-mode abstraction layer
- How to structure the team creation/teardown lifecycle
- TaskCompleted hook implementation details
- Error detection and retry timing for mid-execution fallback

</decisions>

<specifics>
## Specific Ideas

- The AskUserQuestion prompt at execution start should be simple: two options, no explanation of internals
- Wave summaries should note mode for post-hoc debugging but the rest of the output format stays identical
- Auto-retry on team failure means the user shouldn't have to intervene for transient agent teams issues

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execute.cjs`: Full subagent execution pipeline (prepareSetContext, assembleExecutorPrompt, verifySetExecution, reconcileWave, generateWaveSummary) -- the teams path needs to produce the same inputs to these verification functions
- `worktree.cjs`: Worktree creation, scoped CLAUDE.md generation, registry management -- reuse for teammate worktree setup
- `rapid-tools.cjs`: CLI with execute subcommands (wave-status, reconcile, update-phase, pause, resume) -- teams mode must work with these existing commands
- `state.cjs`: State management for tracking execution progress
- `dag.cjs`: Wave/set dependency graph -- teams mode reads the same DAG

### Established Patterns
- Wave-based execution: DAG defines waves, sets within a wave execute in parallel, reconciliation between waves
- Subagent spawning via Claude Code's Task tool with isolation: worktree
- Structured returns from agents (returns.cjs) for post-execution verification
- Contract-based verification (contract.cjs, verify.cjs) runs against worktree state

### Integration Points
- `/rapid:execute` skill -- detection and mode prompt happen here before wave execution begins
- `execute wave-status` CLI command -- needs mode-aware reporting
- `execute reconcile` CLI command -- needs mode metadata in summary output
- `generateWaveSummary()` in execute.cjs -- add execution mode field

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 09-agent-teams-integration*
*Context gathered: 2026-03-05*
