# Stack Research: new-version-comprehensive

## Core Stack Assessment

### Technology: SKILL.md (Prompt-instructional file)
- **Type:** Markdown prompt file consumed by Claude Code agent runtime
- **No runtime dependencies:** SKILL.md is not executed as code -- it is interpreted by the Claude Code agent. There are no package imports, no compilation step, and no runtime version constraints.
- **Modification scope:** All changes are textual/instructional modifications to a single file (`skills/new-version/SKILL.md`, currently 506 lines).

### AskUserQuestion Tool
- **Version:** Built into Claude Code runtime (not a project dependency)
- **Capabilities confirmed in codebase:**
  - Single-select with named options and descriptions
  - `multiSelect: true` for checkbox-style selection (used in discuss-set/SKILL.md)
  - `preview` field on options for visual panels (single-select only)
  - Freeform text input via follow-up questions
- **Constraint:** multiSelect and preview panels are mutually exclusive
- **Relevance:** The deferred-decisions checklist will use `multiSelect: true` for batch selection

### RAPID Tools CLI (`rapid-tools.cjs`)
- **Relevant commands:** `state get --all`, `state add-milestone`, `display banner`
- **No new CLI commands needed:** The set reads DEFERRED.md files via the Read tool and glob patterns, not via rapid-tools.cjs
- **State format:** STATE.json contains `milestones[id].sets[]` with `{ id, name, status, branch }` -- no changes needed

## Dependency Health

| Component | Current | Status | Notes |
|-----------|---------|--------|-------|
| skills/new-version/SKILL.md | 506 lines, 9 steps | Active | Target file for all modifications |
| skills/discuss-set/SKILL.md | ~480 lines | Active | Produces DEFERRED.md files consumed by this feature |
| AskUserQuestion | Claude Code built-in | Active | multiSelect confirmed working |
| Read tool | Claude Code built-in | Active | Used to read DEFERRED.md files |
| Glob tool | Claude Code built-in | Active | Used to find `.planning/sets/*/DEFERRED.md` |
| Agent tool | Claude Code built-in | Active | Used to spawn 6 research agents |

## Compatibility Matrix

### DEFERRED.md Format (Cross-set dependency)
- **Producer:** `discuss-set` skill (from `discuss-overhaul` set, planned but not yet executed)
- **Consumer:** This feature (new-version-comprehensive)
- **Format:** Markdown table with columns: `#`, `Decision/Idea`, `Source`, `Suggested Target`
- **Header:** `# DEFERRED: {SET_ID}` with metadata lines (`**Set:**`, `**Generated:**`)
- **Empty state:** DEFERRED.md is always written, even when empty (contains empty table + note)
- **Current state:** Zero DEFERRED.md files exist in the codebase today
- **Compatibility risk:** LOW -- the format is defined in discuss-set/SKILL.md and this feature must parse it. The format is simple markdown; regex or line-based parsing is sufficient.

### Goal Output Compatibility (Downstream)
- **Consumer:** 6 research agent prompts in Step 5 + roadmapper in Step 7
- **Current interpolation:** `{goals from Step 2}` -- a single string substitution
- **New format:** Category-tagged markdown with headers (`## Features`, `## Bug Fixes`, etc.)
- **Compatibility risk:** NONE -- the interpolation is plain text substitution. Adding markdown headers and bullet points under each category is fully compatible with the existing `{goals from Step 2}` placeholder. Research agents already receive freeform text.

### Carry-forward Context (Downstream)
- **Source:** Step 3 `carryForwardSets` array
- **Current usage:** Only passed to `state add-milestone` as JSON stdin
- **New usage:** Also included in research agent prompts as a separate section
- **Compatibility risk:** NONE -- additive change to the agent prompt templates

## Upgrade Paths

No upgrades needed. This set modifies a single prompt file and introduces no new dependencies.

## Tooling Assessment

