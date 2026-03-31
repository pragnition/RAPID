# CONTEXT: init-enhancements

**Set:** init-enhancements
**Generated:** 2026-03-31
**Mode:** interactive

<domain>
## Set Boundary
Add two independent capabilities to the `/rapid:init` flow: (1) a `--spec` flag that feeds a pre-written spec file into the research pipeline with section extraction and [FROM SPEC] tagging, and (2) a meta-principles capture step that generates `.planning/PRINCIPLES.md` and injects a compact summary into worktree-scoped `CLAUDE.md` files. Both features are additive and backward-compatible. The new `src/lib/principles.cjs` module handles generation, parsing, and summarization. The six research role modules gain a dedicated spec input section. `generateScopedClaudeMd()` in `src/lib/worktree.cjs` gains an optional principles section.
</domain>

<decisions>
## Implementation Decisions

### Principles Data Model
- Categorized groups: each principle is `{category, statement, rationale}` with categories grouping naturally in PRINCIPLES.md output.
- Categories use a **predefined set with freeform additions**: 8 predefined categories (architecture, code style, testing, security, UX, performance, data handling, documentation) plus the ability for users to add custom categories during the interview.
- **Rationale:** Predefined categories ensure consistency and help users think through common areas, while freeform additions keep the system flexible for project-specific concerns. The user explicitly wanted recommendations to be shown during the init interview.

### Spec File Parsing Strategy
- **Section extraction** approach: parse the spec file for recognizable sections (features, architecture, constraints, etc.), tag each section with [FROM SPEC], and route relevant sections to the matching research agent.
- Accept **any text format** — best-effort section detection with markdown headers as the primary heuristic. No format constraints on the input file.
- **Rationale:** Section extraction balances complexity and agent value — raw pass-through puts too much burden on agents, while summarization adds an unnecessary agent hop. Accepting any format reduces friction so users don't skip --spec.

### Spec-aware Discovery Bypass
- Spec content serves as a **supplement only**, not a bypass. For each discovery area, show extracted context ("I see you are building X for Y") and then proceed to ask the full questions.
- **Per-area coverage detection**: classify each discovery area as 'covered', 'partial', or 'uncovered' based on spec content. Adapt questioning depth accordingly — covered areas get a confirming summary lead-in, uncovered areas get full questions.
- **Rationale:** The user emphasized that the spec should inform but not replace the discovery conversation. Users should always have the chance to course-correct or expand on what the spec says.

### Research Agent Spec Integration
- **Dedicated ## Spec Content section** added to each of the 6 research role modules (.md files). Spec assertions are pre-tagged with [FROM SPEC]. Agents process this section alongside their normal inputs.
- **Balanced skepticism** framing: agents verify technical claims where possible (check versions, validate assumptions) but accept domain/business assertions at face value unless contradicted by evidence.
- **Rationale:** A dedicated section keeps spec content clearly separated from other inputs, making it easy for agents to identify and tag. Balanced skepticism avoids wasting effort debunking solid specs while preventing uncritical propagation of wrong technical assumptions.

### Principles Interview Flow
- **Category-by-category walkthrough**: present each of the 8 predefined categories one at a time, with 2-3 recommended principles per category as multiSelect options. Users accept, reject, or modify each. After all categories, offer a freeform prompt for additional custom principles.
- **8 predefined categories**: architecture, code style, testing, security, UX, performance, data handling, documentation.
- **Rationale:** Category-by-category is more thorough than all-at-once and gives users focused context for each decision area. The user chose the exhaustive 8-category approach to ensure comprehensive coverage.

### Sensible Defaults Escape Hatch
- **Inferred from codebase**: for brownfield projects, analyze existing code patterns and generate inferred principles. For greenfield projects, fall back to generic sensible defaults.
- Escape hatch presented as the **last option** in the interview prompt to encourage engagement, but clearly visible and labeled.
- **Rationale:** Codebase-inferred principles provide real value even when users skip the interview, while generic defaults serve as a reasonable fallback for greenfield projects. Last-option placement nudges users toward engagement.

### PRINCIPLES.md Document Format
- **Category headers with bullet lists**: `## Category` headers with `- **Statement** — Rationale` bullet items. Clean, editable, and easy to parse with regex by loadPrinciples().
- **Rich metadata** header: title, generation date, project name, category summary, and brief edit instructions.
- **Rationale:** Markdown with category headers is the most natural format for both human editing and machine parsing. Rich metadata helps users who encounter the file later understand its purpose and provenance.

### CLAUDE.md Summary Injection
- Placed **near the top of worktree-scoped CLAUDE.md**, after the project identity/context section but before set-specific details. Principles are project-wide and should be visible before set-specific context.
- **Summary budget increased to 45 lines** (overriding the CONTRACT's original 15-line limit). This gives enough room to represent all 8 categories meaningfully. Always end with a pointer to the full PRINCIPLES.md.
- **Rationale:** 15 lines was too restrictive for 8 categories of principles. 45 lines allows 5-6 lines per category on average, which is enough to convey the key principles without requiring agents to read the full file. Near-top placement ensures agents see principles early in their context.
</decisions>

<specifics>
## Specific Ideas
- Show recommended principles per category during the interview — users should see suggestions and be able to accept/modify them, not start from a blank slate.
- When spec content is available, lead discovery questions with context extracted from the spec ("I see you are building X for Y") before asking the user to expand.
- For brownfield sensible-defaults, analyze code patterns like test coverage style, module structure, naming conventions, and dependency management to infer principles.
- The 8 predefined categories (architecture, code style, testing, security, UX, performance, data handling, documentation) should each have 2-3 curated recommended principles that represent widely-accepted best practices.
</specifics>

<code_context>
## Existing Code Insights
- `generateScopedClaudeMd()` at `src/lib/worktree.cjs:795` assembles worktree CLAUDE.md — currently takes `(cwd, setName)` and uses plan.cjs for set/contract loading. The principles section should be inserted after the project context block.
- Research role modules (`src/modules/roles/role-research-*.md`) follow a consistent Input/Output/Scope structure — the new ## Spec Content section should slot in after the existing ## Input section.
- The new-version skill already has a spec-passing pattern that can be mirrored for the init --spec implementation.
- `loadPrinciples()` should follow the same graceful-null pattern used by other optional file loaders in the codebase (e.g., `tryLoadDAG()`).
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
