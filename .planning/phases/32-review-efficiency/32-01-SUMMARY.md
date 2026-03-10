---
phase: 32-review-efficiency
plan: 01
subsystem: review
tags: [scoper, concern-scoping, levenshtein, deduplication, zod, agents]

# Dependency graph
requires:
  - phase: 27.1-skill-to-agent-overhaul
    provides: build-agents infrastructure, ROLE_MAPS pattern, agent assembly pipeline
  - phase: 29.1-make-the-reviewing-set-based-instead-of-wave-based
    provides: ReviewIssue schema, chunkByDirectory, review.cjs library functions
provides:
  - rapid-scoper agent with LLM-determined concern categorization
  - ScoperOutput Zod schema for structured scoper output validation
  - scopeByConcern() for concern-based file grouping with cross-cutting inclusion
  - deduplicateFindings() for fuzzy-match finding deduplication with severity tiebreaking
  - normalizedLevenshtein() for string similarity scoring
  - ReviewIssue concern field for concern-tagged findings
affects: [32-review-efficiency plan 02 (SKILL.md restructuring)]

# Tech tracking
tech-stack:
  added: []
  patterns: [concern-based scoping, normalized Levenshtein deduplication, 50% cross-cutting fallback threshold]

key-files:
  created:
    - src/modules/roles/role-scoper.md
    - agents/rapid-scoper.md
  modified:
    - src/bin/rapid-tools.cjs
    - src/lib/build-agents.test.cjs
    - src/lib/review.cjs
    - src/lib/review.test.cjs

key-decisions:
  - "Scoper uses core-identity + core-returns only (no state-access, git, or context-loading)"
  - "Scoper color is blue (planning/analysis group) matching wave-analyzer"
  - "normalizedLevenshtein uses standard DP matrix -- no external dependency"
  - "50% cross-cutting boundary is strict greater-than (exactly 50% does NOT trigger fallback)"

patterns-established:
  - "Concern-based scoping: scopeByConcern merges cross-cutting files into every concern group"
  - "Fuzzy deduplication: same file + normalizedLevenshtein >= 0.7 = duplicate"
  - "Severity tiebreaking: critical > high > medium > low; equal severity keeps longer evidence"

requirements-completed: [REV-01, REV-02, REV-03, REV-04]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 32 Plan 01: Scoper Agent Infrastructure Summary

**Scoper agent with LLM-determined concern categorization, scopeByConcern with 50% cross-cutting fallback, and Levenshtein-based finding deduplication**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T06:54:27Z
- **Completed:** 2026-03-10T06:58:56Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created scoper role module with LLM-determined (not fixed taxonomy) concern categorization instructions
- Registered scoper in all 4 ROLE_MAPS, rebuilt 29 agents including rapid-scoper
- Implemented scopeByConcern with cross-cutting file inclusion in all groups and 50% fallback threshold
- Implemented deduplicateFindings with normalized Levenshtein similarity and severity-based tiebreaking
- Added ScoperOutput Zod schema and optional concern field on ReviewIssue
- 95 tests passing (87 review + 8 build-agents)

## Task Commits

Each task was committed atomically (TDD: test + feat):

1. **Task 1: Scoper role module + agent registration + rebuild agents**
   - `a1898a8` (test: add failing tests for scoper agent registration)
   - `5ab1feb` (feat: add scoper agent with role module and registration)

2. **Task 2: Concern-scoping functions + deduplication + tests in review.cjs**
   - `692aca4` (test: add failing tests for concern-scoping and deduplication)
   - `0f7cbf0` (feat: add concern-scoping functions and deduplication to review.cjs)

## Files Created/Modified
- `src/modules/roles/role-scoper.md` - Scoper LLM agent role module with categorization instructions (79 lines)
- `agents/rapid-scoper.md` - Generated scoper agent file with correct frontmatter
- `src/bin/rapid-tools.cjs` - Scoper entries in ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_CORE_MAP
- `src/lib/build-agents.test.cjs` - Updated from 28 to 29 roles, added scoper to EXPECTED_ROLE_CORE_MAP
- `src/lib/review.cjs` - Added ScoperOutput schema, concern field, normalizedLevenshtein, scopeByConcern, deduplicateFindings
- `src/lib/review.test.cjs` - 20 new tests for all new functions and schemas (1244 lines total)

## Decisions Made
- Scoper uses core-identity + core-returns only (no state-access, git, or context-loading) -- read-only analysis agent
- Scoper color is blue (planning/analysis group) matching wave-analyzer and other analysis agents
- normalizedLevenshtein uses standard DP matrix -- no external dependency needed for ~30 lines of code
- 50% cross-cutting boundary uses strict greater-than (exactly 50% does NOT trigger fallback, per conservative approach)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Scoper agent infrastructure complete, ready for SKILL.md integration (plan 02)
- All building blocks available: scopeByConcern for concern grouping, deduplicateFindings for merge step
- 29 agents generated and verified

## Self-Check: PASSED

- All 7 files exist
- All 4 commits found (a1898a8, 5ab1feb, 692aca4, 0f7cbf0)
- role-scoper.md: 79 lines (min 30)
- review.test.cjs: 1244 lines (min 900)
- All 4 exports present (scopeByConcern, deduplicateFindings, normalizedLevenshtein, ScoperOutput)
- 29 agent files generated

---
*Phase: 32-review-efficiency*
*Completed: 2026-03-10*
