# Roadmap: RAPID

## Milestones

- **v1.0 MVP** — 11 sets (shipped 2026-03-03)
- **v1.1 Polish** — 6 sets (shipped 2026-03-06)
- **v2.0 Mark II** — 9 sets (shipped 2026-03-09)
- **v2.1 Improvements & Fixes** — 10 sets (shipped 2026-03-10)
- **v2.2 Subagent Merger & Documentation** — 5 sets (shipped 2026-03-12)
- **v3.0 Refresh** — 8 sets (shipped 2026-03-13)
- **v3.1.0 Polish & Cleanup** — 4 sets (shipped 2026-03-13)
- **v3.2.0 General Fixes** — 5 sets (shipped 2026-03-14)
- **v3.3.0 Developer Experience** — 10 sets (shipped 2026-03-17)
- **v3.4.0 Agent Intelligence** — 6 sets (shipped 2026-03-18)
- **v3.5.0 Robustness & Fixes** — 4 sets (shipped 2026-03-19)
- **v3.6.0 Workflow & UX Polish** — 5 sets (shipped 2026-03-20)
- **v4.0.0 Mission Control** — 7 sets (shipped 2026-03-22)
- **v4.1.0 Polish & Fixes** — 8 sets (in progress)

## Completed Milestone Details

<details>
<summary>v1.0 MVP (11 sets) — shipped 2026-03-03</summary>

- [x] 01-plugin-infrastructure — Plugin shell, .claude-plugin manifest, skill/agent/hook scaffolding
- [x] 02-agent-framework — Agent definition format, role modules, prompt assembly
- [x] 03-state-management — Zod schemas, state machine, file locking, crash recovery
- [x] 04-worktree-isolation — Git worktree creation, registry, scoped CLAUDE.md generation
- [x] 05-interface-contracts — CONTRACT.json format, Ajv validation, contract test generation
- [x] 06-execution-engine — Execution context prep, prompt assembly, artifact verification
- [x] 07-merge-pipeline — 5-level conflict detection, 4-tier resolution cascade
- [x] 08-review-system — Adversarial review pipeline (hunter/devils-advocate/judge)
- [x] 09-documentation — README, DOCS.md, technical reference
- [x] 09.1-plugin-marketplace — Package for Claude Code plugin marketplace
- [x] 09.2-setup-script — Setup.sh and RAPID_TOOLS path configuration

</details>

<details>
<summary>v1.1 Polish (6 sets) — shipped 2026-03-06</summary>

- [x] 10-ask-user-question-gates — AskUserQuestion for all user interactions
- [x] 11-install-skill — Shell detection, auto-source config, RAPID_TOOLS verification
- [x] 12-error-recovery — Structured error recovery paths replacing bare STOP handling
- [x] 13-progress-indicators — Progress indicators during subagent operations
- [x] 14-ux-improvements — UI/UX polish across all skills
- [x] 15-polish-cleanup — Final cleanup and edge case fixes

</details>

<details>
<summary>v2.0 Mark II (9 sets) — shipped 2026-03-09</summary>

- [x] 16-sets-waves-jobs-hierarchy — Sets/Waves/Jobs replacing linear phase model
- [x] 17-hierarchical-state-machine — Zod schemas and validated transitions for hierarchy
- [x] 18-init-overhaul — Greenfield/brownfield detection and roadmap creation
- [x] 19-set-init-command — Per-set worktree+branch creation with set planning
- [x] 20-wave-job-planning — Wave Planner and Job Planner agents
- [x] 21-executor-agent — Executor with atomic commits
- [x] 22-review-module — UAT, unit tests, bug hunting pipeline
- [x] 23-merger-pipeline — 5-level detection, 4-tier resolution, bisection recovery
- [x] 24-mark-ii-documentation — Comprehensive docs for v2.0

</details>

<details>
<summary>v2.1 Improvements & Fixes (10 sets) — shipped 2026-03-10</summary>

