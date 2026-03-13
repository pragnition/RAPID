---
phase: 22-review-module
plan: 04
subsystem: review
tags: [review-pipeline, skill, orchestrator, adversarial, unit-test, bug-hunt, uat, subagent]

# Dependency graph
requires:
  - phase: 22-review-module
    plan: 01
    provides: "review.cjs library with scopeWaveForReview, logIssue, loadSetIssues, updateIssueStatus, generateReviewSummary"
  - phase: 22-review-module
    plan: 02
    provides: "6 agent role modules (unit-tester, bug-hunter, devils-advocate, judge, bugfix, uat) registered in assembler"
  - phase: 22-review-module
    plan: 03
    provides: "handleReview CLI with 6 subcommands (scope, log-issue, list-issues, update-issue, lean, summary)"
provides:
  - "/rapid:review SKILL.md orchestrating full unit test > bug hunt > UAT pipeline with 3-cycle bugfix iteration"
  - "User-controlled stage selection via AskUserQuestion at invocation"
  - "Per-wave REVIEW-*.md artifacts and consolidated REVIEW-SUMMARY.md generation"
  - "DEFERRED ruling HITL with evidence presentation from both hunter and advocate"
affects: [23-merge-pipeline, execute-skill, review-module]

# Tech tracking
tech-stack:
  added: []
  patterns: ["5-step skill orchestration (env, selection, wave processing, summary, next action)", "3-stage review pipeline with user-controlled stage selection", "3-cycle bugfix iteration with scope narrowing for re-hunts", "DEFERRED ruling HITL via AskUserQuestion with evidence from both sides"]

key-files:
  created: ["skills/review/SKILL.md"]
  modified: []

key-decisions:
  - "13 AskUserQuestion gates for user control at every decision point in the review pipeline"
  - "3-cycle bugfix iteration limit with scope narrowing to prevent infinite loops"
  - "DEFERRED judge rulings present hunter and advocate evidence side-by-side for developer arbitration"
  - "UAT browser automation tool is configurable via config.json or AskUserQuestion fallback"

patterns-established:
  - "Review pipeline pattern: unit test > bug hunt > UAT with each stage independently selectable"
  - "Adversarial 3-agent pattern: hunter finds, advocate challenges, judge rules -- not a rubber stamp"
  - "Scope narrowing pattern: re-hunt cycles only examine files modified by previous bugfix cycle"
  - "Test plan approval pattern: CHECKPOINT flow for test plan review before execution"

requirements-completed: [REVW-01, REVW-02, REVW-03, REVW-04, REVW-05, REVW-06, REVW-07, REVW-08, REVW-09]

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 22 Plan 04: Review SKILL.md Summary

**/rapid:review orchestrator with 789-line SKILL.md implementing 3-stage pipeline (unit test, adversarial bug hunt, UAT) with 13 AskUserQuestion gates and 3-cycle bugfix iteration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T12:21:00Z
- **Completed:** 2026-03-08T12:26:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1

## Accomplishments
- Created 789-line /rapid:review SKILL.md with 5-step orchestration: environment resolution, stage selection, per-wave processing, summary generation, and next action routing
- Implemented 3-stage review pipeline: unit testing (with test plan approval gate), adversarial bug hunting (hunter/advocate/judge with 3-cycle iteration), and UAT (with browser automation)
- Added 13 AskUserQuestion gates covering stage selection, test plan approval, DEFERRED ruling arbitration, UAT plan approval, human verification steps, and post-review next actions
- Human verification confirmed all phase 22 components work together: library tests pass, 6 role files exist, CLI subcommands registered, lean review integrated, SKILL.md complete

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /rapid:review SKILL.md with full pipeline orchestration** - `73ac256` (feat)
2. **Task 2: Verify complete review module across all plans** - checkpoint:human-verify (approved)

## Files Created/Modified
- `skills/review/SKILL.md` - Full /rapid:review orchestrator with 3-stage pipeline, 13 AskUserQuestion gates, 3-cycle bugfix iteration, and per-wave artifact generation (789 lines)

## Decisions Made
- 13 AskUserQuestion gates placed at every decision point: stage selection, test plan approval (unit test + UAT), DEFERRED ruling arbitration, UAT step verification, and post-review next actions
- 3-cycle bugfix iteration limit with scope narrowing -- re-hunt cycles only scan files modified by the previous bugfix, preventing infinite loops
- DEFERRED judge rulings present evidence from both hunter and advocate side-by-side, requiring developer to choose Accept/Dismiss/Defer
- UAT browser automation tool configurable via .planning/config.json `browserAutomation` field, with AskUserQuestion fallback offering Chrome DevTools MCP, Playwright MCP, or skip

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 22 (Review Module) is now fully complete with all 4 plans executed
- /rapid:review skill ready for use after execution completes on any set
- All 9 REVW requirements satisfied across plans 01-04
- Phase 23 (Merge Pipeline) can proceed -- review gate is in place for pre-merge quality assurance

## Self-Check: PASSED

- FOUND: skills/review/SKILL.md
- FOUND: .planning/phases/22-review-module/22-04-SUMMARY.md
- FOUND: 73ac256 (task 1 commit)

---
*Phase: 22-review-module*
*Completed: 2026-03-08*
