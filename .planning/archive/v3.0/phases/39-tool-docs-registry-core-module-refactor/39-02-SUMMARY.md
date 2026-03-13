---
phase: 39-tool-docs-registry-core-module-refactor
plan: 02
subsystem: agent-build
tags: [xml-schema, prompt-engineering, core-modules, consolidation]

# Dependency graph
requires:
  - phase: none
    provides: existing 5 core modules
provides:
  - consolidated 3-module core set (identity, conventions, returns)
  - PROMPT-SCHEMA.md defining XML tag vocabulary for agent prompts
affects: [39-03-build-pipeline, phase-41-full-agent-rebuild]

# Tech tracking
tech-stack:
  added: []
  patterns: [xml-tagged-prompt-assembly, 6-tag-schema]

key-files:
  created:
    - src/modules/core/core-conventions.md
    - src/modules/PROMPT-SCHEMA.md
  modified:
    - src/modules/core/core-identity.md

key-decisions:
  - "Condensed context loading and state access into 5 bullet points each in core-identity.md"
  - "PROMPT-SCHEMA.md documents 6 tags (3 required + 3 optional) with explicit assembly order"
  - "core-conventions.md is identical content to core-git.md (renamed only)"

patterns-established:
  - "XML tag vocabulary: identity, role, returns (required); conventions, tools, context (optional)"
  - "Assembly order: frontmatter, identity, conventions, tools, role, returns"

requirements-completed: [AGENT-02]

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 39 Plan 02: Core Module Consolidation Summary

**Consolidated 5 core modules to 3 and created PROMPT-SCHEMA.md defining 6-tag XML prompt vocabulary with assembly order**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T06:26:17Z
- **Completed:** 2026-03-12T06:28:21Z
- **Tasks:** 1
- **Files modified:** 5 (1 modified, 2 created, 3 deleted)

## Accomplishments
- Expanded core-identity.md with Tool Invocation (RAPID_TOOLS setup), Context Loading (5 condensed rules), and State Rules (5 condensed rules)
- Created core-conventions.md with git commit conventions (content from core-git.md)
- Created PROMPT-SCHEMA.md documenting 6 XML tags (identity, role, returns required; conventions, tools, context optional) with assembly order
- Deleted 3 retired modules: core-context-loading.md, core-state-access.md, core-git.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Consolidate core modules and create PROMPT-SCHEMA.md** - `992a35a` (feat)

## Files Created/Modified
- `src/modules/core/core-identity.md` - Expanded with Tool Invocation, Context Loading, State Rules sections (~3,400 bytes total)
- `src/modules/core/core-conventions.md` - Git commit conventions (renamed from core-git.md, 1,056 bytes)
- `src/modules/PROMPT-SCHEMA.md` - XML prompt schema reference (2,398 bytes)
- `src/modules/core/core-context-loading.md` - Deleted (absorbed into core-identity.md)
- `src/modules/core/core-state-access.md` - Deleted (CLI commands become tool docs, rules absorbed into core-identity.md)
- `src/modules/core/core-git.md` - Deleted (content moved to core-conventions.md)

## Decisions Made
- Condensed context loading guidance from 28 lines (full Loading Strategy + Anti-Patterns sections) to 5 bullet points
- Condensed state access rules from 43 lines (full CLI Commands + Rules sections) to 5 bullet points -- CLI command reference moved to tool docs (Plan 01)
- PROMPT-SCHEMA.md documents conventions as a 6th tag beyond the 5 specified in CONTEXT.md, matching the actual assembly requirements
- core-conventions.md uses identical content to core-git.md (git detected it as a rename)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core modules consolidated and ready for build pipeline integration (Plan 03)
- PROMPT-SCHEMA.md provides the tag reference for build-time validation
- Build pipeline (ROLE_CORE_MAP, assembleAgentPrompt) will be temporarily broken until Plan 03 updates references
- This is expected per the plan: "The build-agents command will be temporarily broken until Plan 03 runs"

## Self-Check: PASSED

- FOUND: src/modules/core/core-identity.md
- FOUND: src/modules/core/core-conventions.md
- FOUND: src/modules/PROMPT-SCHEMA.md
- CONFIRMED DELETED: core-context-loading.md
- CONFIRMED DELETED: core-state-access.md
- CONFIRMED DELETED: core-git.md
- FOUND COMMIT: 992a35a
- FOUND: 39-02-SUMMARY.md

---
*Phase: 39-tool-docs-registry-core-module-refactor*
*Completed: 2026-03-12*
