# CONTEXT: discuss-ux

**Set:** discuss-ux
**Generated:** 2026-03-23
**Mode:** interactive

<domain>
## Set Boundary
Two coordinated UX improvements to `skills/discuss-set/SKILL.md`: (1) Consolidate gray area prompts into fewer AskUserQuestion calls by packing multiple multiSelect questions into a single call, and (2) Replace Step 6 Format A markdown pros/cons table with a structured labeled-block list format. Both changes require coordinated test suite updates in `SKILL.test.cjs`.
</domain>

<decisions>
## Implementation Decisions

### Consolidation Split for n=3 (12 Items)
- Keep the 4+4+4 grouping — each batch of 4 gray areas becomes one multiSelect question within the AskUserQuestion call. AskUserQuestion supports max 4 questions with max 4 options each, so this is the natural fit.
- **Rationale:** The AskUserQuestion tool itself constrains to 4 sub-questions with 4 options each. The consolidation benefit comes from fewer *calls*, not fewer *questions* — pack batches as questions within a single call.

### Format A Replacement Layout
- Use labeled blocks with bold headers: `**A: Name**` followed by `**Pros:**` and `**Cons:**` on separate lines.
- **Rationale:** Bold headers make pros/cons visually distinct, and the format wraps cleanly at any terminal width — solving the core rendering issue with markdown tables.

### Gray Area Scaling Model
- Keep the 4n scaling model unchanged (1-3 tasks → 4, 4-6 → 8, 7+ → 12). Only change presentation, not generation count.
- **Rationale:** The count formula works well and has no user complaints. Changing both count and presentation in one set would conflate two distinct UX dimensions. If the count model needs revision, it should be a separate set.

### Consolidation Threshold Behavior
- Always use exactly 1 AskUserQuestion call for gray area selection. Pack all batches as separate questions: n=1 → 1 call (1 question), n=2 → 1 call (2 questions), n=3 → 1 call (3 questions). If n somehow exceeds 4, split into multiple calls accordingly.
- **Rationale:** Maximal consolidation minimizes back-and-forth interaction. The tool supports up to 4 questions per call, which accommodates all current n values in a single invocation.

### Claude's Discretion
- No areas were left to Claude's discretion — all 4 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- AskUserQuestion has a hard constraint of max 4 questions per call, max 4 options per question — all consolidation must work within these bounds
- The 4+4+4 batch size is preserved; consolidation happens at the call level, not the option level
- For the edge case of n>4 (not currently possible but future-proofing), split into multiple AskUserQuestion calls
</specifics>

<code_context>
## Existing Code Insights
- SKILL.md Step 5 currently uses separate AskUserQuestion calls per batch of 4 gray areas, with headers like "Gray Areas (1 of 2)"
- SKILL.md Step 6 Format A uses a `| Option | Pros | Cons |` markdown table
- SKILL.test.cjs has 11 tests with literal string assertions (e.g., "Exactly 4 gray areas", "fewer or more than 4") that need updating
- Tests 1-5 are directly coupled to Step 5 wording and option counts
- CONTRACT.json behavioral constraint `gray-area-consolidation` already describes the target: "consolidated multiSelect prompts rather than multiple separate batched prompts"
- CONTRACT.json behavioral constraint `table-format-replacement` describes: "structured list format instead of markdown table"
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
