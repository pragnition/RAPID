# VERIFICATION-REPORT: hooks-system (all waves)

**Set:** hooks-system
**Waves:** wave-1, wave-2
**Verified:** 2026-03-17
**Verdict:** PASS_WITH_GAPS

## Coverage

### CONTRACT.json Exports Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| `runPostTaskHooks()` function | wave-1 Task 2e | PASS | Signature matches CONTRACT: `(cwd, returnData) -> { passed, issues, remediation }` |
| `hooksConfig` file (`hooks/hooks.json`) | wave-1 Task 1 | PASS | CONTEXT.md overrides CONTRACT: config lives at `.planning/hooks-config.json` instead of `hooks/hooks.json`. The plan correctly follows CONTEXT.md. |
| `verifyStateUpdated()` function | wave-1 Task 2f | PASS | Signature matches CONTRACT: `(cwd, returnData) -> { stateConsistent, missingTransitions }` |
| `hookCliCommands` CLI endpoints | wave-2 Tasks 1-3 | PASS | All four subcommands covered: `hooks run [--dry-run]`, `hooks list`, `hooks enable <id>`, `hooks disable <id>` |

### CONTRACT.json Behavioral Invariants Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| `readOnlyStateAccess` | wave-1 Task 2b (impl), wave-1 Task 3 (test) | PASS | Plan explicitly forbids write/lock calls; test verifies via static source analysis |
| `nonBlocking` | wave-1 Task 2e (impl), wave-1 Task 3 (test) | PASS | Runner catches all exceptions; test verified with broken check injection |
| `idempotent` | wave-1 Task 2 (impl), wave-1 Task 3 (test) | PASS | Test calls `runPostTaskHooks` twice and asserts deep equality |

### CONTEXT.md Decisions Coverage

| Decision | Covered By | Status | Notes |
|----------|------------|--------|-------|
| Claude Code native hooks (not separate registry) | wave-2 Task 4 (rapid-verify.sh) | PASS | Shell script integrates with Claude Code hook API via team name filtering |
| No separate hooks.json registry (RAPID verification config instead) | wave-1 Task 1 | PASS | Config at `.planning/hooks-config.json` with `{ version, checks }` schema |
| Comprehensive verification (state, artifacts, commits) | wave-1 Tasks 2b-2d | PASS | Three built-in checks cover all specified verification targets |
| Read-only STATE.json access via readState() | wave-1 Task 2b | PASS | Uses `readState()` from `state-machine.cjs` (async, lock-free path at line 47) |
| Built-in checks only | wave-1 Task 2 | PASS | No extensibility mechanism; fixed set of 3 checks |
| Match rapid-tools JSON-first output style | wave-2 Task 1 | PASS | All CLI subcommands output structured JSON |
| Extend rapid-task-completed.sh / companion script | wave-2 Task 4 | PASS | Creates companion `rapid-verify.sh` rather than modifying existing script |

### Wave-to-Wave Coverage

| Wave | Scope | Status | Notes |
|------|-------|--------|-------|
| wave-1 | Core hooks engine: config, 3 checks, runner, verifyStateUpdated, unit tests | PASS | All contract exports covered |
| wave-2 | CLI commands, shell script, tool registry, CLI tests | PASS | All integration points covered |

## Implementability

### Wave 1: Files to Create

| File | Job | Action | Status | Notes |
|------|-----|--------|--------|-------|
| `src/lib/hooks.cjs` | wave-1 Task 2 | Create | PASS | Does not exist on disk; parent `src/lib/` exists |
| `src/lib/hooks.test.cjs` | wave-1 Task 3 | Create | PASS | Does not exist on disk; parent `src/lib/` exists |
| `.planning/hooks-config.json` | wave-1 Task 1 | Create | PASS | Does not exist on disk; parent `.planning/` exists |

### Wave 1: Dependency Imports

| Import | From | Status | Notes |
|--------|------|--------|-------|
| `readState` | `src/lib/state-machine.cjs` | PASS | Exists at line 47, exported at line 438; async, lock-free read path confirmed |
| `verifyLight` | `src/lib/verify.cjs` | PASS | Exists at line 23, exported at line 161; signature `(artifacts[], commits[]) -> { passed[], failed[] }` matches plan usage |

### Wave 2: Files to Create

| File | Job | Action | Status | Notes |
|------|-----|--------|--------|-------|
| `src/commands/hooks.cjs` | wave-2 Task 1 | Create | PASS | Does not exist on disk; parent `src/commands/` exists |
| `src/commands/hooks.test.cjs` | wave-2 Task 5 | Create | PASS | Does not exist on disk; parent `src/commands/` exists |
| `src/hooks/rapid-verify.sh` | wave-2 Task 4 | Create | PASS | Does not exist on disk; parent `src/hooks/` exists |

### Wave 2: Files to Modify

| File | Job | Action | Status | Notes |
|------|-----|--------|--------|-------|
| `src/bin/rapid-tools.cjs` | wave-2 Task 2 | Modify | PASS | Exists on disk; import block at lines 4-23; switch at line 186; USAGE at line 25 |
| `src/lib/tool-docs.cjs` | wave-2 Task 3 | Modify | PASS | Exists on disk; TOOL_REGISTRY at line 9; ROLE_TOOL_MAP at line 115 |

