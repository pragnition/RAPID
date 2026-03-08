---
phase: 23-merge-pipeline
plan: 01
subsystem: merge
tags: [conflict-detection, resolution-cascade, zod, git-merge, merge-state, dag-ordering]

# Dependency graph
requires:
  - phase: 22-review-pipeline
    provides: "review.cjs patterns (findDependents string-matching, REVIEW-ISSUES.json non-locked writes)"
  - phase: 16-contracts
    provides: "Zod 3.24.4, dag.cjs getExecutionOrder, state-transitions.cjs SET_TRANSITIONS"
provides:
  - "5-level conflict detection pipeline (L1-L4 code-based, L5 agent placeholder)"
  - "4-tier resolution cascade (T1 deterministic, T2 heuristic, T3-T4 placeholder)"
  - "MERGE-STATE.json Zod schema and CRUD (writeMergeState, readMergeState, updateMergeState)"
  - "Preserved v1.0 functions (getMergeOrder, mergeSet, runIntegrationTests, etc.)"
affects: [23-merge-pipeline, merge-skill, role-merger]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Function-scope overlap detection via diff hunk parsing and line-to-function mapping"
    - "Conflict detection funnel: textual > structural > dependency > API > semantic"
    - "Resolution cascade with confidence scoring and tier escalation"
    - "MERGE-STATE.json per-set tracking with Zod validation"

key-files:
  created: []
  modified:
    - "src/lib/merge.cjs"
    - "src/lib/merge.test.cjs"

key-decisions:
  - "Used function-scope mapping (line-to-function index) for structural conflict detection instead of regex on diff lines only"
  - "extractExports uses comma-split parsing for module.exports instead of regex lookahead"
  - "Dependency conflicts compare against branch point ancestor (3-way) not just branch vs base (2-way)"
  - "API conflicts track both added and removed exports from both branches relative to ancestor"

patterns-established:
  - "extractModifiedFunctions: parse unified diff hunk headers, map changed lines to enclosing function scope"
  - "3-way dependency/API comparison: ancestor vs branch vs base for precise conflict attribution"
  - "MERGE-STATE.json CRUD with Zod validation and auto-updated lastUpdatedAt"

requirements-completed: [MERG-01, MERG-02, MERG-03, MERG-04]

# Metrics
duration: 8min
completed: 2026-03-08
---

# Phase 23 Plan 01: Merge Library v2.0 Summary

**Rewritten merge.cjs with 5-level conflict detection (textual/structural/dependency/API), 4-tier resolution cascade (deterministic/heuristic), Zod-validated MERGE-STATE.json, and all preserved v1.0 merge functions**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-08T14:27:28Z
- **Completed:** 2026-03-08T14:35:28Z
- **Tasks:** 1 (TDD feature with RED + GREEN commits)
- **Files modified:** 2

## Accomplishments
- Complete rewrite of merge.cjs with v2.0 detection pipeline (L1-L4) and resolution cascade (T1-T2)
- Structural conflict detection uses function-scope mapping from diff hunks to detect when the same function is modified in both branches
- MERGE-STATE.json Zod schema tracks detection results, resolution progress, merge commits, and bisection state per set
- All 8 v1.0 functions preserved with identical signatures and behavior
- 48 tests across 25 describe blocks covering all detection levels, resolution tiers, state CRUD, and v1.0 functions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for v2.0 merge pipeline** - `e02df73` (test)
2. **Task 1 GREEN: Implementation passing all tests** - `9dc5b82` (feat)

_Note: TDD task with RED then GREEN commits_

## Files Created/Modified
- `src/lib/merge.cjs` - Complete v2.0 rewrite: detection (L1-L4), resolution (T1-T2), MERGE-STATE.json CRUD, preserved v1.0 functions (1286 lines)
- `src/lib/merge.test.cjs` - Comprehensive tests: detection helpers, conflict git fixtures, resolution cascade, Zod schema validation, v1.0 function tests (1246 lines)

## Decisions Made
- Used function-scope mapping (extractModifiedFunctions) for L2 structural conflict detection -- parses diff hunk headers to determine which line ranges changed, then maps those lines to their enclosing function via a pre-built line-to-function index from the full file content. More accurate than regex on diff lines alone
- 3-way dependency/API comparison (ancestor vs branch vs base) using git merge-base as the common ancestor rather than simple 2-way branch-vs-base. Provides accurate attribution of which side added/removed deps/exports
- extractExports uses comma-split parsing for CommonJS module.exports (handles trailing identifiers before closing brace correctly)
- MERGE-STATE.json uses non-locked writes consistent with review.cjs pattern (sequential merge operations)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed extractExports regex for trailing identifier before closing brace**
- **Found during:** Task 1 GREEN (test run)
- **Issue:** Regex `\b(\w+)\s*(?:[:,}])` failed to match the last identifier in `module.exports = { greet, farewell, helper }` because space before `}` prevented match
- **Fix:** Changed to comma-split parsing approach that correctly handles all positions
- **Files modified:** src/lib/merge.cjs
- **Verification:** extractExports test passes with 3 exports extracted
- **Committed in:** 9dc5b82

**2. [Rule 1 - Bug] Fixed structural conflict detection missing function-body changes**
- **Found during:** Task 1 GREEN (test run)
- **Issue:** extractFunctionNames only matched lines where function declarations were added/removed, missing cases where function body lines changed but the declaration was a context line in the diff
- **Fix:** Created extractModifiedFunctions that parses diff hunk headers for line ranges, builds line-to-function index from full file content, and maps changed lines to their enclosing function scope
- **Files modified:** src/lib/merge.cjs
- **Verification:** detectStructuralConflicts correctly detects greet function overlap
- **Committed in:** 9dc5b82

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct detection behavior. No scope creep.

## Issues Encountered
None -- both bugs were caught by TDD RED-GREEN cycle and fixed before the GREEN commit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Detection and resolution functions ready for consumption by CLI subcommands (Plan 04)
- MERGE-STATE.json schema defines the contract for merge progress tracking
- L5 semantic detection and T3-T4 resolution are null/placeholder, to be filled by Plan 03 (bisection, rollback, merger agent integration)
- All v1.0 functions preserved for backward compatibility during SKILL.md rewrite (Plan 04)

---
*Phase: 23-merge-pipeline*
*Completed: 2026-03-08*
