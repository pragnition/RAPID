---
phase: 11-planning-and-status-skill-prompts
plan: 02
subsystem: ui
tags: [askuserquestion, status, prompt, skill]

# Dependency graph
requires:
  - phase: 10-init-and-context-skill-prompts
    provides: AskUserQuestion pattern with consequence-focused descriptions and context-based headers
provides:
  - Status skill with dynamic AskUserQuestion next-action routing based on 5 detected project states
affects: [15-global-stop-replacement]

# Tech tracking
tech-stack:
  added: []
  patterns: [dynamic-state-detection-prompt, dismiss-option-pattern]

key-files:
  created: []
  modified: [skills/status/SKILL.md]

key-decisions:
  - "Headers change per state to give immediate signal (Next step, Execution in progress, Gate blocked, Ready to merge)"
  - "Done viewing dismiss option always available so developers can exit without triggering commands"

patterns-established:
  - "State-dependent AskUserQuestion: detect project state from gathered data, present matching options"
  - "Dismiss option pattern: always include a no-op exit option in routing prompts"

requirements-completed: [PROMPT-14]

# Metrics
duration: 1min
completed: 2026-03-06
---

# Phase 11 Plan 02: Status Skill Dynamic Next-Action Routing Summary

**Status SKILL.md Step 4 rewritten with dynamic AskUserQuestion offering state-appropriate next actions across 5 detected project states**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-06T01:02:18Z
- **Completed:** 2026-03-06T01:03:06Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added AskUserQuestion to status skill allowed-tools frontmatter
- Replaced static text guidance in Step 4 with 5 state-dependent AskUserQuestion prompts
- Each state has a context-appropriate header (Next step, Execution in progress, Gate blocked, Ready to merge)
- Every state includes "Done viewing" dismiss option for check-in-only usage

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite status SKILL.md Step 4 with dynamic AskUserQuestion next-action routing** - `aab7b20` (feat)

**Plan metadata:** `e0b9e54` (docs: complete plan)

## Files Created/Modified
- `skills/status/SKILL.md` - Added AskUserQuestion to allowed-tools, rewrote Step 4 with dynamic state-based next-action routing

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Status skill now uses structured AskUserQuestion prompts matching the pattern established in Phase 10
- All three skills targeted by Phase 11 (plan, assumptions, status) can proceed independently

---
*Phase: 11-planning-and-status-skill-prompts*
*Completed: 2026-03-06*

## Self-Check: PASSED
