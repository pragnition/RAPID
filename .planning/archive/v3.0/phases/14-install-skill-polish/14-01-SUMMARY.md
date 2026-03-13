---
phase: 14-install-skill-polish
plan: 01
subsystem: install
tags: [skill, shell-detection, AskUserQuestion, setup, bootstrap]

# Dependency graph
requires:
  - phase: 09.2-setup-script
    provides: setup.sh bootstrap script and .env persistence pattern
  - phase: 13-merge-cleanup
    provides: AskUserQuestion v1.1 patterns (retry/skip/cancel, next-action routing)
provides:
  - Non-interactive setup.sh (prereqs, deps, validate, env, register)
  - Install skill with shell detection, AskUserQuestion config selection, auto-source, fallback guidance
  - Post-install next-action routing via AskUserQuestion
affects: [15-global-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [shell-aware-auto-source, non-interactive-bootstrap-with-skill-interaction]

key-files:
  created: []
  modified:
    - setup.sh
    - skills/install/SKILL.md

key-decisions:
  - "Moved all user interaction from setup.sh into SKILL.md using AskUserQuestion"
  - "setup.sh reduced from 5 interactive steps to 4 non-interactive steps"
  - "Auto-source uses shell-specific subshell (fish -c, bash -c, zsh -c) with prereqs verify in same call"

patterns-established:
  - "Non-interactive bootstrap + skill-owned interaction: setup scripts do automation, SKILL.md handles all user decisions"
  - "Shell-aware auto-source: source config and verify in single Bash call using shell-specific invocation"

requirements-completed: [INST-01, INST-02, INST-03]

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 14 Plan 01: Install Skill Polish Summary

**Install skill rewritten with shell detection via $SHELL, AskUserQuestion config selection, shell-aware auto-source with prereqs verification, and fallback guidance; setup.sh stripped to non-interactive 4-step bootstrap**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T04:20:41Z
- **Completed:** 2026-03-06T04:22:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Stripped setup.sh from 257 lines with interactive menu to 100-line non-interactive bootstrap
- Rewrote install SKILL.md with 7 AskUserQuestion prompts covering setup failure, shell config selection, auto-source failure, prereqs failure, and post-install routing
- Shell detection reads $SHELL and recommends matching config file
- Auto-source verifies via shell-specific subshell + node prereqs in single Bash call
- Fallback guidance shows exact source command when auto-source fails

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip setup.sh to non-interactive bootstrap** - `0356f48` (refactor)
2. **Task 2: Rewrite install SKILL.md with shell detection, AskUserQuestion prompts, auto-source, and fallback guidance** - `75ef887` (feat)

## Files Created/Modified
- `setup.sh` - Non-interactive bootstrap: prereqs, deps, validate, env+register (4 steps)
- `skills/install/SKILL.md` - Full install skill with shell detection, AskUserQuestion prompts, auto-source, fallback

## Decisions Made
- Moved all user-facing interaction from setup.sh into SKILL.md using AskUserQuestion
- setup.sh consolidated .env writing and plugin registration into single step [4/4]
- Auto-source uses shell-specific invocation (fish -c, bash -c, zsh -c) with prereqs verification in same call

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Install skill fully polished with v1.1 AskUserQuestion patterns
- Ready for Phase 15 (global polish) which handles remaining STOP keyword replacement and progress indicators

---
*Phase: 14-install-skill-polish*
*Completed: 2026-03-06*
