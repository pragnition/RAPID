# Stack Research: readme-migration

## Scope

This set performs three operations: (1) full README.md restructure with branded layout, (2) fishjojo1/RAPID to pragnition/RAPID reference migration across active files, and (3) version bump from 4.4.0 to 5.0.0 in all user-facing locations. No runtime code changes, no dependency modifications, no new modules. The research below covers GitHub Markdown rendering specifics, shields.io badge format, SVG embedding constraints, the complete file inventory for reference migration and version bump, and edge cases in each operation.

## Core Stack Assessment

### GitHub Flavored Markdown (GFM)

| Feature | Status | Notes |
|---------|--------|-------|
| `<p align="center">` | Stable | Used for centering banner SVG and badge row |
| `> [!TIP]` callout | Stable (since 2024) | Five types: NOTE, TIP, IMPORTANT, WARNING, CAUTION |
| `<details><summary>` | Stable (long-standing) | Requires blank lines before/after inner markdown content |
| `<img>` with external src | Stable | SVGs rendered via GitHub Camo proxy |
| Shields.io badge embedding | Stable | `<img>` tags with shields.io URLs |

**Critical rendering rule for `<details>` blocks:** GitHub's Markdown processor requires at least one blank line between the closing `</summary>` tag and any Markdown content inside the block. Without this blank line, Markdown inside the details block will render as raw text. The CONTRACT.json behavioral constraint `details-blank-lines` enforces this. Structure must be:

```html
<details>
<summary>Title</summary>

Markdown content here (blank line above is mandatory).

</details>
```

**GitHub alert/callout syntax:** The `> [!TIP]` syntax produces a styled callout box. Syntax is:

```markdown
> [!TIP]
> Content goes here
```

Five alert types are available: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`. Each renders with a distinct color and icon. The TIP type (green icon) is appropriate for the install command callout.

### Shields.io Static Badges

Badge URL format (confirmed from shields.io docs):

```
https://img.shields.io/badge/LABEL-MESSAGE-HEXCOLOR?style=flat-square
```

Hex values must omit the `#` prefix. The Everforest palette hex values for badges:
- Background/label: `2d353b` (dark background)
- Green accent: `a7c080`
- Warm text: `d3c6aa`

**Planned badge row (4 badges, flat-square style):**

1. **Version:** `https://img.shields.io/badge/version-5.0.0-d3c6aa?style=flat-square`
2. **License:** `https://img.shields.io/badge/license-MIT-a7c080?style=flat-square`
3. **Platform:** `https://img.shields.io/badge/Claude_Code-plugin-a7c080?style=flat-square`
4. **Runtime:** `https://img.shields.io/badge/Node.js-18%2B-a7c080?style=flat-square`

**Color note:** The `labelColor` parameter can set the left-side label background: `&labelColor=2d353b`. This creates a dark label background matching Everforest. Without it, shields.io uses its default grey label background. The executor should test both variants and pick whichever achieves better visual cohesion with the banner SVG above.

### SVG Embedding in GitHub README

SVGs are embedded via `<img>` tags, not inline `<svg>`. GitHub proxies SVG images through its Camo service, which sanitizes them. The branding SVGs from the branding-assets set are already designed to pass GitHub's sanitizer (no `<style>` blocks, no external references, only inline presentation attributes).

For centering the banner:

```html
<p align="center">
  <img src="branding/banner-github.svg" alt="RAPID" width="800" />
</p>
```

The `width` attribute on `<img>` controls display size. The banner SVG has a viewBox of `0 0 1280 320` -- setting `width="800"` renders it at a comfortable size that does not overflow narrow viewports.

For the architecture SVGs inside `<details>`:

```html
<details>
<summary>Architecture</summary>

<img src="branding/lifecycle-flow.svg" alt="RAPID Lifecycle" width="800" />

Caption text here.

<img src="branding/agent-dispatch.svg" alt="Agent Dispatch Architecture" width="800" />

Caption text here.

</details>
```

**Relative paths vs absolute URLs:** Relative paths (`branding/banner-github.svg`) work correctly in GitHub README rendering. They resolve relative to the repository root. No need for absolute `https://raw.githubusercontent.com/...` URLs unless the SVGs need to render outside GitHub (e.g., in npm README). Since this is a Claude Code plugin (not an npm package with public README), relative paths are sufficient.

## File Inventory: Reference Migration (fishjojo1 -> pragnition)

### Active Files Requiring Migration

