# SET-OVERVIEW: scaffold-overhaul

## Approach

The current scaffold system (`scaffold.cjs`) is a single-developer tool: it classifies project type, writes template files, and produces a flat scaffold-report.json. The stub system (`stub.cjs`) generates throw-on-call stubs from CONTRACT.json but has no concept of developer groups, high-fidelity return values, or merge-time auto-resolution. This set overhauls both modules to support multi-developer parallel workflows where each developer group gets its own stubs for cross-group dependencies.

The core strategy is three-layered: (1) introduce high-fidelity stub generation that produces realistic return values and a `// RAPID-STUB` marker comment on line 1, replacing the current throw-on-call approach; (2) add group-aware stub orchestration that consumes the DAG group partitioning from `dag-central-grouping` to generate cross-group dependency stubs and manage per-worktree `.rapid-stubs/` directories; (3) integrate stub lifecycle into the merge pipeline so that stub-vs-real conflicts auto-resolve in favor of the real implementation.

An optional foundational set #0 with `foundation:true` in the DAG can be created to hold shared interfaces and stubs that all groups branch from. The scaffold-report.json format is extended to v2 with group assignments, stub file paths, and foundation set designation. A new `scaffold verify-stubs` CLI subcommand reports which stubs have been replaced by real implementations.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/stub.cjs` | Stub generation core -- generateHighFidelityStub, generateGroupStubs, isRapidStub | Existing (major rewrite) |
| `src/lib/stub.test.cjs` | Unit tests for stub generation and RAPID-STUB marker invariants | Existing (major rewrite) |
| `src/lib/scaffold.cjs` | Scaffold engine -- foundational set creation, scaffold-report v2 | Existing (extend) |
| `src/lib/scaffold.test.cjs` | Unit tests for scaffold extensions | Existing (extend) |
| `src/lib/scaffold.integration.test.cjs` | Integration tests for end-to-end scaffold + stub workflows | Existing (extend) |
| `src/commands/scaffold.cjs` | CLI handler -- add verify-stubs subcommand | Existing (extend) |
| `src/commands/scaffold.test.cjs` | CLI handler tests for verify-stubs | Existing (extend) |
| `skills/scaffold/SKILL.md` | Scaffold skill instructions -- update for new subcommands and flows | Existing (extend) |
| `src/lib/merge.cjs` | Merge pipeline -- add RAPID-STUB auto-resolution rule | Existing (surgical addition) |

## Integration Points

- **Exports:**
  - `generateHighFidelityStub()` -- produces stub source with realistic returns and RAPID-STUB marker
  - `generateGroupStubs()` -- generates all cross-group dependency stubs for a given group
  - `scaffoldVerifyStubs` -- CLI subcommand reporting stub replacement status
  - `createFoundationSet()` -- creates foundational set #0 with DAG annotation
  - `scaffoldReportV2` -- extended scaffold-report.json with groups, stubs, foundationSet fields
  - `isRapidStub()` -- detects RAPID-STUB marker in file content for merge auto-resolution

- **Imports (from `dag-central-grouping`):**
  - `partitionIntoGroups()` -- needed to determine which sets belong to which developer groups for stub generation
  - `annotateDAGWithGroups()` -- needed to write group assignments into DAG.json after scaffold completes

- **Side Effects:**
  - Generates/manages per-worktree `.rapid-stubs/` directories with stub files
  - Modifies `scaffold-report.json` format (backward-compatible v2 extension)
  - Adds auto-resolution logic to merge.cjs conflict pipeline (stub yields to real implementation)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `dag-central-grouping` dependency not merged yet | High | This set depends on `partitionIntoGroups` and `annotateDAGWithGroups`; must be sequenced after dag-central-grouping or stubbed during development |
| High-fidelity return value generation from type signatures may produce incorrect types for complex generics | Medium | Limit initial scope to common JS/TS types (string, number, boolean, array, object); fall back to `null` for unrecognized types |
| RAPID-STUB marker detection in merge.cjs may conflict with existing conflict resolution tiers | Medium | Insert stub auto-resolution as a T1 deterministic rule that runs before heuristic tiers; test with real merge conflict scenarios |
| Backward compatibility of scaffold-report v2 with existing consumers | Low | Add new fields (groups, stubs, foundationSet) as optional; existing v1 readers ignore unknown fields |
| Per-worktree `.rapid-stubs/` directory management requires consistent generation across worktrees | Low | Stubs are generated deterministically from CONTRACT.json; each worktree produces identical stubs from the same contracts |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- `generateHighFidelityStub()` with RAPID-STUB marker, `isRapidStub()` detection, stub.test.cjs unit tests covering marker invariant
- **Wave 2:** Group orchestration -- `generateGroupStubs()` consuming `partitionIntoGroups`, per-worktree `.rapid-stubs/` directory management, `createFoundationSet()` with DAG annotation, scaffold-report v2 extension
- **Wave 3:** Integration and CLI -- `scaffold verify-stubs` CLI subcommand, RAPID-STUB auto-resolution rule in merge.cjs, SKILL.md updates, integration tests

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
