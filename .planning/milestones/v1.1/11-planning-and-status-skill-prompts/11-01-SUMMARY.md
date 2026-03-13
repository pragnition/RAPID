---
phase: 11-planning-and-status-skill-prompts
plan: 01
subsystem: ui
tags: [AskUserQuestion, structured-prompts, skill-prompts, plan, assumptions]

# Dependency graph
requires:
  - phase: 10-init-and-context-skill-prompts
    provides: AskUserQuestion pattern with consequence-focused descriptions and context-based headers
provides:
  - Plan SKILL.md with AskUserQuestion at Steps 1 and 4
  - Assumptions SKILL.md with AskUserQuestion at Steps 1 and 4
  - STOP keyword removal from plan and assumptions skills
affects: [15-global-stop-replacement, 12-execute-skill-prompts]

# Tech tracking
tech-stack:
  added: []
  patterns: [structured-then-freeform for open-ended follow-up, second-gate pattern for preview-then-decide, dynamic set count threshold for AskUserQuestion vs text list]

key-files:
  created: []
  modified:
    - skills/plan/SKILL.md
    - skills/assumptions/SKILL.md

key-decisions:
  - "View current in plan skill leads to second AskUserQuestion gate (Re-plan/Cancel) instead of dead end"
  - "Assumptions set selection uses AskUserQuestion for <=4 sets, numbered text list for >4"
  - "Approve option in plan Step 4 includes inline set summary in description"

patterns-established:
  - "Second-gate pattern: preview action followed by decide action (View then Re-plan/Cancel)"
  - "Dynamic prompt type: AskUserQuestion for small option counts, text list for large counts (threshold: 4)"

requirements-completed: [PROMPT-04, PROMPT-12]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 11 Plan 01: Plan and Assumptions Skill Prompts Summary

**Plan and assumptions skills rewritten with AskUserQuestion at all decision gates, replacing numbered text options and STOP keywords**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T01:02:17Z
- **Completed:** 2026-03-06T01:05:13Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Plan SKILL.md uses AskUserQuestion at Step 1 (existing sets: Re-plan/View/Cancel) and Step 4 (proposal: Approve/Modify/Cancel)
- Assumptions SKILL.md uses AskUserQuestion at Step 1 (set selection for <=4 sets with Other fallback) and Step 4 (feedback: Correct/Note/Looks good)
- All STOP keywords removed from both files with clear exit text replacements
- View option in plan skill leads to second decision gate instead of dead end
- Looks good in assumptions leads to Review another set/Done continuation gate

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite plan SKILL.md with AskUserQuestion at Steps 1 and 4** - `2c14066` (feat)
2. **Task 2: Rewrite assumptions SKILL.md with AskUserQuestion at Steps 1 and 4** - `e2a7e09` (feat)

## Files Created/Modified
- `skills/plan/SKILL.md` - Added AskUserQuestion to frontmatter, structured prompts at Steps 1 and 4, removed STOP keywords
- `skills/assumptions/SKILL.md` - Added AskUserQuestion to frontmatter, structured prompts at Steps 1 and 4, removed STOP keywords

## Decisions Made
- View current in plan skill leads to second AskUserQuestion gate (Re-plan/Cancel) instead of dead end -- ensures developer can act after previewing without re-running command
- Assumptions set selection uses AskUserQuestion for <=4 sets, numbered text list for >4 -- avoids overwhelming structured prompt with too many options
- Plan Step 4 Approve description includes inline set summary built from proposal data -- developer sees what they are approving without scrolling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan and assumptions skills have consistent AskUserQuestion patterns matching Phase 10's init/context pattern
- Status skill (11-02) is next for next-action routing prompts
- Phase 15 global STOP replacement can skip plan and assumptions skills (already done)

---
*Phase: 11-planning-and-status-skill-prompts*
*Completed: 2026-03-06*
