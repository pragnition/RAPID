# CONTEXT: dag-central-grouping

**Set:** dag-central-grouping
**Generated:** 2026-03-31
**Mode:** interactive

<domain>
## Set Boundary
Extend the DAG subsystem from v1/v2 to a v3 schema with developer group annotations, implement a group partitioning algorithm in a new group.cjs module, add DAG status synchronization, create migration logic for v1/v2 DAGs, add `dag groups` and `dag regroup` CLI subcommands, extend `dag show` with group-aware display, and integrate group assignment into the roadmapper role module output. All new fields are optional — existing consumers continue working unchanged.
</domain>

<decisions>
## Implementation Decisions

### DAGv3 Schema Evolution
- **Normalize + extend**: v3 standardizes naming (always `nodes` in wave objects, never `sets`), adds explicit `version: 3`, and introduces optional `group`, `priority`, `description` fields on nodes plus a top-level `groups` summary.
- **Rationale:** Cleaning up the v1/v2 naming inconsistency (`waves[n].sets` vs `waves[n].nodes`) now prevents the divergence from propagating. Since migration handles both formats anyway, normalization costs nothing extra.

### Groups Summary Field
- **Always present**: The top-level `groups` field is always present in v3 DAGs as `groups: {}` when no group assignments exist.
- **Rationale:** Eliminates null-checking in every consumer. Schema validation is simpler when the field is guaranteed to exist. An empty object is harmless noise for solo developers.

### Migration Persistence Model
- **In-memory + migrated flag**: `tryLoadDAG()` returns `{ dag, path, migrated: boolean }`. The caller decides whether and when to persist the migrated v3 back to disk.
- **Rationale:** Keeps tryLoadDAG() as a read function without surprise write side effects. The `migrated` flag gives callers explicit signal to persist when appropriate (e.g., during `dag generate` or `dag regroup`).

### Migration Path Strategy
- **Direct paths**: Implement `migrateDAGv1toV3()` and `migrateDAGv2toV3()` as separate functions rather than chaining v1→v2→v3.
- **Rationale:** User prefers fewer intermediate states and simpler code paths. Each migration function handles its source version directly without depending on the other migration function.

### Group Partitioning Algorithm
- Claude's Discretion — user deferred algorithm choice.
- **Rationale:** User trusts Claude to pick the best approach given the typical RAPID project size (5-15 sets). The algorithm must be deterministic and should prioritize minimizing cross-group file conflicts over strict group balance.

### Balance Strategy
- **Conflict-first with balance as tiebreaker**: Minimize cross-group file ownership conflicts first, then balance group sizes as a secondary concern.
- **Rationale:** Cross-group file conflicts create merge friction and coordination overhead. For typical RAPID projects (5-15 sets, 2-3 developers), any resulting imbalance is usually small.

### Cross-Group File Conflicts
- **Assign primary owner**: The set with more functions/ownership in a shared file gets primary ownership. Other sets in different groups receive a "shared dependency" annotation.
- **Rationale:** Clear ownership reduces ambiguity during execution. The primary owner heuristic works for most cases, and the annotation makes shared files visible for coordination.

### Cross-Group Conflict Surfacing
- **Both report and dag show**: `generateGroupReport()` provides a detailed markdown table of shared files for planning. `dag show` displays markers on cross-group edges for quick daily checks.
- **Rationale:** Planning and daily workflow are different contexts that benefit from different levels of detail. Both are low-cost to implement.

### syncDAGStatus Trigger Model
- **On tryLoadDAG()**: Status synchronization from STATE.json happens transparently whenever the DAG is loaded, so statuses are always fresh.
- **Rationale:** Centralizes the status-map construction currently duplicated in `dag show`. Callers never see stale statuses without remembering to call a separate sync function.

