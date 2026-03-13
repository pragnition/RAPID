# Phase 23: Merge Pipeline - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Completed sets merge back to main with deep multi-level conflict detection, intelligent resolution, and recovery from failures. This phase delivers the Mark II merge pipeline: 5-level conflict detection (textual, structural, dependency, API, semantic), 4-tier resolution cascade (deterministic, heuristic, AI-assisted, human escalation), DAG-ordered merging, bisection recovery for integration failures, and single-set rollback. The existing v1.0 merge.cjs and SKILL.md are rewritten from scratch.

</domain>

<decisions>
## Implementation Decisions

### Conflict detection architecture
- Multi-pass pipeline: git handles textual (level 1), code-based Node.js functions handle structural/dependency/API (levels 2-4), spawned merger agent handles semantic (level 5)
- Hybrid approach: code-based analysis for deterministic pattern-matching levels, agent-based for intent/behavioral analysis
- All 5 levels run on every merge — no gated escalation, always get the complete picture
- Semantic conflict = both intent divergence (two sets modify related functionality in incompatible ways) AND contract behavioral mismatch (merged code violates interface contracts)
- Semantic agent reads both sets' CONTEXT.md/plans to understand intent, then evaluates merged code against contracts

### Resolution cascade
- **Tier 1 (deterministic):** Auto-resolve all textual non-overlap — whitespace, formatting, non-overlapping additions, and any conflict where changes don't actually overlap logically (different functions, different sections of same file). No user involvement
- **Tier 2 (heuristic):** Claude's discretion on specifics — should use sensible signals like file ownership (OWNERSHIP.json), DAG dependency order, and common conflict patterns (both added to same array, both modified same config key)
- **Tier 3 (AI-assisted):** Merger agent writes resolved code directly and applies it. User sees resolution in merge report but doesn't approve each one individually. Fast flow
- **Tier 4 (human escalation):** Triggered by confidence threshold — tier 3 AI resolution includes a confidence score, below threshold escalates to human. Not limited to semantic conflicts — any failed auto-resolution with low confidence escalates

### Recovery mechanisms
- **Bisection recovery:** Triggers automatically on post-wave integration gate failure. Uses git-based binary search — revert to pre-wave state, re-merge sets in binary search groups, run tests after each to identify minimal breaking set
- **Rollback scope:** Single set revert — revert just the problematic set's merge commit. Dependent sets that merged after stay (may need manual fixing). Simpler and less destructive
- **Rollback confirmation:** Auto-revert for single set (no confirmation needed). If dependent sets would be affected by cascade, ask user first via AskUserQuestion

### Pipeline integration
- **Rewrite merge.cjs** from scratch with all v2.0 capabilities — new functions for 5-level detection, resolution cascade, bisection, rollback. Existing v1.0 functions replaced
- **Rewrite SKILL.md** from scratch to incorporate detection, resolution, bisection, and rollback as native pipeline steps. Coherent flow matching the new library
- **New role-merger.md** agent role for conflict detection + resolution. role-reviewer.md stays for code review (quality judgment). Clear separation: reviewer judges quality, merger handles conflicts
- **Separate MERGE-STATE.json** per set for detailed merge progress tracking. Set status in state machine stays simple ('merging'). Avoids state machine bloat while still tracking detection/resolution/bisection progress

### Claude's Discretion
- Tier 2 heuristic specifics — what patterns to recognize, how to weight ownership vs dependency order
- Confidence threshold value for tier 3 → tier 4 escalation
- MERGE-STATE.json schema and fields
- Bisection binary search implementation details (grouping strategy, test timeout)
- How to detect structural/dependency/API conflicts programmatically (AST vs grep vs hybrid)
- CLI subcommand design for new merge operations
- Merger agent prompt design

</decisions>

<specifics>
## Specific Ideas

- The multi-pass pipeline should feel like a funnel: fast deterministic checks first, progressively more expensive analysis only when needed for detection (though all levels run)
- v1.0's existing functions (runProgrammaticGate, getMergeOrder, mergeSet, runIntegrationTests) contain reusable logic even though merge.cjs is being rewritten — don't lose the patterns
- DAG-ordered merging (MERG-04) already works via getMergeOrder — the rewrite should preserve this capability
- The merger agent is separate from the reviewer agent — reviewer does code quality review (Phase 8 pattern), merger does conflict analysis and resolution
- Post-wave integration gate pattern from v1.0 should be preserved — it's the trigger for bisection recovery

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `merge.cjs`: runProgrammaticGate (contract + test + ownership validation), getMergeOrder (DAG-based), mergeSet (git merge --no-ff), runIntegrationTests — patterns to preserve in rewrite
- `dag.cjs`: getExecutionOrder(), toposort(), assignWaves() — merge ordering works, reuse directly
- `worktree.cjs`: gitExec(), loadRegistry(), detectMainBranch() — git operations foundation
- `contract.cjs`: compileContract(), generateContractTest(), checkOwnership() — programmatic validation gate
- `review.cjs`: scopeWaveForReview(), findDependents(), ReviewIssue schema — dependency analysis patterns
- `state-machine.cjs`: transitionSet() for executing→reviewing→merging transitions
- `state-transitions.cjs`: SET_TRANSITIONS includes reviewing→merging→complete
- `assembler.cjs`: assembleAgent() — register new role-merger agent role
- `returns.cjs`: RAPID:RETURN protocol for structured agent output

### Established Patterns
- Agent roles defined as `.md` files in `src/modules/roles/` with structured prompts
- CLI subcommands in `rapid-tools.cjs` with JSON output for skill consumption
- Structured return protocol (COMPLETE/CHECKPOINT/BLOCKED) for all agents
- AskUserQuestion at every decision gate (13 gates in review module alone)
- Lock-protected atomic writes for STATE.json
- Wave artifacts in `.planning/waves/{setId}/{waveId}/`

### Integration Points
- Rewrite: `src/lib/merge.cjs` — complete rewrite with v2.0 capabilities
- Rewrite: `skills/merge/SKILL.md` — complete rewrite with new pipeline steps
- New: `src/modules/roles/role-merger.md` — conflict detection + resolution agent
- New: MERGE-STATE.json per set in `.planning/sets/{setName}/`
- Modified: `src/bin/rapid-tools.cjs` — new/updated CLI subcommands for merge operations
- Modified: `src/lib/assembler.cjs` — register merger agent role
- Existing: `src/modules/roles/role-reviewer.md` — unchanged, still handles code quality review

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-merge-pipeline*
*Context gathered: 2026-03-08*
