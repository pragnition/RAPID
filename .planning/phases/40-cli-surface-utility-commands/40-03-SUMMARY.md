---
phase: 40-cli-surface-utility-commands
plan: 03
subsystem: skills
tags: [review, merge, state-machine, set-lifecycle, v3]

# Dependency graph
requires:
  - phase: 40-cli-surface-utility-commands
    plan: 01
    provides: "Renamed skill directories and v3.0 command structure"
  - phase: 38-state-machine-v3
    provides: "SetStatus enum with 6 states including complete and merged"
provides:
  - "v3 review orchestrator gating on 'complete' status"
  - "v3 merge orchestrator with auto-transition to 'merged'"
  - "Both skills use state get --all for set readiness (no wave-status)"
affects: [42-core-agents, 44-execution-skills, 45-docs-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns: ["set-level state gating via state get --all", "auto-transition to terminal 'merged' status after merge"]

key-files:
  created: []
  modified:
    - "skills/review/SKILL.md"
    - "skills/merge/SKILL.md"

key-decisions:
  - "Review gates on 'complete' (not 'executing') per v3 set lifecycle"
  - "Merge auto-transitions to 'merged' as terminal state after successful merge execute"
  - "Removed execute wave-status dependency; merge checks STATE.json directly"
  - "Preserved merge DAG wave ordering concept (independent of execution waves)"

patterns-established:
  - "Set readiness check pattern: state get --all -> parse status='complete'"
  - "Auto-transition pattern: state transition set after merge execute success"

requirements-completed: [CMD-06, CMD-07]

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 40 Plan 03: Review and Merge v3.0 State Updates Summary

**Review and merge skills updated to gate on 'complete' set status, auto-transition to 'merged', and use v3 command names throughout**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T08:01:01Z
- **Completed:** 2026-03-12T08:05:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Updated review skill to gate on 'complete' status instead of 'executing', with 'complete' -> 'reviewing' state transition
- Updated merge skill to check set readiness via STATE.json directly (removed execute wave-status dependency) and auto-transition sets to 'merged' after successful merge
- Both skills now use v3 command names (/rapid:execute-set, /rapid:new-version) in next-step suggestions

## Task Commits

Each task was committed atomically:

1. **Task 1: Update /review skill for v3.0 set-level state handling** - `eb93f18` (feat)
2. **Task 2: Update /merge skill for v3.0 set-level state handling** - `11a1546` (feat)

## Files Created/Modified
- `skills/review/SKILL.md` - Updated status gate ('complete' not 'executing'), transition flow, planning artifact language, removed lean review note, v3 command references
- `skills/merge/SKILL.md` - Replaced execute wave-status with state get --all, added auto-transition to 'merged' after merge, updated next-step to /rapid:new-version, added Important Notes entry

## Decisions Made
- Review gates on 'complete' per v3 set lifecycle -- Phase 44 will implement the execute -> complete transition (cross-phase dependency documented, not blocked)
- Merge auto-transitions to 'merged' as terminal lifecycle state using `state transition set` after `merge execute` returns `merged: true`
- Removed `execute wave-status` from merge readiness check; merge now reads STATE.json directly via `state get --all`
- Preserved merge pipeline's DAG wave ordering concept (this is merge ordering, not execution waves)
- Kept all review pipeline internals (unit test, bug hunt, UAT) and merge pipeline internals (fast-path, conflict detection, resolution cascade) unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Review and merge skills ready for Phase 42 (core agents) and Phase 44 (execution skills) integration
- Cross-phase dependency: Phase 44 must implement execute -> complete transition for review gating to work end-to-end
- CLI subcommand internals (review scope, merge order, etc.) deferred to Phase 45

---
*Phase: 40-cli-surface-utility-commands*
*Completed: 2026-03-12*
