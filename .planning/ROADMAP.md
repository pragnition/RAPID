# Roadmap: RAPID

## Overview

RAPID delivers team-based parallel development for Claude Code. v1.0 established the plugin infrastructure, v1.1 polished the UX, and v2.0 Mark II overhauls the entire workflow around a new Sets/Waves/Jobs hierarchy with a state machine foundation, comprehensive review pipeline, and adapted merge system. The v2.0 phases build from the state machine outward through planning, execution, review, and merge -- with documentation closing out the milestone.

## Milestones

- ✅ **v1.0 Core** - Phases 1-9.2 (shipped)
- ✅ **v1.1 UI UX Improvements** - Phases 10-15 (shipped)
- 🚧 **v2.0 Mark II** - Phases 16-24 (in progress)

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
- [ ] **Phase 09.1: Package for Plugin Marketplace** - Portable paths, version sync, LICENSE, DOCS.md, marketplace.json
- [x] **Phase 09.2: Setup Script and RAPID_TOOLS** - setup.sh bootstrap and /rapid:install skill

</details>

<details>
<summary>v1.1 UI UX Improvements (Phases 10-15)</summary>

- [x] **Phase 10: Init and Context Skill Prompts** - Structured AskUserQuestion prompts for init and context skills
- [x] **Phase 11: Planning and Status Skill Prompts** - Structured AskUserQuestion prompts for plan, assumptions, and status skills
- [x] **Phase 12: Execute Skill Prompts and Progress** - Structured AskUserQuestion prompts and progress indicators for execute skill
- [x] **Phase 13: Merge and Cleanup Skill Prompts** - Structured prompts, error recovery paths, and verdict explanations for merge and cleanup skills
- [x] **Phase 14: Install Skill Polish** - Shell detection, auto-sourcing, and fallback guidance for install skill
- [x] **Phase 15: Global Error Recovery and Progress** - Replace bare STOP handling across all skills and add progress indicators

</details>

### v2.0 Mark II (Phases 16-24)

- [x] **Phase 16: State Machine Foundation** - Hierarchical JSON state, validated transitions, crash recovery, and structured inter-agent output format (completed 2026-03-06)
- [x] **Phase 17: Dependency Audit and Adapter Layer** - Map v1.0 module coupling and create adapters for new data structures (completed 2026-03-06)
- [x] **Phase 18: Init and Project Setup** - Overhauled /init with greenfield/brownfield detection, research agents, roadmapper, and /new-milestone (completed 2026-03-06)
- [ ] **Phase 19: Set Lifecycle** - /set-init worktree creation, scoped CLAUDE.md, set planning, status dashboard, pause/resume, cleanup
- [ ] **Phase 20: Wave Planning** - /discuss for implementation vision capture, wave planner, job planner with contract validation
- [ ] **Phase 21: Execution Engine** - Parallel job execution within waves, atomic commits, per-job progress tracking, orchestrator dispatch
- [ ] **Phase 22: Review Module** - Unit test agent, bug hunting pipeline (hunter/devils-advocate/judge), UAT with Playwright automation
- [ ] **Phase 23: Merge Pipeline** - 5-level conflict detection, 4-tier resolution cascade, DAG-ordered merging, bisection recovery, rollback
- [ ] **Phase 24: Documentation** - Comprehensive DOCS.md and README.md for Mark II

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

<details>
<summary>v1.1 UI UX Improvements Phase Details (Phases 10-15)</summary>

### Phase 10: Init and Context Skill Prompts
**Goal**: Init and context skills use structured AskUserQuestion prompts for all decision gates instead of freeform text
**Depends on**: Nothing (v1.1 milestone, independent of v1.0 phase completion)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-13
**Success Criteria** (what must be TRUE):
  1. When init detects an existing .planning/ directory, the developer sees a structured prompt with Reinitialize/Upgrade/Cancel options and descriptions of what each does
  2. When init asks for team size, the developer sees preset options (1, 2-3, 4-5, 6+) via AskUserQuestion instead of typing a number freeform
  3. When init asks whether this is a fresh or brownfield project, the developer picks from a structured prompt with clear descriptions of each path
  4. When context skill detects a greenfield project, the developer sees a structured confirmation prompt before generation proceeds
