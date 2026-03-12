---
phase: 42-core-agent-rewrites
plan: 01
subsystem: agents
tags: [build-pipeline, agent-registry, orchestrator-removal, v3-workflow, core-identity]

# Dependency graph
requires:
  - phase: 41-build-pipeline
    provides: hybrid build pipeline with SKIP_GENERATION and 27-role registries
provides:
  - 26-role registries with orchestrator removed from all maps
  - v3 workflow in core-identity.md (init, start-set, discuss-set, plan-set, execute-set, review, merge)
  - Updated test assertions for 26 roles, 4 core agents
  - Independent sets model language in identity
affects: [42-02-PLAN, 42-03-PLAN, 43-planning-skills, 44-execution-skills]

# Tech tracking
tech-stack:
  added: []
  patterns: [STUB-or-CORE comment prefix for core agents, transition-safe test assertions]

key-files:
  created: []
  modified:
    - src/bin/rapid-tools.cjs
    - src/lib/tool-docs.cjs
    - src/lib/build-agents.test.cjs
    - src/lib/tool-docs.test.cjs
    - src/modules/core/core-identity.md
    - agents/rapid-*.md (all 26 agents rebuilt)

key-decisions:
  - "Test assertions accept both STUB and CORE comment prefixes for transition compatibility"
  - "Phase 42 TODO warning test is informational (diagnostic), not a hard failure"

patterns-established:
  - "STUB|CORE comment prefix: core agents use either prefix during transition period"
  - "Independent sets model: sets have no ordering dependencies in workflow description"

requirements-completed: [AGENT-04]

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 42 Plan 01: Orchestrator Removal and v3 Identity Summary

**Removed orchestrator agent from all 6 registries and files, rewrote core-identity.md with v3 independent-sets workflow, rebuilt all 26 agents**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T13:43:36Z
- **Completed:** 2026-03-12T13:47:29Z
- **Tasks:** 2
- **Files modified:** 33 (6 registry/test files + 27 agent files rebuilt - 1 orchestrator deleted)

## Accomplishments
- Orchestrator agent completely removed from all production code: ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_CORE_MAP, ROLE_TOOL_MAP, and SKIP_GENERATION
- core-identity.md rewritten with v3 7-step workflow (init, start-set, discuss-set, plan-set, execute-set, review, merge)
- Independent sets model added: "Sets are independent -- they can be started, planned, executed, reviewed, and merged in any order"
- All 26 agents rebuilt with updated identity, verified propagation to generated agents
- All 43 tests pass with updated assertions (26 roles, 4 core agents)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove orchestrator from all registries, delete files, update tests** - `6132522` (feat)
2. **Task 2: Rewrite core-identity.md for v3 workflow and run build-agents** - `606bb4f` (feat)

## Files Created/Modified
- `src/bin/rapid-tools.cjs` - Removed orchestrator from ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_CORE_MAP, SKIP_GENERATION
- `src/lib/tool-docs.cjs` - Removed orchestrator from ROLE_TOOL_MAP
- `src/lib/build-agents.test.cjs` - Updated ALL_27_ROLES to ALL_26_ROLES, CORE_AGENTS from 5 to 4, accept STUB|CORE prefix
- `src/lib/tool-docs.test.cjs` - Removed orchestrator from expectedRoles
- `src/modules/core/core-identity.md` - Rewritten with v3 workflow and independent sets model
- `agents/rapid-orchestrator.md` - Deleted
- `src/modules/roles/role-orchestrator.md` - Deleted
- `agents/rapid-*.md` (26 files) - Rebuilt with updated identity

## Decisions Made
- Test assertions accept both STUB and CORE comment prefixes to support the transition period where Plans 02-03 will replace stubs with hand-written content
- Phase 42 TODO warning implemented as informational diagnostic (not a failing test) since Plans 02-03 will resolve the TODO placeholders

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Clean 26-role registries ready for Plans 02-03 to write role sections into the 4 core agents
- core-identity.md v3 workflow ready for propagation
- Test assertions updated to accept the STUB-to-CORE transition
- Plans 02-03 will write the hand-written `<role>` sections for planner, executor, merger, and reviewer

## Self-Check: PASSED

- 42-01-SUMMARY.md: EXISTS
- agents/rapid-orchestrator.md: DELETED (confirmed)
- src/modules/roles/role-orchestrator.md: DELETED (confirmed)
- Commit 6132522: EXISTS
- Commit 606bb4f: EXISTS
- All 43 tests: PASS

---
*Phase: 42-core-agent-rewrites*
*Completed: 2026-03-12*
