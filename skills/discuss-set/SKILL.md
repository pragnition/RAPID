---
description: Capture developer implementation vision for a set via structured discussion or auto-generate context with --skip
allowed-tools: Bash(rapid-tools:*), Read, Write, AskUserQuestion, Glob, Grep, Agent
---

# /rapid:discuss-set -- Set Discussion

You are the RAPID set discussion facilitator. This skill captures developer implementation vision for a SET (not a wave) before autonomous planning begins.

Follow these steps IN ORDER. Do not skip steps. Use AskUserQuestion at every decision point.

## Step 1: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill. Every `node "${RAPID_TOOLS}"` call must be preceded by the env loading block above in the same Bash invocation.

Display the stage banner:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" display banner discuss-set
```

---

## Step 2: Resolve Set

Accept a set identifier as argument. The user may invoke as:
- `/rapid:discuss-set 1` (numeric index)
- `/rapid:discuss-set auth-system` (string set ID)
- `/rapid:discuss-set --skip 1` or `/rapid:discuss-set 1 --skip` (with --skip flag)

### Check for --skip Flag

Parse the user's input for the `--skip` flag. If present, note it for Step 4. Remove it from the set identifier before resolving.

### Resolve Set Reference

Resolve the user's input through the numeric ID resolver using `resolve set`:

```bash
# (env preamble here)
RESOLVE_RESULT=$(node "${RAPID_TOOLS}" resolve set "<user-input>" 2>&1)
RESOLVE_EXIT=$?
if [ $RESOLVE_EXIT -ne 0 ]; then
  echo "$RESOLVE_RESULT"
  # Display the error message and STOP
