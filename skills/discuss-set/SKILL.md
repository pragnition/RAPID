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
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
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

   Also write an empty DEFERRED.md to .planning/sets/{SET_ID}/DEFERRED.md:
   - Use the standard DEFERRED.md format with an empty table
   - Add note: "No deferred items identified (auto-skip mode)."
   ```

3. After agent completes, verify CONTEXT.md was written:

   ```bash
   # (env preamble here)
   [ -f ".planning/sets/${SET_ID}/CONTEXT.md" ] && echo "CONTEXT.md created" || echo "ERROR: CONTEXT.md not found"
   ```

4. Skip to Step 8 (State Transition and Commit) -- CONTEXT.md was already written by the agent above.

If the `--skip` flag is NOT set, continue to Step 5.

---

## Step 5: Identify Gray Areas (Interactive Mode)

### Complexity Heuristic

Before identifying gray areas, determine how many to present. Read `CONTRACT.json` `definition.tasks` array length as the primary signal:

| Task Count | Gray Areas (n) | Total |
|-----------|----------------|-------|
| 1-3 tasks | n=1 | 4 gray areas |
| 4-6 tasks | n=2 | 5-8 gray areas |
| 7+ tasks  | n=3 | 9+ gray areas |

The model has discretion to adjust n by +/-1 based on overall set complexity. For example, a 3-task set with complex integration boundaries could warrant 8 areas (n=2), or a simple 5-task set could use 4 areas (n=1). The total gray area count need not always be a multiple of 4 but it must minimally be 4.

### Gray Area Categories

Analyze set context (CONTRACT.json, DEFINITION.md, SET-OVERVIEW.md, ROADMAP.md, source files) and identify gray areas. Gray areas are **architect-level decisions** where multiple valid approaches exist:

- **System architecture decisions:** Data flow, component boundaries, integration strategy
- **API/interface design:** Contract shapes, versioning, error handling strategy
- **State management approach:** Where state lives, sync strategy, persistence
- **UI/UX decisions:** Layout, interaction patterns, visual hierarchy, user flows -- only when the set has user-facing components
- **Performance/scaling tradeoffs:** At the architecture level, not micro-optimization

**Explicitly excluded from gray areas:** Library choices, coding patterns, function signatures, variable naming, file organization within a module. These are implementation details, not architectural decisions.

When the set's context (SET-OVERVIEW.md, CONTRACT.json, ROADMAP.md description) indicates user-facing components, frontend work, or UI changes, weave UI/UX considerations naturally into the relevant gray areas. For sets with no user-facing components (pure backend, CLI internals, infrastructure), UI/UX gray areas are unnecessary and should not be forced.

Each gray area MUST have a title and a 1-sentence description.

### Presenting Gray Areas (Consolidated)

Present gray areas using AskUserQuestion. All batches are packed into a SINGLE AskUserQuestion call with multiple questions (one question per batch of 4):

**For n=1 (4 gray areas):** One AskUserQuestion call with 1 question:

```
"I've analyzed set '{SET_ID}' and identified 4 areas that would benefit from your input.
Select which areas you'd like to discuss (unselected areas default to Claude's discretion):"
Options (multiSelect: true):
1. "{Gray area 1 title}" -- "{1-sentence description}"
2. "{Gray area 2 title}" -- "{1-sentence description}"
3. "{Gray area 3 title}" -- "{1-sentence description}"
4. "{Gray area 4 title}" -- "{1-sentence description}"
```

**For n=2 (5-8 gray areas):** One AskUserQuestion call with 2 questions:

```
"I've analyzed set '{SET_ID}' and identified 8 areas that would benefit from your input.
Select which areas you'd like to discuss (unselected areas default to Claude's discretion):"
Question 1 (multiSelect: true): "Core Architecture"
Options 1-4: {first 4 gray areas}
Question 2 (multiSelect: true): "Integration & Boundaries"
Options 1-4: {next 4 gray areas}
```

**For n=3 (9+ gray areas):** One AskUserQuestion call with 3 questions. Use descriptive category labels for each question (e.g., "Core Architecture", "Integration & Boundaries", "UX & Presentation").

### Handling Responses

- Collect selections across all questions.
- If the user selects no areas across ALL questions (empty selection across all questions): Record all areas as Claude's discretion. Skip to Step 7 (Write CONTEXT.md).
- If the user selects specific areas in any question: Record selected areas for Step 6. Unselected areas across all questions are recorded as Claude's discretion.

---

## Step 6: Deep-Dive Selected Areas (Rich Question Format)

For EACH selected gray area (in order), prepare minimally 2 questions. For each batch of 4 questions, ask a SEPARATE AskUserQuestion with the batch of questions. EACH question should only ask the user about ONE thing. The user should not be thinking about multiple decisions within the same question.

For example, if we have a gray area with 3 questions, we should ask one AskUserQuestion with the 3 questions within the same prompt. If we had 7 questions, then we would ask 2 AskUserQuestions, with 4 and 3 questions respectively.

Choose the most appropriate question format per question from the three formats below:

### Format A -- Option Descriptions

Best for straightforward choices between distinct approaches:

```
"{Gray area title} -- {Question}