**Plans**: 2 plans (Wave 1: init prompts || context prompts)

Plans:
- [ ] 10-01: Rewrite init SKILL.md with AskUserQuestion for all decision gates (PROMPT-01, PROMPT-02, PROMPT-03) [Wave 1]
- [ ] 10-02: Rewrite context SKILL.md with AskUserQuestion for greenfield detection (PROMPT-13) [Wave 1]

### Phase 11: Planning and Status Skill Prompts
**Goal**: Plan, assumptions, and status skills use structured AskUserQuestion prompts for navigation and next-action decisions
**Depends on**: Phase 10
**Requirements**: PROMPT-04, PROMPT-12, PROMPT-14
**Success Criteria** (what must be TRUE):
  1. When plan skill encounters existing sets, the developer sees a structured Re-plan/View current/Cancel prompt with consequence descriptions
  2. When assumptions skill runs, the developer can select a set and provide feedback through structured prompts instead of freeform text
  3. After status skill displays the dashboard, the developer sees a next-action prompt offering relevant commands based on current project state
**Plans**: 2 plans (Wave 1: plan+assumptions prompts || status prompts)

Plans:
- [ ] 11-01: Rewrite plan and assumptions SKILL.md with AskUserQuestion for all decision gates (PROMPT-04, PROMPT-12) [Wave 1]
- [ ] 11-02: Rewrite status SKILL.md with dynamic AskUserQuestion next-action routing (PROMPT-14) [Wave 1]

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
**Plans**: 1 plan (Wave 1: all prompts + progress in single plan)

Plans:
- [ ] 12-01: Rewrite execute SKILL.md with AskUserQuestion at all decision gates and progress indicators (PROMPT-05, PROMPT-06, PROMPT-07, PROMPT-08, PROG-01) [Wave 1]

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
**Plans**: 2 plans (Wave 1: merge prompts || cleanup prompts)

Plans:
- [ ] 13-01: Rewrite merge SKILL.md with AskUserQuestion at all decision gates, verdict explanations, and error recovery (PROMPT-09, PROMPT-10, ERRR-01, ERRR-04) [Wave 1]
- [ ] 13-02: Rewrite cleanup SKILL.md with AskUserQuestion for worktree selection, confirmation, and dirty worktree recovery (PROMPT-11, ERRR-02) [Wave 1]

### Phase 14: Install Skill Polish
**Goal**: Install skill detects the user's shell, auto-sources config, and provides clear fallback guidance when automation fails
**Depends on**: Nothing (independent of other v1.1 phases)
**Requirements**: INST-01, INST-02, INST-03
**Success Criteria** (what must be TRUE):
  1. Install skill reads $SHELL and tells the developer which config file (e.g., ~/.bashrc, ~/.zshrc, ~/.config/fish/config.fish) will be modified before writing
  2. After writing env vars to the shell config, the install skill auto-sources the config and verifies RAPID_TOOLS is set in the current session
  3. If auto-sourcing fails, the developer sees clear manual instructions showing the exact source command to run for their detected shell
**Plans**: 1 plan (Wave 1: setup.sh strip + SKILL.md rewrite)

Plans:
- [ ] 14-01: Strip setup.sh to non-interactive, rewrite install SKILL.md with shell detection, AskUserQuestion, auto-source, and fallback guidance (INST-01, INST-02, INST-03) [Wave 1]

### Phase 15: Global Error Recovery and Progress
**Goal**: All skills replace bare STOP error handling with structured recovery options, and context/merge skills show progress during long operations
**Depends on**: Phases 10-13 (builds on per-skill prompt work)
**Requirements**: ERRR-03, PROG-02, PROG-03
**Success Criteria** (what must be TRUE):
  1. No skill contains bare "STOP" or "halt" error handling -- every error path offers structured AskUserQuestion with retry/skip/help/cancel options
  2. During context skill codebase analysis, the developer sees progress text indicating analysis stage and files processed
  3. During merge skill reviewer and cleanup subagent operations, the developer sees progress text indicating review stage and current set
