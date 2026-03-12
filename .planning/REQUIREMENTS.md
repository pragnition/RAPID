# Requirements: RAPID

**Defined:** 2026-03-09
**Core Value:** Multiple developers using Claude Code can work on the same project simultaneously without blocking each other, with confidence their independent work will merge cleanly.

## v3.0 Requirements

Requirements for v3.0 Refresh. Surgical rewrite of orchestration layer.

### State & Orchestration

- [x] **STATE-01**: State machine simplified to set-level hierarchy (remove WaveState, JobState, derived status propagation)
- [x] **STATE-02**: SetStatus enum updated with 'discussing' status for discuss-set flow
- [x] **STATE-03**: Crash recovery triad preserved (detectCorruption, recoverFromGit, atomic writes) through simplification
- [x] **STATE-04**: Every command bootstraps exclusively from STATE.json + disk artifacts (self-contained after /clear)
- [x] **STATE-05**: Each command follows transaction pattern: read state -> validate -> work -> write state -> suggest next action

### Agent Infrastructure

- [x] **AGENT-01**: Each agent prompt embeds inline YAML of only the rapid-tools.cjs commands it needs
- [x] **AGENT-02**: XML-formatted prompt structure with defined schema document (allowed tags, nesting rules)
- [ ] **AGENT-03**: Hybrid build pipeline: SKIP_GENERATION set for core agents, ROLE_TOOL_DOCS for per-agent tool injection
- [ ] **AGENT-04**: 5 core agents (orchestrator, planner, executor, merger, reviewer) hand-written and never overwritten by build
- [x] **AGENT-05**: Tool docs registry (tool-docs.cjs) with per-role command specs and 1000-token budget per agent
- [ ] **AGENT-06**: 5th researcher (Domain/UX) added to init research pipeline

### Planning

- [ ] **PLAN-01**: /plan-set produces one PLAN.md per wave in a single pass (2-4 agent spawns, not 15-20)
- [ ] **PLAN-02**: /discuss-set captures user vision and produces CONTEXT.md for the planner
- [ ] **PLAN-03**: /discuss-set --skip auto-generates CONTEXT.md from roadmap + codebase scan
- [ ] **PLAN-04**: Interface contracts defined between sets without blocking gates
- [ ] **PLAN-05**: Contract enforcement at three points: after planning, during execution, before merge

### Execution

- [ ] **EXEC-01**: /execute-set runs parallel wave execution using per-wave PLAN.md files
- [ ] **EXEC-02**: Lean verification agent runs after all waves complete to check objectives
- [ ] **EXEC-03**: Executor determines completion by reading planning artifacts for re-entry without wave/job state

### Commands

- [ ] **CMD-01**: /init handles greenfield and brownfield with 5-researcher pipeline and roadmap creation
- [ ] **CMD-02**: /start-set creates worktree scaffold for a set
- [ ] **CMD-03**: /discuss-set as standalone command with --skip flag
- [ ] **CMD-04**: /plan-set as standalone command
- [ ] **CMD-05**: /execute-set as standalone command
- [ ] **CMD-06**: /review preserved with state reference updates
- [ ] **CMD-07**: /merge preserved with state updates and planning artifact transfer
- [ ] **CMD-08**: /status shows project dashboard across all worktrees with next steps
- [ ] **CMD-09**: /quick for ad-hoc changes without set structure
- [ ] **CMD-10**: /add-set adds sets to an existing project mid-milestone
- [ ] **CMD-11**: /new-version completes current milestone and starts new version
- [ ] **CMD-12**: /install validates installation and updates plugin files

### UX

- [ ] **UX-01**: Error messages show progress breadcrumb (done/missing/next)
- [ ] **UX-02**: Strong defaults with one suggested next action (minimize AskUserQuestion)
- [ ] **UX-03**: Deprecation stubs for removed v2 commands with migration messages
- [ ] **UX-04**: 7+4 command structure (7 core lifecycle + 4 auxiliary)

### Documentation