- [x] 25-gsd-decontamination — Remove all GSD vestiges from source and runtime
- [x] 26-numeric-id-infrastructure — Numeric shorthand for set/wave references
- [x] 27-ux-branding-colors — Branding banners and color-coded agent display
- [x] 27.1-skill-to-agent-overhaul — Register role modules as Claude Code agents with build pipeline
- [x] 28-workflow-clarity — Streamlined ordering, wave context, next-step guidance
- [x] 29-discuss-optimization — Batched questioning (halved interactions)
- [x] 29.1-set-based-review — Review at set level with directory chunking
- [x] 30-plan-verifier — Agent for coverage, implementability, consistency validation
- [x] 31-wave-orchestration — Auto-chain with dependency-aware sequencing
- [x] 32-review-efficiency — Scoper delegation and concern-based scoping

</details>

<details>
<summary>v2.2 Subagent Merger & Documentation (5 sets) — shipped 2026-03-12</summary>

- [x] 33-merge-state-schema — MERGE-STATE schema and helper functions
- [x] 34-merge-subagent-delegation — Per-set rapid-set-merger subagents
- [x] 35-adaptive-conflict-resolution — Per-conflict agents for mid-confidence escalations
- [x] 36-readme-rewrite — Complete README reflecting all capabilities
- [x] 37-technical-documentation — Power user technical reference

</details>

<details>
<summary>v3.0 Refresh (8 sets) — shipped 2026-03-13</summary>

- [x] 38-state-machine-simplification — Set-level state only, discussing status, crash recovery
- [x] 39-tool-docs-core-module-refactor — Per-agent tool docs, XML prompt schema, core module consolidation
- [x] 40-cli-surface-utility-commands — CLI pruning, deprecation stubs, /status, /install
- [x] 41-build-pipeline-generated-agents — Hybrid build, SKIP_GENERATION, 5th researcher
- [x] 42-core-agent-rewrites — Hand-written planner, executor, merger, reviewer; orchestrator removed
- [x] 43-planning-discussion-skills — Rewritten init, start-set, discuss-set, plan-set
- [x] 44-execution-auxiliary-skills — execute-set, quick, add-set, new-version
- [x] 45-documentation-contracts-cleanup — Docs updated, dead code removed, contracts simplified

</details>

<details>
<summary>v3.1.0 Polish & Cleanup (4 sets) — shipped 2026-03-13</summary>

- [x] status-rename — Rename set statuses from present-tense to past-tense
- [x] command-cleanup — Remove deprecated CLI commands and stubs
- [x] install-version — Version-aware install with path configuration
- [x] parallel-waves — Parallel wave dispatch in execute-set

</details>

<details>
<summary>v3.2.0 General Fixes (5 sets) — shipped 2026-03-14</summary>

- [x] state-consistency — Fix skill-layer status literals to match state machine past-tense
- [x] command-audit — Remove references to non-existent rapid-tools.cjs commands
- [x] resolve-fix — Switch resolveSet() from filesystem to STATE.json-based resolution
- [x] ux-improvements — AskUserQuestion UX rewrite, banner colors to dark purple
- [x] review-after-merge — Add --post-merge flag to review skill

</details>

<details>
<summary>v3.3.0 Developer Experience (10 sets) — shipped 2026-03-17</summary>

- [x] foundation-hardening — Core infrastructure hardening
- [x] data-integrity — Data integrity improvements
- [x] cli-restructuring — CLI command restructuring
- [x] structural-cleanup — Structural code cleanup
- [x] bug-fixes — Bug fixes
- [x] solo-mode — Solo mode (no worktree) execution
- [x] review-pipeline — Review pipeline improvements
- [x] version-migration — Version migration tooling
- [x] scaffold-command — Project scaffold command
- [x] context-optimization — Context window optimization

</details>

<details>
<summary>v3.4.0 Agent Intelligence (6 sets) — shipped 2026-03-18</summary>

- [x] memory-system — Append-only JSONL decision log, corrections log, cross-milestone preferences
- [x] quick-and-addset — Persistent /quick task logging, add-set with state CLI backing
- [x] hooks-system — Node.js hook system for state verification after agent tasks
- [x] code-quality — Quality profile system, enhanced prepareSetContext(), quality gates
- [x] ui-contracts — Per-set UI-CONTRACT.json schema with Ajv validation
- [x] documentation — Agent-driven docs generation, changelog extraction, /rapid:documentation skill

</details>

<details>
<summary>v3.5.0 Robustness & Fixes (4 sets) — shipped 2026-03-19</summary>