Context: {2-5 sentences explaining the tradeoff, constraints, and implications}

**A: {name}**
**Pros:** {pros}
**Cons:** {cons}

**B: {name}**
**Pros:** {pros}
**Cons:** {cons}

**C: {name} (Recommended)**
**Pros:** {pros}
**Cons:** {cons}
"
Options:
1. "{Option A name}" -- "{1-sentence summary}"
2. "{Option B name}" -- "{1-sentence summary}"
3. "{Option C name} (Recommended)" -- "{1-sentence summary}"
4. "Claude decides" -- "Let Claude pick the best approach"
```

### Format B -- Preview Panels

Best for visual/UI layout questions where visual comparison adds value. **Single-select only** (not multiSelect) -- preview panels do not work with multiSelect:

```
"{Gray area title} -- {Question}

Context: {2-5 sentences explaining the visual tradeoff}
"
Options (with preview field):
1. "{Layout A}" -- preview: "{ASCII/text mockup of layout A}"
2. "{Layout B}" -- preview: "{ASCII/text mockup of layout B}"
3. "Claude decides" -- "Let Claude pick"
```

Use this format only for questions where visual comparison adds clear value (e.g., layout arrangements, component positioning, navigation structure).

### Format C -- Question Context Block

Best for complex multi-factor tradeoffs where a table does not capture the nuances:

```
"{Gray area title} -- {Question}

Context: {3-5 sentences covering the tradeoff dimensions}

Key factors:
- {Factor 1}: {implication}
- {Factor 2}: {implication}
- {Factor 3}: {implication}

Recommendation: {Option X} because {1-sentence rationale}
"
Options:
1. "{Option A}" -- "{1-sentence summary}"
2. "{Option B}" -- "{1-sentence summary}"
3. "{Option C}" -- "{1-sentence summary}"
4. "Claude decides" -- "Let Claude pick the best approach"
```

### Tagging Recommendations

When the model has a clear recommendation, tag the option with `(Recommended)` in both the description body and the option label. If no clear recommendation exists, omit the tag entirely.

### Context Length Guardrail

Each question's context block (the text inside the AskUserQuestion prompt) should be 2-5 sentences. Tables and key-factor lists do not count toward this limit but should be kept concise.

### Recording Responses

1. Record the user's selected option for each question.
2. If user selected "Claude decides" for a question: Record that specific question as Claude's discretion.

### Follow-Up

After ALL selected areas are discussed:

- Compile follow-up questions if gaps in your understanding of the user's intentions remain after all areas were covered.
- If gaps exist: Continue to prompt the user using AskUserQuestion with remaining questions until you are FULLY satisfied.
- If no gaps: Skip follow-up entirely.

---

## Step 6.5: Capture Deferred Decisions

After all gray area deep-dives and follow-ups are complete, review the entire discussion for ideas, questions, or decisions that were raised but fall outside the current set's scope.

1. **Determine scope boundary:** Read `CONTRACT.json` `definition.scope` to determine what is in-scope vs. out-of-scope for this set.

2. **Identify deferred items:** Scan the discussion for any ideas, suggestions, or decision threads that:
   - Were raised during gray area discussion or follow-ups
   - Fall outside this set's defined scope
   - Would be valuable for future sets or milestones

3. **Write DEFERRED.md:** Always write `.planning/sets/${SET_ID}/DEFERRED.md` using the Write tool:

```markdown
# DEFERRED: {SET_ID}

**Set:** {SET_ID}
**Generated:** {date}

## Deferred Decisions

Items raised during discussion that fall outside this set's scope.

| # | Decision/Idea | Source | Suggested Target |
|---|--------------|--------|-----------------|
| 1 | {description} | {which gray area or follow-up raised it} | {suggested future set or milestone} |
| 2 | ... | ... | ... |

