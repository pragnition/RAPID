# SET-OVERVIEW: branding-assets

## Approach

This set creates four visual branding assets for RAPID's open-source GitHub presentation, plus a `.gitattributes` file for binary/text differentiation. The assets replace the existing pixel-art ocean-wave banner (`branding/banner.svg`) with a clean, typography-driven design using the Everforest dark palette. The existing banner and logo remain untouched -- the new files are additive under distinct filenames.

All SVGs are hand-crafted with inline `fill` and `font-family` attributes rather than CSS classes or `<style>` blocks. This is mandatory because GitHub's SVG sanitizer (via the Camo proxy) strips `<style>` elements and CSS class references. The existing `branding/banner.svg` uses `<style>` with classes and therefore does not survive GitHub sanitization -- the new assets correct this. The banner title text ("RAPID") must be converted to SVG `<path>` elements to eliminate font-dependency failures on systems lacking Georgia or Noto Serif.

The social preview PNG is a one-time rasterization step using `rsvg-convert` (v2.61.4, confirmed installed at `/usr/bin/rsvg-convert`). The PNG is committed as a binary artifact; it is not regenerated during builds.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `branding/banner-github.svg` | 1280x320 banner with Everforest dark bg, path-based serif title, monospace command, italic tagline | New |
| `branding/lifecycle-flow.svg` | ~1280x200 horizontal flow diagram: init through merge pipeline (7 nodes, 6 arrows) | New |
| `branding/agent-dispatch.svg` | ~1280x600 vertical tree diagram: 8 command groups spawning 18 agent rows | New |
| `branding/social-preview.png` | 1280x640 PNG rasterized from a tall variant of the banner design | New |
| `.gitattributes` | Binary/text markers for PNG and SVG files | New |

Existing files (not modified by this set):

| File | Note |
|------|------|
| `branding/banner.svg` | Existing pixel-art wave banner, retained |
| `branding/logo.svg` | Existing pixel-art logo, retained |
| `branding/index.html` | Design preview page, retained |
| `branding/designs/` | 17 design explorations, retained |

## Integration Points

- **Exports:** Five static files consumed by the `readme-migration` set (DAG wave 2). The README overhaul will reference `branding/banner-github.svg` in an `<img>` header, embed `branding/lifecycle-flow.svg` and `branding/agent-dispatch.svg` as inline diagrams, and document that `branding/social-preview.png` must be manually uploaded via GitHub repo settings.
- **Imports:** None. This set has zero dependencies on other sets.
- **Side Effects:** The `.gitattributes` file applies repository-wide git diff and merge behavior for PNG and SVG files. All subsequent git operations will respect these attributes.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub SVG sanitizer strips unexpected attributes | High -- banner renders as blank or broken on GitHub | Use only inline `fill`, `font-family`, `font-size`, `font-weight`, `font-style`, `text-anchor` attributes. No `<style>`, no `class`, no `<defs>` styling. Test by viewing raw SVG through `raw.githubusercontent.com` (Camo proxy). |
| Title font not available on viewer systems | Medium -- "RAPID" renders in fallback sans-serif, losing serif aesthetic | Convert title text to SVG `<path>` elements (contract behavioral: `title-as-paths`). Subtitle and command text remain as `<text>` with graceful font-stack fallback. |
| WCAG AA contrast failure for grey text on dark bg | Medium -- accessibility audit failure | Grey `#859289` on `#2d353b` achieves 3.4:1 ratio -- passes AA for large text only (>=18px or >=14px bold). Enforce minimum font sizes in all SVGs. |
| `rsvg-convert` text rendering differs from browser | Low -- PNG text positioning slightly off | Generate a 1280x640 variant SVG with explicit coordinates, then rasterize. Verify PNG visually before committing. |
| `.gitattributes` conflicts with future sets | Low -- merge conflicts if `readme-migration` also touches `.gitattributes` | This set owns `.gitattributes` exclusively per OWNERSHIP.json. The `readme-migration` set does not list it in its owned files. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Banner SVG and `.gitattributes`. Create `branding/banner-github.svg` with the Everforest dark palette, path-based title, and inline attributes. Create `.gitattributes` with PNG binary and SVG text markers. These are the foundation assets -- the banner design establishes the visual language for all subsequent diagrams.
- **Wave 2:** Diagram SVGs. Create `branding/lifecycle-flow.svg` (7-node horizontal pipeline) and `branding/agent-dispatch.svg` (8-group vertical tree). Both follow the same Everforest palette and inline-attribute conventions established in Wave 1. These two diagrams are independent of each other and can be implemented in parallel.
- **Wave 3:** Social preview PNG. Create a 1280x640 tall variant of the banner design, rasterize via `rsvg-convert`, commit the PNG, and remove the temporary tall SVG.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
