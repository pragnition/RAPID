# Phase 16: State Machine Foundation - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Hierarchical JSON state tracking (project > milestone > set > wave > job) with validated transitions, crash recovery, and structured inter-agent output format. This phase creates the state foundation that all subsequent v2.0 phases build on. No migration from v1.0 STATE.md — clean break, STATE.json is the only format.

</domain>

<decisions>
## Implementation Decisions

### State schema design
- Deeply nested hierarchy: project.milestones[].sets[].waves[].jobs[]
- Job-level state includes: id, status, startedAt, completedAt, commitSha, artifacts[]
- DAG remains separate file (DAG.json) — state references it by convention, not embedded
- Schema validated with Zod (proven pattern from gsd_merge_agent state schemas)
- STATE.json lives at .planning/STATE.json

### Transition rules
- Hard error on invalid transitions — no warnings-only mode, no permissive fallback
- Distinct state machines per entity level:
  - Set: pending > planning > executing > reviewing > merging > complete
  - Wave: pending > discussing > planning > executing > reconciling > complete
  - Job: pending > executing > complete | failed
- Failed states can retry (failed > executing), complete is terminal
- Parent state auto-derived from children (e.g., wave status computed from job statuses)
  - All pending = parent pending
  - Any executing = parent executing
  - All complete = parent complete
  - Any failed + none executing = parent failed

### Migration & coexistence
- No migration — assume no one is using the old version yet
- STATE.json is the only state format, clean break
- state.cjs (Markdown-based) will be replaced entirely by the new module

### Crash recovery
- Atomic rename pattern: write STATE.json.tmp, then fs.renameSync to STATE.json
- lock.cjs reused as-is for concurrent access protection
- Git-based recovery for corruption — STATE.json committed to git, restore via checkout
- /rapid:status should detect corruption and offer "Restore from last commit?"
- STATE.json.tmp gitignored to prevent accidental commits

### Commit frequency
- Auto-commit STATE.json at workflow boundaries (job complete/fail, wave transitions, set status changes)
- NOT committed on intermediate progress updates (reduces noise)

### Claude's Discretion
- Exact Zod schema field names and optional vs required decisions
- Internal helper function design for state reads/writes
- Whether to use a class or functional module pattern
- Exact error message wording for invalid transitions

</decisions>

<specifics>
## Specific Ideas

- Hand-rolled state machine (~50 lines per entity), not XState — already decided in STATE.md
- gsd_merge_agent/schemas/state.ts is a good reference for Zod schema patterns (PhaseStatus enum, nested objects with defaults)
- The transition preview format (showing valid transitions from current state) should be in error messages

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lock.cjs`: proper-lockfile based locking with stale detection — reuse directly for STATE.json writes
- `dag.cjs`: toposort, assignWaves, createDAG, validateDAG — extend for Sets/Waves/Jobs DAG computation
- `returns.cjs`: structured RAPID:RETURN protocol — existing inter-agent output format to build on

### Established Patterns
- Lock-protected writes: acquireLock/release with try/finally (state.cjs pattern)
- Zod schemas: gsd_merge_agent uses z.object/z.enum/z.array with .default() and .optional() extensively
- JSON + Markdown dual format: returns.cjs generates both (precedent for structured output)

### Integration Points
- New `state-machine.cjs` replaces `state.cjs` — consumers updated in Phase 17 (adapter layer)
- DAG.json read by state machine for dependency ordering but produced by planning engine
- .planning/STATE.json is the canonical state file, committed to git at workflow boundaries
- .planning/.gitignore needs STATE.json.tmp entry

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-state-machine-foundation*
*Context gathered: 2026-03-06*
