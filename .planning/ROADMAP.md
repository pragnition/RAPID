# Roadmap: RAPID

## Overview

RAPID delivers team-based parallel development for Claude Code through nine phases that build from the ground up: agent framework and state management first, then the plugin shell users interact with, context generation for rich project understanding, the planning engine that decomposes work into contract-bound sets, worktree orchestration for physical isolation, per-set execution with independent lifecycles, execution lifecycle management with sync gates, the merge pipeline that validates everything integrates, and finally agent teams as an optimization layer on a proven subagent foundation.

## Milestones

- 🚧 **v1.0 Core** - Phases 1-9.2 (in progress)
- 📋 **v1.1 UI UX Improvements** - Phases 10-15 (planned)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 Core (Phases 1-9.2)</summary>

- [x] **Phase 1: Agent Framework and State Management** - Composable agent architecture, structured returns, state storage, and atomic locking
- [x] **Phase 2: Plugin Shell and Initialization** - `/rapid:init` scaffolding, prerequisite validation, and `/rapid:help` command
- [x] **Phase 3: Context Generation** - CLAUDE.md auto-generation, style guide creation, and brownfield codebase detection
- [ ] **Phase 4: Planning Engine and Contracts** - Set decomposition, interface contracts, dependency graphs, file ownership, and sync gates
- [ ] **Phase 5: Worktree Orchestration** - Git worktree lifecycle management, status tracking, cleanup, and per-worktree scoped context
- [ ] **Phase 6: Execution Core** - Per-set subagent execution, independent discuss/plan/execute lifecycle, and atomic commits
- [ ] **Phase 7: Execution Lifecycle** - Cross-set status dashboard, session pause/resume, sync gate enforcement, and wave reconciliation
- [ ] **Phase 8: Merge Pipeline** - Deep code review, contract validation, cleanup agent, and dependency-ordered merging
- [ ] **Phase 9: Agent Teams Integration** - EXPERIMENTAL_AGENT_TEAMS detection with dual-mode execution and subagent fallback

</details>

### v1.1 UI UX Improvements (Phases 10-15)

- [ ] **Phase 10: Init and Context Skill Prompts** - Structured AskUserQuestion prompts for init and context skills
- [ ] **Phase 11: Planning and Status Skill Prompts** - Structured AskUserQuestion prompts for plan, assumptions, and status skills
- [ ] **Phase 12: Execute Skill Prompts and Progress** - Structured AskUserQuestion prompts and progress indicators for execute skill
- [ ] **Phase 13: Merge and Cleanup Skill Prompts** - Structured prompts, error recovery paths, and verdict explanations for merge and cleanup skills
- [ ] **Phase 14: Install Skill Polish** - Shell detection, auto-sourcing, and fallback guidance for install skill
- [ ] **Phase 15: Global Error Recovery and Progress** - Replace bare STOP handling across all skills and add progress indicators to context and merge skills

## Phase Details

<details>
<summary>v1.0 Core Phase Details (Phases 1-9.2)</summary>

### Phase 1: Agent Framework and State Management
**Goal**: Agents have a composable, verifiable architecture and all project state is reliably stored with concurrent-access safety
**Depends on**: Nothing (first phase)
**Requirements**: AGNT-01, AGNT-02, AGNT-03, STAT-01, STAT-02, STAT-03
**Success Criteria** (what must be TRUE):
  1. Agent prompts are assembled from composable modules (core + role-specific + context) rather than monolithic files
  2. Every agent returns structured COMPLETE/CHECKPOINT/BLOCKED tables that can be parsed programmatically
  3. Agent task completion is verified by checking filesystem artifacts (files exist, tests pass, commits land) -- not by trusting agent self-reports
  4. All project state persists in `.planning/` as JSON (machine state) and Markdown (human-readable), committed to git
  5. Concurrent state writes are prevented by mkdir-based atomic locks with PID + timestamp, and stale locks from crashed processes are detected and recovered automatically
**Plans**: 3 plans (Wave 1: scaffold+state, Wave 2: modules+assembler || returns+verify)

