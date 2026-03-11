---
phase: 35-adaptive-conflict-resolution
plan: 01
subsystem: merge
tags: [zod, conflict-resolution, routing, schema, tdd]

# Dependency graph
requires:
  - phase: 34-core-merge-subagent-delegation
    provides: Set-merger dispatch-collect pattern, agentPhase1 lifecycle, parseSetMergerReturn, prepareMergerContext
provides:
  - agentPhase2 per-conflict object map schema (z.record)
  - routeEscalation() confidence band + API flag routing
  - isApiSignatureConflict() L4 detection cross-reference
  - generateConflictId() unique ID generation with suffix handling
  - prepareResolverContext() resolver launch briefing assembly
  - parseConflictResolverReturn() with confidence validation
affects: [35-02-PLAN, merge-skill-step-3e, role-conflict-resolver]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-conflict-object-map-state, confidence-band-routing, resolver-return-parsing]

key-files:
  created: []
  modified:
    - src/lib/merge.cjs
    - src/lib/merge.test.cjs

key-decisions:
  - "agentPhase2 changed from AgentPhaseEnum.optional() to z.record(string, AgentPhaseEnum).optional() for per-conflict tracking"
  - "Confidence band routing: <0.3 human-direct, 0.3-0.8 resolver-agent, >0.8 auto-accept, API-signature always human-api-gate"
  - "Conflict IDs use file path as base with :N suffix for duplicates"
  - "parseConflictResolverReturn requires confidence field in COMPLETE returns for routing decisions"
  - "prepareResolverContext truncates merger analysis at 800 tokens (3200 chars)"

patterns-established:
  - "Per-conflict object map: agentPhase2 = { [conflictId]: 'idle'|'spawned'|'done'|'failed' }"
  - "Confidence band routing: API rule overrides confidence, three bands with distinct destinations"
  - "Resolver return parsing: COMPLETE requires confidence, missing defaults to BLOCKED"

requirements-completed: [MERGE-06]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 35 Plan 01: Schema + Helpers Summary

**Per-conflict agentPhase2 schema, confidence-band routing, conflict ID generation, resolver context assembly, and return parsing with full TDD coverage**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T02:43:59Z
- **Completed:** 2026-03-11T02:48:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Changed agentPhase2 from single enum to per-conflict object map for tracking multiple resolver agents per set
- Added 5 new exported functions: routeEscalation, isApiSignatureConflict, generateConflictId, prepareResolverContext, parseConflictResolverReturn
- Routing logic matches CONTEXT.md exactly: 0.3-0.8 resolver band, API rule overrides confidence
- Full TDD cycle (RED-GREEN) for all new functionality with 27 new tests, 135 total pass

## Task Commits

Each task was committed atomically:

1. **Task 1: agentPhase2 schema change + routing/ID helpers** - `3bd3d69` (test: RED), `21474ff` (feat: GREEN)
2. **Task 2: prepareResolverContext + parseConflictResolverReturn** - `972c143` (test: RED), `97b718c` (feat: GREEN)

_Note: TDD tasks have two commits each (test -> feat)_

## Files Created/Modified
- `src/lib/merge.cjs` - agentPhase2 schema change, 5 new helper functions, exports updated
- `src/lib/merge.test.cjs` - Updated agentPhase2 tests for object map, added 6 new test groups (27 new tests)

## Decisions Made
- Used z.record(z.string(), AgentPhaseEnum) for agentPhase2 -- enables per-conflict lifecycle tracking
- Confidence band thresholds match CONTEXT.md: 0.3 lower, 0.8 upper (overrides REQUIREMENTS.md 0.4-0.7)
- API-signature detection uses L4 detection.api.conflicts cross-reference (not keyword matching on reason string)
- Conflict IDs use file path as base -- simple, readable, matches escalation data structure
- prepareResolverContext truncates at 800 tokens to stay within reasonable prompt budget
- parseConflictResolverReturn requires confidence in COMPLETE returns -- returns BLOCKED if missing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 helper functions exported and tested, ready for Plan 02 SKILL.md rewrite and role module
- Plan 02 can import routeEscalation, prepareResolverContext, parseConflictResolverReturn directly
- agentPhase2 schema supports per-conflict tracking for resolver dispatch lifecycle

## Self-Check: PASSED

- All 2 source files exist (merge.cjs, merge.test.cjs)
- All 4 task commits verified (3bd3d69, 21474ff, 972c143, 97b718c)
- All 5 exported functions confirmed as function type
- Full test suite: 135 pass, 0 fail

---
*Phase: 35-adaptive-conflict-resolution*
*Completed: 2026-03-11*
