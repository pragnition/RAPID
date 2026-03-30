# CONTEXT: branding-assets

**Set:** branding-assets
**Generated:** 2026-03-30
**Mode:** interactive

<domain>
## Set Boundary
Create four visual branding assets for RAPID's open-source GitHub presentation plus a .gitattributes file. Assets include a 1280×320 banner SVG, horizontal lifecycle flow SVG (~1280×200), vertical agent dispatch SVG (~1280×600), and 1280×640 social preview PNG. All SVGs use inline fill/font attributes for GitHub rendering compatibility. No runtime code changes.
</domain>

<decisions>
## Implementation Decisions

### Banner Composition — Layout
- Centered stack layout: title centered, command above, tagline below
- **Rationale:** Clean, symmetrical, professional presentation matching the G1 direction from branding-direction-v8.html. Centered layout works best as a README hero image at any viewport width.

### Banner Composition — Decorative Elements
- Subtle geometric accents (thin horizontal rules or similar)
- **Rationale:** Positions the design between G1 (no dividers) and G2 (masthead rules). Adds enough visual structure to frame the typography without cluttering the minimal aesthetic.

### Typography Hierarchy — Title Style
- Classic serif letterforms (Georgia-like, bold, letter-spacing 10px)
- **Rationale:** Warm and authoritative feel preferred over modern thin or geometric styles. Matches the existing branding-direction-v8.html mockups which use Georgia serif.

### Typography Hierarchy — Text Content
- Command: `/rapid:init` (monospace, grey #859289, small, above title)
- Title: `RAPID` (Georgia serif paths, warm beige #d3c6aa, 46px equivalent, bold, letter-spacing 10px)
- Tagline: `Agentic Parallelisable and Isolatable Development` (Georgia serif italic, grey #859289, 11px equivalent)
- **Rationale:** Directly follows the G1 mockup layout from branding-direction-v8.html. Shows the entry-point command, project name, and full acronym expansion — all three pieces of information a newcomer needs.

### Color Semantics — Approach
- Semantic color mapping: colors carry meaning across all diagram assets
- Primary accent: Green #a7c080 (Everforest signature)
- **Rationale:** Semantic mapping creates a learnable visual language. Green as primary accent aligns with the Everforest theme identity and provides good contrast against the warm beige/grey palette.

### Color Semantics — Phase Coloring
- Pipeline stages grouped by phase with distinct colors:
  - Setup phase (init, start-set): Grey/neutral tones
  - Planning phase (discuss, plan): Green #a7c080
  - Execution phase (execute, review, merge): Cyan #7fbbb3
- **Rationale:** Phased coloring communicates the workflow structure at a glance. Three color groups map to the three natural phases of the RAPID lifecycle.

### Visual Density
- Medium density with balanced spacing for GitHub ~900px viewport readability
- **Rationale:** Balances information density with readability at the scale GitHub renders inline SVGs. Neither cramped nor wasteful of space.

### Visual Density — Labels
- Mixed format: command name as primary label with small descriptive subtitle below
- **Rationale:** Serves both existing RAPID users (who recognize command names) and newcomers (who need the descriptive context).

### Diagram Rendering Style — Shapes
- Rounded rectangles (rx=6-8) with clean fill, no stroke borders
- **Rationale:** Softer than flat rectangles, more readable for information-dense diagrams, fully GitHub SVG sanitizer safe.

### Diagram Rendering Style — Connectors
- Simple thin lines with small triangle arrowheads
- **Rationale:** Clean directional indicators without adding visual weight. Consistent across both lifecycle and dispatch diagrams.

### Lifecycle Flow — Node Shape
- Horizontal pills (wide rounded rectangles) with text centered inside
- **Rationale:** Accommodates mixed labels (name + subtitle) well within the shape. Modern feel that reads cleanly in the horizontal flow.

### Lifecycle Flow — Stage Differentiation
- Phased coloring across the 7 nodes matching the semantic color scheme
- **Rationale:** Reinforces the three-phase workflow structure visually. Users can see at a glance which stages belong to setup, planning, or execution.

### Agent Dispatch — Layout
- Grouped rows: each command gets a full-width horizontal row with its spawned agents beside it, separated by thin dividers
- **Rationale:** Clearest grouping for the command→agent relationship. Easy to scan vertically to find a specific command and see all its agents.

### Agent Dispatch — Color Sync
- Match lifecycle flow phase colors: commands colored by their lifecycle phase, agents inherit the same phase color
- **Rationale:** Creates visual continuity between the two diagrams. Users who learned the color language from the lifecycle flow can immediately apply it to the dispatch diagram.

### Social Preview — Layout
- Top half: banner text (title, command, tagline), bottom half: condensed lifecycle flow
- **Rationale:** Self-contained project overview in a single image. When shared on Twitter/Discord/Slack, viewers see both the brand identity and the workflow at a glance.

### Social Preview — Background
- Dark Everforest (#2d353b) with subtle 1px lighter border
- **Rationale:** Maintains brand consistency with the banner while preventing the preview from blending into dark-mode backgrounds on social platforms.

### Claude's Discretion
- No areas were left to Claude's discretion — all 8 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- Follow the G1 mockup from `.superpowers/brainstorm/506846-1774858603/content/branding-direction-v8.html` as the banner design reference
- Title text rendered as SVG paths (per contract behavioral: title-as-paths) using Georgia-like classic serif letterforms
- Use British spelling "Parallelisable" in the tagline (matches the mockup)
- Everforest palette: bg #2d353b, fg #d3c6aa, grey #859289, green #a7c080, cyan #7fbbb3, red #e67e80, yellow #dbbc7f, purple #d699b6
- Three-phase color scheme: grey (setup) → green (planning) → cyan (execution)
</specifics>

<code_context>
## Existing Code Insights
- Existing `branding/banner.svg` uses `<style>` with CSS classes — this is stripped by GitHub's SVG sanitizer (Camo proxy). New assets must use only inline attributes.
- Existing banner is 1280×320 pixel-art ocean wave design with `<rect>` elements. The new banner-github.svg takes a completely different typographic approach.
- `rsvg-convert` confirmed installed at `/usr/bin/rsvg-convert` (v2.61.4) for PNG rasterization.
- Existing `branding/` directory contains `banner.svg`, `logo.svg`, `index.html`, and 17 design explorations in `designs/` — all retained, new files are additive.
- No existing `.gitattributes` file — this set creates it fresh.
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
