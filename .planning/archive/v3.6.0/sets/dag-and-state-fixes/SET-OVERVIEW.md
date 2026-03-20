# SET-OVERVIEW: dag-and-state-fixes

## Approach

This set addresses a family of interconnected DAG lifecycle bugs that cause downstream failures across the RAPID pipeline. The root cause is that DAG.json loading is scattered across multiple modules with inconsistent paths and no centralized error handling -- merge.cjs uses `.planning/DAG.json` while plan.cjs and add-set.cjs use `.planning/sets/DAG.json`, and none handle missing-file gracefully. Additionally, DAG.json is never created during init (only during add-set), so the first run after `/rapid:init` has no DAG to read.

The fix strategy is consolidation-first: introduce a single `tryLoadDAG(cwd)` function in dag.cjs that encapsulates the canonical path (`.planning/sets/DAG.json`) and returns null on ENOENT instead of throwing. Then systematically migrate every consumer (merge.cjs, plan.cjs, add-set.cjs) to call this function. This eliminates the path inconsistency and ENOENT crash bugs in one pass. A parallel track fixes the execute-set state transition ordering bug where git commit runs before the state transition, causing sets to get stuck in "executing" status if the commit fails.

The work naturally splits into three waves: foundation (the tryLoadDAG utility + tests), consumer migration (merge/plan/add-set rewrites), and SKILL.md updates (execute-set Step 6 reordering, init DAG creation). The foundation must land first since all consumers depend on it.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/dag.cjs | DAG operations -- will gain `tryLoadDAG()` | Existing (modify) |
| src/lib/dag.test.cjs | Tests for dag.cjs -- will add ENOENT and path tests | Existing (modify) |
| src/lib/merge.cjs | Merge pipeline -- fix wrong DAG path in `detectCascadeImpact()` (line 2007) | Existing (modify) |
| src/lib/merge.test.cjs | Merge tests -- add path correctness assertions | Existing (modify) |
| src/lib/plan.cjs | Planning lib -- migrate `writeDAG()`/consumers to use tryLoadDAG | Existing (modify) |
| src/lib/plan.test.cjs | Plan tests -- verify tryLoadDAG integration | Existing (modify) |
| src/lib/add-set.cjs | Add-set -- migrate `recalculateDAG()` DAG reads to tryLoadDAG | Existing (modify) |
| src/lib/add-set.test.cjs | Add-set tests -- verify tryLoadDAG integration | Existing (modify) |
| skills/execute-set/SKILL.md | Execute-set skill -- reorder Step 6 (state before commit) | Existing (modify) |
| skills/init/SKILL.md | Init skill -- add `recalculateDAG()` call after roadmap acceptance | Existing (modify) |

## Integration Points

- **Exports:**
  - `tryLoadDAG(cwd)` -- Centralized DAG loader returning `{ dag, path }` with null-on-ENOENT. All DAG consumers in the codebase must use this.
  - `recalculateDAG(cwd, milestoneId)` -- Already exists in add-set.cjs; will be called from init SKILL.md after STATE.json write.
  - `reliableStateTransition` -- Execute-set Step 6 reordered so state transition runs before git commit.

- **Imports:** None. This set has no dependencies on other sets.

- **Side Effects:**
  - After this set, missing DAG.json no longer crashes any command -- consumers degrade gracefully with informational messages.
  - The init flow will produce DAG.json immediately, so subsequent commands (start-set, execute-set, merge) always find it.
  - Execute-set will no longer leave sets stuck in "executing" status on git commit failure.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| merge.cjs path change breaks existing merge flows that relied on `.planning/DAG.json` | Medium | The old path was already wrong (no DAG exists there); switching to canonical path fixes rather than breaks behavior. Tests will verify. |
| tryLoadDAG returning null instead of throwing changes error semantics for callers | Medium | Every existing caller already has try/catch around DAG reads; null-return is strictly safer. Tests cover all consumer call sites. |
| SKILL.md edits (markdown) are not testable via unit tests | Low | Behavioral invariant "state-before-commit" is documented; manual review during /rapid:review will verify ordering. |
| recalculateDAG at init requires STATE.json to already exist | Low | The call is sequenced after STATE.json write in the init SKILL.md. add-set.cjs already handles this correctly. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Create `tryLoadDAG()` in dag.cjs with full test coverage (ENOENT, valid DAG, canonical path assertion). This is the dependency for all other work.
- **Wave 2:** Consumer migration -- Update merge.cjs (`detectCascadeImpact` path fix + tryLoadDAG adoption), plan.cjs, and add-set.cjs to use tryLoadDAG. Update corresponding test files.
- **Wave 3:** Skill updates and integration -- Reorder execute-set SKILL.md Step 6 (state transition before git commit), add `recalculateDAG()` call to init SKILL.md after roadmap acceptance. Final integration test pass.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
