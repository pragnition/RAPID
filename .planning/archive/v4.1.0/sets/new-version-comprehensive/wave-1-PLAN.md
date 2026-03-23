# PLAN: new-version-comprehensive -- Wave 1

## Objective

Replace the single freeform goal-gathering question in Step 2C of `/rapid:new-version` with a structured multi-category interview covering features, bug fixes, tech debt, UX improvements, and deferred decisions. Add a completeness confirmation gate before proceeding to the research pipeline. All changes land in `skills/new-version/SKILL.md`.

## Owned Files

| File | Action |
|------|--------|
| `skills/new-version/SKILL.md` | Modify |

---

## Task 1: Replace Step 2C with structured category prompts (2C-i through 2C-iv)

**File:** `skills/new-version/SKILL.md`

**What to do:** Replace the current "Question C: Milestone Goals" block (lines 74-77) with four sequential AskUserQuestion prompts, one per category. Use sub-step numbering (2C-i through 2C-iv) to avoid renumbering Steps 3-9.

**Current content to replace:**

```
**Question C: Milestone Goals**

Ask freeform: "Describe the goals for this milestone. What should be achieved? What features, improvements, or changes are in scope? Be as specific as possible -- this will guide the research and roadmap generation."

Store these values for use in subsequent steps.
```

**Replace with the following structure:**

**Question C: Milestone Goals (Structured Categories)**

Gather goals across 4 categories using sequential AskUserQuestion prompts. Each category collects freeform input. Initialize an empty goals collection object with keys: features, bugFixes, techDebt, uxImprovements.

**Step 2C-i: Features**

Use AskUserQuestion with:
- question: "Category 1/5: New Features -- What new features or capabilities should this milestone deliver?"
- Options:
  - "Nothing for this category" -- "Skip -- no new features planned"
  - "Enter features" -- "Describe new features for this milestone"

If "Enter features": Ask freeform: "Describe the new features for this milestone. Be specific about what each feature should do."
Store response in goals.features.

**Step 2C-ii: Bug Fixes**

Use AskUserQuestion with:
- question: "Category 2/5: Bug Fixes -- Are there known bugs or issues to address in this milestone?"
- Options:
  - "Nothing for this category" -- "Skip -- no bug fixes planned"
  - "Enter bug fixes" -- "Describe bugs to fix in this milestone"

If "Enter bug fixes": Ask freeform: "Describe the bugs or issues to fix. Include reproduction steps or symptoms if known."
Store response in goals.bugFixes.

**Step 2C-iii: Tech Debt**

Use AskUserQuestion with:
- question: "Category 3/5: Tech Debt -- Any refactoring, cleanup, or infrastructure improvements?"
- Options:
  - "Nothing for this category" -- "Skip -- no tech debt work planned"
  - "Enter tech debt items" -- "Describe tech debt to address in this milestone"

If "Enter tech debt items": Ask freeform: "Describe the tech debt or infrastructure improvements to tackle."
Store response in goals.techDebt.

**Step 2C-iv: UX Improvements**

Use AskUserQuestion with:
- question: "Category 4/5: UX Improvements -- Any user experience, developer experience, or workflow improvements?"
- Options:
  - "Nothing for this category" -- "Skip -- no UX improvements planned"
  - "Enter UX improvements" -- "Describe UX improvements for this milestone"

If "Enter UX improvements": Ask freeform: "Describe the UX or developer experience improvements to make."
Store response in goals.uxImprovements.

**What NOT to do:**
- Do NOT renumber Steps 3-9. Use sub-step numbering within Step 2C.
- Do NOT remove the "Store these values for use in subsequent steps" instruction -- move it to after all categories are collected.
- Do NOT change Questions A or B.

**Verification:**
```bash
grep -c "2C-i\|2C-ii\|2C-iii\|2C-iv" skills/new-version/SKILL.md
# Expected: at least 4 matches
grep "Nothing for this category" skills/new-version/SKILL.md | wc -l
# Expected: at least 4 matches (one per non-deferred category)
```

---

## Task 2: Add deferred decisions import as Step 2C-v

**File:** `skills/new-version/SKILL.md`

**What to do:** After the 4 category prompts (Task 1), add Step 2C-v that reads `.planning/sets/*/DEFERRED.md` files and presents deferred items as a batch checklist.

