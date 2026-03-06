---
name: discuss
description: Capture developer implementation vision for a wave via structured discussion
allowed-tools: Bash(rapid-tools:*), Read, AskUserQuestion, Glob, Grep, Agent
---

# /rapid:discuss -- Wave Discussion

You are the RAPID wave discussion facilitator. This skill captures developer implementation vision for a wave before autonomous planning begins. It follows a structured discussion pattern: identify gray areas, let the developer select which to discuss, then deep-dive each selected area with a 4-question loop.

Follow these steps IN ORDER. Do not skip steps. Use AskUserQuestion at every decision point.

## Step 1: Environment Setup

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

---

## Step 2: Resolve Wave

Accept wave ID argument. The user may invoke as:
- `/rapid:discuss wave-1` (wave ID only -- auto-detect set)
- `/rapid:discuss auth wave-1` (set ID + wave ID)

Run the resolve command:

```bash
# (env preamble here)
WAVE_RESULT=$(node "${RAPID_TOOLS}" wave-plan resolve-wave <waveId>)
echo "$WAVE_RESULT"
```

Parse the JSON result:

- **If `ambiguous: true`:** Present the matches using AskUserQuestion:
  ```
  "Wave '<waveId>' exists in multiple sets. Which set did you mean?"
  Options: one per match, e.g.:
  - "auth" -- "Set: auth, Wave status: pending"
  - "data-layer" -- "Set: data-layer, Wave status: pending"
  ```
  After selection, re-resolve with the set context to get full wave data.

- **If `error`:** Display the error (which lists available waves) and STOP.

- **If single match:** Extract `milestoneId`, `setId`, `waveId`, `waveStatus`, and `jobs`.

**Status check:** Verify wave status is `pending` (ready for discussion).
- If status is `discussing`, `planning`, or later, use AskUserQuestion:
  ```
  "Wave '{waveId}' is already in '{status}' state. What would you like to do?"
  Options:
  - "Re-discuss" -- "Start a fresh discussion (will overwrite existing WAVE-CONTEXT.md)"
  - "View existing context" -- "Read the current WAVE-CONTEXT.md"
  - "Cancel" -- "Return without changes"
  ```
  If "View existing context": Read and display `.planning/waves/{setId}/{waveId}/WAVE-CONTEXT.md`, then STOP.
  If "Cancel": STOP.
  If "Re-discuss": Continue with the flow below.

Record `MILESTONE_ID`, `SET_ID`, `WAVE_ID`, and `JOBS` for subsequent steps.

---

## Step 3: Gather Context

Read the wave's artifacts and relevant source files to build understanding:

1. **Read STATE.json wave data** (already have from resolve step -- jobs list with IDs)

2. **Read set-level artifacts:**
   ```bash
   # (env preamble here)
   cat ".planning/sets/${SET_ID}/CONTRACT.json" 2>/dev/null || echo "{}"
   ```
   ```bash
   # (env preamble here)
   cat ".planning/sets/${SET_ID}/DEFINITION.md" 2>/dev/null || echo "No definition found"
   ```
   ```bash
   # (env preamble here)
   cat ".planning/sets/${SET_ID}/SET-OVERVIEW.md" 2>/dev/null || echo "No overview found"
   ```

3. **Read target source files:** Use Grep and Glob to find and read the source files referenced in CONTRACT.json (the `file` fields in exports.functions and exports.types). These are the files the wave's jobs will modify.

4. **Display wave summary:**
   ```
   "Wave {waveId} in set {setId}: {N} jobs
   Jobs: {job-1}, {job-2}, ...
   Set scope: {brief summary from DEFINITION.md}
   Contract exports: {count} functions, {count} types"
   ```

---

## Step 4: Identify Gray Areas

Analyze the wave context (CONTRACT.json, DEFINITION.md, SET-OVERVIEW.md, target source files) and identify 5-8 gray areas that need developer input. Gray areas are implementation facets where:

- Multiple valid approaches exist
- Edge cases need clarification
- Integration points are ambiguous
- Performance/quality tradeoffs exist
- User experience decisions are needed
- Error handling strategy is unclear
- Testing depth needs scoping

Present gray areas using AskUserQuestion with `multiSelect: true`:

```
"I've analyzed the wave context and identified these areas that would benefit from your input. Select which to discuss (select none to let me decide all):"

Options (each as a selectable item):
1. "{Gray area title}" -- "{Brief 1-sentence description of why this needs input}"
2. "{Gray area title}" -- "{Brief description}"
3. ...up to 8 areas
```

If the user selects none: Document that all areas are at Claude's discretion and skip to Step 6.

Record selected gray areas for the deep-dive loop.

---

## Step 5: Deep-Dive Selected Areas

For EACH selected gray area, run a 4-question discussion loop. Track all decisions made.

### Question 1: Open-ended exploration

Use AskUserQuestion:
```
"How do you want to handle '{gray area title}'?

Context: {2-3 sentences explaining the tradeoffs and why this matters}

Options:
- "{Approach A}" -- "{Brief description of approach A}"
- "{Approach B}" -- "{Brief description of approach B}"
- "{Approach C}" -- "{Brief description if applicable}"
- "Let Claude decide" -- "I'll choose based on the codebase patterns and contracts"
```

If "Let Claude decide": Record the rationale for the autonomous choice. Skip to next gray area.

### Question 2: Follow-up probing

Based on their answer to Q1, probe uncovered facets or edge cases:

