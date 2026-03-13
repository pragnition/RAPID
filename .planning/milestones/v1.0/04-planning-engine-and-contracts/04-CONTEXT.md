# Phase 4: Planning Engine and Contracts - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose a project into parallelizable sets with machine-verifiable interface contracts, dependency graphs, file ownership, and sync gates. Sets are **project-level workstreams** — each set goes through its own full discuss/plan/execute lifecycle in an isolated worktree. The planning engine takes the full project scope (REQUIREMENTS.md + codebase context) and carves it into isolatable sets.

Key distinction: sets contain multiple phases, not the other way around. A set is a top-level parallel workstream, not a sub-task within a phase.

</domain>

<decisions>
## Implementation Decisions

### Contract Format
- Contracts are **JSON Schema** definitions
- Each contract covers **API surfaces + data shapes + behavioral expectations** (full contract)
- Contracts are machine-verifiable via **auto-generated contract tests** — each contract produces a test file that the executor must make pass
- Contract files live **per-set** (`.planning/sets/<set-name>/CONTRACT.json`) with a **central manifest** (`.planning/contracts/MANIFEST.json`) indexing all contracts (dual-write)

### Set Decomposition
- Sets are **project-level** parallel workstreams — each set has its own full discuss/plan/execute lifecycle
- The planner **auto-proposes** sets from REQUIREMENTS.md + codebase context (Phase 3 output). Developer reviews and approves the proposed decomposition
- Each set gets a **DEFINITION.md** (scope, file ownership, tasks, acceptance criteria) and a **CONTRACT.json** (JSON Schema interface)
- `/rapid:plan` is the command that triggers decomposition

### File Ownership
- **Owner + contributors** model — every file has exactly one owning set, but other sets can contribute changes
- Contributors declare intended changes in a **CONTRIBUTIONS.json** during planning — the owner's contract accounts for these, and the merge reviewer uses the manifest to apply changes in order
- **Ownership map is auto-generated** by the planner (developer reviews)
- Ownership violations (modifying an unowned file without a contribution manifest) produce a **warning + log** rather than a hard block — defers resolution to merge phase

### Dependency DAG + Sync Gates
- **Hybrid DAG with wave labels** — full dependency DAG exists with explicit edges, but sets are also grouped into waves for human readability. Execution follows the DAG (a set runs when its deps complete), waves are visualization
- **Per-wave planning gate** — Wave 1 sets must all be planned before Wave 1 executes. Wave 2 planning can happen while Wave 1 executes. Overlaps planning and execution for speed
- DAG stored as a **JSON graph file** (`.planning/sets/DAG.json`) with nodes (sets) and edges (dependencies)
- **Soft dependencies via contract stubs** — if Set A needs Set B's types, Set A codes against the contract stub. Both sets can run in parallel. The contract IS the stub
- Planner produces **wave-end checkpoints** — which contracts must be satisfied, which artifacts must exist. Reconciliation (Phase 7) validates these checkpoints

### Claude's Discretion
- Internal data structures for representing sets and contracts in memory
- CLI subcommand design for `/rapid:plan` and `/rapid:assumptions`
- Validation error messages and user-facing output format
- How the planner agent analyzes codebase context to propose set boundaries

</decisions>

<specifics>
## Specific Ideas

- Sets are the core parallelism unit — think of them as independent feature tracks that different developers (or Claude instances) can work on simultaneously
- The discuss/plan/execute lifecycle per set mirrors the GSD workflow but scoped to a set's boundary
- Contribution manifests solve the "multiple sets need package.json" problem without zone-based ownership complexity
- Contract stubs enable maximum parallelism — sets never block on each other's implementation, only on contract definitions being agreed upon

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assembler.cjs`: Composable agent assembly with role-based modules — planner agent can be assembled with planning-specific context
- `returns.cjs`: Structured COMPLETE/CHECKPOINT/BLOCKED protocol — planner can return BLOCKED if decomposition needs clarification
- `state.cjs`: Lock-based state management with concurrent access safety — set state tracking can build on this
- `verify.cjs`: Lightweight + heavyweight verification — contract test verification can extend this
- `rapid-tools.cjs`: CLI entry point — `/rapid:plan` and `/rapid:assumptions` commands route through here
- `core.cjs`: Project root detection, config loading, output utilities

### Established Patterns
- Modules are `.cjs` CommonJS files with `module.exports`
- Agent prompts are Markdown files assembled from core + role modules
- Config lives in `config.json` with agent definitions
- All state in `.planning/` directory (JSON for machines, Markdown for humans)
- Tests are co-located (`.test.cjs` alongside implementation)

### Integration Points
- New `plan.cjs` library in `rapid/src/lib/` for planning logic
- New commands in `rapid/commands/` for plan and assumptions
- New skills in `rapid/skills/` for plan and assumptions
- Extend `rapid-tools.cjs` with `plan` and `assumptions` subcommands
- New agent module `role-planner.md` already exists — may need updates for project-level set decomposition
- `.planning/sets/` directory structure for set definitions, contracts, and DAG

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-planning-engine-and-contracts*
*Context gathered: 2026-03-04*
