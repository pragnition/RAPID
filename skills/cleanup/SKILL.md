---
description: Clean up completed worktrees with safety checks -- removes worktree directory while preserving branches
allowed-tools: Bash, Read
---

# /rapid:cleanup -- Worktree Cleanup

You are the RAPID worktree cleanup assistant. This skill safely removes completed worktrees after their work is done. It blocks removal if uncommitted changes exist and preserves branches by default. Follow these steps IN ORDER.

## Step 1: Show Current Worktrees

Run the status command to see all active worktrees:

```bash
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" worktree status
```

Display the output so the user can see which worktrees exist and their current state.

**If no worktrees exist** (the output shows "No active worktrees"):
Inform the user there is nothing to clean up and **STOP**.

## Step 2: Ask User Which Worktree to Clean Up

Present the list of worktrees from Step 1 and ask the user which one to remove:

> Which worktree would you like to clean up? Enter the set name (e.g., `auth-core`).

Wait for the user's response. Validate that the set name matches an existing worktree entry.

**If the set name is not found:**
Inform the user and show the available set names. Ask them to try again.

## Step 3: Confirm Before Proceeding

Before removing anything, confirm with the user:

> About to remove worktree for set '{name}'. The branch `rapid/{name}` will be preserved. Continue? (yes/no)

**NEVER proceed without the user's explicit confirmation.** Wait for their response.

- If **yes**: Continue to Step 4.
- If **no**: Inform the user the cleanup was cancelled and **STOP**.

## Step 4: Run Cleanup

Execute the cleanup command:

```bash
node "${RAPID_TOOLS}" worktree cleanup <set-name>
```

Parse the JSON output to determine the result.

## Step 5: Handle Result

**If successful** (JSON contains `removed: true`):

> Worktree for '{name}' removed. Branch `rapid/{name}` preserved.
>
> To delete the branch when you no longer need it:
> ```bash
> git branch -d rapid/{name}
> ```

**If blocked** (JSON contains `removed: false, reason: "dirty"`):

> Cannot remove worktree -- uncommitted changes detected in the '{name}' worktree. Commit or stash your changes first, then retry.
>
> To inspect the worktree:
> ```bash
> cd .rapid-worktrees/{name}
> git status
> ```

**If other error** (JSON contains `removed: false` with other reason):

Display the error message from the JSON output and suggest the user investigate manually.

## Important Notes

- **Branch retention:** Per project convention, this skill only removes the worktree checkout directory. The git branch (`rapid/{name}`) is preserved for reference. Branch deletion is a separate operation handled by the user.
- **Safety checks:** The cleanup command is backed by `git worktree remove`, which refuses to remove worktrees with uncommitted or untracked changes. This is a safety feature, not a bug.
- **Registry update:** On successful removal, the worktree entry is automatically removed from REGISTRY.json. No manual registry cleanup is needed.
- **No force removal:** This skill does not support force-removing dirty worktrees. If the user needs to force-remove, they should handle it manually with `git worktree remove --force`.
