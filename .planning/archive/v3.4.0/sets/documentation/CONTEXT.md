# CONTEXT: documentation

**Set:** documentation
**Generated:** 2026-03-18
**Mode:** interactive

<domain>
## Set Boundary
Agent-driven documentation generation for end-of-version use. Adds `src/lib/docs.cjs` with three core functions (scaffoldDocTemplates, extractChangelog, updateDocSection), a CLI command handler (`src/commands/docs.cjs`) with `generate`, `list`, and `diff` subcommands, and a `/rapid:documentation` skill command. Zero imports from other sets — fully independent. Reads from git history, `.planning/` artifacts (ROADMAP.md, set definitions, CONTRACT.json), and existing `docs/` directory. Writes to `docs/` and optionally `.planning/` for changelog artifacts.
</domain>

<decisions>
## Implementation Decisions

### Changelog Format & Granularity

- Per-set granularity: one changelog entry per set using its description from ROADMAP.md
- Group entries by category following Keep a Changelog convention (### Added, ### Changed, ### Fixed, ### Breaking)
- Set name only in entries — no commit hashes, dates, or author info

### Doc Template Structure

- Mirror the existing 9 docs/ files (setup, planning, execution, agents, etc.) — maintain continuity
- Templates use heading skeleton format: pre-filled section headings with brief placeholder text describing what goes in each section

### Diff-Aware Update Scope

- Heading-based section identification: match by markdown heading text (## Setup, ### Commands, etc.)
- When target section is not found: append the new section at the end of the document with its heading

### Skill Orchestration Model

- Single-pass generation: generate all docs in one pass, commit results. User reviews via git diff after
- --diff-only mode compares against previous milestone (shows what changed in this release cycle)

### Claude's Discretion

- None — all areas discussed with user
</decisions>

<specifics>
## Specific Ideas
- No specific additional ideas raised during discussion
</specifics>

<code_context>
## Existing Code Insights

- **Module pattern:** All lib modules use `'use strict'` CJS with `module.exports` at bottom. See `src/lib/quality.cjs` for reference pattern.
- **Command pattern:** Command handlers export a single `handle*` function registered in `rapid-tools.cjs` switch. See `src/commands/scaffold.cjs` for reference.
- **CLI router:** `src/bin/rapid-tools.cjs` has a top-level require + switch dispatch. New `docs` command needs import + case added.
- **Existing docs:** 9 markdown files in `docs/` (setup, planning, execution, agents, configuration, merge-and-cleanup, review, state-machines, troubleshooting).
- **Test pattern:** Co-located `.test.cjs` files using Node.js built-in `node:test` and `node:assert`.
- **Git interaction:** Use `child_process.execSync` with `--format` and `--no-color` flags for git log parsing (as noted in SET-OVERVIEW risks).
</code_context>

<deferred>
## Deferred Ideas
- No deferred ideas
</deferred>
