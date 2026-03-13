---
phase: 22-review-module
plan: 02
subsystem: agents
tags: [review, agent-roles, assembler, adversarial-pipeline, unit-test, bug-hunt, uat]

# Dependency graph
requires:
  - phase: 22-01
    provides: review library plan with pipeline orchestration patterns
provides:
  - 6 review agent role modules (unit-tester, bug-hunter, devils-advocate, judge, bugfix, uat)
  - Assembler registration for all 6 roles with enforced tool permissions
  - Test coverage for role registration and tool permission enforcement
affects: [22-03, 22-04, review-skill]

# Tech tracking
tech-stack:
  added: []
  patterns: [adversarial-review-pipeline, role-based-tool-permissions, RAPID-RETURN-structured-output]

key-files:
  created:
    - src/modules/roles/role-unit-tester.md
    - src/modules/roles/role-bug-hunter.md
    - src/modules/roles/role-devils-advocate.md
    - src/modules/roles/role-judge.md
    - src/modules/roles/role-bugfix.md
    - src/modules/roles/role-uat.md
  modified:
    - src/lib/assembler.cjs
    - src/lib/assembler.test.cjs

key-decisions:
  - "devils-advocate is strictly read-only (Read, Grep, Glob) -- no Write, Bash, or Edit to prevent file modifications"
  - "judge has Write for REVIEW-BUGS.md but no Bash -- rulings are based on static analysis only"
  - "unit-tester and uat use CHECKPOINT-then-COMPLETE flow for test plan approval before execution"
  - "bug-hunter has Bash for linting but no Write/Edit -- analysis is read-only with optional lint commands"

patterns-established:
  - "Adversarial review pipeline: hunter -> devils-advocate -> judge with structured evidence passing"
  - "CHECKPOINT-based approval gates: unit-tester and uat emit CHECKPOINT for plan approval before execution"
  - "Role-based tool permission enforcement via assembler ROLE_TOOLS"
  - "Review artifact writing pattern: judge writes REVIEW-BUGS.md, uat writes REVIEW-UAT.md"

requirements-completed: [REVW-02, REVW-03, REVW-04, REVW-05, REVW-06, REVW-07, REVW-08, REVW-09]

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 22 Plan 02: Review Agent Roles Summary

**6 adversarial review agent role modules with assembler registration and enforced tool permissions (read-only devils-advocate, write-capable judge/uat, full-access bugfix)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T12:03:32Z
- **Completed:** 2026-03-08T12:09:02Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Created 6 review agent role modules with substantive prompts (572 lines total across all roles)
- Registered all 6 roles in assembler.cjs with correct, security-enforced tool permissions
- Added 9 new tests verifying role registration, tool permissions, and frontmatter generation
- Updated existing listModules tests to reflect the full 25-role inventory

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 6 review agent role modules** - `f05da11` (feat)
2. **Task 2: Register 6 new roles in assembler.cjs with correct tool permissions** - `3721d09` (feat)

## Files Created/Modified

- `src/modules/roles/role-unit-tester.md` - Test plan generation, node:test execution, CHECKPOINT approval flow
- `src/modules/roles/role-bug-hunter.md` - Static analysis with risk/confidence scoring on scoped files
- `src/modules/roles/role-devils-advocate.md` - Adversarial challenge with code evidence (read-only, no Write/Bash)
- `src/modules/roles/role-judge.md` - ACCEPTED/DISMISSED/DEFERRED rulings, writes REVIEW-BUGS.md
- `src/modules/roles/role-bugfix.md` - Targeted atomic fixes with regression verification
- `src/modules/roles/role-uat.md` - Automated/human step classification, browser automation, REVIEW-UAT.md
- `src/lib/assembler.cjs` - Added 6 roles to ROLE_TOOLS and ROLE_DESCRIPTIONS (9 -> 15 registered roles)
- `src/lib/assembler.test.cjs` - Updated role counts (6 -> 25 on disk), added 9 review role tests

## Decisions Made

- devils-advocate is strictly read-only (Read, Grep, Glob only) -- enforced at the tool permission level to prevent any file modifications or command execution
- judge has Write for REVIEW-BUGS.md but no Bash -- rulings are based purely on static code analysis and evidence provided by hunter/advocate
- unit-tester and uat both use a CHECKPOINT-then-COMPLETE two-phase flow: plan generation first (CHECKPOINT for approval), then execution (COMPLETE with results)
- bug-hunter gets Bash for optional linting commands but no Write/Edit -- analysis is read-only

## Deviations from Plan

None - plan executed exactly as written.

## Pre-existing Issues Logged

- `assembler.test.cjs`: "assembled planner agent is under 15KB" test was already failing (planner is 20.6KB). Not caused by this plan's changes. Logged to `deferred-items.md`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 review agent roles are ready for use by the review SKILL.md orchestrator (Plan 03/04)
- Assembler can generate valid frontmatter for all review roles
- Tool permissions are enforced: the review pipeline's security model (read-only advocate, write-limited judge) is established at the infrastructure level

---
*Phase: 22-review-module*
*Completed: 2026-03-08*
