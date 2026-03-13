---
phase: 18-init-and-project-setup
plan: 01
subsystem: init
tags: [config, model-selection, team-size, research-dir, cli]

# Dependency graph
requires:
  - phase: 17-dependency-audit
    provides: state-machine.cjs used by init scaffolding
provides:
  - generateConfigJson with model/teamSize parameters
  - init research-dir CLI subcommand
  - init write-config CLI subcommand
  - .planning/research/ directory creation during scaffold
affects: [18-03-skill-orchestration, planning, agents]

# Tech tracking
tech-stack:
  added: []
  patterns: [opts-based config generation, CLI subcommand dispatch]

key-files:
  created: []
  modified:
    - src/lib/init.cjs
    - src/lib/init.test.cjs
    - src/bin/rapid-tools.cjs
    - src/bin/rapid-tools.test.cjs

key-decisions:
  - "Model field stored at top-level in config.json (not nested under project or planning)"
  - "max_parallel_sets computed as Math.max(1, floor(teamSize * 1.5)) matching generateProjectMd formula"
  - "research-dir and write-config added as init subcommands alongside detect/scaffold"

patterns-established:
  - "opts-based generators: generateConfigJson(opts) pattern for extensible config generation"

requirements-completed: [INIT-01, INIT-02, INIT-05, INIT-06]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 18 Plan 01: Init Library and CLI Extensions Summary

**Extended generateConfigJson with model selection (opus/sonnet) and team-size-based parallel scaling, plus new research-dir and write-config CLI subcommands**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T10:19:35Z
- **Completed:** 2026-03-06T10:22:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- generateConfigJson now accepts model and teamSize options with sensible defaults
- scaffoldProject creates .planning/research/ directory in all modes (fresh, reinitialize, upgrade)
- New CLI subcommand `init research-dir` creates research directory idempotently
- New CLI subcommand `init write-config` writes config.json with model/teamSize/name flags

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend generateConfigJson and scaffoldProject** - `45bb49b` (test: RED) -> `3f4b1ac` (feat: GREEN)
2. **Task 2: Add init CLI subcommands** - `5cc48b7` (test: RED) -> `b5b488e` (feat: GREEN)

_Note: TDD tasks have RED (failing test) and GREEN (implementation) commits._

## Files Created/Modified
- `src/lib/init.cjs` - Extended generateConfigJson signature, added research dir creation
- `src/lib/init.test.cjs` - 10 new tests for model/teamSize config and research dir
- `src/bin/rapid-tools.cjs` - Added research-dir and write-config subcommands to handleInit
- `src/bin/rapid-tools.test.cjs` - 4 new integration tests for CLI subcommands

## Decisions Made
- Model field placed at top-level in config.json (not nested) for easy access by agents
- max_parallel_sets formula reuses same calculation as generateProjectMd (floor(teamSize * 1.5))
- write-config ensures .planning/ directory exists before writing, for standalone use

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Init library and CLI ready for SKILL.md orchestration (Plan 18-03) to call
- generateConfigJson, research-dir, and write-config provide the foundation for automated project setup

---
*Phase: 18-init-and-project-setup*
*Completed: 2026-03-06*
