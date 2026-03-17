# CONTEXT: structural-cleanup

**Set:** structural-cleanup
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
Six targeted refactoring tasks that improve naming clarity, path safety, and codebase hygiene across RAPID's core libraries and command handlers. No user-facing behavior changes -- internal API renames, path hardening, dead-code removal, and artifact relocation. Depends on `cli-restructuring` (merged) for split command handler files.

Scope: `src/lib/worktree.cjs`, all command handlers in `src/commands/*.cjs`, `src/lib/review.cjs`, `src/lib/execute.cjs`, `src/lib/stub.cjs`, test files, agent role modules in `src/modules/roles/`, SKILL.md files, and 6 deprecated skill directories.
</domain>

<decisions>
## Implementation Decisions

### Registry Rename Strategy
- **Hard cut, all files**: Remove `loadRegistry` and `registryUpdate` entirely with no backward-compatible aliases.
- Rename to `readRegistry` and `withRegistryUpdate` as specified in CONTRACT.json.
- Update ALL references: .cjs source files, test files, AND markdown files (SKILL.md, agent role modules) that reference the old function names.
- 57 call sites across 11 source files, plus markdown references.

### Wave-to-Set Path Migration
- **Code + migrate artifacts**: Update all `.planning/waves/{setId}/` path references in source code to `.planning/sets/{setId}/`.
- Add a migration step that physically moves existing `.planning/waves/` artifacts to `.planning/sets/`.
- No backward-compatibility fallback -- clean cut to new paths.
- Update all test fixtures referencing `.planning/waves/` to use `.planning/sets/`.

### Deprecated Skill Removal
- **Hard delete**: Remove all 6 deprecated redirect-only skill directories entirely (`new-milestone`, `plan`, `wave-plan`, `discuss`, `set-init`, `execute`).
- Users will get "skill not found" if they attempt old names.
- Update help skill's command list to remove deprecated entries.

### Claude's Discretion
- **path.resolve() conversion scope**: Determine which `path.join(cwd, ...)` calls need conversion to `path.resolve()` based on whether cwd could be relative. Apply mechanical transform where appropriate; leave `path.join()` calls that are already safe (e.g., using `process.cwd()` which is always absolute).
- **Comment-marker detection cleanup**: Verify current state of `handleBuildAgents()` in `build-agents.cjs` and remove any remaining comment-marker-based agent detection, ensuring SKIP_GENERATION list is the sole mechanism.
</decisions>

<specifics>
## Specific Ideas
- Migration utility for `.planning/waves/` should be a one-time operation, not a persistent fallback
- The rename should be atomic across all files to avoid partial states where old and new names coexist
- Test suite must pass after each wave to catch any missed rename sites
</specifics>

<code_context>
## Existing Code Insights
- `loadRegistry` defined at `src/lib/worktree.cjs:206`, `registryUpdate` at line 241, exported at line 945/947
- 57 total occurrences across 11 files: worktree.cjs(10), commands/worktree.cjs(7), commands/merge.cjs(7), commands/execute.cjs(7), lib/merge.cjs(4), lib/execute.cjs(4), commands/review.cjs(2), lib/stub.cjs(2), commands/set-init.cjs(1), lib/worktree.test.cjs(12), bin/rapid-tools.test.cjs(1)
- `.planning/waves/` referenced in: lib/review.cjs, lib/execute.cjs, modules/roles/role-plan-verifier.md, bin/rapid-tools.test.cjs
- 20+ `path.join(cwd, ...)` calls across command handlers; some use `process.cwd()` (always absolute), others accept `cwd` parameter (potentially relative)
- SKIP_GENERATION in build-agents.cjs already covers planner, executor, merger, reviewer -- no visible comment-marker detection remaining in current code
- 6 deprecated skills confirmed present: skills/{new-milestone,plan,wave-plan,discuss,set-init,execute}/SKILL.md
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion
</deferred>
