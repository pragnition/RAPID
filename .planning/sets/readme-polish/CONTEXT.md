# CONTEXT: readme-polish

**Set:** readme-polish
**Generated:** 2026-03-30
**Mode:** interactive

<domain>
## Set Boundary
Condense and restructure the RAPID README.md using the OpenSpec README (github.com/Fission-AI/OpenSpec) as a style reference. Make content less wordy, more scannable with tables, bullet lists, and diagrams. Enlarge existing SVG diagrams (lifecycle-flow.svg, agent-dispatch.svg) that are currently too small and hidden in a collapsed block. No code changes — documentation only.
</domain>

<decisions>
## Implementation Decisions

### Content Hierarchy & Depth
- **Intro:** Replace the dense 4-line prose paragraph with a bold one-liner tagline followed by 3-4 bullet points covering isolation, ownership, contracts, and merge strategy.
- **Rationale:** Bullet points are immediately scannable and align with OpenSpec's brevity pattern. The current wall-of-text intro causes readers to skip past the core value proposition.

- **Command Reference:** Keep the 7 core lifecycle commands in the table. Link to DOCS.md for the full 28-command reference.
- **Rationale:** The README should be an entry point, not exhaustive. 7 commands covers the complete lifecycle without overwhelming newcomers, and drives traffic to DOCS.md for depth.

### Diagram Presentation Strategy
- **Location:** Promote both SVG diagrams (lifecycle-flow.svg and agent-dispatch.svg) out of the collapsed `<details>` block into the main README flow as primary visual anchors.
- **Rationale:** Most visitors never expand collapsed blocks. The diagrams are the most visually distinctive content in the README and should be immediately visible, matching OpenSpec's direct-embed approach.

- **Size:** Render both diagrams at full container width (remove the `width="800"` attribute, let GitHub's ~980px content column naturally constrain). Additionally, tighten the SVG viewBox dimensions to reduce excessive whitespace within the diagrams themselves.
- **Rationale:** User noted there is too much whitespace in the current SVGs. Removing the width constraint maximizes readability of phase labels and agent names. Cropping the viewBox ensures the diagrams use their space efficiently.

### How It Works Restructuring
- **Format:** Keep the bold-titled paragraph structure but shorten each phase to 1-2 sentences (cut ~60% of current text). The lifecycle diagram above provides visual context, so prose should complement rather than duplicate it.
- **Rationale:** Shortened prose preserves the narrative feel that distinguishes RAPID's README from a dry reference while dramatically improving scannability.

- **Review pipeline:** Condense the 4-stage review breakdown (currently a 4-item bullet list with per-stage explanations) into a single summary sentence. Full review pipeline detail belongs in DOCS.md.
- **Rationale:** The review stages are already listed in the Quickstart command block. Duplicating the breakdown asymmetrically (only review gets sub-stages) makes the section unbalanced. One sentence mentioning the adversarial approach is enough to intrigue readers.

### Visual Style Alignment with OpenSpec
- **Opening:** Replace the current italic tagline with a blockquote philosophy statement below the badges. The blockquote's left-border styling draws the eye and creates a stronger visual anchor than plain italics.
- **Rationale:** User preferred the blockquote over both the existing italic approach and OpenSpec's code-block pattern. Blockquotes signal "important statement" without implying runnable code.

- **Footer:** Merge the separate License section into the arrow-prefix links section. License becomes one of the links (`-> [License](LICENSE) -- MIT`) rather than its own `## License` heading.
- **Rationale:** License already appears in the badge row and the links section, making a standalone section redundant. Consolidating tightens the footer.

### Claude's Discretion
- None — user provided input on all identified gray areas.
</decisions>

<specifics>
## Specific Ideas
- Tighten SVG viewBox dimensions to crop whitespace — both lifecycle-flow.svg and agent-dispatch.svg have excess padding
- The blockquote philosophy statement should capture RAPID's core thesis about parallel AI development needing the same structures as parallel human development
- Review summary sentence should mention the adversarial bug-hunt (hunter/devil's-advocate/judge) as RAPID's most distinctive feature
</specifics>

<code_context>
## Existing Code Insights
- README.md is 106 lines, structured as: centered banner + badges + tagline, HR, intro paragraph, Install tip box, Quickstart code block, How It Works (6 paragraphs), collapsed Architecture details, Command Reference table, Links, License
- lifecycle-flow.svg has viewBox="0 0 1280 200", agent-dispatch.svg has viewBox="0 0 1280 600"
- Both diagrams are embedded at `width="800"` inside a `<details><summary>Architecture</summary>` block
- The install section already uses a GitHub `> [!TIP]` callout box — this pattern can be retained
- Arrow-prefix links (`->`) are already used in the Links section
- banner-github.svg is the hero banner and should remain unchanged
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
