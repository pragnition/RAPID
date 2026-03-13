# Phase 33: Merge State Schema & Infrastructure - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend MERGE-STATE.json schema with subagent delegation tracking fields (agentPhase1 for per-set merger, agentPhase2 for per-conflict resolvers) and build three helper functions: prepareMergerContext() for launch payload assembly, parseSetMergerReturn() for structured result validation with default-to-BLOCKED safety, and compressResult() for one-line status entries. Schema changes must be backward-compatible with v2.1-era MERGE-STATE.json files. This phase builds infrastructure only — actual subagent dispatching is Phase 34.

</domain>

<decisions>
## Implementation Decisions

### agentPhase tracking fields
- agentPhase1 (per-set merger) and agentPhase2 (per-conflict resolver) are simple status enums, not objects
- agentPhase1 values: `idle` / `spawned` / `done` / `failed` — 4-state minimal lifecycle
- agentPhase2 values: same enum pattern, to be refined in Phase 35
- Both fields are nested inside the 'resolving' main status — they only have meaning when status='resolving'
- Both fields are `.optional()` in Zod for backward compatibility — user manages migration of existing files

### Context assembly (prepareMergerContext)
- Pure function: takes structured data as input, returns assembled string — caller responsible for loading
- Token budget: 1000 tokens (increased from original 500) — 8 sets = ~8K orchestrator context
- Payload style: file path pointers + 1-2 line inline summaries per file (e.g., "CONTRACT.json (3 interfaces, 2 with changes)")
- Subagent reads full file details itself from worktree — payload is a launch briefing, not complete context

### Compressed result format (compressResult)
- Structured JSON object: `{ setId, status, conflictCounts: { L1, L2, L3, L4, L5 }, resolutionCounts: { T1, T2, T3, escalated }, commitSha }`
- Retains per-level detection counts and per-tier resolution counts — enough for the final summary table in SKILL.md Step 8
- Token estimation: heuristic `JSON.stringify(result).length / 4` — simple chars/4 approximation
- Target: ~100 tokens per set, verified against 8-set budget (~800 tokens total)
- Persisted: compressed result written to MERGE-STATE.json as a `compressedResult` field, in addition to orchestrator in-memory retention — enables mid-pipeline restart

### Return validation (parseSetMergerReturn)
- Uses generic RAPID:RETURN parsing (existing `parseReturn()`) for the wrapper, then loose checks on `data.semantic_conflicts`, `data.resolutions`, `data.escalations` — not a strict merge-specific Zod schema
- Default-to-BLOCKED: missing or malformed returns produce `{ status: 'BLOCKED', reason: '<error description>' }` — error reason only, no raw output excerpt
- CHECKPOINT is treated as a valid intermediate state — allows merger to save progress if it runs out of context on large sets
- File location: Claude's discretion (merge.cjs or returns.cjs based on module cohesion)

### Claude's Discretion
- Exact agentPhase2 enum values (refined when Phase 35 requirements are clearer)
- Whether parseSetMergerReturn() lives in merge.cjs or returns.cjs
- Internal structure of the 1000-token launch payload template
- Exact fields in the compressedResult JSON shape
- Test structure and coverage for the three helper functions

</decisions>

<specifics>
## Specific Ideas

- The launch payload is a briefing, not a dump — pointers + summaries let the subagent prioritize what to read in full
- compressedResult should be usable directly as input to the final merge summary (SKILL.md Step 8) without re-reading full MERGE-STATE
- agentPhase fields should feel like a natural extension of the existing detection/resolution/bisection optional sections in MERGE-STATE

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `merge.cjs`: MergeStateSchema (Zod), writeMergeState/readMergeState/updateMergeState — extend with new optional fields
- `returns.cjs`: parseReturn(), validateHandoff(), ReturnSchemas — parseSetMergerReturn wraps parseReturn with merge-specific loose checks
- `role-merger.md`: defines RAPID:RETURN data schema with `semantic_conflicts`, `resolutions`, `escalations`, `all_resolved` — the shape parseSetMergerReturn validates loosely

### Established Patterns
- Zod schemas with `.optional()` for backward-compatible extensions (see state-schemas.cjs)
- Pure functions for testability (contract.cjs: compileContract, generateContractTest)
- RAPID:RETURN protocol: `<!-- RAPID:RETURN {...} -->` parsed by returns.cjs
- Per-set state files in `.planning/sets/{setName}/MERGE-STATE.json`

### Integration Points
- `src/lib/merge.cjs` — extend MergeStateSchema, add new exported functions
- `skills/merge/SKILL.md` — Phase 34 will modify to call prepareMergerContext/parseSetMergerReturn (not this phase)
- `src/lib/returns.cjs` — potential location for parseSetMergerReturn if Claude chooses
- `src/lib/merge.test.cjs` — extend with tests for new functions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-merge-state-schema-infrastructure*
*Context gathered: 2026-03-10*
