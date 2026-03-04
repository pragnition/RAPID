---
description: Pause execution of a set and save state for later resumption
allowed-tools: Bash, Read
---

# /rapid:pause -- Pause Set Execution

You are the RAPID pause handler. This skill pauses an executing set and saves its state to a HANDOFF.md file so a new subagent can resume later. Follow these steps IN ORDER. Do not skip steps.

## Step 1: Validate Set Name

The user provides a set name as the argument: `/rapid:pause {setName}`

If no set name is provided, show available executing sets:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute wave-status 2>/dev/null
```

Parse the JSON output and list any sets with phase "Executing". If none are executing, inform the user:

> No sets are currently executing. Pause is only available for sets in the Executing phase.

## Step 2: Check Registry Phase

Verify the set is in the Executing phase:

```bash
node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute wave-status
```

Parse the JSON output to find the set's phase. If the set is not in phase "Executing", inform the user:

> Set '{setName}' is in phase '{phase}', not Executing. Pause is only available during execution.

If the set is Executing, continue.

## Step 3: Collect Checkpoint Data

The pause can be triggered in two ways:

### Automatic (via CHECKPOINT return)

When a subagent emits a CHECKPOINT return during execution, the execute orchestrator (`/rapid:execute`) will automatically pipe the checkpoint data to this CLI command. In that case, the checkpoint JSON is already available on stdin.

### Manual (explicit user pause)

If the user is manually pausing (not via automatic checkpoint), collect the necessary information:

Ask the user:

> **Pausing set '{setName}'**
>
> I need some information to create the handoff file:
>
> 1. **What has been completed?** (describe tasks/work done so far)
> 2. **What remains?** (describe remaining tasks/work)
> 3. **How many tasks completed?** (number)
> 4. **How many tasks total?** (number)
> 5. **Any decisions made?** (optional, list key decisions)
> 6. **Resume instructions?** (how should the next session pick up?)

Build a JSON checkpoint object from the user's input:

```json
{
  "handoff_done": "{user's description of completed work}",
  "handoff_remaining": "{user's description of remaining work}",
  "handoff_resume": "{user's resume instructions}",
  "tasks_completed": N,
  "tasks_total": M,
  "decisions": ["decision1", "decision2"]
}
```

Then pipe it to the pause CLI:

```bash
echo '{"handoff_done":"...","handoff_remaining":"...","handoff_resume":"...","tasks_completed":N,"tasks_total":M}' | node ~/RAPID/rapid/src/bin/rapid-tools.cjs execute pause {setName}
```

## Step 4: Confirm Pause Success

Parse the JSON output from the pause command. It will contain:

```json
{
  "paused": true,
  "setName": "{setName}",
  "pauseCycles": N,
  "handoffPath": ".planning/sets/{setName}/HANDOFF.md"
}
```

Inform the user:

> **Set '{setName}' paused successfully.**
>
> - Handoff file: `.planning/sets/{setName}/HANDOFF.md`
> - Pause cycle: {N}
> - Registry phase updated to: Paused

If `pauseCycles >= 3`, the CLI will have printed a warning to stderr. Relay it:

> **Warning:** This set has been paused {N} times. Consider replanning this set with `/rapid:plan` -- frequent pauses may indicate the set scope is too large.

## Step 5: Resume Guidance

Inform the user about how to resume:

> **To resume this set:**
>
> Run `/rapid:execute` -- it will detect the HANDOFF.md and offer to resume from where execution left off.
>
> The resume flow will:
> 1. Read the handoff file to understand what was completed
> 2. Spawn a new subagent with the original plan PLUS handoff context
> 3. The new subagent will continue from the first incomplete task
>
> Alternatively, you can manually inspect the handoff:
> ```bash
> cat .planning/sets/{setName}/HANDOFF.md
> ```

## Important Notes

- **Dual trigger:** This skill handles the explicit pause case. Automatic pauses happen when a subagent emits a CHECKPOINT return during `/rapid:execute` -- the orchestrator handles that path directly.
- **Pause cycle warning:** After 3 pause/resume cycles on the same set, a warning is shown suggesting replanning. This is advisory, not blocking.
- **Read-only inspection:** To check if a set has a handoff file without pausing, use:
  ```bash
  ls .planning/sets/*/HANDOFF.md 2>/dev/null
  ```
- **Stale handoff cleanup:** After a set completes (phase = Done), its HANDOFF.md should be deleted. The execute orchestrator handles this automatically.
