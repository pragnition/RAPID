# Phase 7: Execution Lifecycle - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Developers have full visibility into cross-set progress, can pause and resume work, and execution waves are gated by reconciliation. This phase adds lifecycle management on top of Phase 6's per-set execution core: a unified status dashboard (EXEC-04), session pause/resume (EXEC-05), sync gate enforcement (EXEC-07), and mandatory wave reconciliation (EXEC-08).

</domain>

<decisions>
## Implementation Decisions

### Status Dashboard
- Unified table layout — single table showing all sets with columns: set name, wave, lifecycle phase, progress, last activity
- 5-phase lifecycle tracking per set: Discuss, Plan, Execute, Verify, Merge
- ASCII progress bar within phases: `Execute [===----] 3/7` showing sub-task completion
- Wave summary header line above the table: `Wave 1: 3/3 complete | Wave 2: 1/2 executing | Wave 3: pending`
- Enhances existing `/rapid:status` skill (currently shows basic worktree table)

### Pause/Resume Flow
- Dual trigger: explicit `/rapid:pause {setName}` command AND automatic CHECKPOINT emission before context window limit
- Subagent should emit CHECKPOINT proactively before hitting context limit — not after being cut off mid-task
- Persist handoff file only: HANDOFF.md in the set's `.planning/` directory with CHECKPOINT data (done, remaining, resume instructions)
- No WIP commits or file snapshots needed — handoff file is sufficient
- Resume spawns a new subagent with full replay: original plan PLUS handoff content, re-reads all relevant files to rebuild understanding
- Warn after 3 pause/resume cycles on the same set — suggests the set may need replanning, but don't block

### Sync Gate Rules
- Artifact-based gate checks: verify existence of plan artifacts (`.planning/sets/{set}/PLAN.md` or equivalent) rather than relying on registry status alone
- Per-wave scope: only sets in the current wave need completed plans before that wave can execute. Later-wave sets can remain unplanned
- Override with interactive confirmation: list what's missing, require explicit acknowledgment to proceed despite incomplete planning
- Gate error message shows both blocked and ready sets: "Gate blocked: auth-core (no plan), api-routes (no plan). Ready: db-schema (planned). Run /rapid:plan to continue."

### Wave Reconciliation
- Compare artifacts + contracts: verify all planned artifacts exist and all interface contracts are satisfied
- Detailed report format: per-set sections with what was planned vs delivered, contract compliance details, specific gaps found
- Categorized blocking: contract violations are hard blocks (must fix before next wave), missing artifacts are soft blocks (can be overridden by developer)
- Auto with review: reconciliation runs automatically when last set in a wave completes, presents results, waits for developer acknowledgment before unlocking next wave
- Per-wave summary files: `.planning/waves/WAVE-{N}-SUMMARY.md`

### Claude's Discretion
- Exact progress bar ASCII design and character choices
- Dashboard column widths and alignment
- HANDOFF.md internal format and structure
- How "proactive CHECKPOINT before context limit" is implemented in the subagent prompt
- Specific wording of gate override confirmation prompts
- SUMMARY.md detailed section structure and formatting

</decisions>

<specifics>
## Specific Ideas

- Subagent should checkpoint "a bit before" hitting context limit — not wait until forced. Build headroom into the checkpoint trigger.
- Gate error messages should be actionable: show what's missing AND what's ready, so the developer knows exactly what to do next.
- Reconciliation categorization matters: contract violations are fundamentally different from missing artifacts. Different severity = different enforcement.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `returns.cjs`: CHECKPOINT status already has `handoff_done`, `handoff_remaining`, `handoff_resume` fields — directly supports pause/resume
- `dag.cjs`: `assignWaves()` and `getExecutionOrder()` provide wave grouping — supports dashboard wave summary
- `execute.cjs`: `verifySetExecution()` checks artifacts, commits, ownership — can feed into reconciliation
- `state.cjs`: `stateGet()`/`stateUpdate()` with atomic locking — supports concurrent dashboard reads
- `worktree.cjs`: Registry with phase tracking (`createWorktree`, `updatePhase`, `loadRegistry`) — foundation for dashboard

### Established Patterns
- CLI via `rapid-tools.cjs` subcommands: new commands follow existing pattern (e.g., `execute wave-status`, `worktree status`)
- Skills as `.md` files in `rapid/skills/` with YAML frontmatter: new skills (pause, reconcile) follow this pattern
- Structured returns via `<!-- RAPID:RETURN {...} -->` markers: CHECKPOINT return already exists
- State in `.planning/` directory: new files (HANDOFF.md, WAVE-N-SUMMARY.md) follow existing convention

### Integration Points
- `rapid/skills/status/SKILL.md`: Must be enhanced to show the unified dashboard (currently shows basic worktree table)
- `rapid/skills/execute/SKILL.md`: Must integrate sync gate checks, pause handling, and wave reconciliation
- `rapid/src/bin/rapid-tools.cjs`: New subcommands needed (gate check, reconcile, pause, resume)
- `.planning/waves/`: New directory for per-wave SUMMARY files

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-execution-lifecycle*
*Context gathered: 2026-03-04*