### File Discovery for DEFERRED.md
- **Approach:** Use Glob with pattern `.planning/sets/*/DEFERRED.md` to find all deferred files
- **Parsing:** Read each file, extract table rows between the `|---|` separator line and the `## Notes` section
- **Edge cases:**
  - No DEFERRED.md files found: skip deferred category with brief note
  - DEFERRED.md exists but table is empty: skip with "No deferred items found"
  - Multiple DEFERRED.md files: aggregate all items with source set ID annotation

### AskUserQuestion Patterns
- **Sequential category prompts (5x):** Each is a single-select AskUserQuestion with freeform follow-up
  - Option 1: "Nothing for this category" (skip)
  - Option 2+: Category-specific starter suggestions (optional)
  - If not skipped: follow-up freeform question for goals in that category
- **Deferred batch checklist (1x):** multiSelect AskUserQuestion listing all deferred items
- **Completeness confirmation (1x):** Single-select with "Yes, complete" / "Add more"
- **Freeform additions (0-1x):** If "Add more" selected, freeform text input

## Stack Risks

1. **DEFERRED.md format drift:** If the discuss-overhaul set changes the DEFERRED.md table format before or after this set lands, parsing could break. **Impact:** Low -- format is simple. **Mitigation:** Parse defensively (handle missing columns, unexpected headers). Document expected format inline.

2. **No DEFERRED.md files exist for testing:** Since discuss-overhaul hasn't produced any DEFERRED.md files yet, the deferred import feature cannot be integration-tested end-to-end. **Impact:** Low -- the skip path (no files found) is the default. **Mitigation:** The skip path is tested by the current empty state. Full integration testing happens after discuss-overhaul merges.

3. **Goal string length growth:** Structured 5-category output + carry-forward context could produce significantly longer goal strings than the current freeform approach, potentially affecting research agent prompt token budgets. **Impact:** Low -- research agents have large context windows. **Mitigation:** Keep category prompts focused; the user naturally provides concise per-category input.

4. **Step numbering stability:** The current SKILL.md uses Steps 0-9. Expanding Step 2C into multiple sub-steps must not break the step numbering or references elsewhere in the file. **Impact:** Medium if done incorrectly. **Mitigation:** Use sub-step numbering (2C-1 through 2C-5, 2C-6 for deferred, 2C-7 for completeness gate) rather than inserting new top-level steps.

## Recommendations

1. **Use sub-step numbering under Step 2C:** Replace the single "Question C" with sub-steps 2C-1 through 2C-7. This preserves the existing step numbering (Steps 3-9 unchanged) and avoids cascading renumbering. **Priority: critical**

2. **Parse DEFERRED.md defensively:** Use line-by-line reading with regex matching for table rows (`| N |`), not strict format assumptions. Handle gracefully: empty tables, missing columns, malformed rows. **Priority: high**

3. **Annotate deferred items with source set ID:** When presenting the deferred batch checklist, include the set ID from the DEFERRED.md header (`**Set:** {SET_ID}`) alongside each item for traceability. **Priority: high**

4. **Build category-tagged goals as a single markdown string:** Concatenate all non-empty category outputs under markdown headers (`## Features`, `## Bug Fixes`, `## Tech Debt`, `## UX Improvements`, `## Deferred Decisions`) into a single string that replaces the current `{goals from Step 2}` placeholder. Empty categories should be omitted entirely. **Priority: high**

5. **Include carry-forward context in research prompts:** Add a `## Carry-Forward Sets` section to the research agent prompt template, listing set IDs and descriptions from Step 3. Only include if carryForwardSets is non-empty. **Priority: medium**

6. **Keep the completeness gate lightweight:** The summary should be a bulleted list grouped by category (not a table) for readability. The "Add more" path should accept freeform text appended to an "## Additional Goals" section. **Priority: medium**

7. **Document the DEFERRED.md format expectation inline:** Add a comment in the SKILL.md explaining the expected DEFERRED.md table format so future maintainers understand the cross-skill dependency. **Priority: low**
