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

**Symptom:** Commands hang indefinitely or print `[RAPID] Lock "state-machine" compromised`.

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
node "${RAPID_TOOLS}" state detect-corruption
node "${RAPID_TOOLS}" state recover
```

Recovery runs `git checkout HEAD -- .planning/STATE.json` to restore the last committed version. If you made intentional manual edits, they will be lost.

See [State Machines](state-machines.md) for the full state schema and transition rules.

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

### Subagent timeout or missing return marker

**Symptom:** `Warning: Job '{jobId}' returned without a RAPID:RETURN marker. Marking as failed.` Jobs appear stuck in `executing` status.

**Cause:** The subagent hit its context window limit, crashed, or failed to emit the structured RAPID:RETURN marker at the end of its response.

**Fix:** Smart re-entry handles this automatically. Re-run the execute command:

```bash
/rapid:execute <set-id>
```

RAPID detects stale `executing` jobs and re-dispatches them. Failed jobs are retried automatically. The system tracks job state so completed work is never re-done.

---

### Merge conflicts during merge pipeline

**Symptom:** `git merge-tree --write-tree` returns exit code 1. A subagent is dispatched for conflict resolution, or conflicts escalate to human review.

**Cause:** Two sets modified overlapping files or introduced semantic conflicts. This is normal in multi-set parallel development.

**Fix:** Follow the merge pipeline prompts. RAPID routes conflicts by confidence level:

- **High confidence (> 0.8):** Auto-resolved without intervention
- **Mid confidence (0.3 - 0.8):** Dispatched to `rapid-conflict-resolver` agent for deep analysis
- **Low confidence (< 0.3):** Escalated directly to you for manual resolution
- **API-signature conflicts:** Always require human direction

If integration tests fail after merge, RAPID uses bisection recovery to identify the breaking set.
