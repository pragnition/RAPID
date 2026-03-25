# SET-OVERVIEW: path-and-dag

## Approach

This set consolidates two related reliability bugs: fragmented project-root resolution and broken DAG.json path lookups during merge. Both stem from the same root cause -- the codebase has two independent root-resolution functions (`findProjectRoot` in core.cjs and `resolveProjectRoot` in plan.cjs) that behave differently in worktree contexts. Merge and execute commands then build DAG paths relative to `cwd` instead of the resolved project root, causing "file not found" failures when invoked from worktrees or subdirectories.

The fix is a consolidation-then-propagation strategy. First, promote the worktree-aware `resolveProjectRoot()` from plan.cjs into core.cjs as the single canonical resolver, replacing the naive `findProjectRoot()` that only walks up looking for `.planning/`. Then update every call site across the codebase (merge.cjs, execute.cjs, worktree.cjs, ui-contract.cjs, rapid-tools.cjs, misc.cjs) to use the new canonical function. Finally, add a DAG generation step to the `/new-version` skill so DAG.json always exists before any merge operation can reference it.

The work is low-risk in isolation because the behavioral contract is simple: `resolveProjectRoot()` must return the same path regardless of whether it is called from main repo, a worktree, or a nested subdirectory. Every change can be validated with targeted unit tests before integration.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/core.cjs | Canonical `resolveProjectRoot()` home | Existing -- add function |
| src/lib/core.test.cjs | Tests for the new resolver | Existing -- extend |
| src/lib/plan.cjs | Current home of worktree-aware resolver | Existing -- refactor to import from core.cjs |
| src/lib/plan.test.cjs | Existing resolver tests | Existing -- update imports |
| src/lib/dag.cjs | DAG operations library | Existing -- verify path usage |
| src/lib/dag.test.cjs | DAG tests | Existing -- extend |
| src/lib/merge.cjs | Conflict resolution library | Existing -- fix path construction |
| src/lib/merge.test.cjs | Merge tests | Existing -- extend |
| src/commands/merge.cjs | Merge command (line 274 bug) | Existing -- fix hardcoded DAG path |
| src/commands/execute.cjs | Execute command (DAG path usage) | Existing -- fix path construction |
| src/lib/ui-contract.cjs | Duplicated resolveProjectRoot copy | Existing -- replace with core.cjs import |
| src/bin/rapid-tools.cjs | CLI entry point using findProjectRoot | Existing -- switch to resolveProjectRoot |
| src/commands/misc.cjs | Misc commands using findProjectRoot | Existing -- switch to resolveProjectRoot |
| skills/new-version/SKILL.md | New-version skill definition | Existing -- add DAG generation step |

## Integration Points

- **Exports:**
  - `resolveProjectRoot()` -- Single canonical worktree-aware project root resolver, usable by all modules
  - `ensureDagExists(projectRoot)` -- Pre-merge validation that DAG.json is present, with actionable error message
- **Imports:** None -- this set has no dependencies on other sets
- **Side Effects:**
  - The `/new-version` skill will now generate DAG.json as part of its workflow, so downstream merge operations can rely on its existence
  - `findProjectRoot()` is removed/deprecated -- any external code calling it must switch to `resolveProjectRoot()`

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Circular dependency if core.cjs imports git-related modules | High | Keep resolveProjectRoot self-contained with inline `execSync` call; no new requires |
| Breaking call sites that pass different argument shapes to findProjectRoot vs resolveProjectRoot | Medium | findProjectRoot takes optional `startDir`, resolveProjectRoot takes `cwd` -- audit all call sites and adapt arguments |
| ui-contract.cjs has its own copy of resolveProjectRoot with subtle differences | Medium | Diff the two implementations carefully; write a shared test that exercises both before and after |
| /new-version skill is a Markdown file, not code -- DAG generation step could be missed by agents | Low | Add explicit step numbering and a verification check that DAG.json exists after the step |

## Wave Breakdown (Preliminary)

- **Wave 1:** Extract `resolveProjectRoot()` into core.cjs, write comprehensive tests covering worktree/non-worktree/subdirectory scenarios, ensure backward compatibility shim for `findProjectRoot()`
- **Wave 2:** Propagate the new resolver to all call sites (merge.cjs:274, execute.cjs, ui-contract.cjs, rapid-tools.cjs, misc.cjs), fix DAG.json path construction to use resolved root, add `ensureDagExists()` validation
- **Wave 3:** Add DAG generation step to `/new-version` SKILL.md, add integration-level tests for the DAG-exists-after-new-version invariant, remove any remaining `findProjectRoot` references

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
