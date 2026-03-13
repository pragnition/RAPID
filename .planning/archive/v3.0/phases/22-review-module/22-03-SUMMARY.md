---
phase: 22-review-module
plan: 03
subsystem: review
tags: [cli, review-pipeline, lean-review, fix-issues, commonjs]

# Dependency graph
requires:
  - phase: 22-review-module
    plan: 01
    provides: "review.cjs library with scopeWaveForReview, logIssue, loadSetIssues, updateIssueStatus, generateReviewSummary"
provides:
  - "handleReview CLI function with 6 subcommands (scope, log-issue, list-issues, update-issue, lean, summary)"
  - "Lean wave-level review integrated into execute SKILL.md after reconciliation"
  - "--fix-issues flag support in execute SKILL.md for batch issue fixing"
affects: [22-review-module, review-skill, execute-skill]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CLI subcommand dispatch to review.cjs library", "Lean review artifact verification from JOB-PLAN.md", "AskUserQuestion for non-auto-fixable issues"]

key-files:
  created: []
  modified: ["src/bin/rapid-tools.cjs", "skills/execute/SKILL.md"]

key-decisions:
  - "Lean review verifies planned artifacts by parsing JOB-PLAN.md 'Files to Create/Modify' tables and checking file existence in worktree"
  - "Missing artifacts are logged as issues with type='artifact', source='lean-review' -- auto-fix not attempted for missing files"
  - "--fix-issues check placed after set-id parsing (Step 0b.1) to have set-id available for issue queries"

patterns-established:
  - "Review CLI pattern: handleReview mirrors handleExecute/handleWavePlan with subcommand switch and JSON output"
  - "Lean review integration: Step 3g.1 between reconciliation and wave status transition"
  - "Issue fix flow: --fix-issues flag diverts execution into bugfix agent dispatch with AskUserQuestion for scope selection"

requirements-completed: [REVW-01, REVW-07]

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 22 Plan 03: Review CLI & Lean Integration Summary

**Review CLI subcommands with 6 operations in rapid-tools.cjs, lean wave-level review after reconciliation, and --fix-issues batch-fix support in execute SKILL.md**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T12:12:45Z
- **Completed:** 2026-03-08T12:15:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added handleReview function to rapid-tools.cjs with 6 subcommands: scope, log-issue, list-issues, update-issue, lean, summary
- Integrated lean wave-level review into execute SKILL.md as Step 3g.1 with auto-fix and AskUserQuestion for unresolvable issues
- Added --fix-issues flag support at Step 0b.1 in execute SKILL.md with bugfix agent dispatch and issue status updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Add handleReview CLI subcommands to rapid-tools.cjs** - `dd3f7d9` (feat)
2. **Task 2: Integrate lean review into execute SKILL.md and add --fix-issues flag** - `f9f3087` (feat)

## Files Created/Modified
- `src/bin/rapid-tools.cjs` - Added handleReview function with 6 subcommands, review USAGE entries, and main switch case routing (+202 lines)
- `skills/execute/SKILL.md` - Added Step 3g.1 lean wave review and Step 0b.1 --fix-issues flag support (+57 lines)

## Decisions Made
- Lean review verifies planned artifacts by parsing JOB-PLAN.md "Files to Create/Modify" tables and checking file existence in worktree
- Missing artifacts are logged as issues with type='artifact', source='lean-review' -- auto-fix not attempted for missing files (per CONTEXT.md: auto-fix limited to verifiable issues only)
- --fix-issues check placed after set-id parsing (Step 0b.1) to have set-id available for issue queries
- Used output() function for JSON output in handleReview consistent with newer subcommands (detect-mode, list-jobs)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Review CLI subcommands ready for consumption by review SKILL.md pipeline orchestration (Plan 04)
- Lean review integrated into execute skill, runs automatically after wave reconciliation
- --fix-issues flag provides batch-fix pathway for accumulated review issues
- All review.cjs library tests still passing (unchanged)

## Self-Check: PASSED

- FOUND: src/bin/rapid-tools.cjs
- FOUND: skills/execute/SKILL.md
- FOUND: .planning/phases/22-review-module/22-03-SUMMARY.md
- FOUND: dd3f7d9 (task 1 commit)
- FOUND: f9f3087 (task 2 commit)

---
*Phase: 22-review-module*
*Completed: 2026-03-08*
