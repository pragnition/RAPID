# SET-OVERVIEW: bug-fixes

## Approach

This set addresses two discrete UX bugs that surface during the daily RAPID workflow: a DEFINITION.md path resolution failure in `generateScopedClaudeMd()` and a flawed gray-area question assembly in the discuss-set skill. Both bugs are independently reproducible and have narrow blast radius, making them well-suited for a single focused set.

The DEFINITION.md bug likely stems from a path resolution mismatch inside `plan.loadSet()` (called by `generateScopedClaudeMd()` in `src/lib/worktree.cjs`). When `cwd` is the worktree root rather than the project root, or when the set ID format used during init differs from the format resolved by `resolve set`, the file read fails. The fix involves ensuring `loadSet()` always resolves the DEFINITION.md path relative to the true project root, with a pre-flight existence check and clear error messaging.

The discuss-set UX bug is in `skills/discuss-set/SKILL.md` Step 5, where "Let Claude decide all" is presented as option 1 in the same AskUserQuestion multiselect alongside the 4 gray-area topics. This conflates a meta-action (skip all discussion) with per-topic selection. The fix restructures this into either a two-step prompt (first ask about autonomy level, then present topics if needed) or an implicit "Claude decides unselected topics" model with no explicit checkbox.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/worktree.cjs | Contains `generateScopedClaudeMd()` where the DEFINITION.md path is resolved | Existing -- modify |
| src/lib/plan.cjs | Contains `loadSet()` which reads DEFINITION.md from disk | Existing -- modify |
| src/lib/worktree.test.cjs | Tests for `generateScopedClaudeMd()` path resolution | Existing -- add cases |
| skills/discuss-set/SKILL.md | Skill definition with gray-area question assembly (Step 5) | Existing -- modify |
| src/commands/worktree.cjs | Command handler calling `generateScopedClaudeMd()` | Existing -- verify (post cli-restructuring) |

## Integration Points

- **Exports:**
  - Corrected DEFINITION.md path resolution in `generateScopedClaudeMd()` -- ensures all callers (worktree init, execute resume, worktree refresh-claude-md) find DEFINITION.md reliably
  - Restructured discuss-set gray-area question assembly -- "auto-decide" is no longer a peer checkbox alongside individual topics

- **Imports:**
  - From `cli-restructuring`: split command handler files at `src/commands/{command}.cjs` -- the DEFINITION.md path fix must be applied to the post-split file structure, not the monolithic `rapid-tools.cjs`

- **Side Effects:** Worktree `CLAUDE.md` generation will succeed silently where it previously logged warnings or errors about missing DEFINITION.md. Discuss-set interactive flow changes from a single multiselect question to a two-step interaction.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| cli-restructuring changes file layout; fix applied to wrong file | Medium | Dependency edge in DAG ensures cli-restructuring merges first; verify `src/commands/worktree.cjs` exists at execution time |
| Two-step discuss-set prompt increases interaction count | Low | Second prompt only appears when user chooses "Discuss specific areas"; --skip path is unchanged |
| `loadSet()` path fix could break callers that pass worktree path as cwd | Medium | Audit all `loadSet()` call sites; add unit tests for both project-root and worktree-root cwd values |
| AskUserQuestion single-select vs multiselect behavior differences | Low | Research notes confirm Enter-as-Tab bug in multiselect; use single-select for the meta-action prompt |

## Wave Breakdown (Preliminary)

- **Wave 1:** DEFINITION.md path resolution fix -- trace the bug in `loadSet()` / `generateScopedClaudeMd()`, apply fix, add unit tests covering project-root and worktree-root cwd scenarios, verify behavioral invariant `definitionMdAlwaysFound`
- **Wave 2:** Discuss-set UX restructuring -- modify Step 5 of `skills/discuss-set/SKILL.md` to separate meta-action from topic selection, verify behavioral invariant `noAutoDecideCheckbox`, update any tests referencing the old prompt structure

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
