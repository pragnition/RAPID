# CONTEXT: discuss-overhaul

**Set:** discuss-overhaul
**Generated:** 2026-03-23
**Mode:** interactive

<domain>
## Set Boundary
Major overhaul of the `/rapid:discuss-set` skill (`skills/discuss-set/SKILL.md`). Shifts gray area focus from implementation/coding questions to architect-level and UI/UX questions, introduces variable gray area counts (multiples of 4 scaling with set complexity), enriches each question with inline context (pros/cons, recommendations), produces enhanced CONTEXT.md output, and introduces DEFERRED.md for capturing out-of-scope decisions. All changes are prompt-instructional — modifying a single SKILL.md file and its output artifact schemas.
</domain>

<decisions>
## Implementation Decisions

### Complexity Heuristic for Variable Gray Area Count

- Use CONTRACT.json **task count** as the primary signal for scaling gray area count (4n), but allow the model discretion to adjust based on overall set complexity.
  - *Rationale: Task count is simple, predictable, and directly reflects scope. Model discretion handles edge cases where a low-task set has deep architectural implications.*
- No user override mechanism — users already control depth by selecting which gray areas to discuss vs. leaving to Claude's discretion.
  - *Rationale: Avoids flag proliferation; the existing selection model provides sufficient control.*

### Question Richness Format

- **Adaptive format** based on question type:
  - **Preview panels** for visually-driven questions (UI mockups, layout comparisons, format examples)
  - **Option descriptions** for short-context questions where the tradeoff fits in a sentence
  - **Question context block** for complex tradeoffs needing detailed background
  - *Rationale: No single format fits all question types; adaptive selection respects user attention while providing depth where needed.*
- **2-5 sentences** of inline context per question, scaling with tradeoff complexity — brief for straightforward choices, verbose for complex architectural tradeoffs.
  - *Rationale: Respects user's time on simple decisions while ensuring complex tradeoffs have sufficient background for informed choices.*

### Deferred Decisions Lifecycle

- Capture **anything out-of-scope** that surfaces during discussion — every decision or idea that falls outside the set's boundary gets recorded in DEFERRED.md.
  - *Rationale: Errs on the side of not losing information. Noise is preferable to missed insights.*
- DEFERRED.md items should be **auto-surfaced in /rapid:new-version** — the new-version skill reads all DEFERRED.md files from the current milestone and presents them as candidate sets for the next milestone.
  - *Rationale: Ensures deferred ideas are systematically reviewed rather than silently forgotten across milestone boundaries.*

### CONTEXT.md Schema Evolution

- Include **inline decision rationale** — a brief rationale line under each decision explaining the "why" behind the choice.
  - *Rationale: Helps plan-set make better downstream choices by understanding intent, not just outcome. Compact and co-located with the decision.*
- Include a **deferred items summary** section in CONTEXT.md listing deferred item titles, with full details in DEFERRED.md.
  - *Rationale: Plan-set only needs to read one file (CONTEXT.md) to get the full picture. DEFERRED.md holds the detailed reference.*

### Claude's Discretion

- Specific gray area identification prompts and examples in SKILL.md
- DEFERRED.md file format and section structure
- How the model evaluates "architect-level vs. coding-level" question classification
- Exact task count thresholds for 4/8/12 gray area scaling
</decisions>

<specifics>
## Specific Ideas
- Preview panels should be used for questions involving UI layout or visual format comparisons
- The model should have discretion to adjust the heuristic-derived gray area count (e.g., bumping a 4-area set to 8 if it detects deep architectural implications)
- new-version skill integration: read DEFERRED.md files and present as candidate sets
</specifics>

<code_context>
## Existing Code Insights

- `skills/discuss-set/SKILL.md` is the sole file to modify — it's a prompt-driven skill (not a .cjs module)
- Current SKILL.md is ~350 lines with 9 steps, XML-tagged CONTEXT.md template, and key principles/anti-patterns sections
- AskUserQuestion supports `preview` field on options for side-by-side visual comparisons (single-select only)
- AskUserQuestion supports 2-4 options per question, with multiSelect for checkbox-style selection
- CONTEXT.md uses XML tags (`<domain>`, `<decisions>`, `<specifics>`, `<code_context>`, `<deferred>`) consumed by plan-set as freeform markdown
- CONTRACT.json `definition.tasks` array is the natural source for task count heuristic
- No DEFINITION.md exists for this set — scope comes from CONTRACT.json and SET-OVERVIEW.md
</code_context>

<deferred>
## Deferred Ideas
- Future: auto-surface DEFERRED.md in `/rapid:new-milestone` as well (not just new-version)
- Future: allow deferred items to be promoted to backlog entries via `/rapid:add-backlog` integration
</deferred>
