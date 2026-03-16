# CONTEXT: solo-mode

**Set:** solo-mode
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
Add a solo development mode to RAPID that skips git worktree isolation. In solo mode, sets execute directly on the current branch (typically main) without creating worktrees or branches. This eliminates merge overhead for single-developer workflows while preserving the full discuss/plan/execute/review lifecycle. Scope includes: `--solo` flag on start-set, virtual registry entries, solo-aware merge (auto-transition), status indicators, and cleanup behavior.
</domain>

<decisions>
## Implementation Decisions

### Configuration & Activation
- Solo mode is a **per-set flag**, not project-wide config
- Activated via `--solo` flag on `/start-set` (e.g., `/rapid:start-set 6 --solo`)
- No changes to `/init` or config.json — solo is purely a start-set concern
- The solo flag is persisted in the REGISTRY.json entry (`solo: true`)

### Registry & Lifecycle
- Start-set in solo mode creates a **virtual registry entry**: `{ path: '.', branch: currentBranch, solo: true }`
- **No scoped CLAUDE.md generated** — the project-root CLAUDE.md is already present
- **No git worktree or branch created** — work happens directly on the current branch
- Execute, pause, resume commands resolve the registry entry normally via lookup (path resolves to cwd)
- Verify should diff against the commit hash recorded at set-start time (stored in registry entry)

### Merge & Review Behavior
- `/merge` on a solo set returns **success with auto-transition** — STATE.json transitions to 'merged', prints informational message ("solo set — no merge needed")
- No conflict detection, resolution cascade, or git merge operations run
- The merge skill **detects solo sets automatically** via the registry's `solo: true` flag — no `--solo` flag needed on merge
- `/review` still works on solo sets — it scopes changes since the set-start commit

### Status Display & UX
- Branch column shows **'main (solo)'** — no tag on set name
- Solo sets are **grouped normally** in DAG wave display by dependency order
- `/cleanup` on solo sets **auto-cleans** — just deregisters from REGISTRY.json (no worktree to remove, no branch to delete)
</decisions>

<specifics>
## Specific Ideas
- Record `startCommit` hash in registry entry at start-set time for solo sets — used by verify and review to scope changes
- The `isSoloMode()` helper reads the registry entry's `solo` flag, not config.json
- Merge skill's set-merger agent should early-return for solo sets before spawning any subagents
</specifics>

<code_context>
## Existing Code Insights

### Key Integration Points
- `src/commands/set-init.cjs` — `handleSetInit('create')` calls `wt.setInit()` which creates worktree + branch + registry entry. Solo path needs to skip `createWorktree()` and register virtual entry instead.
- `src/lib/worktree.cjs:setInit()` (line 316) — The core function that creates worktree, generates CLAUDE.md, and registers. Needs a solo code path.
- `src/commands/worktree.cjs:cleanup` — Resolves absolute worktree path and calls `removeWorktree()`. Solo path should skip removal and just deregister.
- `src/commands/merge.cjs:execute` — Calls `merge.mergeSet()` with base branch. Solo path should skip merge and auto-transition.
- `src/commands/execute.cjs:verify` — Looks up registry entry for worktree path. Virtual entry with `path: '.'` should resolve to cwd.
- `src/commands/execute.cjs:update-phase` — Creates registry entries if not present. Solo entries should preserve the `solo: true` flag.

### Patterns to Follow
- Registry entries use `registryUpdate()` for atomic writes with file locking
- State transitions use `node "${RAPID_TOOLS}" state transition set` CLI command
- Status table formatting in `wt.formatMarkIIStatus()` and `wt.formatStatusTable()`
- Branch detection via `wt.detectMainBranch()`
</code_context>

<deferred>
## Deferred Ideas
- Project-wide solo default in config.json (could add later if solo becomes the common case)
- Per-set `--team` override to force worktree isolation on a solo-default project
- Solo mode for existing worktree sets (converting team set to solo mid-lifecycle)
</deferred>
