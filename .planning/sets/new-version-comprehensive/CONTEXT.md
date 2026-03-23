# CONTEXT: new-version-comprehensive

**Set:** new-version-comprehensive
**Generated:** 2026-03-23
**Mode:** interactive

<domain>
## Set Boundary
Enhances the `/rapid:new-version` skill's goal-gathering phase (Step 2C) by replacing the single freeform question with structured multi-category prompts and importing deferred decisions from the previous milestone. All changes land in `skills/new-version/SKILL.md`. The deferred-decisions import depends on DEFERRED.md files produced by the `discuss-overhaul` set -- if none exist, the feature gracefully skips.
</domain>

<decisions>
## Implementation Decisions

### Category Structure

- **Sequential prompts:** Present one AskUserQuestion per category (features, bugs, tech debt, UX, deferred). User focuses on one category at a time.
- **Per-category skip:** Each category prompt includes a "Nothing for this category" option so users can skip quickly.
- **5 categories:** Features, Bug Fixes, Tech Debt, UX Improvements, Deferred Decisions -- matching the CONTRACT.json spec. Deferred is handled as one of the 5 sequential prompts, not as a separate step.

### Deferred Import UX

- **Batch checklist:** Show all deferred items as a multi-select AskUserQuestion checklist. User checks which to include as goals for the new milestone.
- **Silent skip when none found:** If no DEFERRED.md files exist, skip the deferred category entirely with a brief note: "No deferred decisions found from previous milestone." No confirmation needed.

### Completeness Gate

- **Summary + confirm:** After all 5 category prompts, display a consolidated summary of all captured goals across categories, then ask "Is this complete?" with Yes/Add more options.
- **Freeform additions:** If the user says "Add more", let them type additional goals freeform without category constraints (not re-enter a specific category).

### Goal Output Format

- **Category-tagged output:** Preserve category structure with headers (## Features, ## Bug Fixes, etc.) when passing goals to the 6 research agents in Step 5. Research agents can prioritize by type.
- **Include carry-forward context:** Carried-forward unfinished sets are included as a separate section in the goals passed to research agents, so they have awareness of existing in-progress work.
</decisions>

<specifics>
## Specific Ideas
- The 5 sequential prompts should each have a "Nothing for this category" as the first option for quick skipping
- Deferred decisions batch checklist should show the source set ID alongside each deferred item for traceability
- The completeness summary should be a clean formatted table or bulleted list grouped by category
- Category-tagged goal output should use markdown headers matching the category names
</specifics>

<code_context>
## Existing Code Insights

- **Target file:** `skills/new-version/SKILL.md` -- single file modification
- **Step 2C (current):** A single freeform question: "Describe the goals for this milestone..." -- this is what gets replaced
- **Step 5 (downstream):** Goals string is interpolated directly into 6 research agent prompts as `{goals from Step 2}` -- the category-tagged format must remain compatible with this interpolation
- **Step 3 (carry-forward):** Already handles unfinished sets with carry-forward logic -- the carry-forward context for research agents should reuse this data
- **AskUserQuestion:** Used throughout the skill already; adding sequential prompts is consistent with existing patterns
- **No DEFERRED.md files exist yet** in the current codebase -- the discuss-overhaul set defines the format but hasn't produced any files. The deferred import must handle this gracefully.
- **state add-milestone:** Already accepts carry-forward sets as JSON stdin -- no changes needed to state tooling
</code_context>

<deferred>
## Deferred Ideas
- Could add a "templates" system for common milestone types (e.g., "polish release", "major feature") with pre-filled category suggestions -- out of scope for this set
- Could persist the structured goals as a separate artifact (GOALS.md) for auditability -- currently they're only passed through to research agents
</deferred>