fi
SET_ID=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.resolvedId)")
SET_INDEX=$(echo "$RESOLVE_RESULT" | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.numericIndex)")
```

### Load State and Validate

Load STATE.json to get milestone ID and set status:

```bash
# (env preamble here)
STATE_DATA=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "$STATE_DATA"
```

Parse the JSON to find the resolved set within the current milestone. Extract `MILESTONE_ID` and `SET_STATUS`.

### Status Check

- **If `pending`:** Proceed normally to Step 3.
- **If `discussed`:** Use AskUserQuestion:
  ```
  "Set '{SET_ID}' already has a discussion in progress. What would you like to do?"
  Options:
  - "Re-discuss" -- "Start a fresh discussion (will overwrite existing CONTEXT.md)"
  - "View existing context" -- "Read the current CONTEXT.md"
  - "Cancel" -- "Return without changes"
  ```
  If "View existing context": Read and display `.planning/sets/${SET_ID}/CONTEXT.md`, then STOP.
  If "Cancel": STOP.
  If "Re-discuss": Continue with the flow below.
- **If `planning` or later:** Inform the user: "Set '{SET_ID}' has already been discussed and planned (status: {SET_STATUS}). Use `/rapid:plan-set {SET_INDEX}` to continue." Then STOP.

Record `MILESTONE_ID`, `SET_ID`, `SET_INDEX`, and the `--skip` flag status.

---

## Step 3: Gather Context

Read set-level artifacts to build understanding:

1. **Read set artifacts:**
   - `.planning/sets/${SET_ID}/CONTRACT.json`
   - `.planning/sets/${SET_ID}/DEFINITION.md`
   - `.planning/sets/${SET_ID}/SET-OVERVIEW.md`
   - `.planning/ROADMAP.md` (for set description)

2. **Read target source files:** Use Grep and Glob to find and read source files referenced in CONTRACT.json (the `file` fields in exports.functions and exports.types). These are the files the set's work will modify.

3. **Display set summary:**
   ```
   "Set {SET_ID}: {brief scope from DEFINITION.md or ROADMAP.md}"
   ```

---

## Step 4: --skip Branch (Auto-Context)

If the `--skip` flag is set:

1. Display: "Auto-generating CONTEXT.md for set '{SET_ID}' (--skip mode)..."

2. Spawn a lightweight **rapid-research-stack** agent with this task:
   ```
   Generate auto-context for set '{SET_ID}' (--skip mode).

   ## Sources
   1. ROADMAP.md set description: {set description from ROADMAP.md}
   2. CONTRACT.json: {CONTRACT.json contents}
   3. SET-OVERVIEW.md: {SET-OVERVIEW.md contents if exists}
   4. Scan the codebase files in the set's file ownership

   ## Output
   Write CONTEXT.md to .planning/sets/{SET_ID}/CONTEXT.md with this format:
   - domain section: Set scope and boundary from ROADMAP.md
   - decisions section: All items marked as "Claude's Discretion" (no user decisions captured)
   - code_context section: Patterns discovered from codebase scan
   - deferred section: Empty (no discussion to defer ideas from)
   ```

3. After agent completes, verify CONTEXT.md was written:
   ```bash
   # (env preamble here)
   [ -f ".planning/sets/${SET_ID}/CONTEXT.md" ] && echo "CONTEXT.md created" || echo "ERROR: CONTEXT.md not found"
   ```

4. Skip to Step 8 (State Transition and Commit) -- CONTEXT.md was already written by the agent above.

If the `--skip` flag is NOT set, continue to Step 5.

---

## Step 5: Identify 4 Gray Areas (Interactive Mode)

Analyze set context (CONTRACT.json, DEFINITION.md, SET-OVERVIEW.md, ROADMAP.md, source files) and identify exactly 4 gray areas. Gray areas are implementation facets where:

- Multiple valid approaches exist
- Integration points are ambiguous
- User experience decisions are needed
- Performance/quality tradeoffs exist

Present gray areas using AskUserQuestion:

```
"I've analyzed set '{SET_ID}' and identified 4 areas that would benefit from your input.
Select which areas you'd like to discuss:"
Options:
1. "{Gray area 1 title}" -- "{1-sentence description}"
2. "{Gray area 2 title}" -- "{1-sentence description}"
3. "{Gray area 3 title}" -- "{1-sentence description}"
4. "{Gray area 4 title}" -- "{1-sentence description}"
```

**Handling responses:**
- If the user selects specific areas: Record selected areas for Step 6. Unselected areas are recorded as "Claude's Discretion" in CONTEXT.md.
- If the user selects ALL 4 areas: All areas proceed to Step 6 for deep-dive discussion.

**Note:** There is no global "Let Claude decide all" option. The user MUST engage with the area selection. They can still skip individual areas in Step 6 by choosing "Claude decides" per-area.

---

## Step 6: Deep-Dive Selected Areas (Batched Per Area)

For EACH selected gray area (in order):

1. Present ONE AskUserQuestion per area that covers it comprehensively. Include 4-5 questions per area, each with 2-3 concrete pre-filled approach options:

   ```
   "{Gray area title}

   Context: {2-3 sentences explaining the tradeoffs and why this matters}

   Questions:
   1. {Question about primary approach}
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}
      c) {Concrete option C} -- {1-sentence rationale} (optional, if 3 options are warranted)

   2. {Question about integration or edge case}
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}

   3. {Question about tradeoff or performance consideration}
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}

   4. {Question about UX or developer experience detail}
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}

   5. {Question about specific implementation detail} (optional 5th question if area warrants it)
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}

   For each question, pick a letter (a/b/c) or write your own answer.
   Type 'Claude decides' to let me handle this entire area."
   ```

   **Options for the AskUserQuestion wrapper:**
   - "Claude decides" -- "Let Claude handle all decisions for this area"
   - "I'll answer in my own words" -- "Respond to all questions with free-form text"

   **Note on the hybrid format:** The question body contains inline lettered options (a/b/c) for each sub-question, while the AskUserQuestion wrapper provides the two escape hatches. Users can:
   - Pick letters for each sub-question (e.g., "1a, 2b, 3a, 4b")
   - Mix letters and prose (e.g., "1a, 2b, 3: I want to use Redis instead, 4a")
   - Select "Claude decides" to skip the whole area
   - Select "I'll answer in my own words" to write a full prose response

2. Parse the user's response. Extract decisions per sub-question:
   - Letter selections map to the corresponding approach option
   - Prose responses are recorded verbatim
   - "Claude decides" records all sub-questions as Claude's discretion with rationale

3. If user said "Claude decides": Record the entire area as Claude's discretion with rationale explaining why each sub-decision was made a particular way.

### Follow-Up (Only If Needed)

After ALL selected areas are discussed:
- Compile follow-up questions ONLY if genuine gaps remain after all 4 areas were covered.
- If gaps exist: ONE final AskUserQuestion with remaining questions. Include pre-filled options:
  ```
  - "These gaps don't matter" -- "Proceed without resolving these points"
  - "I'll answer in my own words" -- "Address the remaining gaps"
  ```
- If no gaps: Skip follow-up entirely.

---

## Step 7: Write CONTEXT.md (Interactive Mode Only)

**Note:** In --skip mode, CONTEXT.md was already written by the rapid-research-stack agent in Step 4. Skip this step and go directly to Step 8.

Write `.planning/sets/${SET_ID}/CONTEXT.md` using the Write tool. Format:

```markdown
# CONTEXT: {SET_ID}

**Set:** {SET_ID}
**Generated:** {date}
**Mode:** {interactive | auto-skip}

<domain>
## Set Boundary
{Scope of what this set covers -- from DEFINITION.md and ROADMAP.md}
</domain>

<decisions>
## Implementation Decisions

