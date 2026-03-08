# Requirements: RAPID

**Defined:** 2026-03-03
**Core Value:** Multiple developers using Claude Code can work on the same project simultaneously without blocking each other, with confidence their independent work will merge cleanly.

## v2.0 Requirements

Requirements for Mark II overhaul. Each maps to roadmap phases.

### State & Infrastructure

- [x] **STATE-01**: State machine persists hierarchical JSON state (project > milestone > set > wave > job) with lock-protected writes
- [x] **STATE-02**: State transitions validated — cannot skip states (e.g. pending > executing > complete)
- [x] **STATE-03**: Sets/Waves/Jobs data model with DAG computation extending dag.cjs
- [x] **STATE-04**: Dependency audit maps coupling in v1.0 lib modules and creates adapter layer
- [x] **STATE-05**: All inter-agent outputs use structured format (JSON/structured markdown) for reliable parsing

### Init & Project Setup

- [x] **INIT-01**: /init detects greenfield vs brownfield projects
- [x] **INIT-02**: /init asks user for model selection (opus/sonnet) and team size for set scaling
- [x] **INIT-03**: Codebase synthesizer agent analyzes brownfield codebases (files, functions, API endpoints, code style, tech stack)
- [x] **INIT-04**: Parallel research agents investigate stack, features, architecture, pitfalls during init
- [x] **INIT-05**: Research synthesizer combines parallel research outputs into SUMMARY.md
- [x] **INIT-06**: Roadmapper agent creates roadmap with sets/waves/jobs structure
- [x] **INIT-07**: /install preserves current env var methodology with shell detection
- [x] **INIT-08**: /new-milestone command starts new milestone/version cycle

### Set Lifecycle

- [x] **SETL-01**: /set-init creates git worktree and branch for a specified set
- [x] **SETL-02**: /set-init generates scoped CLAUDE.md per worktree with relevant contracts and context
- [x] **SETL-03**: Set planner runs during /set-init producing high-level set overview
- [x] **SETL-04**: /status displays cross-set dashboard with set > wave > job hierarchy
- [x] **SETL-05**: /pause saves per-set state with handoff file for later resumption
- [x] **SETL-06**: /cleanup removes completed set worktrees with safety checks
- [x] **SETL-07**: /context generates CLAUDE.md and project context files

### Wave Lifecycle

- [x] **WAVE-01**: /discuss captures user implementation vision per wave via AskUserQuestion
- [x] **WAVE-02**: /discuss is comprehensive — probes uncovered facets, asks about edge cases, only acts autonomously if user opts in
- [x] **WAVE-03**: /plan spawns research agents to investigate how to implement wave jobs
- [x] **WAVE-04**: Wave Planner produces high-level per-job plans with structured output
- [x] **WAVE-05**: Job Planner creates detailed per-job implementation plans with user discussion
- [x] **WAVE-06**: Job Planner validates plans against interface contracts

### Execution

- [x] **EXEC-01**: /execute runs parallel job execution within a wave via subagents or agent teams
- [x] **EXEC-02**: Executor agent executes jobs with atomic commits producing bisectable git history
- [x] **EXEC-03**: Per-job progress tracking with state updates surviving context resets
- [x] **EXEC-04**: Orchestrator dispatches commands based on current state and spawns appropriate subagents

### Review Module

- [x] **REVW-01**: /review orchestrates unit test > bug hunt > UAT pipeline (per-wave or per-set)
- [x] **REVW-02**: Unit test agent generates test plan for user approval before writing tests
- [x] **REVW-03**: Unit test agent writes, runs, and reports with full observability (commands, stdout, pass/fail)
- [x] **REVW-04**: Bug hunter agent performs broad static analysis with risk/confidence scoring
- [x] **REVW-05**: Devils advocate agent attempts to disprove hunter findings with code evidence
- [x] **REVW-06**: Judge agent produces final ruling (ACCEPTED/DISMISSED/DEFERRED) with fix priorities and HITL for contested findings
- [x] **REVW-07**: Bugfix subagent fixes accepted bugs, pipeline iterates until clean
- [x] **REVW-08**: UAT agent generates multi-step test plan with automated/human step tagging
- [x] **REVW-09**: UAT agent executes automated steps via Playwright, prompts user for human steps