### syncDAGStatus Persistence
- **Write to disk**: After syncing statuses, the updated DAG is persisted back to DAG.json so the file on disk always reflects current set progress.
- **Rationale:** DAG.json should be a reliable snapshot of reality. This pairs with the migrated flag — tryLoadDAG can handle both status sync writes and migration writes.

### Group Assignment Storage
- **DAG.json only**: Group assignments live exclusively in DAG.json (on node `group` fields and the top-level `groups` summary). STATE.json does not store group data.
- **Rationale:** Single source of truth avoids dual-write consistency issues. Tools that need group info (like /rapid:status) can load DAG.json when needed.

### Group Assignment Lifecycle
- **Preserve existing, leave new unassigned**: When sets are added or removed via /rapid:add-set (which calls recalculateDAG), existing group annotations survive. New sets get `group: null` until the next `dag regroup`.
- **Rationale:** Non-destructive default respects previous grouping decisions. This depends on the bug-fixes-foundation import (preservedRecalculateDAG) that preserves annotations during DAG recalculation.

### dag show Group Visualization
- **Inline badges**: Group labels appear as compact `[G1]` badges after the set name in `dag show` output. No group badges shown when groups are empty/unassigned.
- **Rationale:** Minimal visual noise while providing group context at a glance. Integrates naturally with the existing wave-based layout.

### Cross-Group Edge Markers
- **Yes, with markers**: Cross-group dependency edges in `dag show` are highlighted with a marker (e.g., lightning bolt) to signal coordination overhead.
- **Rationale:** Low implementation cost, high signal value for daily workflow checks.

### Roadmapper Integration Depth
- **Active constraint**: The roadmapper uses team-size to actively influence set boundary design, aiming for sets that naturally partition into groups with minimal file conflicts.
- **Rationale:** Designing for groupability up-front is far more effective than trying to partition poorly-bounded sets post-hoc. The roadmapper already considers team size — this makes it group-aware.

### Solo Developer Behavior
- **Hidden entirely**: When team-size is 1, group-related features (fields, sections, CLI output) are completely suppressed for a clean solo experience.
- **Rationale:** Solo developers never need groups. Hiding the feature entirely avoids confusion and noise. The `groups: {}` field still exists in DAG.json for schema consistency, but UI surfaces suppress it.
</decisions>

<specifics>
## Specific Ideas
- Use `[G1]`, `[G2]`, etc. as the inline badge format in dag show
- Cross-group edges should use a distinct marker (lightning bolt or similar) in dag show
- tryLoadDAG() return type changes to `{ dag, path, migrated }` — a breaking API change that existing callers must be updated for
- syncDAGStatus writes to disk on every load — callers of tryLoadDAG that previously expected no side effects should be reviewed
- The `groups` top-level field uses the shape: `Record<string, { sets: string[], description?: string }>`
</specifics>

<code_context>
## Existing Code Insights
- `dag.cjs` exports: toposort, assignWaves, createDAG, validateDAG, getExecutionOrder, tryLoadDAG, createDAGv2, validateDAGv2 — v3 functions will be added alongside these
- `tryLoadDAG()` currently returns `{ dag, path }` — needs the `migrated` field added
- `dag show` in `commands/dag.cjs` manually builds a statusMap from STATE.json — this will be replaced by syncDAGStatus()
- v1 DAGs have no `version` field and use `waves[n].sets`; v2 DAGs have `version: 2` and use `waves[n].nodes`
- `recalculateDAG()` in `add-set.cjs` rebuilds DAG on structural changes — the bug-fixes-foundation set ensures it preserves annotations (import dependency)
- `role-roadmapper.md` accepts team-size as input — group integration adds group assignment to its output when team-size > 1
- `DAG_SUBPATH` from `core.cjs` defines the canonical path `.planning/sets/DAG.json`
</code_context>

<deferred>
## Deferred Ideas
- Auto-regroup on DAG structural changes (currently requires manual `dag regroup`)
- Graph-based community detection algorithm for large-scale DAGs (50+ sets)
</deferred>
