# SET-OVERVIEW: dag-central-grouping

## Approach

This set evolves the DAG subsystem from its current v1/v2 format to a v3 schema that introduces developer group annotations, enabling RAPID to partition sets across multiple developers with minimized cross-group file ownership conflicts. The core problem is that RAPID currently has no concept of developer assignment -- all sets exist in a flat wave structure with no guidance on which developer should work on which sets. DAGv3 adds optional `group`, `priority`, and `description` fields to nodes plus a top-level `groups` summary, all backward-compatible so existing consumers continue to work without modification.

The implementation follows a layered strategy: first extend the DAG schema and migration path (v1 -> v2 -> v3 with auto-detection in `tryLoadDAG()`), then build the grouping algorithm in a new `group.cjs` module that uses file ownership data from CONTRACT.json to partition sets into balanced developer groups, and finally wire everything into the CLI (`dag groups`, `dag regroup`) and the roadmapper role module. A key design constraint is that all new fields are optional -- the v3 schema is a strict superset of v2, so `getExecutionOrder()`, `dag show`, and all merge-order logic remain untouched.

The set also adds `syncDAGStatus()` to keep DAG node statuses in sync with STATE.json, eliminating the manual status-map construction currently duplicated in `dag show`. This centralizes status truth and ensures the DAG file on disk always reflects current set progress.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/dag.cjs` | DAGv3 schema, createDAGv3(), validateDAGv3(), migration functions, tryLoadDAG() auto-detection, syncDAGStatus() | Existing -- extend |
| `src/lib/dag.test.cjs` | Tests for v3 creation, validation, migration, backward compat, status sync | Existing -- extend |
| `src/lib/group.cjs` | partitionIntoGroups(), annotateDAGWithGroups(), generateGroupReport() | New |
| `src/lib/group.test.cjs` | Tests for grouping algorithm determinism, balance, cross-group minimization | New |
| `src/commands/dag.cjs` | Add `groups` and `regroup` subcommands, extend `show` with group labels | Existing -- extend |
| `src/modules/roles/role-roadmapper.md` | Integrate group assignment output when team-size > 1 | Existing -- extend |

## Integration Points

- **Exports:**
  - `createDAGv3()` / `validateDAGv3()` -- v3 DAG construction and validation used by `recalculateDAG()` and any future DAG producers
  - `syncDAGStatus(cwd)` -- centralizes DAG-to-STATE status synchronization, replacing ad-hoc status map building in `dag show`
  - `partitionIntoGroups(dag, contracts, numDevelopers)` -- core grouping algorithm, consumed by `dag regroup` CLI and roadmapper
  - `annotateDAGWithGroups()` / `generateGroupReport()` -- helpers for applying and displaying group assignments
  - `migrateDAGv1toV2()` / `migrateDAGv2toV3()` -- migration functions auto-invoked by `tryLoadDAG()`
  - `dag groups [--json]` / `dag regroup --team-size N` -- new CLI subcommands

- **Imports:**
  - `preservedRecalculateDAG` from `bug-fixes-foundation` -- the fixed `recalculateDAG()` that preserves annotations, ensuring v3 group fields survive add-set operations
  - `fileOwnershipSchema` from `bug-fixes-foundation` -- the `fileOwnership` property in CONTRACT_META_SCHEMA, required so the grouping algorithm can read per-set file ownership from contracts

- **Side Effects:**
  - `tryLoadDAG()` now auto-migrates v1/v2 DAG files to v3 in memory (and optionally persists the migrated version)
  - `syncDAGStatus()` writes updated status fields back to DAG.json on disk
  - `dag regroup` mutates DAG.json with new group assignments

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auto-migration corrupts existing DAG.json data during v1/v2 to v3 conversion | High | Write comprehensive round-trip migration tests; preserve all existing fields via spread operator; validate output with both v2 and v3 validators |
| Grouping algorithm produces unbalanced or non-deterministic partitions | Medium | Sort all inputs deterministically before partitioning; use stable tie-breaking on set ID; test with multiple team sizes and DAG shapes |
| New optional fields on nodes break existing consumers that do strict property checks | High | Verify backward compat by running all existing dag.test.cjs tests against v3 DAGs unchanged; group fields are always optional with null/undefined defaults |
| `bug-fixes-foundation` dependency not yet merged -- annotation-preserving recalculateDAG unavailable | Medium | Implement v3 features independently; guard group-annotation-preservation code behind a version check; test with both old and new recalculateDAG behavior |
| `dag show` group label rendering adds noise for solo developers | Low | Only display group labels when groups are actually assigned (non-null); keep existing output identical for ungrouped DAGs |

## Wave Breakdown (Preliminary)

- **Wave 1:** Schema and migration foundation -- define DAGv3 node schema (group, priority, description fields), implement `migrateDAGv1toV2()` and `migrateDAGv2toV3()`, update `tryLoadDAG()` with version auto-detection, implement `createDAGv3()` and `validateDAGv3()`, add backward-compat tests
- **Wave 2:** Grouping algorithm and status sync -- create `group.cjs` with `partitionIntoGroups()`, `annotateDAGWithGroups()`, `generateGroupReport()`, implement `syncDAGStatus()` in dag.cjs, write determinism and balance tests
- **Wave 3:** CLI and integration -- add `dag groups` and `dag regroup` subcommands, extend `dag show` with group labels and cross-group edge highlighting, integrate group assignment into roadmapper role module output

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
