---
phase: 19-set-lifecycle
plan: 02
subsystem: ui
tags: [ascii-table, status-dashboard, state-machine, cli]

# Dependency graph
requires:
  - phase: 16-state-schema
    provides: STATE.json schema with set > wave > job hierarchy
  - phase: 17-state-transitions
    provides: readState, findMilestone for reading hierarchy data
provides:
  - formatMarkIIStatus function for compact ASCII table rendering from STATE.json
  - deriveNextActions function for context-aware action suggestions
  - status-v2 CLI subcommand reading STATE.json + REGISTRY.json
  - Rewritten /status SKILL.md with Mark II hierarchy dashboard
affects: [20-wave-planning, 21-execution, 23-merge]

# Tech tracking
tech-stack:
  added: []
  patterns: [mark-ii-status-dashboard, compact-wave-progress-format]

key-files:
  created: []
  modified:
    - src/lib/worktree.cjs
    - src/lib/worktree.test.cjs
    - src/bin/rapid-tools.cjs
    - skills/status/SKILL.md

key-decisions:
  - "Wave progress uses compact format W1: 3/5 done per set row, not expanded per-job listing"
  - "Sets sorted by activity priority: executing > reviewing > merging > planning > pending > complete"
  - "SKILL.md falls back to legacy worktree status when STATE.json is missing"

patterns-established:
  - "Mark II status pattern: STATE.json for hierarchy, REGISTRY.json for worktree paths"
  - "Compact wave progress: WN: X/Y done or WN: X/Y pending per set"

requirements-completed: [SETL-04, UX-01]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 19 Plan 02: Status Dashboard Summary

**Mark II status dashboard with compact ASCII table reading STATE.json hierarchy, wave progress per set, and context-aware next actions via AskUserQuestion**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T16:06:46Z
- **Completed:** 2026-03-06T16:12:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- formatMarkIIStatus renders compact ASCII table with SET, STATUS, WAVES, WORKTREE, UPDATED columns
- deriveNextActions produces context-aware suggestions based on set status and worktree presence
- status-v2 CLI subcommand reads STATE.json via readState + REGISTRY.json for worktree paths
- /status SKILL.md fully rewritten with Mark II hierarchy dashboard and AskUserQuestion routing
- 14 new unit tests covering all formatMarkIIStatus and deriveNextActions behaviors

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests** - `8649416` (test)
2. **Task 1 (GREEN): Implement formatMarkIIStatus, deriveNextActions, status-v2 CLI** - `ecda18c` (feat)
3. **Task 2: Rewrite /status SKILL.md** - `ffc16c0` (feat)

_Note: TDD task had RED and GREEN commits._

## Files Created/Modified
- `src/lib/worktree.cjs` - Added formatMarkIIStatus, deriveNextActions, formatWaveProgress helper functions
- `src/lib/worktree.test.cjs` - Added 14 tests for Mark II status functions
- `src/bin/rapid-tools.cjs` - Added status-v2 subcommand in handleWorktree
- `skills/status/SKILL.md` - Complete rewrite for Mark II hierarchy dashboard

## Decisions Made
- Wave progress uses compact "W1: 3/5 done" format per set row, not expanded per-job listing
- Sets sorted by activity priority (executing first, complete last) for at-a-glance scanning
- Falls back to legacy v1.0 status when STATE.json is missing, with guidance to run /rapid:init

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Status dashboard ready for integration with other Phase 19 commands (/set-init, /pause, /resume, /cleanup)
- formatMarkIIStatus and deriveNextActions available for reuse in other skills

---
*Phase: 19-set-lifecycle*
*Completed: 2026-03-07*
