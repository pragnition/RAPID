---
phase: 20-wave-planning
plan: 02
subsystem: planning
tags: [agent-roles, wave-planning, assembler, prompt-engineering]

# Dependency graph
requires:
  - phase: 18-init-pipeline
    provides: assembler.cjs with role module composition and frontmatter generation
provides:
  - role-wave-researcher.md agent role module for per-wave implementation research
  - role-wave-planner.md agent role module producing high-level WAVE-PLAN.md
  - role-job-planner.md agent role module producing detailed JOB-PLAN.md per job
  - assembler.cjs registrations for wave-researcher, wave-planner, job-planner roles
affects: [20-wave-planning, 21-job-execution]

# Tech tracking
tech-stack:
  added: []
  patterns: [three-stage-planning-pipeline, intra-wave-file-ownership, contract-compliance-mapping]

key-files:
  created:
    - src/modules/roles/role-wave-researcher.md
    - src/modules/roles/role-wave-planner.md
    - src/modules/roles/role-job-planner.md
  modified:
    - src/lib/assembler.cjs

key-decisions:
  - "Wave researcher gets WebFetch for Context7 MCP documentation lookups; planners get Write only"
  - "No Agent tool for any of the three roles -- they are leaf agents that do not spawn sub-agents"
  - "File ownership assignment is the Wave Planner's responsibility, not the Job Planner's"

patterns-established:
  - "Three-stage pipeline: WAVE-CONTEXT -> WAVE-RESEARCH -> WAVE-PLAN -> JOB-PLAN"
  - "Contract compliance section mandatory in every JOB-PLAN.md"
  - "Intra-wave file ownership prevents parallel job conflicts"

requirements-completed: [WAVE-03, WAVE-04, WAVE-05]

# Metrics
duration: 2min
completed: 2026-03-07
---

# Phase 20 Plan 02: Wave Planning Agent Roles Summary

**Three agent role modules (wave-researcher, wave-planner, job-planner) powering the research-then-plan pipeline with contract compliance mapping**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T17:58:52Z
- **Completed:** 2026-03-06T18:01:29Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created wave-researcher role module (105 lines) with Context7 MCP integration and WAVE-RESEARCH.md template
- Created wave-planner role module (116 lines) with WAVE-PLAN.md template, file ownership assignment, and contract coverage table
- Created job-planner role module (122 lines) with JOB-PLAN.md template, atomic commit steps, and mandatory contract compliance section
- Registered all three roles in assembler.cjs ROLE_TOOLS and ROLE_DESCRIPTIONS with appropriate tool permissions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave researcher, wave planner, and job planner role modules** - `ba556b0` (feat)
2. **Task 2: Register new roles in assembler ROLE_TOOLS and ROLE_DESCRIPTIONS** - `77ca643` (feat)

## Files Created/Modified
- `src/modules/roles/role-wave-researcher.md` - Focused per-wave research agent; reads WAVE-CONTEXT + CONTRACT + targeted files, produces WAVE-RESEARCH.md
- `src/modules/roles/role-wave-planner.md` - High-level wave planner; reads WAVE-RESEARCH + CONTEXT, produces WAVE-PLAN.md with per-job summaries and file ownership
- `src/modules/roles/role-job-planner.md` - Detailed job planner; reads WAVE-PLAN + RESEARCH, produces JOB-PLAN.md with atomic steps and contract compliance
- `src/lib/assembler.cjs` - Added ROLE_TOOLS and ROLE_DESCRIPTIONS entries for wave-researcher, wave-planner, job-planner

## Decisions Made
- Wave researcher gets WebFetch (for Context7 MCP) plus Read, Grep, Glob, Bash -- no Agent tool since it is a leaf agent
- Wave planner and job planner get Read, Write, Grep, Glob -- Write for producing their plan files, no Bash needed
- File ownership assignment handled at Wave Planner level in a dedicated "File Ownership" table, so Job Planner only modifies files assigned to it
- All three modules follow the established pattern from role-set-planner.md (# Role title, ## Responsibilities, ## Input, ## Output, ## Constraints)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures in assembler.test.cjs (hardcoded expectations of 6 roles when 15 already existed, and planner agent size warning at 20.6KB). These are not regressions -- they predate this plan. All functional tests (23/26) pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Three role modules ready for assembleAgent() consumption by the wave-plan skill (Plan 03)
- Input/output chain verified: researcher reads CONTEXT -> produces RESEARCH, wave-planner reads RESEARCH -> produces WAVE-PLAN, job-planner reads WAVE-PLAN -> produces JOB-PLAN
- All roles registered in assembler with correct tool permissions

## Self-Check: PASSED

All files verified present on disk. All commit hashes verified in git log.

---
*Phase: 20-wave-planning*
*Completed: 2026-03-07*