**Insert after the Step 2C-iv block, before the completeness gate:**

**Step 2C-v: Deferred Decisions from Previous Milestone**

Read all DEFERRED.md files from previous milestone sets:

```bash
# Find all DEFERRED.md files
DEFERRED_FILES=$(find .planning/sets/*/DEFERRED.md 2>/dev/null)
```

**If no DEFERRED.md files exist (or all contain empty tables):**
Display: "Category 5/5: Deferred Decisions -- No deferred decisions found from previous milestone."
Set goals.deferredDecisions to empty.

**If DEFERRED.md files exist with content:**
Parse each DEFERRED.md file. The format is a markdown table with columns: #, Decision/Idea, Source, Suggested Target.

Collect all non-empty deferred items into a list. For each item, format as: "{Decision/Idea} (from set: {source set ID})".

Use AskUserQuestion with:
- question: "Category 5/5: Deferred Decisions -- Select which deferred items to include as goals for this milestone"
- multiSelect: true
- Options: one option per deferred item, formatted as "{Decision/Idea} (from set: {source set ID})" with description "{Suggested Target}"
- Plus a final option: "None of these" -- "Skip all deferred items"

Store selected items in goals.deferredDecisions.

**What NOT to do:**
- Do NOT prompt for confirmation when no DEFERRED.md files exist -- just display the skip message and move on.
- Do NOT fail or error when DEFERRED.md files are missing -- this is the expected default path.
- Do NOT read DEFERRED.md files from the *current* milestone's sets -- read from whatever sets exist in `.planning/sets/`.

**Verification:**
```bash
grep -c "DEFERRED.md" skills/new-version/SKILL.md
# Expected: at least 3 matches (find command, parse reference, skip message)
grep "Category 5/5" skills/new-version/SKILL.md | wc -l
# Expected: at least 1
grep "multiSelect" skills/new-version/SKILL.md | wc -l
# Expected: at least 1
```

---

## Task 3: Add completeness confirmation gate as Step 2C-vi

**File:** `skills/new-version/SKILL.md`

**What to do:** After all 5 category prompts, add a completeness gate that shows a consolidated summary and asks the user to confirm. This replaces the old "Store these values for use in subsequent steps" line.

**Insert after Step 2C-v:**

**Step 2C-vi: Completeness Confirmation**

Display a consolidated summary of all captured goals, grouped by category:

```
## Goal Summary for {milestoneName}

### Features
{goals.features or "-- none --"}

### Bug Fixes
{goals.bugFixes or "-- none --"}

### Tech Debt
{goals.techDebt or "-- none --"}

### UX Improvements
{goals.uxImprovements or "-- none --"}

### Deferred Decisions (Carried Forward)
{goals.deferredDecisions formatted as bullet list, or "-- none --"}
```

Use AskUserQuestion with:
- question: "Is this complete? Review the goals above."
- Options:
  - "Yes, proceed" -- "All requirements captured. Continue to research pipeline."
  - "Add more" -- "Add additional goals (freeform, no category constraints)"

**If "Add more":**
Ask freeform: "What additional goals should be included? (These will be added as general goals without a specific category.)"
Store the response as goals.additionalGoals.
Redisplay the updated summary with a new section "### Additional Goals" and re-prompt the completeness confirmation. Loop until user selects "Yes, proceed".

**If "Yes, proceed":**
Continue to Step 3.

**Store the final goals:** After confirmation, compose the category-tagged goals string for downstream use. Format as:

```
## Features
{goals.features}

## Bug Fixes
{goals.bugFixes}

## Tech Debt
{goals.techDebt}

## UX Improvements
{goals.uxImprovements}

## Deferred Decisions
{goals.deferredDecisions}

## Additional Goals
{goals.additionalGoals}
```

This category-tagged string replaces `{goals from Step 2}` in all downstream references (Steps 5, 6, 7). Empty categories are omitted from the output.

**What NOT to do:**
- Do NOT let users re-enter a specific category from the confirmation gate -- the "Add more" path is freeform only.
- Do NOT proceed to Step 3 without explicit user confirmation.
- Do NOT include empty categories (those the user skipped) in the final goals string -- omit them entirely.

