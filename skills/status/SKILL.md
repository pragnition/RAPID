---
description: Show all active worktrees, their set assignments, lifecycle phase, and wave progress
allowed-tools: Bash, Read
---

# /rapid:status -- Unified Lifecycle Dashboard

You are the RAPID status viewer. This skill shows a unified dashboard of all RAPID sets across their 5-phase lifecycle (Discuss, Plan, Execute, Verify, Merge), wave-level progress, gate status, and actionable next steps. This skill is **read-only** and never modifies any state. Follow these steps IN ORDER.

## Step 1: Load Data

Run two CLI commands to gather dashboard data:

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/src/bin/rapid-tools.cjs}" worktree status
```

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/src/bin/rapid-tools.cjs}" execute wave-status
```

The first command outputs the formatted dashboard. The second provides per-wave execution progress (JSON on stdout, human-readable on stderr).

## Step 1.5: Detect Execution Mode

Check if an execution mode is currently active:

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/src/bin/rapid-tools.cjs}" execute detect-mode
```

Parse the JSON output. If `agentTeamsAvailable` is true, note it for display. The actual mode depends on whether `/rapid:execute` is actively running and which mode was selected. For status display purposes:
- If agent teams is available: show "Execution mode: Agent Teams (available)"
- If not: show "Execution mode: Subagents"

## Step 2: Display Unified Dashboard

Present the output as a combined dashboard with three sections:

**Mode Indicator** (at top of dashboard):
- `Execution mode: Agent Teams` (if teams detected available)
- `Execution mode: Subagents` (default)

**Wave Summary** (header lines after mode indicator):
- Shows per-wave completion: `Wave N: X/Y complete | Z executing | W planning | ...`
- Only non-zero counts are displayed
- Fully complete waves show: `Wave N: X/X complete`
- Waves with no activity show: `Wave N: Y sets pending`

**Status Table** with these columns:
- **SET**: The set name (e.g., `auth-core`)
- **WAVE**: Which wave this set belongs to (from DAG)
- **PHASE**: Lifecycle phase with short display labels:
  - `Discuss` (Discussing), `Plan` (Planning), `Execute` (Executing), `Verify` (Verifying), `Done`, `Error`, `Paused`
- **PROGRESS**: ASCII progress bar during Execute phase (`Execute [===----] 3/7`), task count for Done (`5/5 tasks`), `-` for other phases
- **LAST ACTIVITY**: Relative timestamp (`2 min ago`, `1 hr ago`, `3 days ago`) or `-` if no activity recorded

**If no worktrees exist** (the output shows "No active worktrees"):
Inform the user:

> No worktrees are currently active. Worktrees are created during set execution. If sets have been defined (via `/rapid:plan`), worktrees will be created when execution begins.

## Step 3: Gate Status

Check the planning gate for the next pending wave:

1. From the wave-status output, find the first wave that is NOT fully complete (not all sets at `Done`)
2. Run the gate check for that wave:

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/src/bin/rapid-tools.cjs}" plan check-gate <nextWave>
```

3. Report gate status:
   - **If gate is open**: "Gate for Wave N: Ready to execute"
   - **If gate is blocked with missing artifacts**: Show which sets are missing DEFINITION.md or CONTRACT.json on disk
   - **If gate is blocked with unplanned sets**: Show which sets still need planning

The check-gate command now verifies actual artifacts on disk (DEFINITION.md and CONTRACT.json), not just registry status.

## Step 4: Summary Guidance

Based on current state, suggest the next action:

- **No sets exist**: "No sets found. Run `/rapid:plan` to decompose your project into parallel work sets."
- **Sets exist but no worktrees**: "Sets are defined but not yet executing. Run `/rapid:execute` to begin."
- **All sets Done**: "All sets complete. Ready for merge. Run `/rapid:merge` to begin integration."
- **Sets are Paused**: List paused sets and suggest: "Resume paused sets with `/rapid:execute resume <set>`."
- **Gate is blocked**: "Wave N gate blocked. Run `/rapid:plan` to complete planning for: {missing sets}."
- **Sets are Executing**: "Execution in progress. {N} sets active across {W} waves."

## Step 5: JSON Output (Optional)

If the user needs machine-readable output, mention the `--json` flag:

```bash
node "${RAPID_TOOLS:-$HOME/RAPID/src/bin/rapid-tools.cjs}" worktree status --json
```

Returns a JSON object with `worktrees` (array of worktree entries) and `waves` (wave data from DAG if available).

## Important Notes

- **Read-only skill:** This skill only reads worktree state. It never creates, modifies, or removes worktrees.
- **Reconciliation:** The status command automatically reconciles the registry with actual git state before displaying. Orphaned entries (registry entries with no matching git worktree) are marked accordingly.
- **Wave progress:** Wave summary requires DAG.json to be present (created during `/rapid:plan` decomposition). If no DAG exists, only the worktree table is shown.
- **Artifact verification:** Gate checks now verify that DEFINITION.md and CONTRACT.json physically exist on disk for each required set, not just that GATES.json says "open".
