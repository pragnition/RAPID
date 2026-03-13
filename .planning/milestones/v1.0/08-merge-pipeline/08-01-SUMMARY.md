---
phase: 08-merge-pipeline
plan: 01
subsystem: merge
tags: [git-merge, code-review, contract-validation, ownership-check, cleanup-agent]

# Dependency graph
requires:
  - phase: 04-contract-engine
    provides: compileContract, generateContractTest, checkOwnership for programmatic validation
  - phase: 05-worktree-management
    provides: gitExec, loadRegistry, detectMainBranch for git operations
  - phase: 06-execution-engine
    provides: getChangedFiles, assembleExecutorPrompt pattern for prompt assembly
  - phase: 07-execution-lifecycle
    provides: reconcileWave pattern (NODE_TEST_CONTEXT isolation technique)
provides:
  - merge.cjs library with 8 functions for review-merge pipeline
  - rapid-cleanup.md agent definition for constrained auto-fix
  - REVIEW.md format with machine-parseable VERDICT marker
affects: [08-merge-pipeline, merge-skill]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NODE_TEST_CONTEXT clearing for nested node --test isolation"
    - "execSync for merge instead of gitExec (stdout conflict detection)"
    - "REVIEW.md with <!-- VERDICT:X --> HTML comment marker"

key-files:
  created:
    - rapid/src/lib/merge.cjs
    - rapid/src/lib/merge.test.cjs
    - rapid/agents/rapid-cleanup.md
  modified: []

key-decisions:
  - "Used execSync directly for mergeSet instead of gitExec wrapper -- git merge reports conflicts to stdout, not stderr, and gitExec only captures stderr"
  - "Clear NODE_TEST_CONTEXT env var in runIntegrationTests to prevent nested node --test from silently swallowing test failures"
  - "REVIEW.md verdict uses <!-- VERDICT:APPROVE|CHANGES|BLOCK --> HTML comment marker for machine parsing (matches RAPID:RETURN pattern)"
  - "Contract gate test file written to set dir as .contract-gate-test.cjs (temp, cleaned up after run)"

patterns-established:
  - "NODE_TEST_CONTEXT isolation: delete env.NODE_TEST_CONTEXT before spawning child node --test processes"
  - "Conflict detection via stdout: git merge puts CONFLICT markers in stdout, check both stdout and stderr"

requirements-completed: [MERG-01, MERG-02, MERG-03]

# Metrics
duration: 9min
completed: 2026-03-04
---

# Phase 08 Plan 01: Merge Pipeline Library Summary

**Merge pipeline library with programmatic validation gate, reviewer prompt assembly, REVIEW.md with machine-parseable verdict, git merge --no-ff execution with conflict handling, and constrained cleanup agent definition**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-04T13:44:25Z
- **Completed:** 2026-03-04T13:54:01Z
- **Tasks:** 2 (TDD for Task 1: RED + GREEN)
- **Files created:** 3

## Accomplishments
- merge.cjs exports 8 functions covering the complete review-merge pipeline (529 lines)
- merge.test.cjs has 22 passing tests across 9 suites covering all functions (680 lines)
- rapid-cleanup.md agent definition with strict allowed/FORBIDDEN action constraints
- Discovered and solved nested NODE_TEST_CONTEXT issue for child node --test processes
- Discovered and solved git merge conflict detection: conflicts reported to stdout not stderr

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Add failing tests for merge pipeline** - `cb4adc3` (test)
2. **Task 1 (TDD GREEN): Implement merge.cjs with all 8 functions** - `a781e62` (feat)
3. **Task 2: Create rapid-cleanup.md** - (not committed: rapid/agents/ is gitignored by design per 01-02 decision)

## Files Created/Modified
- `rapid/src/lib/merge.cjs` - Merge pipeline library with 8 exported functions
- `rapid/src/lib/merge.test.cjs` - 22 passing tests covering all functions and edge cases
- `rapid/agents/rapid-cleanup.md` - Cleanup agent with constrained scope (gitignored, exists on disk)

## Decisions Made
- Used execSync directly for mergeSet instead of gitExec -- git merge reports conflicts to stdout, not stderr
- Clear NODE_TEST_CONTEXT env var in runIntegrationTests to prevent nested node --test silent failures
- REVIEW.md verdict uses `<!-- VERDICT:X -->` HTML comment marker matching RAPID:RETURN pattern
- Contract gate test written as temp file (.contract-gate-test.cjs) in set dir, cleaned up after run

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Git merge conflict detection checks stdout not stderr**
- **Found during:** Task 1 (mergeSet implementation)
- **Issue:** gitExec only captures stderr on error, but git merge reports conflict info to stdout
- **Fix:** Used execSync directly for merge command to capture both stdout and stderr for conflict detection
- **Files modified:** rapid/src/lib/merge.cjs
- **Verification:** Merge conflict test passes correctly
- **Committed in:** a781e62

**2. [Rule 1 - Bug] Nested node --test inherits NODE_TEST_CONTEXT**
- **Found during:** Task 1 (runIntegrationTests implementation)
- **Issue:** When node --test spawns child node --test processes, the child inherits NODE_TEST_CONTEXT causing it to not throw on test failures
- **Fix:** Clear NODE_TEST_CONTEXT from env before spawning child process
- **Files modified:** rapid/src/lib/merge.cjs
- **Verification:** runIntegrationTests correctly detects both passing and failing tests

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- rapid/agents/ directory is gitignored per 01-02 decision -- rapid-cleanup.md exists on disk but cannot be committed to git. This is by design as agents are assembled at runtime.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- merge.cjs library complete with all functions the /rapid:merge skill (Plan 02) needs
- rapid-cleanup.md agent definition ready for cleanup subagent spawning
- Plan 02 can build the merge skill orchestrator using these building blocks

---
*Phase: 08-merge-pipeline*
*Completed: 2026-03-04*
