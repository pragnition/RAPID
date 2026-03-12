# Roadmap: RAPID

## Milestones

- ✅ **v1.0 MVP** - Phases 1-9 (shipped 2026-03-03)
- ✅ **v1.1 Polish** - Phases 10-15 (shipped 2026-03-06)
- ✅ **v2.0 Mark II** - Phases 16-24 (shipped 2026-03-09)
- ✅ **v2.1 Improvements & Fixes** - Phases 25-32 (shipped 2026-03-10)
- 🚧 **v2.2 Subagent Merger & Documentation** - Phases 33-37 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (33, 34, 35): Planned milestone work
- Decimal phases (33.1, 33.2): Urgent insertions (marked with INSERTED)

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

### v2.2 Subagent Merger & Documentation (In Progress)

- [x] **Phase 33: Merge State Schema & Infrastructure** - Extend MERGE-STATE schema and build helper functions for subagent delegation (completed 2026-03-10)
- [x] **Phase 34: Core Merge Subagent Delegation** - Restructure merge SKILL.md to dispatch per-set rapid-set-merger subagents (completed 2026-03-10)
- [x] **Phase 35: Adaptive Conflict Resolution** - Orchestrator-mediated per-conflict agents for mid-confidence escalations (completed 2026-03-11)
- [x] **Phase 36: README Rewrite** - Complete README.md rewrite reflecting all capabilities through v2.2 (completed 2026-03-11)
- [x] **Phase 37: Technical Documentation** - Create technical_documentation.md as power user reference (completed 2026-03-11)
- [ ] **Phase 38: CLI Infrastructure Fixes** - Fix display.cjs stage maps, quick flag parsing, and migrate Step 7 invalid subcommand
- [ ] **Phase 39: Documentation Refresh** - Update README.md and docs/planning.md to reflect post-37.1 interface changes

## Phase Details

### Phase 33: Merge State Schema & Infrastructure
**Goal**: MERGE-STATE schema supports subagent delegation tracking with backward-compatible fields, and helper functions exist for context assembly and result parsing
**Depends on**: Phase 32 (last v2.1 phase)
**Requirements**: MERGE-04, MERGE-05
**Success Criteria** (what must be TRUE):
  1. MERGE-STATE.json includes agentPhase tracking fields (agentPhase1, agentPhase2) and the schema validates against a v2.1-era file without errors
  2. `prepareMergerContext()` in merge.cjs assembles a minimal payload (set name, unresolved conflicts, file paths) under 1000 tokens for a typical set
  3. `parseSetMergerReturn()` in merge.cjs validates RAPID:RETURN against a Zod schema and defaults to BLOCKED when the return is missing or malformed
  4. Compressed result protocol produces one-line status entries at roughly 100 tokens per set, verified against an 8-set budget calculation
**Plans:** 1/1 plans complete
Plans:
- [ ] 33-01-PLAN.md -- Schema extension + three helper functions (prepareMergerContext, parseSetMergerReturn, compressResult)

### Phase 34: Core Merge Subagent Delegation
**Goal**: The merge orchestrator dispatches isolated rapid-set-merger subagents per set, collects structured results, handles partial failures, and discards per-set context after collection
**Depends on**: Phase 33 (schema and helpers must exist before delegation code)
**Requirements**: MERGE-01, MERGE-02, MERGE-03
**Success Criteria** (what must be TRUE):
  1. Running `/rapid:merge` spawns a separate rapid-set-merger subagent for each set in the wave, visible as distinct agent instances in Claude Code UI
  2. Each merge subagent returns a structured RAPID:RETURN that the orchestrator parses; a missing or malformed return is treated as BLOCKED (not success)
  3. When one set's merge subagent fails (BLOCKED, context-exhausted, malformed), the user sees recovery options and independent sets continue merging unblocked
  4. MERGE-STATE.json shows status "resolving" before subagent spawn and advances to next status after return, enabling restart to skip completed sets
  5. After collecting a set's result, the orchestrator context retains only a compressed one-line status (~100 tokens), not the full detection/resolution detail
**Plans:** 2/2 plans complete
Plans:
- [x] 34-01-PLAN.md -- Agent infrastructure: role-set-merger module, build-agents registration, CLI enhancements (--agent-phase, prepare-context)
- [x] 34-02-PLAN.md -- SKILL.md restructuring: replace Steps 3-5 with dispatch + fast path + retry + recovery

### Phase 35: Adaptive Conflict Resolution
**Goal**: Mid-confidence merge escalations (0.3-0.8) are resolved by dedicated rapid-conflict-resolver agents spawned by the orchestrator, not by humans or by the merger itself
**Depends on**: Phase 34 (core delegation pattern must be proven stable)
**Requirements**: MERGE-06
**Success Criteria** (what must be TRUE):
  1. When a rapid-set-merger returns escalations with confidence scores between 0.3 and 0.8, the orchestrator spawns a rapid-conflict-resolver agent per conflict
  2. Conflicts with confidence below 0.3 or involving API signature changes go directly to a human decision gate (no automated resolution attempted)
  3. MERGE-STATE.json agentPhase2 field tracks which conflicts have been dispatched to resolver agents
**Plans:** 2/2 plans complete
Plans:
- [ ] 35-01-PLAN.md -- Schema change (agentPhase2 to object map) + 5 helper functions (routeEscalation, isApiSignatureConflict, generateConflictId, prepareResolverContext, parseConflictResolverReturn)
- [ ] 35-02-PLAN.md -- Role module (role-conflict-resolver.md), build-agents registration, SKILL.md Step 3e rewrite with routing + resolver dispatch

