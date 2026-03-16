# CONTEXT: scaffold-command

**Set:** scaffold-command
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
Introduces a `/scaffold` command that generates project-type-aware foundation layers for target codebases. After `/init` detects languages, frameworks, and manifests via `detectCodebase()`, scaffold maps those to a project archetype (webapp, API, library, CLI) and generates language-specific starter files — directory structure, entry points, and tooling configs. The scaffold engine is additive-only (skip-if-exists for brownfield projects), commits to main before set branches, and produces a `scaffold-report.json` consumed by the roadmapper for baseline-aware planning. New files: `src/lib/scaffold.cjs` (engine + templates), `src/commands/scaffold.cjs` (CLI handler), `skills/scaffold/SKILL.md`, plus CLI router wiring in `rapid-tools.cjs`.
</domain>

<decisions>
## Implementation Decisions

### Project Type Taxonomy
- Support 4 project types: webapp, API, library, CLI
- When `detectCodebase()` results are ambiguous (e.g., Next.js = webapp + API), prompt user via AskUserQuestion to select the dominant type
- No monorepo type — pick the dominant type per project
- No `--type` override flag initially; user prompt handles ambiguity

### Template Content Scope
- Templates are language-specific: JS webapp differs from Python webapp
- Full language-aware starters including tooling (test config, linting, basic CI)
- Brownfield projects use skip-if-exists: generate non-conflicting files, skip files that already exist
- All skipped files logged in ScaffoldReport so user sees what was not generated

### Scaffold Trigger & Workflow
- Scaffold is a separate manual command (`/rapid:scaffold`), not auto-triggered by init
- `start-set` issues a soft warning if scaffold hasn't run, but does not block
- Scaffold is fully optional — projects can skip it entirely
- When run, scaffold commits to main branch

### Roadmapper Integration
- Deep baseline integration: roadmapper reads `scaffold-report.json` to know what files exist
- Scaffolded files treated as shared baseline, excluded from individual set file ownership
- Contracts can reference scaffolded files as "provided by scaffold" in their imports
- Roadmapper scaffold awareness gated behind detection of `scaffold-report.json` marker file

### Claude's Discretion
- None — all 4 areas discussed with user
</decisions>

<specifics>
## Specific Ideas
- ScaffoldReport should list created files, skipped files (with reason), and detected project type
- scaffold-report.json persisted in `.planning/` for roadmapper consumption
- Templates embedded directly in scaffold.cjs following single-file-per-module convention
- Re-runnability: running scaffold again skips existing files, only adds new ones
</specifics>

<code_context>
## Existing Code Insights
- `detectCodebase()` in `src/lib/context.cjs` returns `{ hasSourceCode, languages[], frameworks[], configFiles[], sourceStats }` — this is the input signal for type classification
- JS_FRAMEWORKS includes react, express, next, vue, angular, fastify, koa, nest; PY_FRAMEWORKS includes django, flask, fastapi — these map to archetype selection
- CLI router in `src/bin/rapid-tools.cjs` uses handler-per-command pattern with `src/commands/*.cjs` modules
- Commands not needing project root (prereqs, init, context, display) are handled before `findProjectRoot()` — scaffold likely needs project root
- Existing skill files in `skills/*/SKILL.md` follow established SKILL.md format
- `CliError` and `exitWithError` from `src/lib/errors.cjs` used for error handling in command handlers
</code_context>

<deferred>
## Deferred Ideas
- `--type <type>` override flag for forcing scaffold type without detection
- `--force` flag for overwriting existing files (version upgrade scenario)
- Monorepo support with per-package scaffolding
- Template versioning for cross-RAPID-version template updates
</deferred>
