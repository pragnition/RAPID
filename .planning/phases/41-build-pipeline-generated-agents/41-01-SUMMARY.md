---
phase: 41-build-pipeline-generated-agents
plan: 01
subsystem: build-pipeline
tags: [build-agents, skip-generation, stub-prompts, role-pruning, agent-registry]

# Dependency graph
requires:
  - phase: 39-tool-doc-injection-wiring
    provides: ROLE_CORE_MAP, assembleAgentPrompt, getToolDocsForRole, ROLE_TOOL_MAP
provides:
  - SKIP_GENERATION array for 5 core agents
  - assembleStubPrompt() producing partial agent files with Phase 42 TODO
  - Pruned registries (26 roles down from 31)
  - Hybrid build pipeline producing 21 generated + 5 stub agent files
affects: [42-core-agent-hand-writing, 41-02-research-ux-role]

# Tech tracking
tech-stack:
  added: []
  patterns: [hybrid-build-pipeline, stub-generation, skip-generation-array]

key-files:
  created:
    - src/lib/prune-v2-roles.test.cjs
  modified:
    - src/bin/rapid-tools.cjs
    - src/lib/tool-docs.cjs
    - src/lib/build-agents.test.cjs
    - src/lib/tool-docs.test.cjs
    - src/lib/teams.test.cjs

key-decisions:
  - "SKIP_GENERATION is a static array, not derived from ROLE_CORE_MAP metadata"
  - "Core stubs include frontmatter + core modules + tools + placeholder role -- ready for Phase 42 hand-writing"
  - "Build summary format: 'Built N agents (M core skipped)' for clear output"

patterns-established:
  - "Hybrid build: SKIP_GENERATION array controls which agents get stub vs full generation"
  - "STUB comment prefix distinguishes stubs from generated agents in file header"
  - "assembleStubPrompt reuses generateFrontmatter and core module loading from assembleAgentPrompt"

requirements-completed: [AGENT-03, AGENT-04]

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 41 Plan 01: Hybrid Build Pipeline Summary

**Hybrid agent build pipeline with SKIP_GENERATION for 5 core agents producing stubs, plus complete pruning of 5 obsolete v2 wave/job roles from all registries**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T09:14:11Z
- **Completed:** 2026-03-12T09:19:55Z
- **Tasks:** 2
- **Files modified:** 12 (6 modified, 5 role files deleted, 5 agent files deleted, 1 test created)

## Accomplishments
- Pruned 5 obsolete v2 roles (wave-researcher, wave-planner, job-planner, job-executor, wave-analyzer) from all 4 registry maps in rapid-tools.cjs, ROLE_TOOL_MAP in tool-docs.cjs, and deleted 10 associated files
- Implemented SKIP_GENERATION array with assembleStubPrompt() function producing core agent stubs with frontmatter, core modules, tools, placeholder role, and returns
- Build pipeline now produces 21 generated + 5 stub = 26 total agent files with clear "Built 21 agents (5 core skipped)" summary
- All 72 tests pass across 4 test files (build-agents, tool-docs, teams, prune-v2-roles)

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: Prune 5 v2 roles from all registries and delete files**
   - `1a5a873` (test: add failing tests for v2 role pruning)
   - `2251e76` (feat: prune 5 v2 roles from all registries and delete files)

2. **Task 2: Implement SKIP_GENERATION, stub generation, and update all tests**
   - `bdad966` (test: add failing tests for SKIP_GENERATION and stub format)
   - `4b0555e` (feat: implement SKIP_GENERATION with stub generation for core agents)

## Files Created/Modified
- `src/bin/rapid-tools.cjs` - Added SKIP_GENERATION array, assembleStubPrompt(), updated build loop, removed 5 v2 role entries from all 4 registry maps
- `src/lib/tool-docs.cjs` - Removed 4 v2 roles from ROLE_TOOL_MAP, removed wave-researcher from exclusion comment
- `src/lib/build-agents.test.cjs` - Updated from 31 to 26 roles, added SKIP_GENERATION stub tests, updated file count expectations
- `src/lib/tool-docs.test.cjs` - Updated expectedRoles and excluded lists (removed 4+1 v2 entries)
- `src/lib/teams.test.cjs` - Removed job-executor agent registration test block
- `src/lib/prune-v2-roles.test.cjs` - New test file verifying v2 role removal from all registries
- Deleted: 5 role modules from `src/modules/roles/` and 5 agent files from `agents/`

## Decisions Made
- SKIP_GENERATION is a static array rather than metadata-derived, keeping it explicit and easy to audit
- Core stubs include all sections except role content (which gets a Phase 42 TODO placeholder), making them structurally valid for testing
- Build summary format explicitly shows generated count and skipped count for clarity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Build pipeline ready for Plan 02 (research-ux role addition, taking generated count from 21 to 22)
- Phase 42 can begin hand-writing core agent role sections (stubs have TODO placeholders)
- All registries are clean of v2 artifacts

---
*Phase: 41-build-pipeline-generated-agents*
*Completed: 2026-03-12*
