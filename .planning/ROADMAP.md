# Roadmap: RAPID

## Milestones

- ✅ **v1.0 MVP** - Phases 1-9 (shipped 2026-03-03)
- ✅ **v1.1 Polish** - Phases 10-15 (shipped 2026-03-06)
- ✅ **v2.0 Mark II** - Phases 16-24 (shipped 2026-03-09)
- ✅ **v2.1 Improvements & Fixes** - Phases 25-32 (shipped 2026-03-10)
- ✅ **v2.2 Subagent Merger & Documentation** - Phases 33-37 (shipped 2026-03-12)
- 🚧 **v3.0 Refresh** - Phases 38-45 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (38, 39, 40): Planned milestone work
- Decimal phases (38.1, 38.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v2.1 Improvements & Fixes (Phases 25-32) - SHIPPED 2026-03-10</summary>

- [x] **Phase 25: GSD Decontamination** - Remove all GSD vestiges from source, tests, and runtime agent identities (completed 2026-03-09)
- [x] **Phase 26: Numeric ID Infrastructure** - Enable numeric shorthand for set and wave references across all skills (completed 2026-03-09)
- [x] **Phase 27: UX Branding & Colors** - Add RAPID branding banners and color-coded agent type display (completed 2026-03-09)
- [x] **Phase 27.1: Skill-to-Agent Overhaul** - Register all role modules as Claude Code agents with build pipeline (completed 2026-03-09)
- [x] **Phase 28: Workflow Clarity** - Streamline workflow ordering, wave context, next-step guidance, and job sizing (completed 2026-03-09)
- [x] **Phase 29: Discuss Phase Optimization** - Batch related questions to halve user interactions during discuss (completed 2026-03-10)
- [x] **Phase 29.1: Set-Based Review** - Review pipeline runs once at set level with directory chunking (completed 2026-03-10)
- [x] **Phase 30: Plan Verifier** - New agent that validates job plans for coverage, implementability, and consistency (completed 2026-03-10)
- [x] **Phase 31: Wave Orchestration** - Auto-chain wave planning and execution with dependency-aware sequencing (completed 2026-03-10)
- [x] **Phase 32: Review Efficiency** - Scoper agent delegates focused context to review agents, reducing token waste (completed 2026-03-10)

</details>

<details>
<summary>v2.2 Subagent Merger & Documentation (Phases 33-37) - SHIPPED 2026-03-12</summary>

- [x] **Phase 33: Merge State Schema & Infrastructure** - Extend MERGE-STATE schema and build helper functions for subagent delegation (completed 2026-03-10)
- [x] **Phase 34: Core Merge Subagent Delegation** - Restructure merge SKILL.md to dispatch per-set rapid-set-merger subagents (completed 2026-03-10)
- [x] **Phase 35: Adaptive Conflict Resolution** - Orchestrator-mediated per-conflict agents for mid-confidence escalations (completed 2026-03-11)
- [x] **Phase 36: README Rewrite** - Complete README.md rewrite reflecting all capabilities through v2.2 (completed 2026-03-11)
- [x] **Phase 37: Technical Documentation** - Create technical_documentation.md as power user reference (completed 2026-03-11)

</details>

### v3.0 Refresh (In Progress)

- [x] **Phase 38: State Machine Simplification** - Collapse state hierarchy to set-level, add discussing status, preserve crash recovery (completed 2026-03-12)
- [x] **Phase 39: Tool Docs Registry & Core Module Refactor** - Build per-agent tool documentation system and XML prompt schema (completed 2026-03-12)
- [x] **Phase 40: CLI Surface & Utility Commands** - Prune rapid-tools.cjs, add deprecation stubs, implement /status and /install (completed 2026-03-12)
- [x] **Phase 41: Build Pipeline & Generated Agents** - Hybrid build with SKIP_GENERATION, tool doc injection, 5th researcher (completed 2026-03-12)
- [x] **Phase 42: Core Agent Rewrites** - Hand-write planner, executor, merger, reviewer agents; remove orchestrator (completed 2026-03-12)
- [ ] **Phase 43: Planning & Discussion Skills** - Rewrite init, start-set, discuss-set, plan-set with collapsed planning pipeline
- [ ] **Phase 44: Execution & Auxiliary Skills** - Rewrite execute-set, implement quick, add-set, new-version
- [ ] **Phase 45: Documentation, Contracts & Cleanup** - Update docs, remove dead code, simplify contracts

## Phase Details

### Phase 38: State Machine Simplification
**Goal**: State machine operates at set-level only -- no wave/job state tracking -- while preserving crash recovery and atomic writes
**Depends on**: Phase 37 (last v2.2 phase)
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04, STATE-05
**Success Criteria** (what must be TRUE):
  1. WaveState and JobState schemas are removed from state-schemas.cjs, and STATE.json validates with only project > milestone > set hierarchy
  2. SetStatus enum includes 'discussing' and the state machine accepts transitions into and out of it
  3. After a simulated crash (process kill mid-write), detectCorruption identifies the bad state and recoverFromGit restores the last good commit
  4. A fresh session with only STATE.json and disk artifacts present can bootstrap any command without prior conversation context
  5. Every state mutation follows the transaction pattern: read STATE.json, validate preconditions, perform work, write STATE.json atomically via temp-file-then-rename
  6. No state transition rejects based on another set's status -- sets are fully independent and can be started/executed in any order
**Plans**: 2 plans
Plans:
- [ ] 38-01-PLAN.md — Rewrite schemas, transitions, and lock (wave 1)
- [ ] 38-02-PLAN.md — Rewrite state machine, tests, and cleanup (wave 2)
**Research flag**: Skip research-phase (well-understood refactoring with clear test coverage)

### Phase 39: Tool Docs Registry & Core Module Refactor
**Goal**: Every agent prompt contains only the CLI commands it needs, rendered in a validated XML structure with compact YAML tool blocks
**Depends on**: Phase 38 (state schema must be finalized before agents reference it)
**Requirements**: AGENT-01, AGENT-02, AGENT-05
**Success Criteria** (what must be TRUE):
  1. src/lib/tool-docs.cjs exports getToolDocsForRole() that returns a compact YAML block of CLI commands for a given role, and each block is under 1000 tokens
  2. An XML schema document exists defining all allowed tags and nesting rules for agent prompts, and at least one agent prompt validates against it
  3. Core modules are consolidated: core-state-access.md and core-context-loading.md are retired, their guidance absorbed into core-identity.md and a new core-conventions.md
**Plans**: 4 plans
Plans:
- [ ] 39-01-PLAN.md — Tool docs registry module with TDD (wave 1)
- [ ] 39-02-PLAN.md — Core module consolidation and XML schema (wave 1)
- [ ] 39-03-PLAN.md — Build pipeline integration and executor proof-of-concept (wave 2)
- [ ] 39-04-PLAN.md — Gap closure: fix XML tag assembly order (wave 1)
**Research flag**: Skip research-phase (validate compact format with one real agent before scaling)

### Phase 40: CLI Surface & Utility Commands
**Goal**: rapid-tools.cjs reflects the v3.0 7+4 command structure, removed commands produce migration messages, and utility commands (/status, /install, /review, /merge) work
**Depends on**: Phase 39 (tool docs must reflect accurate CLI surface)
**Requirements**: CMD-06, CMD-07, CMD-08, CMD-12, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Running a removed v2 command (e.g., /rapid:wave-plan) produces a deprecation message telling the user which v3.0 command replaces it
  2. /rapid:status displays a project dashboard showing all sets, their statuses, active worktrees, and suggests the next action
  3. /rapid:review and /rapid:merge work with the simplified state schema (set-level status checks instead of wave/job traversal)
  4. /rapid:install validates the plugin installation and updates plugin files
  5. The help text and command registry in rapid-tools.cjs lists exactly 7 core + 4 auxiliary commands
**Plans**: 4 plans
Plans:
- [ ] 40-01-PLAN.md — Skill directory restructuring, deprecation stubs, and help rewrite (wave 1)
- [ ] 40-02-PLAN.md — Status dashboard rewrite and install update (wave 1)
- [ ] 40-03-PLAN.md — Review and merge state handling updates (wave 2)
- [ ] 40-04-PLAN.md — Gap closure: register v3 stage names in display.cjs (wave 1)
**Research flag**: Skip research-phase (code removal with deprecation stubs)

### Phase 41: Build Pipeline & Generated Agents
**Goal**: handleBuildAgents() produces generated agents with embedded tool docs and XML structure, skips hand-written core agents, and includes the 5th researcher
**Depends on**: Phase 40 (CLI surface must be finalized so tool docs are accurate)
**Requirements**: AGENT-03, AGENT-04, AGENT-06
**Success Criteria** (what must be TRUE):
  1. Running build-agents skips the 5 core agents (orchestrator, planner, executor, merger, reviewer) listed in SKIP_GENERATION and does not overwrite their files
  2. Each generated agent file contains a `<tools>` XML section with role-specific CLI commands injected from tool-docs.cjs
  3. A 5th researcher agent (Domain/UX) exists in the init research pipeline and produces domain-specific findings during /init
  4. Retired role modules (wave-analyzer, wave-researcher, wave-planner, job-planner, job-executor) are removed and no longer referenced
**Plans**: 2 plans
Plans:
- [ ] 41-01-PLAN.md — SKIP_GENERATION build pipeline, v2 role pruning, and test updates (wave 1)
- [ ] 41-02-PLAN.md — Research-ux role, init pipeline update, synthesizer update (wave 2)
**Research flag**: Skip research-phase (extends established build-agents pipeline)

### Phase 42: Core Agent Rewrites
**Goal**: The 4 hand-written core agents (planner, executor, merger, reviewer) define the v3.0 user experience with embedded tool docs, XML structure, and correct state transitions. Orchestrator removed -- skills are their own orchestrators.
**Depends on**: Phase 41 (SKIP_GENERATION must be in place before hand-written files are created; build pipeline must not overwrite them)
**Requirements**: AGENT-04
**Success Criteria** (what must be TRUE):
  1. agents/rapid-planner.md, rapid-executor.md, rapid-merger.md, and rapid-reviewer.md exist as hand-written files (not build-generated) and are each under 12KB
  2. Each core agent prompt embeds its own tool docs directly (not template-injected) and uses the XML section structure from the schema document
  3. The merger agent preserves the semantic conflict detection protocol and RAPID:RETURN parsing contracts that the merge pipeline depends on
  4. Each core agent is classified as GUIDED with appropriate edge-case escape hatches
  5. All core agents explicitly treat sets as independent -- no agent refuses to work on a set because another set is incomplete or in a different state
  6. Orchestrator agent and role module removed from all registries (SKIP_GENERATION, ROLE_CORE_MAP, ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_TOOL_MAP)
  7. core-identity.md updated with v3 workflow (init > start-set > discuss > plan-set > execute-set > review > merge) and independent sets model
**Plans**: 4 plans
Plans:
- [ ] 42-01-PLAN.md — Orchestrator removal, test updates, and core-identity.md v3 rewrite (wave 1)
- [ ] 42-02-PLAN.md — Hand-write planner and executor role sections (wave 2)
- [ ] 42-03-PLAN.md — Hand-write merger and reviewer role sections (wave 2)
- [ ] 42-04-PLAN.md — Gap closure: align reviewer verdict vocabulary with merge.cjs contract (wave 3)
**Research flag**: Research complete (coupling points between merger and merge pipeline enumerated in 42-RESEARCH.md)

### Phase 43: Planning & Discussion Skills
**Goal**: Users can run /init, /start-set, /discuss-set, and /plan-set to go from project initialization through complete set planning in 2-4 agent spawns
**Depends on**: Phase 42 (skills reference core agent return formats and must be written against stable agents)
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04, PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. /init handles greenfield and brownfield projects with a 5-researcher pipeline (including Domain/UX) and produces a roadmap
  2. /start-set creates a worktree scaffold for a set and chains into discuss-set
  3. /discuss-set captures user vision into CONTEXT.md, and /discuss-set --skip auto-generates CONTEXT.md from roadmap + codebase scan
  4. /plan-set produces one PLAN.md per wave in a single pass with 2-4 agent spawns (not 15-20), and interface contracts are defined between dependent sets
  5. Contract enforcement runs at three points: after planning, during execution, before merge
  6. Error messages show progress breadcrumbs (what is done, what is missing, what to run next) and each command suggests exactly one next action
**Plans**: TBD
**Research flag**: Needs research-phase for plan-set specifically (validate single-agent planning for multi-wave scenarios)

### Phase 44: Execution & Auxiliary Skills
**Goal**: Users can execute planned sets and use auxiliary commands (/quick, /add-set, /new-version) for workflow flexibility
**Depends on**: Phase 43 (execution depends on planning artifacts; auxiliary commands depend on the core lifecycle being stable)
**Requirements**: CMD-05, CMD-09, CMD-10, CMD-11, EXEC-01, EXEC-02, EXEC-03
**Success Criteria** (what must be TRUE):
  1. /execute-set runs parallel wave execution using per-wave PLAN.md files and a lean verification agent checks objectives after all waves complete
  2. The executor determines completion by reading planning artifacts (which PLAN.md files have implementation commits) rather than from wave/job state, enabling re-entry after crash
  3. /quick allows ad-hoc changes without requiring set structure
  4. /add-set adds new sets to an existing project mid-milestone with proper contract updates
  5. /new-version completes the current milestone and starts a new version
**Plans**: TBD
**Research flag**: Needs research-phase for execute-set (validate artifact-based re-entry without wave/job state)

### Phase 45: Documentation, Contracts & Cleanup
**Goal**: v3.0 is the documented, clean official version with dead code removed and contracts simplified
**Depends on**: Phase 44 (all functional work must be complete before documenting)
**Requirements**: DOC-01, DOC-02, DOC-03
**Success Criteria** (what must be TRUE):
  1. README.md and DOCS.md accurately describe v3.0 commands, architecture, and workflow (no references to wave-plan, job-plan, or other removed concepts)
  2. Unused libraries, retired agents, and wave/job artifacts are removed from the codebase (dead code elimination)
  3. GATES.json generation is removed, CONTRACT.json is retained as the sole contract artifact, and lock.cjs retains only STATE.json mutation locks (set-gating locks removed)
**Plans**: TBD
**Research flag**: Skip research-phase (documentation and cleanup)

## Progress

**Execution Order:**
Phases execute in numeric order: 38 -> 39 -> 40 -> 41 -> 42 -> 43 -> 44 -> 45

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 38. State Machine Simplification | 2/2 | Complete    | 2026-03-12 | - |
| 39. Tool Docs Registry & Core Module Refactor | 4/4 | Complete    | 2026-03-12 | - |
| 40. CLI Surface & Utility Commands | 4/4 | Complete    | 2026-03-12 | - |
| 41. Build Pipeline & Generated Agents | 2/2 | Complete    | 2026-03-12 | - |
| 42. Core Agent Rewrites | 3/3 | Complete   | 2026-03-12 | - |
| 43. Planning & Discussion Skills | v3.0 | 0/TBD | Not started | - |
| 44. Execution & Auxiliary Skills | v3.0 | 0/TBD | Not started | - |
| 45. Documentation, Contracts & Cleanup | v3.0 | 0/TBD | Not started | - |
