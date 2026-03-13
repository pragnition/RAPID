---
phase: 13-merge-and-cleanup-skill-prompts
plan: 01
subsystem: ui
tags: [AskUserQuestion, merge, prompts, error-recovery, verdict-banners]

requires:
  - phase: 12-execute-skill-prompts-and-progress
    provides: AskUserQuestion patterns (context headers, consequence descriptions, dynamic options)
provides:
  - Merge SKILL.md with structured AskUserQuestion prompts at all decision gates
  - Verdict banners with emoji + label + findings summary
  - Structured error recovery for conflicts, gate failures, and cleanup escalation
affects: [15-global-stop-replacement-and-remaining-progress]

tech-stack:
  added: []
  patterns: [double-confirmation-for-destructive-actions, verdict-banners-with-emoji, cleanup-escalation-prompt]

key-files:
  created: []
  modified: [skills/merge/SKILL.md]

key-decisions:
  - "Verdict banners use checkmark/wrench/no-entry emoji for APPROVE/CHANGES/BLOCK"
  - "Double confirmation gate on wave revert (destructive action pattern)"
  - "Cleanup escalation offers Fix manually/Skip set/Abort pipeline after 2 rounds"
  - "Merge conflict flow: Resolve manually -> Show diff -> Abort with follow-up confirmation"

patterns-established:
  - "Verdict banner: emoji + LABEL + 1-line findings summary after every reviewer verdict"
  - "Double confirmation for destructive actions (revert wave lists affected sets before confirming)"
  - "Multi-step error recovery: first prompt shows options, follow-up confirms resolution"

requirements-completed: [PROMPT-09, PROMPT-10, ERRR-01, ERRR-04]

duration: 2min
completed: 2026-03-06
---

# Phase 13 Plan 01: Merge Skill Prompts Summary

**AskUserQuestion structured prompts at all merge decision gates with verdict banners, conflict recovery, and cleanup escalation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T02:39:15Z
- **Completed:** 2026-03-06T02:41:27Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced all freeform yes/no prompts and bare STOP handling with 14 AskUserQuestion structured prompts
- Added verdict banners with emoji + label + findings summary for APPROVE/CHANGES/BLOCK
- Added structured error recovery for merge conflicts (Resolve/Show diff/Abort with follow-up)
- Added double confirmation gate on wave revert (lists affected sets before confirming)
- Added cleanup escalation prompt after 2 rounds with Fix manually/Skip/Abort options
- Added post-pipeline next-action routing (Run cleanup/View status/Done)
- Eliminated all STOP/halt keywords (0 remaining)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AskUserQuestion structured prompts at all merge decision gates** - `19a6990` (feat)

## Files Created/Modified
- `skills/merge/SKILL.md` - Rewritten with AskUserQuestion at every decision gate, verdict banners, and structured error recovery

## Decisions Made
- Verdict banners use checkmark/wrench/no-entry emoji for APPROVE/CHANGES/BLOCK (consistent, informative, not alarming)
- Double confirmation gate pattern for destructive wave revert (lists sets that will be undone)
- Merge conflict offers three-option recovery with follow-up confirmation after resolution
- Cleanup escalation mirrors conflict recovery pattern (Fix/Skip/Abort)
- All exit paths use clear text ("Merge pipeline cancelled.") instead of STOP keywords

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Merge SKILL.md complete with all structured prompts
- Ready for Plan 02 (cleanup SKILL.md) which follows the same patterns established here
- Phase 15 (global STOP replacement) can verify merge skill is already clean

---
*Phase: 13-merge-and-cleanup-skill-prompts*
*Completed: 2026-03-06*
