---
phase: 31-wave-orchestration
plan: 03
subsystem: execution
tags: [auto-advance, wave-orchestration, retry-wave, reconciliation]

# Dependency graph
requires:
  - phase: 28-workflow-clarity
    provides: AskUserQuestion removal pattern for end-of-skill routing
provides:
  - Auto-advance behavior for PASS and PASS_WITH_WARNINGS wave reconciliation
  - --retry-wave flag for targeted wave retry with predecessor validation
affects: [execute, wave-orchestration]

# Tech tracking
tech-stack:
  added: []
  patterns: [auto-advance on reconciliation pass, targeted wave retry with predecessor validation]

key-files:
  created: []
  modified: [skills/execute/SKILL.md]

key-decisions:
  - "PASS and PASS_WITH_WARNINGS auto-advance without AskUserQuestion -- only FAIL retains user gate"
  - "--retry-wave validates all predecessor waves are complete before allowing targeted retry"
  - "After retrying target wave, execution continues with subsequent waves via normal auto-advance"

patterns-established:
  - "Auto-advance pattern: non-failure outcomes proceed without user approval gates"
  - "Predecessor validation: targeted retry requires all prior waves complete"

requirements-completed: [WAVE-04]

# Metrics
duration: 1min
completed: 2026-03-10
---

# Phase 31 Plan 03: Execute Auto-Advance Summary

**Auto-advance on PASS/PASS_WITH_WARNINGS reconciliation and --retry-wave flag for targeted wave retry with predecessor validation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-10T05:48:54Z
- **Completed:** 2026-03-10T05:50:04Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced Step 3i AskUserQuestion gates with auto-advance for PASS and PASS_WITH_WARNINGS outcomes
- Retained AskUserQuestion gate only for FAIL reconciliation (retry/cancel options)
- Added Step 0b.2 --retry-wave flag with predecessor wave validation and targeted retry
- Updated Important Notes section with auto-advance and --retry-wave documentation

## Task Commits

Each task was committed atomically:

1. **Task 1: Modify execute Step 3i for auto-advance and add --retry-wave flag** - `da86751` (feat)

## Files Created/Modified
- `skills/execute/SKILL.md` - Modified Step 3i for auto-advance, added Step 0b.2 --retry-wave, updated Important Notes

## Decisions Made
- PASS and PASS_WITH_WARNINGS auto-advance without AskUserQuestion -- reduces N-1 unnecessary approval prompts for a set with N waves
- --retry-wave validates all predecessor waves are complete before allowing targeted retry
- After retrying target wave, execution continues with subsequent waves via normal auto-advance behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Execute skill now supports auto-advance for PASS/PASS_WITH_WARNINGS reconciliation
- --retry-wave flag enables targeted retry of specific failed waves
- Ready for integration with other wave orchestration changes in Phase 31

## Self-Check: PASSED

- FOUND: skills/execute/SKILL.md
- FOUND: 31-03-SUMMARY.md
- FOUND: commit da86751

---
*Phase: 31-wave-orchestration*
*Completed: 2026-03-10*
