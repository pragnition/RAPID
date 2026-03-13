---
phase: 10-init-and-context-skill-prompts
plan: 01
subsystem: ui
tags: [askuserquestion, skill-prompts, init, structured-prompts]

requires:
  - phase: 09.2-setup-script-and-rapid-tools-paths
    provides: "RAPID_TOOLS env loading and .env fallback pattern"
provides:
  - "Init SKILL.md with structured AskUserQuestion prompts for all decision gates"
  - "Brownfield detection step (Step 3.5) with auto-trigger to /rapid:context"
affects: [10-02, context-skill]

tech-stack:
  added: []
  patterns: [AskUserQuestion-structured-prompts, consequence-focused-descriptions, brownfield-auto-trigger]

key-files:
  created: []
  modified:
    - skills/init/SKILL.md

key-decisions:
  - "Team size mapped to integers: Solo=1, Small=3, Medium=5, Large=6"
  - "Brownfield auto-trigger skips context confirmation (implicit consent from init choice)"
  - "Greenfield case shows text note only, no AskUserQuestion prompt"

patterns-established:
  - "AskUserQuestion with consequence-focused option descriptions for all decision gates"
  - "Auto-triggering related skills based on user choices in prior steps"

requirements-completed: [PROMPT-01, PROMPT-02, PROMPT-03]

duration: 1min
completed: 2026-03-05
---

# Phase 10 Plan 01: Init Skill Structured Prompts Summary

**Replaced all freeform init decision gates with structured AskUserQuestion prompts: existing project (Reinitialize/Upgrade/Cancel), brownfield detection, project name with directory default, and team size presets**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-05T16:30:30Z
- **Completed:** 2026-03-05T16:31:47Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Rewrote init SKILL.md with AskUserQuestion at all 4 decision gates (existing project, brownfield, project name, team size)
- Added new Step 3.5 for brownfield detection using `context detect` CLI with auto-trigger to `/rapid:context`
- All option descriptions are consequence-focused (explain what happens, not just labels)
- Project name defaults to detected directory name via AskUserQuestion with "Other" fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AskUserQuestion to init SKILL.md and rewrite all decision gates** - `4de7ffb` (feat)

**Plan metadata:** _(pending final commit)_

## Files Created/Modified
- `skills/init/SKILL.md` - Init skill with structured AskUserQuestion prompts for all decision gates

## Decisions Made
- Team size integers: Solo=1, Small=3, Medium=5, Large=6 (maps preset labels to scaffold --team-size arg)
- Brownfield auto-trigger: after scaffold completes, context skill runs without re-asking confirmation
- Greenfield (no source code): text note only, no prompt -- avoids unnecessary interaction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Init SKILL.md is complete with all structured prompts
- Ready for Plan 02 (context SKILL.md prompt updates)
- Brownfield auto-trigger pattern established for context skill to honor

---
*Phase: 10-init-and-context-skill-prompts*
*Completed: 2026-03-05*
