# RAPID Codebase Improvement Plan

## Critical Issues

### 1. Resume Command Duplication
- **Location:** `src/bin/rapid-tools.cjs` — `handleResume()` (~line 1613) and `execute resume` (~line 1917)
- **Problem:** Two code paths for the same operation with slightly different registry update logic. Bug-farm during parallel execution.
- **Fix:** Delete one path, route both entry points to a single `resumeSet()` library function in `execute.cjs`.

### 2. State Mutation Bypass
- **Location:** `execute update-phase` in `src/bin/rapid-tools.cjs`
- **Problem:** Manually mutates the phase field, bypassing `withStateTransaction()` validation. Every other state mutation uses the transaction pattern — this one doesn't, risking schema violations or silent corruption.
- **Fix:** Wrap in `withStateTransaction()` like all other state mutations.

### 3. MERGE-STATE Mutation Inconsistency
- **Location:** `src/lib/merge.cjs`, `src/bin/rapid-tools.cjs` (merge handlers)
- **Problem:** Three different write patterns exist:
  - `merge detect/resolve` — write directly
  - `merge execute` — `updateMergeState()` with fallback
  - `merge update-status` — complex per-conflict update logic
- **Fix:** Create a single `withMergeStateTransaction()` wrapper (mirroring the state-machine pattern) that handles read → validate → mutate → write atomically.

---

## Structural Improvements

### 4. Error Response Format Standardization
- **Location:** All handlers in `src/bin/rapid-tools.cjs`
- **Problem:** Handlers mix three error patterns:
  - `error()` + `process.exit(1)`
  - `{ error: msg }` JSON output + exit
  - Throw and let caller handle
- **Fix:** Create `exitWithError(msg, code)` helper that outputs JSON to stdout and human-readable to stderr. Use consistently across all handlers.

### 5. Path Resolution Inconsistency
- **Location:** `src/bin/rapid-tools.cjs` (execute handlers vs worktree handlers)
- **Problem:** Some handlers use `path.resolve(cwd, entry.path)`, others use `path.join(cwd, entry.path)`. Registry stores relative paths. `resolve` and `join` behave identically only when `cwd` is absolute — not guaranteed.
- **Fix:** Pick `path.resolve()` everywhere (safer with relative cwd) and audit all occurrences.

### 6. Review Artifact Path Mismatch
- **Location:** Skills and `src/lib/review.cjs`
- **Problem:** Planning uses `.planning/sets/{setId}/` but review uses `.planning/waves/{setId}/`. v2-to-v3 migration leftover.
- **Fix:** Migrate review artifacts to `.planning/sets/{setId}/` and update all references in skills and library code.

### 7. Agent Build Comment-Based Detection
- **Location:** `handleBuildAgents()` in `src/bin/rapid-tools.cjs`
- **Problem:** Core agents detected by `<!-- CORE: Hand-written agent` comment markers. Fragile — whitespace or formatting changes break detection.
- **Fix:** Use only the `SKIP_GENERATION` list (already exists in code) for gating. Remove comment-based detection path entirely.

---

## Design Improvements

### 8. Monolithic CLI Split
- **Location:** `src/bin/rapid-tools.cjs` (~2,700 lines, 18 handlers)
- **Problem:** Single file housing all routing and handlers. Diffs are noisy, per-command testing requires loading everything, parallel development causes merge conflicts.
- **Fix:** Split into `src/commands/{command}.cjs` files. Keep `rapid-tools.cjs` as a thin router that imports handlers.

### 9. Manual Argument Parsing
- **Location:** All handlers in `src/bin/rapid-tools.cjs`
- **Problem:** Flag parsing uses `args.indexOf('--branch')` everywhere. Prone to off-by-one bugs, no `--flag=value` support.
- **Fix:** Write a lightweight `parseArgs(args, schema)` helper (~30 lines) that handles `--flag value` and `--flag=value` consistently. Use across all handlers.

### 10. Missing Stdin JSON Validation
- **Location:** Commands reading from stdin (`plan create-set`, `state add-milestone`, `execute pause`, `review log-issue`)
- **Problem:** Parse with `JSON.parse()` but don't validate against a schema before processing. Malformed input propagates silently.
- **Fix:** Create `readAndValidateStdin(zodSchema)` utility. Apply to all stdin-reading commands.

### 11. Deprecated Skills Cleanup
- **Location:** `skills/` directory — 7 deprecated skills (`discuss`, `execute`, `plan`, `set-init`, `wave-plan`, `new-milestone`)
- **Problem:** Still ship and add maintenance surface. They only redirect users to new names.
- **Fix:** Remove deprecated skill directories entirely. If someone invokes an old name, the "skill not found" error is sufficient.

### 12. Registry Read vs Write Ambiguity
- **Location:** `src/lib/worktree.cjs` and handlers using `loadRegistry()` / `registryUpdate()`
- **Problem:** Some handlers call `loadRegistry()` for read-only access, others use `registryUpdate()` for mutations. No naming-level distinction.
- **Fix:** Rename to `readRegistry()` (read-only, returns frozen copy) and `withRegistryUpdate()` (mutation callback pattern). Makes intent explicit at call sites.

---

## Priority Summary

| Priority | # | Items | Impact |
|----------|---|-------|--------|
| Critical | 3 | Resume duplication, state bypass, merge mutation | Data corruption / race conditions |
| Structural | 4 | Error format, paths, artifact paths, build detection | Maintainability / debugging |
| Design | 5 | CLI split, arg parsing, stdin validation, deprecated cleanup, registry naming | Developer experience |
