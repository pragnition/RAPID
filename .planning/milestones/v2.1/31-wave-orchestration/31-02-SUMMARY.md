---
phase: 31-wave-orchestration
plan: 02
subsystem: skills
tags: [plan-set, wave-orchestration, dependency-batching, parallel-planning, agent-interleaving]

# Dependency graph
requires:
  - phase: 31-wave-orchestration
    provides: wave-analyzer agent for LLM-based wave dependency detection, plan-set display stage
  - phase: 30-plan-verifier
    provides: plan verifier agent for FAIL gate in pipeline
  - phase: 27.1-skill-to-agent-overhaul
    provides: agent spawn-by-name pattern used for all 5 agent types
  - phase: 28-workflow-clarity
    provides: next-step print-only pattern (no AskUserQuestion at end)
provides:
  - /rapid:plan-set skill for set-level wave planning orchestration
  - Single-command multi-wave planning with dependency-aware batching
  - Interleaved parallel dispatch pattern for Claude Code sub-sub-agent constraint
affects: [31-03-execute-auto-advance, wave-plan-skill-coexistence]

# Tech tracking
tech-stack:
  added: []
  patterns: [set-level-orchestration, interleaved-parallel-dispatch, bfs-level-batching, fail-fast-precondition, smart-re-entry, chain-stop-on-cancel]

key-files:
  created:
    - skills/plan-set/SKILL.md
  modified: []

key-decisions:
  - "Plan-set replicates wave-plan pipeline inline (skills cannot invoke skills)"
  - "Interleaved parallel dispatch pattern: spawn same pipeline step for all waves in batch simultaneously, not one orchestrator per wave (no sub-sub-agents)"
  - "BFS-level batching from wave-analyzer dependency edges for parallel/sequential grouping"
  - "Fail fast on pending waves: abort immediately with undiscussed wave list"
  - "Re-entry skips analyzer: already-planned waves are fixed, remaining discussing waves run as sequential batch"
  - "Chain-stop on cancel: user cancel at any wave FAIL gate stops entire chain, partial progress saved"

patterns-established:
  - "Set-level skill orchestration: iterates waves in dependency-ordered batches with full pipeline per wave"
  - "Interleaved parallel dispatch: spawn same agent type for multiple waves simultaneously, wait, proceed to next type"
  - "Graceful degradation: research failure does not block planning, job planner failure does not block verification"

requirements-completed: [WAVE-01, WAVE-02, WAVE-03]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 31 Plan 02: Plan-Set Skill Summary

**Set-level wave planning orchestrator with dependency-aware BFS batching, interleaved parallel agent dispatch, and full wave-plan pipeline per wave**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T05:55:35Z
- **Completed:** 2026-03-10T05:58:44Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created complete /rapid:plan-set skill (604 lines) as MCP skill with frontmatter and allowed-tools
- Full pipeline per wave: research -> wave-plan -> job-plans -> verify -> validate -> transition (Steps 4a-4j)
- Wave analyzer integration for 2+ waves with BFS-level batching from dependency edges
- Interleaved parallel dispatch pattern for Claude Code sub-sub-agent constraint workaround
- Fail-fast precondition: aborts if any wave is pending with undiscussed wave list
- Smart re-entry: skips already-planned waves, only plans remaining discussing waves
- Chain-stop behavior: cancel at any FAIL gate stops entire chain with partial progress saved

## Task Commits

Each task was committed atomically:

1. **Task 1: Create plan-set SKILL.md with full orchestration pipeline** - `a5bb0d4` (feat)

## Files Created/Modified
- `skills/plan-set/SKILL.md` - Full set-level wave planning orchestrator skill: resolve set, validate preconditions, spawn wave-analyzer, BFS batch grouping, per-wave pipeline (5 agent types), error handling, commit and next-step output

## Decisions Made
- Plan-set replicates wave-plan pipeline inline rather than invoking wave-plan skill (Claude Code skills cannot call other skills)
- Interleaved parallel dispatch chosen over one-agent-per-wave pattern due to sub-sub-agent constraint
- BFS-level batching algorithm implemented inline in Bash/Node (same algorithm as dag.cjs assignWaves but not imported since it is a module)
- On re-entry, analyzer is skipped entirely -- remaining discussing waves treated as sequential batch to avoid stale dependency info
- AskUserQuestion reserved only for FAIL verdict gates and contract violation gates (Phase 28 pattern)
- Deferred state transition: wave enters planning only after verification and contract validation pass (Phase 30 pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan-set skill ready for user invocation via `/rapid:plan-set <set-id>`
- Wave-analyzer agent (from Plan 01) ready to be spawned by plan-set for dependency detection
- Plan 03 (execute auto-advance) can proceed to modify execute skill

---
*Phase: 31-wave-orchestration*
*Completed: 2026-03-10*
