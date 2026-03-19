# CONTEXT: code-quality

**Set:** code-quality
**Generated:** 2026-03-18
**Mode:** interactive

<domain>
## Set Boundary
Enrich planning/execution context for higher-quality agent output. Adds a quality profile system (`src/lib/quality.cjs`) with three capabilities: quality profile loading from `.planning/context/QUALITY.md`, token-budgeted context building for prompt injection, and advisory-only quality gate checking. Includes a curated pattern library at `.planning/context/PATTERNS.md`. Integrates into `execute.cjs` `assembleExecutorPrompt()` alongside existing memory context injection. Soft dependency on memory-system's `queryDecisions` for decision-aware quality context.
</domain>

<decisions>
## Implementation Decisions

### Default Quality Profile

- Stack-aware defaults: When QUALITY.md doesn't exist, `loadQualityProfile()` should detect the project's tech stack (scan package.json, Cargo.toml, etc.) and generate quality rules tailored to the detected stack
- Include both approved patterns AND anti-patterns ("do this" and "don't do this" sections) so agents know what to avoid as well as what to follow

### Pattern Library Scope

- Domain-categorized organization: Group patterns by domain (error handling, state management, testing, API design, etc.) with each category containing approved patterns and code examples
- Curated template approach: Ship with a hand-written template of common patterns for the detected stack; users can extend it. No automatic codebase scanning for pattern extraction

### Quality Gate Output

- Structured JSON + stderr: `checkQualityGates()` returns a structured `{ passed, violations[] }` object programmatically AND logs human-readable warnings to stderr. Downstream tooling can consume the JSON
- Standalone only: Quality gates run during execution only, independent of the review pipeline. Review pipeline stays focused on functional correctness

### Token Budget Strategy

- Fixed independent budgets: Memory keeps its 8k default, quality gets its own 10k default. They don't compete — both fit easily within the 120k total budget alongside wave context
- Plan + Execute phase injection: Quality context is injected in both plan and execute phases so planners account for quality guidelines when designing implementation steps
</decisions>

<specifics>
## Specific Ideas
- Follow the same integration pattern as memory-system: standalone lib module, lazy init of template files, try/catch wrapping in assembleExecutorPrompt
- Quality context injected in the same location as memory context (after wave context, before instructions)
- Anti-patterns in QUALITY.md should be clearly separated from approved patterns with distinct markdown sections
</specifics>

<code_context>
## Existing Code Insights

- `assembleExecutorPrompt()` in `execute.cjs:131` already has the memory injection pattern at lines 139-147 (try/catch with graceful skip) — quality injection should follow the same pattern
- `memory.cjs` uses `estimateTokens()` from `tool-docs.cjs` for token budgeting — quality module should reuse the same function
- `compaction.cjs` defines `DEFAULT_BUDGET_TOKENS = 120000` — quality's 10k budget is well within this limit
- `prepareSetContext()` at `execute.cjs:40` returns `{ scopedMd, definition, contractStr, setName }` — the enriched version should extend this without breaking the existing signature
- Memory context is injected in plan phase (line 195) and execute phase (lines 228-231) — quality should follow the same phase gates
- `.planning/context/` directory already exists with ARCHITECTURE.md, CODEBASE.md, CONVENTIONS.md, STYLE_GUIDE.md — QUALITY.md and PATTERNS.md fit naturally here
</code_context>

<deferred>
## Deferred Ideas
- Automatic codebase scanning to extract patterns (decided against for v1; could be a future enhancement)
- Review pipeline integration for quality gates (decided standalone-only for now)
- Dynamic token budget allocation based on remaining context space (decided fixed budgets for simplicity)
</deferred>