### Merge Pipeline

- [x] **MERG-01**: /merge merges completed sets back to main with 5-level conflict detection (textual, structural, dependency, API, semantic)
- [x] **MERG-02**: 4-tier resolution cascade (deterministic > heuristic > AI-assisted > human escalation)
- [ ] **MERG-03**: Per-set merge state tracking integrated with hierarchical state machine
- [ ] **MERG-04**: Sets merge in dependency-graph order via DAG
- [ ] **MERG-05**: Bisection recovery isolates breaking set interaction via binary search
- [ ] **MERG-06**: Rollback with cascade revert undoes problematic merges and re-merges remaining sets

### UX & Cross-Cutting

- [x] **UX-01**: AskUserQuestion used at every decision gate, queries batched to save tokens/time
- [x] **UX-02**: Progress indicators with emojis/color during subagent operations
- [x] **UX-03**: State updated at every step so user can /clear context between phases
- [x] **UX-04**: /help shows all Mark II commands with workflow guidance

### Documentation

- [ ] **DOCS-01**: DOCS.md comprehensively documents all commands, agents, architecture, and Mark II workflow
- [ ] **DOCS-02**: README.md updated with Mark II hierarchy, workflow, and getting started guide

## v1.1 Requirements (Validated)

All v1.1 requirements shipped and validated.

### Structured Prompts

- [x] **PROMPT-01**: Init skill uses AskUserQuestion for reinitialize/upgrade/cancel gate instead of numbered text options
- [x] **PROMPT-02**: Init skill uses AskUserQuestion for team size selection with preset options (1, 2-3, 4-5, 6+)
- [x] **PROMPT-03**: Init skill uses AskUserQuestion for fresh vs brownfield project decision
- [x] **PROMPT-04**: Plan skill uses AskUserQuestion for re-plan/view/cancel gate
- [x] **PROMPT-05**: Execute skill uses AskUserQuestion for agent teams vs subagents choice with clear descriptions
- [x] **PROMPT-06**: Execute skill uses AskUserQuestion for paused set resume/restart/skip with consequence descriptions
- [x] **PROMPT-07**: Execute skill uses AskUserQuestion for planning gate override with risk explanation
- [x] **PROMPT-08**: Execute skill uses AskUserQuestion for wave reconciliation next steps based on result status
- [x] **PROMPT-09**: Merge skill uses AskUserQuestion for final merge confirmation before irreversible action
- [x] **PROMPT-10**: Merge skill uses AskUserQuestion for merge conflict recovery (resolve/show/revert)
- [x] **PROMPT-11**: Cleanup skill uses AskUserQuestion for destructive worktree removal confirmation
- [x] **PROMPT-12**: Assumptions skill uses AskUserQuestion for set selection and feedback options
- [x] **PROMPT-13**: Context skill uses AskUserQuestion for greenfield detection and generation confirmation
- [x] **PROMPT-14**: Status skill offers next action via AskUserQuestion after displaying status

### Install Polish

- [x] **INST-01**: Install skill detects user's shell from $SHELL env var and shows which config file will be modified
- [x] **INST-02**: Install skill auto-sources shell config after writing env vars and verifies RAPID_TOOLS is set
- [x] **INST-03**: Install skill shows clear fallback guidance if auto-sourcing fails

### Error Recovery

- [x] **ERRR-01**: Merge skill offers structured recovery options on merge conflict instead of halting pipeline
- [x] **ERRR-02**: Cleanup skill provides specific resolution steps (commit/stash commands) when dirty worktree blocks removal
- [x] **ERRR-03**: All skills replace bare "STOP" error handling with AskUserQuestion offering retry/skip/help/cancel options
- [x] **ERRR-04**: Merge skill explains verdict meanings (APPROVE/CHANGES/BLOCK) and shows allowed cleanup rounds

### Progress Visibility

