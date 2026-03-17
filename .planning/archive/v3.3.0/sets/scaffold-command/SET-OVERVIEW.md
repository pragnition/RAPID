# SET-OVERVIEW: scaffold-command

## Approach

This set introduces a `/scaffold` command that generates project-type-aware foundation layers for the target codebase. The core problem: after `/init` analyzes a project (via `context.cjs` detecting languages, frameworks, manifests), there is no automated way to generate a structured starting point -- developers jump straight into set planning with no shared foundation files. The scaffold command bridges this gap by producing boilerplate (directory structure, config files, entry points) tailored to the detected project type (webapp, API, library, CLI).

The implementation adds a new `src/lib/scaffold.cjs` library module containing template definitions and the generation engine, a new `src/commands/scaffold.cjs` CLI handler, a `skills/scaffold/SKILL.md` skill definition, and a corresponding agent role. The scaffold engine reads project type from the init-time context analysis (leveraging `detectCodebase()` in `context.cjs`) and applies the matching template set. Templates are embedded directly in `scaffold.cjs` rather than stored as external files, following the project's single-file-per-module convention.

A critical behavioral constraint is re-runnability: `/scaffold` must be additive-only, skipping files that already exist rather than overwriting user customizations. The scaffold output commits to main before any set branches are created, ensuring all sets share a common foundation. The roadmapper agent must also be updated to incorporate scaffold existence when planning set boundaries.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/scaffold.cjs` | Template engine: project type detection, template selection, file generation | New |
| `src/lib/scaffold.test.cjs` | Unit tests for scaffold logic (additive-only, type detection, template application) | New |
| `src/commands/scaffold.cjs` | CLI handler for `rapid-tools scaffold` command | New |
| `skills/scaffold/SKILL.md` | Skill definition for `/rapid:scaffold` user command | New |
| `src/modules/roles/role-scaffolder.md` | Agent role module for the scaffold agent (if needed) | New |
| `src/lib/context.cjs` | Existing codebase detection (languages, frameworks, manifests) | Existing -- consumed, not modified |
| `src/lib/tool-docs.cjs` | Tool documentation registry | Existing -- add scaffold command entry |
| `src/bin/rapid-tools.cjs` | CLI router | Existing -- add scaffold command dispatch |

## Integration Points

- **Exports:**
  - `scaffoldCommand` -- `handleScaffold(cwd, options?)` function that analyzes project type and generates foundation files, returning a `ScaffoldReport` with created/skipped file lists
  - `scaffoldTemplates` -- Embedded template definitions for webapp, API, library, and CLI project types

- **Imports:**
  - `initInfrastructure` (from `foundation-hardening`) -- Relies on project type detection infrastructure established during `/init`. Specifically, `context.cjs`'s `detectCodebase()` provides language, framework, and manifest data that determines which scaffold template to apply

- **Side Effects:**
  - Creates new files in the target project's working directory (committed to main branch)
  - The roadmapper agent's planning behavior changes to account for scaffold-generated files when defining set boundaries and file ownership

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Template outputs may conflict with files created by other sets if scaffold runs after set branches exist | High | Enforce behavioral invariant: scaffold must commit to main before any `start-set` creates worktrees. Add a pre-check that fails if active worktrees exist |
| `detectCodebase()` may not distinguish between project subtypes (e.g., Express API vs. Next.js webapp) with enough granularity for template selection | Medium | Start with broad categories (webapp, API, library, CLI) and use framework detection (`JS_FRAMEWORKS`, `PY_FRAMEWORKS` in `context.cjs`) to refine. Allow `--type` override flag |
| Re-runnability logic (skip-if-exists) may silently miss files that need updating when templates evolve across RAPID versions | Medium | Log all skipped files in the `ScaffoldReport` so the user sees what was not generated. Consider a `--force` flag for explicit overwrite |
| Roadmapper awareness requires modifying an existing agent role (`role-roadmapper.md`), which could affect planning quality for non-scaffolded projects | Low | Gate roadmapper scaffold awareness behind detection of `.planning/scaffold-report.json` or similar marker file |

## Wave Breakdown (Preliminary)

- **Wave 1:** Core scaffold engine -- `src/lib/scaffold.cjs` with template definitions for all four project types, additive-only file generation logic, `ScaffoldReport` return type, and comprehensive unit tests proving skip-if-exists behavior
- **Wave 2:** CLI and skill wiring -- `src/commands/scaffold.cjs` handler, `skills/scaffold/SKILL.md`, tool-docs registration, CLI router entry, agent role if needed
- **Wave 3:** Roadmapper integration and behavioral tests -- Update roadmapper role to incorporate scaffold awareness, add integration tests for the commit-to-main-before-sets invariant, end-to-end test of detect-then-scaffold pipeline

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
