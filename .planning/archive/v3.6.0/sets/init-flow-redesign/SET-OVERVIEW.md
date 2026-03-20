# SET-OVERVIEW: init-flow-redesign

## Approach

The init flow redesign targets Step 4B of `skills/init/SKILL.md` -- the deep project discovery conversation -- and the downstream roadmapper role that consumes discovery output. The current Step 4B uses freeform prose-based AskUserQuestion calls organized into 4 topic batches. This set replaces that approach with structured AskUserQuestion calls that present pre-filled options (2-5 options per sub-question, with an "Other" freeform escape hatch), improving consistency of discovery data and reducing user cognitive load.

Beyond restructuring the questions, two new sub-steps are introduced into the init flow. First, a granularity preference question is added where the user specifies their desired number of sets (target set count). This value is passed as a runtime parameter to the roadmapper agent prompt rather than being persisted in config.json. Second, a summary-and-confirmation step is inserted after all discovery questions are answered: the compiled answers are displayed for user review and explicit confirmation before proceeding to roadmap generation.

The changes are scoped to exactly two files -- the init SKILL.md prompt and the roadmapper role prompt -- both of which are existing files requiring modification rather than creation. No new modules, CLI commands, or runtime code are involved; this is purely a prompt-engineering set.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/init/SKILL.md | Init skill orchestration prompt (Step 4B is the primary target) | Existing (833 lines) |
| src/modules/roles/role-roadmapper.md | Roadmapper agent role prompt (receives targetSetCount) | Existing (218 lines) |

## Integration Points

- **Exports:**
  - `structuredDiscovery` -- Step 4B uses AskUserQuestion with structured options (pre-filled choices, 4 sub-questions per call) across all 10 discovery areas
  - `granularityPreference` -- targetSetCount collected from user and passed as runtime parameter to the roadmapper prompt
  - `summaryConfirmation` -- Summary review and explicit user confirmation step inserted before roadmap generation proceeds
- **Imports:** None -- this set has no dependencies on other sets
- **Side Effects:** The structure of the project brief compiled in Step 4B may change in format (answers come from structured options rather than freeform text), which affects the downstream research and roadmapper agents that consume the brief. However, the brief format itself (the PROJECT BRIEF template) remains unchanged.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Structured options may not cover all valid user responses for diverse project types | Medium | Every structured question includes an "Other" freeform option as an escape hatch, preserving flexibility |
| Grouping into exactly 4 sub-questions per call may feel forced for some discovery areas | Low | The batching follows the existing 4-batch structure; sub-question grouping is a refinement, not a restructuring |
| Roadmapper prompt changes could break the structured JSON return format | High | The change is additive (accepting one new runtime parameter); the return format and instructions remain unchanged |
| Summary confirmation adds friction to the init flow | Low | Users can quickly scan and confirm; the step prevents costly re-runs when discovery answers have errors |

## Wave Breakdown (Preliminary)

- **Wave 1:** Rewrite Step 4B discovery questions to use structured AskUserQuestion with pre-filled options; add granularity preference question
- **Wave 2:** Add summary-and-confirmation step after discovery; update roadmapper role to accept and use targetSetCount parameter
- **Wave 3:** End-to-end validation of the full init flow from Step 4B through roadmap generation

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
