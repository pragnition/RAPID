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
- **v4.2.0 Discuss & Audit** — 3 sets (in progress)

## Active Milestone: v4.2.0 — Discuss & Audit

### Set 1: path-resolution-fix
**Branch:** `rapid/path-resolution-fix` | **Size:** S
Fix `require('${RAPID_TOOLS}/../lib/...')` path resolution in `skills/init/SKILL.md` and `skills/register-web/SKILL.md` where Node.js treats the `.cjs` filename as a directory component.

### Set 2: discuss-ux
**Branch:** `rapid/discuss-ux` | **Size:** M
Two coordinated UX improvements to `skills/discuss-set/SKILL.md`: (1) Consolidate gray area prompts into fewer multiSelect prompts (max 8 checkboxes each), (2) Replace markdown pros/cons table with structured list format. Includes coordinated test suite updates.

### Set 3: audit-version
**Branch:** `rapid/audit-version` | **Size:** L
New `/rapid:audit-version` command that reads milestone artifacts, cross-references requirements vs. delivery, produces `.planning/v{version}-AUDIT.md` gap report, and offers remediation via `/rapid:add-set`. Read-only — never mutates STATE.json.

**Dependency graph:** All 3 sets are fully independent.

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

Historical phase details archived to `.planning/archive/`.
