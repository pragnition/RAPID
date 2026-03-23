# Wave 1 PLAN: discuss-overhaul

## Objective

Overhaul `skills/discuss-set/SKILL.md` to (1) shift gray area focus from implementation/coding to architect-level and UI/UX questions, (2) make gray area count variable as multiples of 4 scaling with set complexity, (3) enrich each question with inline context/pros/cons/recommendations, (4) add DEFERRED.md capture for out-of-scope decisions, and (5) enhance the CONTEXT.md output template with richer structured sections.

All 5 tasks modify the same file and must execute sequentially within this single wave.

## File Ownership

| File | Action |
|------|--------|
| `skills/discuss-set/SKILL.md` | Modify (major rewrite) |

## Tasks

### Task 1: Rewrite Step 5 -- Variable Gray Area Count with Architect/UX Focus

**File:** `skills/discuss-set/SKILL.md` (lines 149-179)

**What to do:**

Replace the current "Identify 4 Gray Areas" step with a new "Identify Gray Areas" step that:

1. **Adds a complexity heuristic sub-section** before gray area identification:
   - Read `CONTRACT.json` `definition.tasks` array length as the primary signal
   - Define tiers: 1-3 tasks = 4 gray areas (n=1), 4-6 tasks = 8 gray areas (n=2), 7+ tasks = 12 gray areas (n=3)
   - State the model has discretion to adjust n by +/-1 based on overall set complexity (e.g., a 3-task set with complex integration boundaries could warrant 8 areas)
   - The total gray area count MUST be a multiple of 4

2. **Redefine what constitutes a gray area** -- replace the current bullet list with architect-level focus:
   - System architecture decisions (data flow, component boundaries, integration strategy)
   - API/interface design (contract shapes, versioning, error handling strategy)
   - State management approach (where state lives, sync strategy, persistence)
   - UI/UX decisions (layout, interaction patterns, visual hierarchy, user flows) -- only when the set has user-facing components
   - Performance/scaling tradeoffs at the architecture level
   - Explicitly exclude: library choices, coding patterns, function signatures, variable naming, file organization within a module

3. **Update the AskUserQuestion presentation** to handle n batches:
   - For n=1: one AskUserQuestion with 4 options (same as before)
   - For n=2: two AskUserQuestion calls, each with 4 options. Introduce each batch with a brief header like "Gray Areas (1 of 2)" and "Gray Areas (2 of 2)"
   - For n=3: three AskUserQuestion calls, each with 4 options
   - Each batch uses `multiSelect: true` so the user can select multiple areas per batch
   - Unselected areas in any batch default to Claude's discretion

4. **Update the response handling** to work with multiple batches:
   - Collect selections across all batches
   - If user selects nothing across ALL batches: all areas become Claude's discretion, skip to Step 7
   - Otherwise: selected areas proceed to Step 6

**What NOT to do:**
- Do not add a user override for the gray area count -- the model determines it
- Do not change the step numbering (keep it as Step 5)
- Do not remove the requirement that each gray area gets a title and description

**Verification:** Read the modified Step 5 and confirm: (a) complexity heuristic is defined, (b) gray area categories are architect/UX focused, (c) multi-batch AskUserQuestion flow is described, (d) no mention of "exactly 4" remains in this step.

---

### Task 2: Rewrite Step 6 -- Rich Question Format with Context/Pros/Cons

**File:** `skills/discuss-set/SKILL.md` (lines 182-213)

**What to do:**

Replace the current "Deep-Dive Selected Areas" step with an enriched question format:

