---
phase: 39-tool-docs-registry-core-module-refactor
plan: 01
subsystem: agent-build
tags: [tool-docs, registry, yaml, agent-prompts, cli-docs]

# Dependency graph
requires: []
provides:
  - "TOOL_REGISTRY: 59 CLI command descriptions in compact one-liner format"
  - "ROLE_TOOL_MAP: 18 role-to-command-key mappings"
  - "getToolDocsForRole(): returns YAML string for embedding in agent prompts"
  - "estimateTokens(): character-based token estimation heuristic"
affects: [39-02-core-module-consolidation, 39-03-build-pipeline-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [static-string-registry, role-to-key-mapping, yaml-string-templating]

key-files:
  created:
    - src/lib/tool-docs.cjs
    - src/lib/tool-docs.test.cjs
  modified: []

key-decisions:
  - "59 commands in TOOL_REGISTRY covering all rapid-tools.cjs subcommands"
  - "18 roles in ROLE_TOOL_MAP with curated command sets; 13 roles excluded (no CLI needs)"
  - "Hybrid one-liner format: 'subcommand args -- description' per CONTEXT.md decision"
  - "estimateTokens uses chars/4 heuristic -- no tiktoken dependency"

patterns-established:
  - "Static string registry: TOOL_REGISTRY as plain object of command key -> one-liner description"
  - "Role-to-key mapping: ROLE_TOOL_MAP as explicit hand-curated object"
  - "YAML string rendering: getToolDocsForRole returns '# rapid-tools.cjs commands\\n  key: desc' format"

requirements-completed: [AGENT-05]

# Metrics
duration: 12min
completed: 2026-03-12
---

# Phase 39 Plan 01: Tool Docs Registry Summary

**tool-docs.cjs module with 59-command TOOL_REGISTRY, 18-role ROLE_TOOL_MAP, and YAML rendering via getToolDocsForRole()**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-12T06:26:09Z
- **Completed:** 2026-03-12T06:38:45Z
- **Tasks:** 1 (TDD: RED + GREEN + REFACTOR)
- **Files created:** 2

## Accomplishments
- TOOL_REGISTRY with 59 CLI command entries covering state, lock, planning, execution, merge, worktree, review, resolve, context, init, parse-return, verify, display, and prereqs commands
- ROLE_TOOL_MAP mapping 18 CLI-using roles to their specific command key arrays
- getToolDocsForRole() returning compact YAML strings ready for `<tools>` tag embedding
- estimateTokens() confirming no role exceeds the 1000-token budget
- 25 unit tests covering registry structure, role map integrity, function behavior, token budget, and export completeness

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for tool-docs module** - `efd4e67` (test)
2. **Task 1 GREEN: Implement tool-docs module** - `1c62121` (feat)

_TDD task: RED committed failing tests, GREEN committed passing implementation. No refactor commit needed -- code was clean on first pass._

## Files Created/Modified
- `src/lib/tool-docs.cjs` - TOOL_REGISTRY, ROLE_TOOL_MAP, getToolDocsForRole(), estimateTokens() exports
- `src/lib/tool-docs.test.cjs` - 25 unit tests across 6 test suites

## Decisions Made
- Followed RESEARCH.md recommended initial set for both TOOL_REGISTRY and ROLE_TOOL_MAP exactly
- No additional commands or role mappings beyond research recommendations were needed
- estimateTokens('') returns 0 (Math.ceil(0/4) = 0) -- natural edge case handled by math

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- tool-docs.cjs ready for import by Plan 02 (core module consolidation) and Plan 03 (build pipeline integration)
- getToolDocsForRole() ready for assembleAgentPrompt() injection in Plan 03
- All key_links specified in plan frontmatter validated: `require('../lib/tool-docs.cjs')` pattern ready

## Self-Check: PASSED

- [x] src/lib/tool-docs.cjs exists
- [x] src/lib/tool-docs.test.cjs exists
- [x] 39-01-SUMMARY.md exists
- [x] Commit efd4e67 (RED) found
- [x] Commit 1c62121 (GREEN) found
- [x] All 25 tests pass

---
*Phase: 39-tool-docs-registry-core-module-refactor*
*Completed: 2026-03-12*
