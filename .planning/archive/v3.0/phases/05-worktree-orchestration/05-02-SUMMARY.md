---
phase: 05-worktree-orchestration
plan: 02
subsystem: infra
tags: [worktree-status, scoped-claude-md, ascii-table, skills, ownership]

# Dependency graph
requires:
  - phase: 05-worktree-orchestration
    provides: worktree.cjs (loadRegistry, reconcileRegistry, listWorktrees for status display)
  - phase: 04-set-management
    provides: plan.cjs (loadSet), OWNERSHIP.json, DAG.json
provides:
  - formatStatusTable, formatWaveSummary, generateScopedClaudeMd functions in worktree.cjs
  - CLI worktree status and generate-claude-md subcommands
  - /rapid:status and /rapid:cleanup skills
affects: [06-execution-engine, 07-merge-resolution]

# Tech tracking
tech-stack:
  added: []
  patterns: [ASCII table formatting with auto-width columns, OWNERSHIP.json-derived deny list for agent scoping, per-wave progress aggregation from registry + DAG]

key-files:
  created:
    - rapid/skills/status/SKILL.md
    - rapid/skills/cleanup/SKILL.md
  modified:
    - rapid/src/lib/worktree.cjs
    - rapid/src/lib/worktree.test.cjs
    - rapid/src/bin/rapid-tools.cjs
    - rapid/src/bin/rapid-tools.test.cjs

key-decisions:
  - "formatStatusTable uses docker-ps-style ASCII table with auto-calculated column widths"
  - "formatWaveSummary aggregates Done/Executing/Error counts per wave from registry"
  - "generateScopedClaudeMd builds deny list by filtering OWNERSHIP.json for files NOT owned by target set"
  - "Deny list grouped by owning set for clarity in scoped CLAUDE.md"
  - "Skills follow established SKILL.md pattern with frontmatter, step-by-step bash commands"
  - "Cleanup skill preserves branches by default, only removes worktree directory"

patterns-established:
  - "Pattern: ASCII table formatting with auto-width columns via padEnd alignment"
  - "Pattern: OWNERSHIP.json deny-list derivation for agent scoping"
  - "Pattern: Graceful degradation when OWNERSHIP.json or STYLE_GUIDE.md missing"

requirements-completed: [WORK-02, WORK-04]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 05 Plan 02: Status Display, Scoped CLAUDE.md, and Skills Summary

**ASCII status table, per-wave progress summary, OWNERSHIP.json-derived scoped CLAUDE.md with deny list, and two user-facing skills (/rapid:status, /rapid:cleanup)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T09:53:53Z
- **Completed:** 2026-03-04T09:58:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- formatStatusTable renders docker-ps-style ASCII table with auto-width columns (SET, BRANCH, PHASE, STATUS, PATH)
- formatWaveSummary aggregates per-wave Done/Executing/Error counts from registry against DAG wave assignments
- generateScopedClaudeMd assembles self-contained Markdown from set contracts, OWNERSHIP.json-derived file lists, and optional style guide
- Scoped CLAUDE.md deny list correctly excludes all files owned by other sets, grouped by owning set
- CLI worktree status subcommand with human-readable and --json output modes
- CLI worktree generate-claude-md subcommand writes scoped CLAUDE.md to worktree root
- /rapid:status skill surfaces worktree dashboard via CLI
- /rapid:cleanup skill provides safe worktree removal with confirmation flow and dirty-check handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Status formatting and scoped CLAUDE.md generation (TDD)**
   - `1ce8984` (test) - RED: failing tests for formatStatusTable, formatWaveSummary, generateScopedClaudeMd
   - `a47d9e4` (feat) - GREEN: implementation + CLI subcommands (35 lib + 26 CLI tests passing)

2. **Task 2: /rapid:status and /rapid:cleanup skills**
   - `27de565` (feat) - Both skills with frontmatter, step-by-step instructions, bash commands

_Note: TDD task produced RED+GREEN commits; no separate refactor needed._

## Files Created/Modified
- `rapid/src/lib/worktree.cjs` - Extended with formatStatusTable, formatWaveSummary, generateScopedClaudeMd (3 new exports, 12 total)
- `rapid/src/lib/worktree.test.cjs` - Added 16 new tests for formatting and scoped CLAUDE.md (35 total)
- `rapid/src/bin/rapid-tools.cjs` - Added worktree status and generate-claude-md CLI subcommands
- `rapid/src/bin/rapid-tools.test.cjs` - Added 4 new CLI tests (26 total)
- `rapid/skills/status/SKILL.md` - /rapid:status skill with wave summary and table display
- `rapid/skills/cleanup/SKILL.md` - /rapid:cleanup skill with confirmation flow and branch retention

## Decisions Made
- ASCII table uses padEnd alignment with 2-space column separator -- same approach as docker ps and kubectl get
- Wave summary aggregates counts by matching registry set names against DAG wave membership
- Deny list built by inverting OWNERSHIP.json: all entries where owner !== target set, grouped by owning set
- generateScopedClaudeMd gracefully degrades when OWNERSHIP.json or STYLE_GUIDE.md are missing
- Cleanup skill preserves branches by default (branch deletion is a separate user-initiated operation)
- Skills use established frontmatter pattern (description, allowed-tools) with step-by-step bash commands

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Status display and scoped CLAUDE.md generation ready for execution engine (Phase 06)
- /rapid:status skill enables developers to monitor worktree state during parallel execution
- /rapid:cleanup skill enables safe teardown after set completion
- Phase 05 (Worktree Orchestration) is now complete -- both plans delivered

## Self-Check: PASSED

All 7 files verified present. All 3 task commits verified in git log.

---
*Phase: 05-worktree-orchestration*
*Completed: 2026-03-04*
