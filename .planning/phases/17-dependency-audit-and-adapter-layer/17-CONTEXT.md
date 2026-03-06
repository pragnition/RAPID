# Phase 17: Dependency Audit and Adapter Layer - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Map all v1.0 lib module coupling to old data structures (STATE.md, flat filesystem conventions) and rewrite state-coupled code to use the new hierarchical STATE.json via state-machine.cjs. No adapter layer -- direct rewrites since there are no current users. Produces a dependency map documenting all module coupling and filesystem path conventions for downstream phases.

</domain>

<decisions>
## Implementation Decisions

### Adapter strategy
- No separate adapter module -- rewrite state-coupled code in each v1.0 module directly to use state-machine.cjs
- V1.0 modules keep their filesystem artifacts (.planning/sets/, .planning/worktrees/, .planning/contracts/) alongside STATE.json -- dual source with STATE.json as authoritative
- State updates are synchronous -- state-machine.cjs transition functions called immediately when modules perform actions (matches lock-protected write pattern from Phase 16)
- All rewritten code uses v2.0 terminology (sets/waves/jobs) consistently -- no backwards-compatible aliases

### Module fate decisions
- **state.cjs**: Delete entirely (and state.test.cjs). Replaced by state-machine.cjs. Clean break, no migration
- **rapid-tools.cjs**: Rewrite CLI state commands to use state-machine.cjs with new hierarchy-aware API (e.g., 'state get set api-set status' instead of 'state get Status')
- **worktree.cjs**: Rewrite state-coupled parts to use state-machine.cjs directly. Full worktree overhaul deferred to Phase 19
- **merge.cjs**: Rewrite state-coupled parts to use state-machine.cjs directly. Full merge overhaul deferred to Phase 23
- **execute.cjs**: Rewrite state-coupled parts to use state-machine.cjs directly. Full execution rewrite in Phase 21
- **plan.cjs**: Rewrite state-coupled parts to use state-machine.cjs directly. Full planning rewrite in Phase 20
- **No-coupling modules** (lock.cjs, prereqs.cjs, stub.cjs, assembler.cjs, core.cjs, verify.cjs, teams.cjs, context.cjs, contract.cjs, dag.cjs, returns.cjs): Documented in dependency map with "no state coupling, no changes needed" note
- Guiding principle: avoid dependencies on old systems. If something might clog the development pipeline, rewrite it rather than adapting around it

### Dependency map format
- Markdown reference doc: DEPENDENCY-MAP.md
- Lives as phase artifact in .planning/phases/17-dependency-audit-and-adapter-layer/
- Documents ALL modules (including uncoupled ones for completeness)
- Includes filesystem path conventions (.planning/ subdirectory layout) and whether they change in v2.0
- Serves as reference for downstream phases 18-23 during their planning

### Test coverage
- Integration tests verifying rewritten modules produce correct STATE.json transitions end-to-end
- Update existing .test.cjs files for each rewritten module (worktree.test.cjs, merge.test.cjs, execute.test.cjs, plan.test.cjs) to test with STATE.json instead of STATE.md
- state.cjs and state.test.cjs deleted as part of this phase
- rapid-tools.cjs CLI state commands tested against new hierarchy-aware API

### Claude's Discretion
- Exact order of module rewrites (dependency-aware sequencing)
- Internal refactoring decisions within each module's state-coupled sections
- How much of each module's internals to touch vs. leave for dedicated phase rewrites
- DEPENDENCY-MAP.md internal structure and level of detail per module

</decisions>

<specifics>
## Specific Ideas

- "No current users, so don't worry about breaking the old system -- just rewrite directly"
- The existing state-machine.cjs exports (readState, writeState, findSet, findWave, findJob, transitionJob, transitionWave, transitionSet) are the target API for all rewrites
- dag.cjs and returns.cjs were already extended additively in Phase 16 -- no changes needed here

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `state-machine.cjs`: Full hierarchical state management with readState/writeState/find*/transition* functions
- `state-schemas.cjs`: Zod schemas for ProjectState validation
- `state-transitions.cjs`: Validated transition maps for Set/Wave/Job status enums
- `lock.cjs`: Lock-protected writes, reused by state-machine.cjs already

### Established Patterns
- Lock-protected atomic writes: acquireLock/release with try/finally (used by state-machine.cjs)
- Atomic rename: write .tmp then fs.renameSync (state-machine.cjs pattern)
- Zod validation at boundaries (state-schemas.cjs)
- Each module has co-located .test.cjs file

### Integration Points
- `rapid-tools.cjs:194` -- only consumer of state.cjs, needs to switch to state-machine.cjs
- `worktree.cjs` -- reads/writes .planning/worktrees/ registry, .planning/sets/OWNERSHIP.json
- `merge.cjs` -- reads .planning/sets/{name}/, .planning/sets/OWNERSHIP.json, .planning/sets/DAG.json
- `execute.cjs` -- reads .planning/sets/{name}/DEFINITION.md, CONTRACT.json, OWNERSHIP.json
- `plan.cjs` -- creates .planning/sets/, .planning/contracts/, writes DAG.json, OWNERSHIP.json, GATES.json

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 17-dependency-audit-and-adapter-layer*
*Context gathered: 2026-03-06*
