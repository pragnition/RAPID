---
phase: 42-core-agent-rewrites
plan: 02
subsystem: agents
tags: [core-agents, planner, executor, v3-workflow, PLAN.md, role-section]

# Dependency graph
requires:
  - phase: 42-core-agent-rewrites
    provides: orchestrator removed, v3 identity in core-identity.md, 26-role registries, STUB/CORE test assertions
provides:
  - Complete planner agent with v3 PLAN.md-based decomposition role section
  - Complete executor agent with PLAN.md task implementation and artifact-based completion detection
  - build-agents preserves CORE-prefixed hand-written agents instead of overwriting with stubs
affects: [42-03-PLAN, 43-planning-skills, 44-execution-skills]

# Tech tracking
tech-stack:
  added: []
  patterns: [CORE comment prefix for hand-written agents, build-agents CORE preservation]

key-files:
  created: []
  modified:
    - agents/rapid-planner.md
    - agents/rapid-executor.md
    - src/bin/rapid-tools.cjs

key-decisions:
  - "build-agents must detect CORE prefix and skip overwriting hand-written agent files"
  - "Planner role covers 5-step decomposition process with planning principles and escape hatches"
  - "Executor role covers artifact-based completion detection for crash recovery"

patterns-established:
  - "CORE preservation: build-agents checks for <!-- CORE: Hand-written agent prefix before writing stubs"
  - "Role section structure: Responsibilities, Process/Flow, Principles/Discipline, Escape Hatches, Constraints"

requirements-completed: [AGENT-04]

# Metrics
duration: 7min
completed: 2026-03-12
---

# Phase 42 Plan 02: Planner and Executor Role Sections Summary

**Hand-written v3 role sections for planner (PLAN.md decomposition) and executor (artifact-based task implementation) with build-agents CORE preservation fix**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T13:50:56Z
- **Completed:** 2026-03-12T13:58:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Planner agent has complete GUIDED role section covering 5-step decomposition process, planning principles, escape hatches, and constraints (11,701 bytes, under 12KB)
- Executor agent has complete GUIDED role section covering PLAN.md-based execution flow, artifact-based completion detection, commit discipline, and constraints (10,641 bytes, under 12KB)
- Fixed build-agents to detect and preserve CORE-prefixed hand-written agents instead of blindly overwriting with stubs
- Both agents use v3 language throughout (PLAN.md, set-level state, no wave/job references, no orchestrator references)
- All 18 build-agents tests pass with both hand-written agents preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Hand-write planner agent role section and update header** - `62f70c7` (feat)
2. **Task 2: Hand-write executor agent role section and fix build-agents preservation** - `b352d9f` (feat)

## Files Created/Modified
- `agents/rapid-planner.md` - CORE prefix, complete role section with v3 decomposition process
- `agents/rapid-executor.md` - CORE prefix, complete role section with PLAN.md execution and artifact-based completion
- `src/bin/rapid-tools.cjs` - build-agents SKIP_GENERATION loop now checks for CORE prefix before overwriting

## Decisions Made
- build-agents must detect `<!-- CORE: Hand-written agent` prefix and skip overwriting -- discovered when test's `before()` hook ran build-agents and reverted hand-written content
- Planner role section uses the plan's prescribed structure verbatim (~3.3KB within 12KB budget)
- Executor role section kept compact at ~1.8KB as specified, with artifact-based completion detection for crash recovery

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed build-agents overwriting hand-written CORE agent files**
- **Found during:** Task 2 (executor role section)
- **Issue:** Running `node --test build-agents.test.cjs` triggers `build-agents` in the `before()` hook, which regenerates stubs for all SKIP_GENERATION agents, overwriting hand-written CORE content
- **Fix:** Added CORE prefix detection in the stub generation loop -- if a file starts with `<!-- CORE: Hand-written agent`, skip it instead of overwriting
- **Files modified:** `src/bin/rapid-tools.cjs`
- **Verification:** Tests run with build-agents no longer reverting planner/executor files
- **Committed in:** b352d9f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix -- without it, running tests would destroy hand-written agent content. No scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Planner and executor agents complete with v3 role sections
- Plan 03 needs to write merger and reviewer role sections (2 remaining core agents)
- build-agents now correctly preserves all CORE-prefixed files, so Plan 03 can safely hand-write merger and reviewer without test interference
- Only merger and reviewer show TODO warnings in tests (expected until Plan 03)

## Self-Check: PASSED

- agents/rapid-planner.md: EXISTS, CORE prefix, # Role: Planner present, 11,701 bytes
- agents/rapid-executor.md: EXISTS, CORE prefix, # Role: Executor present, 10,641 bytes
- Commit 62f70c7: EXISTS
- Commit b352d9f: EXISTS
- All 18 build-agents tests: PASS

---
*Phase: 42-core-agent-rewrites*
*Completed: 2026-03-12*