- [ ] **DOC-01**: Updated README.md and DOCS.md reflecting v3.0
- [ ] **DOC-02**: Dead code removal (unused libraries, retired agents, wave/job artifacts)
- [ ] **DOC-03**: Contract simplification (remove GATES.json, retain CONTRACT.json)

## v2.2 Requirements (Complete)

### Merge Delegation

- [x] **MERGE-01**: Orchestrator delegates per-set merge work to a rapid-set-merger subagent instead of processing inline
- [x] **MERGE-02**: Orchestrator collects structured RAPID:RETURN results from merge subagents with default-unsafe parsing
- [x] **MERGE-03**: Subagent failures surface to user with recovery options without blocking independent sets
- [x] **MERGE-04**: MERGE-STATE updated before spawning subagent and after return for idempotent re-entry
- [x] **MERGE-05**: Orchestrator retains only compressed one-line status per completed set (~100 tokens)
- [x] **MERGE-06**: Mid-confidence escalations spawn rapid-conflict-resolver agents per conflict

### Documentation

- [x] **DOC-01**: README.md rewritten reflecting all capabilities through v2.2
- [x] **DOC-02**: README.md includes full lifecycle quick start and ASCII architecture diagram
- [x] **DOC-03**: technical_documentation.md created as power user reference
- [x] **DOC-04**: technical_documentation.md includes agent role reference (all 30+ agents)
- [x] **DOC-05**: technical_documentation.md includes troubleshooting guide

## v2.1 Requirements (Complete)

### Cleanup

- [x] **CLEAN-01**: All GSD references removed from source code, skill files, and agent type definitions
- [x] **CLEAN-02**: Agent types renamed from `gsd-*` to RAPID-native names across all skill files

### UX Polish

- [x] **UX-01**: User can reference sets by numeric index
- [x] **UX-02**: User can reference waves by dot notation
- [x] **UX-03**: Full string IDs still work (backward compatible)
- [x] **UX-04**: Each skill auto-suggests the next command with pre-filled numeric args
- [x] **UX-05**: Discuss phase batches related questions into 2 interactions instead of 4
- [x] **UX-06**: Stage banners display with RAPID branding and color coding
- [x] **UX-07**: Different agent types display with distinct colors

### Agent Registration

- [x] **AGENT-01**: All 26 role modules registered as agent files with valid YAML frontmatter
- [x] **AGENT-02**: build-agents CLI command generates all 26 agent files from source modules
- [x] **AGENT-03**: Each generated agent has per-role core module selection
- [x] **AGENT-04**: All agent-spawning skills reference registered agents by name
- [x] **AGENT-05**: Skills pass only task-specific context (not role instructions)
- [x] **AGENT-06**: Legacy assembler infrastructure removed
- [x] **AGENT-07**: All 17 skills normalized with zero references to old patterns

### Workflow Clarity

- [x] **FLOW-01**: Wave-plan accepts set+wave context
- [x] **FLOW-02**: Agents have clear internal knowledge of correct workflow order
- [x] **FLOW-03**: Job granularity defaults to coarser sizing

### Set-Based Review

- [x] **SET-REVIEW-01**: Review runs single pass across all changed files at set level
- [x] **SET-REVIEW-02**: Wave argument removed from /rapid:review
- [x] **SET-REVIEW-03**: Review scope includes changed files plus one-hop dependents
- [x] **SET-REVIEW-04**: Unit test and bug hunt chunk by directory when scope exceeds 15 files
- [x] **SET-REVIEW-05**: UAT runs once on full set scope
- [x] **SET-REVIEW-06**: All review artifacts live at set level
- [x] **SET-REVIEW-07**: Findings tagged with originating wave

### Planning Pipeline

- [x] **PLAN-01**: Plan verifier checks coverage of all wave requirements
- [x] **PLAN-02**: Plan verifier checks implementability
- [x] **PLAN-03**: Plan verifier checks consistency (no file ownership overlap)
- [x] **PLAN-04**: Plan verifier outputs VERIFICATION-REPORT.md with verdict
- [x] **PLAN-05**: FAIL verdict triggers user decision gate

