# RAPID Open-Source Presentation Spec

Make the RAPID GitHub repo aesthetically pleasing for open-source release. Minimalist hacker aesthetic, Everforest dark palette, newspaper-influenced typography. Inspired by [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) README patterns.

## Branding

### Palette: Everforest Dark (G1)

| Role       | Hex       | Usage                        |
|------------|-----------|------------------------------|
| Background | `#2d353b` | Banner bg, diagram bg        |
| Foreground | `#d3c6aa` | Title text, node labels       |
| Grey       | `#859289` | Subtitle, secondary text      |
| Border     | `#475258` | Diagram node borders, rules   |

### Typography

- Title "RAPID": serif font (Georgia), bold, wide letter-spacing
- Command `/rapid:init`: monospace, grey
- Tagline "Agentic Parallelisable and Isolatable Development": serif, italic, grey

### Banner SVG (`branding/banner-github.svg`)

- Dimensions: 1280x320
- Layout: `/rapid:init` (monospace, grey) above, `RAPID` (serif, bold, foreground) center, tagline (serif, italic, grey) below
- No dividers, no decorations -- the G1 clean variant
- Replaces the current pixel-art `branding/banner.svg` for GitHub use

### Social Preview (`branding/social-preview.png`)

- Dimensions: 1280x640 (GitHub's required size)
- Same G1 design as banner, rasterized to PNG (use browser screenshot or Inkscape export)
- Set manually via GitHub repo settings (Settings > General > Social preview)

## New Files to Create

### Community

| File               | Purpose                                                     |
|--------------------|-------------------------------------------------------------|
| `CONTRIBUTING.md`  | Brief, no-nonsense. Sections: dev install, bug reports, feature proposals, code style. Matches minimalist tone. |

### GitHub Templates

| File                                        | Purpose                                                        |
|---------------------------------------------|----------------------------------------------------------------|
| `.github/ISSUE_TEMPLATE/bug_report.yml`     | YAML form: description, repro steps, expected behavior, RAPID version, Claude Code version |
| `.github/ISSUE_TEMPLATE/feature_request.yml`| YAML form: description, use case, proposed solution (optional) |
| `.github/ISSUE_TEMPLATE/config.yml`         | Disables blank issues, points to templates                     |
| `.github/PULL_REQUEST_TEMPLATE.md`          | Short checklist: what changed, why, testing done               |

### Diagrams

| File                                    | Purpose                                                        |
|-----------------------------------------|----------------------------------------------------------------|
| `branding/lifecycle-flow.svg`           | Horizontal flow: init -> start-set -> discuss-set -> plan-set -> execute-set -> review -> merge. Each node shows command name + primary artifact. Everforest palette. ~1280x200. |
| `branding/agent-dispatch.svg`           | Vertical tree: each command and the agents it spawns. Shows parallelism (6 researchers fanning out from /rapid:init). Everforest palette. ~1280x600. |

## README.md Edits

### Header Stack

All centered with `<p align="center">`:

```html
<p align="center">
  <a href="https://github.com/pragnition/RAPID">
    <picture>
      <source srcset="branding/banner-github.svg">
      <img src="branding/banner-github.svg" alt="RAPID banner">
    </picture>
  </a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-4.4.0-d3c6aa?style=flat-square" />
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-859289?style=flat-square" /></a>
  <img alt="Claude Code Plugin" src="https://img.shields.io/badge/Claude_Code-Plugin-d3c6aa?style=flat-square" />
</p>

<p align="center">
  <sub>Built with love by <a href="https://github.com/fishjojo1">fishjojo1</a></sub>
</p>
```

Badge colors use Everforest palette values for consistency. The version badge is hardcoded -- update it manually when bumping versions, or switch to a GitHub release tag badge once releases are published.

### Section Structure

1. **Header stack** (banner + badges + attribution)
2. **`# RAPID`** heading + bold one-liner ("A Claude Code plugin for coordinated parallel AI-assisted development.")
3. **The Problem** -- keep existing text as-is
4. **Install** -- wrap in `> [!TIP]` callout:
   ```markdown
   > [!TIP]
   > ```
   > claude plugin add pragnition/RAPID
   > ```
   > Then run `/rapid:install` inside Claude Code to configure your environment.
   ```
5. **60-Second Quickstart** -- keep existing content, restyle as terminal demo (show commands + simulated output like OpenSpec's "See it in action")
6. **How It Works** -- keep all text, replace mermaid flowchart with `branding/lifecycle-flow.svg` via `<img>` tag
7. **Architecture** -- replace ASCII agent dispatch block with `branding/agent-dispatch.svg`, wrap in `<details><summary>` collapsible
8. **Command Reference** -- keep all three tables as-is
9. **Real-World Example** -- keep as-is
10. **Docs** -- restyle as arrow-prefixed links:
    ```markdown
    → **[Setup](docs/setup.md)**: installation and configuration
    → **[Planning](docs/planning.md)**: research and wave planning
    → **[Execution](docs/execution.md)**: running sets
    → **[Review](docs/review.md)**: testing and bug hunting
    → **[Merge](docs/merge-and-cleanup.md)**: conflict detection and resolution
    → **[Troubleshooting](docs/troubleshooting.md)**: common issues
    → **[Full Reference](DOCS.md)**: complete technical documentation
    ```
11. **Contributing** -- one-liner linking to `CONTRIBUTING.md`
12. **License** -- keep as-is

### What Gets Removed

- Mermaid flowchart (replaced by lifecycle SVG)
- ASCII agent dispatch tree (replaced by agent dispatch SVG inside `<details>`)
- The old first paragraph (replaced by header stack, but `# RAPID` heading stays)

### What Stays Untouched

- All command reference tables
- Real-world example section
- "The Problem" section
- "How It Works" prose (only the diagram changes)
- License section

## Implementation Order

1. Create `branding/banner-github.svg`
2. Create `branding/social-preview.png`
3. Create `branding/lifecycle-flow.svg`
4. Create `branding/agent-dispatch.svg`
5. Create `CONTRIBUTING.md`
6. Create `.github/ISSUE_TEMPLATE/bug_report.yml`
7. Create `.github/ISSUE_TEMPLATE/feature_request.yml`
8. Create `.github/ISSUE_TEMPLATE/config.yml`
9. Create `.github/PULL_REQUEST_TEMPLATE.md`
10. Edit `README.md` -- apply all changes described above
