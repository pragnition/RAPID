---
phase: 37-technical-documentation
plan: 02
subsystem: documentation
tags: [agents, state-machines, troubleshooting, ascii-diagrams, reference-docs]

# Dependency graph
requires:
  - phase: 37-technical-documentation (plan 01)
    provides: "Index file and lifecycle skill documentation"
provides:
  - "Agent reference catalog with 31 agent cards and dispatch tree"
  - "State machine documentation with ASCII lifecycle diagrams"
  - "Troubleshooting guide with 6 symptom/cause/fix cards"
affects: [technical_documentation.md, README.md]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Agent card format (type badge, spawned-by table, inputs/outputs)", "Symptom/cause/fix troubleshooting card format", "ASCII state transition diagrams"]

key-files:
  created:
    - docs/agents.md
    - docs/state-machines.md
    - docs/troubleshooting.md
  modified: []

key-decisions:
  - "rapid-reviewer classified as Internal (defined but not currently dispatched by any active skill)"
  - "Dispatch tree shows shared agents (wave-researcher, wave-planner, plan-verifier) under both plan-set and wave-plan skills"
  - "rapid-bugfix listed under both Execution and Review stages since it is spawned by both execute and review skills"

patterns-established:
  - "Agent card: heading + type badge + color + description + spawned-by/inputs/outputs table"
  - "State machine: ASCII diagram + transition table + derived status rules"
  - "Troubleshooting: symptom/cause/fix with cross-references to related docs"

requirements-completed: [DOC-03, DOC-04, DOC-05]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 37 Plan 02: Agent Reference, State Machines, and Troubleshooting Summary

**31 agent cards with dispatch tree, ASCII state machine diagrams for set/wave/job lifecycles, and 6 troubleshooting cards with cross-references**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T05:04:56Z
- **Completed:** 2026-03-11T05:09:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Agent reference with all 31 agents cataloged by lifecycle stage, each with type badge, spawned-by, inputs, and outputs
- ASCII dispatch tree showing the full spawn hierarchy from user through orchestrator to all leaf agents
- State machine documentation with diagrams for set (6 states), wave (7 states + retry), and job (4 states + retry) lifecycles
- Derived status rules documented in readable prose (wave from jobs, set from waves)
- 6 troubleshooting cards covering the most common failure modes with direct fix instructions
- Cross-references between troubleshooting and state machine docs for state-related issues

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent reference with catalog and dispatch tree** - `f52e56e` (feat)
2. **Task 2: Create state machine docs and troubleshooting guide** - `f92992f` (feat)

## Files Created/Modified
- `docs/agents.md` - Agent reference with 31 cards, type badges, dispatch tree, lifecycle groupings
- `docs/state-machines.md` - Set/wave/job lifecycles with ASCII diagrams, derived status rules, status enums
- `docs/troubleshooting.md` - 6 symptom/cause/fix cards for common failure modes

## Decisions Made
- Classified `rapid-reviewer` as Internal (defined in agents/ but not dispatched by any active skill)
- Listed `rapid-bugfix` under both Execution and Review stages since it is spawned by both `/rapid:execute --fix-issues` and `/rapid:review`
- Showed shared agents (wave-researcher, wave-planner, plan-verifier) under both `/rapid:plan-set` and `/rapid:wave-plan` in the dispatch tree

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 sub-documents for Plan 02 complete (agents, state-machines, troubleshooting)
- Ready for Plan 01 to link these from the technical_documentation.md index file
- All cross-references use relative paths within docs/ directory

## Self-Check: PASSED

All 3 created files verified on disk. Both task commits verified in git history.

---
*Phase: 37-technical-documentation*
*Completed: 2026-03-11*