- [x] state-execution — Execute-to-complete state transition fix, merge untracked file handling, /rapid:bug-fix skill
- [x] agent-prompts — CLI command reference sweep across 26 agents and 24 skills, discuss-set option limit fix
- [x] init-config — DEFINITION.md generation, graceful loadSet(), solo mode config, worktree package management
- [x] planning-refinement — UI/UX emphasis in templates, review file discovery auto-detection

</details>

<details>
<summary>v3.6.0 Workflow & UX Polish (5 sets) — shipped 2026-03-20</summary>

- [x] dag-and-state-fixes — DAG.json lifecycle fixes, path consolidation, ENOENT handling
- [x] solo-mode — Solo mode lifecycle completion, auto-transition complete->merged
- [x] review-cycle-confirmation — AskUserQuestion gates between bug-hunt review cycles
- [x] init-flow-redesign — Structured AskUserQuestion init flow, granularity preference
- [x] branding-system — Optional /rapid:branding skill, BRANDING.md artifact

</details>

## Current Milestone: v4.0.0 Mission Control (6 sets)

A greenfield web dashboard companion to the RAPID CLI plugin. Provides knowledge management, project visualization, and task tracking through a locally-hosted web service at `http://127.0.0.1:8998`. Purely optional (gated by `RAPID_WEB=true`), read-only in v4.0.

**Stack:** Python 3.12+ (FastAPI + SQLModel + SQLite) backend, React 19 + Vite 8 frontend SPA, Tailwind CSS 4.2 with Everforest dark theme.

**Data Model:** Hybrid storage -- SQLite at `~/.rapid/rapid.db` for fast queries + `.rapid-web/` directory per project for portability and version control.

### Set 1: Service Infrastructure (`service-infrastructure`) [Large]
FastAPI application shell, SQLite database with WAL mode and Alembic migrations, SyncEngine for bidirectional SQLite <-> .rapid-web/ sync, systemd/launchd service templates, structured JSON logging, health endpoints, security defaults (127.0.0.1, CORS).

### Set 2: Project Registry & Data Pipeline (`project-registry`) [Medium-Large]
Project CRUD endpoints with pagination, FileWatcherService for STATE.json/REGISTRY.json changes, Project SQLModel, .rapid-web/ sync layer. Depends on service-infrastructure.

### Set 3: Frontend Shell & Theme (`frontend-shell`) [Large]
React 19 + Vite 8 + TypeScript SPA skeleton, Everforest dark/light theme with CSS custom properties, vim-style keyboard navigation (hjkl, /, :, ?, Esc, Tab), sidebar layout (3 states), TanStack Query + Zustand stores, command palette, typed API client.

### Set 4: Read-Only Views (`read-only-views`) [Large]
Four dashboard views: Project State View (STATE.json), Worktree Tracking (REGISTRY.json), Knowledge Graph (Cytoscape.js + DAG.json), Codebase Mapping (tree-sitter). All GET-only endpoints + React components. Depends on project-registry, frontend-shell.

### Set 5: Interactive Features (`interactive-features`) [Large]
Kanban Board (dnd-kit drag-drop, CRUD) and Markdown Note Editor (CodeMirror 6, vim mode, autosave). Both project-scoped with SQLite tables and .rapid-web/ sync. Depends on project-registry, frontend-shell.

### Set 6: CLI Integration (`cli-integration`) [Medium]
Non-blocking web-client.cjs helper, /install web service setup, /init auto-registration, /register-web for legacy projects, doctor health checks. Depends on service-infrastructure, project-registry.

### Set 7: Web Install Bugfix (`web-install-bugfix`) [Small]
Fix 5 web installation issues: pyproject.toml package discovery, Alembic migration path resolution, backend static file serving + SPA fallback, frontend build integration in install workflow, TypeScript build errors. Depends on service-infrastructure, frontend-shell.

### Dependency Graph
```
service-infrastructure   (independent — foundational)
frontend-shell           (independent — no backend needed)
project-registry        --> service-infrastructure
cli-integration         --> service-infrastructure, project-registry
read-only-views         --> project-registry, frontend-shell
interactive-features    --> project-registry, frontend-shell
```

### DAG Waves
- **Wave 1:** service-infrastructure + frontend-shell (parallel)
- **Wave 2:** project-registry + cli-integration (parallel, depend on Wave 1)
- **Wave 3:** read-only-views + interactive-features (parallel, depend on Waves 1+2)

Historical phase details archived to `.planning/archive/`.