| File | Line(s) | Content | Action |
|------|---------|---------|--------|
| `.claude-plugin/plugin.json` | 6 | `"name": "fishjojo1"` | Change to `"pragnition"` |
| `.claude-plugin/plugin.json` | 8 | `"homepage": "https://github.com/fishjojo1/RAPID"` | Change to pragnition |
| `.claude-plugin/plugin.json` | 9 | `"repository": "https://github.com/fishjojo1/RAPID"` | Change to pragnition |
| `.planning/PROJECT.md` | 87 | `Hosted at github.com/fishjojo1/RAPID.` | Change to pragnition |
| `.planning/context/CODEBASE.md` | 8 | `hosted at github.com/fishjojo1/RAPID` | Change to pragnition |

### Active Files Already Migrated (No Action Needed)

| File | Status |
|------|--------|
| `package.json` | Already uses `pragnition/RAPID` (lines 7, 10) |
| `CONTRIBUTING.md` | Already uses `pragnition/RAPID` (line 12) |
| `LICENSE` | Already uses `pragnition` (line 3) |
| `README.md` | Already uses `pragnition/RAPID` (line 23, install command) |

### Excluded Files (Archives / Historical)

The following directories contain `fishjojo1` references that must NOT be changed (per CONTRACT.json behavioral constraint `active-files-only`):
- `.planning/archive/` -- 47+ files with historical references
- `.planning/milestones/` -- 15+ files with historical references
- `oss_brainstorm/` -- brainstorming docs (not active codebase)

### Edge Cases in Migration

1. **`.planning/STATE.md` line 71:** Contains `Commit and push to fishjojo1/RAPID` in a historical activity log entry. This is a borderline case -- STATE.md is an active file but this specific line is a historical record. Decision: migrate it because STATE.md is not in an archive directory, and the behavioral constraint says "active files only -- .planning/archive/ and .planning/milestones/ directories are excluded." STATE.md is in `.planning/` root, so it is in scope.

2. **`.planning/post-merge/hygiene-sweep/REVIEW-SCOPE.md` line 224:** Contains `Zero fishjojo1 references in DOCS.md, README.md, LICENSE, or rapid-web.service` as a review checklist item. This is also borderline -- it is an active post-merge artifact. Decision: migrate it since it is not in an archive directory.

3. **`.planning/ROADMAP.md` lines 27, 39:** Contains `fishjojo1/RAPID` in the milestone description text. These are current roadmap entries describing the work being done, not historical records. Decision: migrate.

4. **`.planning/research/v5.0-*.md` files:** Multiple v5.0 research files reference `fishjojo1` in their analysis. These are current-milestone research artifacts. Decision: migrate, since they are not in `.planning/archive/`.

5. **Author field in plugin.json:** The `author.name` field is `"fishjojo1"`. The CONTEXT.md does not explicitly call this out, but the SET-OVERVIEW.md says "every fishjojo1/RAPID reference in active files." The author name `fishjojo1` is a reference to the old identity and should be changed to `pragnition` for consistency with the org migration.

## File Inventory: Version Bump (4.4.0 -> 5.0.0)

### Canonical 4 Locations (CONTRACT behavioral: `version-consistency`)

| File | Field/Line | Current | Target |
|------|-----------|---------|--------|
| `package.json` | `"version"` (line 3) | `"4.4.0"` | `"5.0.0"` |
| `.claude-plugin/plugin.json` | `"version"` (line 3) | `"4.4.0"` | `"5.0.0"` |
| `.planning/config.json` | `"version"` (line 4) | `"4.4.0"` | `"5.0.0"` |
| `.planning/STATE.json` | `"rapidVersion"` (line 3) | `"4.4.0"` | `"5.0.0"` |

### Additional User-Facing Locations

| File | Line(s) | Content Pattern | Action |
|------|---------|----------------|--------|
| `README.md` | 5 | `RAPID v4.4.0 gives each developer` | Change to `v5.0.0` (NOTE: README is being fully rewritten, so this is handled by the restructure) |
| `DOCS.md` | 5 | `**Version:** 4.4.0` | Change to `5.0.0` |
| `DOCS.md` | 434 | `RAPID v4.4.0 structures parallel work` | Change to `v5.0.0` |
| `skills/install/SKILL.md` | 2, 7, 9, 28, 92, 319, 331 | 7 occurrences of `v4.4.0` or `4.4.0` | Change all to `5.0.0` / `v5.0.0` |
| `skills/status/SKILL.md` | 6, 8, 124, 146, 171 | 5 occurrences of `v4.4.0` or `4.4.0` | Change all to `5.0.0` / `v5.0.0` |
| `skills/help/SKILL.md` | 20, 108 | 2 occurrences of `v4.4.0` or `4.4.0` | Change all to `5.0.0` / `v5.0.0` |
| `.github/ISSUE_TEMPLATE/bug-report.yml` | 9 | `placeholder: "e.g., v4.4.0"` | Change to `v5.0.0` |
| `.github/ISSUE_TEMPLATE/feature-request.yml` | 9 | `placeholder: "e.g., v4.4.0"` | Change to `v5.0.0` |