**Plans**: 2 plans (Wave 1: init+context STOP replacement+progress || merge progress)

Plans:
- [ ] 15-01: Replace STOP handling in init and context SKILL.md with 3-tier recovery, add context analysis progress banners (ERRR-03, PROG-02) [Wave 1]
- [ ] 15-02: Add reviewer and cleanup subagent progress banners to merge SKILL.md (PROG-03) [Wave 1]

</details>

### Phase 16: State Machine Foundation
**Goal**: All project state is tracked in a hierarchical JSON structure with validated transitions that survive context resets
**Depends on**: Phase 15 (v1.1 complete)
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-05, UX-03
**Success Criteria** (what must be TRUE):
  1. Project state persists as hierarchical JSON (project > milestone > set > wave > job) with lock-protected atomic writes
  2. State transitions are validated -- attempting to skip states (e.g., pending to complete without executing) produces a clear error
  3. Sets, Waves, and Jobs have a data model with DAG computation for dependency ordering, extending the existing dag.cjs
  4. All inter-agent outputs use structured format (JSON or structured markdown) with schema validation at every handoff point
  5. State is updated at every workflow step so a developer can /clear context and resume from the correct position
**Plans**: 3 plans (Wave 1: schemas+transitions || DAG+returns, Wave 2: state machine core)

Plans:
- [ ] 16-01: Zod schemas and transition maps (STATE-01, STATE-02) [Wave 1]
- [ ] 16-02: State machine core module (STATE-01, STATE-02, UX-03) [Wave 2, depends: 16-01]
- [ ] 16-03: DAG extension and structured output validation (STATE-03, STATE-05) [Wave 1]

### Phase 17: Dependency Audit and Adapter Layer
**Goal**: v1.0 lib modules are decoupled from old data structures and adapted to work with the new hierarchical state
**Depends on**: Phase 16
**Requirements**: STATE-04
**Success Criteria** (what must be TRUE):
  1. A dependency map documents the coupling between all v1.0 lib modules (worktree.cjs, merge.cjs, execute.cjs, plan.cjs, etc.) and the old STATE.md/flat data structures
  2. Adapter interfaces exist so that kept modules (worktree.cjs, merge.cjs) can read/write via the new hierarchical STATE.json without internal rewrites
  3. Integration tests verify that adapted modules produce correct state transitions through the adapter layer
**Plans**: 2 plans (Wave 1: dep map + state deletion + CLI rewrite, Wave 2: init update + integration tests)

Plans:
- [ ] 17-01: Dependency map, delete state.cjs, rewrite rapid-tools.cjs handleState, update agent modules (STATE-04) [Wave 1]
- [ ] 17-02: Add STATE.json to init scaffolding, phase-wide integration tests (STATE-04) [Wave 2, depends: 17-01]

### Phase 18: Init and Project Setup
**Goal**: Developers can initialize new projects or milestones with intelligent detection, parallel research, and automatic roadmap creation
**Depends on**: Phase 17
**Requirements**: INIT-01, INIT-02, INIT-03, INIT-04, INIT-05, INIT-06, INIT-07, INIT-08, UX-04
**Success Criteria** (what must be TRUE):
  1. /init detects whether the project is greenfield or brownfield and adapts its workflow accordingly
  2. /init asks the developer for model selection (opus/sonnet) and team size, then uses these to scale set planning
  3. For brownfield projects, a codebase synthesizer agent analyzes files, functions, API endpoints, code style, and tech stack before planning begins
  4. Parallel research agents investigate stack, features, architecture, and pitfalls, producing a synthesized SUMMARY.md
  5. A roadmapper agent creates a roadmap with the new sets/waves/jobs structure based on research and user input
  6. /install preserves current env var methodology with shell detection, and /new-milestone starts a new milestone cycle
  7. /help shows all Mark II commands with workflow guidance for the new hierarchy
**Plans**: 4 plans (Wave 1: init library + agent roles + help || new-milestone, Wave 2: init SKILL.md pipeline)

