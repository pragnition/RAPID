# Phase 27: UX Branding & Colors - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add RAPID branding banners at stage transitions and color-coded agent type indicators in terminal output. Every skill invocation shows a visually distinct branded banner, and each agent role displays with a semantically meaningful color. This phase covers UX-06 (stage banners) and UX-07 (agent type colors).

</domain>

<decisions>
## Implementation Decisions

### Banner design
- Block banner style: full-width colored background block with white text
- Fixed width (~40-50 chars), not terminal-aware
- Block characters (▓) used for border — no fallback to dashes/equals needed
- RAPID brand name in bold white, action verb (EXECUTING, PLANNING, etc.) carries the stage color
- Content: stage name + target only (no progress counts, no timestamps)
- Example: `▓▓▓ RAPID ► EXECUTING  Wave 1.1 ▓▓▓` with colored background

### Banner placement
- All 7 stage transitions get banners: init, set-init, discuss, wave-plan, execute, review, merge
- Top-level banners only — one banner per skill invocation
- Sub-stages (per-wave progress, per-pipeline stages) use lighter indicators (indented text, bullets), not banners

### Color scheme
- Basic 16 ANSI color palette — maximum terminal compatibility
- Colors grouped by function:
  - PLANNING roles (planner, wave-planner, job-planner) = blue
  - EXECUTION roles (executor, job-executor) = green
  - REVIEW roles (reviewer, judge) = red, bug-hunter = yellow, devils-advocate = magenta
- Stage banner backgrounds use the same color groups: planning stages = blue bg, execution stages = green bg, review stages = red bg

### Implementation split
- **Agent colors (UX-07):** Use Claude Code's native `color` frontmatter field in assembler.cjs — add `color: blue` (etc.) per role in `generateFrontmatter()`. No custom ANSI code needed for agent type display.
- **Stage banners (UX-06):** New `src/lib/display.cjs` utility with banner rendering functions using raw ANSI escape codes (no third-party dependencies — RAPID has zero runtime deps)
- Skills access banners via `rapid-tools display banner <stage> <target>` CLI subcommand, same pattern as all other rapid-tools commands

### Terminal handling
- Always output colors — no auto-detection or NO_COLOR support. Let terminals handle stripping if needed.
- Raw ANSI escape codes in display.cjs (no chalk, kleur, or other dependencies)

### Claude's Discretion
- Exact ANSI escape code sequences for each color
- Banner padding and internal spacing
- Which specific 16-color variants (bright vs normal) look best per role
- Sub-stage indicator formatting (indentation, bullets, etc.)
- Whether to map each of the 7 stages to planning/execution/review color groups or use a per-stage color

</decisions>

<specifics>
## Specific Ideas

- User specifically wants Claude Code's built-in `color` frontmatter for agents rather than custom terminal coloring logic — check if the field is actually supported (it appears in the interactive `/agents` UI but isn't in the documented frontmatter table)
- Block banner was chosen for high visibility and modern CLI feel
- The assembler already has `ROLE_DESCRIPTIONS` map — extend it with a `ROLE_COLORS` map for frontmatter generation

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/assembler.cjs` — `generateFrontmatter(role)` already maps roles to tools and descriptions. Add `color` field here.
- `ROLE_TOOLS` and `ROLE_DESCRIPTIONS` maps in assembler.cjs — add parallel `ROLE_COLORS` map
- `src/bin/rapid-tools.cjs` — CLI dispatcher with switch/case for subcommands. Add `display` case.

### Established Patterns
- All CLI subcommands return JSON to stdout (rapid-tools.cjs convention) — display commands are an exception (they output formatted text)
- CommonJS modules with `module.exports` throughout
- Skills call `node "${RAPID_TOOLS}" <command> <args>` for all tool operations
- Frontmatter is YAML between `---` delimiters

### Integration Points
- All 17 skill SKILL.md files need banner calls added at entry point
- `assembler.cjs` needs `color` field added to frontmatter generation
- `rapid-tools.cjs` needs new `display` command with `banner` subcommand
- New `src/lib/display.cjs` module for banner rendering logic

</code_context>

<deferred>
## Deferred Ideas

- **Agent spawn namespace contamination** — Skills/agents are spawning from `gsd-review:*` instead of `rapid:*` agent types. Needs a pass through all SKILL.md files to fix agent spawn references. Likely a Phase 25 (GSD decontamination) leftover.
- **Worktree-per-set enforcement** — Each set should spawn its own worktree for isolation. Needs verification that the set-init workflow correctly creates isolated worktrees. Related to Phase 19 (set lifecycle) or a standalone fix.

</deferred>

---

*Phase: 27-ux-branding-colors*
*Context gathered: 2026-03-09*
