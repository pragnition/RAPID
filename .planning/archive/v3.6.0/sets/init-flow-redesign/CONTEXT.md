# CONTEXT: init-flow-redesign

**Set:** init-flow-redesign
**Generated:** 2026-03-20
**Mode:** interactive

<domain>
## Set Boundary
Redesign init Step 4B (deep project discovery) to replace prose-based freeform Q&A with structured AskUserQuestion calls using pre-filled options. Add a granularity preference question (target set count) passed as runtime parameter to the roadmapper. Add a summary confirmation step that displays compiled answers AND generates formal acceptance criteria before roadmap generation. Scoped to two files: `skills/init/SKILL.md` and `src/modules/roles/role-roadmapper.md`.
</domain>

<decisions>
## Implementation Decisions

### Structured Question Design

- **Hybrid approach**: Vision/narrative questions (areas 1, 3, 4) remain freeform. Technical/objective questions (areas 2, 5-10) get structured AskUserQuestion with pre-filled options.
- **Freeform areas**: Vision/problem statement, must-have features, nice-to-have features — these are inherently open-ended and lose signal when forced into options.
- **Structured areas**: Target users, tech stack, existing dependencies, scale/traffic, compliance, third-party integrations, success criteria — these have enumerable categories.
- **Categorical options**: Structured questions use broad categories (e.g., "React/Vue/Svelte", "SQL/NoSQL/Graph", "OAuth/API keys/SSO") rather than specific technology choices. Details emerge in follow-up or research.
- **Keep 4 batches**: Same 4 topic groupings as current flow, but each batch uses structured options where appropriate. Minimal restructuring of the existing flow.
- Every structured question includes an "Other" freeform escape hatch (provided automatically by AskUserQuestion).

### Granularity Preference UX

- **Preset buckets**: Present as "Compact (3-5 sets)", "Standard (6-10 sets)", "Granular (11-15 sets)", "Let Claude decide". Easier to reason about than raw numbers.
- **Placement**: Ask after all 4 discovery batches complete, right before the summary confirmation step. User has full project context to make an informed choice at this point.

### Summary Confirmation Format

- **Full project brief + formal criteria**: Display the complete PROJECT BRIEF with all fields populated, PLUS generate formal acceptance criteria derived from the discovery answers.
- **Formal criteria written to REQUIREMENTS.md**: The acceptance criteria are written to `.planning/REQUIREMENTS.md` (existing scaffold file). These become the source of truth that downstream plan-set and review stages reference. Enables requirements -> sets -> tests traceability.
- **Combined review**: Show discovery summary and derived formal criteria together in one review step. User confirms both at once.
- **Targeted re-ask on rejection**: If user wants changes, ask "Which section needs changes?" and re-ask only that section's questions. Efficient and focused.

### Roadmapper Integration

- **Soft guidance for set count**: Pass targetSetCount as "aim for roughly N sets" — roadmapper can deviate if the project naturally decomposes differently, but must include a note explaining why it diverged.
- **Criteria-informed set boundaries**: Roadmapper receives REQUIREMENTS.md formal criteria alongside the project brief and research summary. Set boundaries should map cleanly to formal criteria, enabling traceability from requirements -> sets -> tests.
</decisions>

<specifics>
## Specific Ideas
- The formal criteria generated at the summary step should be structured enough that downstream test agents (UAT, unit-test) can design tests directly against them
- Preset bucket labels should include the actual range numbers to set clear expectations
- The roadmapper prompt change is additive: accept targetSetCount and REQUIREMENTS.md content as new inputs without changing the existing return format
</specifics>

<code_context>
## Existing Code Insights

- `skills/init/SKILL.md` (833 lines): Step 4B currently spans lines ~171-296 with 4 freeform AskUserQuestion batches covering 10 discovery areas. The PROJECT BRIEF template is compiled at lines ~249-291.
- `src/modules/roles/role-roadmapper.md` (218 lines): Currently receives research summary, project description, team size, model selection, and optional scaffold report. Output is structured JSON with roadmap, state, and contracts keys. The prompt change is additive — add targetSetCount and REQUIREMENTS.md criteria as new input parameters.
- AskUserQuestion supports 2-4 options per question, multiSelect for non-exclusive choices, and always provides an automatic "Other" escape hatch.
- `.planning/REQUIREMENTS.md` already exists in the scaffold — it's an existing artifact that can be populated with formal criteria.
</code_context>

<deferred>
## Deferred Ideas
- Per-question adaptive branching (asking different follow-ups based on which option was selected) — adds complexity, defer to future iteration
- Persisting granularity preference in config.json for re-init scenarios — CONTRACT.json explicitly says this is runtime-only
</deferred>
