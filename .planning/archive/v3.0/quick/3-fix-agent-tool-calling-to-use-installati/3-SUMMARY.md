---
phase: quick-3
plan: 01
subsystem: infra
tags: [portability, agent-modules, env-var, rapid-tools]

requires:
  - phase: 09.1-01
    provides: RAPID_TOOLS env var pattern established in skills
provides:
  - Portable CLI paths in core agent modules (state-access, context-loading)
affects: [agent-assembly, executor-agents]

tech-stack:
  added: []
  patterns: [RAPID_TOOLS env var with ~/RAPID fallback in core modules]

key-files:
  created: []
  modified:
    - src/modules/core/core-state-access.md
    - src/modules/core/core-context-loading.md

key-decisions:
  - "Used tilde ~/RAPID fallback per CLAUDE.md convention (not $HOME)"

patterns-established:
  - "RAPID_TOOLS env var pattern now consistent across skills AND core agent modules"

requirements-completed: [QUICK-3]

duration: 1min
completed: 2026-03-05
---

# Quick Task 3: Fix Agent Tool Calling to Use Installation Path

**Replaced 6 hardcoded relative rapid-tools.cjs paths in core agent modules with RAPID_TOOLS env var and ~/RAPID fallback**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-05T08:52:55Z
- **Completed:** 2026-03-05T08:53:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- All 5 executable CLI commands in core-state-access.md now use portable RAPID_TOOLS env var pattern
- Context loading guidance in core-context-loading.md updated with full portable invocation
- Zero bare `node src/bin/rapid-tools.cjs` references remain in src/modules/

## Task Commits

Each task was committed atomically:

1. **Task 1: Update core-state-access.md CLI commands to use portable paths** - `6104d86` (fix)
2. **Task 2: Update core-context-loading.md CLI reference to use portable path** - `1a497a9` (fix)

## Files Created/Modified
- `src/modules/core/core-state-access.md` - 5 CLI commands + 1 prose reference updated to RAPID_TOOLS pattern
- `src/modules/core/core-context-loading.md` - 1 CLI reference updated to full portable invocation

## Decisions Made
- Used tilde ~/RAPID fallback per CLAUDE.md convention (not $HOME)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All agent core modules now use portable paths, consistent with skills updated in phase 09.1
- No blockers

---
*Quick Task: 3*
*Completed: 2026-03-05*
