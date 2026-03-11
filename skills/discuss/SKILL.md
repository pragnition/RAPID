---
description: Capture developer implementation vision for a set via structured discussion
allowed-tools: Bash(rapid-tools:*), Read, AskUserQuestion, Glob, Grep, Agent
---

# /rapid:discuss -- Set Discussion

You are the RAPID set discussion facilitator. This skill captures developer implementation vision for an entire set before autonomous planning begins. It identifies product and UX gray areas across all waves, conducts a single-round discussion per area, and splits decisions into per-wave WAVE-CONTEXT.md files.

Follow these steps IN ORDER. Do not skip steps. Use AskUserQuestion at every decision point.

## Step 1: Environment Setup

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

## Display Stage Banner

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner discuss
```

---

## Step 2: Resolve Set

Accept a set reference argument. The user invokes as:
- `/rapid:discuss 1` (numeric index -- set 1)
- `/rapid:discuss auth-system` (string set ID)

### Resolve Set Reference

Resolve the user's input through the set resolver:

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
echo "$RESOLVE_RESULT"
```

Parse the JSON result to extract `resolvedId` (the set ID string) and `numericIndex` (the 1-based set index). Use these for all subsequent operations.

Store:
- `SET_ID` = `resolvedId` from the JSON
- `SET_INDEX` = `numericIndex` from the JSON

**After resolution, load full state data to find this set's milestone and waves:**

```bash
# (env preamble here)
STATE_DATA=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$STATE_DATA"
```

Parse the JSON to find:
- `currentMilestone` at the root level -- this is the `MILESTONE_ID`
- The set matching `SET_ID` within the current milestone's `sets` array
- The `waves` array within that set -- these are ALL the waves to discuss

**If the set is not found in STATE.json:** Display: "Set not found in state. Ensure the project has been initialized with /rapid:init." and STOP.

Record `MILESTONE_ID`, `SET_ID`, `SET_INDEX`, and `WAVES` (the full waves array with IDs, statuses, and jobs) for subsequent steps.

---

## Step 3: Load Set Context

Read ALL waves in the set to build a unified understanding:

1. **Read set-level artifacts:**

   Read `.planning/sets/${SET_ID}/CONTRACT.json` using the Read tool. If not found, note absence but continue.

   Read `.planning/sets/${SET_ID}/DEFINITION.md` using the Read tool. If not found, note absence but continue.

   Read `.planning/sets/${SET_ID}/SET-OVERVIEW.md` using the Read tool. If not found, note absence but continue.

2. **Read per-wave artifacts:**

   For EACH wave in the set's `waves` array:
   - Read `.planning/waves/${SET_ID}/${WAVE_ID}/CONTRACT.json` using the Read tool (if exists)
   - Read `.planning/waves/${SET_ID}/${WAVE_ID}/DEFINITION.md` using the Read tool (if exists)
   - Read `.planning/waves/${SET_ID}/${WAVE_ID}/WAVE-PLAN.md` using the Read tool (if exists)

3. **Read target source files:** Use Grep and Glob to find and read the source files referenced in CONTRACT.json files (the `file` fields in exports.functions and exports.types). These are the files the set's jobs will modify.

4. **Display set summary:**
   ```
   "Set {SET_ID} ({SET_INDEX}): {N} waves
   Waves: {wave-1-id}, {wave-2-id}, ...
   Set scope: {brief summary from SET-OVERVIEW.md or DEFINITION.md}
   Total jobs across all waves: {count}"
   ```

---

## Step 4: Status Check and State Transition

Check wave statuses to determine discussion readiness.

### Status Assessment

Categorize all waves in the set by their current status:
- `pending` waves -- ready for discussion
- `discussing` waves -- already in discussion (re-discuss)
- `planning` or later waves -- already past discussion

### Decision Logic

- **If ALL waves are `pending`:** Proceed normally. Transition all to `discussing`.

- **If some waves are `pending` and some are `planning` or later:** Use AskUserQuestion:
  ```
  "Some waves in this set are already past discussion:
  {list waves with their statuses}

  The pending waves can still be discussed. Proceed?"

  Options:
  - "Discuss pending waves" -- "Discuss only the waves still in pending status"
  - "Re-discuss all" -- "Start fresh discussion for all waves (will overwrite existing WAVE-CONTEXT.md files)"
  - "Cancel" -- "Return without changes"
  ```
  If "Cancel": STOP.

- **If ALL waves are `planning` or later:** Use AskUserQuestion:
  ```
  "All waves in this set have already been discussed:
  {list waves with their statuses}

  Options:
  - "Re-discuss" -- "Start a fresh discussion (will overwrite existing WAVE-CONTEXT.md files)"
  - "Cancel" -- "Return without changes"
  ```
  If "Cancel": STOP.

- **If any waves are `discussing`:** Treat as re-discuss for those waves. Continue normally.

### State Transition

Transition all relevant waves (pending ones, or all if re-discussing) to `discussing` status:

```bash
# (env preamble here)
# Repeat for each wave being discussed
node "${RAPID_TOOLS}" state transition wave "${MILESTONE_ID}" "${SET_ID}" "${WAVE_ID}" discussing
```

Do this in a loop for each wave. If a transition fails (wave already in `discussing`), log the warning and continue.

---

## Step 5: Identify Gray Areas

Analyze the set's scope across all waves. Identify gray areas that need developer input.

### Focus Areas

Identify gray areas that are strictly about:
- **Product/UX decisions** -- What should the user experience be? What should the behavior look like?
- **High-level developer preferences** -- Coding style choices, library preferences, naming conventions
- **Cross-wave coordination decisions** -- How should waves interact? What contracts or interfaces need agreement?