Plans:
- [x] 01-01: Project scaffolding and state management core (STAT-01, STAT-02, STAT-03) [Wave 1]
- [x] 01-02: Agent module system and assembler (AGNT-01) [Wave 2, depends: 01-01]
- [x] 01-03: Structured returns and verification (AGNT-02, AGNT-03) [Wave 2, depends: 01-01]

### Phase 2: Plugin Shell and Initialization
**Goal**: Developers can install RAPID and scaffold a new project with validated prerequisites
**Depends on**: Phase 1
**Requirements**: INIT-01, INIT-05, STAT-04
**Success Criteria** (what must be TRUE):
  1. Developer can run `/rapid:init` and get a complete `.planning/` directory with all required state files scaffolded
  2. Init validates prerequisites (git 2.30+, jq 1.6+, Node.js 18+) and reports clear errors for missing or outdated dependencies
  3. Developer can run `/rapid:help` and see all available commands with workflow guidance explaining what to do next
**Plans**: 3 plans (Wave 1: plugin structure+prereqs, Wave 2: init scaffolding+docs, Wave 3: gap closure)

Plans:
- [x] 02-01: Plugin structure, command/skill registration, and prerequisite validation (INIT-05) [Wave 1]
- [x] 02-02: Init scaffolding library, CLI subcommand, and DOCS.md (INIT-01, STAT-04) [Wave 2, depends: 02-01]
- [x] 02-03: Wire SKILL.md to call rapid-tools.cjs init scaffold (INIT-01, INIT-05, STAT-04) [Wave 3, depends: 02-01, 02-02, gap closure]

### Phase 3: Context Generation
**Goal**: Every developer working on the project has consistent, comprehensive context about code style, architecture, and conventions
**Depends on**: Phase 2
**Requirements**: INIT-02, INIT-03, INIT-04
**Success Criteria** (what must be TRUE):
  1. Init detects an existing codebase and offers brownfield mapping -- surfacing existing patterns, structure, and conventions before planning begins
  2. Init auto-generates a CLAUDE.md file containing project context: code style, architecture patterns, API conventions, and project knowledge
  3. Init auto-generates a style guide covering naming conventions, file structure, and error handling patterns to ensure cross-worktree consistency
**Plans**: 3 plans (Wave 1: detection library, Wave 2: CLI + subagent + skill + assembler extension, Wave 3: gap closure)

Plans:
- [x] 03-01: Brownfield detection library with config parsing and scan manifest (INIT-02) [Wave 1]
- [x] 03-02: Context CLI, subagent module, /rapid:context skill, assembler extension (INIT-02, INIT-03, INIT-04) [Wave 2, depends: 03-01]
- [x] 03-03: Wire handleAssembleAgent to pass context files to assembleAgent (INIT-02, INIT-03, INIT-04) [Wave 3, depends: 03-02, gap closure]

### Phase 4: Planning Engine and Contracts
**Goal**: Work is decomposed into parallelizable sets with machine-verifiable interface contracts that define how sets interact
**Depends on**: Phase 3
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06
**Success Criteria** (what must be TRUE):
  1. Developer can run `/rapid:plan` and get work decomposed into sets with explicit boundaries showing what each set owns
  2. Each set has a machine-verifiable interface contract defining API surfaces, data shapes, and behavioral expectations
  3. Planning produces a dependency DAG showing which sets can run in parallel and which have ordering constraints
  4. Shared files (package.json, configs, shared types) are assigned to specific set ownership to prevent merge conflicts
  5. Developer can run `/rapid:assumptions` to surface Claude's mental model about a set before planning, and planning enforces the shared planning gate (all sets planned before any executes)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Worktree Orchestration
**Goal**: Each set has its own physically isolated git worktree with scoped context, and worktree lifecycle is fully managed
**Depends on**: Phase 4
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04
**Success Criteria** (what must be TRUE):
  1. Each set automatically gets its own git worktree and dedicated branch created when execution begins
  2. Developer can run `/rapid:status` and see all active worktrees, their set assignments, and which lifecycle phase each is in
  3. Completed worktrees are cleaned up automatically -- worktree removed, branch optionally deleted after successful merge
  4. Each worktree gets a scoped CLAUDE.md containing only its set's contracts, relevant context, and style guide (not the full project context)
