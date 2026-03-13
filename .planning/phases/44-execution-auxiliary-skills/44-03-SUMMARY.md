---
phase: 44-execution-auxiliary-skills
plan: 03
subsystem: skills
tags: [new-version, research-pipeline, roadmapper, milestone, archive]

# Dependency graph
requires:
  - phase: 43-planning-discussion-skills
    provides: v3 skill pattern (env preamble, banner, breadcrumbs, next step)
  - phase: 41-agent-build
    provides: 6-researcher pipeline (rapid-research-ux added as 6th)
provides:
  - v3 new-version SKILL.md with 6-researcher pipeline and archive option
  - Sets-only roadmapper instructions matching /init
affects: [45-docs-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns: [6-researcher-pipeline, sets-only-roadmap, optional-archive]

key-files:
  created: []
  modified:
    - skills/new-version/SKILL.md

key-decisions:
  - "6-researcher pipeline matching /init exactly (stack, features, architecture, pitfalls, oversights, ux)"
  - "Archive option offered as AskUserQuestion with Archive/Keep choices (not forced)"
  - "Roadmapper receives CRITICAL sets-only instruction matching /init pattern"

patterns-established:
  - "Milestone lifecycle: state read > user input > carry-forward > create > archive option > research > synthesis > roadmap > approve > completion"
  - "Archive structure: .planning/archive/{milestone}/sets/ + research/ + quick/"

requirements-completed: [CMD-11]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 44 Plan 03: New-Version Skill Rewrite Summary

**v3 new-version SKILL.md with 6-researcher pipeline (including UX), sets-only roadmapper, and optional artifact archiving**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T04:00:18Z
- **Completed:** 2026-03-13T04:02:59Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Rewrote new-version/SKILL.md from 236 lines (v2) to 307 lines (v3)
- Added 6th researcher (rapid-research-ux) to match /init pipeline exactly
- Updated roadmapper instructions to output sets only (no waves/jobs)
- Added Step 4.5 for optional milestone artifact archiving
- Added v3 skill patterns: env preamble, stage banner, error breadcrumbs, progress breadcrumbs
- Removed `disable-model-invocation: true` from frontmatter (skill spawns agents)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite new-version SKILL.md for v3** - `d263029` (feat)

## Files Created/Modified
- `skills/new-version/SKILL.md` - Complete v3 rewrite with 6-researcher pipeline, sets-only roadmap, archive option

## Decisions Made
- 6-researcher pipeline matching /init exactly -- added rapid-research-ux as 6th researcher
- Archive option uses AskUserQuestion with Archive/Keep choices -- not forced
- Roadmapper receives same CRITICAL sets-only instruction as /init
- Archive structure places artifacts under `.planning/archive/{milestone}/` with sets/, research/, quick/ subdirectories
- Do NOT archive STATE.json, config.json, or PROJECT.md (global/accumulating files)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- new-version/SKILL.md is complete and ready for use
- All Phase 44 plans (01, 02, 03) are now complete
- Phase 45 (docs/cleanup) can proceed

---
*Phase: 44-execution-auxiliary-skills*
*Completed: 2026-03-13*
