---
description: Pause a set and save state for later resumption
allowed-tools: Bash, Read, AskUserQuestion
---

# /rapid:pause -- Pause Set Execution

You are the RAPID pause handler. This skill pauses an executing set and saves its state to a HANDOFF.md file so a new context window can resume later. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Load Environment

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
echo "Environment loaded. RAPID_TOOLS=${RAPID_TOOLS}"
```

## Step 2: Determine Set to Pause

If the user provided a set name as argument (`/rapid:pause {setName}` or `/rapid:pause 1`):

### Resolve Set Reference

Resolve the set argument through the numeric ID resolver:

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
SET_NAME=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
```

Use `SET_NAME` for all subsequent operations. Skip to Step 3.

If no set name was provided, find executing sets:

```bash
node "${RAPID_TOOLS}" execute wave-status 2>/dev/null
```

Parse the JSON output and filter for sets with phase "Executing".

**If multiple executing sets:** Use AskUserQuestion with:
- **question:** "Which set would you like to pause?"
- **options:** One option per executing set, where name is the set id and description shows its current wave progress.

**If exactly one executing set:** Use AskUserQuestion with:
- **question:** "Pause set '{setName}'?"
- **options:**
  - "Pause" -- "Save current state to HANDOFF.md for later resumption"
  - "Cancel" -- "Keep executing, do not pause"
- If "Cancel": Print "Pause cancelled." and end.

**If no sets are executing:**
Print: "No sets are currently executing. Pause is only available for sets in the Executing phase." and end.

## Step 3: Gather Pause Notes

Use AskUserQuestion to ask for pause notes:
- **question:** "Add notes for the next developer resuming this set?"
- **options:**
  - "Add notes" -- "Write a message describing current progress and context"
  - "Skip notes" -- "Pause without additional notes"

**If "Add notes":** Use AskUserQuestion with:
- question: "What notes should the next developer see when resuming this set?"
- Options:
  - "Blocked on dependency" -- "Waiting for another set or external resource"
  - "Partial progress" -- "Some tasks done, resuming from a specific point"
  - "Context switch" -- "Pausing to work on something else, will return later"
  - "I'll answer in my own words" -- "Write custom notes for the next session"

If the user selects "I'll answer in my own words", ask freeform: "What notes should the next session see when resuming?" and capture their typed response. Capture the response as `userNotes`.

**If "Skip notes":** Set `userNotes` to empty string.

## Step 4: Build Checkpoint and Pause

Read STATE.json for the current wave/job status snapshot:

```bash
node "${RAPID_TOOLS}" state get --all 2>/dev/null
```

Parse the state to extract the set's current wave/job progress. Build a checkpoint JSON:

```json
{
  "handoff_done": "Set paused by user",
  "handoff_remaining": "Resume from current wave/job position",
  "handoff_resume": "{userNotes or 'No notes provided'}",
  "wave_snapshot": { "current_wave": N, "completed_jobs": M, "total_jobs": T },
  "timestamp": "ISO-8601"
}
```

Pipe the checkpoint to the pause CLI:

```bash
echo '{...checkpoint JSON...}' | node "${RAPID_TOOLS}" execute pause {setName}
```

Parse the JSON output which contains `{ paused, setName, pauseCycles, handoffPath }`.

## Step 5: Confirm Success

Display the pause result:

> **Set '{setName}' paused successfully.**
>
> - Handoff file: `{handoffPath}`
> - Pause cycle: {pauseCycles}
> - Registry phase updated to: Paused

**If `pauseCycles >= 3`:** Show warning:

> **Warning:** This set has been paused {pauseCycles} times. Consider replanning this set -- frequent pauses may indicate the set scope is too large.

## Step 6: Next Steps

Use AskUserQuestion with:
- **question:** "What would you like to do next?"
- **options:**
  - "Run /status" -- "View the project dashboard to see all set states"
  - "Resume later" -- "Run /resume {setName} in a new context window to continue"
  - "Done" -- "Exit pause flow"

Handle accordingly or end.

## Important Notes

- **Dual trigger:** This skill handles the explicit pause case. Automatic pauses happen when a subagent emits a CHECKPOINT return during `/rapid:execute` -- the orchestrator handles that path directly.
- **Pause cycle warning:** After 3 pause/resume cycles on the same set, a warning is shown suggesting replanning. This is advisory, not blocking.
- **HANDOFF.md location:** Always at `.planning/sets/{setName}/HANDOFF.md`
- **State snapshot:** The wave/job snapshot in the checkpoint helps the resume flow understand exactly where execution left off.
