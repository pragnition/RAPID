# REVIEW-SCOPE: solo-mode

<!-- SCOPE-META {"setId":"solo-mode","date":"2026-03-19T09:00:00.000Z","postMerge":false,"worktreePath":"/home/kek/Projects/RAPID","totalFiles":20,"useConcernScoping":true} -->

## Set Metadata
| Field | Value |
|-------|-------|
| Set ID | solo-mode |
| Date | 2026-03-19T09:00:00.000Z |
| Post-Merge | false |
| Worktree Path | /home/kek/Projects/RAPID |
| Total Files | 20 |
| Concern Scoping | true |

## Changed Files
| File | Wave Attribution |
|------|-----------------|
| `.planning/sets/solo-mode/WAVE-1-COMPLETE.md` | wave-1 |
| `.planning/sets/solo-mode/WAVE-2-COMPLETE.md` | wave-2 |
| `.planning/sets/solo-mode/wave-1-PLAN-DIGEST.md` | wave-1 |
| `.planning/sets/solo-mode/wave-2-PLAN-DIGEST.md` | wave-2 |
| `skills/execute-set/SKILL.md` | wave-2 |
| `skills/merge/SKILL.md` | wave-2 |
| `skills/review/SKILL.md` | wave-2 |
| `src/commands/review.cjs` | wave-2 |
| `src/lib/worktree.cjs` | wave-1 |
| `src/lib/worktree.test.cjs` | wave-1 |

## Dependent Files
| File |
|------|
| `src/bin/rapid-tools.cjs` |
| `src/commands/commands.test.cjs` |
| `src/commands/execute.cjs` |
| `src/commands/merge.cjs` |
| `src/commands/set-init.cjs` |
| `src/commands/worktree.cjs` |
| `src/lib/execute.cjs` |
| `src/lib/merge.cjs` |
| `src/lib/review.test.cjs` |
| `src/lib/stub.cjs` |

## Directory Chunks
### Chunk 1: .planning/sets/solo-mode
- `.planning/sets/solo-mode/WAVE-1-COMPLETE.md`
- `.planning/sets/solo-mode/WAVE-2-COMPLETE.md`
- `.planning/sets/solo-mode/wave-1-PLAN-DIGEST.md`
- `.planning/sets/solo-mode/wave-2-PLAN-DIGEST.md`

### Chunk 2: src/commands
- `src/commands/review.cjs`
- `src/commands/commands.test.cjs`
- `src/commands/execute.cjs`
- `src/commands/merge.cjs`
- `src/commands/set-init.cjs`
- `src/commands/worktree.cjs`

### Chunk 3: src/lib + skills
- `src/lib/worktree.cjs`
- `src/lib/worktree.test.cjs`
- `src/lib/execute.cjs`
- `src/lib/merge.cjs`
- `src/lib/review.test.cjs`
- `src/lib/stub.cjs`
- `skills/execute-set/SKILL.md`
- `skills/merge/SKILL.md`
- `skills/review/SKILL.md`
- `src/bin/rapid-tools.cjs`

## Wave Attribution
| File | Wave |
|------|------|
| `src/lib/worktree.cjs` | wave-1 |
| `src/lib/worktree.test.cjs` | wave-1 |
| `.planning/sets/solo-mode/WAVE-1-COMPLETE.md` | wave-1 |
| `.planning/sets/solo-mode/wave-1-PLAN-DIGEST.md` | wave-1 |
| `skills/execute-set/SKILL.md` | wave-2 |
| `skills/merge/SKILL.md` | wave-2 |
| `skills/review/SKILL.md` | wave-2 |
| `src/commands/review.cjs` | wave-2 |
| `.planning/sets/solo-mode/WAVE-2-COMPLETE.md` | wave-2 |
| `.planning/sets/solo-mode/wave-2-PLAN-DIGEST.md` | wave-2 |
| `src/bin/rapid-tools.cjs` | unattributed |
| `src/commands/commands.test.cjs` | unattributed |
| `src/commands/execute.cjs` | unattributed |
| `src/commands/merge.cjs` | unattributed |
| `src/commands/set-init.cjs` | unattributed |
| `src/commands/worktree.cjs` | unattributed |
| `src/lib/execute.cjs` | unattributed |
| `src/lib/merge.cjs` | unattributed |
| `src/lib/review.test.cjs` | unattributed |
| `src/lib/stub.cjs` | unattributed |

## Concern Scoping

