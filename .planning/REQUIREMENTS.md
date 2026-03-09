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
- [ ] **UX-04**: Each skill auto-suggests the next command with pre-filled numeric args on completion
- [ ] **UX-05**: Discuss phase batches related questions into 2 interactions per gray area instead of 4
- [x] **UX-06**: Stage banners display with RAPID branding and color coding in terminal output
- [x] **UX-07**: Different agent types display with distinct colors (e.g. planner = blue, executor = green, reviewer = red)

### Workflow Clarity

- [ ] **FLOW-01**: Wave-plan accepts set+wave context (not just wave ID in isolation)
- [ ] **FLOW-02**: Agents have clear internal knowledge of the correct workflow order (init -> set-init -> discuss -> wave-plan -> execute -> review -> merge)
- [ ] **FLOW-03**: Job granularity defaults to coarser sizing (fewer, larger jobs per wave)

### Planning Pipeline

- [ ] **PLAN-01**: Plan verifier agent checks coverage of all wave requirements against job plans
- [ ] **PLAN-02**: Plan verifier checks implementability (referenced files exist or are created)
- [ ] **PLAN-03**: Plan verifier checks consistency (no file ownership overlap within a wave)
- [ ] **PLAN-04**: Plan verifier outputs VERIFICATION-REPORT.md with PASS/PASS_WITH_GAPS/FAIL verdict
- [ ] **PLAN-05**: FAIL verdict triggers user decision gate (re-plan / override / cancel)

### Wave Orchestration

- [ ] **WAVE-01**: Single command plans all waves in a set sequentially (auto-chaining)
- [ ] **WAVE-02**: Independent waves (no file overlap or cross-references) plan in parallel
- [ ] **WAVE-03**: Dependent waves plan sequentially with predecessor artifacts available
- [ ] **WAVE-04**: Execute runs waves sequentially without per-wave user approval gates

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
| UX-04 | Phase 28 | Pending |
| UX-05 | Phase 29 | Pending |
| UX-06 | Phase 27 | Complete |
| UX-07 | Phase 27 | Complete |
| FLOW-01 | Phase 28 | Pending |
| FLOW-02 | Phase 28 | Pending |
| FLOW-03 | Phase 28 | Pending |
| PLAN-01 | Phase 30 | Pending |
| PLAN-02 | Phase 30 | Pending |
| PLAN-03 | Phase 30 | Pending |
| PLAN-04 | Phase 30 | Pending |
| PLAN-05 | Phase 30 | Pending |
| WAVE-01 | Phase 31 | Pending |
| WAVE-02 | Phase 31 | Pending |
| WAVE-03 | Phase 31 | Pending |
| WAVE-04 | Phase 31 | Pending |
| REV-01 | Phase 32 | Pending |
| REV-02 | Phase 32 | Pending |
| REV-03 | Phase 32 | Pending |
| REV-04 | Phase 32 | Pending |

**Coverage:**
- v2.1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
