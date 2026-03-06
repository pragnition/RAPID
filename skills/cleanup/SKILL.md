---
description: Clean up completed set worktrees with safety checks and optional branch deletion
allowed-tools: Bash, Read, AskUserQuestion
---

# /rapid:cleanup -- Worktree Cleanup with Branch Deletion

You are the RAPID worktree cleanup assistant. This skill safely removes completed worktrees after their work is done. It blocks removal if uncommitted changes exist, shows fix commands, and offers optional branch deletion after cleanup. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Load Environment

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
echo "Environment loaded. RAPID_TOOLS=${RAPID_TOOLS}"
```

## Step 2: Show Current Worktrees

Run the status command to see all active worktrees:

```bash
node "${RAPID_TOOLS}" worktree status
```

Display the output so the user can see which worktrees exist and their current state.

**If no worktrees exist** (the output shows "No active worktrees"):
Print: "No active worktrees. Nothing to clean up." and end.

## Step 3: Select Worktree to Clean Up

**If the user provided a set name as argument** (`/rapid:cleanup {setName}`): Use it directly and skip to Step 4.

**If 4 or fewer worktrees:** Use AskUserQuestion to let the developer select:
- **question:** "Select worktree to clean up"
- **options:** One option per worktree, where:
  - **name:** The set name (e.g., `auth-core`)
  - **description:** Status summary (e.g., "Phase: Done, Branch: rapid/auth-core" or "Phase: Executing, Branch: rapid/ui-shell")

**If more than 4 worktrees:** Display a numbered text list of all worktrees with their status, then ask the developer to type the set name via freeform input.

**If the selected set name does not match an existing worktree:** Inform the user which set names are available and re-prompt.

## Step 4: Safety Check and Cleanup

Execute the cleanup command:

```bash
node "${RAPID_TOOLS}" worktree cleanup {setName}
```

Parse the JSON output to determine the result.

**If successful** (`removed: true`): Skip to Step 5.

**If blocked** (`removed: false, reason: "dirty"`):

The worktree has uncommitted changes. Use AskUserQuestion:
- **question:** "Worktree has uncommitted changes. What would you like to do?"
- **options:**
  - "Commit changes first" -- "Run git add -A && git commit in the worktree to save work"
  - "Stash changes" -- "Run git stash push to temporarily save changes"
  - "Force remove" -- "Permanently discard all uncommitted changes (cannot be undone)"
  - "Cancel" -- "Keep worktree as-is, exit cleanup"

**If "Commit changes first":**
```bash
git -C .rapid-worktrees/{setName} add -A && git -C .rapid-worktrees/{setName} commit -m 'WIP: save before cleanup'
```
Then retry cleanup from the beginning of Step 4.

**If "Stash changes":**
```bash
git -C .rapid-worktrees/{setName} stash push -m 'rapid-cleanup-stash'
```
Then retry cleanup from the beginning of Step 4.

**If "Force remove":**
Use AskUserQuestion for double confirmation:
- **question:** "Confirm force removal -- this permanently discards all uncommitted changes in {setName}"
- **options:**
  - "Confirm force remove" -- "This cannot be undone. All uncommitted work will be lost."
  - "Cancel" -- "Go back, keep worktree as-is"

If confirmed:
```bash
git worktree remove --force .rapid-worktrees/{setName}
```
Then deregister from the registry:
```bash
node "${RAPID_TOOLS}" worktree reconcile
```

**If "Cancel":** Print "Cleanup cancelled. Worktree kept as-is." and end.

**If other error** (`removed: false` with different reason): Display the error message and suggest manual investigation.

## Step 5: Branch Deletion

After successful worktree removal, offer branch deletion via AskUserQuestion:
- **question:** "Also delete branch rapid/{setName}?"
- **options:**
  - "Yes, delete branch" -- "Run git branch -d to safely delete the merged branch"
  - "No, keep branch" -- "Preserve the branch for reference"

**If "Yes, delete branch":**
```bash
node "${RAPID_TOOLS}" worktree delete-branch "rapid/{setName}"
```

Parse the result:
- If `deleted: true`: Print "Branch rapid/{setName} deleted."
- If `deleted: false, reason: "unmerged"`: The branch has unmerged changes. Use AskUserQuestion:
  - **question:** "Branch rapid/{setName} is not fully merged. Force delete?"
  - **options:**
    - "Force delete" -- "Run git branch -D to force-delete the unmerged branch"
    - "Keep branch" -- "Preserve the branch -- you can delete it manually later"
  - If "Force delete":
    ```bash
    node "${RAPID_TOOLS}" worktree delete-branch "rapid/{setName}" --force
    ```
    Print result.
  - If "Keep branch": Print "Branch preserved."

**If "No, keep branch":** Print "Branch rapid/{setName} preserved."

## Step 6: Confirm and Next Steps

Print cleanup summary:

> **Worktree for set '{setName}' cleaned up.**
> - Worktree directory: removed
> - Branch rapid/{setName}: {deleted / preserved}

Use AskUserQuestion with:
- **question:** "What would you like to do next?"
- **options:**
  - "Run /status" -- "View the project dashboard"
  - "Clean up another set" -- "Return to worktree selection"
  - "Done" -- "Exit cleanup"

**If "Clean up another set":** Go back to Step 2.
**If "Run /status":** Tell the user to run `/status`.
**If "Done":** End.

## Important Notes

- **Safety checks:** The cleanup command uses `git worktree remove`, which refuses to remove worktrees with uncommitted or untracked changes. This is a safety feature, not a bug.
- **Registry update:** On successful removal, the worktree entry is automatically removed from REGISTRY.json. No manual registry cleanup is needed.
- **Force removal:** Dirty worktrees can be force-removed via the structured recovery prompt. Force removal requires double confirmation to prevent accidental data loss.
- **Branch deletion is optional:** The user always has the choice to keep or delete the branch. Unmerged branches get an additional confirmation gate before force deletion.
