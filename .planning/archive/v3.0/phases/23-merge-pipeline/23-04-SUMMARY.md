---
phase: 23-merge-pipeline
plan: 04
subsystem: merge
tags: [cli-subcommands, merge-pipeline, skill-orchestrator, detection, resolution, bisection, rollback]

# Dependency graph
requires:
  - phase: 23-merge-pipeline
    plan: 01
    provides: "merge.cjs v2.0 with 5-level detection, 4-tier resolution, MERGE-STATE.json CRUD"
  - phase: 23-merge-pipeline
    plan: 02
    provides: "role-merger.md agent role for semantic detection and AI-assisted resolution"
  - phase: 23-merge-pipeline
    plan: 03
    provides: "bisectWave, revertSetMerge, detectCascadeImpact, integrateSemanticResults, applyAgentResolutions"
provides:
  - "handleMerge CLI with 11 subcommands (6 v1.0 updated + 5 new: detect, resolve, bisect, rollback, merge-state)"
  - "Complete v2.0 merge SKILL.md orchestrator (488 lines, 16 AskUserQuestion gates)"
  - "User-facing integration layer for entire merge pipeline"
affects: [merge-pipeline, rapid-cli, merge-skill]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI subcommands as thin wrappers around merge.cjs library functions with JSON output"
    - "SKILL.md orchestrates pipeline via CLI calls, spawns merger agent for L5/T3 analysis"
    - "Bisection auto-triggers on integration gate failure with post-bisection user decision"
    - "Idempotent re-entry via MERGE-STATE.json status checks in SKILL.md"

key-files:
  created: []
  modified:
    - "src/bin/rapid-tools.cjs"
    - "skills/merge/SKILL.md"

key-decisions:
  - "CLI detect subcommand creates/updates MERGE-STATE.json with detection results for skill consumption"
  - "CLI resolve subcommand flattens detection results from MERGE-STATE.json into allConflicts array for resolveConflicts()"
  - "CLI bisect subcommand finds preWaveCommit by resolving parent of earliest merged set's commit"
  - "CLI rollback outputs cascade warning JSON without --force flag, enabling skill to present AskUserQuestion"
  - "SKILL.md bisection auto-triggers without pre-bisection AskUserQuestion (user locked decision)"
  - "SKILL.md reviewer subagent removed -- review now done in Phase 22 review module"
  - "Execute subcommand now also writes MERGE-STATE.json on successful merge (mergeCommit + status=complete)"

patterns-established:
  - "CLI thin-wrapper pattern: subcommand validates args, calls library function, outputs JSON via output()"
  - "MERGE-STATE.json as pipeline state persistence for idempotent re-entry across skill restarts"
  - "Cascade warning pattern: CLI returns advisory JSON, skill presents decision gate to user"

requirements-completed: [MERG-01, MERG-02, MERG-03, MERG-04, MERG-05, MERG-06]

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 23 Plan 04: CLI Subcommands and Merge SKILL.md Orchestrator Summary

**Rewritten handleMerge with 11 CLI subcommands (detect/resolve/bisect/rollback/merge-state) and complete v2.0 merge SKILL.md orchestrator with 5-level detection, 4-tier resolution, merger agent, auto-bisection, and 16 AskUserQuestion gates**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T14:47:05Z
- **Completed:** 2026-03-08T14:52:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- handleMerge expanded from 6 to 11 subcommands with all v2.0 merge operations exposed via JSON CLI
- Complete SKILL.md rewrite (488 lines) orchestrates the full merge pipeline: load plan -> detect -> resolve -> merger agent -> programmatic gate -> merge -> integration gate -> bisection/rollback
- All existing v1.0 subcommands enhanced: execute updates MERGE-STATE.json, status includes MERGE-STATE data, update-status syncs MERGE-STATE
- 16 AskUserQuestion gates provide user control at every decision point in the pipeline
- Idempotent re-entry: pipeline checks MERGE-STATE.json on restart and skips already-merged sets

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite handleMerge CLI subcommands** - `383d328` (feat)
2. **Task 2: Rewrite merge SKILL.md pipeline orchestrator** - `ec38a30` (feat)

## Files Created/Modified
- `src/bin/rapid-tools.cjs` - handleMerge expanded with detect, resolve, bisect, rollback, merge-state subcommands; existing execute/status/update-status enhanced with MERGE-STATE.json integration
- `skills/merge/SKILL.md` - Complete v2.0 rewrite: 8-step pipeline with detection, resolution cascade, merger agent spawning, programmatic gate, merge execution, integration gate, bisection recovery, rollback

## Decisions Made
- CLI detect subcommand creates/updates MERGE-STATE.json with structured detection results so the skill can consume them without re-running detection
- CLI resolve subcommand flattens the per-level detection results into a single allConflicts array for the resolveConflicts() function, which expects a flat list
- CLI bisect subcommand finds the pre-wave commit by resolving the parent (~1) of the earliest merged set's merge commit hash from MERGE-STATE.json
- CLI rollback returns a cascade warning JSON (without --force) to enable the SKILL.md to present an AskUserQuestion before proceeding -- the --force flag bypasses this for the skill to use after user confirmation
- SKILL.md auto-triggers bisection on integration gate failure without a pre-bisection prompt -- the user locked this decision during planning
- Reviewer subagent from v1.0 SKILL.md is removed -- code review is now handled by Phase 22's review module (/rapid:review)
- Execute subcommand now writes MERGE-STATE.json with mergeCommit and status='complete' on successful merge, enabling downstream bisection and rollback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 23 (merge pipeline) is now complete -- all 4 plans delivered
- CLI provides programmatic access to all merge operations for any future automation
- SKILL.md is the user-facing entry point for the merge pipeline (/rapid:merge)
- Merger agent role (Plan 02) is spawned by the SKILL.md for semantic detection and AI resolution
- All merge library functions (Plan 01 + Plan 03) are wired through CLI to SKILL.md

## Self-Check: PASSED

- FOUND: src/bin/rapid-tools.cjs
- FOUND: skills/merge/SKILL.md
- FOUND: 23-04-SUMMARY.md
- FOUND: 383d328 (Task 1 commit)
- FOUND: ec38a30 (Task 2 commit)

---
*Phase: 23-merge-pipeline*
*Completed: 2026-03-08*