Plans:
- [ ] 18-01-PLAN.md -- Init library extensions: config model/teamSize, research-dir CLI, write-config CLI (INIT-01, INIT-02, INIT-05, INIT-06) [Wave 1]
- [ ] 18-02-PLAN.md -- Agent role modules (8 roles) and help SKILL.md rewrite (INIT-03, INIT-04, INIT-05, INIT-06, UX-04) [Wave 1]
- [ ] 18-03-PLAN.md -- Init SKILL.md full pipeline rewrite (INIT-01, INIT-02, INIT-03, INIT-04, INIT-05, INIT-06) [Wave 2, depends: 18-01, 18-02]
- [ ] 18-04-PLAN.md -- New-milestone skill, addMilestone state-machine, /install verification (INIT-07, INIT-08, UX-04) [Wave 1]

### Phase 19: Set Lifecycle
**Goal**: Developers can create, monitor, pause, resume, and clean up isolated set worktrees with full state tracking
**Depends on**: Phase 18
**Requirements**: SETL-01, SETL-02, SETL-03, SETL-04, SETL-05, SETL-06, SETL-07, UX-01
**Success Criteria** (what must be TRUE):
  1. /set-init creates a git worktree and branch for a specified set, ready for independent development
  2. /set-init generates a scoped CLAUDE.md per worktree containing only relevant contracts, context, and style guide
  3. A set planner runs during /set-init, producing a high-level set overview that guides wave planning
  4. /status displays a cross-set dashboard showing the set > wave > job hierarchy with current state for each
  5. /pause saves per-set state with a handoff file for later resumption, and /cleanup removes completed worktrees with safety checks
  6. AskUserQuestion is used at every decision gate during set lifecycle commands, with queries batched to save tokens
**Plans**: 3 plans (Wave 1: set-init || status dashboard || pause/resume/cleanup)

Plans:
- [ ] 19-01: Set-init command -- worktree creation, scoped CLAUDE.md, set planner role (SETL-01, SETL-02, SETL-03) [Wave 1]
- [ ] 19-02: Status dashboard rewrite -- STATE.json hierarchy, ASCII table, next actions (SETL-04, UX-01) [Wave 1]
- [ ] 19-03: Pause/resume/cleanup lifecycle -- handoff, resumption, branch deletion, context verify (SETL-05, SETL-06, SETL-07, UX-01) [Wave 1]

### Phase 20: Wave Planning
**Goal**: Each wave has a detailed implementation plan derived from user discussion, with per-job plans validated against interface contracts
**Depends on**: Phase 19
**Requirements**: WAVE-01, WAVE-02, WAVE-03, WAVE-04, WAVE-05, WAVE-06
**Success Criteria** (what must be TRUE):
  1. /discuss captures the developer's implementation vision for a wave via AskUserQuestion, probing uncovered facets and edge cases
  2. /discuss is comprehensive -- it does not act autonomously unless the developer explicitly opts in
  3. /plan spawns research agents to investigate how to implement wave jobs, then the Wave Planner produces high-level per-job plans
  4. The Job Planner creates detailed per-job implementation plans with user discussion for each job
  5. Job plans are validated against interface contracts -- violations are flagged before execution begins
**Plans**: TBD

Plans:
- [ ] 20-01: TBD
- [ ] 20-02: TBD

### Phase 21: Execution Engine
**Goal**: Jobs execute in parallel within waves with atomic commits, progress tracking that survives context resets, and orchestrated command dispatch
**Depends on**: Phase 20
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, UX-02
**Success Criteria** (what must be TRUE):
  1. /execute runs parallel job execution within a wave via subagents or agent teams
  2. Each job produces atomic commits creating bisectable git history
  3. Per-job progress is tracked with state updates that survive context resets -- developer can /clear and see accurate progress
  4. The orchestrator dispatches commands based on current state and spawns appropriate subagents for the current workflow step
  5. Progress indicators with visual formatting show active jobs and completion status during subagent operations
**Plans**: TBD

Plans:
- [ ] 21-01: TBD
- [ ] 21-02: TBD

