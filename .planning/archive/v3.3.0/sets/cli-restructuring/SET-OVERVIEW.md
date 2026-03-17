# SET-OVERVIEW: cli-restructuring

## Approach

The core problem is that `src/bin/rapid-tools.cjs` is a 2,580-line monolith containing 18 handler functions, 122 `process.exit(1)` calls, and 10 hand-rolled `args.indexOf()` argument parsing sites. Every future set in v3.3.0 (structural-cleanup, bug-fixes, solo-mode) depends on this file, making it the critical bottleneck for parallel development. The goal is to decompose it into a thin router (~200-300 lines) that dispatches to independent `src/commands/{command}.cjs` handler modules.

The implementation strategy is extract-then-replace. Each of the 18 handler groups is moved verbatim into its own command file, preserving exact JSON output format and exit behavior. Only after extraction do we introduce the three shared utilities (`parseArgs`, `readAndValidateStdin`, `exitWithError`) and migrate handlers to use them. This two-phase approach avoids combining structural and behavioral changes in a single step, which is the primary risk identified in the research (Risk #4: breaking 24 skills and 26 agents that parse JSON output).

The sequencing is: (1) create shared utilities and the router skeleton, (2) extract handlers one-by-one with contract tests verifying output format preservation, (3) migrate extracted handlers to use the new utilities. The `foundation-hardening` dependency provides `.passthrough()` state schemas needed by `readAndValidateStdin`, and the `data-integrity` dependency provides `resumeSet()` and `withMergeStateTransaction()` that the execute and merge handlers delegate to.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/bin/rapid-tools.cjs` | Monolithic CLI entry point -> thin router | Existing (2,580 lines -> ~200-300) |
| `src/commands/state.cjs` | State get/transition/add-milestone/detect/recover handlers | New |
| `src/commands/execute.cjs` | Execute prepare-context/verify/stubs/wave-status/pause/resume/reconcile handlers | New |
| `src/commands/merge.cjs` | Merge review/execute/status/detect/resolve/bisect/rollback handlers | New |
| `src/commands/review.cjs` | Review scope/log-issue/list-issues/update-issue/lean/summary handlers | New |
| `src/commands/worktree.cjs` | Worktree create/list/cleanup/reconcile/status/generate-claude-md handlers | New |
| `src/commands/build-agents.cjs` | Agent build pipeline handler | New |
| `src/commands/init.cjs` | Init detect/scaffold handlers | New |
| `src/commands/plan.cjs` | Plan create-set/decompose/write-dag/list-sets/load-set handlers | New |
| `src/commands/lock.cjs` | Lock acquire/status/release handlers | New |
| `src/commands/set-init.cjs` | Set-init create/list-available handlers | New |
| `src/commands/resolve.cjs` | Resolve set/wave handlers | New |
| `src/commands/misc.cjs` | parse-return, verify-artifacts, prereqs, context, assumptions, display, resume | New |
| `src/lib/args.cjs` | `parseArgs()` utility replacing `args.indexOf()` patterns | New |
| `src/lib/errors.cjs` | `exitWithError()` standardized error output | New |
| `src/lib/stdin.cjs` | `readAndValidateStdin()` with Zod validation | New |

## Integration Points

- **Exports:**
  - `src/commands/{command}.cjs` -- one file per command group, each exporting handler functions callable by the router and by tests
  - `parseArgs(args, schema)` -- lightweight argument parser supporting `--flag value` and `--flag=value`, replacing 10 `args.indexOf()` call sites
  - `readAndValidateStdin(zodSchema)` -- reads stdin JSON and validates against Zod schema (uses `.passthrough()` schemas from foundation-hardening)
  - `exitWithError(msg, code?)` -- JSON to stdout, human-readable to stderr, then `process.exit`
- **Imports:**
  - `ProjectStateSchema.passthrough()` from `foundation-hardening` (state-schemas.cjs) -- needed for stdin validation in state and execute handlers
  - `resumeSet()` from `data-integrity` (execute.cjs) -- the execute command handler delegates resume operations to this single function
  - `withMergeStateTransaction()` from `data-integrity` (merge.cjs) -- merge command handler uses this for atomic MERGE-STATE writes
- **Side Effects:**
  - The router's JSON output format must be byte-identical to the pre-split format -- skills and agents parse specific fields
  - `process.exit()` behavior must be preserved (same exit codes for same error conditions)
  - The `migrateStateVersion()` call in the router must continue to run before any command dispatch

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| JSON output format changes break 24 skills and 26 agents | High | Write contract tests capturing exact output shapes before extracting each handler; run full test suite after each extraction |
| `args.indexOf()` replacement silently changes flag parsing edge cases (missing values, flag at end of args) | Medium | Catalog all 10 `args.indexOf` sites with their edge-case behavior; write per-flag tests before migrating to `parseArgs()` |
| Circular require between command files and lib modules | Medium | Command files require only from `src/lib/`; no command-to-command requires; router requires command files |
| 122 `process.exit(1)` calls scattered across handlers make testing difficult | Medium | Phase 1: extract verbatim (keep exits). Phase 2: migrate to throw + catch-in-router pattern. Never combine both steps |
| `readAndValidateStdin()` Zod validation rejects valid input due to missing `.passthrough()` | High | Depend on foundation-hardening's `.passthrough()` schemas; integration test stdin round-trips |
| Router exceeds 300-line behavioral invariant | Low | Router contains only: USAGE string, `main()` with switch, `migrateStateVersion()`, `exitWithError()` fallback catch. No handler logic |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Create `src/commands/` directory, shared utilities (`args.cjs`, `errors.cjs`, `stdin.cjs`), router skeleton, and contract tests capturing current JSON output format for each command group
- **Wave 2:** Extraction -- Move handler functions from `rapid-tools.cjs` into their respective `src/commands/{command}.cjs` files, one at a time, verifying contract tests pass after each move. Reduce `rapid-tools.cjs` to thin router
- **Wave 3:** Migration -- Replace `args.indexOf()` patterns with `parseArgs()`, replace `error() + process.exit(1)` patterns with `exitWithError()`, wire `readAndValidateStdin()` into handlers that read JSON from stdin

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
