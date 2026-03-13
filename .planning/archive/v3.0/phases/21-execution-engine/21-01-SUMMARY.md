---
phase: 21-execution-engine
plan: 01
subsystem: execution
tags: [reconciliation, progress-banner, handoff, job-executor, teams, assembler]

# Dependency graph
requires:
  - phase: 20-wave-planning
    provides: JOB-PLAN.md artifacts, wave planning pipeline, file ownership tables
provides:
  - Job-level reconciliation (reconcileJob, reconcileWaveJobs) in execute.cjs
  - Progress banner generation (formatProgressBanner) in execute.cjs
  - Job-level handoff (generateJobHandoff, parseJobHandoff) in execute.cjs
  - Job-level teammate config (buildJobTeammateConfig, waveJobTeamMeta) in teams.cjs
  - Job executor role module (role-job-executor.md)
  - Assembler registration for job-executor role
affects: [21-execution-engine, execute-skill, job-dispatch]

# Tech tracking
tech-stack:
  added: []
  patterns: [job-level-reconciliation, progress-banner-blocks, job-handoff-frontmatter]

key-files:
  created:
    - src/modules/roles/role-job-executor.md
  modified:
    - src/lib/execute.cjs
    - src/lib/execute.test.cjs
    - src/lib/teams.cjs
    - src/lib/teams.test.cjs
    - src/lib/assembler.cjs

key-decisions:
  - "Job-level reconciliation checks file existence and commit format per JOB-PLAN.md, not DEFINITION.md"
  - "Missing files and commit violations are soft blocks (not hard blocks); hard blocks reserved for future test-based checks"
  - "Job handoff stored at .planning/waves/{setId}/{waveId}/{jobId}-HANDOFF.md with wave/job context in frontmatter"
  - "buildJobTeammateConfig assembles inline prompt (not via assembleExecutorPrompt) with job plan content, file ownership, and commit convention"

patterns-established:
  - "parseJobPlanFiles: extract Files to Create/Modify table from JOB-PLAN.md Markdown"
  - "Job-level handoff extends set-level handoff with wave_id and job_id frontmatter fields"
  - "Progress banner format: --- RAPID Execute --- header, wave line, indented job status lines, timestamp, footer"

requirements-completed: [EXEC-02, EXEC-03, UX-02]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 21 Plan 01: Execution Engine Library Extensions Summary

**Job-level reconciliation, progress banners, handoff, teammate config, and executor role for Mark II execution engine**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T10:16:42Z
- **Completed:** 2026-03-07T10:21:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extended execute.cjs with 5 new functions: reconcileJob, reconcileWaveJobs, formatProgressBanner, generateJobHandoff, parseJobHandoff
- Extended teams.cjs with 2 new functions: buildJobTeammateConfig, waveJobTeamMeta
- Created role-job-executor.md (75 lines) with job-level execution instructions, commit convention, and RAPID:RETURN protocol
- Registered job-executor role in assembler.cjs ROLE_TOOLS and ROLE_DESCRIPTIONS
- All 72 tests pass (48 execute.test.cjs + 24 teams.test.cjs) including 19 new tests

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: Job-level reconciliation, progress banners, and job-level handoff in execute.cjs**
   - `dbaed53` (test) - Failing tests for reconcileJob, reconcileWaveJobs, formatProgressBanner, generateJobHandoff, parseJobHandoff
   - `28e528f` (feat) - Implementation of all 5 functions plus parseJobPlanFiles helper

2. **Task 2: Job-level teammate config, role-job-executor.md, and assembler registration**
   - `28ec6f2` (test) - Failing tests for buildJobTeammateConfig, waveJobTeamMeta, assembler registration
   - `5816c2a` (feat) - Implementation in teams.cjs, new role-job-executor.md, assembler registration

## Files Created/Modified
- `src/lib/execute.cjs` - Added reconcileJob, reconcileWaveJobs, formatProgressBanner, generateJobHandoff, parseJobHandoff, parseJobPlanFiles
- `src/lib/execute.test.cjs` - 19 new tests for job-level reconciliation, banner, and handoff functions
- `src/lib/teams.cjs` - Added buildJobTeammateConfig, waveJobTeamMeta
- `src/lib/teams.test.cjs` - 8 new tests for job teammate config and assembler registration
- `src/lib/assembler.cjs` - Added job-executor to ROLE_TOOLS and ROLE_DESCRIPTIONS
- `src/modules/roles/role-job-executor.md` - New 75-line job executor role module

## Decisions Made
- Job-level reconciliation checks file existence and commit format per JOB-PLAN.md (not DEFINITION.md like set-level)
- Missing files and commit violations are soft blocks; hard blocks reserved for future test-based checks
- Job handoff uses `.planning/waves/{setId}/{waveId}/{jobId}-HANDOFF.md` path with wave_id/job_id in frontmatter
- buildJobTeammateConfig assembles inline prompt directly (not via set-level assembleExecutorPrompt)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- execute.cjs exports all job-level reconciliation and handoff functions ready for the execute SKILL.md (plan 03)
- teams.cjs exports job-level teammate config ready for agent teams support
- role-job-executor.md is registered and discoverable via assembler.listModules()
- All library building blocks are in place for the execute skill rewrite

## Self-Check: PASSED

All files found, all commits verified, all exports accessible.

---
*Phase: 21-execution-engine*
*Completed: 2026-03-07*
