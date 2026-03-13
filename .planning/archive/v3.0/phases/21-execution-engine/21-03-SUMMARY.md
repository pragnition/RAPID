---
phase: 21-execution-engine
plan: 03
subsystem: skill
tags: [execute-skill, job-dispatch, subagent, agent-teams, wave-orchestration, progress-tracking, smart-re-entry]

# Dependency graph
requires:
  - phase: 21-execution-engine (plan 01)
    provides: reconcileWaveJobs, formatProgressBanner, generateJobHandoff, buildJobTeammateConfig library functions
  - phase: 21-execution-engine (plan 02)
    provides: CLI subcommands reconcile-jobs, job-status, commit-state, list-jobs
  - phase: 20-wave-planning
    provides: JOB-PLAN.md files as input for job executor prompts
  - phase: 16-state-machine
    provides: STATE.json with hierarchical state and validated transitions
provides:
  - "Mark II execute SKILL.md -- job-level dispatch orchestrator with parallel subagent/agent-teams execution"
  - "Smart re-entry from STATE.json (skip complete, retry failed, re-execute stale)"
  - "Wave-sequential execution with per-wave reconciliation and user decision gates"
  - "Dual-mode execution (subagents vs agent teams) with generic fallback"
affects: [22-review-module, 23-merge-pipeline, execute-skill]

# Tech tracking
tech-stack:
  added: []
  patterns: [job-level-dispatch-orchestrator, parallel-subagent-spawning, smart-re-entry-pattern, wave-sequential-with-parallel-jobs]

key-files:
  created: []
  modified:
    - skills/execute/SKILL.md

key-decisions:
  - "Execute skill is dispatch-only -- discuss and plan steps are NOT included, precondition check prompts user to run them if missing"
  - "Dual-mode execution locked at Step 1 for entire run -- no re-detection mid-execution"
  - "Generic teams fallback: any agent teams error re-executes entire wave via subagents, no error type inspection"
  - "STATE.json committed at wave boundaries only, not per-job transition"
  - "Job handoffs stored at .planning/waves/{setId}/{waveId}/{jobId}-HANDOFF.md separate from v1.0 set-level handoffs"

patterns-established:
  - "Job executor prompt template: JOB-PLAN content + file ownership + commit convention + RAPID:RETURN protocol"
  - "Smart re-entry: classify jobs by status (complete/failed/executing/pending) and take appropriate action"
  - "Wave reconciliation decision gate: dynamic AskUserQuestion options based on PASS/PASS_WITH_WARNINGS/FAIL result"
  - "Rate limit fallback: parallel dispatch degrades to sequential within wave on rate limit errors"

requirements-completed: [EXEC-01, EXEC-04, UX-02]

# Metrics
duration: 8min
completed: 2026-03-08
---

# Phase 21 Plan 03: Execute SKILL.md Rewrite Summary

**Mark II execute skill rewritten as job-level dispatch orchestrator with parallel subagent/agent-teams execution, smart re-entry, wave-sequential processing, and reconciliation decision gates**

## Performance

- **Duration:** 8 min (across two sessions: initial execution + checkpoint verification)
- **Started:** 2026-03-08T09:45:00Z
- **Completed:** 2026-03-08T09:53:19Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Complete rewrite of skills/execute/SKILL.md from v1.0 set-level lifecycle to Mark II job-level dispatch orchestrator (415 lines)
- Step 0: Environment + precondition check with JOB-PLAN.md existence validation across all waves
- Step 1: Dual-mode detection (agent teams vs subagents) locked for entire run
- Step 2: Smart re-entry from STATE.json -- classifies jobs as complete/failed/stale/pending and takes appropriate action
- Step 3: Wave-sequential processing with parallel job dispatch, RAPID:RETURN parsing, reconciliation, and dynamic user decision gates
- Step 4: Final summary with per-wave breakdown and next-action options
- AskUserQuestion used at every decision gate: set selection, mode selection, execution confirmation, wave reconciliation, final summary
- Progress banners at wave start, per-job transitions, and completion
- Rate limit fallback from parallel to sequential within a wave
- Agent teams fallback to subagents on any error with visible warning

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite execute SKILL.md for Mark II job-level execution** - `a4f3387` (feat)
2. **Task 2: Verify complete Mark II execution engine** - checkpoint:human-verify (approved, no code changes)

## Files Created/Modified
- `skills/execute/SKILL.md` - Complete rewrite from v1.0 set-level lifecycle to Mark II job-level dispatch orchestrator with 4-step pipeline, dual-mode execution, smart re-entry, and wave reconciliation

## Decisions Made
- Execute skill is dispatch-only -- /discuss and /wave-plan are prerequisites, not integrated steps. Precondition check prompts user to run them if JOB-PLAN.md files are missing.
- Dual-mode execution (agent teams vs subagents) detected once at Step 1 and locked for entire run. No re-detection mid-execution.
- Generic teams fallback: any agent teams operation failure re-executes the entire wave via subagents. No error type inspection or special-casing.
- STATE.json committed at wave boundaries (after all jobs resolve), not after each individual job transition. In-memory/on-disk writes happen per-job.
- Job handoffs stored at `.planning/waves/{setId}/{waveId}/{jobId}-HANDOFF.md`, separate from v1.0 set-level handoffs at `.planning/sets/{setName}/HANDOFF.md`.
- Existing role-executor.md preserved for v1.0 backward compatibility; new job-level execution uses role-job-executor.md.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 21 (Execution Engine) is now complete with all 3 plans delivered
- Execute skill ready for end-to-end use with /rapid:discuss -> /rapid:wave-plan -> /rapid:execute pipeline
- Phase 22 (Review Module) can proceed -- it depends on Phase 16 (state machine) and Phase 21 (execution engine)
- Phase 23 (Merge Pipeline) can proceed after Phase 22

## Self-Check: PASSED

- [x] skills/execute/SKILL.md exists (414 lines, meets 200-line minimum)
- [x] 21-03-SUMMARY.md exists
- [x] Commit a4f3387 exists in git log

---
*Phase: 21-execution-engine*
*Completed: 2026-03-08*
