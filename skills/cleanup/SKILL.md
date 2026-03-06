---
description: Clean up completed worktrees with safety checks -- removes worktree directory while preserving branches
allowed-tools: Bash, Read, AskUserQuestion
---

# /rapid:cleanup -- Worktree Cleanup

You are the RAPID worktree cleanup assistant. This skill safely removes completed worktrees after their work is done. It blocks removal if uncommitted changes exist and preserves branches by default. Follow these steps IN ORDER.

## Step 1: Show Current Worktrees

Run the status command to see all active worktrees:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" worktree status
```

Display the output so the user can see which worktrees exist and their current state.

**If no worktrees exist** (the output shows "No active worktrees"):
Inform the user: "No active worktrees found. Nothing to clean up." and exit. Do not continue to further steps.

## Step 2: Select Worktree to Clean Up

**If 4 or fewer worktrees:**

Use AskUserQuestion to let the developer select which worktree to remove:
- **question:** "Select worktree to clean up"
- **options:** One option per worktree, where:
  - **name:** The set name (e.g., `auth-core`)
  - **description:** Status summary (e.g., "Phase: Done, Merge: merged" or "Phase: Executing, Merge: pending")

**If more than 4 worktrees:**

Display a numbered text list of all worktrees with their status, then ask the developer to type the set name they want to clean up via freeform input.

**If the selected set name does not match an existing worktree:**
Inform the user which set names are available and re-prompt using the same approach.

## Step 3: Confirm Removal

Use AskUserQuestion to confirm the removal:
- **question:** "Remove worktree"
- **options:**
  - "Remove worktree" -- description: "Deletes .rapid-worktrees/{name} directory. Branch rapid/{name} preserved."
  - "Cancel" -- description: "Keep worktree as-is, exit cleanup"

**If "Remove worktree":** Continue to Step 4.
**If "Cancel":** Inform the user: "Cleanup cancelled." and exit.

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

Use AskUserQuestion to offer recovery options:
- **question:** "Dirty worktree blocks removal"
- **options:**
  - "Commit changes" -- description: "Run git -C .rapid-worktrees/{name} add -A && git -C .rapid-worktrees/{name} commit -m 'WIP: save before cleanup'"
  - "Stash changes" -- description: "Run git -C .rapid-worktrees/{name} stash push -m 'rapid-cleanup-stash'"
  - "Force remove" -- description: "Permanently discards uncommitted changes"
  - "Cancel" -- description: "Keep worktree as-is, exit cleanup"

Handle each selection:

**If "Commit changes":**
Run the commit commands shown in the description:
```bash
git -C .rapid-worktrees/{name} add -A && git -C .rapid-worktrees/{name} commit -m 'WIP: save before cleanup'
```
Then retry cleanup from Step 4.

**If "Stash changes":**
Run the stash command shown in the description:
```bash
git -C .rapid-worktrees/{name} stash push -m 'rapid-cleanup-stash'
```
Then retry cleanup from Step 4.

**If "Force remove":**
Trigger a double confirmation gate. Use AskUserQuestion:
- **question:** "Confirm force removal"
- **options:**
  - "Confirm force remove" -- description: "This permanently discards all uncommitted changes in {name}. Cannot be undone."
  - "Cancel" -- description: "Go back, keep worktree as-is"

If "Confirm force remove": Execute force removal:
```bash
git worktree remove --force .rapid-worktrees/{name}
```
Then update the registry by running:
```bash
node "${RAPID_TOOLS}" worktree cleanup {name} --force
```
Inform the user the worktree was force-removed and branch `rapid/{name}` is preserved.

If "Cancel": Return to the dirty worktree recovery prompt (re-show the 4-option AskUserQuestion from above).

**If "Cancel":**
Inform the user: "Cleanup cancelled. Worktree kept as-is." and exit.

**If other error** (JSON contains `removed: false` with other reason):

Display the error message from the JSON output and suggest the user investigate manually.

## Important Notes

- **Branch retention:** Per project convention, this skill only removes the worktree checkout directory. The git branch (`rapid/{name}`) is preserved for reference. Branch deletion is a separate operation handled by the user.
- **Safety checks:** The cleanup command is backed by `git worktree remove`, which refuses to remove worktrees with uncommitted or untracked changes. This is a safety feature, not a bug.
- **Registry update:** On successful removal, the worktree entry is automatically removed from REGISTRY.json. No manual registry cleanup is needed.
- **Force removal:** Dirty worktrees can be force-removed via the structured recovery prompt. Force removal requires double confirmation to prevent accidental data loss.