### Wave 2: Dependency Imports

| Import | From | Status | Notes |
|--------|------|--------|-------|
| `CliError` | `src/lib/errors.cjs` | PASS | Exists at line 26, exported at line 54 |
| `parseArgs` | `src/lib/args.cjs` | PASS | Exists at line 25, exported at line 120 |
| `loadHooksConfig`, `saveHooksConfig`, `runPostTaskHooks` | `src/lib/hooks.cjs` | PASS | Will be created by wave-1 (prerequisite satisfied) |

### Wave 2: Line Number References

| Reference | Actual | Status | Notes |
|-----------|--------|--------|-------|
| "after line 20 handleMerge import" | Line 20: `const { handleMerge } = require('../commands/merge.cjs');` | PASS_WITH_GAPS | Actual line 20 is correct, but additional imports follow on lines 21-23 (migrate, scaffold, compact). New import should go after line 23, not after line 20. |
| "switch case after compact around line 257" | Compact case is at line 255-257; default at line 259 | PASS | Correct location; new case should be inserted before the default case |
| "TOOL_REGISTRY entries after prereqs-check around line 107" | `prereqs-check` is at line 107 | PASS | Correct location |
| "executor role" array | Line 117 | PASS | Correct location |
| "verifier role" array | Line 123 | PASS | Correct location |

## Consistency

### Wave 1: Internal File Ownership

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `src/lib/hooks.cjs` | wave-1 Task 2 only | PASS | No conflict |
| `src/lib/hooks.test.cjs` | wave-1 Task 3 only | PASS | No conflict |
| `.planning/hooks-config.json` | wave-1 Task 1 only | PASS | No conflict |

### Wave 2: Internal File Ownership

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `src/commands/hooks.cjs` | wave-2 Task 1 only | PASS | No conflict |
| `src/commands/hooks.test.cjs` | wave-2 Task 5 only | PASS | No conflict |
| `src/hooks/rapid-verify.sh` | wave-2 Task 4 only | PASS | No conflict |
| `src/bin/rapid-tools.cjs` | wave-2 Task 2 only | PASS | No conflict |
| `src/lib/tool-docs.cjs` | wave-2 Task 3 only | PASS | No conflict |

### Cross-Wave File Ownership

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `src/lib/hooks.cjs` | wave-1 (Create), wave-2 (Import) | PASS | wave-2 imports from hooks.cjs but does not modify it; no conflict |
| `.planning/hooks-config.json` | wave-1 (Create), wave-2 CLI (Read/Write at runtime) | PASS | wave-2 does not modify the file in its plan; runtime read/write is expected behavior |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| wave-2 depends on wave-1 completion | PASS | wave-2 explicitly states prerequisite: "Wave 1 complete". All wave-2 imports from `hooks.cjs` (created in wave-1) are documented. |
| wave-1 Task 2 depends on Task 1 (config file) | PASS | Task 2 references the config schema defined in Task 1. Sequential execution within a wave is standard. |
| wave-1 Task 3 depends on Tasks 1 and 2 | PASS | Tests depend on the implementation they test. Sequential execution expected. |
| wave-2 Task 2 (rapid-tools.cjs) depends on Task 1 (hooks.cjs command handler) | PASS | Cannot register a command that doesn't exist yet. Sequential execution expected. |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | -- | No auto-fixes required |

## Notes on Minor Discrepancies

### 1. CONTRACT.json vs CONTEXT.md: hooks.json path
The CONTRACT.json `hooksConfig` export specifies `hooks/hooks.json` with a schema `{ hooks: [{ id, type, script, enabled }] }`, but CONTEXT.md explicitly overrides this: "No separate hooks.json registry -- use a RAPID verification config file instead." The wave plans correctly follow CONTEXT.md, using `.planning/hooks-config.json` with a simpler `{ version, checks: [{ id, enabled }] }` schema. This is a CONTEXT.md decision that intentionally diverges from the original CONTRACT.json spec. The plan is correct in following CONTEXT.md.

### 2. SET-OVERVIEW.md vs Wave Plans: file paths
The SET-OVERVIEW.md (preliminary) mentions `hooks/hooks.json`, `src/lib/hooks/state-verify.cjs`, and a 3-wave structure. The actual wave plans consolidate to 2 waves and use different paths. This is expected -- SET-OVERVIEW.md is a preliminary document superseded by the detailed wave plans.

### 3. Import location in rapid-tools.cjs
Wave-2 Task 2a says to add the import "after line 20 `handleMerge`", but lines 21-23 have additional imports (handleMigrate, handleScaffold, handleCompact). The import should go after line 23 to maintain the existing ordering convention. This is a minor line-number inaccuracy that does not affect implementability -- the executor should place the import at the end of the import block.

## Summary

Both wave plans for the hooks-system set are structurally sound and ready for execution. All CONTRACT.json exports and behavioral invariants are covered. All files referenced for modification exist on disk; all files to be created do not yet exist. No file ownership conflicts exist within or across waves. The only minor gap is a stale line-number reference in wave-2 Task 2a (import location says "after line 20" but should be after line 23 to follow the existing import block ordering), which is cosmetic and will not impede execution. Verdict: PASS_WITH_GAPS due to this minor line-number inaccuracy.
