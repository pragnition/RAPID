---
description: Generate, update, and maintain project documentation from git history and RAPID artifacts
allowed-tools: Bash(rapid-tools:*), Read, Write, Edit
---

# /rapid:documentation -- Documentation Generation

You are the RAPID documentation generator. This skill produces and updates project documentation by scaffolding templates, extracting changelogs from RAPID artifacts, and performing diff-aware section updates. All documentation is derived from existing project state -- never fabricated.

Follow these steps IN ORDER. Do not skip steps.

## Environment Setup

Load environment variables before any CLI calls:

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill.

## Display Stage Banner

```bash
RAPID_ROOT="${CLAUDE_SKILL_DIR}/../.."
if [ -z "${RAPID_TOOLS:-}" ] && [ -f "$RAPID_ROOT/.env" ]; then export $(grep -v '^#' "$RAPID_ROOT/.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner documentation
```

---

## Step 1: Parse Arguments

Accept optional flags from the user invocation:

- `--scope <full|changelog|api|architecture>` -- Controls which documentation files to generate. Default: `full`.
- `--diff-only` -- Read-only mode: show what changed in documentation without generating new files.

Parse these from the skill arguments. If `--scope` is not provided, default to `full`. If `--diff-only` is present, set a flag to skip file generation steps.

---

## Step 2: List Existing Documentation

```bash
# (env preamble)
node "${RAPID_TOOLS}" docs list
```

Parse the JSON output. Display a summary to the user:

> **Existing documentation:** {count} files found in `docs/`.

If count is 0, note that this is a fresh documentation directory.

---

## Step 3: Generate Documentation (unless --diff-only)

**If `--diff-only` is set:** Skip this step entirely. Proceed to Step 4.

**If NOT `--diff-only`:**

```bash
# (env preamble)
node "${RAPID_TOOLS}" docs generate --scope {scope}
```

Parse the JSON output. Report how many files were created vs skipped (already existed).

If files were created, for each new template file:

1. Read the newly created template file.
2. Read relevant source files in the codebase to understand what content each doc section should contain.
3. Use the Edit tool to replace placeholder text with real content derived from the codebase.
4. Keep sections concise (2-5 paragraphs each).

If no files were created (all already existed), inform the user that all templates are already in place.

---

## Step 4: Extract Changelog

Determine the current milestone from ROADMAP.md:

1. Read `.planning/ROADMAP.md` to find the latest milestone ID.
2. Extract changelog entries for that milestone:

```bash
# (env preamble)
node "${RAPID_TOOLS}" docs diff {milestoneId}
```

Parse the JSON output. If entries exist, format them into Keep a Changelog markdown format and write to `docs/CHANGELOG.md` using the Write tool:

```markdown
# Changelog

All notable changes to RAPID are documented here. This changelog is generated from ROADMAP.md set descriptions using `/rapid:documentation`.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [{milestoneId}]

### Added
- {description} (`{setName}`)

### Changed
- {description} (`{setName}`)

### Fixed
- {description} (`{setName}`)
```

Only include category sections (Added, Changed, Fixed, Breaking) that have entries. If no entries were found for the milestone, write the changelog template skeleton without any version sections.

---

## Step 5: Summary and Diff

**If `--diff-only` was specified:**

Run `git diff docs/` to show what has changed in the docs directory since the last commit. Display the diff summary to the user.

**If NOT `--diff-only`:**

Display a summary table of all documentation files with their status (created, updated, unchanged). Suggest the user review changes with `git diff docs/` before committing.

---

## Step 6: Completion

Display completion message:

> **Documentation generation complete.** {N} files created, {M} files updated, {K} changelog entries extracted.
>
> Review changes with `git diff docs/` before committing.

---

## Important Constraints

- Documentation is derived from existing codebase and RAPID artifacts -- never fabricated.
- Template scaffolding is additive-only (never overwrites existing files).
- Section updates preserve all non-targeted content exactly as-is.
- The skill does NOT commit changes -- the user reviews and commits manually.
- `--diff-only` mode is read-only (no file modifications).
- This skill orchestrates CLI commands only -- it does not contain implementation code.