- [x] **PROG-01**: Execute skill shows progress indicators during subagent execution with last activity updates
- [x] **PROG-02**: Context skill shows progress during codebase analysis subagent
- [x] **PROG-03**: Merge skill shows progress during reviewer and cleanup subagent operations

## v1.0 Requirements (Validated)

All v1.0 requirements shipped and validated.

### Initialization

- [x] **v1-INIT-01**: Developer can run `/rapid:init` to scaffold `.planning/` directory with all required state files
- [x] **v1-INIT-02**: Init detects existing codebase and offers brownfield mapping before planning
- [x] **v1-INIT-03**: Init auto-generates CLAUDE.md with full project context
- [x] **v1-INIT-04**: Init auto-generates style guide for cross-worktree consistency
- [x] **v1-INIT-05**: Init configures git repo and validates prerequisites (git 2.30+, jq 1.6+, Node.js 18+)

### Set Planning

- [x] **v1-PLAN-01**: Developer can run `/rapid:plan` to decompose work into parallelizable sets
- [x] **v1-PLAN-02**: Each set has a machine-verifiable interface contract
- [x] **v1-PLAN-03**: Planning produces a set dependency graph (DAG)
- [x] **v1-PLAN-04**: Planning assigns shared-file ownership to specific sets
- [x] **v1-PLAN-05**: Developer can run `/rapid:assumptions` to surface Claude's mental model
- [x] **v1-PLAN-06**: Planning respects loose sync gates

### Worktree Orchestration

- [x] **v1-WORK-01**: Each set gets its own git worktree and dedicated branch
- [x] **v1-WORK-02**: Developer can run `/rapid:status` to see all active worktrees
- [x] **v1-WORK-03**: Completed worktrees are cleaned up automatically
- [x] **v1-WORK-04**: Each worktree gets a scoped CLAUDE.md

### Execution

- [x] **v1-EXEC-01**: Each set executes in a fresh context window with only relevant contracts
- [x] **v1-EXEC-02**: Each set goes through its own discuss, plan, execute lifecycle independently
- [x] **v1-EXEC-03**: Changes committed atomically per task
- [x] **v1-EXEC-04**: Cross-set progress dashboard
- [x] **v1-EXEC-05**: Pause and resume with state restoration
- [x] **v1-EXEC-06**: EXPERIMENTAL_AGENT_TEAMS detection with subagent fallback
- [x] **v1-EXEC-07**: Loose sync gates enforced
- [x] **v1-EXEC-08**: Mandatory reconciliation after each wave

### Merge & Review

- [x] **v1-MERG-01**: Merge reviewer performs deep code review
- [x] **v1-MERG-02**: Merge reviewer validates interface contracts
- [x] **v1-MERG-03**: Cleanup agent for fixable issues
- [x] **v1-MERG-04**: Dependency-graph ordered merging

### State & Agent Architecture

- [x] **v1-STAT-01**: All state in `.planning/`, committed to git
- [x] **v1-STAT-02**: Concurrent access prevention via atomic locks
- [x] **v1-STAT-03**: Stale lock detection and recovery
- [x] **v1-STAT-04**: `/rapid:help` with workflow guidance
- [x] **v1-AGNT-01**: Composable prompt modules
- [x] **v1-AGNT-02**: Structured return protocol (COMPLETE/CHECKPOINT/BLOCKED)
- [x] **v1-AGNT-03**: Filesystem artifact verification

### Packaging & Setup

- [x] **v1-PKG-01**: Portable paths in all SKILL.md files
- [x] **v1-PKG-02**: Version numbers synchronized
- [x] **v1-PKG-03**: MIT LICENSE
- [x] **v1-PKG-04**: DOCS.md documents all skills, agents, architecture
- [ ] **v1-PKG-05**: Self-hosted marketplace.json
- [ ] **v1-PKG-06**: Plugin passes validation for directory submission
- [x] **v1-SETUP-01**: setup.sh bootstraps RAPID_TOOLS
- [x] **v1-SETUP-02**: /rapid:install guided setup
- [x] **v1-SETUP-03**: No fallback paths — bare ${RAPID_TOOLS}

