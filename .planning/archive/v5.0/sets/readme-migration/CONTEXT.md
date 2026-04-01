# CONTEXT: readme-migration

**Set:** readme-migration
**Generated:** 2026-03-30
**Mode:** interactive

<domain>
## Set Boundary
Restructure README.md with centered banner header stack (consuming branding-assets SVGs), shields.io badges, collapsible architecture sections, tip callout install, and arrow-prefix doc links. Migrate all active fishjojo1/RAPID references to pragnition/RAPID (archives untouched). Bump version from 4.4.0 to 5.0.0 across all user-facing files.
</domain>

<decisions>
## Implementation Decisions

### README Content Depth
- Medium depth — keep How It Works summary, 60-Second Quickstart, condensed Command Reference (core 7 lifecycle commands only). Drop the Real-World Example walkthrough and detailed agent dispatch prose. Link to DOCS.md for the full 28-command reference and detailed usage.
- **Rationale:** A branded header with banner + badges + collapsible sections already adds visual weight. Medium depth keeps the README as an effective landing page without duplicating DOCS.md content. The 7 core lifecycle commands are the hook; utilities and review pipeline commands belong in the docs.

### Badge Row Composition
- Standard set: Version + License + Claude Code + Node.js badges. Flat-square style with Everforest custom colors (#2d353b background, #a7c080 green accent, #d3c6aa warm text).
- **Rationale:** Four badges covers identity, legal, platform, and runtime without clutter. Flat-square edges complement the geometric banner SVG aesthetic, and custom Everforest hex codes maintain brand cohesion across the header stack.

### Architecture Section Presentation
- Lifecycle-flow and agent-dispatch SVGs placed inside a collapsible `<details>` block, closed by default. Each SVG gets a 1-2 sentence caption explaining what it shows.
- **Rationale:** Two SVGs add ~800px of vertical space. Collapsing them keeps the README scannable for returning users while making the architecture accessible via a single click. Brief captions add context for first-time readers without duplicating what the self-labeled diagrams already communicate.

### Version Bump Scope
- All user-facing files: canonical 4 (package.json, plugin.json, .planning/config.json, STATE.json rapidVersion field) + DOCS.md header + README.md + skill file descriptions (install, status) + GitHub issue template placeholders. Historical records (CHANGELOG entries, ROADMAP milestone labels, audit reports, milestone IDs in STATE.json) are preserved as-is.
- **Rationale:** Everything a user or contributor encounters should show 5.0.0. Historical records document what was shipped and when — rewriting them would break traceability. STATE.json milestone entries are historical identifiers that may be referenced by archived planning artifacts.

### Claude's Discretion
- Exact wording of the "The Problem" / intro section (if kept)
- Arrow-prefix link formatting and which docs to link
- Tip callout exact copy for the install command
- Badge color hex fine-tuning if Everforest palette needs adjustment for contrast
- Ordering of sections within the README
</decisions>

<specifics>
## Specific Ideas
- Banner SVG centered at top, followed by a centered badge row, followed by a one-line tagline
- Quickstart block preserved as-is (it's already concise and effective)
- Single Command Reference table showing only the 7 core lifecycle commands with a "See [DOCS.md](DOCS.md) for all 28 commands" link below
- Arrow-prefix links section at bottom: → DOCS.md, → CONTRIBUTING.md, → LICENSE
- The `> [!TIP]` callout wrapping the install command for visual emphasis
</specifics>

<code_context>
## Existing Code Insights
- Current README is 237 lines, well-structured prose but no branding assets
- branding/banner-github.svg (3KB), branding/lifecycle-flow.svg (7KB), branding/agent-dispatch.svg (13KB) all exist on disk from branding-assets set
- CONTRIBUTING.md exists from community-infra set
- plugin.json uses `fishjojo1` in homepage and repository fields — needs pragnition migration
- CODEBASE.md references `github.com/fishjojo1/RAPID` and stale version "v3.0.0"
- PROJECT.md references `github.com/fishjojo1/RAPID` in the Context section
- 4.4.0 appears in: package.json, plugin.json, .planning/config.json, STATE.json (rapidVersion), DOCS.md, README.md, skills/install/SKILL.md, skills/status/SKILL.md, .github/ISSUE_TEMPLATE/bug-report.yml, .github/ISSUE_TEMPLATE/feature-request.yml
- `<details>` blocks require blank lines before and after inner content for GitHub Markdown rendering (behavioral invariant in CONTRACT)
</code_context>

<deferred>
## Deferred Ideas
- Branding design SVGs contain hardcoded 4.4.0 — could be updated in a future branding refresh
- CODEBASE.md has stale metadata (v3.0.0, 26 agents) — needs regeneration via /rapid:context post-merge
- PROJECT.md Active section describes v3.0 goals — needs a full refresh post-merge
</deferred>
