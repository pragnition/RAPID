# Phase 29: Discuss Phase Optimization - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users answer half as many sequential questions during the discuss phase without losing decision quality. The 4-question-per-gray-area loop in `skills/discuss/SKILL.md` Step 5 is replaced with a 2-interaction model organized into two rounds across all selected gray areas. Requirement: UX-05.

</domain>

<decisions>
## Implementation Decisions

### Batching strategy
- Collapse 4 questions per gray area into 2 interactions using merged pairs
- **Interaction 1** (approach + edge cases): Two-part prompt — AskUserQuestion presents approach options, plus a second paragraph in the question text describing a key edge case or tradeoff. User picks approach via option selection.
- **Interaction 2** (specifics + confirmation): Summary of decisions so far, then 1-2 specific detail options. "Looks good" locks everything; "Revise" loops back to Interaction 1 for that area.

### Round structure
- **Round 1**: All approach selections (Interaction 1) for every selected gray area, presented back-to-back. No specifics mid-round.
- **Round 2**: All specifics/confirmations (Interaction 2) for every selected gray area, presented back-to-back.
- Always 2 interactions per area — no skipping, even if Interaction 1 seems sufficient
- For 4 selected gray areas: 4 approach + 4 specifics = 8 total interactions, down from 16 (4x4)

### "Let Claude decide" granularity
- **Master toggle** in gray area selection (Step 4): "Let Claude decide all" option alongside the gray area multi-select. If selected, skips both rounds entirely.
- **Per-area delegation** available as an option in Round 1 approach questions. User can delegate individual gray areas while deciding others.
- **Round 2 inheritance**: If approach was delegated in Round 1, Interaction 2 still shows summary but marks everything as Claude's discretion. Always runs.

### Spike approach
- No spike task needed — AskUserQuestion behavior is well-understood from prior phases
- Remove the blocker note about "empirical spike" from STATE.md as part of implementation

### Claude's Discretion
- Exact wording of the two-part prompt format for Interaction 1
- How to present the summary in Interaction 2 (bullet list, table, prose)
- Edge case selection per gray area — which edge case to surface in the Interaction 1 prompt
- How "Revise" in Round 2 flows back to Round 1 (re-present just that area's Interaction 1, or full Round 1)

</decisions>

<specifics>
## Specific Ideas

- The two-round grouping means the user gets into a "decision mode" in Round 1 (all high-level choices) then a "refinement mode" in Round 2 (all specifics). This is more cognitively efficient than switching between approach/detail/approach/detail per area.
- "Let Claude decide all" as a master toggle in gray area selection preserves the existing "select none to let me decide all" pattern from Step 4 but makes it an explicit labeled option.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/discuss/SKILL.md` Step 5 — the 4-question loop to be rewritten. Steps 1-4 and 6-8 remain unchanged.
- `AskUserQuestion` tool — supports `multiSelect: true`, options with label + description, and "Other" free text automatically appended
- Step 4 gray area selection already uses `multiSelect: true` — adding "Let Claude decide all" is an extra option in the existing prompt

### Established Patterns
- Skills use AskUserQuestion for all user interactions (PROJECT.md constraint)
- "Let Claude decide" is already an option in every Step 5 question — pattern is established
- Two-part prompts work by putting context in the `question` field text and choices in `options` — AskUserQuestion renders both

### Integration Points
- `skills/discuss/SKILL.md` Step 4 — add "Let Claude decide all" option to gray area multiSelect
- `skills/discuss/SKILL.md` Step 5 — rewrite from 4-question loop to 2-round structure
- `.planning/STATE.md` — remove blocker note about "AskUserQuestion batching behavior needs empirical spike"

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-discuss-phase-optimization*
*Context gathered: 2026-03-09*
