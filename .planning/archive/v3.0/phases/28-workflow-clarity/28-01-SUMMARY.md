---
phase: 28-workflow-clarity
plan: 01
subsystem: cli, agents
tags: [resolver, workflow-order, job-granularity, build-agents]

# Dependency graph
requires:
  - phase: 26-numeric-shortcuts
    provides: resolveWave and resolveSet functions in resolve.cjs
  - phase: 27.1-skill-to-agent-overhaul
    provides: build-agents pipeline and core-identity.md module system
provides:
  - resolveWave with optional --set flag for single-call set+wave resolution
  - Canonical RAPID Workflow 7-step sequence in all 26 agents
  - "2-4 jobs per wave" granularity guidance in roadmapper and wave-planner roles
affects: [28-02-PLAN, wave-aware skills, resolve usage patterns]

# Tech tracking
tech-stack:
  added: []
  patterns: ["--set flag pattern for two-arg CLI resolution", "core-identity propagation for universal agent context"]

key-files:
  created: []
  modified:
    - src/lib/resolve.cjs
    - src/lib/resolve.test.cjs
    - src/bin/rapid-tools.cjs
    - src/modules/core/core-identity.md
    - src/modules/roles/role-roadmapper.md
    - src/modules/roles/role-wave-planner.md
    - agents/ (all 26 rebuilt)

key-decisions:
  - "resolveWave setId path uses resolveSet internally for consistent numeric/string resolution"
  - "Error messages include set name and available waves for discoverability"
  - "Workflow order section placed between Working Directory and structured return sections in core-identity"

patterns-established:
  - "--set flag pattern: CLI parses --set, passes to resolveWave as 4th param"
  - "Core-identity propagation: universal context added to core-identity.md, rebuilt into all agents"

requirements-completed: [FLOW-01, FLOW-02, FLOW-03]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 28 Plan 01: Workflow Clarity - Resolver and Agent Updates Summary

**resolveWave --set flag for single-call set+wave resolution, canonical 7-step workflow in all 26 agents, 2-4 jobs/wave granularity guidance**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T08:19:04Z
- **Completed:** 2026-03-09T08:22:11Z
- **Tasks:** 3
- **Files modified:** 32

## Accomplishments
- resolveWave accepts optional setId parameter (numeric or string) via --set flag for single-call two-arg resolution
- All 26 agents now contain canonical RAPID Workflow 7-step sequence (init through merge)
- Both role-roadmapper and role-wave-planner contain "2-4 jobs per wave" guidance, replacing old "1-3 files modified" scope metric

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD -- Add --set flag to resolveWave and CLI handler**
   - `9839572` (test) RED: 9 new failing tests for setId parameter
   - `7b05d88` (feat) GREEN: resolveWave setId implementation + CLI --set parsing
2. **Task 2: Add workflow order to core-identity.md and update job granularity** - `c400a2f` (feat)
3. **Task 3: Rebuild all 26 agents and verify propagation** - `6b6ff61` (chore)

## Files Created/Modified
- `src/lib/resolve.cjs` - Added optional 4th setId parameter to resolveWave with set-scoped wave lookup
- `src/lib/resolve.test.cjs` - Added 9 new tests in "resolveWave -- with setId parameter (FLOW-01)" block
- `src/bin/rapid-tools.cjs` - CLI handler parses --set flag and passes to resolveWave
- `src/modules/core/core-identity.md` - Added "RAPID Workflow" section with 7-step canonical sequence
- `src/modules/roles/role-roadmapper.md` - Replaced "1-3 files modified" with "2-4 jobs per wave" guidance
- `src/modules/roles/role-wave-planner.md` - Added "Job Count Guidance" section with 2-4 jobs target
- `agents/rapid-*.md` (26 files) - Rebuilt with workflow order and updated role guidance

## Decisions Made
- resolveWave setId path reuses resolveSet internally for consistent numeric/string resolution
- Error messages include set name and available waves list for discoverability
- Workflow order section placed after "Working Directory" in core-identity.md for logical flow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- resolveWave --set flag ready for Plan 02 to extend to all wave-aware skills
- All agents have workflow context for next-step suggestions (Plan 02 UX-04)
- Job granularity guidance active for all future roadmap and wave planning

## Self-Check: PASSED

All 7 key files verified present. All 4 task commits verified in git log.

---
*Phase: 28-workflow-clarity*
*Completed: 2026-03-09*
