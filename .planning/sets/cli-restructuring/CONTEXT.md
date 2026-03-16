# CONTEXT: cli-restructuring

**Set:** cli-restructuring
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
Split the 2,580-line `src/bin/rapid-tools.cjs` monolith into a thin router (~200-300 lines) and 13 independent command modules under `src/commands/`. Introduce 3 shared utilities: `parseArgs()`, `readAndValidateStdin()`, and `exitWithError()`. All JSON output formats must remain identical to pre-split format. The `src/commands/` directory does not yet exist; `src/lib/` already contains 24 modules.
</domain>

<decisions>
## Implementation Decisions

### Extraction Granularity
- Keep the SET-OVERVIEW's proposed 13-file structure including `misc.cjs` as a catch-all for unrelated small handlers (parse-return, verify-artifacts, prereqs, context, assumptions, display, resume)
- Tiny command groups (set-init with 2 handlers, build-agents with 1 handler) get their own dedicated files
- Naming convention follows the existing verb/noun pattern from SET-OVERVIEW (e.g., `resolve.cjs`, `merge.cjs`, `state.cjs`)

### Error Handling Migration
- Use throw + catch pattern: handlers throw typed errors, the router catches and calls `exitWithError()`
- ALL 122 `process.exit(1)` calls in extracted handlers should migrate to throws; the router's own exits remain as-is
- `exitWithError()` itself wraps `error()` + `process.exit()` but is only called at the router boundary
- This makes handlers fully unit-testable without mocking `process.exit`
- Wave 2 extracts verbatim (keeping exits), Wave 3 migrates to throw pattern

### Contract Test Strategy
- Use structural assertions that check key fields exist with correct types/shapes
- Tolerant of additive changes (new fields don't break tests), catches breaking changes (missing/renamed fields)
- Contract tests run against handler functions directly for speed -- separate integration tests can cover the router if needed
- One contract test per command output shape (not per command variant)

### Import/Require Structure
- Command files use direct `require('../lib/core.cjs')` style imports -- no barrel index
- Router uses explicit static `switch/case` for command dispatch -- no dynamic registry or magic
- Command files export named functions (e.g., `exports.handleGet`, `exports.handleTransition`) -- no single dispatch wrapper
- No command-to-command requires; command files only require from `src/lib/`
</decisions>

<specifics>
## Specific Ideas
- The `migrateStateVersion()` call must remain in the router and run before any command dispatch
- Wave 2 should extract handlers one-by-one with contract tests verified after each extraction
- The 10 `args.indexOf()` call sites should be cataloged with their edge-case behavior before migrating to `parseArgs()`
</specifics>

<code_context>
## Existing Code Insights
- `rapid-tools.cjs` is 2,580 lines with 18 handler groups, 122 `process.exit(1)` calls, 10 `args.indexOf()` parsing sites
- `src/lib/` already has well-separated modules: `core.cjs`, `state-machine.cjs`, `merge.cjs`, `execute.cjs`, `review.cjs`, etc.
- Current requires in rapid-tools.cjs: `core.cjs` (output, error, findProjectRoot) and `lock.cjs` (acquireLock, isLocked) at top level; other requires are inline within handler functions
- The `foundation-hardening` set provides `.passthrough()` state schemas needed by `readAndValidateStdin()`
- The `data-integrity` set provides `resumeSet()` and `withMergeStateTransaction()` used by execute and merge handlers
</code_context>

<deferred>
## Deferred Ideas
- Future: dynamic command plugin system where external packages can register commands (out of scope for this set)
- Future: help text generation from command metadata (currently hand-written USAGE string)
</deferred>
