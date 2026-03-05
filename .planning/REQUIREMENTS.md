# Requirements: RAPID

**Defined:** 2026-03-03
**Core Value:** Multiple developers using Claude Code can work on the same project simultaneously without blocking each other, with confidence their independent work will merge cleanly.

## v1.1 Requirements

Requirements for UI/UX improvements milestone. Each maps to roadmap phases.

### Structured Prompts

- [ ] **PROMPT-01**: Init skill uses AskUserQuestion for reinitialize/upgrade/cancel gate instead of numbered text options
- [ ] **PROMPT-02**: Init skill uses AskUserQuestion for team size selection with preset options (1, 2-3, 4-5, 6+)
- [ ] **PROMPT-03**: Init skill uses AskUserQuestion for fresh vs brownfield project decision
- [ ] **PROMPT-04**: Plan skill uses AskUserQuestion for re-plan/view/cancel gate
- [ ] **PROMPT-05**: Execute skill uses AskUserQuestion for agent teams vs subagents choice with clear descriptions
- [ ] **PROMPT-06**: Execute skill uses AskUserQuestion for paused set resume/restart/skip with consequence descriptions
- [ ] **PROMPT-07**: Execute skill uses AskUserQuestion for planning gate override with risk explanation
- [ ] **PROMPT-08**: Execute skill uses AskUserQuestion for wave reconciliation next steps based on result status
- [ ] **PROMPT-09**: Merge skill uses AskUserQuestion for final merge confirmation before irreversible action
- [ ] **PROMPT-10**: Merge skill uses AskUserQuestion for merge conflict recovery (resolve/show/revert)
- [ ] **PROMPT-11**: Cleanup skill uses AskUserQuestion for destructive worktree removal confirmation
- [ ] **PROMPT-12**: Assumptions skill uses AskUserQuestion for set selection and feedback options
- [x] **PROMPT-13**: Context skill uses AskUserQuestion for greenfield detection and generation confirmation
- [ ] **PROMPT-14**: Status skill offers next action via AskUserQuestion after displaying status

### Install Polish

- [ ] **INST-01**: Install skill detects user's shell from $SHELL env var and shows which config file will be modified
- [ ] **INST-02**: Install skill auto-sources shell config after writing env vars and verifies RAPID_TOOLS is set
- [ ] **INST-03**: Install skill shows clear fallback guidance if auto-sourcing fails

### Error Recovery

- [ ] **ERRR-01**: Merge skill offers structured recovery options on merge conflict instead of halting pipeline
- [ ] **ERRR-02**: Cleanup skill provides specific resolution steps (commit/stash commands) when dirty worktree blocks removal
- [ ] **ERRR-03**: All skills replace bare "STOP" error handling with AskUserQuestion offering retry/skip/help/cancel options
- [ ] **ERRR-04**: Merge skill explains verdict meanings (APPROVE/CHANGES/BLOCK) and shows allowed cleanup rounds

### Progress Visibility

- [ ] **PROG-01**: Execute skill shows progress indicators during subagent execution with last activity updates
- [ ] **PROG-02**: Context skill shows progress during codebase analysis subagent
- [ ] **PROG-03**: Merge skill shows progress during reviewer and cleanup subagent operations

## v1 Requirements (Validated)

All v1.0 requirements shipped and validated.

### Initialization

- [x] **INIT-01**: Developer can run `/rapid:init` to scaffold `.planning/` directory with all required state files
- [x] **INIT-02**: Init detects existing codebase and offers brownfield mapping before planning
- [x] **INIT-03**: Init auto-generates CLAUDE.md with full project context (code style, architecture patterns, API conventions, project knowledge)
- [x] **INIT-04**: Init auto-generates style guide for cross-worktree consistency (naming conventions, file structure, error handling patterns)
- [x] **INIT-05**: Init configures git repo and validates prerequisites (git 2.30+, jq 1.6+, Node.js 18+)

### Set Planning

- [x] **PLAN-01**: Developer can run `/rapid:plan` to decompose work into parallelizable sets with explicit boundaries
- [x] **PLAN-02**: Each set has a machine-verifiable interface contract defining API surfaces, data shapes, and behavioral expectations between sets
- [x] **PLAN-03**: Planning produces a set dependency graph (DAG) showing which sets can run in parallel and which have ordering constraints
- [x] **PLAN-04**: Planning assigns shared-file ownership (package.json, configs, shared types) to specific sets to prevent merge conflicts
- [x] **PLAN-05**: Developer can run `/rapid:assumptions` to surface Claude's mental model about a set's approach before planning begins
- [x] **PLAN-06**: Planning respects loose sync gates — shared planning gate must complete before any set begins execution

### Worktree Orchestration

- [x] **WORK-01**: Each set gets its own git worktree and dedicated branch created automatically
- [x] **WORK-02**: Developer can run `/rapid:status` to see all active worktrees, their set assignments, and lifecycle phase
- [x] **WORK-03**: Completed worktrees are cleaned up automatically (worktree removed, branch optionally deleted after merge)
- [x] **WORK-04**: Each worktree gets a scoped CLAUDE.md containing only its set's contracts, relevant context, and style guide

### Execution

