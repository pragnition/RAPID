# SET-OVERVIEW: readme-migration

## Approach

This set performs three related housekeeping operations that prepare the repository for its v5.0.0 public release under the new `pragnition/RAPID` GitHub organization. The work is purely content/metadata -- no runtime code changes, no new modules, no behavioral changes to any agent or CLI tool.

The first task is a full restructure of `README.md` using modern GitHub Markdown formatting: a centered banner header stack (consuming `branding/banner-github.svg` from the branding-assets set), a shields.io badge row, collapsible `<details>` architecture sections embedding the lifecycle-flow and agent-dispatch SVGs, a `> [!TIP]` callout for the install command, and arrow-prefixed links to DOCS.md, CONTRIBUTING.md, and LICENSE. The current README is ~237 lines of plain prose; the new version replaces it entirely with the branded layout.

The second task migrates every `fishjojo1/RAPID` reference in active files to `pragnition/RAPID`. Archive directories (`.planning/archive/`, `.planning/milestones/`) are explicitly excluded to preserve historical accuracy. The third task bumps all hardcoded version strings from `4.4.0` to `5.0.0` across the four canonical version locations. These three tasks are logically independent but ship as a single atomic set because they all touch `README.md` and share the "release prep" theme.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `README.md` | Primary project README -- full restructure | Existing (rewrite) |
| `.claude-plugin/plugin.json` | Plugin manifest -- version bump + org migration | Existing (edit) |
| `.planning/context/CODEBASE.md` | Codebase context doc -- org migration | Existing (edit) |
| `.planning/PROJECT.md` | Project metadata -- org migration | Existing (edit) |
| `package.json` | NPM manifest -- version bump | Existing (edit) |
| `.planning/config.json` | RAPID config -- version bump | Existing (edit) |
| `DOCS.md` | Full documentation -- version string update | Existing (edit) |
| `skills/install/SKILL.md` | Install skill -- version references | Existing (edit) |
| `skills/help/SKILL.md` | Help skill -- version references | Existing (edit) |
| `skills/status/SKILL.md` | Status skill -- version references | Existing (edit) |
| `.planning/STATE.json` | State file -- rapidVersion field | Existing (edit) |

## Integration Points

- **Exports:**
  - `readme-md`: Fully restructured README.md with centered banner, badges, collapsible architecture, SVG embeds, tip callout, arrow-prefix doc links
  - `reference-migration`: All `fishjojo1/RAPID` references in active files changed to `pragnition/RAPID`
  - `version-bump`: Version references updated from 4.4.0 to 5.0.0 across all hardcoded locations

- **Imports:**
  - `banner-svg` from branding-assets: `branding/banner-github.svg` (already exists on disk)
  - `lifecycle-flow-svg` from branding-assets: `branding/lifecycle-flow.svg` (already exists on disk)
  - `agent-dispatch-svg` from branding-assets: `branding/agent-dispatch.svg` (already exists on disk)
  - `contributing-md` from community-infra: `CONTRIBUTING.md` (already exists on disk)

- **Side Effects:** After merge, the GitHub repository page will render the new branded README. Any external links pointing to `fishjojo1/RAPID` in active docs will need to resolve via GitHub redirect.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `<details>` blocks render incorrectly without blank lines around inner content | Medium | Behavioral invariant `details-blank-lines` enforced by test -- verify rendering manually on GitHub after merge |
| Missing a `fishjojo1` reference in an active file | Low | Run `grep -r fishjojo1` excluding archive/milestones as acceptance gate; behavioral invariant `active-files-only` enforced by test |
| Version string missed in a non-obvious location (skill files, DOCS.md, STATE.json) | Medium | Grep for `4.4.0` across entire repo, update all active-file hits; behavioral invariant `version-consistency` covers the 4 canonical locations |
| SVG images not rendering on GitHub (relative path issues) | Low | Use relative paths from repo root (`branding/banner-github.svg`); verify with GitHub preview |
| Planning/research files contain `fishjojo1` references that should be preserved | Low | Contract explicitly scopes migration to active files only -- `.planning/research/` files are content references, not links, and will be included in migration since they are not in archive/milestones |

## Wave Breakdown (Preliminary)

- **Wave 1:** README restructure -- full rewrite of README.md with branded layout, SVG embeds, badge row, collapsible sections, tip callout, and arrow-prefix doc links. This is the largest single task.
- **Wave 2:** Reference migration and version bump -- grep-and-replace `fishjojo1/RAPID` to `pragnition/RAPID` across all active files, then bump `4.4.0` to `5.0.0` in all hardcoded locations. These two sub-tasks can be done together since they touch mostly different lines in the same files.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
