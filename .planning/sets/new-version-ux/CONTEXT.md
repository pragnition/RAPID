# CONTEXT: new-version-ux

**Set:** new-version-ux
**Generated:** 2026-03-24
**Mode:** interactive

<domain>
## Set Boundary
Enhance the `/new-version` skill to accept an optional spec file argument for pre-populating milestone goals, and auto-discover all DEFERRED.md items for inclusion in researcher briefs. All changes land in `skills/new-version/SKILL.md`. Backward compatibility is preserved: invoking `/new-version` without arguments produces identical behavior to the current implementation.
</domain>

<decisions>
## Implementation Decisions

### Spec File Format & Schema
- **Structured Markdown** with category headings (## Features, ## Bug Fixes, etc.) as the spec file format.
- **LLM-based semantic matching** for heading-to-category mapping instead of strict or alias-based matching. The LLM interprets headings contextually, so users can write natural headings like "## New Features", "## Bugs to Fix", "## Improvements" and they'll be correctly mapped to goal categories.
- **Rationale:** Markdown is natural to write alongside code and doesn't require learning a new schema. LLM semantic matching eliminates the need for documented aliases or strict heading conventions, providing maximum flexibility with zero user documentation overhead.

### Goal Pre-Population UX Flow
- **Pre-filled categories with individual review** -- when a spec is provided, each of the 5 category prompts is still shown sequentially but pre-filled with extracted content.
- Each category prompt offers 3 options: **Accept** (keep as-is), **Augment** (add to extracted content), or **Replace** (enter new content entirely).
- Categories where the spec had no content fall back to the normal interactive prompt (empty, user enters from scratch).
- **Rationale:** Pre-filled categories give users fine-grained control over each category while still being faster than entering everything from scratch. The accept/augment/replace pattern lets users quickly confirm correct extractions and adjust only what needs changing.

### DEFERRED.md Discovery Scope
- **Active sets + previous milestone archive** -- scan `.planning/sets/*/DEFERRED.md` for current/active deferred items, plus `.planning/archive/{previousMilestone}/sets/*/DEFERRED.md` for the immediately prior milestone only.
- Older archived milestones are excluded to prevent stale item accumulation.
- **Rationale:** Active-only misses deferred items from the just-completed milestone that weren't acted on. Including the immediately previous milestone captures items that were deferred during the most recent work cycle, while excluding older archives prevents noise from long-resolved decisions.

### Spec Parsing Failure Strategy
- **Graceful fallback to interactive** -- extract what's possible from the spec, and fall back to standard interactive prompts for categories that couldn't be resolved.
- Pre-filled categories show extracted content; unresolved categories show the normal empty prompt.
- No hard errors or warnings -- the flow is seamless whether 0 or 5 categories were extracted.
- **Rationale:** Since the LLM does the parsing, total failure is unlikely. Graceful degradation ensures the user is never blocked by a malformed spec and always reaches the completeness confirmation gate.

### Claude's Discretion
- No areas were left to Claude's discretion -- all 4 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- LLM semantic matching should be done inline within the SKILL.md orchestrator logic (no external parsing function needed since the LLM is already interpreting the spec content)
- The "Augment" option in pre-filled prompts should ask freeform: "What would you like to add to this category?" and append the response to the extracted content
- For previous milestone archive scanning, derive the previous milestone ID from STATE.json's milestone array (the entry before currentMilestone)
</specifics>

<code_context>
## Existing Code Insights
- Current goal-gathering is in SKILL.md Step 2C (Steps 2C-i through 2C-vi) with sequential AskUserQuestion prompts per category
- DEFERRED.md discovery currently uses `find .planning/sets/*/DEFERRED.md` in Step 2C-v
- The completeness confirmation loop in Step 2C-vi already supports "Add more" freeform -- this pattern can be reused for the augment flow
- Step 0 handles environment setup and argument parsing -- spec file argument should be parsed here alongside the existing env preamble
- The SKILL.md is a prompt document (not executable code), so "implementation" means modifying the prompt instructions that guide Claude's behavior
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
