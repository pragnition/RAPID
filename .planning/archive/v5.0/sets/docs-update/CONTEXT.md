# CONTEXT: docs-update

**Set:** docs-update
**Generated:** 2026-03-31
**Mode:** interactive

<domain>
## Set Boundary
Update DOCS.md and technical_documentation.md to reflect the current v5.0 state of the project. DOCS.md needs incremental updates (content is ~v4.4, header already v5.0.0). technical_documentation.md needs a significant rewrite (content stuck at v3.0, missing everything from v3.4 onward). Both files are standalone documentation with no code dependencies. The docs/ subdirectory (agents.md, state-machines.md, configuration.md, etc.) is NOT in scope for modifications but serves as the canonical reference that both files link to.
</domain>

<decisions>
## Implementation Decisions

### Documentation Architecture — Role of technical_documentation.md
- **Thin companion:** Keep technical_documentation.md but refocus it as an architecture narrative and cross-cutting concerns document. Defer per-topic detail (agents, state machines, config) to docs/ files.
- **Rationale:** docs/ already has comprehensive per-topic references (agents.md, state-machines.md, configuration.md). Maintaining a standalone monolith duplicates that content and guarantees drift. The thin companion approach preserves the "single deep-dive" format for architectural understanding while avoiding duplication.

### Documentation Architecture — DOCS.md Detail Level
- **Routing hub:** Slim DOCS.md to brief per-command entries (synopsis, key flags, one-liner description) with explicit links to docs/ for full detail.
- **Rationale:** DOCS.md is currently long with full inline documentation that overlaps docs/ topic files. A routing hub reduces maintenance burden, establishes docs/ as the canonical source, and gives users a scannable overview with easy navigation to depth.

### Rewrite Depth — technical_documentation.md Internals
- **Conceptual + architectural:** Focus on how systems fit together — agent pipeline flow, state machine design rationale, merge strategy architecture, review cascade logic. Do not enumerate every agent, every transition, or every config option.
- **Rationale:** Exhaustive documentation drifts fastest when the codebase changes rapidly (19 milestones in one month). Architectural overviews stay accurate longer and help power users understand "why" rather than "what every flag does."

### Rewrite Depth — Overlap with docs/
- **Summarize + link:** For topics covered in docs/ (agents, state machines, configuration, review, merge), provide a brief summary paragraph in technical_documentation.md with an explicit link to the canonical docs/ file.
- **Rationale:** This avoids duplication while keeping technical_documentation.md readable as a standalone narrative. Readers who want depth follow the links; readers who want the big picture stay in one file.

### Version Sweep Methodology
- **By feature area:** Organize the gap analysis by domain — agents, commands, state machine, configuration, merge pipeline, review pipeline, solo mode, branding, Mission Control, etc. — then map findings back to document sections.
- **Rationale:** Feature-area grouping catches cross-cutting changes that affect multiple sections (e.g., solo mode touches state machine, execution, and merge). Chronological sweeps produce changelogs, not gap lists. Section-based sweeps miss cross-cutting shifts.

### Version Sweep — Gap Analysis Artifact
- **Produce artifact first:** Wave 1 outputs a structured change list organized by feature area. Waves 2-3 consume this artifact to update the actual documentation files.
- **Rationale:** Completeness matters more than speed for documentation. The gap artifact lets the change list be reviewed before committing to rewrites, reducing the risk of missed changes.

### Deprecated Content — Removed Features
- **Silent removal:** Document only current v5.0 state. Features, agents, and commands removed since v3.0 (orchestrator agent, GSD vestiges, deprecated CLI stubs, old phase model) are simply not mentioned.
- **Rationale:** RAPID has no external users on v3.0. Migration notes and deprecated sections add clutter for no active audience. The CHANGELOG already records what changed per version.

### Deprecated Content — Version Badges
- **No version badges:** Document current state only. Do not tag features with "Added in vX.Y".
- **Rationale:** RAPID iterates extremely fast — version badges become noise with 19 milestones in one month. The CHANGELOG is the authoritative source for version history.

### Claude's Discretion
- None — all gray areas were discussed and decided by the user.
</decisions>

<specifics>
## Specific Ideas
- Wave 1 gap analysis should be organized by feature area: agents, commands, state machine, configuration, merge, review, solo mode, branding, Mission Control, auxiliary commands
- DOCS.md routing hub format: command name, one-line description, key flags, link to relevant docs/ file
- technical_documentation.md should open with a system architecture narrative before any topic sections
- Cross-references between DOCS.md and technical_documentation.md should be explicit (DOCS.md links to tech docs for architecture; tech docs links to DOCS.md for command reference)
</specifics>

<code_context>
## Existing Code Insights
- DOCS.md is at version 5.0.0 header but ~v4.4 content — needs incremental updates for v4.5 and v5.0 features
- technical_documentation.md references "26 agents" and "v3.0" — needs rewrite to 27 agents and v5.0
- docs/ subdirectory has 11 files covering: setup, planning, execution, review, merge-and-cleanup, agents, state-machines, troubleshooting, configuration, auxiliary, CHANGELOG
- docs/agents.md already has the current 27-agent spawn hierarchy with type classification
- docs/state-machines.md has current SetStatus lifecycle with transition table
- CONTRACT.json has empty fileOwnership, exports, and imports — pure documentation set with no code artifacts
</code_context>

<deferred>
## Deferred Ideas
- docs/ subdirectory files may need updates to serve as canonical references now that DOCS.md becomes a routing hub
- A future docs/architecture.md could capture cross-cutting architectural narrative if technical_documentation.md is eventually retired
</deferred>
