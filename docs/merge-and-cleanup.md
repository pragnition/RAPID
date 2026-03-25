[DOCS.md](../DOCS.md) > Merge & Cleanup

# Merge and Cleanup

Several commands handle merging completed sets into main, removing worktrees, managing workflow state, and advancing to the next version.

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

### Solo mode handling

Solo sets (working directly on main without a branch) are detected automatically. Since their work is already on main, the merge pipeline skips them and auto-transitions the set to `merged` status.

### Contract validation

Before executing the merge, the pipeline validates that interface contracts defined in CONTRACT.json are satisfied. Contract violations block the merge.

### State transition

The set moves to `merged` as its terminal state after successful merge.

See [skills/merge/SKILL.md](../skills/merge/SKILL.md) for full details.

## `/rapid:cleanup <set-id>`

Safely removes a completed set's worktree after its work is merged. Uses `git worktree remove`, which blocks removal if uncommitted or untracked changes exist. If blocked, structured recovery options let you commit changes, stash them, or force-remove with double confirmation. After removal, offers optional branch deletion.

See [skills/cleanup/SKILL.md](../skills/cleanup/SKILL.md) for full details.

## `/rapid:new-version [--spec <path>]`

Completes the current milestone and starts a new planning cycle. Reads current state, gathers new milestone details (version, name, goals) through structured prompts or from a spec file, and handles unfinished sets with carry-forward options (Archive or Keep -- user-chosen, not forced). Auto-discovers all DEFERRED.md files and includes their structured items in researcher briefs. Re-runs the full 6-researcher pipeline (stack, features, architecture, pitfalls, oversights, UX) scoped to the new milestone's goals, then the roadmapper proposes a new roadmap with sets. Goes through propose-then-approve before writing to state.

See [skills/new-version/SKILL.md](../skills/new-version/SKILL.md) for full details.

## `/rapid:pause <set-id>`

Saves the current set's state for later resumption. Creates a HANDOFF.md checkpoint with enough context to restore work in a future session. Records current wave/job progress and user notes. Warns after 3 pause cycles that the set scope may be too large.

See [skills/pause/SKILL.md](../skills/pause/SKILL.md) for full details.

## `/rapid:resume <set-id>`

Resumes a previously paused set from its last checkpoint. Loads HANDOFF.md context, presents the handoff summary, and transitions the set back to executing phase.

See [skills/resume/SKILL.md](../skills/resume/SKILL.md) for full details.

## `/rapid:migrate [--dry-run]`

Migrates `.planning/` state from older RAPID versions to the current version. Detects the current version, compares against the running RAPID version, and guides an interactive migration. Handles schema changes, status renames, and structural updates. Supports dry-run mode to preview changes without applying them.

See [skills/migrate/SKILL.md](../skills/migrate/SKILL.md) for full details.

## `/rapid:bug-fix <description>`

Investigates and fixes bugs. The user describes a bug, and the skill dispatches agents to investigate the codebase and apply a targeted fix with atomic commits. Works from any branch -- no set association required.

See [skills/bug-fix/SKILL.md](../skills/bug-fix/SKILL.md) for full details.

---

Next: [Agent Reference](agents.md)
