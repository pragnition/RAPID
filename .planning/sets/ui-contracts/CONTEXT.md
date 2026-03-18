# CONTEXT: ui-contracts

**Set:** ui-contracts
**Generated:** 2026-03-18
**Mode:** interactive

<domain>
## Set Boundary
Per-set `UI-CONTRACT.json` schema with Ajv validation, cross-set UI consistency checks, and context injection into executor prompts. This is a parallel artifact system alongside the existing CONTRACT.json — completely separate, optional, and additive. Sets without UI simply omit the file. The implementation creates `src/lib/ui-contract.cjs` (mirroring `contract.cjs` patterns), `src/schemas/ui-contract-schema.json`, CLI subcommands, and integration into `enrichedPrepareSetContext()` in `execute.cjs`.
</domain>

<decisions>
## Implementation Decisions

### UI-CONTRACT.json Schema Design

- **Top-level sections (all required when present, flat structure):**
  - `guidelines` — Branding and general UI guidelines (font families, tone, visual identity rules)
  - `components` — Component hierarchy tree with names, roles (page/layout/widget), and parent-child relationships
  - `tokens` — Design tokens as named key-value pairs (e.g. `{ "primary": "#3B82F6", "spacing-md": "16px" }`) — framework-agnostic, human-readable
  - `layout` — Grid system, breakpoints, container widths, responsive behavior rules
  - `interactions` — State transitions, animations, loading patterns, error states, accessibility requirements
- **Schema is flat** — each section is a top-level key, no nested grouping categories
- **Token format is named tokens** — simple key-value pairs, no semantic alias layer

### Cross-Set Consistency Rules

- **All 4 conflict types are checked:**
  - Duplicate component names with different structures/roles across sets
  - Token contradictions — same token name mapped to different values
  - Layout incompatibility — conflicting breakpoints or grid systems
  - Guideline drift — contradictory branding/UI guidelines across sets
- **Binary severity model** — any inconsistency is a conflict (pass/fail), no warning tier

### Context Injection Strategy

- **4000 token budget** for `buildUiContext()` output injected into executor prompts
- **Truncation priority order:** guidelines > tokens > components > layout > interactions
  - Brand guidelines and visual primitives are most critical for consistency
  - Interactions can be inferred and are deprioritized when budget is tight

### CLI UX for ui-contract Commands

- **Default output format: JSON** — consistent with all other rapid-tools commands (state, merge, resolve)
- **`ui-contract show` displays a formatted summary** — section headers, component counts, token table for quick overview
- `ui-contract validate` and `ui-contract check-consistency` output JSON results

### Claude's Discretion

- No areas deferred to Claude's discretion — all gray areas were discussed
</decisions>

<specifics>
## Specific Ideas
- The `guidelines` section was specifically requested as a branding/general UI guideline section beyond the standard 4 sections from SET-OVERVIEW.md
- Follow the `quality.cjs` / `qualityContext` pattern for integration into `enrichedPrepareSetContext()` — optional, try/catch wrapped
</specifics>

<code_context>
## Existing Code Insights

- **Pattern to follow:** `contract.cjs` uses inline `CONTRACT_META_SCHEMA` object with Ajv validation via `require('ajv').default` — replicate this pattern for UI contract schema
- **enrichedPrepareSetContext()** at `execute.cjs:61` already has optional `qualityContext` injection with try/catch — add `uiContext` as a parallel optional field using the same pattern
- **CLI routing:** `rapid-tools.cjs` uses a `switch(command)` dispatcher — add `case 'ui-contract'` with a handler module at `src/commands/ui-contract.cjs`
- **No `src/schemas/` directory exists** — will be created for `ui-contract-schema.json`
- **Ajv is already a dependency** — used by `contract.cjs`, no new dependency needed
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion
</deferred>