## Future Requirements (v2.1+)

Deferred from v2.0.

### Ad-Hoc Tasks

- **ADHOC-01**: /quick command for rapid single-task execution
- **ADHOC-02**: /insert-job for ad-hoc job insertion into existing waves

### Advanced Team Features

- **TEAM-01**: Real-time team status broadcasting
- **TEAM-02**: Cross-agent-tool support (Codex CLI, Gemini CLI alongside Claude Code)
- **TEAM-03**: Role-based task assignment

### Polish

- **PLSH-01**: Replan workflow to restructure sets mid-project
- **PLSH-02**: Custom merge strategies per set
- **PLSH-03**: Issue tracker integration (GitHub Issues, Linear)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Standalone CLI | RAPID is a Claude Code plugin, not its own binary |
| Central server/service | All state is git-native, zero infrastructure required |
| Dynamic set creation during execution | Sets defined at planning time only — prevents merge nightmares |
| Fully synchronized phase gates | Loose sync is the model — shared planning gate, independent execution |
| Fully automated review (no HITL) | AI review without human judgment leads to false confidence |
| Real-time cross-set synchronization | Destroys isolation guarantees; loose sync + merge-time reconciliation instead |
| AI-only merge conflict resolution | Multi-file conflicts need human judgment; 4-tier cascade with human escalation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STATE-01 | Phase 16 | Complete |
| STATE-02 | Phase 16 | Complete |
| STATE-03 | Phase 16 | Complete |
| STATE-04 | Phase 17 | Complete |
| STATE-05 | Phase 16 | Complete |
| INIT-01 | Phase 18 | Complete |
| INIT-02 | Phase 18 | Complete |
| INIT-03 | Phase 18 | Complete |
| INIT-04 | Phase 18 | Complete |
| INIT-05 | Phase 18 | Complete |
| INIT-06 | Phase 18 | Complete |
| INIT-07 | Phase 18 | Complete |
| INIT-08 | Phase 18 | Complete |
| SETL-01 | Phase 19 | Complete |
| SETL-02 | Phase 19 | Complete |
| SETL-03 | Phase 19 | Complete |
| SETL-04 | Phase 19 | Complete |
| SETL-05 | Phase 19 | Complete |
| SETL-06 | Phase 19 | Complete |
| SETL-07 | Phase 19 | Complete |
| WAVE-01 | Phase 20 | Complete |
| WAVE-02 | Phase 20 | Complete |
| WAVE-03 | Phase 20 | Complete |
| WAVE-04 | Phase 20 | Complete |
| WAVE-05 | Phase 20 | Complete |
| WAVE-06 | Phase 20 | Complete |
| EXEC-01 | Phase 21 | Complete |
| EXEC-02 | Phase 21 | Complete |
| EXEC-03 | Phase 21 | Complete |
| EXEC-04 | Phase 21 | Complete |
| REVW-01 | Phase 22 | Complete |
| REVW-02 | Phase 22 | Complete |
| REVW-03 | Phase 22 | Complete |
| REVW-04 | Phase 22 | Complete |
| REVW-05 | Phase 22 | Complete |
| REVW-06 | Phase 22 | Complete |
| REVW-07 | Phase 22 | Complete |
| REVW-08 | Phase 22 | Complete |
| REVW-09 | Phase 22 | Complete |
| MERG-01 | Phase 23 | Complete |
| MERG-02 | Phase 23 | Complete |
| MERG-03 | Phase 23 | Pending |
| MERG-04 | Phase 23 | Pending |
| MERG-05 | Phase 23 | Pending |
| MERG-06 | Phase 23 | Pending |
| UX-01 | Phase 19 | Complete |
| UX-02 | Phase 21 | Complete |
| UX-03 | Phase 16 | Complete |
| UX-04 | Phase 18 | Complete |
| DOCS-01 | Phase 24 | Pending |
| DOCS-02 | Phase 24 | Pending |

**Coverage:**
- v2.0 requirements: 50 total
- Mapped to phases: 50
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-06 after v2.0 roadmap creation (all 50 requirements mapped to phases 16-24)*
