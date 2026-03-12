# Phase 34: Core Merge Subagent Delegation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the merge SKILL.md to dispatch isolated rapid-set-merger subagents per set instead of running detection/resolution inline. The orchestrator dispatches one subagent per set, collects structured RAPID:RETURN results, handles partial failures with auto-retry, and discards per-set context after collection (retaining only compressedResult). Phase 33 infrastructure (prepareMergerContext, parseSetMergerReturn, compressResult, agentPhase1) is consumed here. Adaptive conflict resolution (Phase 35) and documentation (Phases 36-37) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Subagent scope & boundary
- Create a NEW `rapid-set-merger` agent (separate from existing `rapid-merger`)
- rapid-set-merger = orchestrator-lite per set: runs L1-L4 detection via CLI, T1-T2 resolution via CLI, L5 semantic detection + T3/T4 resolution INLINE (absorbs rapid-merger's role instructions for semantic analysis)
- Subagent does NOT execute the actual git merge — orchestrator keeps git merge execution (Step 6)
- Subagent does NOT handle user-facing escalations — T4 escalations returned to orchestrator in RAPID:RETURN data for user interaction (subagents have no AskUserQuestion capability)
- Subagent runs programmatic gate via CLI before returning results
- Existing rapid-merger agent remains unchanged (potential reuse in Phase 35)

### Failure & recovery flow
- When a set's subagent returns BLOCKED (or default-to-BLOCKED from malformed output), independent sets in the wave CONTINUE merging unblocked
- Blocked sets surface to user after the wave with recovery options: Retry / Skip / Abort (no "Resolve manually" option)
- CHECKPOINT returns get auto-retried ONCE with checkpoint data — if second attempt also checkpoints, surface to user
- Max 2 retries per set (BLOCKED or CHECKPOINT) — after 2 failed attempts, auto-escalate to user with skip/abort options
- Retry counter tracked in orchestrator memory (or MERGE-STATE agentPhase1 transitions)

### Context handoff protocol
- Launch briefing via prepareMergerContext (~1000 tokens) is sufficient — subagent reads full file details from worktree via CLI calls
- After collecting return, orchestrator retains only compressResult (~100 tokens per set) — full detection/resolution details stay in MERGE-STATE.json
- Full RAPID:RETURN data stored in MERGE-STATE.json only (no separate log file) — MERGE-STATE is the debugging artifact
- Trust subagent's MERGE-STATE writes — no cross-verification between RAPID:RETURN and MERGE-STATE. If MERGE-STATE is inconsistent, treat as malformed (BLOCKED via parseSetMergerReturn)

### SKILL.md restructuring
- Replace Steps 3-5 (detect, resolve, programmatic gate) with a single dispatch step per set
- Fast path for zero-conflict sets: run `git merge-tree --write-tree` before dispatching subagent. If merge-tree shows no conflicts, skip subagent entirely and go straight to git merge
- Step 6 (git merge execute) stays in orchestrator
- Step 8 summary uses in-memory compressedResult data instead of re-reading MERGE-STATE per set — faster and keeps orchestrator lean
- agentPhase1 transitions: idle → spawned (before dispatch) → done/failed (after return)

### Claude's Discretion
- rapid-set-merger agent prompt structure and role module design
- How L5 semantic analysis instructions are incorporated into the rapid-set-merger role (inline vs reference)
- Exact SKILL.md step numbering and flow after restructuring
- How checkpoint data is passed on auto-retry (inline vs file reference)
- Whether `git merge-tree` check is a CLI tool command or inline in SKILL.md
- agentPhase1 transition mechanics (CLI call vs direct MERGE-STATE update)

</decisions>

<specifics>
## Specific Ideas

- The subagent is an "orchestrator-lite" — it runs the same CLI pipeline the old SKILL.md ran inline, but in isolated context. The main orchestrator never sees per-file conflict details.
- Fast path (merge-tree clean) should be the common case for well-isolated sets — subagent overhead only kicks in when there are actual conflicts.
- The subagent absorbs rapid-merger's semantic analysis role instructions inline. It's not spawning a sub-subagent (Claude Code hard constraint: no nesting). It IS the merger when semantic analysis is needed.
- compressedResult in memory → final summary table. No re-reading MERGE-STATE at pipeline end.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `merge.cjs`: prepareMergerContext(), parseSetMergerReturn(), compressResult() — Phase 33 infrastructure consumed directly
- `merge.cjs`: MergeStateSchema with agentPhase1 field — tracks subagent lifecycle
- `merge.cjs`: detect(), resolve(), review() — CLI-callable functions the subagent invokes
- `agents/rapid-merger.md`: existing agent with L5+T3/T4 role instructions — semantic analysis role to absorb into rapid-set-merger
- `returns.cjs`: parseReturn() — wrapped by parseSetMergerReturn for merge-specific validation
- `rapid-tools.cjs`: merge subcommands (detect, resolve, review, execute, update-status, merge-state)

### Established Patterns
- Agent roles defined as `.md` files in `src/modules/roles/` with structured prompts
- RAPID:RETURN protocol for structured agent output (COMPLETE/CHECKPOINT/BLOCKED)
- AskUserQuestion at every user-facing decision gate
- agentPhase1 lifecycle: idle → spawned → done/failed (4-state enum)
- Build-agents pipeline generates agent files from role modules

### Integration Points
- NEW: `src/modules/roles/role-set-merger.md` — new role for rapid-set-merger agent
- NEW: `agents/rapid-set-merger.md` — generated by build-agents from role module
- MODIFIED: `skills/merge/SKILL.md` — replace Steps 3-5 with dispatch + fast path logic
- CONSUMED: `src/lib/merge.cjs` — prepareMergerContext, parseSetMergerReturn, compressResult
- CONSUMED: `src/bin/rapid-tools.cjs` — merge subcommands called by subagent

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-core-merge-subagent-delegation*
*Context gathered: 2026-03-10*