### Concern 1: solo-mode-core-library
- `src/lib/worktree.cjs` — Core solo-mode lifecycle functions: isSoloMode(), setInitSolo(), getSetDiffBase(), reconcileRegistry solo guard, solo status display
- `src/lib/worktree.test.cjs` — Unit tests for solo-mode functions: isSoloMode, getSetDiffBase, setInitSolo, reconcileRegistry solo guard (10 new tests)

### Concern 2: solo-mode-merge-pipeline
- `src/commands/merge.cjs` — CLI merge handler with solo fast-path: detect/resolve subcommands return empty results for solo entries, execute returns immediate success
- `src/lib/merge.cjs` — Merge library: mergeSet() returns {merged:true, solo:true} immediately for solo entries -- no git operations needed
- `skills/merge/SKILL.md` — Merge skill: Step 1d detects solo sets from registry, Step 3a-solo fast-paths them past conflict detection and subagent dispatch

### Concern 3: solo-mode-review-pipeline
- `src/commands/review.cjs` — Review scope CLI handler: resolves worktree paths and delegates to review.scopeSetForReview/scopeSetPostMerge
- `src/lib/review.test.cjs` — Unit tests for review library functions (findDependents, chunkByDirectory, scopeByConcern, waveAttribution, etc.)
- `skills/review/SKILL.md` — Review skill: documents solo set scoping using startCommit from registry instead of base branch, with cwd as working directory

### Concern 4: solo-mode-execution-pipeline
- `src/commands/execute.cjs` — Execute CLI handler: preserves solo/startCommit fields when updating registry phase for worktree entries
- `src/lib/execute.cjs` — Execute library: getChangedFiles detects solo mode from registry and uses startCommit as diff base instead of baseBranch
- `skills/execute-set/SKILL.md` — Execute skill: documents solo mode behavior -- git commits happen directly on current branch with same commit convention

### Concern 5: solo-mode-set-init-and-worktree-cli
- `src/commands/set-init.cjs` — Set init CLI: routes to setInitSolo() when --solo flag or config.solo=true, registers without creating worktree or branch
- `src/commands/worktree.cjs` — Worktree CLI: cleanup subcommand deregisters solo entries without removing worktree directories
- `src/bin/rapid-tools.cjs` — Main CLI entry point: imports and routes all command handlers including set-init and worktree
- `src/commands/commands.test.cjs` — CLI handler error behavior tests: validates CliError throwing for all handlers including execute, merge, review, worktree, set-init
- `src/lib/stub.cjs` — Contract stub generator: generates CommonJS stub modules from CONTRACT.json (no solo changes, but part of execute pipeline dependency)

### Concern 6: planning-and-tracking
- `.planning/sets/solo-mode/WAVE-1-COMPLETE.md` — Wave 1 completion marker: records commits 36da1a7/00f084b on rapid/solo-mode branch
- `.planning/sets/solo-mode/WAVE-2-COMPLETE.md` — Wave 2 completion marker: records commits 8b8d9b1/c00ea94/c91ad31/9a3c763 on rapid/solo-mode branch
- `.planning/sets/solo-mode/wave-1-PLAN-DIGEST.md` — Wave 1 plan digest: 4 tasks adding 3 solo lifecycle functions to worktree.cjs with 10 unit tests
- `.planning/sets/solo-mode/wave-2-PLAN-DIGEST.md` — Wave 2 plan digest: 4 tasks wiring solo functions into execute-set, merge, and review skills plus review command handler

## Acceptance Criteria
1. [wave-1] `autoMergeSolo`, `detectSoloAndSkip`, and `adjustReviewForSolo` are exported from `src/lib/worktree.cjs`
2. [wave-1] All three functions follow the signatures defined in CONTRACT.json
3. [wave-1] `isSoloMode()` is the single guard for all solo-specific behavior
4. [wave-1] All existing tests continue to pass
5. [wave-1] New tests pass for guard conditions and solo detection logic
6. [wave-1] `node --test src/lib/worktree.test.cjs` exits with code 0
7. [wave-2] Execute-set SKILL.md Step 6 contains solo auto-merge logic after the `complete` transition
8. [wave-2] Merge SKILL.md handles solo sets with informational message at Steps 1d and 3a-solo
9. [wave-2] Review SKILL.md Step 0c auto-detects solo+merged sets and routes to post-merge mode
10. [wave-2] `src/commands/review.cjs` correctly routes solo post-merge scoping through `scopeSetForReview` with `startCommit`
11. [wave-2] No regression in normal (non-solo) set lifecycle for any of the three skills
12. [wave-2] Solo auto-merge progress breadcrumb shows `merge [auto]` for solo sets