### Do NOT Surface

Do NOT present gray areas about:
- Technical implementation details (which function to use, how to structure code internally)
- Architecture decisions that follow established patterns in the codebase
- Anything Claude can decide autonomously based on codebase conventions

### Presentation

Present gray areas as a numbered list with brief descriptions:

```
"I've analyzed the set scope across all {N} waves and identified these areas that would benefit from your input:

1. {Gray area title} -- {1-sentence description}
2. {Gray area title} -- {1-sentence description}
...

I'll ask one question per area."
```

**If zero gray areas found:** Inform the user that no product/UX decisions are needed -- all implementation choices follow established patterns. Skip directly to Step 7 (write empty WAVE-CONTEXT.md files with a note that no discussion was needed).

---

## Step 6: Single-Round Discussion

Process each gray area with exactly ONE question per area.

### Per-Area Question

For EACH gray area (in order), use AskUserQuestion with:

```
"{Gray area title}

{2-3 sentences of context explaining what this affects and why it matters}

Options:
- "{Option A}" -- "{Brief description of option A}"
- "{Option B}" -- "{Brief description of option B}"
- "{Option C}" -- "{Brief description if applicable}"
- "Other" -- "Something else (describe what you'd prefer)"
```

Provide 2-4 concrete named options plus the "Other" freeform option.

Record the user's choice immediately. Move to the next gray area without any follow-up.

Do NOT show "Looks good" after each area.
Do NOT do a second round for specifics.

### Step 6b: Final Confirmation

After ALL gray areas have been answered, use AskUserQuestion with exactly two options:

```
"All areas covered. Ready to proceed?"

Options:
- "Looks good" -- "Proceed with these decisions"
- "Revise" -- "I want to change something"
```

Do NOT show a summary of decisions before asking. Just ask.

**If "Looks good":** Proceed to Step 7.

**If "Revise":** Use AskUserQuestion to ask:
```
"What would you like to change? Describe in your own words."
```

After the user provides freeform revision text, re-run the discussion from Step 5. Re-identify gray areas incorporating the user's revision feedback (some areas may be resolved by the feedback, new ones may emerge). Re-present the questions. When complete, return to Step 6b for another final confirmation.

---

## Step 7: Write Per-Wave WAVE-CONTEXT.md Files

Create WAVE-CONTEXT.md files for each wave in the set, splitting decisions by wave relevance.

### Create Wave Directories

For each wave in the set:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" wave-plan create-wave-dir "${SET_ID}" "${WAVE_ID}"
```

### Determine Decision Relevance

For each wave, determine which decisions are relevant based on:
- The wave's scope from its CONTRACT.json and DEFINITION.md
- Which jobs in the wave are affected by each decision
- Cross-wave coordination decisions (relevant to all waves)

Decisions that apply to ALL waves should appear in ALL WAVE-CONTEXT.md files.

### Write Files

For each wave, write `.planning/waves/${SET_ID}/${WAVE_ID}/WAVE-CONTEXT.md` using the Write tool:

```markdown
# WAVE-CONTEXT: {waveId}

**Set:** {setId}
**Wave:** {waveId}
**Generated:** {date}

## Wave Boundary

{Scope of what this wave covers -- derived from wave-level artifacts and job list}

## Decisions

{Decisions from the discussion that are relevant to THIS wave, organized by gray area}

### {Gray Area Title}
- **Decision:** {what was decided}
- **Rationale:** {why this was chosen}

### {Another Gray Area Title}
...

## Cross-Wave Notes

{Any coordination notes relevant to this wave's interaction with other waves in the set}

## Claude's Discretion

{Areas not discussed -- implementation details Claude will decide based on codebase patterns}

## Code Context

{Relevant patterns, existing code insights, and integration notes from context gathering}
```

### Commit WAVE-CONTEXT.md Files

```bash
# (env preamble here)
git add ".planning/waves/${SET_ID}/"
git commit -m "discuss(${SET_ID}): capture set implementation vision across all waves"
```

---

## Step 8: Next Step

Display the next step using the set index resolved in Step 2:

> **Next step:** `/rapid:plan {SET_INDEX}`
> *(Plan all waves in set {SET_ID})*

---

## Error Handling

- If RAPID_TOOLS is not set: Show error and suggest running `/rapid:install`
- If STATE.json is missing or invalid: Show error and suggest running `/rapid:init` first
- If set CONTRACT.json is missing: Warn but continue -- discussion can proceed without contract details
- If a wave has no jobs in STATE.json: Warn the user and suggest running `/rapid:set-init` first
- All errors should be descriptive with clear next steps for the user

## Important Notes

- **Set-scoped discussion:** All waves are discussed in a single session. Decisions are split into per-wave WAVE-CONTEXT.md files based on which wave each decision affects.
- **Product/UX focus:** Do not surface technical implementation details as gray areas. Focus on user experience decisions, developer preferences, and cross-wave coordination.
- **Single round:** One question per gray area with concrete options and an "Other" freeform option. No follow-up rounds.
- **Final gate only:** "Looks good / Revise" appears once at the very end, not per-area. Per-area revisions use the "Other" freeform option.
- **Re-discuss:** If all waves are already discussed/planned, offer re-discuss option that overwrites existing WAVE-CONTEXT.md files.
- **No wave-level invocation:** This skill accepts set references only (e.g., `/rapid:discuss 1`), not wave dot-notation (e.g., NOT `/rapid:discuss 1.1`).
- **State transitions:** All waves in the set being discussed are transitioned to `discussing` status before the discussion begins.