### {Area 1 Title}
- Q1: {Decision -- letter selection with option text, or prose response}
- Q2: {Decision -- letter selection with option text, or prose response}
- Q3: {Decision -- letter selection with option text, or prose response}
- Q4: {Decision -- letter selection with option text, or prose response}

### {Area 2 Title}
- Q1: ...
- Q2: ...
- Q3: ...
- Q4: ...

### Claude's Discretion
- {Areas where user selected "Claude decides" -- include rationale per sub-question}
</decisions>

<specifics>
## Specific Ideas
- {Any specific ideas mentioned during discussion}
</specifics>

<code_context>
## Existing Code Insights
{Patterns, integration points, reusable code discovered during context gathering}
</code_context>

<deferred>
## Deferred Ideas
- {Ideas mentioned but out of set scope}
</deferred>
```

---

## Step 8: State Transition and Commit

This step ALWAYS runs in both interactive and --skip paths. It is the final mutation step.

### Transition State

Transition set from 'pending' to 'discussed'. The self-transition (discussed -> discussed) is allowed in SET_TRANSITIONS, so this call succeeds for both fresh and re-discuss scenarios:

```bash
# (env preamble here)
node "${RAPID_TOOLS}" state transition set "${MILESTONE_ID}" "${SET_ID}" discussed
```

### Commit Artifacts

Commit BOTH CONTEXT.md AND STATE.json together to ensure the state transition is persisted alongside the artifact:

```bash
# (env preamble here)
git add ".planning/sets/${SET_ID}/CONTEXT.md" ".planning/STATE.json"
git commit -m "discuss-set(${SET_ID}): capture set implementation vision"
```

---

## Step 9: Next Steps

Display next step:

> **Next step:** `/rapid:plan-set {SET_INDEX}`
> *(Plan set {SET_ID})*

Display progress breadcrumb:

```
init [done] > start-set [done] > discuss-set [done] > plan-set > execute-set > review > merge
```

---

## Error Handling

- If RAPID_TOOLS is not set: Show error and suggest running `/rapid:install`
- If STATE.json is missing or invalid: Show error and suggest running `/rapid:init` first
- If set CONTRACT.json is missing: Warn but continue -- discussion can proceed without contract details
- All errors should be descriptive with clear next steps for the user

**Error breadcrumb:** On any error, show the breadcrumb with the failure point:

```
init [done] > start-set [done] > discuss-set [FAILED: {brief error}] > plan-set > execute-set > review > merge
```

Show what is done, what failed, and what to run next.

---

## Key Principles

- **Set-scoped discussion:** Discussion captures vision at the set level, not per-wave. CONTEXT.md is the output artifact.
- **Exactly 4 gray areas:** Identify exactly 4 implementation facets for discussion. Not more, not fewer.
- **Batched questions per area:** Present 4-5 questions per gray area in a single AskUserQuestion call with 2-3 concrete pre-filled approach options per question (radio-style). Not one question at a time.
- **"Claude decides" option:** Available per-area only. No global skip -- the user always sees the gray area list and decides per-area.
- **--skip auto-context:** The --skip flag spawns a rapid-research-stack agent to auto-generate CONTEXT.md without user interaction.
- **Read before asking:** Always read existing artifacts (CONTRACT.json, SET-OVERVIEW.md, DEFINITION.md) to avoid re-asking settled questions.
- **CONTEXT.md output:** Written to `.planning/sets/{set-id}/CONTEXT.md` using the Write tool -- consumed by downstream plan-set.
- **Set-level state transitions:** Only use `state transition set` to move from pending to discussed. Never use wave-level transitions.
- **State transition is the final mutation:** Happens AFTER CONTEXT.md is written, ensuring artifacts exist before status changes. STATE.json is committed alongside CONTEXT.md in the same git commit.
- **Progress breadcrumb:** Always show the workflow breadcrumb at completion and in error messages.

## Anti-Patterns

- This skill operates at set level only. Use `resolve set` for resolution.
- Output artifact is CONTEXT.md in `.planning/sets/{set-id}/` -- not any per-wave file.
- Write CONTEXT.md using the Write tool directly -- do not call wave-planning.cjs helpers.
- Do not reference or resolve individual waves anywhere in this skill.
- Use `state transition set` for all state changes. No per-wave transitions.
- Do NOT ask more than 4 gray areas -- the locked decision is exactly 4.
- Do NOT ask one question at a time per area -- batch 4-5 questions per area into one AskUserQuestion with inline lettered options.
- Do NOT present a global "Let Claude decide all" option -- "Claude decides" is per-area only.
- Do NOT present freeform AskUserQuestion calls without pre-filled options -- always include at least "Claude decides" and "I'll answer in my own words" as AskUserQuestion options.
- Do NOT prompt for every implementation detail -- capture vision/what, not implementation/how.
