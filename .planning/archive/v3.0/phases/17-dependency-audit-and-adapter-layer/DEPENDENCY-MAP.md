# Dependency Map -- v1.0 Module Coupling Audit

Phase 17 artifact. Documents all `src/lib/*.cjs` modules, their coupling to project state, filesystem artifacts, imports, consumers, and phase assignment for future rewrites.

## Modules WITH State Coupling

### state.cjs (DELETED)

- **Purpose:** Regex-based reader/writer for STATE.md (v1.0 format)
- **State coupling:** YES -- reads/writes `.planning/STATE.md`
- **Filesystem artifacts:** `.planning/STATE.md`
- **Imports:** `lock.cjs`
- **Consumers:** `rapid-tools.cjs` (handleState)
- **Phase 17 action:** DELETE -- replaced by `state-machine.cjs` (Phase 16)
- **Future phase:** N/A (already replaced)

### state-machine.cjs

- **Purpose:** Hierarchical state machine for STATE.json (v2.0 format). Read/write, find helpers, transitions with lock protection, corruption detection, git recovery.
- **State coupling:** YES -- reads/writes `.planning/STATE.json`
- **Filesystem artifacts:** `.planning/STATE.json`, `.planning/STATE.json.tmp` (atomic rename)
- **Imports:** `lock.cjs`, `state-schemas.cjs`, `state-transitions.cjs`
- **Consumers:** `rapid-tools.cjs` (handleState, after Phase 17 rewrite)
- **Phase 17 action:** NO CHANGES (wired into CLI via rapid-tools.cjs rewrite)
- **Future phase:** Phase 21 (execute update-phase alignment)

### state-schemas.cjs

- **Purpose:** Zod schemas for ProjectState, Milestone, Set, Wave, Job. Exports status enums.
- **State coupling:** YES -- defines the schema that validates STATE.json
- **Filesystem artifacts:** None directly (schema only)
- **Imports:** `zod`
- **Consumers:** `state-machine.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 18 (if schema evolves with planner)

### state-transitions.cjs

- **Purpose:** Validates status transitions for job/wave/set entities. Enforces allowed state machine edges.
- **State coupling:** YES -- defines valid transitions for state entities
- **Filesystem artifacts:** None directly (validation logic only)
- **Imports:** None (standalone)
- **Consumers:** `state-machine.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 21 (if executor needs new transitions)

### init.cjs

- **Purpose:** Scaffolds `.planning/` directory structure for new projects. Creates initial config, STATE.md, sets/ structure.
- **State coupling:** YES -- creates initial `.planning/STATE.md` (v1.0)
- **Filesystem artifacts:** `.planning/STATE.md`, `.planning/config.json`, `.planning/sets/`, `.planning/PROJECT.md`
- **Imports:** None (standalone, uses only `fs`, `path`)
- **Consumers:** `rapid-tools.cjs` (handleInit)
- **Phase 17 action:** NO CHANGES (Phase 17-02 will address STATE.json init)
- **Future phase:** Phase 18 (rewrite to create STATE.json instead of STATE.md)

### rapid-tools.cjs (CLI entry point)

- **Purpose:** CLI dispatcher for all RAPID commands. Routes subcommands to lib modules.
- **State coupling:** YES -- handleState reads/writes state via state module
- **Filesystem artifacts:** Delegates to lib modules
- **Imports:** `core.cjs`, `lock.cjs`, `assembler.cjs`, `context.cjs`, `contract.cjs`, `dag.cjs`, `execute.cjs`, `init.cjs`, `merge.cjs`, `plan.cjs`, `prereqs.cjs`, `returns.cjs`, `stub.cjs`, `teams.cjs`, `verify.cjs`, `worktree.cjs`, `state.cjs` (being replaced with `state-machine.cjs`)
- **Phase 17 action:** REWRITE handleState to use `state-machine.cjs`
- **Future phase:** Evolves incrementally with each phase

### Agent module .md files (core-state-access.md, core-context-loading.md)

- **Purpose:** Prompt modules loaded into agents to instruct them on CLI usage
- **State coupling:** YES -- references STATE.md CLI commands
- **Filesystem artifacts:** None (prompt text only)
- **Imports:** N/A (markdown)
- **Consumers:** `assembler.cjs` (loaded into agent prompts)
- **Phase 17 action:** REWRITE references from STATE.md to STATE.json, update CLI commands
- **Future phase:** Evolves incrementally with each phase