### Explicitly Excluded from Version Bump

| File | Reason |
|------|--------|
| `.planning/STATE.json` line 430 (`"id": "v4.4.0"` in milestones array) | Historical milestone identifier -- changing it would break traceability |
| `docs/CHANGELOG.md` line 9 (`## [v4.4.0]`) | Historical changelog entry |
| `.planning/v4.4.0-AUDIT.md` | Historical audit report filename and content |
| `.planning/v4.4.0-DEFERRED.md` | Historical deferred items |
| `.planning/ROADMAP.md` milestone labels | Historical milestone labels (`v4.4.0 Polish & Documentation`) |
| `branding/designs/16-terminal/banner.svg` line 23 | Design file with hardcoded version -- deferred per CONTEXT.md |
| `.archive/mark2-plans/.../package-lock.json` | Archive file, different dependency (`debug: ^4.4.0`) |
| `.planning/archive/v4.4.0/` | Entire archive directory excluded |

### Edge Case: install/SKILL.md Line 28

Line 28 contains a long sentence referencing `v4.4.0.0!` (with extra `.0` and exclamation mark): `You are on version 3.0, so your install location should contain some sort of reference to v4.4.0.0!` This is likely a typo (`v4.4.0.0` should be `v4.4.0`). The version bump should change this to `v5.0.0` and fix the typo simultaneously (remove the extra `.0`).

## README Restructure: Technical Specifics

### Current README Structure (237 lines)

1. Title + tagline paragraph (lines 1-5)
2. "The Problem" section (lines 9-17)
3. Install section (lines 19-25)
4. 60-Second Quickstart (lines 27-42)
5. How It Works (lines 44-63)
6. Architecture with Mermaid diagram (lines 65-79)
7. Agent Dispatch text tree (lines 81-119)
8. Command Reference -- all 28 commands (lines 121-173)
9. Real-World Example walkthrough (lines 175-228)
10. Further Reading link (lines 230-232)
11. License (lines 234-237)

### Target README Structure (per CONTEXT.md decisions)