**Plans**: 2 plans (Wave 1: worktree library+CLI, Wave 2: status display+scoped context+skills)

Plans:
- [ ] 05-01: Worktree lifecycle library (worktree.cjs) and CLI subcommands (WORK-01, WORK-03) [Wave 1]
- [ ] 05-02: Status display, scoped CLAUDE.md generation, /rapid:status and /rapid:cleanup skills (WORK-02, WORK-04) [Wave 2, depends: 05-01]

### Phase 6: Execution Core
**Goal**: Sets execute independently in isolated contexts, each going through its own development lifecycle with clean git history
**Depends on**: Phase 5
**Requirements**: EXEC-01, EXEC-02, EXEC-03
**Success Criteria** (what must be TRUE):
  1. Each set executes in a fresh context window (subagent) with only its relevant contracts and context loaded -- no cross-set bleed
  2. Each set goes through its own discuss, plan, execute phase lifecycle independently of other sets
  3. Changes within sets are committed atomically per task, producing bisectable, blame-friendly git history
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Execution Lifecycle
**Goal**: Developers have full visibility into cross-set progress, can pause and resume work, and execution waves are gated by reconciliation
**Depends on**: Phase 6
**Requirements**: EXEC-04, EXEC-05, EXEC-07, EXEC-08
**Success Criteria** (what must be TRUE):
  1. Developer can run `/rapid:status` and see progress across all sets and all phases in a unified dashboard
  2. Developer can pause work on any set and resume later with full state restoration from handoff files
  3. Loose sync gates enforce that all sets must finish planning before any begins execution, while execution remains independent per set
  4. After each execution wave, mandatory reconciliation compares plan vs actual, produces a SUMMARY with pass/fail on acceptance criteria, and blocks the next wave until reconciled
**Plans**: TBD

Plans:
- [x] 07-01: Status dashboard and gate enforcement (EXEC-04, EXEC-07) [Wave 1]
- [ ] 07-02: TBD

### Phase 8: Merge Pipeline
**Goal**: Independent work merges cleanly with automated deep review, contract enforcement, and dependency-aware ordering
**Depends on**: Phase 7
**Requirements**: MERG-01, MERG-02, MERG-03, MERG-04
**Success Criteria** (what must be TRUE):
  1. A merge reviewer agent performs deep code review (style, correctness, contract compliance) before any set merges to main
  2. The merge reviewer validates all interface contracts are satisfied and blocks merge if contracts are violated or tests fail
  3. A cleanup agent can be spawned when the merge reviewer finds fixable issues (style violations, missing tests, minor contract gaps)
  4. Sets merge in dependency-graph order -- independent sets can merge in parallel, dependent sets merge sequentially
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: Agent Teams Integration
**Goal**: RAPID leverages EXPERIMENTAL_AGENT_TEAMS when available for enhanced parallel execution, with graceful subagent fallback
**Depends on**: Phase 8
**Requirements**: EXEC-06
**Success Criteria** (what must be TRUE):
  1. RAPID detects the EXPERIMENTAL_AGENT_TEAMS environment variable and offers agent teams execution mode when available
  2. When agent teams are unavailable or detection fails, RAPID gracefully falls back to subagent-based execution with no loss of functionality
  3. The developer experience is identical regardless of execution mode -- same commands, same status output, same merge pipeline
**Plans**: TBD

Plans:
- [x] 09-01: Agent teams foundation - teams.cjs, TaskCompleted hook, CLI detect-mode (EXEC-06) [Wave 1]
- [ ] 09-02: Execute skill wiring - dual-mode dispatch, status integration, fallback [Wave 2, depends: 09-01]

### Phase 09.2: Create setup script and fix RAPID_TOOLS paths for plugin installation (INSERTED)

**Goal:** RAPID has a portable setup system (setup.sh + /rapid:install) that bootstraps RAPID_TOOLS env var for any installation method, with all hardcoded fallback paths removed
**Requirements**: SETUP-01, SETUP-02, SETUP-03
**Depends on:** Phase 9
**Success Criteria** (what must be TRUE):
  1. setup.sh at repo root bootstraps RAPID_TOOLS env var, validates prereqs, installs deps, and registers plugin -- idempotently
  2. /rapid:install skill provides guided setup from within Claude Code for both marketplace and git clone installations
  3. All SKILL.md files and core modules use bare ${RAPID_TOOLS} with no fallback paths -- missing env var produces clear error