## Modules WITHOUT State Coupling

### core.cjs

- **Purpose:** Shared utilities: `output()`, `error()`, `findProjectRoot()`, `loadConfig()`, `resolveRapidDir()`
- **State coupling:** NO
- **Filesystem artifacts:** Reads `.planning/config.json` (via `loadConfig`)
- **Imports:** None (standalone, uses `fs`, `path`)
- **Consumers:** `rapid-tools.cjs`, `assembler.cjs`, `execute.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** No rewrite planned

### lock.cjs

- **Purpose:** Named lock acquisition/release using `proper-lockfile`. Creates `.planning/.locks/` directory.
- **State coupling:** NO
- **Filesystem artifacts:** `.planning/.locks/` (lock files, gitignored)
- **Imports:** `proper-lockfile` (npm)
- **Consumers:** `rapid-tools.cjs`, `state.cjs`, `state-machine.cjs`, `worktree.cjs`, `plan.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** No rewrite planned

### assembler.cjs

- **Purpose:** Agent prompt assembly from module .md files. Loads, validates, and concatenates prompt modules.
- **State coupling:** NO
- **Filesystem artifacts:** Reads `src/modules/**/*.md`, `.planning/config.json`
- **Imports:** `core.cjs`
- **Consumers:** `rapid-tools.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 18 (planner agent modules)

### context.cjs

- **Purpose:** Codebase detection (languages, frameworks, configs). Generates `.planning/context/` analysis.
- **State coupling:** NO
- **Filesystem artifacts:** `.planning/context/` (codebase analysis output)
- **Imports:** None (standalone, uses `fs`, `path`)
- **Consumers:** `rapid-tools.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** No rewrite planned

### contract.cjs

