---
phase: 04-planning-engine-and-contracts
plan: 01
subsystem: planning
tags: [dag, topological-sort, json-schema, ajv, contracts, ownership, waves]

# Dependency graph
requires:
  - phase: 01-foundation-libraries
    provides: "core.cjs utilities, node:test pattern, CommonJS module conventions"
provides:
  - "dag.cjs: topological sort, wave assignment, DAG creation/validation, execution order"
  - "contract.cjs: JSON Schema contract compilation, test generation, manifest, ownership maps, contributions"
  - "Ajv installed as tool dependency for JSON Schema validation"
affects: [04-02-PLAN, 04-03-PLAN, phase-05, phase-07]

# Tech tracking
tech-stack:
  added: [ajv@8.17.1, ajv-formats@3.0.1]
  patterns: [kahn-algorithm-toposort, bfs-wave-assignment, json-schema-meta-validation, contract-test-codegen]

key-files:
  created:
    - rapid/src/lib/dag.cjs
    - rapid/src/lib/dag.test.cjs
    - rapid/src/lib/contract.cjs
    - rapid/src/lib/contract.test.cjs
  modified:
    - rapid/package.json
    - rapid/package-lock.json

key-decisions:
  - "Ajv CJS import uses require('ajv').default (v8 ESM-first compat, verified at runtime)"
  - "Kahn's algorithm (BFS) for topological sort -- deterministic, simple cycle detection via count mismatch"
  - "Edge convention: from=dependency, to=dependent (from must complete before to starts)"
  - "Ownership overlap detection uses simple startsWith on directory prefixes (no glob dependency)"
  - "Generated contract tests use var declarations for Function constructor parse-ability"
  - "CONTRACT_META_SCHEMA uses additionalProperties:false to enforce strict contract structure"

patterns-established:
  - "DAG.json format: nodes with wave/status, edges with from/to, waves with checkpoint contracts/artifacts, metadata"
  - "CONTRACT_META_SCHEMA: canonical schema for validating all CONTRACT.json files"
  - "Contract test codegen: AUTO-GENERATED header, node:test describe/it blocks, function existence + type shape checks"
  - "OWNERSHIP.json: version/generated/ownership map with /** directory patterns"
  - "CONTRIBUTIONS.json: set name + contributesTo array with file/owner/intent"
  - "MANIFEST.json: version/generated/contracts array with exports and consumer cross-references"

requirements-completed: [PLAN-02, PLAN-03, PLAN-04]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 4 Plan 01: DAG and Contract Foundation Summary

**Kahn's algorithm topological sort with wave assignment plus Ajv-powered JSON Schema contract validation, test generation, manifest creation, and file ownership maps**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T08:02:16Z
- **Completed:** 2026-03-04T08:07:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- dag.cjs with 5 exported functions: topological sort (cycle detection + unknown edge validation), BFS wave assignment, full DAG.json creation with checkpoints and metadata, structural validation, and execution order extraction
- contract.cjs with 7 exports: CONTRACT_META_SCHEMA, compileContract (Ajv validation), generateContractTest (code generation), createManifest (consumer cross-referencing), createOwnershipMap (conflict + overlap detection), checkOwnership (exact + prefix match), createContribution (validation)
- 70 total tests passing (33 dag + 37 contract) covering edge cases: cycles, diamonds, deep chains, unknown nodes, duplicate IDs, invalid schemas, ownership conflicts/overlaps, generated code syntax validity
- Ajv v8 installed as tool dependency in rapid/package.json (first non-lockfile npm dependency)

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: dag.cjs** - `fa0f858` (test) + `db8ba8e` (feat)
2. **Task 2: contract.cjs** - `be616bb` (test) + `a856c9b` (feat)

_TDD tasks have two commits each: RED (failing tests) then GREEN (implementation)_

## Files Created/Modified
- `rapid/src/lib/dag.cjs` - Topological sort, wave assignment, DAG creation/validation, execution order (279 lines)
- `rapid/src/lib/dag.test.cjs` - 33 unit tests for all dag.cjs functions (440 lines)
- `rapid/src/lib/contract.cjs` - Contract schema compilation, test generation, manifest, ownership, contributions (415 lines)
- `rapid/src/lib/contract.test.cjs` - 37 unit tests for all contract.cjs functions (485 lines)
- `rapid/package.json` - Added ajv and ajv-formats dependencies
- `rapid/package-lock.json` - Lock file for new dependencies

## Decisions Made
- Used `require('ajv').default` for CommonJS import (Ajv v8 ships ESM-first, verified working at runtime)
- Kahn's algorithm (BFS-based) for topological sort -- deterministic queue ordering, cycle detection via sorted-count mismatch (simpler than DFS back-edge detection)
- Edge direction convention documented in JSDoc: `from` = dependency, `to` = dependent
- Ownership overlap detection uses simple `startsWith` on directory prefixes stripped of `/**` -- avoids adding a glob/minimatch dependency for 90% case coverage
- Generated contract test code uses `var` declarations and `function()` syntax (not arrow functions) so `new Function(code)` can validate syntax without scope issues
- CONTRACT_META_SCHEMA enforces `additionalProperties: false` to catch typos in contract field names early

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- dag.cjs and contract.cjs are ready for plan.cjs (04-02-PLAN) to orchestrate
- All data structures match the formats defined in 04-RESEARCH.md (DAG.json, CONTRACT.json, OWNERSHIP.json, CONTRIBUTIONS.json, MANIFEST.json)
- Ajv is available for contract validation in subsequent plans

## Self-Check: PASSED

All 6 files verified present. All 4 task commits verified in git log.

---
*Phase: 04-planning-engine-and-contracts*
*Completed: 2026-03-04*