### Phase 22: Review Module
**Goal**: Completed waves undergo automated testing and adversarial bug hunting before merge eligibility
**Depends on**: Phase 16 (state machine), Phase 21 (needs built code to review)
**Requirements**: REVW-01, REVW-02, REVW-03, REVW-04, REVW-05, REVW-06, REVW-07, REVW-08, REVW-09
**Success Criteria** (what must be TRUE):
  1. /review orchestrates the unit test > bug hunt > UAT pipeline, runnable per-wave or per-set
  2. The unit test agent generates a test plan for developer approval before writing tests, then writes, runs, and reports with full observability (commands, stdout, pass/fail)
  3. The bug hunter performs broad static analysis with risk/confidence scoring, the devils advocate attempts to disprove findings with code evidence, and the judge produces final ACCEPTED/DISMISSED/DEFERRED rulings with HITL for contested findings
  4. A bugfix subagent fixes accepted bugs, and the pipeline iterates until the codebase is clean
  5. The UAT agent generates multi-step test plans with automated/human step tagging, executes automated steps via Playwright, and prompts the developer for human steps
**Plans**: TBD

Plans:
- [ ] 22-01: TBD
- [ ] 22-02: TBD
- [ ] 22-03: TBD

### Phase 23: Merge Pipeline
**Goal**: Completed sets merge back to main with deep multi-level conflict detection, intelligent resolution, and recovery from failures
**Depends on**: Phase 16 (state machine), Phase 22 (review gate)
**Requirements**: MERG-01, MERG-02, MERG-03, MERG-04, MERG-05, MERG-06
**Success Criteria** (what must be TRUE):
  1. /merge performs 5-level conflict detection (textual, structural, dependency, API, semantic) before merging a set to main
  2. Conflicts are resolved through a 4-tier cascade: deterministic fixes first, then heuristic, then AI-assisted, with human escalation for unresolvable conflicts
  3. Per-set merge state is tracked in the hierarchical state machine and sets merge in dependency-graph order via DAG
  4. When a merge introduces failures, bisection recovery isolates the breaking set interaction via binary search
  5. Rollback with cascade revert can undo a problematic merge and re-merge remaining sets cleanly
**Plans**: TBD

Plans:
- [ ] 23-01: TBD
- [ ] 23-02: TBD
- [ ] 23-03: TBD

### Phase 24: Documentation
**Goal**: Mark II is comprehensively documented for both new users and developers extending RAPID
**Depends on**: Phases 16-23 (documents the completed system)
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. DOCS.md comprehensively documents all Mark II commands, agents, architecture, state machine, and the full workflow lifecycle
  2. README.md is updated with the Mark II hierarchy (Sets/Waves/Jobs), workflow overview, and a getting started guide that walks through init to merge
**Plans**: TBD

Plans:
- [ ] 24-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 09.1 → 09.2 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24

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
| 10. Init and Context Skill Prompts | v1.1 | 2/2 | Complete | 2026-03-05 |
| 11. Planning and Status Skill Prompts | v1.1 | 2/2 | Complete | 2026-03-06 |
| 12. Execute Skill Prompts and Progress | v1.1 | 1/1 | Complete | 2026-03-06 |
| 13. Merge and Cleanup Skill Prompts | v1.1 | 2/2 | Complete | 2026-03-06 |
| 14. Install Skill Polish | v1.1 | 1/1 | Complete | 2026-03-06 |
| 15. Global Error Recovery and Progress | v1.1 | 2/2 | Complete | 2026-03-06 |
| 16. State Machine Foundation | v2.0 | 3/3 | Complete | 2026-03-06 |
| 17. Dependency Audit and Adapter Layer | v2.0 | 2/2 | Complete | 2026-03-06 |
| 18. Init and Project Setup | 4/4 | Complete   | 2026-03-06 | - |
| 19. Set Lifecycle | 1/3 | In Progress|  | - |
| 20. Wave Planning | v2.0 | 0/2 | Not started | - |
| 21. Execution Engine | v2.0 | 0/2 | Not started | - |
| 22. Review Module | v2.0 | 0/3 | Not started | - |
| 23. Merge Pipeline | v2.0 | 0/3 | Not started | - |
| 24. Documentation | v2.0 | 0/1 | Not started | - |
