---
phase: 04-planning-engine-and-contracts
plan: 02
subsystem: planning
tags: [set-decomposition, planning-gates, ownership-maps, dag-persistence, manifest, assumptions]

# Dependency graph
requires:
  - phase: 04-planning-engine-and-contracts
    provides: "dag.cjs (topological sort, wave assignment, DAG creation), contract.cjs (schema validation, test generation, manifest, ownership)"
  - phase: 01-foundation-libraries
    provides: "core.cjs utilities, node:test pattern, CommonJS module conventions, rapid-tools.cjs CLI framework"
provides:
  - "plan.cjs: set creation, decomposition orchestration, DAG/ownership/manifest/gate persistence, gate checking, assumptions surfacing"
  - "rapid-tools.cjs plan subcommand with 7 operations (create-set, decompose, write-dag, check-gate, update-gate, list-sets, load-set)"
  - "rapid-tools.cjs assumptions subcommand for structured set analysis"
affects: [04-03-PLAN, phase-05, phase-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [set-directory-structure, gates-json-state-machine, definition-md-template, stdin-json-cli-pattern]

key-files:
  created:
    - rapid/src/lib/plan.cjs
    - rapid/src/lib/plan.test.cjs
  modified:
    - rapid/src/bin/rapid-tools.cjs
    - rapid/src/bin/rapid-tools.test.cjs

key-decisions:
  - "DEFINITION.md generated from structured setDef object using template with 7 sections (name, scope, ownership, tasks, contract ref, wave, acceptance)"
  - "GATES.json uses wave-N keys with planning/execution sub-objects for clean state machine transitions"
  - "decomposeIntoSets builds DAG edges from contract imports.fromSets cross-references (not explicit edge definitions)"
  - "surfaceAssumptions parses DEFINITION.md with regex to extract sections and combines with CONTRACT.json analysis"
  - "CLI plan subcommands use stdin JSON for complex inputs (create-set, decompose, write-dag) and positional args for simple queries"

patterns-established:
  - "Set directory structure: .planning/sets/{name}/ with DEFINITION.md, CONTRACT.json, contract.test.cjs, optional CONTRIBUTIONS.json"
  - "GATES.json state machine: blocked -> open (planning), blocked -> ready (execution)"
  - "Planning gate rule: all sets in wave must be planned before any executes"
  - "Assumptions output format: 5 sections (Scope Understanding, File Boundaries, Contract Assumptions, Dependency Assumptions, Risk Factors)"
  - "stdin JSON CLI pattern: complex inputs piped via stdin, simple queries via positional args"

requirements-completed: [PLAN-01, PLAN-04, PLAN-06]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 4 Plan 02: Planning Orchestration Library Summary

**Set decomposition orchestrator with DEFINITION.md/CONTRACT.json creation, DAG/ownership/manifest/gate persistence, per-wave planning gates, and structured assumptions surfacing via plan.cjs and rapid-tools CLI**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T08:10:17Z
- **Completed:** 2026-03-04T08:15:25Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- plan.cjs with 11 exported functions orchestrating full set decomposition workflow: createSet, loadSet, listSets, decomposeIntoSets, writeDAG, writeOwnership, writeManifest, writeGates, checkPlanningGate, updateGate, surfaceAssumptions
- 50 unit tests covering all plan.cjs functions including set creation with all file types, loading, listing, persistence, gate checking/updating, decomposition with edge building from contract imports, ownership conflict propagation, DAG cycle propagation, and structured assumptions output
- rapid-tools.cjs extended with handlePlan (7 subcommands) and handleAssumptions (list mode + set-specific analysis), plus 12 CLI integration tests

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: plan.cjs library** - `44be51f` (test) + `26e7196` (feat)
2. **Task 2: CLI subcommands** - `6748344` (feat)

_TDD Task 1 has two commits: RED (failing tests) then GREEN (implementation)_

## Files Created/Modified
- `rapid/src/lib/plan.cjs` - Planning orchestration library with 11 exported functions (543 lines)
- `rapid/src/lib/plan.test.cjs` - 50 unit tests for all plan.cjs functions (669 lines)
- `rapid/src/bin/rapid-tools.cjs` - Extended with plan (7 subcommands) and assumptions CLI handlers
- `rapid/src/bin/rapid-tools.test.cjs` - Extended with 12 CLI integration tests for plan and assumptions

## Decisions Made
- DEFINITION.md uses a 7-section template generated from structured setDef objects (consistent format across all sets)
- GATES.json keys use `wave-N` format with nested `planning` and `execution` sub-objects for clean state transitions
- DAG edges in decomposeIntoSets are automatically derived from contract `imports.fromSets` cross-references rather than requiring explicit edge definitions
- surfaceAssumptions uses regex parsing of DEFINITION.md sections combined with CONTRACT.json structure analysis
- CLI plan subcommands use stdin JSON for complex inputs (create-set, decompose, write-dag) and positional args for simple queries (check-gate, update-gate, list-sets, load-set)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- plan.cjs is ready for Plan 03 (/rapid:plan and /rapid:assumptions skills) to invoke
- All CLI subcommands are operational for skill-level orchestration
- Gate management enables per-wave planning enforcement
- surfaceAssumptions provides the developer review capability for the assumptions skill

## Self-Check: PASSED
