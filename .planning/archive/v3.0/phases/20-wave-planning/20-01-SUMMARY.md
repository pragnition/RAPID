---
phase: 20-wave-planning
plan: 01
subsystem: planning
tags: [wave-planning, discuss, ask-user-question, contract-validation, state-machine]

# Dependency graph
requires:
  - phase: 19-set-lifecycle
    provides: "Set initialization, worktree management, state transitions"
  - phase: 17-state-machine
    provides: "STATE.json, readState, findWave, transitionWave, transitionSet"
  - phase: 16-contracts
    provides: "CONTRACT.json, compileContract, createManifest"
provides:
  - "wave-planning.cjs library: resolveWave, createWaveDir, writeWaveContext, validateJobPlans"
  - "wave-plan CLI subcommands: resolve-wave, create-wave-dir, validate-contracts"
  - "/rapid:discuss skill with GSD-style gray area identification and 4-question loops"
affects: [21-wave-execution, 22-review, wave-plan-skill]

# Tech tracking
tech-stack:
  added: []
  patterns: ["wave-scoped discussion with gray area identification", "4-question deep-dive loops with Claude decides option", "case-insensitive cross-set import validation"]

key-files:
  created:
    - src/lib/wave-planning.cjs
    - src/lib/wave-planning.test.cjs
    - skills/discuss/SKILL.md
  modified:
    - src/bin/rapid-tools.cjs

key-decisions:
  - "Wave artifacts stored in .planning/waves/{setId}/{waveId}/ (main repo, not worktree)"
  - "resolveWave returns array for ambiguous matches to support AskUserQuestion disambiguation"
  - "Cross-set import validation uses case-insensitive matching per CONTEXT.md decision"
  - "Missing export coverage classified as auto-fix, missing cross-set imports as major violation"

patterns-established:
  - "Wave planning library pattern: resolve -> create dir -> write context -> validate"
  - "Discuss skill pattern: env setup, resolve, gather context, identify gray areas, deep-dive, state transition, write context, commit"

requirements-completed: [WAVE-01, WAVE-02]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 20 Plan 01: Wave Planning Library and Discuss Skill Summary

**Wave planning library with resolveWave/createWaveDir/writeWaveContext/validateJobPlans, three CLI subcommands, and /rapid:discuss skill with GSD-style gray area identification and 4-question deep-dive loops**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T17:58:53Z
- **Completed:** 2026-03-06T18:03:04Z
- **Tasks:** 2 (Task 1 TDD with RED+GREEN commits)
- **Files modified:** 4

## Accomplishments
- Wave planning library (wave-planning.cjs) with 4 exported functions: resolveWave, createWaveDir, writeWaveContext, validateJobPlans
- 18 unit tests passing covering all library functions: wave resolution (single match, ambiguous, not found), directory creation (new, idempotent), context writing, and contract validation (export coverage, cross-set imports, case-insensitive matching, severity classification)
- CLI subcommands (resolve-wave, create-wave-dir, validate-contracts) added to rapid-tools.cjs with structured JSON output
- /rapid:discuss skill (335 lines) with 8-step discussion flow, 8 AskUserQuestion decision gates, and "Claude decides" option on all deep-dive questions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave planning library and CLI subcommands (TDD RED)** - `7fa62a0` (test)
2. **Task 1: Wave planning library and CLI subcommands (TDD GREEN)** - `0d0fa88` (feat)
3. **Task 2: /rapid:discuss skill** - `7ae0d6f` (feat)

_Note: Task 1 followed TDD with separate RED and GREEN commits._

## Files Created/Modified
- `src/lib/wave-planning.cjs` - Wave planning library: resolveWave, createWaveDir, writeWaveContext, validateJobPlans
- `src/lib/wave-planning.test.cjs` - 18 unit tests covering all library functions
- `src/bin/rapid-tools.cjs` - Added wave-plan command with resolve-wave, create-wave-dir, validate-contracts subcommands
- `skills/discuss/SKILL.md` - /rapid:discuss skill with GSD-style gray area identification and 4-question deep-dive loops

## Decisions Made
- Wave artifacts stored in `.planning/waves/{setId}/{waveId}/` (main repo, namespaced by setId) per RESEARCH.md recommendation
- resolveWave returns an array when the same waveId exists in multiple sets (for caller disambiguation via AskUserQuestion)
- Cross-set import validation uses case-insensitive matching per CONTEXT.md user decision about "minor differences"
- Missing export coverage classified as auto-fix severity; missing cross-set imports classified as major violations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave planning library ready for wave-plan skill and planner agents
- /rapid:discuss skill ready for developer use on initialized sets
- CLI subcommands available for skills to call via `node "${RAPID_TOOLS}" wave-plan ...`
- Phase 20 plans 02+ can build wave-plan skill, agent roles, and validation gate on this foundation

---
*Phase: 20-wave-planning*
*Completed: 2026-03-07*
