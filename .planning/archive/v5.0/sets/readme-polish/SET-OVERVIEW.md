# SET-OVERVIEW: readme-polish

## Approach

This set rewrites the RAPID README.md to be more concise, scannable, and visually structured, using the OpenSpec README (github.com/Fission-AI/OpenSpec) as a style reference. The current README (~106 lines) is dense with long prose paragraphs -- particularly the "How It Works" section, which packs multiple concepts into wall-of-text format. The goal is to break content into tables, bullet lists, and diagrams so readers can skim to the information they need.

The two existing SVG diagrams (lifecycle-flow.svg and agent-dispatch.svg) are embedded inside a collapsed `<details>` block at width="800", which makes them easy to miss and hard to read at that size. This set will enlarge and promote them so they serve as primary visual anchors rather than hidden supplementary content. The overall tone should shift from "explaining everything in prose" to "showing structure visually and letting prose fill gaps."

The work is documentation-only with no code changes, no contract dependencies, and no imports/exports. This makes it fully independent from all other v5.0 sets.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| README.md | Primary target -- full content restructure | Existing |
| branding/lifecycle-flow.svg | 7-phase lifecycle diagram (viewBox 1280x200) | Existing -- resize/restyle |
| branding/agent-dispatch.svg | 27-agent dispatch diagram (viewBox 1280x600) | Existing -- resize/restyle |
| branding/banner-github.svg | Hero banner (unchanged) | Existing -- no changes |

## Integration Points

- **Exports:** None -- this set produces no code artifacts consumed by other sets.
- **Imports:** None -- this set has no dependencies on other sets.
- **Side Effects:** The README is user-facing documentation. Changes affect how the project is perceived by new users and contributors. No programmatic side effects.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-condensing loses important details | Medium | Keep full documentation in DOCS.md; README should be an entry point, not exhaustive |
| SVG resizing breaks aspect ratios or text readability | Low | Test rendered output at multiple viewport widths; preserve viewBox proportions |
| Style divergence from OpenSpec reference | Low | Review OpenSpec README before drafting; use it as a checklist for structure |
| Merge conflicts if other sets also touch README.md | Low | OWNERSHIP.json shows no other set owns README.md; readme-polish is the sole owner |

## Wave Breakdown (Preliminary)

- **Wave 1:** Content audit and restructure -- rewrite README.md prose into tables, bullet lists, and shorter sections following OpenSpec patterns
- **Wave 2:** Diagram improvements -- enlarge lifecycle-flow.svg and agent-dispatch.svg for better readability, promote them out of the collapsed details block
- **Wave 3:** Final polish -- verify all links, check rendering on GitHub, ensure consistency between README and DOCS.md references

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
