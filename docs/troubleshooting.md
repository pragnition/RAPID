# Troubleshooting

Common issues you may encounter while using RAPID and how to resolve them.

---

### RAPID_TOOLS not set

**Symptom:** `[RAPID ERROR] RAPID_TOOLS is not set` appears on any `/rapid:*` command.

**Cause:** Your shell configuration was not sourced after installation, or the `.env` file is missing or corrupted. Every RAPID skill checks for this variable as its first operation.

**Fix:** Run `/rapid:install` to re-run the installation process. Alternatively, set the variable manually in your shell config and `.env` file:

```bash
export RAPID_TOOLS="/absolute/path/to/src/bin/rapid-tools.cjs"
```

Make sure both your shell profile (e.g., `~/.bashrc`, `~/.zshrc`, `~/.config/fish/config.fish`) and the project `.env` file contain the correct path.

---

### Stale lock files

**Symptom:** Commands hang or print `[RAPID] Lock "state" compromised`.

**Cause:** An agent crashed mid-operation, leaving a lock directory in `.planning/.locks/`. This prevents other agents from acquiring the lock.

**Fix:** Lock files auto-expire after 5 minutes (300,000ms stale threshold). If you are still stuck after 5 minutes, manually delete the stale lock:

```bash
rm -rf .planning/.locks/*.target.lock
```

See [State Machines](state-machines.md) for details on how state writes are protected by locks.

---

### STATE.json corruption

**Symptom:** `Cannot transition: STATE.json is missing or invalid` error, or state validation failures when running commands.

**Cause:** Concurrent writes without proper locking (should not happen under normal operation), manual edits to STATE.json, or a crash during an atomic write operation.

**Fix:** Diagnose the issue first, then recover from git:

```bash
node "$(echo ~)/path/to/rapid-tools.cjs" state detect-corruption
node "$(echo ~)/path/to/rapid-tools.cjs" state recover
```

Recovery runs `git checkout HEAD -- .planning/STATE.json` to restore the last committed version. If you made intentional manual edits, they will be lost.

---

### execute-set fails mid-wave

**Symptom:** `/rapid:execute-set` crashes or an executor agent fails partway through a wave.

**Cause:** The executor agent hit its context window limit, the process was interrupted, or a task could not be completed.

**Fix:** Re-run `/rapid:execute-set`. The skill uses artifact-based completion detection -- it scans for WAVE-COMPLETE.md markers and existing commits to determine what is already done. Completed waves are skipped, and the first incomplete wave resumes from its last committed task.

No manual state recovery is needed. The system is fully re-entrant.

---

### Worktree cleanup blocked

**Symptom:** `/rapid:cleanup` refuses to remove a worktree, showing `removed: false, reason: "dirty"`.

**Cause:** Uncommitted changes exist in the worktree. RAPID blocks removal to prevent accidental data loss.

**Fix:** Navigate into the worktree, commit or stash your changes, then retry cleanup:

```bash
cd .rapid-worktrees/<set-name>
git add . && git commit -m "save work"
# Then retry /rapid:cleanup <set-id>
```

If you want to discard the uncommitted work entirely:

```bash
git worktree remove --force .rapid-worktrees/<set-name>
```

This is destructive and will lose any uncommitted changes in that worktree.

---

### Merge conflicts during merge pipeline

**Symptom:** `git merge-tree --write-tree` returns exit code 1. A subagent is dispatched for conflict resolution, or conflicts escalate to human review.

**Cause:** Two sets modified overlapping files or introduced semantic conflicts. This is normal in multi-set parallel development.

**Fix:** Follow the merge pipeline prompts. RAPID routes conflicts by confidence level:

- **High confidence (> 0.9):** Auto-resolved without intervention
- **Flagged (0.7 - 0.9):** Auto-resolved, flagged for review
- **Mid confidence (0.3 - 0.7):** Dispatched to `rapid-conflict-resolver` agent for deep analysis
- **Low confidence (< 0.3):** Escalated directly to you for manual resolution
- **API-signature conflicts:** Always require human direction

**Note:** Solo mode sets skip merge entirely -- their work is already on main.

---

### Contract validation failures

**Symptom:** `/rapid:merge` or `/rapid:plan-set` reports contract violations. The operation is blocked.

**Cause:** The set's implementation does not satisfy the interface contracts defined in CONTRACT.json. This can happen when a set modifies APIs that other sets depend on, or when planned work crosses interface boundaries.

**Fix:** Review the violation details in the error output. Common resolutions:

- **Missing exports:** Add the required exports to satisfy the contract
- **Type mismatches:** Update function signatures to match the contract definition
- **Boundary violations:** Move the violating code into the correct set's scope

After fixing, re-run the blocked command.

---

### Worktree conflicts

**Symptom:** `/rapid:start-set` fails because the worktree directory or branch already exists.

**Cause:** A previous attempt to start the set was interrupted, or the set was cleaned up without removing the branch.

**Fix:** Check for existing worktrees and branches:

```bash
git worktree list
git branch -a | grep rapid/
```

Remove the stale worktree and/or branch, then retry:

```bash
git worktree remove .rapid-worktrees/<set-name>
git branch -d rapid/<set-name>
/rapid:start-set <set-id>
```
