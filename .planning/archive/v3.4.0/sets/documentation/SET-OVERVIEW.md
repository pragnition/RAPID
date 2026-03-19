# SET-OVERVIEW: documentation

## Approach

The documentation set adds programmatic documentation generation capabilities to RAPID, enabling agents and users to produce, update, and maintain project documentation from git history and RAPID artifacts rather than manual authoring. Today, the `docs/` directory contains 9 hand-written guides that were produced during earlier milestones (v1.0 set-09, v2.0 set-24, v2.2 set-37), but there is no automated pipeline to regenerate or incrementally update them as the codebase evolves. This set fills that gap with four capabilities: template scaffolding, changelog extraction, diff-aware section updates, and a user-facing skill command that orchestrates the full workflow.

The implementation follows the established RAPID module pattern: a standalone library module (`src/lib/docs.cjs`) containing the core logic, a command handler (`src/commands/docs.cjs`) wiring it to the CLI router in `rapid-tools.cjs`, and a skill definition (`skills/documentation/SKILL.md`) exposing the `/rapid:documentation` command. The library module exports three public functions -- `scaffoldDocTemplates`, `extractChangelog`, and `updateDocSection` -- each independently testable and composable. The skill command orchestrates these functions through an agent that can reason about which documentation sections need updating based on `--scope` and `--diff-only` flags.

This set has zero imports from other sets, making it fully independent. It reads from git history (`git log`), existing `.planning/` artifacts (ROADMAP.md, set definitions, CONTRACT.json files), and the `docs/` directory. It writes to `docs/` and optionally to `.planning/` for changelog artifacts. The diff-aware update mechanism is the most technically interesting piece -- it must parse markdown into sections by heading, replace targeted sections, and preserve all unrelated content byte-for-byte.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/docs.cjs` | Core module: scaffoldDocTemplates, extractChangelog, updateDocSection | New |
| `src/lib/docs.test.cjs` | Unit tests for all three exported functions + behavioral invariants | New |
| `src/commands/docs.cjs` | CLI command handler for `docs generate`, `docs list`, `docs diff` | New |
| `src/bin/rapid-tools.cjs` | Register `docs` command case in CLI router switch | Existing (minor modify) |
| `skills/documentation/SKILL.md` | Skill definition for `/rapid:documentation` command | New |
| `docs/CHANGELOG.md` | Generated changelog output (created by extractChangelog) | New (generated) |

## Integration Points

- **Exports:**
  - `/rapid:documentation [--scope <full|changelog|api|architecture>] [--diff-only]` -- Skill command orchestrating agent-driven documentation generation
  - `scaffoldDocTemplates(cwd, scope)` -- Creates documentation template files for a given scope without overwriting existing ones; returns list of created paths
  - `extractChangelog(cwd, milestoneId)` -- Extracts structured changelog entries from git log and RAPID artifacts (ROADMAP.md, set definitions) for a milestone
  - `updateDocSection(docPath, sectionId, newContent)` -- Replaces a single markdown section by heading ID while preserving all other sections exactly as-is
  - `rapid-tools docs generate [--scope <s>] | docs list | docs diff <milestone>` -- CLI commands for documentation operations

- **Imports:** None. This set is fully independent with no dependencies on other sets.

- **Side Effects:**
  - `scaffoldDocTemplates` creates new files in `docs/` but never overwrites existing files (idempotent)
  - `extractChangelog` reads git history via `child_process.execSync` for `git log` commands
  - `updateDocSection` modifies existing markdown files on disk, but only the targeted section

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Markdown section parsing fails on non-standard heading formats or frontmatter | High | Use a robust heading regex (`/^#{1,6}\s/m`); handle frontmatter blocks (`---` delimiters) as opaque preamble; test with real docs from `docs/` directory |
| `git log` output format varies across git versions or platform locales | Medium | Use `--format` with explicit placeholders (e.g., `%H`, `%s`, `%an`) rather than relying on default formatting; pin `--no-color` flag |
| Template scaffolding accidentally overwrites user-edited documentation | High | Enforce `fs.existsSync` check before every write; behavioral invariant `templateIdempotent` tested explicitly; never call `writeFileSync` if file already exists |
| Changelog extraction fabricates entries not backed by git history | Medium | Only emit entries that have a corresponding git commit hash or ROADMAP.md line item; behavioral invariant `gitHistoryBased` enforced by test comparing output against raw `git log` |
| Diff-aware update corrupts non-targeted sections through off-by-one or encoding issues | High | Read file as UTF-8 buffer, split on heading boundaries, replace only matched section, rejoin with original line endings; round-trip test comparing untouched sections byte-for-byte |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Create `src/lib/docs.cjs` with `scaffoldDocTemplates()` for template creation and `updateDocSection()` for diff-aware markdown section replacement; unit tests for idempotency and section preservation behavioral invariants
- **Wave 2:** Changelog and CLI -- Implement `extractChangelog()` with git log parsing and ROADMAP.md cross-referencing; create `src/commands/docs.cjs` with `generate`, `list`, and `diff` subcommands; register `docs` case in `rapid-tools.cjs` router; unit tests for changelog extraction accuracy
- **Wave 3:** Skill and integration -- Create `skills/documentation/SKILL.md` for `/rapid:documentation` command; integrate scope filtering (`--scope`) and diff-only mode (`--diff-only`); end-to-end test with real git history

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