- [x] **EXEC-01**: Each set executes in a fresh context window (subagent per set) with only relevant contracts and context loaded
- [x] **EXEC-02**: Each set goes through its own discuss, plan, execute phase lifecycle independently
- [x] **EXEC-03**: Changes within sets are committed atomically per task (bisectable, blame-friendly history)
- [x] **EXEC-04**: Developer can run `/rapid:status` to see progress across all sets and all phases
- [x] **EXEC-05**: Developer can pause work on a set and resume later with full state restoration (handoff files)
- [x] **EXEC-06**: RAPID detects EXPERIMENTAL_AGENT_TEAMS env var and offers agent teams execution mode with subagent fallback
- [x] **EXEC-07**: Loose sync gates enforce: all sets must finish planning before any begins execution; execution is independent per set
- [x] **EXEC-08**: Mandatory reconciliation after each execution wave

### Merge & Review

- [x] **MERG-01**: Merge reviewer agent performs deep code review before any set merges to main
- [x] **MERG-02**: Merge reviewer validates all interface contracts are satisfied
- [x] **MERG-03**: Cleanup agent can be spawned when merge reviewer finds fixable issues
- [x] **MERG-04**: Sets merge in dependency-graph order

### State Management

- [x] **STAT-01**: All project state lives in `.planning/` directory, committed to git
- [x] **STAT-02**: Concurrent state access is prevented via mkdir-based atomic lock files
- [x] **STAT-03**: Stale locks are detected and recovered automatically
- [x] **STAT-04**: Developer can run `/rapid:help` to see all available commands and workflow guidance

### Agent Architecture

- [x] **AGNT-01**: Agents are built from composable prompt modules
- [x] **AGNT-02**: All agents use structured return protocol (COMPLETE/CHECKPOINT/BLOCKED)
- [x] **AGNT-03**: Agent completion is verified by checking filesystem artifacts

### Packaging (v1.0)

- [x] **PKG-01**: All SKILL.md files use portable paths
- [x] **PKG-02**: Version numbers synchronized across plugin.json and package.json
- [x] **PKG-03**: MIT LICENSE file exists
- [x] **PKG-04**: DOCS.md comprehensively documents all skills, agents, and architecture
- [ ] **PKG-05**: Self-hosted marketplace.json enables distribution
- [ ] **PKG-06**: Plugin passes validation for official directory submission

### Setup & Installation (v1.0)

- [x] **SETUP-01**: setup.sh bootstraps RAPID_TOOLS env var for any installation method
- [x] **SETUP-02**: /rapid:install skill provides guided in-Claude-Code setup
- [x] **SETUP-03**: All path fallbacks removed -- bare ${RAPID_TOOLS} everywhere

## v2 Requirements

Deferred to future release.

### Advanced Team Features

- **TEAM-01**: Real-time team status broadcasting
- **TEAM-02**: Cross-agent-tool support (Codex CLI, Gemini CLI alongside Claude Code)
- **TEAM-03**: Role-based task assignment
- **TEAM-04**: Conflict detection across concurrent sets

### Polish

- **PLSH-01**: Replan workflow (`/rapid:replan`) to restructure sets mid-project
- **PLSH-02**: Custom merge strategies per set
- **PLSH-03**: Issue tracker integration (GitHub Issues, Linear)
- **PLSH-04**: Plugin/extension system for community contributions
- **PLSH-05**: Codebase mapping integration for brownfield projects
- **PLSH-06**: Verification/UAT phase beyond merge review

### Pause UX (deferred from v1.1)

- **PAUSE-01**: Pause skill provides structured template for manual pause data collection
- **PAUSE-02**: Pause skill warns proactively before pausing when pause count >= 2

### Plan Iteration (deferred from v1.1)

- **PLANUX-01**: Plan skill adds iteration limit (3 rounds) to modification loop with re-plan suggestion

## Out of Scope

| Feature | Reason |
|---------|--------|
| Standalone CLI | RAPID is a Claude Code plugin, not its own binary |
| Central server/service | All state is git-native, zero infrastructure required |
| Ad-hoc set creation during execution | Sets defined at planning time only |
| Fully synchronized phase gates | Loose sync is the model |
| Automated conflict resolution | Too risky; structured recovery is sufficient for v1.1 |
| Real-time subagent streaming | Claude Code limitation; progress indicators are best we can do |
| Custom prompt themes/styling | Over-engineering; standard AskUserQuestion UI is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROMPT-01 | Phase 10 | Pending |
| PROMPT-02 | Phase 10 | Pending |
| PROMPT-03 | Phase 10 | Pending |
| PROMPT-04 | Phase 11 | Pending |
| PROMPT-05 | Phase 12 | Pending |
| PROMPT-06 | Phase 12 | Pending |
| PROMPT-07 | Phase 12 | Pending |
| PROMPT-08 | Phase 12 | Pending |
| PROMPT-09 | Phase 13 | Pending |
| PROMPT-10 | Phase 13 | Pending |
| PROMPT-11 | Phase 13 | Pending |
| PROMPT-12 | Phase 11 | Pending |
| PROMPT-13 | Phase 10 | Complete |
| PROMPT-14 | Phase 11 | Pending |
| INST-01 | Phase 14 | Pending |
| INST-02 | Phase 14 | Pending |
| INST-03 | Phase 14 | Pending |
| ERRR-01 | Phase 13 | Pending |
| ERRR-02 | Phase 13 | Pending |
| ERRR-03 | Phase 15 | Pending |
| ERRR-04 | Phase 13 | Pending |
| PROG-01 | Phase 12 | Pending |
| PROG-02 | Phase 15 | Pending |
| PROG-03 | Phase 15 | Pending |

**Coverage:**
- v1.1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-06 after v1.1 roadmap creation (phases 10-15)*
