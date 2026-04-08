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
- **v4.1.0 Polish & Fixes** — 8 sets (shipped 2026-03-23)
- **v4.2.1 Discuss & Audit** — 3 sets (shipped 2026-03-24)
- **v4.3.0 Reliability & State** — 4 sets (shipped 2026-03-25)
- **v4.4.0 Polish & Documentation** — 3 sets (shipped 2026-03-26)
- **v4.5 Developer Experience II** — 4 sets (shipped 2026-03-26)
- **v5.0 OSS Presentation** — 5 sets (shipped 2026-03-31)
- **v6.0.0 Scale & Quality** — 7 sets (shipped 2026-04-06)
- **v6.1.0 UX & Onboarding** — 7 sets (shipped 2026-04-07)
- **v6.2.0 DX Refinements** — 5 sets (in progress)

## Active Milestone: v6.2.0 — DX Refinements

Three features plus documentation/housekeeping targeting branding webserver improvements, init flow integration, and update staleness detection.

### Set 1: branding-overhaul — Branding Webserver Overhaul
**Branch:** `set/branding-overhaul` | **Dependencies:** none
Replace manual-refresh webserver with SSE-based auto-reload, add artifact registry system (branding-artifacts.cjs + artifacts.json manifest), redesign hub page to artifact card gallery, add CRUD API, extend branding skill to generate logos, wireframes, and guidelines.

### Set 2: init-branding-integration — Init Branding Integration
**Branch:** `set/init-branding-integration` | **Dependencies:** branding-overhaul (soft)
Insert optional branding step at init step 4B.5. Single opt-in AskUserQuestion with prominent Skip. Condensed inline interview (2-3 questions max). No server during init. Context-aware framing.

### Set 3: update-reminder — Update Reminder
**Branch:** `set/update-reminder` | **Dependencies:** none
Record install timestamp in .rapid-install-meta.json, add staleness check to version.cjs, CLI subcommand, non-blocking reminder banners in status/install skills. TTY-only, suppressible, NO_COLOR aware.

### Set 4: docs-and-housekeeping — Documentation & Housekeeping
**Branch:** `set/docs-and-housekeeping` | **Dependencies:** branding-overhaul, init-branding-integration, update-reminder
Regenerate .planning/context/ files, bump version strings v6.1.0→v6.2.0, pin Zod to exact 3.25.76, update .env.example, finalize ROADMAP.md.

### Set 5: branding-crud-completion — Branding CRUD Completion (audit remediation)
**Branch:** `set/branding-crud-completion` | **Dependencies:** none
Resolve the v6.2.0 audit gap on branding-overhaul's `/_artifacts` API: it ships POST/GET/DELETE but no update path, and CONTEXT.md advertises an `artifact-updated` SSE event no wave actually emits. Decide between (a) adding PUT/PATCH + the SSE event for true CRUD, or (b) renaming the API to CRD across docs and removing the unused event type. Update branding-server tests and CONTEXT.md to match the chosen surface.

**Dependency graph:** `{branding-overhaul, update-reminder}` (parallel) → `{init-branding-integration}` (soft dep on 1) | `{docs-and-housekeeping}` (after all 3) | `{branding-crud-completion}` (audit remediation, independent)

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

<details>
<summary>v4.0.0 Mission Control (7 sets) — shipped 2026-03-22</summary>

- [x] service-infrastructure — FastAPI shell, SQLite WAL, Alembic migrations, SyncEngine, systemd/launchd templates
- [x] project-registry — Project CRUD, FileWatcherService, .rapid-web/ sync layer
- [x] frontend-shell — React 19 + Vite 8 SPA, Everforest theme, vim navigation, command palette
- [x] read-only-views — State, Worktree, Knowledge Graph, Codebase views
- [x] interactive-features — Kanban Board, Markdown Note Editor
- [x] cli-integration — Web client helper, /register-web, doctor checks
- [x] web-install-bugfix — pyproject.toml, Alembic paths, SPA fallback, TS build fixes

</details>

<details>
<summary>v4.1.0 Polish & Fixes (8 sets) — shipped 2026-03-23</summary>

- [x] hygiene-sweep — Hygiene Sweep
- [x] init-criteria — Init Fixes & Encoded Criteria
- [x] review-cli-fix — Review CLI Fix
- [x] dag-readdition — DAG Re-addition
- [x] discuss-overhaul — Discuss Phase Overhaul
- [x] unit-test-improvements — Unit Test Improvements
- [x] branding-refocus — Branding Refocus
- [x] new-version-comprehensive — New-Version Comprehensiveness

</details>

<details>
<summary>v4.5 Developer Experience II (4 sets) — shipped 2026-03-26</summary>

- [x] uat-workflow — Human-Only UAT Workflow
- [x] bugfix-uat — Bug-Fix --uat Flag
- [x] branding-server — Branding Preview Server
- [x] generous-planning — Generous Set Planning

</details>

<details>
<summary>v5.0 OSS Presentation (5 sets) — shipped 2026-03-31</summary>

- [x] branding-assets — Branding Assets (SVG banner, lifecycle flow, agent dispatch, social preview)
- [x] community-infra — Community Infrastructure (CONTRIBUTING.md, issue templates, PR template)
- [x] readme-migration — README Overhaul & Reference Migration (pragnition/RAPID, version bump)
- [x] readme-polish — README Polish (concise, scannable, enlarged SVGs)
- [x] docs-update — Documentation Update (DOCS.md and technical_documentation.md)

</details>

<details>
<summary>v6.0.0 Scale & Quality (7 sets) — shipped 2026-04-06</summary>

- [x] bug-fixes-foundation — Bug Fixes & Foundation
- [x] dag-central-grouping — DAG Central Concept & Set Grouping
- [x] init-enhancements — Init Enhancements
- [x] scaffold-overhaul — Scaffold Overhaul
- [x] agent-namespace-enforcement — Agent Namespace Enforcement
- [x] docs-version-bump — Documentation & Version Bump
- [x] fix-stub-cleanup — Audit Gap Closure

</details>

<details>
<summary>v6.1.0 UX & Onboarding (7 sets) — shipped 2026-04-07</summary>

- [x] clear-guidance-and-display — Clear Guidance & Display Footer
- [x] audit-handoff — Audit-to-Set Handoff Mechanism
- [x] readme-and-onboarding — Beginner-Friendly README & Onboarding
- [x] ux-audit — General UX Audit & Polish
- [x] backlog-system — Backlog Capture & Audit Integration
- [x] docs-housekeeping — Documentation & Housekeeping
- [x] ux-first-run — First-Run UX Polish

</details>

Historical phase details archived to `.planning/archive/`.