1. **Centered banner SVG** -- `branding/banner-github.svg` via `<p align="center"><img>`
2. **Centered badge row** -- 4 shields.io badges (Version, License, Claude Code, Node.js)
3. **One-line tagline** -- centered, below badges
4. **The Problem / intro** -- condensed (Claude's discretion on wording)
5. **Install** -- `> [!TIP]` callout wrapping `claude plugin add pragnition/RAPID`
6. **60-Second Quickstart** -- preserved as-is (already concise)
7. **How It Works** -- summary kept at medium depth
8. **Collapsible Architecture** -- `<details>` block with lifecycle-flow.svg and agent-dispatch.svg, each with 1-2 sentence caption
9. **Command Reference** -- condensed to 7 core lifecycle commands only, with "See DOCS.md for all 28 commands" link
10. **Arrow-prefix links** -- `->` DOCS.md, `->` CONTRIBUTING.md, `->` LICENSE
11. **License** -- MIT one-liner

### Key Technical Details for README

**Banner width:** The banner SVG viewBox is `0 0 1280 320`. For optimal display, `width="800"` keeps it readable on standard monitors while allowing mobile browsers to scale down. The banner contains the RAPID title as SVG path elements (not text), a `/rapid:init` command text, and an italic tagline "Agentic Parallelisable and Isolatable Development."

**Badge row centering:** Use `<p align="center">` wrapping all four `<img>` tags. Each badge on the same line (no line breaks between `<img>` tags) to render them inline.

**Architecture SVGs:**
- `lifecycle-flow.svg`: viewBox `0 0 1280 200`, 7-node horizontal pipeline diagram with phase labels and loop arc
- `agent-dispatch.svg`: viewBox `0 0 1280 600`, 7-row vertical table showing command-to-agent mapping with phase-colored pills

Both should use `width="800"` for consistent sizing with the banner.

**Command table reduction:** Current README has 3 tables (7 core + 3 review + 4 auxiliary + 14 utilities = 28 commands). Target: single table with only the 7 core lifecycle commands, plus a link to DOCS.md for the full reference.

**Install command in TIP callout:**

```markdown
> [!TIP]
> ```
> claude plugin add pragnition/RAPID
> ```
```

Note: Code blocks inside blockquotes work in GFM. The triple backtick must be preceded by `> ` on each line.

## Compatibility Matrix

| Constraint | Requirement | Status |
|-----------|-------------|--------|
| GitHub SVG rendering | Basic SVG elements only (no `<style>`, no external refs) | Compatible -- branding SVGs use inline attributes only |
| GitHub `> [!TIP]` callout | GitHub.com rendering support | Compatible -- stable since 2024 |
| `<details>` with markdown content | Blank lines before/after inner content | Must be enforced in the README template |
| Shields.io custom hex colors | Hex without `#` prefix | Compatible (`d3c6aa`, `a7c080`, `2d353b`) |
| `<p align="center">` for centering | GitHub Markdown renderer | Compatible (long-standing support) |
| Version consistency across files | All 4 canonical locations + user-facing files | Verified: 4 canonical + 8 additional locations identified |
| Reference migration scope | Active files only, archives excluded | Verified: 5 active files need migration, 60+ archive files excluded |

## Stack Risks

### 1. Incomplete Reference Migration (HIGH)

**Risk:** Missing a `fishjojo1` reference in an active file that was not identified during research. The grep found references in `.planning/STATE.md`, `.planning/post-merge/`, and `.planning/research/v5.0-*.md` files beyond the obvious candidates.

**Impact:** Users or contributors encountering stale organization references, or worse, the plugin.json pointing to the wrong repository.

**Mitigation:** After migration, run a verification grep: `grep -r "fishjojo1" --include="*.md" --include="*.json" --include="*.yml" --include="*.cjs" --exclude-dir=".planning/archive" --exclude-dir=".planning/milestones" --exclude-dir="oss_brainstorm" --exclude-dir=".archive"`. The result should be zero matches.

### 2. Version String Missed in Non-Obvious Location (MEDIUM)

**Risk:** A `4.4.0` reference exists in a location not identified by this research -- possibly in generated files, cached artifacts, or dynamically loaded templates.

**Impact:** Version inconsistency between files, confusing users who see different versions in different places.

**Mitigation:** Post-bump verification grep: `grep -r "4\.4\.0" --include="*.md" --include="*.json" --include="*.yml" --include="*.cjs" --exclude-dir=".planning/archive" --exclude-dir=".planning/milestones" --exclude-dir="oss_brainstorm" --exclude-dir=".archive" --exclude-dir="branding/designs"`. Expected remaining hits: only historical records (CHANGELOG, AUDIT, ROADMAP milestone labels, STATE.json milestone id).

### 3. SVG Display Size on Mobile/Narrow Viewports (LOW)

**Risk:** `width="800"` on the banner/architecture SVGs may cause horizontal scrolling on narrow mobile screens.

**Impact:** Cosmetic only -- GitHub's mobile app and narrow browser windows may not render optimally.

**Mitigation:** GitHub's Markdown renderer scales `<img>` elements responsively when they exceed the container width. The `width="800"` sets a maximum display width, not a minimum. On narrow screens, the image will scale down automatically. No action needed.

### 4. README Restructure Removes Useful Content (LOW)

**Risk:** The Real-World Example and detailed Agent Dispatch prose are being removed. Some users may find these helpful.

**Impact:** Information loss -- but DOCS.md retains the full reference, and the arrow-prefix links at the bottom direct users there.

**Mitigation:** Ensure the "See DOCS.md" link is prominent. The CONTEXT.md decision explicitly chose "medium depth" to avoid duplicating DOCS.md.

## Recommendations

1. **Execute Wave 1 (README restructure) before Wave 2 (migration + version bump)** -- The README is being fully rewritten, so version and org references in the old README are irrelevant. Writing the new README with the correct `pragnition` and `5.0.0` values from the start avoids double-editing. Priority: critical (ordering).

2. **Run post-migration verification grep** as the final step of Wave 2. Zero `fishjojo1` matches in active files is the acceptance criterion. Priority: critical (correctness).

3. **Run post-bump verification grep** as the final step of Wave 2. Only expected historical hits should remain for `4.4.0`. Priority: critical (correctness).

4. **Fix the `v4.4.0.0` typo in install/SKILL.md line 28** during the version bump. Change `v4.4.0.0!` to `v5.0.0!` (or `v5.0.0`). Priority: high (accuracy).

5. **Use `width="800"` for all three SVG embeds** (banner, lifecycle-flow, agent-dispatch) for visual consistency. Priority: medium (aesthetics).

6. **Test the README in a branch preview** before merging. Push the restructured README to a feature branch and verify rendering on GitHub.com. Priority: medium (quality assurance).

7. **Consider adding `labelColor=2d353b`** to shields.io badge URLs to match the Everforest dark background on the label side. This creates a cohesive dark-themed badge row. The executor should test with and without this parameter and pick the better visual result. Priority: low (refinement).
