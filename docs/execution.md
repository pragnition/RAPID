[DOCS.md](../DOCS.md) > Execution

# Execution

One command handles all execution for a set, with built-in crash recovery and re-entry.

## `/rapid:execute-set <set-id> [--gaps]`

Runs one `rapid-executor` agent per wave, processing waves sequentially. Within each wave, the executor implements all tasks from the wave's PLAN.md file, committing atomically per task.

### Execution flow

1. The skill reads all PLAN.md files to determine which waves exist and their order.
2. For each wave, one `rapid-executor` agent is spawned with the wave's PLAN.md as input.
3. The executor implements tasks in order, committing each completed task.
4. A WAVE-COMPLETE.md marker is created after each wave finishes.
5. After all waves complete, a lean `rapid-verifier` agent checks that set objectives are met.

### Artifact-based completion detection

The executor determines what work is done by reading planning artifacts -- not from stored state. It checks which PLAN.md files have corresponding implementation commits via WAVE-COMPLETE.md markers and git log. This design makes execution fully re-entrant.

### Re-entry after crash

On every invocation, the skill scans planning artifacts to classify each wave:

- **Waves with WAVE-COMPLETE.md markers** are skipped (already done)
- **The first incomplete wave** resumes from its last committed task
- **Subsequent waves** execute normally

Re-running `/rapid:execute-set` after an interruption picks up exactly where things left off. No manual state recovery is needed.

### Pause and resume

For intentional interruptions, use `/rapid:pause` to save execution state to HANDOFF.md. This records the current wave/job progress and any user notes. Later, `/rapid:resume` restores context and continues execution from the checkpoint.

### Solo mode

When a set is configured for solo mode (no worktree), execution works directly on main. The diff base is the `startCommit` hash recorded when the set was started. After all waves complete and verification passes, solo sets auto-transition to `merged` since there is no branch to merge separately.

### Gap-closure mode

The `--gaps` flag enables execution of gap-closure waves on merged sets. Gap-closure waves are numbered after existing waves and never re-execute previously completed work. The set remains in `merged` status throughout.

### State transitions

- `planned` -> `executed` (when execution starts)
- `executed` -> `complete` (after verification passes)
- `complete` -> `merged` (automatic for solo sets)

### Agents spawned

- 1 `rapid-executor` per wave (sequential)
- 1 `rapid-verifier` after all waves complete

See [skills/execute-set/SKILL.md](../skills/execute-set/SKILL.md) for full details.

---

Next: [Review](review.md)
