# PLAN: new-version-ux / Wave 1

**Objective:** Enhance `skills/new-version/SKILL.md` with spec file argument support, spec-aware goal pre-population, and expanded DEFERRED.md auto-discovery. Backward compatibility preserved: no-argument invocation is unchanged.

**Owned File:** `skills/new-version/SKILL.md`

---

## Task 1: Add `--spec <path>` argument parsing to Step 0

**File:** `skills/new-version/SKILL.md`
**Location:** After the banner display block (after line 29), before the `---` separator at line 31.

**Action:** Insert a new subsection titled `### Step 0.5: Parse Optional Arguments` between the banner display and the Step 1 separator. The subsection must contain:

1. A paragraph explaining: "If the user invoked `/new-version` with arguments, parse them here. The supported argument is `--spec <path>` which provides a structured Markdown file to pre-populate milestone goals."

2. Instructions for the orchestrator:
   - Check if the skill was invoked with arguments (the user's input after `/rapid:new-version`).
   - If the input contains a file path argument (with or without `--spec` prefix), treat it as a spec file path.
   - Read the spec file using the Read tool. If the file does not exist or cannot be read, display a warning: "Spec file not found at {path}. Falling back to interactive goal-gathering." and set `specContent = null`.
   - If the file is read successfully, store its full content as `specContent` for use in Step 2C.
   - If no arguments were provided, set `specContent = null`. This is the backward-compatible default.

3. A brief note: "When `specContent` is null, all subsequent steps behave identically to the original flow."

**Acceptance:** The SKILL.md contains a Step 0.5 that parses the `--spec` argument and either loads spec content or sets `specContent = null`.

---

## Task 2: Implement spec-aware goal pre-population in Step 2C

**File:** `skills/new-version/SKILL.md`
**Location:** Step 2C (line 74 onward). Insert a conditional branch immediately after the "Question C: Milestone Goals" heading (line 74) and before "Step 2C-i: Features" (line 78).

**Action:** Insert a conditional block that creates two distinct flows:

### Flow A: Spec-aware path (when `specContent` is not null)

Insert the following instructions after line 77 (after the `Initialize an empty goals collection...` sentence) and before Step 2C-i:

**"If `specContent` is not null, execute the Spec-Aware Goal Extraction flow instead of Steps 2C-i through 2C-v:"**

1. **Semantic Category Extraction:** Instruct the orchestrator (which is an LLM) to read `specContent` and semantically map its content to the 5 goal categories: `features`, `bugFixes`, `techDebt`, `uxImprovements`, `deferredDecisions`. The spec file uses structured Markdown with category headings (e.g., `## Features`, `## Bug Fixes`, `## Technical Debt`, etc.). The orchestrator should use LLM understanding to match headings to categories even if the exact heading text differs (e.g., "## New Capabilities" maps to features, "## Cleanup" maps to techDebt). Content under unrecognized headings should be placed in `additionalGoals`.

2. **Deferred Items Injection:** Before presenting the extracted goals, also run the DEFERRED.md auto-discovery from Task 3 (the expanded discovery that includes archive). Append any discovered deferred items to the `deferredDecisions` category automatically.

3. **Single Confirmation Prompt:** Display the extracted goals in the same summary format as Step 2C-vi (the category-grouped summary). Then use AskUserQuestion with:
   - question: "Goals extracted from spec file. Review and confirm."
   - Options:
     - "Accept all" -- "Proceed with these goals as-is"
     - "Review individually" -- "Step through each category with Accept/Augment/Replace options"
     - "Add more" -- "Add additional goals beyond what the spec contains"

4. **If "Accept all":** Set all goal categories from extracted content. Skip to Step 2C-vi completeness confirmation (the "Yes, proceed" gate).

5. **If "Review individually":** For each of the 5 categories, display the extracted content (or "-- empty --" if spec had nothing for that category) and use AskUserQuestion with:
   - question: "Category {N}/5: {categoryName}"
   - Options:
     - "Accept" -- "Keep extracted content as-is"
     - "Augment" -- "Add to the extracted content"
     - "Replace" -- "Discard extracted content and enter new content"
   - If "Augment": Ask freeform "What would you like to add to this category?" and append the response to the extracted content.
   - If "Replace": Ask freeform "Enter new content for this category." and replace the extracted content entirely.
   - If the category was empty in the spec, fall back to the original interactive prompt for that category (the existing Step 2C-i through 2C-v behavior for that single category).
   After all 5 categories reviewed, proceed to Step 2C-vi completeness confirmation.

6. **If "Add more":** Same behavior as the existing "Add more" in Step 2C-vi -- ask freeform and append to additionalGoals, then re-display and re-prompt.

### Flow B: Interactive path (when `specContent` is null)

**"If `specContent` is null, proceed with the original Steps 2C-i through 2C-v as written below."**

No changes to the existing Steps 2C-i through 2C-v. They remain exactly as-is for backward compatibility.

**Acceptance:** When a spec file is provided, the 5-prompt sequence is replaced by a single confirmation prompt (with optional individual review). When no spec is provided, behavior is identical to current.

---

## Task 3: Expand DEFERRED.md auto-discovery to include archive

**File:** `skills/new-version/SKILL.md`
**Location:** Step 2C-v (lines 122-146). Replace the existing `find` command and expand the discovery logic.

**Action:**

1. Replace the existing bash block at lines 126-129 with an expanded discovery snippet:

```bash
# Find DEFERRED.md files from active sets
DEFERRED_ACTIVE=$(find .planning/sets/*/DEFERRED.md 2>/dev/null)

# Find previous milestone ID from STATE.json for archive scanning
PREV_MILESTONE=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null | node -e "
  const s = require('fs').readFileSync('/dev/stdin','utf8');
  const j = JSON.parse(s);
  const ms = j.milestones || [];
  const ci = ms.findIndex(m => m.id === j.currentMilestone);
  if (ci > 0) console.log(ms[ci-1].id);
" 2>/dev/null)

# Find DEFERRED.md files from previous milestone archive (if it exists)
DEFERRED_ARCHIVE=""
if [ -n "${PREV_MILESTONE}" ]; then
  DEFERRED_ARCHIVE=$(find .planning/archive/${PREV_MILESTONE}/sets/*/DEFERRED.md 2>/dev/null)
fi

# Combine both sources
DEFERRED_FILES="${DEFERRED_ACTIVE}
${DEFERRED_ARCHIVE}"
DEFERRED_FILES=$(echo "${DEFERRED_FILES}" | grep -v '^$')
```

2. The rest of Step 2C-v (the conditional logic for empty vs non-empty deferred files, the multi-select prompt) remains unchanged -- it already works with the `DEFERRED_FILES` variable.

3. Add a note after the bash block: "This discovers deferred items from both active sets in the current milestone and the immediately previous milestone's archive. If this is the first-ever milestone (no previous milestone exists), only active sets are scanned."

**Acceptance:** DEFERRED.md files from both `.planning/sets/*/DEFERRED.md` and `.planning/archive/{prevMilestone}/sets/*/DEFERRED.md` are discovered.

---

## Task 4: Add `## Deferred Context` section to researcher brief templates in Step 5

**File:** `skills/new-version/SKILL.md`
**Location:** Step 5 (lines 317-457). Each of the 6 researcher agent spawn blocks contains a brief template.

**Action:** In each of the 6 researcher agent brief templates (lines ~327-347, ~351-369, ~373-391, ~395-413, ~417-435, ~439-457), insert a new section after `## Carry-Forward Context` and before `## Working Directory`:

```
## Deferred Context
{If any DEFERRED.md items were discovered in Step 2C-v (from either active sets or archive), list them here as a bullet list with source attribution: "- {Decision/Idea} (from: {source set ID}, suggested target: {Suggested Target})". If no deferred items exist, state "No deferred items from previous work."}
```

This ensures all 6 researchers receive deferred context automatically, regardless of whether the user selected those items as goals. The goal is awareness -- researchers should factor in deferred decisions even if they were not explicitly chosen as milestone goals.

**Acceptance:** All 6 researcher brief templates contain a `## Deferred Context` section populated from discovered DEFERRED.md items.

---

## Task 5: Backward compatibility verification

**File:** `skills/new-version/SKILL.md`

**Action:** After all modifications, verify backward compatibility by reviewing the final SKILL.md for these properties:

1. When `specContent` is null (no `--spec` argument), the flow through Steps 2C-i to 2C-vi is identical to the original -- no new prompts, no changed prompt text, no missing prompts.
2. The expanded DEFERRED.md discovery in Step 2C-v is strictly additive -- it finds more files but the downstream multi-select prompt and "no deferred found" fallback are unchanged.
3. Step 0 still works without arguments (the `--spec` parsing is a no-op when no arguments are provided).
4. The Anti-Patterns section at the bottom still applies. Do NOT add any new anti-patterns that contradict existing ones.
5. The Important Constraints section is still accurate. Add one new constraint: "**Spec file is optional.** The `--spec` argument is never required. Omitting it produces identical behavior to the pre-spec implementation."

**Verification:** Read the final SKILL.md end-to-end and confirm:
- `specContent = null` path has zero behavioral changes
- All 6 researcher briefs have `## Deferred Context`
- The spec-aware flow has the Accept/Augment/Replace UX
- Archive DEFERRED.md scanning uses the previous milestone from STATE.json

**Acceptance:** The final SKILL.md is a clean, coherent prompt document with no contradictions, no orphaned references, and full backward compatibility.

---

## Success Criteria

1. `/new-version` without arguments behaves identically to current implementation
2. `/new-version --spec path/to/spec.md` extracts goals from the spec and presents a single confirmation prompt
3. The "Review individually" option provides Accept/Augment/Replace per category
4. DEFERRED.md items are discovered from both active sets and the previous milestone archive
5. All 6 researcher briefs include a `## Deferred Context` section
6. First-ever milestone (no previous) gracefully skips archive scanning
