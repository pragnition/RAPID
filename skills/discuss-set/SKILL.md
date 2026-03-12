---
description: Capture developer implementation vision for a wave via structured discussion
allowed-tools: Bash(rapid-tools:*), Read, AskUserQuestion, Glob, Grep, Agent
---

# /rapid:discuss-set -- Wave Discussion

You are the RAPID wave discussion facilitator. This skill captures developer implementation vision for a wave before autonomous planning begins. It follows a structured discussion pattern: identify gray areas, let the developer select which to discuss, then deep-dive each selected area with a 2-round discussion.

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
node "${RAPID_TOOLS}" display banner discuss-set
```

---

## Step 2: Resolve Wave

Accept wave ID argument. The user may invoke as:
- `/rapid:discuss-set 1.1` (numeric dot notation -- set 1, wave 1)
- `/rapid:discuss-set wave-1` (wave ID only -- auto-detect set)
- `/rapid:discuss-set auth wave-1` (set ID + wave ID)

### Resolve Wave Reference

Resolve the user's input through the numeric ID resolver:

**If the user provided dot notation (e.g., `1.1`) or a wave ID:**

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve wave "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
```

Parse the JSON result to extract `setId`, `waveId`, `setIndex`, `waveIndex`, and `wasNumeric`. Use these resolved string IDs for all subsequent operations.

**If the user provided a set ID + wave ID (two arguments, e.g., `auth wave-1`):**

Use the `--set` flag for single-call two-arg resolution:
```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve wave "<wave-input>" --set "<set-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message from the JSON and STOP
fi
```

Parse the JSON result to extract `setId`, `waveId`, `setIndex`, `waveIndex`, and `wasNumeric`. Use these resolved string IDs for all subsequent operations.

**After resolution, load full wave data (milestoneId, jobs, status) from STATE.json:**

```bash
# (env preamble here)
WAVE_DATA=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$WAVE_DATA"
```

Parse the JSON to find the resolved set and wave within the current milestone. Extract `milestoneId`, `setId`, `waveId`, `waveStatus`, and `jobs` from the state data.

- **If the resolved wave is not found in STATE.json:** Display: "Wave not found in state. Ensure the set has been initialized." and STOP.

- **If `resolve wave` returned an ambiguous result** (wave ID string matches multiple sets): Present the matches using AskUserQuestion:
  ```
  "Wave '<waveId>' exists in multiple sets. Which set did you mean?"
  Options: one per match, e.g.:
  - "auth" -- "Set: auth, Wave status: pending"
  - "data-layer" -- "Set: data-layer, Wave status: pending"
  ```
  After selection, re-resolve with the set context.

- **If `error`:** Display the error and STOP.

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
"I've analyzed the wave context and identified these areas that would benefit from your input. Select which areas to discuss:"

Options (each as a selectable item):
1. "Let Claude decide all" -- "Skip discussion, I'll make all decisions based on codebase patterns"
2. "{Gray area title}" -- "{Brief 1-sentence description of why this needs input}"
3. "{Gray area title}" -- "{Brief description}"
...up to 8 areas
```

**Handling responses:**
- If the user selects "Let Claude decide all" (regardless of any other selections): Document that all areas are at Claude's discretion and skip to Step 6. This takes precedence over any other selections.
- If the user selects none: Same behavior -- document all areas at Claude's discretion and skip to Step 6. (Backward compatible with old behavior.)
- If the user selects specific gray areas (without "Let Claude decide all"): Record selected gray areas for Step 5.

---

## Step 5: Deep-Dive Selected Areas (2-Round Discussion)

Process all selected gray areas in two rounds. Track all decisions made across both rounds.

### Round 1: Approach Selection (all areas)

For EACH selected gray area, present Interaction 1 back-to-back. Complete ALL Interaction 1s before moving to Round 2.

#### Interaction 1: Approach + Edge Case Context

Use AskUserQuestion:
```
"How do you want to handle '{gray area title}'?

Context: {2-3 sentences explaining the tradeoffs and why this matters}

Edge case to consider: {1 key edge case or tradeoff most likely to affect the approach choice}

Options:
- "{Approach A}" -- "{Brief description of approach A}"
- "{Approach B}" -- "{Brief description of approach B}"
- "{Approach C}" -- "{Brief description if applicable}"
- "Let Claude decide" -- "I'll choose based on the codebase patterns and contracts"
```

If "Let Claude decide": Record Claude's chosen approach and rationale. This area still appears in Round 2 with Claude's decisions shown as discretion items.

After completing Interaction 1 for ALL selected gray areas, proceed to Round 2.

### Round 2: Specifics & Confirmation (all areas)

For EACH selected gray area, present Interaction 2 back-to-back.

#### Interaction 2: Summary + Specifics

Use AskUserQuestion:
```
"'{Gray area title}' -- decisions so far:
- Approach: {chosen approach from Round 1}
{If delegated: '(Claude's discretion -- chose {approach} because {rationale})'}

Remaining detail: {1-2 specific implementation questions about this area}

Options:
- "{Specific choice A}" -- "{Description}"
- "{Specific choice B}" -- "{Description}"
- "Looks good" -- "Lock all decisions for this area"
- "Revise" -- "Go back and change the approach"
```

**Handling responses:**
- If "Looks good": Lock all decisions for this gray area. Continue to the next area's Interaction 2.
- If a specific choice is selected: Record the choice, then lock all decisions for this area. Continue to the next area's Interaction 2.
- If "Revise": Re-present ONLY this area's Interaction 1 (Round 1 question). After the user re-answers, re-present ONLY this area's Interaction 2. Then continue with the remaining Round 2 areas that have not yet been confirmed. Do NOT re-ask areas already confirmed.
- If this area was delegated in Round 1: Still show the summary with Claude's chosen approach marked as discretion. The user can still "Revise" to take control, or "Looks good" to accept Claude's choice.

After completing Interaction 2 for ALL selected gray areas, proceed to Step 6.

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
git commit -m "discuss-set(${SET_ID}): capture wave ${WAVE_ID} implementation vision"
```

Display the next step using the setIndex and waveIndex already resolved in Step 2:

> **Next step:** `/rapid:plan-set {setIndex}`
> *(Plan all waves in {setId})*

---

## Error Handling

- If RAPID_TOOLS is not set: Show error and suggest running `/rapid:install`
- If STATE.json is missing or invalid: Show error and suggest running `/rapid:init` first
- If set CONTRACT.json is missing: Warn but continue -- discussion can proceed without contract details
- If wave has no jobs in STATE.json: Warn the user and suggest running `/rapid:start-set` first
- All errors should be descriptive with clear next steps for the user

## Key Principles

- **Wave-scoped discussion:** Jobs are context but NOT individually discussed. Vision is captured at wave level.
- **"Claude decides" option:** Available in every deep-dive question (Step 5 only), allowing the developer to delegate per-question.
- **Read before asking:** Always read existing artifacts (CONTRACT.json, SET-OVERVIEW.md, DEFINITION.md) to avoid re-asking settled questions.
- **Structured output:** WAVE-CONTEXT.md follows a consistent format consumed by downstream Wave Planner and Job Planner agents.
- **Idempotent state transitions:** Set transition to 'planning' tolerates already being in that state.
