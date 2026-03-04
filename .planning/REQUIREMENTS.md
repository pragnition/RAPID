# Requirements: RAPID

**Defined:** 2026-03-03
**Core Value:** Multiple developers using Claude Code can work on the same project simultaneously without blocking each other, with confidence their independent work will merge cleanly.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

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
- [x] **EXEC-02**: Each set goes through its own discuss → plan → execute phase lifecycle independently
- [x] **EXEC-03**: Changes within sets are committed atomically per task (bisectable, blame-friendly history)
- [x] **EXEC-04**: Developer can run `/rapid:status` to see progress across all sets and all phases
- [x] **EXEC-05**: Developer can pause work on a set and resume later with full state restoration (handoff files)
- [ ] **EXEC-06**: RAPID detects EXPERIMENTAL_AGENT_TEAMS env var and offers agent teams execution mode with subagent fallback
- [x] **EXEC-07**: Loose sync gates enforce: all sets must finish planning before any begins execution; execution is independent per set
- [x] **EXEC-08**: Mandatory reconciliation after each execution wave — compare plan vs actual, create SUMMARY with pass/fail on acceptance criteria, block next wave until reconciled

### Merge & Review

- [x] **MERG-01**: Merge reviewer agent performs deep code review (style, correctness, contract compliance) before any set merges to main
- [x] **MERG-02**: Merge reviewer validates all interface contracts are satisfied — blocks merge if contracts violated or tests fail
- [x] **MERG-03**: Cleanup agent can be spawned when merge reviewer finds fixable issues (style violations, missing tests, minor contract gaps)
- [ ] **MERG-04**: Sets merge in dependency-graph order — independent sets can merge in parallel, dependent sets merge sequentially

### State Management

- [x] **STAT-01**: All project state lives in `.planning/` directory, committed to git (JSON for machine state, Markdown for human-readable)
- [x] **STAT-02**: Concurrent state access is prevented via mkdir-based atomic lock files with PID + timestamp
- [x] **STAT-03**: Stale locks are detected and recovered automatically (crashed process left a lock behind)
- [x] **STAT-04**: Developer can run `/rapid:help` to see all available commands and workflow guidance

### Agent Architecture

- [x] **AGNT-01**: Agents are built from composable prompt modules (core behavior + role-specific + context modules) rather than monolithic prompts
- [x] **AGNT-02**: All agents use structured return protocol (COMPLETE/CHECKPOINT/BLOCKED tables) for machine-parseable results
- [x] **AGNT-03**: Agent completion is verified by checking filesystem artifacts (files exist, tests pass, commits land) — never trust agent self-reports alone

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Team Features

- **TEAM-01**: Real-time team status broadcasting (who is working on what set, current phase)
- **TEAM-02**: Cross-agent-tool support (Codex CLI, Gemini CLI alongside Claude Code)
- **TEAM-03**: Role-based task assignment (lead assigns sets to specific developers)
- **TEAM-04**: Conflict detection across concurrent sets (beyond contract validation)

### Polish

- **PLSH-01**: Replan workflow (`/rapid:replan`) to restructure sets mid-project
- **PLSH-02**: Custom merge strategies per set
- **PLSH-03**: Issue tracker integration (GitHub Issues, Linear)
- **PLSH-04**: Plugin/extension system for community contributions
- **PLSH-05**: Codebase mapping integration for brownfield projects
- **PLSH-06**: Verification/UAT phase beyond merge review

## Out of Scope

| Feature | Reason |
|---------|--------|
| Standalone CLI | RAPID is a Claude Code plugin, not its own binary |
| Central server/service | All state is git-native, zero infrastructure required |
| Ad-hoc set creation during execution | Sets defined at planning time only — keeps isolation guarantees tight |
| Fully synchronized phase gates | Loose sync is the model — shared planning gate, independent execution |
| CARL or external rule engine coupling | Rule enforcement is self-contained within RAPID |
| Real-time inter-set messaging | Sets communicate through contracts, not messages |
| Auto-merge conflict resolution | Merge reviewer flags issues, humans/cleanup agents resolve them |
| Cross-platform GUI | CLI-first, terminal-first experience |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGNT-01 | Phase 1: Agent Framework and State Management | Complete |
| AGNT-02 | Phase 1: Agent Framework and State Management | Complete |
| AGNT-03 | Phase 1: Agent Framework and State Management | Complete |
| STAT-01 | Phase 1: Agent Framework and State Management | Complete |
| STAT-02 | Phase 1: Agent Framework and State Management | Complete |
| STAT-03 | Phase 1: Agent Framework and State Management | Complete |
| INIT-01 | Phase 2: Plugin Shell and Initialization | Complete |
| INIT-05 | Phase 2: Plugin Shell and Initialization | Complete |
| STAT-04 | Phase 2: Plugin Shell and Initialization | Complete |
| INIT-02 | Phase 3: Context Generation | Complete |
| INIT-03 | Phase 3: Context Generation | Complete |
| INIT-04 | Phase 3: Context Generation | Complete |
| PLAN-01 | Phase 4: Planning Engine and Contracts | Complete |
| PLAN-02 | Phase 4: Planning Engine and Contracts | Complete |
| PLAN-03 | Phase 4: Planning Engine and Contracts | Complete |
| PLAN-04 | Phase 4: Planning Engine and Contracts | Complete |
| PLAN-05 | Phase 4: Planning Engine and Contracts | Complete |
| PLAN-06 | Phase 4: Planning Engine and Contracts | Complete |
| WORK-01 | Phase 5: Worktree Orchestration | Complete |
| WORK-02 | Phase 5: Worktree Orchestration | Complete |
| WORK-03 | Phase 5: Worktree Orchestration | Complete |
| WORK-04 | Phase 5: Worktree Orchestration | Complete |
| EXEC-01 | Phase 6: Execution Core | Complete |
| EXEC-02 | Phase 6: Execution Core | Complete |
| EXEC-03 | Phase 6: Execution Core | Complete |
| EXEC-04 | Phase 7: Execution Lifecycle | Complete (07-01) |
| EXEC-05 | Phase 7: Execution Lifecycle | Complete |
| EXEC-07 | Phase 7: Execution Lifecycle | Complete (07-01) |
| EXEC-08 | Phase 7: Execution Lifecycle | Complete |
| MERG-01 | Phase 8: Merge Pipeline | Complete |
| MERG-02 | Phase 8: Merge Pipeline | Complete |
| MERG-03 | Phase 8: Merge Pipeline | Complete |
| MERG-04 | Phase 8: Merge Pipeline | Pending |
| EXEC-06 | Phase 9: Agent Teams Integration | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation*
