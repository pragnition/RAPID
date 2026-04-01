# SET-OVERVIEW: bug-fixes-foundation

## Approach

This set addresses three user-reported bugs and four foundational infrastructure improvements across the RAPID CLI toolchain. The bugs are: (1) `scaffoldProject()` unconditionally overwrites REQUIREMENTS.md even when it contains user-approved encoded criteria, (2) the `init scaffold` CLI parser accepts `--desc` but not `--description`, creating a confusing UX gap, and (3) the roadmapper's Step 9 overwrites the entire STATE.json instead of merging its output into the existing envelope (destroying `version`, `projectName`, `createdAt`, `rapidVersion` fields).

The infrastructure improvements harden the codebase for reliability and correctness: bumping the Node.js minimum from 18 to 20+ in `prereqs.cjs`, replacing `execSync` template-string interpolation with `execFileSync` argument arrays in `worktree.cjs` to prevent shell injection, extending `CONTRACT_META_SCHEMA` in `contract.cjs` to accept an optional `fileOwnership` field, and fixing `recalculateDAG()` in `add-set.cjs` to preserve existing DAG node annotations (group, priority, description) instead of stripping them to bare `{ id }` objects.

All seven tasks are independent of each other at the code level -- they touch distinct functions in distinct files -- so they parallelize naturally into waves ordered by risk and dependency on test infrastructure. Each fix ships with a regression test to prevent recurrence.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/commands/init.cjs` | CLI argument parser for `init scaffold` | Existing -- add `--description` alias |
| `src/lib/init.cjs` | `scaffoldProject()` and file generators | Existing -- add REQUIREMENTS.md content guard |
| `src/lib/init.test.cjs` | Tests for init scaffolding | Existing -- add regression tests |
| `src/lib/state-machine.cjs` | State read/write and transactions | Existing -- add `mergeStatePartial()` |
| `src/lib/state-machine.test.cjs` | State machine tests | Existing -- add merge partial tests |
| `src/lib/add-set.cjs` | `recalculateDAG()` for DAG rebuild | Existing -- preserve node annotations |
| `src/lib/add-set.test.cjs` | Tests for add-set operations | Existing -- add annotation preservation test |
| `src/lib/contract.cjs` | `CONTRACT_META_SCHEMA` Ajv schema | Existing -- add `fileOwnership` property |
| `src/lib/contract.test.cjs` | Contract validation tests | Existing -- add fileOwnership validation test |
| `src/lib/worktree.cjs` | Git worktree operations via `execSync` | Existing -- replace with `execFileSync` |
| `src/lib/worktree.test.cjs` | Worktree tests | Existing -- add shell injection safety test |
| `src/lib/prereqs.cjs` | Prerequisite version checks | Existing -- bump Node.js min to 20 |
| `src/lib/prereqs.test.cjs` | Prereqs tests | Existing -- update version expectation |
| `skills/init/SKILL.md` | Init skill orchestration docs | Existing -- update Step 9 to use `mergeStatePartial` |

## Integration Points

- **Exports:** `mergeStatePartial()` from state-machine.cjs (new function consumed by init SKILL.md Step 9); `--description` alias in CLI parser; fixed `recalculateDAG()` preserving annotations; `fileOwnership` schema field in contract.cjs; `execFileSync`-based git commands in worktree.cjs; REQUIREMENTS.md content guard in `scaffoldProject()`; Node 20+ minimum in prereqs.cjs
- **Imports:** None -- this set has no dependencies on other sets (CONTRACT.json `imports` is empty)
- **Side Effects:** `prereqs.cjs` change will reject Node.js < 20 at runtime; `worktree.cjs` change alters how git subprocesses are spawned (argument arrays vs template strings); `mergeStatePartial()` changes how STATE.json is written during init Step 9

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `execFileSync` migration breaks git command behavior in worktree.cjs (5 call sites including `gitExec` helper, `installDeps`, and cleanup logic) | High | Test each call site individually; `execFileSync` does not spawn a shell, so shell features like globbing must not be relied upon -- audit each call |
| `mergeStatePartial()` Zod validation rejects partial updates with missing required fields | Medium | Merge into a complete state object before validation; test with real Zod schema |
| REQUIREMENTS.md content-check regex is too broad or too narrow for "encoded criteria" detection | Low | Define a specific marker pattern (e.g., `## Encoded Criteria` heading or frontmatter flag) rather than heuristic content sniffing |
| `recalculateDAG()` annotation preservation misses newly-added node properties | Low | Use object spread `{ ...existingNode, id: s.id }` to carry forward all properties, not just known ones |

## Wave Breakdown (Preliminary)

- **Wave 1:** Low-risk, isolated fixes -- `--description` alias in CLI parser, Node.js minimum bump in prereqs.cjs, `fileOwnership` schema extension in contract.cjs (3 tasks, no cross-file dependencies)
- **Wave 2:** Core bug fixes -- REQUIREMENTS.md overwrite guard in init.cjs, `recalculateDAG()` annotation preservation in add-set.cjs, `mergeStatePartial()` implementation in state-machine.cjs + SKILL.md Step 9 update (3 tasks, moderate complexity)
- **Wave 3:** Security hardening -- `execSync` to `execFileSync` migration in worktree.cjs (1 task, highest risk due to multiple call sites and behavioral differences between `execSync` and `execFileSync`)

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
