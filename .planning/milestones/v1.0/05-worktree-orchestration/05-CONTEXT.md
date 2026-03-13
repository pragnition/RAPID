# Phase 5: Worktree Orchestration - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Each set gets its own physically isolated git worktree with scoped context, and worktree lifecycle is fully managed. This covers worktree creation, status tracking, cleanup, and per-worktree CLAUDE.md generation. Execution of sets within worktrees is Phase 6. Cross-set status dashboards and pause/resume are Phase 7. Merge pipeline is Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Branch & Location Strategy
- Branch naming convention: `rapid/<set-name>` (e.g., `rapid/auth-core`, `rapid/ui-shell`)
- Worktree location: git default worktree management (`.git/worktrees/` metadata, checkout directory specified by RAPID)
- Base branch: always current HEAD of main/master — all worktrees start from the same baseline
- Creation timing: lazy — worktree created on demand when a specific set starts executing, not all at once

### Status Display
- Format: ASCII table with columns: Set | Branch | Phase | Status | Path (similar to `docker ps` or `kubectl get pods`)
- Lifecycle phases: simple 4-state model — Created / Executing / Done / Error
- Scope: active worktrees only (no history of completed/cleaned worktrees)
- Wave summary: yes — wave-level progress summary line above the worktree table (e.g., "Wave 1: 2/3 sets executing")

### Cleanup Policy
- Trigger: prompt user for confirmation immediately after successful merge
- Branch retention: keep branches by default — a separate `/rapid:cleanup` command (with an agent) handles branch deletion when developer is ready
- Safety checks: block cleanup if worktree has uncommitted changes
- Error worktrees: same flow as successful ones — prompt and clean on user confirmation

### Scoped CLAUDE.md Content
- Contents: set's CONTRACT.json + project style guide + owned file list
- Relationship to project CLAUDE.md: replaces entirely — worktree CLAUDE.md is self-contained with only set-specific content
- Boundary enforcement: includes explicit "DO NOT TOUCH" deny list for files owned by other sets
- Generation timing: just before execution starts (not at worktree creation) — ensures latest contracts and style guide are used

### Claude's Discretion
- Exact checkout directory path structure for worktrees
- Internal state tracking format (JSON in .planning/ for worktree registry)
- Error messages and edge case handling (e.g., branch already exists, worktree already exists)
- How the wave summary line formats progress counts

</decisions>

<specifics>
## Specific Ideas

- `/rapid:cleanup` should be an agent-backed command that handles branch cleanup intelligently (not just a raw `git branch -D`)
- Status table should feel like familiar CLI tools (docker, kubectl) — compact, scannable columns
- The deny list in scoped CLAUDE.md should be derived from OWNERSHIP.json (already exists from Phase 4's `createOwnershipMap`)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lock.cjs` — atomic locking with stale detection via proper-lockfile — use for concurrent worktree operations
- `assembler.cjs` — `assembleAgent()` with context injection slots (`context.project`, `context.contracts`, `context.style`, `context.contextFiles`) — extends naturally for scoped CLAUDE.md generation
- `plan.cjs` — `loadSet()`, `listSets()`, `checkPlanningGate()` — provides set data needed for worktree-to-set mapping
- `contract.cjs` — `createOwnershipMap()` — generates the file ownership data used for deny lists
- `core.cjs` — `findProjectRoot()`, `output()`, `error()`, `loadConfig()` — standard patterns for new CLI subcommands
- `state.cjs` — `stateGet()`/`stateUpdate()` with locking — for tracking worktree state in STATE.md

### Established Patterns
- CLI: `rapid-tools.cjs` with command/subcommand pattern, JSON stdout for machine output, `[RAPID]` prefix for human messages
- All CJS (`'use strict'`), CommonJS require/module.exports
- Colocated tests: `*.test.cjs` next to source files
- State in `.planning/` as JSON (machine) + Markdown (human), committed to git
- Lock-based concurrency in `.planning/.locks/`

### Integration Points
- `rapid-tools.cjs` — needs `worktree` subcommand (create, status, cleanup, list)
- `.planning/sets/` — worktree registry maps sets to worktree paths and branches
- `.planning/sets/OWNERSHIP.json` — source for deny lists in scoped CLAUDE.md
- `.planning/sets/DAG.json` — wave assignments for status summary
- `.planning/sets/GATES.json` — gate status for determining when worktrees can be created
- `config.json` — may need worktree configuration options

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-worktree-orchestration*
*Context gathered: 2026-03-04*
