# CONTEXT: docs-housekeeping

**Set:** docs-housekeeping
**Generated:** 2026-04-06
**Mode:** interactive

<domain>
## Set Boundary
Full housekeeping sweep for v6.1.0: bump all version references from 6.0.0 to 6.1.0 across package.json, README, skill metadata, and documentation files. Update CHANGELOG.md with v6.1.0 milestone entries. Fix stale prose in documentation. Does NOT include editing .planning/context/ files.
</domain>

<decisions>
## Implementation Decisions

### CHANGELOG Depth & Format
- Each set entry should include the set name plus 2-3 sentences describing its impact
- Include a 2-3 sentence milestone-level intro paragraph summarizing the "UX & Onboarding" theme before individual set entries
- **Rationale:** Balanced detail gives readers enough context to understand changes without being verbose, and the intro paragraph frames the milestone's purpose upfront.

### Version Bump Selectivity
- Selective bump only — update current/active version references (package.json, install docs, skill metadata) but preserve historical version references in ROADMAP.md, CHANGELOG history, and shipped milestone entries
- Bump install/setup documentation references to v6.1.0, assuming this set ships alongside the release
- **Rationale:** Historical accuracy must be preserved. A blanket find-and-replace would corrupt ROADMAP.md shipped dates and prior CHANGELOG entries. Install docs should match the release version since this set is intended to merge at release time.

### Context File Refresh Strategy
- Do NOT edit .planning/context/ files (CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md)
- **Rationale:** User explicitly opted out of editing context files in this set. Deferred to a future milestone.

### Documentation Content Scope
- Beyond version strings, fix obviously stale prose in DOCS.md, README.md, and technical_documentation.md
- In skill metadata (SKILL.md files), bump version references and fix factually incorrect descriptions only — do not rewrite descriptions that are merely imprecise
- **Rationale:** Catching major inaccuracies without rewriting everything keeps the diff manageable and reduces merge conflict risk, while still improving documentation quality.

### Claude's Discretion
- None — all gray areas were discussed with the user
</decisions>

<specifics>
## Specific Ideas
- Run a repo-wide grep for `6.0.0` and `v6.0.0` as the first execution step to catch all references before selectively bumping
- Execute this set last in the milestone so the CHANGELOG captures all delivered sets
- Wave 3 (context refresh) from the preliminary breakdown is removed per user decision
</specifics>

<code_context>
## Existing Code Insights
- package.json contains the canonical version field currently at "6.0.0"
- ROADMAP.md contains historical milestone references that must NOT be modified (e.g., "v6.0.0 Scale & Quality — 7 sets (shipped 2026-04-06)")
- Skill metadata files (skills/*/SKILL.md) contain version references in headers and descriptions
- docs/CHANGELOG.md is the target for the new v6.1.0 section
- The v6.1.0 milestone has 6 sets: clear-guidance-and-display, audit-handoff, readme-and-onboarding, ux-audit, backlog-system, docs-housekeeping
</code_context>

<deferred>
## Deferred Ideas
- Full regeneration of .planning/context/ files to reflect current codebase state (suggested for future milestone)
</deferred>