### Phase 36: README Rewrite
**Goal**: README.md accurately describes RAPID's current capabilities through v2.2 with a working quick start and command reference
**Depends on**: Phase 35 (all merge pipeline behavior must be finalized before documenting)
**Requirements**: DOC-01, DOC-02
**Success Criteria** (what must be TRUE):
  1. README.md is rewritten from scratch (not patched) and accurately describes all capabilities through v2.2 including subagent merge delegation
  2. README.md includes a full lifecycle quick start walkthrough covering init through cleanup with accurate command names and arguments
  3. README.md includes an ASCII architecture diagram showing the Sets/Waves/Jobs hierarchy and agent dispatch pattern
  4. Every command listed in the command reference table exists as a working skill and has correct argument syntax
**Plans:** 1/1 plans complete
Plans:
- [ ] 36-01-PLAN.md -- Full README.md rewrite: problem-first opening, How It Works, architecture diagram, quick start (greenfield/brownfield), command reference, further reading

### Phase 37: Technical Documentation
**Goal**: Power users have a comprehensive reference document covering all skills, agents, configuration, state machines, and failure recovery
**Depends on**: Phase 36 (README establishes the conceptual framework that technical docs build on)
**Requirements**: DOC-03, DOC-04, DOC-05
**Success Criteria** (what must be TRUE):
  1. technical_documentation.md exists and covers all skills (17+), configuration options, and state machine transitions
  2. technical_documentation.md includes an agent role reference cataloging all 30+ agents with their purpose, spawner, inputs, and outputs
  3. technical_documentation.md includes a troubleshooting guide covering common failure modes (subagent timeout, merge conflicts, state corruption, worktree cleanup)
  4. technical_documentation.md references SKILL.md files as authoritative source for implementation details rather than duplicating their content
**Plans:** 2/2 plans complete
Plans:
- [ ] 37-01-PLAN.md -- Index file + lifecycle skill docs (setup, planning, execution, review, merge-and-cleanup) + configuration reference
- [ ] 37-02-PLAN.md -- Agent catalog with dispatch tree + state machine diagrams + troubleshooting guide

## Progress

**Execution Order:**
Phases execute in numeric order: 33 -> 34 -> 35 -> 36 -> 37

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 33. Merge State Schema & Infrastructure | 1/1 | Complete    | 2026-03-10 | - |
| 34. Core Merge Subagent Delegation | 2/2 | Complete    | 2026-03-10 | - |
| 35. Adaptive Conflict Resolution | 2/2 | Complete    | 2026-03-11 | - |
| 36. README Rewrite | 1/1 | Complete    | 2026-03-11 | - |
| 37. Technical Documentation | 2/2 | Complete    | 2026-03-11 | - |
| 38. CLI Infrastructure Fixes | 0/1 | Planned | - | - |
| 39. Documentation Refresh | 0/1 | Not Started | - | - |

### Phase 37.1: Feature changes and fixes (INSERTED)

**Goal:** Restructure user-facing workflow to hide waves, redesign discussion flow, add /migrate and /quick commands, fix tool-calling reliability, and ensure state is updated after execute
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07
**Depends on:** Phase 37
**Plans:** 5/5 plans complete

Plans:
- [ ] 37.1-01-PLAN.md -- Schema extension + quick/migrate library code + CLI dispatch
- [ ] 37.1-02-PLAN.md -- Discussion flow full rewrite (set-level, single-round)
- [ ] 37.1-03-PLAN.md -- Wave hiding across all skills + workflow awareness + state commit after execute
- [ ] 37.1-04-PLAN.md -- New skill files for /rapid:migrate and /rapid:quick
- [ ] 37.1-05-PLAN.md -- Agent tool-calling audit and fixes

### Phase 38: CLI Infrastructure Fixes
**Goal**: Fix broken CLI infrastructure in display.cjs and rapid-tools.cjs so that /rapid:migrate and /rapid:quick work end-to-end
**Depends on**: Phase 37.1 (fixes bugs introduced in 37.1)
**Requirements**: FIX-03, FIX-04 (gap closure)
**Gap Closure**: Closes integration and flow gaps from v2.2 audit
**Success Criteria** (what must be TRUE):
  1. display.cjs STAGE_VERBS and STAGE_BG maps include entries for `migrate` and `quick` stages (no more "Unknown stage" banners)
  2. `handleQuick` in rapid-tools.cjs parses `--commit` and `--dir` flags from `quick add` arguments instead of concatenating them into description
  3. migrate SKILL.md Step 7 uses a valid subcommand (not `display status`) for final verification output
**Plans:** 1 plan
Plans:
- [ ] 38-01-PLAN.md -- Fix display stage maps (migrate/quick), handleQuick flag parsing, migrate SKILL.md Step 7

### Phase 39: Documentation Refresh
**Goal**: README.md and docs/planning.md accurately reflect post-37.1 interfaces (set-level discuss, /rapid:plan rename)
**Depends on**: Phase 38 (fix code before documenting)
**Requirements**: DOC-01, DOC-03 (gap closure)
**Gap Closure**: Closes requirement gaps from v2.2 audit
**Success Criteria** (what must be TRUE):
  1. README.md command reference shows `/rapid:discuss <set-id>` (not `<wave-id>`) and lists `/rapid:plan` (not `/rapid:plan-set`)
  2. docs/planning.md describes discuss as set-level single-round flow (not wave-level 2-round)
  3. docs/planning.md merges plan-set into plan entry
Plans: 0/1 plans needed
