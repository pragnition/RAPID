---
phase: 43-planning-discussion-skills
plan: 01
subsystem: skills
tags: [init, discovery, roadmap, batched-questions, sets-only, contract-json]

# Dependency graph
requires:
  - phase: 42-core-agent-rewrites
    provides: stable core agents (planner, executor, merger, reviewer) with XML structure and tool docs
provides:
  - v3 init skill with batched discovery (4 topic batches), sets-only roadmap, CONTRACT.json at init
  - progress breadcrumb rendering on completion and errors
  - UX error recovery with progress context
affects: [43-02, 43-03, 44-execution-auxiliary-skills, rapid-roadmapper]

# Tech tracking
tech-stack:
  added: []
  patterns: [batched-topic-discovery, sets-only-roadmap, progress-breadcrumb, error-breadcrumb]

key-files:
  created: []
  modified: [skills/init/SKILL.md]

key-decisions:
  - "4 topic batches for discovery (Vision+Users, Features+Technical, Scale+Integrations, Context+Success) instead of 8-15 individual questions"
  - "Roadmapper outputs sets only -- wave/job decomposition deferred to /plan-set"
  - "STATE.json at init contains only project > milestone > sets (no waves/jobs arrays)"
  - "Progress breadcrumb shown at completion and on every error in Steps 1-9"
  - "Next step suggests /rapid:start-set (v3 command) instead of /rapid:set-init (v2)"

patterns-established:
  - "Batched discovery: group related discovery areas into topic batches for fewer user interactions"
  - "Progress breadcrumb: show workflow position on completion and errors"
  - "Sets-only state: STATE.json contains only set-level status, no wave/job decomposition at init"

requirements-completed: [CMD-01, PLAN-04, UX-01, UX-02]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 43 Plan 01: Init Skill Rewrite Summary

**v3 init skill with batched discovery (4 topic batches), sets-only roadmap output, CONTRACT.json at init, and progress breadcrumbs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T02:54:19Z
- **Completed:** 2026-03-13T02:57:59Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Rewrote discovery from one-at-a-time questioning to 4 topic batches (Vision+Users, Features+Technical, Scale+Integrations, Context+Success), reducing discovery interactions from 8-15 to 3-4 batches
- Roadmapper now produces sets-only output with explicit instructions to NOT include wave or job structure
- STATE.json written with project > milestone > sets hierarchy only (each set has id, name, status, branch -- no waves/jobs)
- CONTRACT.json files generated at init time per set for cross-set consistency
- Progress breadcrumb rendered at completion (`init [done] > start-set > ...`) and on every error with context-aware status
- Next step changed from `/rapid:set-init` to `/rapid:start-set`
- Anti-patterns section added documenting v2 patterns to avoid (wave/job state, WAVE-CONTEXT.md, set-init command)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite init SKILL.md for v3** - `7a49a0e` (feat)

## Files Created/Modified
- `skills/init/SKILL.md` - Rewritten init skill with batched discovery, sets-only roadmap, CONTRACT.json at init, progress breadcrumbs, and anti-pattern documentation (752 lines)

## Decisions Made
- Grouped 10 discovery areas into 4 topic batches (2-3 areas each) for optimal user experience -- enough detail per batch without overwhelming, and few enough batches to keep interaction count low
- Added progress breadcrumbs to every step (Steps 1-9) that can fail, not just the completion step, so users always know what succeeded and what needs attention
- Kept the existing AskUserQuestion error recovery pattern (Retry/Skip/Cancel) unchanged as it works well
- Wrote anti-patterns section explicitly documenting what NOT to do, rather than only showing what to do, to prevent v2 patterns from creeping back

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Init skill complete and ready for use
- start-set and discuss-set skills (43-02) can now reference this init skill's output format (STATE.json with sets-only, CONTRACT.json per set)
- plan-set skill (43-03) can build on the sets-only foundation knowing wave decomposition happens at plan-set time

---
*Phase: 43-planning-discussion-skills*
*Completed: 2026-03-13*
