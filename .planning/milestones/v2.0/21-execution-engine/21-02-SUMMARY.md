---
phase: 21-execution-engine
plan: 02
subsystem: cli
tags: [rapid-tools, cli, job-execution, state-machine, wave-reconciliation]

# Dependency graph
requires:
  - phase: 16-state-machine
    provides: state-machine.cjs with transitionJob, transitionWave, findSet, commitState
  - phase: 19-set-lifecycle
    provides: execute.cjs with reconcileWave, worktree registry
provides:
  - "CLI subcommand: execute reconcile-jobs for job-level wave reconciliation"
  - "CLI subcommand: execute job-status for reading per-wave/per-job statuses"
  - "CLI subcommand: execute commit-state for committing STATE.json"
  - "CLI subcommand: wave-plan list-jobs for listing JOB-PLAN.md files"
affects: [21-execution-engine, execute-skill]

# Tech tracking
tech-stack:
  added: []
  patterns: [cli-subcommand-with-output-json, graceful-guard-for-unimplemented-library-functions]

key-files:
  created: []
  modified:
    - src/bin/rapid-tools.cjs
    - src/bin/rapid-tools.test.cjs

key-decisions:
  - "Guard reconcileWaveJobs call with typeof check since plan 01 library functions may not exist yet"
  - "Use output() for new subcommands consistent with other recently-added subcommands (detect-mode, merge)"

patterns-established:
  - "CLI guard pattern: check for library function existence before calling (graceful degradation for dependency ordering)"

requirements-completed: [EXEC-03, EXEC-04]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 21 Plan 02: Job Execution CLI Subcommands Summary

**Four CLI subcommands added to rapid-tools.cjs for job-level execution management: reconcile-jobs, job-status, commit-state, and list-jobs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T10:17:24Z
- **Completed:** 2026-03-07T10:20:49Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `execute reconcile-jobs <set> <wave>` for job-level wave reconciliation with summary generation
- Added `execute job-status <set>` for reading per-wave/per-job statuses from STATE.json
- Added `execute commit-state [message]` for committing STATE.json with a given message
- Added `wave-plan list-jobs <set> <wave>` for listing JOB-PLAN.md files in a wave directory
- Updated USAGE help string with all new subcommand documentation
- Added 6 unit tests covering all new subcommands including edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Add job execution CLI subcommands** - `8c68864` (feat)

## Files Created/Modified
- `src/bin/rapid-tools.cjs` - Added four new CLI subcommands (reconcile-jobs, job-status, commit-state, list-jobs) and updated USAGE/default error messages
- `src/bin/rapid-tools.test.cjs` - Added unit tests for all new subcommands including list-jobs with file discovery

## Decisions Made
- Added typeof guard for `reconcileWaveJobs` since plan 01 (execution engine library) may not be implemented yet -- CLI will show a clear error message instead of crashing
- Used `output()` function for JSON output consistent with other recently-added subcommands (detect-mode, merge commands)
- Confirmed existing `state transition job` subcommand already handles job entity type at line 324 -- no modifications needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added typeof guard for reconcileWaveJobs**
- **Found during:** Task 1
- **Issue:** Plan 01 (execution engine library) hasn't been implemented yet, so `execute.reconcileWaveJobs` doesn't exist
- **Fix:** Added `typeof execute.reconcileWaveJobs !== 'function'` guard with clear error message
- **Files modified:** src/bin/rapid-tools.cjs
- **Verification:** Subcommand shows helpful error when library function unavailable
- **Committed in:** 8c68864

---

**Total deviations:** 1 auto-fixed (1 bug prevention)
**Impact on plan:** Essential for robustness when plans execute out of dependency order. No scope creep.

## Issues Encountered
- Pre-existing test failure in `worktree status outputs human-readable table` -- unrelated to changes, not addressed

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CLI subcommands ready for execute skill (plan 03) to call
- reconcile-jobs subcommand will become fully functional once plan 01 adds reconcileWaveJobs to execute.cjs
- All existing CLI subcommands continue working without modification

## Self-Check: PASSED

- [x] src/bin/rapid-tools.cjs exists
- [x] src/bin/rapid-tools.test.cjs exists
- [x] 21-02-SUMMARY.md exists
- [x] Commit 8c68864 exists in git log

---
*Phase: 21-execution-engine*
*Completed: 2026-03-07*
