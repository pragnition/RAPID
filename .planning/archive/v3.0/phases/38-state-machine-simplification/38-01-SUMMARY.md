---
phase: 38-state-machine-simplification
plan: 01
subsystem: state
tags: [zod, state-machine, transitions, locking, pid-cleanup]

# Dependency graph
requires:
  - phase: none
    provides: "First plan in phase 38 -- no prior dependencies"
provides:
  - "Simplified SetStatus enum (pending/discussing/planning/executing/complete/merged)"
  - "Flat SetState schema { id, status } with no wave/job nesting"
  - "Set-only transition map with pending branch point"
  - "2-arg validateTransition(currentStatus, nextStatus)"
  - "PID-based stale lock cleanup via cleanStaleLocks()"
affects: [38-02-state-machine-rewrite, phase-40-cli, phase-43-planning, phase-44-execution]

# Tech tracking
tech-stack:
  added: []
  patterns: ["PID-based stale lock detection via process.kill(pid, 0)", "Branching transition map (pending -> discussing OR planning)"]

key-files:
  created: []
  modified:
    - src/lib/state-schemas.cjs
    - src/lib/state-schemas.test.cjs
    - src/lib/state-transitions.cjs
    - src/lib/state-transitions.test.cjs
    - src/lib/lock.cjs
    - src/lib/lock.test.cjs

key-decisions:
  - "SetStatus has exactly 6 values: pending, discussing, planning, executing, complete, merged"
  - "validateTransition signature changed from 3 args to 2 args (removed entityType)"
  - "isProcessAlive is an internal helper, not exported"
  - "cleanStaleLocks skips unparseable target files rather than removing them"

patterns-established:
  - "PID-based lock cleanup: process.kill(pid, 0) for existence check"
  - "Branching transitions: pending -> [discussing, planning] supports --skip flows"
  - "Set-only state: no nested waves/jobs arrays in SetState"

requirements-completed: [STATE-01, STATE-02, STATE-03, STATE-05]

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 38 Plan 01: Foundation Schemas Summary

**Simplified state schemas to set-level only with 6-value SetStatus enum, branching transitions, and PID-based stale lock cleanup**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T05:30:29Z
- **Completed:** 2026-03-12T05:34:05Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Rewrote state-schemas.cjs to export only 4 schemas (SetStatus, SetState, MilestoneState, ProjectState) -- removed JobStatus, JobState, WaveStatus, WaveState
- Rewrote state-transitions.cjs with set-only transitions including pending branch point (discussing OR planning) and 2-arg validateTransition
- Added PID-based stale lock cleanup to lock.cjs via cleanStaleLocks() function
- 74 total tests pass across all 3 test files with 0 failures

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Rewrite state-schemas.cjs and state-schemas.test.cjs**
   - `e8ed603` (test: failing tests for simplified schemas)
   - `4fb6487` (feat: rewrite state-schemas.cjs to set-level only)
2. **Task 2: Rewrite state-transitions.cjs and state-transitions.test.cjs**
   - `464f4d4` (test: failing tests for simplified transitions)
   - `2ae90b6` (feat: rewrite state-transitions.cjs with set-only transitions)
3. **Task 3: Simplify lock.cjs with PID-based stale cleanup**
   - `4725873` (test: failing tests for PID-based stale lock cleanup)
   - `a21f36a` (feat: add PID-based stale lock cleanup to lock.cjs)

## Files Created/Modified
- `src/lib/state-schemas.cjs` - Simplified Zod schemas: SetStatus (6 values), SetState (flat), MilestoneState, ProjectState
- `src/lib/state-schemas.test.cjs` - 25 tests covering all schemas + removed export verification
- `src/lib/state-transitions.cjs` - SET_TRANSITIONS map with pending branch point + 2-arg validateTransition
- `src/lib/state-transitions.test.cjs` - 28 tests covering valid/invalid transitions, full chain, skip chain, error handling
- `src/lib/lock.cjs` - Added isProcessAlive (internal) + cleanStaleLocks (exported)
- `src/lib/lock.test.cjs` - 21 tests including dead PID removal, alive PID preservation, edge cases

## Decisions Made
- SetStatus has exactly 6 values matching the design: pending, discussing, planning, executing, complete, merged
- validateTransition signature changed from (entityType, currentStatus, nextStatus) to (currentStatus, nextStatus) -- breaking change for callers
- isProcessAlive kept as internal helper (not exported) -- only cleanStaleLocks is public API
- Unparseable target files are skipped (not removed) by cleanStaleLocks for safety

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All foundation modules ready for Plan 02 (state-machine.cjs rewrite)
- state-machine.cjs can now import from simplified state-schemas.cjs and state-transitions.cjs
- cleanStaleLocks available for state-machine.cjs to call at startup
- Callers referencing removed exports (WAVE_TRANSITIONS, JOB_TRANSITIONS, etc.) will get TypeError at runtime -- expected for dead code paths being rewritten in phases 40-44

## Self-Check: PASSED

All 7 files verified present. All 6 task commits verified in git log.

---
*Phase: 38-state-machine-simplification*
*Completed: 2026-03-12*
