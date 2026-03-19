# SET-OVERVIEW: hooks-system

## Purpose

The hooks-system set introduces a pluggable post-task hook framework into RAPID. Today, RAPID agents report completion via `RAPID:RETURN` markers and state transitions happen through `state-machine.cjs`, but there is no automated verification that reported work actually matches project state. The existing `src/hooks/rapid-task-completed.sh` handles basic task tracking via Claude Code's hook API, but provides no extensibility, no state consistency checks, and no CLI management surface.

This set delivers: (1) a hook runner that executes registered hooks after task completion, (2) a state verification hook that cross-checks `RAPID:RETURN` data against `STATE.json`, (3) a declarative hook configuration file, and (4) CLI commands for managing hooks.

## Approach

The implementation follows a registry-plus-runner architecture. A JSON configuration file (`hooks/hooks.json`) declares available hooks with their IDs, types, scripts, and enabled/disabled state. The hook runner loads this registry, filters to enabled hooks, and executes them sequentially against the `RAPID:RETURN` data and working directory context. Each hook returns a structured result (`passed`, `issues`, optional `remediation`), and the runner aggregates these into a single verdict.

The state verification hook is the flagship built-in hook. It reads `STATE.json` via `readState()` (the existing lock-free read path in `state-machine.cjs`) and compares reported artifacts, commits, and task counts against the actual state tree. It identifies missing state transitions -- for example, when an agent reports `COMPLETE` but the corresponding set/wave/job status was never transitioned in `STATE.json`.

All hooks are non-blocking by design: failures produce warnings and remediation prompts but never halt the agent pipeline. This is critical because hooks run after task completion, and blocking would create deadlocks when a hook failure prevents the state transition that would fix the inconsistency.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/hooks.cjs` | Hook runner engine: load config, execute hooks, aggregate results | New |
| `src/lib/hooks.test.cjs` | Unit tests for hook runner (including behavioral invariants) | New |
| `hooks/hooks.json` | Declarative hook registry configuration | New |
| `src/lib/hooks/state-verify.cjs` | Built-in state verification hook implementation | New |
| `src/lib/hooks/state-verify.test.cjs` | Tests for state verification hook | New |
| `src/commands/hooks.cjs` | CLI command handler for `hooks run/list/enable/disable` | New |
| `src/bin/rapid-tools.cjs` | Register `hooks` command in CLI router | Existing (modify) |
| `src/lib/tool-docs.cjs` | Register hook commands in TOOL_REGISTRY | Existing (modify) |

## Integration Points

- **Exports:**
  - `runPostTaskHooks(cwd, returnData)` -- primary entry point for post-task verification; called by execution orchestration after parsing a `RAPID:RETURN` marker
  - `verifyStateUpdated(cwd, returnData)` -- standalone state consistency check; usable independently from the hook framework
  - `hooks/hooks.json` -- declarative configuration consumed by the runner
  - CLI commands: `hooks run [--dry-run]`, `hooks list`, `hooks enable <id>`, `hooks disable <id>`

- **Imports:** None (this set has zero external imports per CONTRACT.json, making it fully independent)

- **Side Effects:**
  - Reads `STATE.json` without write locks (uses `readState()` read path)
  - Reads `hooks/hooks.json` from project root
  - Outputs warnings to stderr when hooks detect issues
  - Never modifies `STATE.json` or any project files

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Read-only state access could see stale data during concurrent transitions | Low | Acceptable: hooks are advisory, not authoritative; stale reads produce false warnings that resolve on next run (idempotent) |
| Hook execution adds latency to the post-task pipeline | Medium | Keep hooks lightweight; add `--dry-run` flag for testing; hooks run after task completion so latency does not block agent work |
| `hooks.json` schema drift if new hook types are added later | Low | Use a minimal schema with `id`, `type`, `script`, `enabled`; validate on load with clear error messages |
| State verification logic may not cover all state transition edge cases | Medium | Start with core transitions (set/wave/job status); add coverage for edge cases (CHECKPOINT resume, partial waves) in tests |
| Circular dependency if hooks module imports from modules that trigger hooks | High | Strict rule: hooks module imports only from `core.cjs`, `state-machine.cjs` (read path), and `returns.cjs`; never from `execute.cjs` or other orchestration modules |

## Wave Breakdown (Preliminary)

- **Wave 1: Foundation** -- Hook configuration schema and runner engine
  - Define `hooks/hooks.json` schema and create initial config file
  - Implement `src/lib/hooks.cjs` with `runPostTaskHooks()` and config loading
  - Write unit tests covering config loading, hook execution, result aggregation
  - Enforce behavioral invariants: non-blocking, idempotent

- **Wave 2: State Verification Hook** -- The built-in verification implementation
  - Implement `src/lib/hooks/state-verify.cjs` with `verifyStateUpdated()`
  - Cross-check `RAPID:RETURN` fields (status, artifacts, tasks_completed) against `STATE.json`
  - Detect missing transitions (e.g., agent reports COMPLETE but job still in `executing`)
  - Verify read-only access (no write lock acquisition) via tests

- **Wave 3: CLI and Integration** -- Wire hooks into the CLI and tool registry
  - Implement `src/commands/hooks.cjs` with `run`, `list`, `enable`, `disable` subcommands
  - Register `hooks` command in `rapid-tools.cjs` command router
  - Add hook command entries to `TOOL_REGISTRY` in `tool-docs.cjs`
  - End-to-end tests: CLI invocation through hook execution and output

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.

## Dependencies

- **Depends on:** Nothing -- `imports` in CONTRACT.json is empty. This set is fully independent and can be developed in any wave order relative to other sets.
- **Depended on by:** Potentially execution orchestration (future integration point where `runPostTaskHooks` is called after `parseReturn`), but no current set declares an import on hooks-system.
- **Internal dependencies:** Uses `readState()` from `state-machine.cjs` (read-only path), `parseReturn()` / `validateReturn()` from `returns.cjs`, and `findProjectRoot()` from `core.cjs`. These are stable, existing APIs.