**Plans:** 2/2 plans complete

Plans:
- [ ] 09.2-01-PLAN.md -- Create setup.sh bootstrap script and /rapid:install skill (SETUP-01, SETUP-02)
- [ ] 09.2-02-PLAN.md -- Remove all fallback paths from source files, update DOCS.md and help (SETUP-03)

### Phase 09.1: Package for Plugin Marketplace (INSERTED)

**Goal:** RAPID is packaged, documented, and distributed via both self-hosted marketplace and official Anthropic plugin directory
**Depends on:** Phase 9
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, PKG-06
**Success Criteria** (what must be TRUE):
  1. All SKILL.md files use portable paths that work when installed from marketplace (no hardcoded ~/RAPID/rapid/ references)
  2. Version numbers are synchronized to 1.0.0 across plugin.json and package.json
  3. MIT LICENSE file exists in the plugin directory
  4. DOCS.md comprehensively documents all 10 skills, 6 agents, architecture, workflow, and installation
  5. Self-hosted marketplace.json enables `/plugin marketplace add fishjojo1/RAPID`
  6. Plugin passes `claude plugin validate .` and is ready for official directory submission
**Plans:** 2/3 plans executed

Plans:
- [x] 09.1-01: Fix portability -- portable paths, version sync, LICENSE, help update (PKG-01, PKG-02, PKG-03) [Wave 1]
- [ ] 09.1-02: Comprehensive DOCS.md rewrite (PKG-04) [Wave 2, depends: 09.1-01]
- [ ] 09.1-03: Marketplace packaging and submission (PKG-05, PKG-06) [Wave 2, depends: 09.1-01]

</details>

### Phase 10: Init and Context Skill Prompts
**Goal**: Init and context skills use structured AskUserQuestion prompts for all decision gates instead of freeform text
**Depends on**: Nothing (v1.1 milestone, independent of v1.0 phase completion)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-13
**Success Criteria** (what must be TRUE):
  1. When init detects an existing .planning/ directory, the developer sees a structured prompt with Reinitialize/Upgrade/Cancel options and descriptions of what each does
  2. When init asks for team size, the developer sees preset options (1, 2-3, 4-5, 6+) via AskUserQuestion instead of typing a number freeform
  3. When init asks whether this is a fresh or brownfield project, the developer picks from a structured prompt with clear descriptions of each path
  4. When context skill detects a greenfield project, the developer sees a structured confirmation prompt before generation proceeds
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD

### Phase 11: Planning and Status Skill Prompts
**Goal**: Plan, assumptions, and status skills use structured AskUserQuestion prompts for navigation and next-action decisions
**Depends on**: Phase 10
**Requirements**: PROMPT-04, PROMPT-12, PROMPT-14
**Success Criteria** (what must be TRUE):
  1. When plan skill encounters existing sets, the developer sees a structured Re-plan/View current/Cancel prompt with consequence descriptions
  2. When assumptions skill runs, the developer can select a set and provide feedback through structured prompts instead of freeform text
  3. After status skill displays the dashboard, the developer sees a next-action prompt offering relevant commands based on current project state
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: Execute Skill Prompts and Progress
**Goal**: Execute skill uses structured prompts for all decision points and shows progress during subagent operations
**Depends on**: Phase 11
**Requirements**: PROMPT-05, PROMPT-06, PROMPT-07, PROMPT-08, PROG-01
**Success Criteria** (what must be TRUE):
  1. When choosing execution mode, the developer sees Agent Teams vs Subagents as structured options with clear descriptions of tradeoffs
  2. When a paused set is encountered, the developer sees Resume/Restart/Skip options with consequence descriptions for each
  3. When the planning gate has not been met, the developer sees a structured override prompt with explicit risk explanation before proceeding
  4. After wave reconciliation, the developer sees structured next-step options based on the reconciliation result (all pass vs failures found)
  5. During subagent execution, the developer sees periodic progress text showing which set is active and last activity timestamp
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

