# CONTEXT: generous-planning

**Set:** generous-planning
**Generated:** 2026-03-26
**Mode:** interactive

<domain>
## Set Boundary
Add a user-facing `targetSetCount` granularity prompt to the `/rapid:new-version` skill before the roadmapper is spawned. Options: Compact (3-5), Standard (6-10), Granular (11-15), Auto. When Auto is selected, the roadmapper uses its own judgment without any artificial bias. The set touches two files: `skills/new-version/SKILL.md` and `src/modules/roles/role-roadmapper.md`.
</domain>

<decisions>
## Implementation Decisions

### Prompt Insertion Point
- Insert the granularity AskUserQuestion after goal confirmation (Step 2C-vi), before the research pipeline (Step 5). This keeps all user interaction grouped together before the autonomous pipeline begins.
- **Rationale:** Maintains the clean separation between interactive and autonomous phases in the new-version flow. The user declares intent upfront rather than being interrupted mid-pipeline.

### Default Bias Strategy
- No artificial bias toward any range. When the user selects Auto (or skips the prompt), the roadmapper uses its own judgment based on project complexity and team size -- no default range override.
- **Rationale:** The user explicitly stated the agent should decide on its own when the human doesn't provide guidance. The value of this set is giving users the option to specify, not changing the default behavior.

### Parameter Passthrough Format
- Pass the numeric range string directly (e.g., `"6-10"`, `"3-5"`, `"11-15"`, `"auto"`). This matches the roadmapper's existing documented `targetSetCount` parameter format in role-roadmapper.md input item 6.
- **Rationale:** The roadmapper already parses these exact range strings. No new mapping table or parsing logic needed -- zero friction at the boundary.

### Auto Mode Semantics
- Always pass `targetSetCount` in the roadmapper task string, even when Auto is selected. Pass the literal string `"auto"` so the roadmapper knows the prompt existed and the user made a deliberate choice.
- **Rationale:** Passing 'auto' explicitly distinguishes "user actively chose auto" from "old version without prompt." This is cleaner than omitting the parameter since the roadmapper can log/acknowledge the user's deliberate choice.

### Claude's Discretion
- None -- all gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- The prompt should be inserted as a new step (e.g., Step 2D or similar) after the completeness confirmation gate and before Step 3 (handle unfinished sets), keeping the step numbering impact minimal.
- The AskUserQuestion options should display human-friendly labels (e.g., "Compact (3-5 sets)") but the value passed downstream is the range string only.
- No changes to the roadmapper's default decomposition behavior -- only ensure the `targetSetCount` parameter is wired through from new-version.
</specifics>

<code_context>
## Existing Code Insights
- `role-roadmapper.md` already documents `targetSetCount` as input item 6 with values "3-5", "6-10", "11-15", or "auto". The Design Principles section (item 5) already has a "Respect granularity preference" clause with deviation-with-justification logic.
- `skills/new-version/SKILL.md` Step 7 spawns the roadmapper agent. The task string template already has placeholders for synthesis content, goals, and milestone name. Adding `targetSetCount` is a straightforward template addition.
- The `--spec` argument parsing in Step 0.5 shows the pattern for optional parameter handling in this skill.
- The roadmapper's behavioral constraint already says: "If targetSetCount is provided and is not 'auto', include a note confirming the target range." This existing logic handles all non-auto cases. For auto, the roadmapper just uses its judgment as-is.
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
