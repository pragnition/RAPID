# SET-OVERVIEW: docs-housekeeping

## Approach

This set performs a sweep of every version-stamped file in the repository, bumping all `6.0.0` / `v6.0.0` references to `6.1.0` / `v6.1.0` and refreshing documentation that has fallen out of date. The work is mechanical and broad rather than deep -- it touches many files but makes only small, well-understood edits in each one.

The strategy is: (1) bump the canonical version in `package.json`, (2) update all version strings in skill metadata, README, DOCS, and planning context, and (3) append a v6.1.0 section to the CHANGELOG summarizing the milestone's delivered sets. Because this set has no code exports or imports and no functional dependencies on other sets, it can be executed at any point during the milestone -- ideally last, so the CHANGELOG captures the full set of changes.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| package.json | Canonical version field (`"version": "6.0.0"`) | Existing -- bump to 6.1.0 |
| README.md | Badge image URL and changelog summary line | Existing -- update version refs |
| DOCS.md | `Version: 6.0.0` header and body reference | Existing -- update version refs |
| docs/CHANGELOG.md | Milestone release notes | Existing -- append v6.1.0 section |
| skills/help/SKILL.md | Workflow header and footer with `v6.0.0` | Existing -- update version refs |
| skills/status/SKILL.md | Dashboard description referencing `v6.0.0` | Existing -- update version refs |
| skills/install/SKILL.md | Version reference in install skill | Existing -- update version refs |
| technical_documentation.md | Technical docs with version references | Existing -- update version refs |
| .planning/context/CODEBASE.md | Codebase overview | Existing -- refresh if stale |
| .planning/context/ARCHITECTURE.md | Architecture docs | Existing -- refresh if stale |
| .planning/context/CONVENTIONS.md | Convention docs | Existing -- refresh if stale |
| .planning/context/STYLE_GUIDE.md | Style guide | Existing -- refresh if stale |

## Integration Points

- **Exports:** None -- this set produces no code, types, or functions consumed by other sets.
- **Imports:** None -- this set has no functional dependencies on other sets.
- **Side Effects:** After merge, all user-visible version strings will read `v6.1.0`. The CHANGELOG will contain a complete record of the milestone. Planning context files will reflect current project state.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Premature execution misses late-arriving sets from the CHANGELOG | Medium | Execute this set last (or at least after all other sets are merged) so the CHANGELOG captures everything |
| Merge conflicts on README.md or DOCS.md if other sets (readme-and-onboarding) edit the same lines | Medium | Coordinate merge order -- merge docs-housekeeping after readme-and-onboarding to pick up their content, then bump versions on top |
| Stale planning context files (.planning/context/) diverge from actual codebase after other sets land | Low | Refresh context files by re-reading the codebase state at merge time rather than during planning |
| Missing version references in files not yet identified | Low | Run a repo-wide grep for `6.0.0` and `v6.0.0` as the first execution step to catch any stragglers |

## Wave Breakdown (Preliminary)

- **Wave 1:** Version bump -- update `package.json`, README badge, DOCS header, skill SKILL.md files, and `technical_documentation.md` (all simple find-and-replace edits)
- **Wave 2:** CHANGELOG authoring -- append a v6.1.0 section to `docs/CHANGELOG.md` summarizing all sets delivered in the milestone
- **Wave 3:** Context refresh -- review and update `.planning/context/` files (CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md) to reflect current project state

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
