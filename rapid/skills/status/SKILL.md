---
description: Show all active worktrees, their set assignments, lifecycle phase, and wave progress
allowed-tools: Bash, Read
---

# /rapid:status -- Worktree Status Dashboard

You are the RAPID status viewer. This skill shows the current state of all RAPID worktrees -- which sets are active, what lifecycle phase they are in, and wave-level progress. This skill is **read-only** and never modifies any state. Follow these steps IN ORDER.

## Step 1: Run Status Command

Run the worktree status command to get the current state:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs worktree status
```

This outputs a human-readable status dashboard with two sections:

1. **Wave Summary** (appears above the table when DAG data is available):
   - Shows per-wave completion progress
   - Format: `Wave N: X/Y done, Z executing`

2. **Worktree Table** with these columns:
   - **SET**: The set name (e.g., `auth-core`)
   - **BRANCH**: The git branch (`rapid/<set-name>`)
   - **PHASE**: Lifecycle phase (`Created` / `Executing` / `Done` / `Error`)
   - **STATUS**: Whether the worktree is `active` or `orphaned`
   - **PATH**: Relative worktree path (`.rapid-worktrees/<set-name>`)

## Step 2: Display Output

Present the formatted output directly to the user. The table is already formatted with aligned columns.

**If no worktrees exist** (the output shows "No active worktrees"):
Inform the user:

> No worktrees are currently active. Worktrees are created during set execution. If sets have been defined (via `/rapid:plan`), worktrees will be created when execution begins.

## Step 3: JSON Output (Optional)

If the user needs machine-readable output (for piping to other tools or programmatic use), mention that JSON output is available:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs worktree status --json
```

This returns a JSON object with `worktrees` (array of worktree entries) and `waves` (wave data from DAG if available).

## Important Notes

- **Read-only skill:** This skill only reads worktree state. It never creates, modifies, or removes worktrees.
- **Reconciliation:** The status command automatically reconciles the registry with actual git state before displaying. Orphaned entries (registry entries with no matching git worktree) are marked accordingly.
- **Wave progress:** Wave summary requires DAG.json to be present (created during `/rapid:plan` decomposition). If no DAG exists, only the worktree table is shown.
