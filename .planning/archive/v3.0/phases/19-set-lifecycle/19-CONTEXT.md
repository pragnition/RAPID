# Phase 19: Set Lifecycle - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Developers can create, monitor, pause, resume, and clean up isolated set worktrees with full state tracking. This phase delivers /set-init (worktree creation + scoped CLAUDE.md + set planner), /status rewrite (Mark II hierarchy dashboard), /pause rewrite (per-set handoff), /resume (new command for resumption), and /cleanup rewrite (auto-prompt after merge + branch deletion option). Detailed wave/job planning is Phase 20. Execution is Phase 21. Merge is Phase 23.

</domain>

<decisions>
## Implementation Decisions

### Set init workflow
- /set-init is a manual per-set command: dev runs `/set-init <set-name>` explicitly to claim and prepare a set
- /set-init does NOT transition the set to 'planning' -- set stays 'pending' until /discuss explicitly transitions it
- /set-init creates the git worktree, generates scoped CLAUDE.md, and runs the set planner
- Set planner produces a high-level SET-OVERVIEW.md (1-page: approach summary, key files, risks) -- detailed wave/job planning deferred to /discuss + /plan (Phase 20)

### Scoped CLAUDE.md
- Self-contained: this set's CONTRACT.json + project style guide + explicit "DO NOT TOUCH" deny list for other sets' files
- Replaces project CLAUDE.md entirely in the worktree -- no reference back to full project context
- Deny list derived from OWNERSHIP.json (carries forward Phase 5 decision)
- Generated during /set-init (carries forward Phase 5 timing decision -- before execution starts)

### Status dashboard
- Hierarchy depth: set rows + compact wave progress summary per set (e.g., "Wave 1: 3/5 jobs done"). Jobs not listed individually
- Format: ASCII table (docker ps / kubectl style) -- compact, scannable columns
- After displaying dashboard, present actionable next steps via AskUserQuestion based on current state (e.g., "Initialize set X", "Continue executing set Y", "Run /merge for set Z")
- Reads from STATE.json for all hierarchy data

### Pause & resume
- /pause is per-set only -- pauses the entire set, not individual waves
- Handoff file (HANDOFF.md) captures: current wave/job status snapshot, last completed action, user-provided notes
- /resume is a separate dedicated command (`/resume <set-name>`), not a subcommand of /execute
- Resume reads HANDOFF.md + STATE.json to restore context and pick up from last completed wave/job

### Cleanup behavior
- Auto-prompt after merge: after a successful /merge, automatically ask "Clean up worktree for set X?"
- /cleanup also available as standalone manual command
- After removing worktree directory, offer branch deletion via AskUserQuestion: "Also delete branch rapid/<set>?"
- Block cleanup if uncommitted changes exist -- show specific fix commands (git stash, git commit)
- Worktree directory removed, branch deletion is optional (user chooses per cleanup)

### Claude's Discretion
- SET-OVERVIEW.md template structure and level of detail
- Exact ASCII table column widths and formatting
- How /resume detects and loads the handoff file
- Internal state tracking for worktree registry updates
- Error messages and edge case handling (branch already exists, worktree conflicts)

</decisions>

<specifics>
## Specific Ideas

- Status table should feel like familiar CLI tools (docker ps, kubectl get pods) -- compact, scannable columns (from Phase 5)
- Deny list in scoped CLAUDE.md derived from OWNERSHIP.json (from Phase 5)
- Branch naming: `rapid/<set-name>` (from Phase 5)
- Set planner is lightweight -- just enough context for the dev to understand the set's scope before diving into wave planning

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `worktree.cjs`: createWorktree, removeWorktree, getStatus, getRegistry, detectMainBranch -- core worktree operations exist
- `state-machine.cjs`: readState, writeState, findSet, transitionSet -- full state management for sets
- `state-transitions.cjs`: Set transitions (pending > planning > executing > reviewing > merging > complete)
- `assembler.cjs`: assembleAgent() with context injection slots -- extends for scoped CLAUDE.md generation
- `contract.cjs`: createOwnershipMap() -- generates deny list data for scoped CLAUDE.md

### Established Patterns
- AskUserQuestion at every decision gate (v1.1 pattern)
- .env fallback loading in all skills
- Lock-protected atomic writes for STATE.json (Phase 16 pattern)
- Structured JSON CLI output parsed by skills
- CLI: rapid-tools.cjs with command/subcommand pattern

### Integration Points
- `skills/status/SKILL.md`: Complete rewrite for Mark II hierarchy (reads STATE.json instead of worktree registry)
- `skills/pause/SKILL.md`: Rewrite for per-set handoff with HANDOFF.md
- `skills/cleanup/SKILL.md`: Rewrite with auto-prompt after merge + branch deletion option
- New: `skills/set-init/SKILL.md` and `skills/resume/SKILL.md`
- `rapid-tools.cjs`: Needs set-init and resume CLI subcommands
- `worktree.cjs`: Extend with scoped CLAUDE.md generation and set planner orchestration
- New agent role: `role-set-planner.md` for SET-OVERVIEW.md generation

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 19-set-lifecycle*
*Context gathered: 2026-03-06*
