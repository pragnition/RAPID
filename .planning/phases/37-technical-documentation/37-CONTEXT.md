# Phase 37: Technical Documentation - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Create technical_documentation.md as a power user reference covering all skills, agents, configuration, state machines, and failure recovery. Multi-file structure with index. Does NOT include README changes (Phase 36 already complete). Replaces DOCS.md conceptually as the authoritative technical reference.

</domain>

<decisions>
## Implementation Decisions

### Document structure
- Multi-file: technical_documentation.md as index with summaries, linking to separate docs per section
- Workflow-ordered: sections follow the RAPID lifecycle stages
- 5 lifecycle stages: Setup (install, init, context) → Planning (plan, set-init, discuss, wave-plan) → Execution (execute) → Review (review) → Merge & Cleanup (merge, cleanup, new-milestone)
- Index file includes TOC with 1-2 sentence summaries per linked section

### Agent catalog
- Structured cards per agent: purpose (1 sentence), spawned by, inputs, outputs, when it runs (~5-8 lines each)
- Type tag/badge system: Orchestrator, Leaf, Pipeline, or Research — visually distinguishes agent roles
- No tool/capability lists per agent — keep cards lean
- Includes ASCII dispatch tree showing full spawn hierarchy (which agents spawn which)
- Agents grouped by lifecycle stage (matching the 5-stage structure)

### Skill documentation
- Synopsis + link pattern: brief synopsis with full argument syntax, then "See skills/<name>/SKILL.md for full details"
- Full argument syntax in synopsis: `/rapid:set-init <set-id> [--skip-plan]` style
- SKILL.md files are the authoritative source — technical docs reference, not duplicate
- Dedicated configuration section covering .env variables, RAPID_TOOLS, STATE.json schema, user-configurable settings
- Configuration also mentioned inline within relevant skills
- State machine section uses ASCII state diagrams for set/wave/job transitions

### Troubleshooting
- Symptom/cause/fix card format per issue
- Core failures only (~5-6 most common): subagent timeout, merge conflicts, state corruption, worktree cleanup, stale lock files
- Cross-references to state machine docs for state-related issues (not self-contained)
- No "before you report a bug" checklist

### Claude's Discretion
- Exact file naming for sub-documents (e.g., docs/agents.md vs docs/agent-reference.md)
- Which 5-6 specific failure modes to include based on codebase error handling patterns
- Ordering of agents within each lifecycle stage group
- How to render type tags in Markdown (bold prefix, emoji, etc.)

</decisions>

<specifics>
## Specific Ideas

- Tone carries forward from Phase 36: conversational-technical (Astro/Vercel reference)
- Describe current state only — no version callouts or changelogs
- README already references technical_documentation.md — the link needs to resolve correctly
- Success criteria explicitly requires "references SKILL.md files as authoritative source rather than duplicating their content"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- DOCS.md (979 lines, v2.0): Contains detailed command reference — outdated but useful as a starting point for skill synopses and argument syntax
- agents/ directory: 31 agent .md files with YAML frontmatter — canonical source for agent catalog data
- skills/ directory: 18 skill directories — each contains SKILL.md with full documentation
- src/lib/state-machine.cjs, state-schemas.cjs, state-transitions.cjs: Source of truth for state machine diagrams

### Established Patterns
- Skills use `/rapid:<name>` naming convention
- Skills accept set-id by numeric index or full string ID
- Waves referenced by dot notation (e.g., `1.1` = set 1, wave 1)
- Agent files use YAML frontmatter with role, description, tools fields

### Integration Points
- README.md references technical_documentation.md as deep-dive destination
- 22 runtime libraries in src/lib/ (non-test) for configuration/state reference
- src/bin/rapid-tools.cjs as CLI entry point

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-technical-documentation*
*Context gathered: 2026-03-11*