1. **Define three question presentation formats** (the model chooses the best fit per question):

   **Format A -- Option Descriptions** (for straightforward choices):
   ```
   "{Gray area title} -- {Question}

   Context: {2-5 sentences explaining the tradeoff, constraints, and implications}

   | Option | Pros | Cons |
   |--------|------|------|
   | A: {name} | {pros} | {cons} |
   | B: {name} | {pros} | {cons} |
   | C: {name} (Recommended) | {pros} | {cons} |
   "
   Options:
   1. "{Option A name}" -- "{1-sentence summary}"
   2. "{Option B name}" -- "{1-sentence summary}"
   3. "{Option C name} (Recommended)" -- "{1-sentence summary}"
   4. "Claude decides" -- "Let Claude pick the best approach"
   ```

   **Format B -- Preview Panels** (for visual/UI layout questions, single-select only):
   ```
   "{Gray area title} -- {Question}

   Context: {2-5 sentences explaining the visual tradeoff}
   "
   Options (with preview field):
   1. "{Layout A}" -- preview: "{ASCII/text mockup of layout A}"
   2. "{Layout B}" -- preview: "{ASCII/text mockup of layout B}"
   3. "Claude decides" -- "Let Claude pick"
   ```
   Note: preview panels only work with single-select (not multiSelect). Use this format only for questions where visual comparison adds value.

   **Format C -- Question Context Block** (for complex multi-factor tradeoffs):
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
   1-3. {options}
   4. "Claude decides"
   ```

2. **Tag recommendations**: When the model has a clear recommendation, tag the option with `(Recommended)` in both the description body and the option label. If no clear recommendation exists, omit the tag.

3. **Keep the existing follow-up mechanism** (lines 206-212) -- after all selected areas are discussed, compile follow-up questions if gaps remain.

4. **Context length guardrail**: Each question's context block (the text inside the AskUserQuestion prompt) should be 2-5 sentences. Tables and key-factor lists do not count toward this limit but should be concise.

**What NOT to do:**
- Do not require all three formats in every discussion -- the model picks the best fit per question
- Do not change the "Claude decides" option behavior
- Do not remove the follow-up mechanism

**Verification:** Read the modified Step 6 and confirm: (a) three formats are defined, (b) each includes 2-5 sentence context, (c) pros/cons or key-factors are present, (d) `(Recommended)` tagging is described, (e) preview panel constraints are documented.

---

### Task 3: Add DEFERRED.md Capture Logic

**File:** `skills/discuss-set/SKILL.md`

**What to do:**

1. **Add a new Step 6.5** (between current Step 6 and Step 7) titled "Capture Deferred Decisions":

   After all gray area deep-dives and follow-ups are complete, the model should:
   - Review the entire discussion for ideas, questions, or decisions that were raised but fall outside the current set's scope
   - Review the CONTRACT.json `definition.scope` to determine what is in-scope vs. out-of-scope
   - If any out-of-scope items exist, write them to `.planning/sets/${SET_ID}/DEFERRED.md`

   DEFERRED.md format:
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

   - If no deferred items exist, still write DEFERRED.md with an empty table and a note: "No deferred items identified during this discussion."
   - In `--skip` mode (Step 4), the rapid-research-stack agent should also write an empty DEFERRED.md. Add this instruction to the Step 4 agent prompt.

2. **Update Step 8 (git commit)** to include DEFERRED.md:
   Change the git add line from:
   ```
   git add ".planning/sets/${SET_ID}/CONTEXT.md" ".planning/STATE.json"
   ```
   to:
   ```
   git add ".planning/sets/${SET_ID}/CONTEXT.md" ".planning/sets/${SET_ID}/DEFERRED.md" ".planning/STATE.json"
   ```

**What NOT to do:**
- Do not make DEFERRED.md optional -- always write it (even if empty)
- Do not add downstream integration with new-version skill (that is itself deferred)
- Do not renumber existing steps -- use 6.5 or fold it into Step 6's end

**Verification:** Read the modified file and confirm: (a) DEFERRED.md format is defined, (b) Step 4 --skip mode mentions DEFERRED.md, (c) Step 8 git add includes DEFERRED.md.

---

### Task 4: Enhance CONTEXT.md Output Template

**File:** `skills/discuss-set/SKILL.md` (lines 216-266)

**What to do:**

Replace the current CONTEXT.md template in Step 7 with an enhanced version:

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

Key changes from current template:
- **Add `Rationale:` field** under each decision -- 1-2 sentences explaining the reasoning
- **Add deferred items summary** in the `<deferred>` section that references DEFERRED.md content
- The `<domain>`, `<decisions>`, `<specifics>`, `<code_context>`, and `<deferred>` XML tags remain unchanged (plan-set consumes these)

**What NOT to do:**
- Do not change the XML tag names -- plan-set parses these
- Do not remove any existing sections
- Do not add new XML tags (keep the same 5 tags)

**Verification:** Read the modified Step 7 and confirm: (a) Rationale field is present under decisions, (b) deferred section references DEFERRED.md, (c) all 5 XML tags are preserved.

---

### Task 5: Update Key Principles and Anti-Patterns

**File:** `skills/discuss-set/SKILL.md` (lines 327-350)

**What to do:**

1. **Update Key Principles** (lines 327-338):
   - Change "Exactly 4 gray areas" to: **"Variable gray area count (4n):"** Gray area count scales with set complexity in multiples of 4. The task count in CONTRACT.json drives the heuristic; the model may adjust based on overall complexity.
   - Add new principle: **"Architect-level focus:"** Gray areas target system architecture, integration boundaries, and UI/UX decisions. Never ask about specific coding patterns, library choices, or implementation details.
   - Add new principle: **"Rich question context:"** Each question provides 2-5 sentences of context with pros/cons or key factors. Use the most appropriate format (option descriptions, preview panels, or context blocks) per question.
   - Add new principle: **"Deferred decisions:"** Out-of-scope ideas raised during discussion are captured in DEFERRED.md, never silently dropped.
   - Update "CONTEXT.md output" principle to mention decision rationale and deferred items summary.

2. **Update Anti-Patterns** (lines 340-350):
   - Remove line 347: "Do NOT ask about fewer or more than 4 gray areas -- always present exactly 4."
   - Replace with: "Do NOT ask a non-multiple-of-4 number of gray areas -- the count must be 4, 8, or 12."
   - Add: "Do NOT ask implementation-level questions (library choices, coding patterns, function signatures) -- keep gray areas at the architecture and UX level."
   - Add: "Do NOT present questions without inline context -- every question must include 2-5 sentences of context explaining the tradeoff."
   - Add: "Do NOT silently drop out-of-scope ideas -- capture them in DEFERRED.md."
   - Keep all other existing anti-patterns unchanged.

**What NOT to do:**
- Do not remove anti-patterns about wave-level operations, batching, or "Let Claude decide all"
- Do not change the section headers ("Key Principles", "Anti-Patterns")

**Verification:** Read the modified principles/anti-patterns and confirm: (a) "exactly 4" language is gone, (b) variable count principle exists, (c) architect-level focus principle exists, (d) DEFERRED.md anti-pattern exists, (e) no-coding-questions anti-pattern exists.

---

## Success Criteria

1. Gray areas focus on architecture and UI/UX, not coding details -- verified by reading Step 5 categories
2. Gray area count is variable (4, 8, or 12) based on task count heuristic -- verified by reading Step 5 heuristic
3. Each question provides rich inline context with pros/cons and recommendations -- verified by reading Step 6 formats
4. DEFERRED.md capture logic exists with defined format -- verified by reading Step 6.5
5. CONTEXT.md template includes decision rationale and deferred summary -- verified by reading Step 7
6. Key Principles and Anti-Patterns are updated consistently -- verified by reading final sections
7. No "exactly 4" language remains anywhere in the file

## Commit

After all tasks are complete, stage and commit:

```bash
git add skills/discuss-set/SKILL.md
git commit -m "feat(discuss-overhaul): overhaul discuss-set skill with variable gray areas, rich questions, and deferred decisions"
```