## Notes
- These items should be reviewed during `/rapid:new-version` planning
- Items may be promoted to backlog entries or new sets in future milestones
```

- If no deferred items exist, still write DEFERRED.md with an empty table and add a note: "No deferred items identified during this discussion."
- DEFERRED.md is always written -- it is not optional.

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
- {Decision from discussion or "Claude's Discretion"}
- **Rationale:** {1-2 sentences explaining WHY this decision was made -- what factors drove it}

### {Area 2 Title}
- ...
- **Rationale:** ...

### Claude's Discretion
- {Areas where user selected "Let Claude decide"}
- {Specific gray area identification prompts left to Claude}
</decisions>

<specifics>
## Specific Ideas
- {Any specific ideas mentioned during discussion}
</specifics>

<code_context>
## Existing Code Insights
- {Patterns, integration points, reusable code discovered during context gathering}
</code_context>

<deferred>
## Deferred Ideas
- {Summary of items from DEFERRED.md -- brief one-liner per item}
- {If no deferred items: "No deferred items identified."}
</deferred>
```

Key elements of CONTEXT.md:
- **Rationale field** under each decision: 1-2 sentences explaining the reasoning behind the decision
- **Deferred section** references content from DEFERRED.md as brief one-liners
- All 5 XML tags (`<domain>`, `<decisions>`, `<specifics>`, `<code_context>`, `<deferred>`) are preserved -- plan-set parses these

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
git add ".planning/sets/${SET_ID}/CONTEXT.md" ".planning/sets/${SET_ID}/DEFERRED.md" ".planning/STATE.json"
git commit -m "discuss-set(${SET_ID}): capture set implementation vision"
```

---

## Step 9: Footer

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:plan-set {SET_INDEX}" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set > execute-set > review > merge"
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
- **Variable gray area count (4n):** Gray area count scales with set complexity in multiples of 4. The task count in CONTRACT.json drives the heuristic; the model may adjust based on overall complexity.
- **Architect-level focus:** Gray areas target system architecture, integration boundaries, and UI/UX decisions. Never ask about specific coding patterns, library choices, or implementation details.
- **Rich question context:** Each question provides 2-5 sentences of context with pros/cons or key factors. Use the most appropriate format (option descriptions, preview panels, or context blocks) per question.
- **Consolidated questions with options:** Present all gray area batches as questions within a single AskUserQuestion call. Each question has prefilled options including "Claude decides".
- **"Claude decides" option:** Available as a prefilled option per question. Unselected gray areas in Step 5 automatically default to Claude's discretion.
- **Deferred decisions:** Out-of-scope ideas raised during discussion are captured in DEFERRED.md, never silently dropped.
- **--skip auto-context:** The --skip flag spawns a rapid-research-stack agent to auto-generate CONTEXT.md and an empty DEFERRED.md without user interaction.
- **Read before asking:** Always read existing artifacts (CONTRACT.json, SET-OVERVIEW.md, DEFINITION.md) to avoid re-asking settled questions.
- **CONTEXT.md output:** Written to `.planning/sets/{set-id}/CONTEXT.md` using the Write tool -- consumed by downstream plan-set. Includes decision rationale and deferred items summary.
- **Set-level state transitions:** Only use `state transition set` to move from pending to discussed. Never use wave-level transitions.
- **State transition is the final mutation:** Happens AFTER CONTEXT.md and DEFERRED.md are written, ensuring artifacts exist before status changes. STATE.json is committed alongside artifacts in the same git commit.
- **Progress breadcrumb:** Always show the workflow breadcrumb at completion and in error messages.

## Anti-Patterns

- This skill operates at set level only. Use `resolve set` for resolution.
- Output artifacts are CONTEXT.md and DEFERRED.md in `.planning/sets/{set-id}/` -- not any per-wave file.
- Write CONTEXT.md and DEFERRED.md using the Write tool directly -- do not call wave-planning.cjs helpers.
- Do not reference or resolve individual waves anywhere in this skill.
- Use `state transition set` for all state changes. No per-wave transitions.
- Do NOT ask a non-multiple-of-4 number of gray areas -- the count must be 4, 8, or 12.
- Do NOT ask implementation-level questions (library choices, coding patterns, function signatures) -- keep gray areas at the architecture and UX level.
- Do NOT present questions without inline context -- every question must include 2-5 sentences of context explaining the tradeoff.
- Do NOT silently drop out-of-scope ideas -- capture them in DEFERRED.md.
- Do NOT use freeform text in AskUserQuestion -- each question must have prefilled multiSelect options. Gray area batches are packed as structured questions within a single call, not as freeform prompts.
- Do NOT present "Let Claude decide all" as a checkbox option -- use the implicit unselected model instead.
- Do NOT prompt for every implementation detail -- capture vision/what, not implementation/how.
