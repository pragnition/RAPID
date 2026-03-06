---
description: Resume a paused set from its last checkpoint
allowed-tools: Bash, Read, AskUserQuestion
---

# /rapid:resume -- Resume a Paused Set

You are the RAPID resume handler. This skill resumes a previously paused set by loading its HANDOFF.md and STATE.json context, allowing execution to continue from where it left off. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Load Environment

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
echo "Environment loaded. RAPID_TOOLS=${RAPID_TOOLS}"
```

## Step 2: Determine Set to Resume

If the user provided a set name as argument (`/rapid:resume {setName}`), use it directly and skip to Step 3.

If no set name was provided, list paused sets:

```bash
node "${RAPID_TOOLS}" worktree list 2>/dev/null
```

Parse the JSON output and filter for entries with `phase: "Paused"`.

**If multiple paused sets:** Use AskUserQuestion with:
- **question:** "Which set would you like to resume?"
- **options:** One option per paused set, where name is the set id and description shows pause cycle count and last update time.

**If exactly one paused set:** Use that set automatically and inform the user: "Found one paused set: {setName}"

**If no paused sets:**
Print: "No paused sets found. Use /pause to pause an executing set first." and end.

## Step 3: Load Resume Data

Call the resume CLI to load handoff data and STATE.json context:

```bash
node "${RAPID_TOOLS}" resume {setName}
```

Parse the JSON output which contains:
- `resumed`: boolean
- `setName`: the set name
- `handoff`: parsed HANDOFF.md data (frontmatter + sections)
- `stateContext`: wave/job progress from STATE.json (may be null)
- `definitionPath`: path to DEFINITION.md
- `contractPath`: path to CONTRACT.json
- `pauseCycles`: number of times this set has been paused

**If the command fails** (set not in Paused phase or HANDOFF.md missing): Display the error and end.

## Step 4: Display Handoff Summary

Present the handoff data in a clear format:

> **Resuming Set: {setName}**
>
> **Pause Cycle:** {pauseCycles}
> **Last Action:** {handoff.frontmatter.handoff_done or 'Not recorded'}
> **Remaining Work:** {handoff.frontmatter.handoff_remaining or 'Not recorded'}
> **Pause Notes:** {handoff.frontmatter.handoff_resume or 'No notes'}
>
> **Wave/Job Progress:**
> {Format stateContext.waves showing completion status per wave, or 'No state context available'}

## Step 5: Confirm Resume

Use AskUserQuestion with:
- **question:** "Resume set '{setName}'?"
- **options:**
  - "Resume" -- "Restore context and transition set back to Executing phase"
  - "View HANDOFF.md" -- "Read the full handoff file before deciding"
  - "Cancel" -- "Keep set paused, exit resume flow"

**If "View HANDOFF.md":**
Read and display the file:

```bash
cat .planning/sets/{setName}/HANDOFF.md
```

Then ask again with AskUserQuestion:
- **question:** "Proceed with resume?"
- **options:**
  - "Resume" -- "Restore context and continue execution"
  - "Cancel" -- "Keep set paused"

**If "Cancel":** Print "Resume cancelled. Set remains paused." and end.

## Step 6: Resume Confirmed

The resume CLI (Step 3) has already transitioned the set from Paused to Executing in REGISTRY.json.

Display the resume confirmation:

> **Set '{setName}' resumed.**
>
> - Worktree: {worktree path from registry}
> - Branch: rapid/{setName}
> - Phase: Executing
>
> The set is ready for continued execution. Run `/execute {setName}` to proceed from where the previous session left off.
>
> The executor will receive the HANDOFF.md context automatically and continue from the first incomplete task.

## Important Notes

- **Resume transitions set to Executing:** The `resume` CLI command updates REGISTRY.json phase from Paused to Executing.
- **HANDOFF.md is preserved:** The handoff file remains after resume for reference. It is cleaned up when the set reaches Done.
- **STATE.json context:** If STATE.json exists and contains the set, the resume response includes wave/job progress to help the executor pick up where it left off.
- **Multiple pause cycles:** If the set has been paused 3+ times, the pause skill will have warned about replanning. The resume skill does not block on this -- it is advisory.
