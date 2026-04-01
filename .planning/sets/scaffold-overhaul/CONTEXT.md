# CONTEXT: scaffold-overhaul

**Set:** scaffold-overhaul
**Generated:** 2026-04-01
**Mode:** interactive

<domain>
## Set Boundary
Overhaul the scaffold system for multi-developer parallel workflows. This includes group-aware set splitting using DAG group annotations, high-fidelity stub generation with `.rapid-stub` sidecar markers, per-worktree `.rapid-stubs/` directory management, optional foundational set #0 (planned by the roadmapper as a normal set with `foundation:true` DAG flag), stub lifecycle hooks, a `scaffold verify-stubs` CLI command, RAPID-STUB merge auto-resolution at T0 tier, and scaffold-report v2 with additive fields.
</domain>

<decisions>
## Implementation Decisions

### Stub Generation Model
- Stub content generation is **LLM-driven, not programmatic**. There is no deterministic parser or heuristic type mapper. The planner/executor agents generate stub code as part of their normal workflow, guided by CONTRACT.json context.
- `generateHighFidelityStub` becomes agent instructions in the scaffold skill rather than a programmatic function. The LLM reads the contract and writes appropriate stubs.
- **Rationale:** RAPID already uses LLM agents for code generation. Adding a programmatic stub generator would duplicate capability and produce lower-quality stubs than the LLM can. The agent model keeps the system consistent.

### Stub Return Value Fallback
- For unrecognized or complex return types, stubs should return `null` as a safe fallback.
- **Rationale:** Null is explicit, never crashes on property access in the same way as undefined, and clearly signals "not implemented" without throwing (which would defeat the purpose of high-fidelity stubs).

### Stub Storage Model
- Stubs live in a per-worktree `.rapid-stubs/` directory as ephemeral build artifacts.
- At `start-set` time, stubs are **generated** directly in the worktree's `.rapid-stubs/` directory from CONTRACT.json imports.
- **Rationale:** Per-worktree generation is consistent with RAPID's worktree isolation model. Each worktree generates its own stubs from contracts, avoiding shared-branch race conditions and git complexity. Stubs don't appear in branch diffs or history because `.rapid-stubs/` is gitignored.

### Stub Replacement Detection
- Detection uses **first-line marker check only** -- check if the file still looks like a stub.
- Detection runs **on-demand only** via `scaffold verify-stubs` CLI. Merge T0 auto-resolution is the real safety net.
- **Rationale:** Simple, deterministic, fast. The merge pipeline already handles the critical path (stub-vs-real conflict resolution), so on-demand verification is sufficient for status reporting.

### RAPID-STUB Marker Format
- Marker is a **simple tag** (`// RAPID-STUB`) -- no metadata, no set name, no timestamp.
- **Universal `.rapid-stub` sidecar marker files** are created alongside each stub file for language-agnostic detection. These are **tracked in git**.
- **Rationale:** Simple tag is trivial to detect. Sidecar files decouple detection from language-specific comment syntax, making the system extensible without code changes. Tracking in git ensures merge T0 and other developers can detect stubs across branches.

### Cross-Group Stub Routing
- Stubs are **loosely planned by the LLM planner**, not strictly routed by programmatic dependency analysis. No transitive closure computation.
- The planner decides what stubs each group needs based on contract context and DAG structure.
- **Rationale:** Strict programmatic routing adds complexity for marginal benefit. The LLM planner already understands contracts and dependencies -- let it decide what stubs are appropriate.

### Merge Pipeline Integration
- RAPID-STUB auto-resolution is a **new T0 tier** that runs before all existing tiers. When one side is a stub (detected by `.rapid-stub` sidecar) and the other is real code, real code always wins.
- When **both sides are stubs**, keep either arbitrarily (they should be identical since they're generated from the same contract).
- **Rationale:** Stub resolution is the most deterministic rule possible -- a pre-implementation artifact should always yield to a real implementation. Running it first avoids downstream tiers misinterpreting the conflict.

### DAG Group Consumption
- Scaffold **reads groups from DAG.json** (pre-computed by `partitionIntoGroups`), not computed at runtime.
- Groups are computed during `new-version` and refreshable on-demand via `dag regroup`.
- **Rationale:** Single source of truth. DAG.json is already the authoritative data store for group assignments; recomputing at scaffold time risks disagreement with what `dag show` displays.

### Scaffold-Report v2
- v2 uses **additive fields** (no version tag, no migration). New optional fields: `groups`, `stubs`, `foundationSet`.
- **Minimal fields only** -- no contract references, no dependency snapshots.
- **Rationale:** scaffold-report.json is an internal artifact. Existing v1 consumers ignore unknown fields. Keeping it minimal avoids maintenance burden for a planning artifact.

### Foundation Set #0 Lifecycle
- Foundation set is **auto-created when DAG has multiple groups** (no explicit flag needed).
- Foundation set #0 is **a normal set** -- the roadmapper plans it, and it follows the standard lifecycle: `/start-set` → `/discuss-set` → `/plan-set` → `/execute-set`. It gets its own worktree like any other set.
- The only distinction is the `foundation:true` DAG flag and that its content scope is interfaces and stubs.
- No special `createFoundationSet()` function is needed.
- **Rationale:** Treating foundation as a normal set keeps the workflow uniform. No special-case code paths. The roadmapper already knows how to plan sets.

### Foundation Scope Enforcement
- Scope constraint ("no feature logic") is enforced **at scaffold-time only**.
- Feature logic = anything beyond static default returns, throws, and type definitions. No conditionals, no I/O, no state mutation.
- **Rationale:** Since the LLM generates stubs and follows instructions, scaffold-time validation catches structural issues. Ongoing hooks would require complex "is this feature logic?" heuristics.

### Stub Lifecycle End State
- Replaced stubs are **auto-deleted at merge time** along with their `.rapid-stub` sidecar files.
- **Rationale:** Clean main branch, no orphan stubs. Git history preserves what the stub looked like. Merge T0 handles the replacement automatically.

### Claude's Discretion
- None -- all areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- The LLM planner should receive CONTRACT.json exports as context when generating stubs, so stubs match the expected function signatures and return shapes
- `.rapid-stub` sidecar files should be empty (zero-byte) -- their presence is the signal, not their content
- The `scaffold verify-stubs` command should output JSON consistent with the existing `scaffold status` format
- When auto-deleting stubs at merge, both the stub source file and its `.rapid-stub` sidecar must be removed together
</specifics>

<code_context>
## Existing Code Insights
- `stub.cjs` currently generates throw-on-call stubs with `generateStub()` and `generateStubFiles()` -- both will be significantly reworked since generation moves to agent instructions
- `scaffold.cjs` has a clean separation: classifier → templates → engine → report. The v2 report extension fits naturally into `writeScaffoldReport()`
- `merge.cjs` uses a Zod-validated 5-level detection + 4-tier resolution cascade. T0 stub resolution adds a new tier before existing T1
- `src/commands/scaffold.cjs` handles `run` and `status` subcommands -- `verify-stubs` adds a third subcommand
- `stub.cjs` exports `cleanupStubFiles()` which already handles stub directory removal -- can be extended for sidecar file cleanup
- `dag.cjs` provides `getExecutionOrder()` and group annotations from the `dag-central-grouping` set
</code_context>

<deferred>
## Deferred Ideas
- Multi-language stub marker support (Python, Go, Rust comment styles) -- deferred until RAPID expands beyond CJS
- Transitive stub generation across deeply nested dependency chains -- deferred in favor of planner-driven decisions
- Ongoing foundation scope enforcement via commit hooks -- deferred unless scope violations become a recurring problem
</deferred>
