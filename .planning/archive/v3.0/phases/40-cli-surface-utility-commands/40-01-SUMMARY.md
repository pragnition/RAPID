---
phase: 40-cli-surface-utility-commands
plan: 01
subsystem: cli
tags: [skills, deprecation, commands, help, rename]

# Dependency graph
requires:
  - phase: 39-tool-docs-registry
    provides: "Agent prompt assembly pipeline and core modules"
provides:
  - "4 renamed skill directories (start-set, discuss-set, execute-set, new-version)"
  - "6 deprecation stub skills (set-init, discuss, execute, new-milestone, plan, wave-plan)"
  - "v3.0 help command reference with 7+4 layout"
affects: [40-02, 40-03, 41-build-pipeline, 45-docs-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns: ["deprecation stubs with disable-model-invocation: true"]

key-files:
  created:
    - "skills/start-set/SKILL.md"
    - "skills/discuss-set/SKILL.md"
    - "skills/execute-set/SKILL.md"
    - "skills/new-version/SKILL.md"
  modified:
    - "skills/set-init/SKILL.md"
    - "skills/discuss/SKILL.md"
    - "skills/execute/SKILL.md"
    - "skills/new-milestone/SKILL.md"
    - "skills/plan/SKILL.md"
    - "skills/wave-plan/SKILL.md"
    - "skills/help/SKILL.md"

key-decisions:
  - "Deprecation stubs use disable-model-invocation: true for zero-cost direct output"
  - "Renamed skills get full content copy with updated command names and next-step references"
  - "Help command includes deprecated commands migration table for discoverability"

patterns-established:
  - "Deprecation stub pattern: minimal SKILL.md with [DEPRECATED] description and disable-model-invocation"
  - "v3.0 command naming: start-set, discuss-set, plan-set, execute-set, new-version"

requirements-completed: [UX-03, UX-04]

# Metrics
duration: 7min
completed: 2026-03-12
---

# Phase 40 Plan 01: Skill Directory Renames and Help Rewrite Summary

**Renamed 4 skill directories to v3.0 names (start-set, discuss-set, execute-set, new-version), created 6 deprecation stubs, and rewrote help for 7+4 command structure**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T07:50:41Z
- **Completed:** 2026-03-12T07:57:50Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created 4 new skill directories with full content copied and renamed from v2 originals (start-set from set-init, discuss-set from discuss, execute-set from execute, new-version from new-milestone)
- Replaced 6 old skill directories with deprecation stubs pointing to v3.0 replacements (set-init, discuss, execute, new-milestone, plan, wave-plan)
- Rewrote help command to show 7 core lifecycle + 4 auxiliary commands with v3.0 workflow diagram and deprecated commands migration table

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename skill directories and create deprecation stubs** - `c589aeb` (feat)
2. **Task 2: Rewrite help command for v3.0 structure** - `1c537c5` (feat)

## Files Created/Modified
- `skills/start-set/SKILL.md` - Renamed from set-init with updated command references and next-step guidance
- `skills/discuss-set/SKILL.md` - Renamed from discuss with updated command references and next-step guidance
- `skills/execute-set/SKILL.md` - Renamed from execute with updated command references and next-step guidance
- `skills/new-version/SKILL.md` - Renamed from new-milestone with updated command references and next-step guidance
- `skills/set-init/SKILL.md` - Deprecation stub pointing to /rapid:start-set
- `skills/discuss/SKILL.md` - Deprecation stub pointing to /rapid:discuss-set
- `skills/execute/SKILL.md` - Deprecation stub pointing to /rapid:execute-set
- `skills/new-milestone/SKILL.md` - Deprecation stub pointing to /rapid:new-version
- `skills/plan/SKILL.md` - Deprecation stub pointing to /rapid:plan-set (notes project-level planning now in /rapid:init)
- `skills/wave-plan/SKILL.md` - Deprecation stub pointing to /rapid:plan-set (notes single-pass wave planning)
- `skills/help/SKILL.md` - Complete rewrite with v3.0 7+4 command structure, workflow diagram, and migration table

## Decisions Made
- Deprecation stubs use `disable-model-invocation: true` so Claude outputs the deprecation message directly without model processing overhead
- Renamed skills update all internal references (titles, descriptions, next-step commands) but keep CLI subcommand references as-is (CLI internals deferred to Phase 45)
- Help command includes a "Deprecated Commands" migration table mapping old v2 names to v3 replacements for discoverability
- discuss-set next-step points to `/rapid:plan-set` instead of `/rapid:wave-plan` to reflect the consolidated planning command

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Skill directories ready for Phase 40 plans 02 and 03 (status dashboard, review/merge state updates)
- Help reference complete -- future plans may need minor updates if /rapid:add-set ships in Phase 44
- Deprecation stubs in place for backward compatibility during v3 transition

---
*Phase: 40-cli-surface-utility-commands*
*Completed: 2026-03-12*
