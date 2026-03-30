# SET-OVERVIEW: community-infra

## Approach

This set creates all community-facing GitHub infrastructure needed before RAPID goes public. The deliverables are entirely static files -- Markdown guides, YAML issue forms, and package.json metadata -- with no runtime code changes. Every file is new; nothing is being modified except adding two fields to `package.json`.

The work splits naturally into three concerns: contribution guidance (CONTRIBUTING.md), GitHub automation (issue templates, PR template, template chooser config), and repository metadata (package.json fields). These have no internal dependencies and can be authored in any order. The CONTRIBUTING.md must match RAPID's existing terse, direct documentation style -- no corporate boilerplate, no walls of text.

The downstream `readme-migration` set imports `CONTRIBUTING.md` by path for its doc links section. That is the only cross-set dependency, and it only requires the file to exist at the expected path.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| CONTRIBUTING.md | Community contribution guide (dev install, bugs, features, code style) | New |
| .github/ISSUE_TEMPLATE/bug_report.yml | YAML issue form for structured bug reports | New |
| .github/ISSUE_TEMPLATE/feature_request.yml | YAML issue form for structured feature requests | New |
| .github/ISSUE_TEMPLATE/config.yml | Template chooser configuration for GitHub issue picker | New |
| .github/PULL_REQUEST_TEMPLATE.md | PR template with what/why/testing checklist | New |
| package.json | Add `repository` and `homepage` fields (existing file, two fields added) | Existing |

## Integration Points

- **Exports:**
  - `CONTRIBUTING.md` -- consumed by `readme-migration` for arrow-prefix doc links section
  - `bug_report.yml`, `feature_request.yml`, `config.yml` -- GitHub renders these as the issue creation UI
  - `PULL_REQUEST_TEMPLATE.md` -- GitHub auto-populates PR descriptions from this
  - `package.json` repository/homepage fields -- npm registry and GitHub sidebar use these

- **Imports:** None. This set has zero dependencies on other sets.

- **Side Effects:**
  - GitHub will immediately start rendering YAML issue forms on the public repo's issue tracker
  - The PR template auto-fills every new pull request; contributors see it without opt-in

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| YAML boolean parsing -- bare `yes`/`no` silently become `true`/`false` | Medium | Quote all boolean values as strings per CONTRACT behavioral invariant `yaml-boolean-safety` |
| YAML issue forms only work on public repos | Low | Forms degrade to plain Markdown templates on private repos; no action needed since RAPID is going public |
| CONTRIBUTING.md tone drift -- over-explaining or adding boilerplate | Low | Keep sections to 3-5 sentences max; reference existing CONVENTIONS.md and STYLE_GUIDE.md rather than duplicating their content |
| package.json merge conflict with other sets | Low | Only `readme-migration` also touches package.json (for version bump), and it depends on this set finishing first |

## Wave Breakdown (Preliminary)

- **Wave 1:** All files can be created in parallel -- CONTRIBUTING.md, all four `.github/` template files, and package.json field additions. There are no internal sequencing constraints since every deliverable is an independent file.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan. Given the small scope and lack of internal dependencies, this set may collapse to a single wave.
