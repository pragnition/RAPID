# CONTEXT: data-integrity

**Set:** data-integrity
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
Fix three independent data integrity issues in the RAPID execution pipeline:
1. **Resume deduplication** -- `handleResume()` (line 1613) and `execute resume` (line 1917) in rapid-tools.cjs contain ~90% identical logic. Extract into a single `resumeSet()` function in execute.cjs.
2. **State mutation bypass** -- `execute update-phase` (line 1834) mutates only the worktree registry without routing through `withStateTransaction()` for STATE.json. Audit and guard.
3. **MERGE-STATE transaction wrapper** -- `writeMergeState()` and `updateMergeState()` in merge.cjs use raw `fs.writeFileSync()` without transactional guarantees. Create `withMergeStateTransaction()`.
</domain>

<decisions>
## Implementation Decisions

### resumeSet() Extraction Strategy
- **Claude's Discretion**: Extract a single `resumeSet(cwd, setId, options?)` into execute.cjs accepting an options object with `{ infoOnly, pauseCycles }` to cover both callers' unique needs. Both CLI entry points become thin wrappers delegating to `resumeSet()`. JSON output shape should be unified -- the superset of both current shapes -- since both paths are internal (consumed by skills/agents we control). The top-level `resume` case stays as a convenience alias that delegates to `resumeSet()`.

### update-phase STATE.json Scope
- **Claude's Discretion**: Keep update-phase registry-only. Do NOT add STATE.json mutation -- the registry tracks worktree lifecycle phase (Executing/Paused/Done) while STATE.json tracks set status (pending/discussed/planned/executing/executed/merged), and these are intentionally separate state domains. Add a validation guard that warns if the registry phase change implies a STATE.json inconsistency, but do not auto-mutate. Audit all callers to confirm no caller expects STATE.json side effects.

### MERGE-STATE Locking Strategy
- **Claude's Discretion**: Reuse the existing `acquireLock()` infrastructure from state-machine.cjs with a per-set lock name (`merge-state-${setId}`) -- keeps one locking mechanism, DRY. Use atomic write (tmp + rename) matching `withStateTransaction()` for consistency. Unlocked reads are acceptable since merge operations are single-threaded per set.

### Call Site Migration Scope
- **Claude's Discretion**: `withMergeStateTransaction()` should use `writeMergeState()` internally as a private helper (it already does Zod validation). Migrate ALL call sites in this set -- both direct `writeMergeState` calls (lines 1698, 1708) and `updateMergeState` calls (line 1698) -- to use the transaction wrapper. Keep `writeMergeState`/`updateMergeState` exported for now but mark with JSDoc deprecation notes pointing to `withMergeStateTransaction()`.
</decisions>

<specifics>
## Specific Ideas
- Contract tests capturing exact JSON output shape before resume refactor, ensuring `resumeSet()` returns identical structure
- Grep-based invariant tests ensuring no direct `fs.writeFileSync` for MERGE-STATE outside the transaction wrapper
- Behavioral tests confirming no duplicate resume logic exists in rapid-tools.cjs
</specifics>

<code_context>
## Existing Code Insights

### withStateTransaction() pattern (state-machine.cjs:157)
- acquireLock(cwd, 'state') -> readState -> mutationFn(state) -> Zod validate -> atomic write (tmp+rename) -> release
- This is the pattern to mirror for withMergeStateTransaction()

### Resume paths divergence
- `handleResume()` (line 1613): supports `--info-only`, reads stateContext, outputs `{ resumed, setName, handoff, stateContext, definitionPath, contractPath, worktreePath, pauseCycles }`
- `execute resume` (line 1917): reads pauseCycles from registry, reads stateContext, outputs `{ resumed, setName, handoff, stateContext, definitionPath, contractPath, pauseCycles }`
- Both do: validate registry entry is Paused, validate HANDOFF.md exists, parse handoff, read STATE.json context, update registry to Executing

### writeMergeState/updateMergeState (merge.cjs)
- `writeMergeState(cwd, setId, mergeState)` -- Zod validates, writes to .planning/sets/{setId}/MERGE-STATE.json
- `updateMergeState(cwd, setId, updates)` -- reads current, shallow merges, calls writeMergeState
- Call sites at lines 1698 and 1708 in merge pipeline hot path

### Locking infrastructure
- `acquireLock(cwd, lockName)` in state-machine.cjs uses proper-lockfile
- Returns a release function for try/finally pattern
- Already supports named locks -- can use `merge-state-${setId}` without new infra
</code_context>

<deferred>
## Deferred Ideas
- Full STATE.json <-> registry synchronization (separate set, broader scope)
- Lock contention monitoring/telemetry
- Removing the top-level `resume` CLI command entirely (would need skill updates)
</deferred>
