# Merge and Cleanup

Three skills handle merging completed sets into main, removing worktrees, and advancing to the next milestone.

## `/rapid:merge` or `/rapid:merge <set-id>`

Merges completed set branches into main via subagent delegation in DAG order. Sets within a merge wave process sequentially so each merge sees the result of the previous one.

**Fast-path check** runs `git merge-tree --write-tree` before dispatching any subagent. If the merge is clean (exit code 0), the subagent is skipped entirely -- the set merges directly. This is the common case for well-isolated sets with strict file ownership.

**Subagent dispatch** handles conflicting merges. A `rapid-set-merger` subagent runs 5-level conflict detection (textual, structural, dependency, API, semantic) and applies a 4-tier resolution cascade. High-confidence resolutions (T1-T2) are applied automatically. Mid-confidence conflicts (0.3-0.8) are dispatched to dedicated `rapid-conflict-resolver` agents for deeper analysis. Low-confidence conflicts (below 0.3) and API-signature conflicts go directly to the developer. Resolver results with confidence above 0.7 are auto-accepted; below 0.7, they escalate to the developer with the resolver's analysis attached.

**Integration gates** run between merge waves. If integration tests fail, bisection recovery triggers automatically to identify the breaking set. Post-bisection, you choose to rollback the breaking set (with cascade impact detection), investigate manually, or abort.

**Idempotent re-entry** checks MERGE-STATE.json for each set -- already-merged sets are skipped, already-resolved sets proceed directly to merge execution. Max 2 total attempts per set (initial + 1 retry). If a specific set is provided, only that set and its unmerged dependencies are processed.

See [skills/merge/SKILL.md](../skills/merge/SKILL.md) for full step-by-step details.

## `/rapid:cleanup <set-id>`

Safely removes a completed set's worktree after its work is merged. The cleanup command uses `git worktree remove`, which blocks removal if uncommitted or untracked changes exist -- this is a safety feature. If blocked, structured recovery options let you commit changes, stash them, or force-remove with double confirmation. After removal, offers optional branch deletion (`git branch -d` for safe delete, `git branch -D` for force delete of unmerged branches).

See [skills/cleanup/SKILL.md](../skills/cleanup/SKILL.md) for full details.

## `/rapid:new-milestone`

Archives the current milestone and starts a new planning cycle. Reads current state, gathers milestone details (version, name, goals) through structured prompts, and handles unfinished sets with carry-forward options. Re-runs the full research pipeline (5 parallel research agents + synthesizer) scoped to the new milestone's goals, then the roadmapper proposes a new roadmap with sets, waves, and jobs. The roadmap goes through a propose-then-approve loop before writing to state.

See [skills/new-milestone/SKILL.md](../skills/new-milestone/SKILL.md) for full details.

---

Next: [Agent Reference](agents.md)
