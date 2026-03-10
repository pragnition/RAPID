# Requirements: RAPID

**Defined:** 2026-03-09
**Core Value:** Multiple developers using Claude Code can work on the same project simultaneously without blocking each other, with confidence their independent work will merge cleanly.

## v2.1 Requirements

Requirements for v2.1 Improvements & Fixes. Each maps to roadmap phases.

### Cleanup

- [x] **CLEAN-01**: All GSD references removed from source code, skill files, and agent type definitions
- [x] **CLEAN-02**: Agent types renamed from `gsd-*` to RAPID-native names across all skill files

### UX Polish

- [x] **UX-01**: User can reference sets by numeric index (`/set-init 1`, `/discuss 1`)
- [x] **UX-02**: User can reference waves by dot notation (`/wave-plan 1.1` = set 1, wave 1)
- [x] **UX-03**: Full string IDs still work (backward compatible)
- [x] **UX-04**: Each skill auto-suggests the next command with pre-filled numeric args on completion
- [x] **UX-05**: Discuss phase batches related questions into 2 interactions per gray area instead of 4
- [x] **UX-06**: Stage banners display with RAPID branding and color coding in terminal output
- [x] **UX-07**: Different agent types display with distinct colors (e.g. planner = blue, executor = green, reviewer = red)

### Agent Registration

- [x] **AGENT-01**: All 26 role modules are registered as agent files in `agents/` with valid YAML frontmatter
- [x] **AGENT-02**: A `build-agents` CLI command generates all 26 agent files from source modules
- [x] **AGENT-03**: Each generated agent has per-role core module selection (not all agents get all 5 core modules)
- [x] **AGENT-04**: All agent-spawning skills reference registered agents by name instead of reading role modules inline
- [x] **AGENT-05**: Skills pass only task-specific context (IDs, file lists, worktree path) -- not role instructions
- [x] **AGENT-06**: Legacy assembler infrastructure removed (assembler.cjs, config.json agents section, assemble-agent CLI)
- [x] **AGENT-07**: All 17 skills normalized with zero references to old role module reading patterns

### Workflow Clarity

- [x] **FLOW-01**: Wave-plan accepts set+wave context (not just wave ID in isolation)
- [x] **FLOW-02**: Agents have clear internal knowledge of the correct workflow order (init -> set-init -> discuss -> wave-plan -> execute -> review -> merge)
- [x] **FLOW-03**: Job granularity defaults to coarser sizing (fewer, larger jobs per wave)

### Set-Based Review

- [x] **SET-REVIEW-01**: Review runs a single pass across all changed files at the set level (no per-wave iteration)
- [x] **SET-REVIEW-02**: Wave argument removed from `/rapid:review` -- review accepts set-id only
- [x] **SET-REVIEW-03**: Review scope includes changed files plus one-hop dependents across all waves
- [x] **SET-REVIEW-04**: Unit test and bug hunt stages chunk by directory when scope exceeds 15 files, with parallel agents per chunk
- [x] **SET-REVIEW-05**: UAT runs once on full set scope (not chunked)
- [x] **SET-REVIEW-06**: All review artifacts (REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md, REVIEW-ISSUES.json) live at set level
- [x] **SET-REVIEW-07**: Findings tagged with originating wave via JOB-PLAN.md file list attribution

### Planning Pipeline

- [x] **PLAN-01**: Plan verifier agent checks coverage of all wave requirements against job plans
- [x] **PLAN-02**: Plan verifier checks implementability (referenced files exist or are created)
- [x] **PLAN-03**: Plan verifier checks consistency (no file ownership overlap within a wave)
- [x] **PLAN-04**: Plan verifier outputs VERIFICATION-REPORT.md with PASS/PASS_WITH_GAPS/FAIL verdict
- [x] **PLAN-05**: FAIL verdict triggers user decision gate (re-plan / override / cancel)

### Wave Orchestration

- [ ] **WAVE-01**: Single command plans all waves in a set sequentially (auto-chaining)
- [ ] **WAVE-02**: Independent waves (no file overlap or cross-references) plan in parallel
- [ ] **WAVE-03**: Dependent waves plan sequentially with predecessor artifacts available
- [x] **WAVE-04**: Execute runs waves sequentially without per-wave user approval gates

### Review Efficiency

- [ ] **REV-01**: Scoper agent categorizes changed files by concern before review
- [ ] **REV-02**: Review agents receive only files relevant to their assigned concern
- [ ] **REV-03**: Cross-cutting files (scoper uncertain) included in all review scopes
- [ ] **REV-04**: Review results merged before presentation to user

## Future Requirements

### Deferred from v2.1

- **EXPRESS-01**: Express mode -- auto-accept defaults at non-critical gates
- **LEARN-01**: Review scoper learning/memory -- persistent memory per project for better scoping over time
- **REPLAN-01**: Selective wave re-planning -- re-plan individual waves without re-planning entire set

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fully automatic workflow (zero user gates) | PROJECT.md explicitly rejects "fully automated review (no HITL)" -- streamlining reduces friction, not decisions |
| Real-time cross-wave coordination during planning | Destroys isolation guarantees; subagents cannot spawn sub-subagents (Claude Code hard constraint) |
| Dynamic wave/job creation during execution | RAPID's isolation model depends on sets being defined at planning time |
| Per-file review granularity control | Manual file scoping is tedious and error-prone; scoper agent handles this automatically |
| AI-only review scoping (no safety net) | Silent false negatives are worse than slightly higher token costs; cross-cutting files always included |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 25 | Complete |
| CLEAN-02 | Phase 25 | Complete |
| UX-01 | Phase 26 | Complete |
| UX-02 | Phase 26 | Complete |
| UX-03 | Phase 26 | Complete |
| UX-04 | Phase 28 | Complete |
| UX-05 | Phase 29 | Complete |
| UX-06 | Phase 27 | Complete |
| UX-07 | Phase 27 | Complete |
| AGENT-01 | Phase 27.1 | Complete |
| AGENT-02 | Phase 27.1 | Complete |
| AGENT-03 | Phase 27.1 | Complete |
| AGENT-04 | Phase 27.1 | Complete |
| AGENT-05 | Phase 27.1 | Complete |
| AGENT-06 | Phase 27.1 | Complete |
| AGENT-07 | Phase 27.1 | Complete |
| FLOW-01 | Phase 28 | Complete |
| FLOW-02 | Phase 28 | Complete |
| FLOW-03 | Phase 28 | Complete |
| SET-REVIEW-01 | Phase 29.1 | Complete |
| SET-REVIEW-02 | Phase 29.1 | Complete |
| SET-REVIEW-03 | Phase 29.1 | Complete |
| SET-REVIEW-04 | Phase 29.1 | Complete |
| SET-REVIEW-05 | Phase 29.1 | Complete |
| SET-REVIEW-06 | Phase 29.1 | Complete |
| SET-REVIEW-07 | Phase 29.1 | Complete |
| PLAN-01 | Phase 30 | Complete |
| PLAN-02 | Phase 30 | Complete |
| PLAN-03 | Phase 30 | Complete |
| PLAN-04 | Phase 30 | Complete |
| PLAN-05 | Phase 30 | Complete |
| WAVE-01 | Phase 31 | Pending |
| WAVE-02 | Phase 31 | Pending |
| WAVE-03 | Phase 31 | Pending |
| WAVE-04 | Phase 31 | Complete |
| REV-01 | Phase 32 | Pending |
| REV-02 | Phase 32 | Pending |
| REV-03 | Phase 32 | Pending |
| REV-04 | Phase 32 | Pending |

**Coverage:**
- v2.1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-10 after Phase 29.1 gap closure*