### Wave Orchestration

- [x] **WAVE-01**: Single command plans all waves sequentially
- [x] **WAVE-02**: Independent waves plan in parallel
- [x] **WAVE-03**: Dependent waves plan sequentially
- [x] **WAVE-04**: Execute runs waves without per-wave approval gates

### Review Efficiency

- [x] **REV-01**: Scoper agent categorizes changed files by concern
- [x] **REV-02**: Review agents receive only relevant files
- [x] **REV-03**: Cross-cutting files included in all scopes
- [x] **REV-04**: Review results merged before presentation

## Future Requirements

### Deferred from v3.0

- **AUTO-CTX-01**: Auto-context deep mode -- full codebase pattern scanning beyond roadmap/contracts
- **CHAIN-01**: Single-command lifecycle -- /start-set auto-chains discuss -> plan -> execute -> review
- **DYN-SET-01**: Dynamic set creation during execution (not just via /add-set between commands)

### Deferred from v2.2

- **MERGE-DRY-01**: Merge dry-run mode
- **MERGE-PAR-01**: Parallel independent set merging when DAG proves no overlap
- **MERGE-HEAT-01**: Merge conflict heat map

### Deferred from v2.1

- **EXPRESS-01**: Express mode -- auto-accept defaults at non-critical gates
- **LEARN-01**: Review scoper learning/memory
- **REPLAN-01**: Selective wave re-planning

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time cross-set synchronization | Destroys isolation guarantees |
| AI-only merge conflict resolution (no HITL) | Multi-file conflicts need human judgment |
| Dynamic set creation during execution | Race conditions in contract resolution |
| Plugin-to-plugin skill invocation | Claude Code architecture doesn't support it |
| More than ~12 total commands | 7+4 is exactly right per Miller's Law |
| Auto-generated documentation from code | Misses the "why", produces reference-only material |
| Standalone CLI (not plugin) | RAPID is a Claude Code plugin |
| Central server/service | All state is git-native |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STATE-01 | Phase 38 | Complete |
| STATE-02 | Phase 38 | Complete |
| STATE-03 | Phase 38 | Complete |
| STATE-04 | Phase 38 | Complete |
| STATE-05 | Phase 38 | Complete |
| AGENT-01 | Phase 39 | Complete |
| AGENT-02 | Phase 39 | Complete |
| AGENT-03 | Phase 41 | Pending |
| AGENT-04 | Phase 42 | Pending |
| AGENT-05 | Phase 39 | Complete |
| AGENT-06 | Phase 41 | Pending |
| PLAN-01 | Phase 43 | Pending |
| PLAN-02 | Phase 43 | Pending |
| PLAN-03 | Phase 43 | Pending |
| PLAN-04 | Phase 43 | Pending |
| PLAN-05 | Phase 43 | Pending |
| EXEC-01 | Phase 44 | Pending |
| EXEC-02 | Phase 44 | Pending |
| EXEC-03 | Phase 44 | Pending |
| CMD-01 | Phase 43 | Pending |
| CMD-02 | Phase 43 | Pending |
| CMD-03 | Phase 43 | Pending |
| CMD-04 | Phase 43 | Pending |
| CMD-05 | Phase 44 | Pending |
| CMD-06 | Phase 40 | Pending |
| CMD-07 | Phase 40 | Pending |
| CMD-08 | Phase 40 | Pending |
| CMD-09 | Phase 44 | Pending |
| CMD-10 | Phase 44 | Pending |
| CMD-11 | Phase 44 | Pending |
| CMD-12 | Phase 40 | Pending |
| UX-01 | Phase 43 | Pending |
| UX-02 | Phase 43 | Pending |
| UX-03 | Phase 40 | Pending |
| UX-04 | Phase 40 | Pending |
| DOC-01 | Phase 45 | Pending |
| DOC-02 | Phase 45 | Pending |
| DOC-03 | Phase 45 | Pending |

**Coverage:**
- v3.0 requirements: 38 total
- Mapped to phases: 38/38
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-12 after v3.0 roadmap created (phases 38-45)*
