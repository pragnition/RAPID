# Set Status Naming: `-ing` Suffixes Are Misleading

## Problem

The 6 set statuses use `-ing` (present progressive) suffixes but actually represent **completed** states:

| Current Name | Set After | Actually Means |
|---|---|---|
| `pending` | init | Not started (correct) |
| `discussing` | discuss-set **completes** | "discussed" — ready for planning |
| `planning` | plan-set **completes** | "planned" — ready for execution |
| `executing` | execute-set **completes** (?) | "executed" — ready for review |
| `complete` | review/all work done | Done (correct) |
| `merged` | merge **completes** | Merged (correct) |

The `-ing` suffix implies "currently in progress," but the transitions happen **after** the phase finishes. For example, `discussing` is set at the very end of discuss-set (Step 8), not at the start. The plan-set skill then checks for `discussing` as a precondition — meaning it reads "discussing" as "has been discussed."

## Suggested Rename

```
pending → pending       (no change)
discussing → discussed
planning → planned
executing → executed    (or just drop — `complete` already covers post-execution)
complete → complete     (no change)
merged → merged         (no change)
```

## Files That Need Updating

### Core definitions
- `src/lib/state-schemas.cjs:4` — `SetStatus` zod enum
- `src/lib/state-transitions.cjs:3-8` — `SET_TRANSITIONS` map

### Tests
- `src/lib/state-schemas.test.cjs:25` — valid statuses array
- `src/lib/state-transitions.test.cjs:15-16` — pending targets
- `src/lib/state-transitions.test.cjs:65-66` — full chain test
- `src/lib/state-machine.lifecycle.test.cjs:77` — lifecycle test

### Skills (string references in SKILL.md files)
- `skills/discuss-set/SKILL.md` — transitions to `discussing`, checks for `discussing`/`planning`
- `skills/plan-set/SKILL.md` — expects `discussing`, transitions to `planning`
- `skills/execute-set/SKILL.md` — expects `planning`, transitions to `executing`
- Any other skills referencing set status values

### CLI tool
- `src/bin/rapid-tools.cjs:1341` — `set.status === 'pending'` in `list-available`

### Agents (generated prompts referencing statuses)
- Grep for `discussing|planning|executing` across `agents/` directory

## Scope

This is a cross-cutting rename. Every string literal matching the old status names needs updating. A find-and-replace approach works but requires care since `planning` and `executing` appear in non-status contexts (e.g., "planning phase", "executing jobs").

## Alternative: Document the Convention Instead

If renaming is too disruptive, the alternative is to explicitly document in DOCS.md / technical_documentation.md that `-ing` statuses represent completed phases, not in-progress ones. The cognitive mismatch remains but is at least explained.

---

# Parallel Wave Execution Within a Set

## Current Behavior

Waves within a set execute **sequentially** (wave 1, then 2, then 3...). Each wave gets one `rapid-executor` agent. This is a simplification, not a hard constraint.

## Opportunity

Independent waves (no shared files, no ordering dependency) could execute in parallel. The planner already tracks file ownership per wave, so dependency information exists.

## What Would Need to Change

- **execute-set SKILL.md** — replace the sequential `for each wave` loop with dependency-aware parallel dispatch. Spawn multiple `rapid-executor` agents via parallel Task tool calls for independent waves.
- **DAG awareness** — the wave planner already sequences waves by dependency. Waves at the same "depth" in the DAG are independent and parallelizable.
- **Git serialization** — parallel executors on the same worktree branch would create commit races. Options:
  1. Use a lock/queue for commits (simplest)
  2. Each wave commits to a temporary branch, then fast-forward merge sequentially
  3. Accept that only file-disjoint waves can truly parallelize
- **WAVE-COMPLETE.md markers** — already per-wave, so re-entry detection works unchanged.
- **Error handling** — if wave N fails while wave M is running in parallel, need to handle partial completion (current sequential model just stops).

## Complexity vs Payoff

Sets already run in parallel (isolated worktrees). Parallel waves within a set adds a second level of parallelism. The payoff depends on how often plans produce independent waves — if most waves are sequential by nature (wave 2 builds on wave 1's output), the gain is minimal.



# Old command cleanup
Some old commands now have depreciation stubs. we should remove those to make the UX cleaner
