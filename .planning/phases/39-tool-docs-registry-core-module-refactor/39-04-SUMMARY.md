---
phase: 39-tool-docs-registry-core-module-refactor
plan: 04
subsystem: agent-build
tags: [xml-assembly-order, prompt-schema, returns-tag, gap-closure]

# Dependency graph
requires:
  - phase: 39-03
    provides: "ROLE_CORE_MAP, assembleAgentPrompt(), build pipeline with tool doc injection"
provides:
  - "Correct XML tag order in all 31 agents: identity, conventions, tools, role, returns"
  - "assembleAgentPrompt() defers core-returns.md emission to after <role> section"
  - "Assembly order test enforces returnsStart > roleStart"
affects: [phase-41-full-agent-rebuild]

# Tech tracking
tech-stack:
  added: []
  patterns: [deferred-returns-emission, assembly-order-validation]

key-files:
  created: []
  modified:
    - src/bin/rapid-tools.cjs
    - src/lib/build-agents.test.cjs
    - agents/rapid-executor.md

key-decisions:
  - "assembleAgentPrompt() defers core-returns.md to after <role> instead of emitting in core module loop"
  - "ROLE_CORE_MAP arrays reordered with core-returns.md last for clarity even though emission order is now decoupled"

patterns-established:
  - "Returns-last assembly: assembleAgentPrompt skips core-returns.md in core loop, emits after role section"
  - "Assembly order test validates all 5 tag positions: identity < conventions < tools < role < returns"

requirements-completed: [AGENT-02]

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 39 Plan 04: XML Tag Assembly Order Fix Summary

**Fixed assembleAgentPrompt() to emit `<returns>` after `<role>`, matching PROMPT-SCHEMA.md order, with assembly order test enforcement**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T07:03:23Z
- **Completed:** 2026-03-12T07:05:14Z
- **Tasks:** 1
- **Files modified:** 33 (1 source + 1 test + 31 agent files)

## Accomplishments
- ROLE_CORE_MAP 8 three-element arrays reordered with core-returns.md last (clarity fix)
- assembleAgentPrompt() now defers core-returns.md emission to after the `<role>` section (the actual order fix)
- Assembly order test asserts `returnsStart > roleStart` in build-agents.test.cjs
- EXPECTED_ROLE_CORE_MAP in test file updated to match production order
- All 31 agents rebuilt with correct tag order: identity, conventions, tools, role, returns
- All 37 tests pass (12 build-agents + 25 tool-docs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Reorder ROLE_CORE_MAP arrays, fix assembleAgentPrompt, strengthen assembly order test, rebuild all agents** - `44f2788` (fix)

## Files Created/Modified
- `src/bin/rapid-tools.cjs` - Reordered ROLE_CORE_MAP arrays; modified assembleAgentPrompt() to skip core-returns.md in core loop and emit it after `<role>`
- `src/lib/build-agents.test.cjs` - Updated EXPECTED_ROLE_CORE_MAP order; added returnsStart > roleStart assertion
- `agents/rapid-*.md` (all 31) - Rebuilt with correct tag order: identity, conventions, tools, role, returns

## Decisions Made
- The ROLE_CORE_MAP array order alone was insufficient because assembleAgentPrompt() emits all core modules in a single loop before `<role>`. The fix required both reordering the arrays AND modifying the assembly function to defer returns emission.
- Used a `returnsModule` variable to hold core-returns.md aside during the core loop, then emit it as Step 5 after `<role>` (Step 4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] assembleAgentPrompt() core loop emits returns before role**
- **Found during:** Task 1, Step 5 (test verification)
- **Issue:** The plan assumed reordering ROLE_CORE_MAP arrays would fix tag order, but assembleAgentPrompt() emits ALL core modules in a loop (Step 2) before tool docs (Step 3) and role (Step 4). Even with core-returns.md last in the array, it still emitted before `<tools>` and `<role>`.
- **Fix:** Modified assembleAgentPrompt() to skip core-returns.md during the core module loop and emit it as a new Step 5 after the `<role>` section.
- **Files modified:** src/bin/rapid-tools.cjs
- **Verification:** All 37 tests pass; tag order verification confirms identity (267) < conventions (3694) < tools (4780) < role (5078) < returns (8000)
- **Committed in:** 44f2788

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for correctness. The plan's approach of only reordering arrays was insufficient given the assembly function's loop structure. No scope creep.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 39 gap closure complete: all 4 plans executed
- All 31 agents have correct XML tag order per PROMPT-SCHEMA.md
- Assembly order validated by tests and manual verification
- Ready for Phase 41 (full agent rebuild) when v3.0 agent roles are rewritten

## Self-Check: PASSED

- [x] src/bin/rapid-tools.cjs exists
- [x] src/lib/build-agents.test.cjs exists
- [x] agents/rapid-executor.md exists
- [x] 39-04-SUMMARY.md exists
- [x] Commit 44f2788 found
- [x] All 37 tests pass (12 build-agents + 25 tool-docs)

---
*Phase: 39-tool-docs-registry-core-module-refactor*
*Completed: 2026-03-12*
