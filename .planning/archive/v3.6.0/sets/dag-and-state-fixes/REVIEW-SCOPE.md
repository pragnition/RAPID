# REVIEW-SCOPE: dag-and-state-fixes

<!-- SCOPE-META {"setId":"dag-and-state-fixes","date":"2026-03-19T07:10:23.768Z","postMerge":false,"worktreePath":"/home/kek/Projects/RAPID/.rapid-worktrees/dag-and-state-fixes","totalFiles":23,"useConcernScoping":true} -->

## Set Metadata

| Field | Value |
|-------|-------|
| Set ID | dag-and-state-fixes |
| Date | 2026-03-19T07:10:23.768Z |
| Post-Merge | false |
| Worktree Path | /home/kek/Projects/RAPID/.rapid-worktrees/dag-and-state-fixes |
| Total Files | 23 |
| Concern Scoping | true |

## Changed Files

| File | Wave Attribution |
|------|-----------------|
| `skills/execute-set/SKILL.md` | wave-2 |
| `skills/init/SKILL.md` | wave-2 |
| `src/lib/dag.cjs` | wave-1 |
| `src/lib/dag.test.cjs` | wave-1 |
| `src/lib/merge.cjs` | wave-2 |
| `src/lib/merge.test.cjs` | wave-2 |
| `src/lib/plan.cjs` | wave-2 |

## Dependent Files

| File |
|------|
| `src/commands/commands.test.cjs` |
| `src/commands/execute.cjs` |
| `src/commands/merge.cjs` |
| `src/commands/misc.cjs` |
| `src/commands/plan.cjs` |
| `src/commands/plan.test.cjs` |
| `src/lib/add-set.cjs` |
| `src/lib/execute.cjs` |
| `src/lib/plan.test.cjs` |
| `src/lib/review.cjs` |
| `src/lib/state-machine.cjs` |
| `src/lib/stub.cjs` |
| `src/lib/ui-contract.cjs` |
| `src/lib/worktree.cjs` |
| `src/lib/worktree.test.cjs` |
| `tests/merge-regression.test.cjs` |

## Directory Chunks

### Chunk 1: src/lib

- `src/lib/dag.cjs`
- `src/lib/dag.test.cjs`
- `src/lib/merge.cjs`
- `src/lib/merge.test.cjs`
- `src/lib/plan.cjs`
- `src/lib/add-set.cjs`
- `src/lib/execute.cjs`
- `src/lib/plan.test.cjs`
- `src/lib/review.cjs`
- `src/lib/state-machine.cjs`
- `src/lib/stub.cjs`
- `src/lib/ui-contract.cjs`
- `src/lib/worktree.cjs`
- `src/lib/worktree.test.cjs`

### Chunk 2: src/commands

- `src/commands/commands.test.cjs`
- `src/commands/execute.cjs`
- `src/commands/merge.cjs`
- `src/commands/misc.cjs`
- `src/commands/plan.cjs`
- `src/commands/plan.test.cjs`
- `skills/execute-set/SKILL.md`
- `skills/init/SKILL.md`
- `tests/merge-regression.test.cjs`

## Wave Attribution

| File | Wave |
|------|------|
| `src/lib/dag.cjs` | wave-1 |
| `src/lib/dag.test.cjs` | wave-1 |
| `src/lib/merge.cjs` | wave-2 |
| `src/lib/merge.test.cjs` | wave-2 |
| `skills/execute-set/SKILL.md` | wave-2 |
| `skills/init/SKILL.md` | wave-2 |
| `src/lib/plan.cjs` | wave-2 |

## Concern Scoping

### dag-lifecycle

- `src/lib/dag.cjs`
- `src/lib/dag.test.cjs`
- `src/lib/add-set.cjs`
- `src/lib/state-machine.cjs`
- `src/lib/worktree.cjs`
- `src/lib/worktree.test.cjs`
- `src/lib/ui-contract.cjs`

### merge-pipeline

- `src/lib/merge.cjs`
- `src/lib/merge.test.cjs`
- `src/commands/merge.cjs`
- `src/lib/review.cjs`
- `tests/merge-regression.test.cjs`
- `src/lib/worktree.cjs`
- `src/lib/worktree.test.cjs`
- `src/lib/ui-contract.cjs`

### planning-and-set-management

- `src/lib/plan.cjs`
- `src/lib/plan.test.cjs`
- `src/commands/plan.cjs`
- `src/commands/plan.test.cjs`
- `src/commands/misc.cjs`
- `src/lib/worktree.cjs`
- `src/lib/worktree.test.cjs`
- `src/lib/ui-contract.cjs`

### execution-pipeline

- `src/commands/execute.cjs`
- `src/lib/execute.cjs`
- `src/lib/stub.cjs`
- `skills/execute-set/SKILL.md`
- `src/commands/commands.test.cjs`
- `src/lib/worktree.cjs`
- `src/lib/worktree.test.cjs`
- `src/lib/ui-contract.cjs`

### init-flow

- `skills/init/SKILL.md`
- `src/lib/worktree.cjs`
- `src/lib/worktree.test.cjs`
- `src/lib/ui-contract.cjs`

### Cross-Cutting Files

- `src/lib/worktree.cjs`: Git worktree management used across execution, merge, and planning concerns.
- `src/lib/worktree.test.cjs`: Tests for worktree utilities consumed by multiple concerns.
- `src/lib/ui-contract.cjs`: UI design contract validation cross-cuts planning and execution concerns.


## Acceptance Criteria

1. [wave-1] tryLoadDAG function exists in dag.cjs and is exported
2. [wave-1] DAG_CANONICAL_SUBPATH constant is exported
3. [wave-1] All existing dag.test.cjs tests still pass
4. [wave-1] New tryLoadDAG tests pass (ENOENT returns null, valid JSON returns parsed, malformed throws)
5. [wave-1] No changes to any consumer files (merge.cjs, plan.cjs, add-set.cjs) in this wave
6. [wave-2] merge.cjs detectCascadeImpact uses correct canonical DAG path via tryLoadDAG (the .planning/DAG.json bug is fixed)
7. [wave-2] merge.cjs getMergeOrder uses tryLoadDAG instead of inline fs.readFileSync
8. [wave-2] New merge.test.cjs tests cover both functions DAG loading behavior, including regression test for wrong path
9. [wave-2] Execute-set SKILL.md Step 6 has retry logic for state transition and resilient git commit
10. [wave-2] Init SKILL.md creates DAG.json via inline recalculateDAG call after STATE.json write
11. [wave-2] plan.cjs writeDAG uses DAG_CANONICAL_SUBPATH for path consistency
12. [wave-2] No remaining .planning/DAG.json (wrong path) references in src/lib/ directory
13. [wave-2] All existing tests pass (no regressions)
