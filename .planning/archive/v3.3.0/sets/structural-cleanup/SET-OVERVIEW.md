# SET-OVERVIEW: structural-cleanup

## Approach

This set performs six targeted refactoring tasks that improve naming clarity, path safety, and codebase hygiene across RAPID's core libraries and command handlers. None of these changes alter user-facing behavior -- they are internal API renames, path hardening, dead-code removal, and artifact relocation. The dependency on `cli-restructuring` (already merged) ensures that the split command handler files (`src/commands/*.cjs`) are in their final locations before we apply renames and path fixes to them.

The implementation strategy is bottom-up: first rename the core library functions in `src/lib/worktree.cjs` (the canonical definitions of `loadRegistry` and `registryUpdate`), then propagate those renames through all consumers. Path resolution fixes (`path.resolve()` over `path.join()` with relative cwd) are applied file-by-file as a mechanical transform. The build-agents comment-marker cleanup, deprecated skill removal, and review artifact relocation are independent tasks that can proceed in parallel once the rename wave is stable.

Because these changes touch many files but are individually small and mechanical, the primary risk is merge conflicts with other in-flight sets. The `review-pipeline` and `context-optimization` sets (both pending) may touch overlapping files in `src/lib/review.cjs` or `src/commands/review.cjs`. Careful sequencing and early merge will mitigate this.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/worktree.cjs` | Canonical definitions of `loadRegistry` / `registryUpdate` | Existing -- rename functions |
| `src/lib/worktree.test.cjs` | Tests for registry functions | Existing -- update names + assertions |
| `src/commands/worktree.cjs` | Worktree CLI commands (7 `loadRegistry`, 3 `registryUpdate` call sites) | Existing -- rename calls |
| `src/commands/execute.cjs` | Execute CLI commands (5 `loadRegistry`, 2 `registryUpdate` call sites) | Existing -- rename calls |
| `src/commands/merge.cjs` | Merge CLI commands (4 `loadRegistry`, 3 `registryUpdate` call sites) | Existing -- rename calls |
| `src/commands/set-init.cjs` | Set init command (1 `loadRegistry` call site) | Existing -- rename call |
| `src/commands/review.cjs` | Review command (2 `loadRegistry` call sites) | Existing -- rename call |
| `src/lib/stub.cjs` | Stub/resolver utilities (1 `loadRegistry` call site) | Existing -- rename call |
| `src/commands/build-agents.cjs` | Agent builder with comment-marker detection at line 287 | Existing -- remove `startsWith` check |
| `src/lib/review.cjs` | Review library referencing `.planning/waves/{setId}/` paths | Existing -- relocate to `.planning/sets/{setId}/` |
| `src/lib/execute.cjs` | Execute library referencing `.planning/waves/` paths | Existing -- update references |
| `skills/new-milestone/SKILL.md` | Deprecated redirect skill | Existing -- remove |
| `skills/plan/SKILL.md` | Deprecated redirect skill | Existing -- remove |
| `skills/wave-plan/SKILL.md` | Deprecated redirect skill | Existing -- remove |
| `skills/discuss/SKILL.md` | Deprecated redirect skill | Existing -- remove |
| `skills/set-init/SKILL.md` | Deprecated redirect skill | Existing -- remove |
| `skills/execute/SKILL.md` | Deprecated redirect skill | Existing -- remove |

## Integration Points

- **Exports:**
  - `readRegistry(cwd)` -- frozen read-only registry accessor (renamed from `loadRegistry`), consumed by all command handlers and `src/lib/stub.cjs`
  - `withRegistryUpdate(cwd, mutationFn)` -- lock-protected mutation callback (renamed from `registryUpdate`), consumed by worktree, execute, and merge commands
  - Review artifact paths relocated to `.planning/sets/{setId}/REVIEW-*.md`, consumed by review and merge commands

- **Imports:**
  - `src/commands/*.cjs` from `cli-restructuring` set (already merged) -- the split command handler files where renames and path fixes are applied

- **Side Effects:**
  - After this set merges, any external code or agent prompt referencing `loadRegistry` or `registryUpdate` by name will break -- all references must be updated atomically
  - The `.planning/waves/{setId}/` path convention for review artifacts is removed; only `.planning/sets/{setId}/` is valid
  - Six deprecated skill directories are deleted; any `/rapid:plan`, `/rapid:execute`, `/rapid:discuss`, `/rapid:set-init`, `/rapid:wave-plan`, `/rapid:new-milestone` invocations will fail (they already redirect to the correct skills)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rename miss -- a `loadRegistry`/`registryUpdate` call site is overlooked | High -- runtime crash on undefined function | Grep-based exhaustive search; run full test suite after rename wave |
| Merge conflict with `review-pipeline` set (both touch `src/lib/review.cjs`) | Medium -- manual conflict resolution | Merge `structural-cleanup` first since it is a mechanical rename; `review-pipeline` adds new logic |
| `path.resolve()` behavior change with absolute cwd inputs | Low -- `path.resolve('/abs', 'rel')` and `path.join('/abs', 'rel')` produce the same result for absolute first args | Only changes behavior when cwd is relative, which is the bug being fixed |
| Deprecated skill removal breaks user muscle memory | Low -- users get "skill not found" instead of redirect | The redirect skills have been deprecated for the full v3.x cycle; help skill already documents the new names |
| Comment-marker removal in build-agents changes stub generation behavior | Medium -- core agents may get overwritten | Ensure SKIP_GENERATION list is the single source of truth; verify existing hand-written agents are preserved by other means |

## Wave Breakdown (Preliminary)

- **Wave 1:** Registry function renames -- rename `loadRegistry` to `readRegistry` and `registryUpdate` to `withRegistryUpdate` in `src/lib/worktree.cjs`, update `module.exports`, update all tests in `src/lib/worktree.test.cjs`, and propagate to all consumer files (commands, lib, test files). Run test suite to confirm zero breakage.
- **Wave 2:** Path resolution and artifact relocation -- convert `path.join()` with relative cwd to `path.resolve()` across all files, relocate review artifact paths from `.planning/waves/{setId}/` to `.planning/sets/{setId}/` in `src/lib/review.cjs`, `src/lib/execute.cjs`, and `src/commands/review.cjs`. Add behavioral tests enforcing `path.resolve()` usage.
- **Wave 3:** Dead code and deprecated skill removal -- remove comment-marker-based detection in `handleBuildAgents()` (line 282-289 of `src/commands/build-agents.cjs`), delete the 6 deprecated redirect-only skills from `skills/`, update `skills/help/SKILL.md` to remove deprecated command references, and add tests asserting no deprecated skills exist.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