- **Purpose:** Contract generation, validation, and test harness for inter-set interfaces.
- **State coupling:** NO
- **Filesystem artifacts:** `.planning/contracts/` (contract JSON + test files)
- **Imports:** `ajv` (npm)
- **Consumers:** `rapid-tools.cjs`, `execute.cjs`, `merge.cjs`, `plan.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 20 (contract system v2.0)

### dag.cjs

- **Purpose:** DAG operations for set/wave dependency ordering. Includes v2.0 additions for milestone DAG and handoff validation.
- **State coupling:** NO
- **Filesystem artifacts:** Reads `.planning/sets/*/SET.md` for dependency extraction
- **Imports:** None (standalone)
- **Consumers:** `rapid-tools.cjs`, `merge.cjs`, `plan.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 18 (planner DAG integration)

### execute.cjs

- **Purpose:** Execution engine: worktree setup, plan parsing, phase execution, artifact verification.
- **State coupling:** NO (delegates state to callers)
- **Filesystem artifacts:** `.planning/sets/` (reads plans), worktree directories
- **Imports:** `worktree.cjs`, `plan.cjs`, `verify.cjs`, `contract.cjs`, `core.cjs`
- **Consumers:** `rapid-tools.cjs`, `teams.cjs`, `merge.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 21 (executor rewrite with state-machine integration)

### plan.cjs

- **Purpose:** Plan parsing and set management. Reads SET.md files, manages plan lifecycle.
- **State coupling:** NO
- **Filesystem artifacts:** `.planning/sets/` (reads/writes SET.md, PLAN.md files)
- **Imports:** `dag.cjs`, `contract.cjs`, `lock.cjs`
- **Consumers:** `rapid-tools.cjs`, `execute.cjs`, `stub.cjs`, `worktree.cjs`, `merge.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 18 (planner rewrite)

### prereqs.cjs

- **Purpose:** Prerequisite checking (git, Node.js, jq availability).
- **State coupling:** NO
- **Filesystem artifacts:** None
- **Imports:** None (standalone, uses `child_process`)
- **Consumers:** `rapid-tools.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** No rewrite planned

### returns.cjs

- **Purpose:** RAPID:RETURN marker parsing and validation. Zod-based schema for return data. Includes v2.0 handoff validation.
- **State coupling:** NO
- **Filesystem artifacts:** None (parses content passed to it)
- **Imports:** `zod`
- **Consumers:** `rapid-tools.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 21 (executor handoff integration)

### stub.cjs

- **Purpose:** Stub generation for contract interfaces. Allows dependent sets to require() contracts during development.
- **State coupling:** NO
- **Filesystem artifacts:** `.planning/contracts/` (reads contracts), worktree directories (writes stubs)
- **Imports:** `plan.cjs`, `worktree.cjs`
- **Consumers:** `rapid-tools.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 20 (contract system v2.0)

### teams.cjs

- **Purpose:** Team management and parallel execution coordination.
- **State coupling:** NO
- **Filesystem artifacts:** `.planning/sets/` (reads team assignments)
- **Imports:** `execute.cjs`
- **Consumers:** `rapid-tools.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 23 (team orchestration v2.0)

### verify.cjs

- **Purpose:** Artifact verification (file existence, test execution, report generation).
- **State coupling:** NO
- **Filesystem artifacts:** None (verifies paths passed to it)
- **Imports:** None (standalone, uses `fs`, `child_process`)
- **Consumers:** `rapid-tools.cjs`, `execute.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 22 (reviewer integration)

### worktree.cjs

- **Purpose:** Git worktree management (create, remove, list, registry). Lock-protected operations.
- **State coupling:** NO
- **Filesystem artifacts:** `.planning/worktrees/REGISTRY.json`, git worktree directories
- **Imports:** `lock.cjs`, `plan.cjs`
- **Consumers:** `rapid-tools.cjs`, `execute.cjs`, `stub.cjs`, `merge.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 19 (worktree lifecycle v2.0)

### merge.cjs

- **Purpose:** Merge orchestration with 5-level conflict detection and tiered resolution.
- **State coupling:** NO
- **Filesystem artifacts:** `.planning/sets/` (reads merge metadata)
- **Imports:** `contract.cjs`, `dag.cjs`, `worktree.cjs`, `execute.cjs`, `plan.cjs`
- **Consumers:** `rapid-tools.cjs`
- **Phase 17 action:** NO CHANGES
- **Future phase:** Phase 24 (merger agent rewrite)

## Filesystem Path Conventions

| Path | Version | Description |
|------|---------|-------------|
| `.planning/STATE.md` | v1.0 | Legacy state file (being superseded by STATE.json) |
| `.planning/STATE.json` | v2.0 | Authoritative project state (hierarchical, Zod-validated) |
| `.planning/config.json` | v1.0 | Project configuration (team size, mode, etc.) |
| `.planning/PROJECT.md` | v1.0 | Project reference document |
| `.planning/sets/` | v1.0 | Planning artifacts (SET.md, PLAN.md files) -- unchanged |
| `.planning/worktrees/REGISTRY.json` | v1.0 | Worktree metadata registry -- unchanged |
| `.planning/contracts/` | v1.0 | Contract artifacts (JSON schemas, test harnesses) -- unchanged |
| `.planning/.locks/` | v1.0 | Lock mechanism directory (gitignored) -- unchanged |
| `.planning/context/` | v1.0 | Codebase analysis output -- unchanged |

## Open Integration Points

### REGISTRY.json phase tracking vs STATE.json logical state

`worktree.cjs` tracks phase/set assignments in `.planning/worktrees/REGISTRY.json`. `state-machine.cjs` tracks logical status in `.planning/STATE.json`. These are currently independent -- worktree registry does not read or write STATE.json. Alignment deferred to **Phase 19** (worktree lifecycle v2.0).

### execute update-phase vs transitionSet alignment

`execute.cjs` has an `updatePhaseStatus()` function that writes to SET.md files. `state-machine.cjs` has `transitionSet()` that writes to STATE.json. These represent the same logical operation but target different stores. Alignment deferred to **Phase 21** (executor rewrite).

## Module Dependency Graph (imports only, excluding test files)

```
rapid-tools.cjs
  +-- core.cjs
  +-- lock.cjs
  +-- assembler.cjs --> core.cjs
  +-- context.cjs
  +-- contract.cjs
  +-- dag.cjs
  +-- execute.cjs --> worktree.cjs, plan.cjs, verify.cjs, contract.cjs, core.cjs
  +-- init.cjs
  +-- merge.cjs --> contract.cjs, dag.cjs, worktree.cjs, execute.cjs, plan.cjs
  +-- plan.cjs --> dag.cjs, contract.cjs, lock.cjs
  +-- prereqs.cjs
  +-- returns.cjs
  +-- state-machine.cjs --> lock.cjs, state-schemas.cjs, state-transitions.cjs
  +-- stub.cjs --> plan.cjs, worktree.cjs
  +-- teams.cjs --> execute.cjs
  +-- verify.cjs
  +-- worktree.cjs --> lock.cjs, plan.cjs
```
