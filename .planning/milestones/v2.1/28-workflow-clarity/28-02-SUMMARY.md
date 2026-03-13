---
phase: 28-workflow-clarity
plan: 02
subsystem: skills
tags: [next-step-ux, ask-user-question, resolve-wave, set-flag, workflow-routing]

# Dependency graph
requires:
  - phase: 28-workflow-clarity
    provides: resolveWave --set flag for single-call two-arg resolution (plan 01)
  - phase: 26-numeric-shortcuts
    provides: resolveWave and resolveSet functions in resolve.cjs
provides:
  - Print-only next-step blocks at end of all 7 stage skills
  - Branching next-step options in review and merge skills
  - --set flag integration in discuss, wave-plan, and review skills
affects: [user-workflow-experience, skill-output-format]

# Tech tracking
tech-stack:
  added: []
  patterns: ["print-only next-step block at skill end", "branching next-step block for multi-option skills", "resolve wave --set for two-arg invocation in skills"]

key-files:
  created: []
  modified:
    - skills/init/SKILL.md
    - skills/set-init/SKILL.md
    - skills/discuss/SKILL.md
    - skills/wave-plan/SKILL.md
    - skills/execute/SKILL.md
    - skills/review/SKILL.md
    - skills/merge/SKILL.md

key-decisions:
  - "Mid-flow AskUserQuestion blocks preserved in all skills -- only end-of-skill routing removed"
  - "AskUserQuestion kept in allowed-tools for all skills that retain mid-flow decision points"
  - "Linear skills show exactly one next command; branching skills show 2-3 alternatives"

patterns-established:
  - "Next-step format: > **Next step:** `/rapid:{command} {numericArgs}` with description on next line"
  - "Branching format: > **Next steps:** with bulleted list of alternatives"

requirements-completed: [UX-04, FLOW-01]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 28 Plan 02: Next-Step Blocks and --set Flag Integration Summary

**Print-only next-step blocks replacing AskUserQuestion routing in all 7 stage skills, with resolve wave --set integration in 3 wave-aware skills**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T08:24:56Z
- **Completed:** 2026-03-09T08:28:37Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Replaced end-of-skill AskUserQuestion routing blocks with print-only next-step suggestions in all 7 stage skills
- Linear skills (init, set-init, discuss, wave-plan, execute) show exactly one pasteable next command with numeric args
- Branching skills (review, merge) show 2-3 alternative next commands
- Integrated `resolve wave --set` flag for single-call two-arg resolution in discuss, wave-plan, and review

## Task Commits

Each task was committed atomically:

1. **Task 1: Update linear stage skills -- init, set-init, discuss, wave-plan, execute** - `a2f3d6c` (feat)
2. **Task 2: Update branching stage skills -- review, merge** - `ab18f87` (feat)

## Files Created/Modified
- `skills/init/SKILL.md` - Dynamic next-step block pointing to /rapid:set-init 1
- `skills/set-init/SKILL.md` - Next-step pointing to /rapid:discuss {setIndex}.1
- `skills/discuss/SKILL.md` - Next-step pointing to /rapid:wave-plan, --set flag for two-arg resolution
- `skills/wave-plan/SKILL.md` - Next-step pointing to /rapid:execute, --set flag for two-arg resolution
- `skills/execute/SKILL.md` - Next-step pointing to /rapid:review {setIndex}
- `skills/review/SKILL.md` - Branching next-steps (merge/review/fix-issues), --set flag for two-arg resolution
- `skills/merge/SKILL.md` - Branching next-steps (cleanup/status/new-milestone)

## Decisions Made
- Mid-flow AskUserQuestion blocks preserved in all skills -- only end-of-skill routing removed
- AskUserQuestion kept in allowed-tools frontmatter for all skills since all retain mid-flow decision points
- Linear skills show exactly one next command; branching skills (review, merge) show 2-3 alternatives

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 7 stage skills now have consistent next-step UX
- Workflow feels faster and more deterministic -- users see pasteable commands instead of interactive prompts
- Phase 28 complete -- all 4 requirements (FLOW-01, FLOW-02, FLOW-03, UX-04) addressed across plans 01 and 02

## Self-Check: PASSED

All 7 modified skill files verified present. Both task commits verified in git log.

---
*Phase: 28-workflow-clarity*
*Completed: 2026-03-09*
