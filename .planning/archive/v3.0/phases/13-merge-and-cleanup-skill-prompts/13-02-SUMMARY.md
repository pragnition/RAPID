---
phase: 13-merge-and-cleanup-skill-prompts
plan: 02
subsystem: ui
tags: [AskUserQuestion, structured-prompts, cleanup, worktree, double-confirmation]

# Dependency graph
requires:
  - phase: 10-init-and-context-skill-prompts
    provides: AskUserQuestion patterns (context-based headers, consequence descriptions)
  - phase: 11-plan-and-status-skill-prompts
    provides: "<=4 items AskUserQuestion, >4 text list" pattern
  - phase: 12-execute-skill-prompts-and-progress
    provides: "Pause here" pattern replacing stop/halt keywords
provides:
  - Cleanup skill with AskUserQuestion at all decision gates
  - Dirty worktree recovery with Commit/Stash/Force/Cancel structured options
  - Double confirmation gate pattern for force removal
affects: [15-global-stop-replacement-and-remaining-progress]

# Tech tracking
tech-stack:
  added: []
  patterns: [double-confirmation-gate-for-destructive-actions, dirty-worktree-recovery-options]

key-files:
  created: []
  modified: [skills/cleanup/SKILL.md]

key-decisions:
  - "Force removal double confirmation uses nested AskUserQuestion (confirm/cancel) after initial force selection"
  - "Dirty worktree recovery includes specific git commands in option descriptions for transparency"

patterns-established:
  - "Double confirmation gate: destructive action selection -> second AskUserQuestion with explicit consequences"
  - "Recovery options: multiple structured resolution paths (commit/stash/force/cancel) instead of single error message"

requirements-completed: [PROMPT-11, ERRR-02]

# Metrics
duration: 1min
completed: 2026-03-06
---

# Phase 13 Plan 02: Cleanup Skill Prompts Summary

**Cleanup SKILL.md rewritten with AskUserQuestion structured prompts for worktree selection, removal confirmation, and dirty worktree recovery with double-confirmation force removal**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-06T02:39:21Z
- **Completed:** 2026-03-06T02:40:29Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced freeform text input with AskUserQuestion for worktree selection (<=4 as options, >4 as text list)
- Replaced yes/no confirmation with structured Remove/Cancel prompt showing explicit deletion consequences
- Added dirty worktree recovery with 4 structured options (Commit/Stash/Force/Cancel) with specific commands in descriptions
- Added double confirmation gate for force removal to prevent accidental data loss
- Removed all STOP/halt keywords (verified: 0 occurrences)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AskUserQuestion structured prompts** - `146acaa` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `skills/cleanup/SKILL.md` - Cleanup skill with AskUserQuestion at all decision gates and dirty worktree recovery

## Decisions Made
- Force removal double confirmation uses nested AskUserQuestion after initial force selection -- consistent with wave revert pattern from 13-CONTEXT.md
- Dirty worktree recovery shows specific git commands in option descriptions so developers know exactly what each choice does before selecting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cleanup skill fully converted to structured prompts
- Phase 15 (global STOP replacement) can skip cleanup skill -- already clean
- Merge skill (13-01) is the companion plan for this phase

---
*Phase: 13-merge-and-cleanup-skill-prompts*
*Completed: 2026-03-06*
