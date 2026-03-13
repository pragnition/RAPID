# Merge and Cleanup

Three commands handle merging completed sets into main, removing worktrees, and advancing to the next version.

## `/rapid:merge` or `/rapid:merge <set-id>`

Merges completed set branches into main in DAG order. Sets process sequentially so each merge sees the result of the previous one.

### Clean merge fast-path

Before dispatching any subagent, the skill runs `git merge-tree --write-tree` to test for conflicts. If the merge is clean (exit code 0), the subagent is skipped entirely -- the set merges directly. This is the common case for well-isolated sets with strict file ownership.

### Conflicting merges

When conflicts exist, a `rapid-set-merger` subagent runs 5-level conflict detection:

1. **Textual** -- Line-level conflicts in the same file
2. **Structural** -- Incompatible code structure changes
3. **Dependency** -- Conflicting package or import changes
4. **API** -- Breaking interface changes between sets
5. **Semantic** -- Logically incompatible behavior changes

Resolution follows a 4-tier cascade:

| Tier | Confidence | Action |
|------|-----------|--------|
| T1 | > 0.9 | Auto-resolved, no review needed |
| T2 | 0.7 - 0.9 | Auto-resolved, flagged for review |
| T3 | 0.3 - 0.7 | Dispatched to `rapid-conflict-resolver` for deep analysis |
| T4 | < 0.3 | Escalated to developer for manual resolution |

API-signature conflicts always require human direction regardless of confidence score.

### Adaptive conflict resolution

Mid-confidence conflicts (T3) are dispatched to dedicated `rapid-conflict-resolver` agents for deep semantic analysis. Results with confidence above 0.7 are auto-accepted; below 0.7, they escalate to the developer with the resolver's analysis attached.

### Contract validation

Before executing the merge, the pipeline validates that interface contracts defined in CONTRACT.json are satisfied. Contract violations block the merge.

### State transition

The set moves to `merged` as its terminal state after successful merge.

See [skills/merge/SKILL.md](../skills/merge/SKILL.md) for full details.

## `/rapid:cleanup <set-id>`

Safely removes a completed set's worktree after its work is merged. Uses `git worktree remove`, which blocks removal if uncommitted or untracked changes exist. If blocked, structured recovery options let you commit changes, stash them, or force-remove with double confirmation. After removal, offers optional branch deletion.

See [skills/cleanup/SKILL.md](../skills/cleanup/SKILL.md) for full details.

## `/rapid:new-version`

Completes the current milestone and starts a new planning cycle. Reads current state, gathers new milestone details (version, name, goals) through structured prompts, and handles unfinished sets with carry-forward options (Archive or Keep -- user-chosen, not forced). Re-runs the full 6-researcher pipeline (stack, features, architecture, pitfalls, oversights, UX) scoped to the new milestone's goals, then the roadmapper proposes a new roadmap with sets. Goes through propose-then-approve before writing to state.

See [skills/new-version/SKILL.md](../skills/new-version/SKILL.md) for full details.

---

Next: [Agent Reference](agents.md)