**Verification:**
```bash
grep "Completeness Confirmation" skills/new-version/SKILL.md | wc -l
# Expected: 1
grep "Yes, proceed" skills/new-version/SKILL.md | wc -l
# Expected: at least 1
grep "Add more" skills/new-version/SKILL.md | wc -l
# Expected: at least 1
grep "category-tagged" skills/new-version/SKILL.md | wc -l
# Expected: at least 1
```

---

## Task 4: Add carry-forward context to research agent prompts

**File:** `skills/new-version/SKILL.md`

**What to do:** In Step 5, modify each of the 6 research agent spawn blocks to include carry-forward set context from Step 3 alongside the goals. Add a new section after the `Goals:` line in each agent prompt.

**In each of the 6 agent prompt blocks in Step 5**, after the line:
```
Goals: {goals from Step 2}
```

Add:
```

## Carry-Forward Context
{If carryForwardSets is non-empty, list each carried-forward set with its ID, status, and description. If empty, state "No carry-forward sets from previous milestone."}
```

This applies to all 6 blocks: rapid-research-stack, rapid-research-features, rapid-research-architecture, rapid-research-pitfalls, rapid-research-oversights, rapid-research-ux.

Also update the `Goals:` reference from `{goals from Step 2}` to `{category-tagged goals from Step 2C-vi}` in all 6 agent prompt blocks AND in the Step 7 roadmapper prompt block.

**What NOT to do:**
- Do NOT change the agent names, output file paths, or any other part of the agent prompts.
- Do NOT modify the brownfield context section -- carry-forward context is a separate section.
- Do NOT add carry-forward context to the synthesizer prompt (Step 6) -- it only reads the 6 research outputs.

**Verification:**
```bash
grep "Carry-Forward Context" skills/new-version/SKILL.md | wc -l
# Expected: 6 (one per research agent)
grep "category-tagged goals from Step 2C-vi" skills/new-version/SKILL.md | wc -l
# Expected: 7 (6 research agents + 1 roadmapper)
```

---

## Task 5: Update constraints and anti-patterns sections

**File:** `skills/new-version/SKILL.md`

**What to do:** Update the "Important Constraints" and "Anti-Patterns" sections at the bottom of the file to reflect the new structured goal-gathering flow.

**Add to "Important Constraints":**
- **Goal-gathering is sequential by category.** Each of the 5 categories (features, bugs, tech debt, UX, deferred) is presented as a separate AskUserQuestion. Users can skip any category.
- **Completeness gate is mandatory.** Users must explicitly confirm "Yes, proceed" before the research pipeline starts. The confirmation loop continues until the user approves.
- **Deferred import is graceful.** If no DEFERRED.md files exist, the deferred category is silently skipped with a brief message.

**Add to "Anti-Patterns":**
- Do NOT ask a single freeform question for all goals -- use the structured 5-category prompt sequence.
- Do NOT skip the completeness confirmation -- it is the final gate before research begins.
- Do NOT fail when DEFERRED.md files are missing -- graceful skip is the expected default.
- Do NOT allow category re-entry from the completeness gate -- "Add more" is freeform only.

**Verification:**
```bash
grep "sequential by category" skills/new-version/SKILL.md | wc -l
# Expected: 1
grep "graceful skip" skills/new-version/SKILL.md | wc -l
# Expected: at least 1
```

---

## Success Criteria

1. Step 2C contains 5 sequential category prompts (2C-i through 2C-v) plus a completeness gate (2C-vi)
2. Each category prompt has a "Nothing for this category" skip option
3. Deferred decisions import reads `.planning/sets/*/DEFERRED.md` files and presents items as a multiSelect checklist
4. Missing DEFERRED.md files are handled gracefully with a skip message
5. Completeness gate shows a category-grouped summary and requires explicit confirmation
6. "Add more" from the completeness gate allows freeform additions without category constraints
7. All 6 research agent prompts and the roadmapper prompt reference `{category-tagged goals from Step 2C-vi}`
8. All 6 research agent prompts include carry-forward context from Step 3
9. Constraints and anti-patterns sections reflect the new flow
10. Steps 3-9 are NOT renumbered -- sub-step numbering stays within Step 2C
