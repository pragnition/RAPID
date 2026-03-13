---
phase: 32-review-efficiency
plan: 02
subsystem: review
tags: [concern-scoping, scoper, skill-restructure, deduplication, pipeline]

# Dependency graph
requires:
  - phase: 32-review-efficiency
    provides: scoper agent, ScoperOutput schema, scopeByConcern, deduplicateFindings, ReviewIssue concern field
  - phase: 29.1-make-the-reviewing-set-based-instead-of-wave-based
    provides: set-level review pipeline, directory chunking, ReviewIssue schema
provides:
  - Concern-based scoping pipeline in review SKILL.md (Step 2.5 scoper insertion)
  - Per-concern agent dispatch for unit test and bug hunt stages
  - Merge and dedup step (4b.2.5) before adversarial pipeline
  - Concern tags in REVIEW-BUGS.md and logged issues
  - Cross-cutting fallback with 50% threshold
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [concern-scoped agent dispatch, pre-adversarial deduplication, concern-tagged findings]

key-files:
  created: []
  modified:
    - skills/review/SKILL.md

key-decisions:
  - "Step 2.5 placement preserves all existing step numbers (2.5 between 2 and 3)"
  - "Concern-scoped path comes first in Step 4a/4b with fallback path retaining original chunk logic"
  - "Step 4b.2.5 merges+deduplicates BEFORE adversarial pipeline (one advocate + one judge on merged set)"
  - "UAT (Step 4c) explicitly unchanged -- full scope, never concern-scoped"

patterns-established:
  - "Concern-scoped dispatch: per-concern agents with CON-N-F-N finding IDs"
  - "Pre-adversarial deduplication: merge all hunter findings before advocate/judge"
  - "Dual-path stage logic: useConcernScoping true/false gates concern vs chunk dispatch"

requirements-completed: [REV-01, REV-02, REV-03, REV-04]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 32 Plan 02: Review SKILL.md Concern-Based Scoping Summary

**Review pipeline restructured with Step 2.5 scoper insertion, per-concern unit test and bug hunt dispatch, merge+dedup before adversarial pipeline, and concern-tagged findings**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T07:01:51Z
- **Completed:** 2026-03-10T07:04:10Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Inserted Step 2.5 (concern-based scoping) spawning rapid-scoper agent on full file list with cross-cutting fallback check
- Restructured Step 4a (unit test) with concern-scoped dispatch path and fallback to existing chunk logic
- Restructured Step 4b.2 (bug hunt) with per-concern hunters using CON-N-F-N finding IDs
- Added Step 4b.2.5 (merge and deduplicate findings before adversarial pipeline)
- Added concern tag to REVIEW-BUGS.md findings and logged issues
- Updated Important Notes with concern-scoping, deduplication, and concern tag documentation
- UAT (Step 4c) verified unchanged
- SKILL.md grew from 808 to 933 lines (above 850 minimum)

## Task Commits

Each task was committed atomically:

1. **Task 1: Insert Step 2.5 and restructure concern-scoped stages in SKILL.md** - `c8c79f1` (feat)

## Files Created/Modified
- `skills/review/SKILL.md` - Restructured review pipeline with concern-based scoping (933 lines)

## Decisions Made
- Step 2.5 placement preserves all existing step numbers (sub-step numbering per Phase 30 precedent)
- Concern-scoped path documented first in Step 4a/4b with fallback path retaining original chunk logic
- Step 4b.2.5 merges+deduplicates BEFORE adversarial pipeline (saves tokens with one advocate + one judge)
- UAT (Step 4c) explicitly unchanged per user decision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Review pipeline fully restructured with concern-based scoping
- All infrastructure from Plan 01 (scoper agent, scopeByConcern, deduplicateFindings) now wired into SKILL.md
- Phase 32 complete -- both plans delivered

## Self-Check: PASSED

- FOUND: skills/review/SKILL.md (933 lines, min 850)
- FOUND: 32-02-SUMMARY.md
- FOUND: commit c8c79f1
- Step 2.5: 3 references
- rapid-scoper: 1 reference
- 4b.2.5: 1 reference
- useConcernScoping: 7 references
- CON- finding IDs: 2 references

---
*Phase: 32-review-efficiency*
*Completed: 2026-03-10*