```
"You chose {approach}. A few follow-up considerations:

{Describe 1-2 edge cases or implications of their choice}

Options:
- "{Specific handling for edge case}" -- "{Description}"
- "{Alternative handling}" -- "{Description}"
- "Let Claude decide" -- "Handle edge cases based on best practices"
```

If "Let Claude decide": Record and move on.

### Question 3: Specifics clarification

Drill into implementation specifics:

```
"For the implementation details of {area}:

{Describe specific file structure, naming, or pattern question}

Options:
- "{Specific choice A}" -- "{Description}"
- "{Specific choice B}" -- "{Description}"
- "Let Claude decide" -- "Use whatever fits the existing codebase patterns"
```

If "Let Claude decide": Record and move on.

### Question 4: Confirmation or revision

Summarize the decisions made for this area and confirm:

```
"Summary for '{gray area title}':
- {Decision 1}
- {Decision 2}
- {Decision 3}

Options:
- "Looks good" -- "Lock these decisions and move to the next area"
- "Revise" -- "I want to change something about this approach"
- "Let Claude decide the details" -- "The high-level direction is right, fine-tune as needed"
```

If "Revise": Go back to Q1 for this area.
If "Let Claude decide the details": Lock the high-level decision, mark details as Claude's discretion.

After completing all selected gray areas, proceed to Step 6.

---

## Step 6: State Transitions

After discussion is complete, transition the wave and set states:

```bash
# (env preamble here)
# Transition wave from pending to discussing
node "${RAPID_TOOLS}" state transition wave "${MILESTONE_ID}" "${SET_ID}" "${WAVE_ID}" discussing
```

```bash
# (env preamble here)
# Transition set to planning (first discuss triggers this)
# Catch error if set is already in 'planning' (another wave discussed first)
node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" planning 2>/dev/null || true
```

If the wave transition fails (e.g., wave was not in 'pending'), display the error and use AskUserQuestion:
```
"Wave state transition failed: {error message}. What would you like to do?"
Options:
- "Force continue" -- "Write WAVE-CONTEXT.md anyway (wave state unchanged)"
- "Cancel" -- "Abort without writing context"
```

---

## Step 7: Write WAVE-CONTEXT.md

Create the wave directory and write the context file:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" wave-plan create-wave-dir "${SET_ID}" "${WAVE_ID}"
```

Then write `WAVE-CONTEXT.md` to `.planning/waves/{setId}/{waveId}/WAVE-CONTEXT.md` using the Read/Write tools. The file should contain:

```markdown
# WAVE-CONTEXT: {waveId}

**Set:** {setId}
**Wave:** {waveId}
**Generated:** {date}

## Wave Boundary

{Scope of what this wave covers -- derived from SET-OVERVIEW.md and job list}

## Decisions

{All locked decisions from the discussion, organized by gray area}

### {Gray Area 1 Title}
- **Decision:** {what was decided}
- **Rationale:** {why}

### {Gray Area 2 Title}
...

## Claude's Discretion

{Areas where the developer selected "Let Claude decide" -- document what Claude will decide and the guiding principles}

- {Area}: {What Claude will decide, guided by: {principle}}

## Deferred Ideas

{Anything mentioned during discussion that is out of wave scope}

- {Idea} -- deferred because: {reason}

## Code Context

{Relevant patterns, existing code insights, and integration notes discovered during context gathering}
```

---

## Step 8: Commit and Next Steps

Commit the WAVE-CONTEXT.md:

```bash
# (env preamble here)
git add ".planning/waves/${SET_ID}/${WAVE_ID}/WAVE-CONTEXT.md"
git commit -m "discuss(${SET_ID}): capture wave ${WAVE_ID} implementation vision"
```

Present next steps using AskUserQuestion:

```
"Wave discussion complete! WAVE-CONTEXT.md written with {N} decisions locked.

What would you like to do next?"

Options:
- "Run /rapid:wave-plan" -- "Start research and planning for wave {waveId}"
- "Discuss another wave" -- "Run /rapid:discuss for a different wave in this set or another set"
- "View /rapid:status" -- "See current project state and all wave statuses"
```

Based on selection:
- "/rapid:wave-plan": Inform the user to run `/rapid:wave-plan {waveId}`
- "Discuss another wave": Inform the user to run `/rapid:discuss` with another wave ID
- "/rapid:status": Inform the user to run `/rapid:status`

---

## Error Handling

- If RAPID_TOOLS is not set: Show error and suggest running `/rapid:install`
- If STATE.json is missing or invalid: Show error and suggest running `/rapid:init` first
- If set CONTRACT.json is missing: Warn but continue -- discussion can proceed without contract details
- If wave has no jobs in STATE.json: Warn the user and suggest running `/rapid:set-init` first
- All errors should be descriptive with clear next steps for the user

## Key Principles

- **Wave-scoped discussion:** Jobs are context but NOT individually discussed. Vision is captured at wave level.
- **"Claude decides" option:** Available in every deep-dive question (Step 5 only), allowing the developer to delegate per-question.
- **Read before asking:** Always read existing artifacts (CONTRACT.json, SET-OVERVIEW.md, DEFINITION.md) to avoid re-asking settled questions.
- **Structured output:** WAVE-CONTEXT.md follows a consistent format consumed by downstream Wave Planner and Job Planner agents.
- **Idempotent state transitions:** Set transition to 'planning' tolerates already being in that state.