### Phase 13: Merge and Cleanup Skill Prompts
**Goal**: Merge and cleanup skills use structured prompts for confirmations, recovery from errors, and explanation of reviewer verdicts
**Depends on**: Phase 12
**Requirements**: PROMPT-09, PROMPT-10, PROMPT-11, ERRR-01, ERRR-02, ERRR-04
**Success Criteria** (what must be TRUE):
  1. Before merging to main, the developer sees a structured confirmation prompt making the irreversible nature of the action explicit
  2. When a merge conflict occurs, the developer sees structured Resolve/Show diff/Revert options instead of the merge halting with no guidance
  3. Before destructive worktree removal, the developer sees a structured confirmation prompt listing what will be deleted
  4. When a dirty worktree blocks removal, the developer sees specific resolution steps (commit/stash commands) as structured options
  5. After merge review, the developer sees clear explanations of APPROVE/CHANGES_REQUESTED/BLOCK verdicts and how many cleanup rounds remain
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD

### Phase 14: Install Skill Polish
**Goal**: Install skill detects the user's shell, auto-sources config, and provides clear fallback guidance when automation fails
**Depends on**: Nothing (independent of other v1.1 phases)
**Requirements**: INST-01, INST-02, INST-03
**Success Criteria** (what must be TRUE):
  1. Install skill reads $SHELL and tells the developer which config file (e.g., ~/.bashrc, ~/.zshrc, ~/.config/fish/config.fish) will be modified before writing
  2. After writing env vars to the shell config, the install skill auto-sources the config and verifies RAPID_TOOLS is set in the current session
  3. If auto-sourcing fails, the developer sees clear manual instructions showing the exact source command to run for their detected shell
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

### Phase 15: Global Error Recovery and Progress
**Goal**: All skills replace bare STOP error handling with structured recovery options, and context/merge skills show progress during long operations
**Depends on**: Phases 10-13 (builds on per-skill prompt work)
**Requirements**: ERRR-03, PROG-02, PROG-03
**Success Criteria** (what must be TRUE):
  1. No skill contains bare "STOP" or "halt" error handling -- every error path offers structured AskUserQuestion with retry/skip/help/cancel options
  2. During context skill codebase analysis, the developer sees progress text indicating analysis stage and files processed
  3. During merge skill reviewer and cleanup subagent operations, the developer sees progress text indicating review stage and current set
**Plans**: TBD

Plans:
- [ ] 15-01: TBD
- [ ] 15-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 09.1 → 09.2 → 10 → 11 → 12 → 13 → 14 → 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Agent Framework and State Management | v1.0 | 3/3 | Complete | 2026-03-03 |
| 2. Plugin Shell and Initialization | v1.0 | 3/3 | Complete | 2026-03-04 |
| 3. Context Generation | v1.0 | 3/3 | Complete | 2026-03-04 |
| 4. Planning Engine and Contracts | v1.0 | 0/3 | Not started | - |
| 5. Worktree Orchestration | v1.0 | 1/2 | In Progress | - |
| 6. Execution Core | v1.0 | 0/2 | Not started | - |
| 7. Execution Lifecycle | v1.0 | 1/2 | In Progress | - |
| 8. Merge Pipeline | v1.0 | 2/2 | Complete | 2026-03-04 |
| 9. Agent Teams Integration | v1.0 | 1/2 | In Progress | - |
| 09.1 Package for Plugin Marketplace | v1.0 | 2/3 | In Progress | - |
| 09.2 Setup Script and RAPID_TOOLS | v1.0 | 2/2 | Complete | - |
| 10. Init and Context Skill Prompts | v1.1 | 0/2 | Not started | - |
| 11. Planning and Status Skill Prompts | v1.1 | 0/1 | Not started | - |
| 12. Execute Skill Prompts and Progress | v1.1 | 0/2 | Not started | - |
| 13. Merge and Cleanup Skill Prompts | v1.1 | 0/2 | Not started | - |
| 14. Install Skill Polish | v1.1 | 0/1 | Not started | - |
| 15. Global Error Recovery and Progress | v1.1 | 0/2 | Not started | - |
