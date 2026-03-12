# Phase 35: Adaptive Conflict Resolution - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Mid-confidence merge escalations (0.3-0.8 confidence) are resolved by dedicated rapid-conflict-resolver agents spawned by the orchestrator, instead of going directly to the human. Conflicts below 0.3 or involving API-signature changes go to a human decision gate. The resolver applies its resolution directly to the worktree. MERGE-STATE.json agentPhase2 tracks per-conflict resolver dispatch status. This phase modifies SKILL.md Step 3e, creates a new role module, and extends the schema. Core merge delegation (Phase 34) and documentation (Phases 36-37) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Confidence band routing
- Lower bound: 0.3 (hard cutoff) — conflicts below 0.3 go straight to human
- Upper bound: 0.8 (raised from 0.7) — resolver also tackles set-merger's 0.7-0.8 band as a second opinion
- Resolver band: 0.3-0.8 confidence — these get dispatched to rapid-conflict-resolver agents
- API-signature changes: always go to human decision gate regardless of confidence (API rule wins over confidence band)
- When both mid-confidence AND API-signature change: API rule wins — human gets direction gate
- Human direction gate for API conflicts: user sees "Keep Set A / Keep Set B / Merge both" — system executes the chosen direction automatically

### Resolver agent behavior
- One agent per conflict (not batched) — single conflict focus, parallelizable
- New role module: `role-conflict-resolver.md` — separate from set-merger and merger roles
- Deeper analysis than set-merger: reads full file history, both sets' CONTEXT.md/plans, cross-set contract implications
- Multiple resolution strategies: tries 2-3 different resolution approaches, scores each, picks best
- Resolver applies its resolution directly to the worktree (not propose-only)
- Returns structured RAPID:RETURN with resolution details and confidence score

### Resolution acceptance
- Auto-accept threshold: 0.7 — resolver confidence >= 0.7 means resolution is accepted (already applied to worktree)
- Below 0.7: escalate to human with resolver's deeper analysis + proposed resolution
- Human presentation: show diff of proposed code change + options (Accept / Reject / Edit manually)
- If resolver fails or returns BLOCKED: escalate to human immediately (no retry — resolver is already second-pass)

### Parallelism & state tracking
- Multiple resolvers run in parallel for the same set (each conflict is independent)
- agentPhase2 enum values: idle / spawned / done / failed (same pattern as agentPhase1)
- agentPhase2 shape: object map `{ [conflictId]: 'idle'|'spawned'|'done'|'failed' }` — tracks each conflict independently (changed from single enum to per-conflict map)
- No retry for failed resolvers — escalate to human immediately

### Claude's Discretion
- Exact role-conflict-resolver.md prompt structure and analysis instructions
- How conflict IDs are generated (file path hash, sequential, etc.)
- Resolver's RAPID:RETURN data schema (fields for resolution strategies tried, selected strategy, confidence)
- How "show diff" is presented to the user (inline code block, file reference, etc.)
- Whether to run the programmatic gate after resolver applies changes
- Exact SKILL.md Step 3e restructuring flow

</decisions>

<specifics>
## Specific Ideas

- The resolver is the "second opinion" agent — it gets more time and focus per conflict than the set-merger's inline T3/T4 analysis
- For API-signature conflicts, the human decides direction (Keep A / Keep B / Merge both) but never has to manually edit code — the system executes their choice
- Raising the upper bound to 0.8 means set-merger's "mid-confidence but probably right" resolutions get a dedicated second look
- Failed resolvers don't retry because they're already a second pass — if even a focused deep-analysis agent can't be confident, the conflict is genuinely hard and needs human judgment

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `merge.cjs`: applyAgentResolutions() with configurable confidenceThreshold — can be adapted for resolver results
- `merge.cjs`: agentPhase2 field already in MergeStateSchema (Phase 33) — needs shape change from enum to object map
- `merge.cjs`: prepareMergerContext(), parseSetMergerReturn(), compressResult() — pattern for building similar resolver context/return helpers
- `role-set-merger.md`: confidence scoring rubric and T4 escalation rules — resolver role will extend these patterns
- `returns.cjs`: parseReturn() — wrapper pattern for resolver-specific return validation

### Established Patterns
- Agent roles defined as `.md` files in `src/modules/roles/` with structured prompts
- RAPID:RETURN protocol for structured agent output (COMPLETE/CHECKPOINT/BLOCKED)
- Build-agents pipeline generates agent files from role modules
- AskUserQuestion at every human-facing decision gate
- agentPhase1 lifecycle pattern: idle → spawned → done/failed

### Integration Points
- NEW: `src/modules/roles/role-conflict-resolver.md` — new role for rapid-conflict-resolver agent
- NEW: `agents/rapid-conflict-resolver.md` — generated by build-agents from role module
- MODIFIED: `skills/merge/SKILL.md` Step 3e — replace direct-to-human escalation with resolver dispatch + routing logic
- MODIFIED: `src/lib/merge.cjs` — change agentPhase2 from enum to object map in schema
- CONSUMED: `src/bin/rapid-tools.cjs` — merge subcommands called by resolver agent

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-adaptive-conflict-resolution*
*Context gathered: 2026-03-11*
