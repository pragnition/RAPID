# Roadmap: RAPID

## Milestones

- ✅ **v1.0 MVP** - Phases 1-9 (shipped 2026-03-03)
- ✅ **v1.1 Polish** - Phases 10-15 (shipped 2026-03-06)
- ✅ **v2.0 Mark II** - Phases 16-24 (shipped 2026-03-09)
- 🚧 **v2.1 Improvements & Fixes** - Phases 25-32 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (25, 26, 27): Planned milestone work
- Decimal phases (25.1, 25.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 25: GSD Decontamination** - Remove all GSD vestiges from source, tests, and runtime agent identities (completed 2026-03-09)
- [x] **Phase 26: Numeric ID Infrastructure** - Enable numeric shorthand for set and wave references across all skills (completed 2026-03-09)
- [x] **Phase 27: UX Branding & Colors** - Add RAPID branding banners and color-coded agent type display (completed 2026-03-09)
- [x] **Phase 28: Workflow Clarity** - Streamline workflow ordering, wave context, next-step guidance, and job sizing (completed 2026-03-09)
- [x] **Phase 29: Discuss Phase Optimization** - Batch related questions to halve user interactions during discuss (completed 2026-03-10)
- [ ] **Phase 30: Plan Verifier** - New agent that validates job plans for coverage, implementability, and consistency
- [ ] **Phase 31: Wave Orchestration** - Auto-chain wave planning and execution with dependency-aware sequencing
- [ ] **Phase 32: Review Efficiency** - Scoper agent delegates focused context to review agents, reducing token waste

## Phase Details

### Phase 25: GSD Decontamination
**Goal**: Agents identify as RAPID-native at every layer -- source code, test assertions, and runtime agent spawn names
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. No source file in src/ contains "gsd" in any agent type name or variable identifier
  2. All agent spawn calls in SKILL.md files use "rapid-{role}" naming in the Agent tool description
  3. All test assertions reference RAPID-native names (no gsd_state_version or gsd-* patterns)
  4. Running any skill shows "rapid-{role}" in the Claude Code UI agent label, never "gsd-{role}"
**Plans**: 1 plan

Plans:
- [ ] 25-01-PLAN.md -- Rename gsd_state_version, add migration function, archive legacy directories

### Phase 26: Numeric ID Infrastructure
**Goal**: Users can reference sets and waves by short numeric index instead of typing full string IDs
**Depends on**: Phase 25
**Requirements**: UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. User can type `/set-init 1` and it resolves to the first set defined in STATE.json
  2. User can type `/wave-plan 1.1` and it resolves to set 1, wave 1
  3. Full string IDs (e.g., `/discuss set-01-foundation`) still work identically to before
  4. All 7+ skills that accept set or wave arguments support numeric resolution consistently
**Plans**: 2 plans

Plans:
- [ ] 26-01-PLAN.md -- TDD: Core resolver module (resolve.cjs) + CLI integration + tests
- [ ] 26-02-PLAN.md -- Integrate resolver into all 11 skills + status display with numeric indices

### Phase 27: UX Branding & Colors
**Goal**: Terminal output is visually organized with RAPID branding and color-coded agent type indicators
**Depends on**: Phase 25 (clean agent names needed before color-coding them)
**Requirements**: UX-06, UX-07
**Success Criteria** (what must be TRUE):
  1. Each stage transition (init, discuss, wave-plan, execute, review, merge) displays a branded RAPID banner in terminal
  2. Planner agents display with a distinct color (e.g., blue) in their output headers
  3. Executor agents display with a distinct color (e.g., green) and reviewer agents with another (e.g., red)
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md -- Core display module + agent ROLE_COLORS map with TDD
- [ ] 27-02-PLAN.md -- Wire display into rapid-tools CLI + add banner calls to 7 skills

### Phase 27.1: Skill-to-Agent Overhaul (INSERTED)

**Goal:** All 26 role modules are registered as Claude Code agents in `agents/`, skills spawn agents by name instead of reading role modules inline, and legacy assembler infrastructure is removed
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, AGENT-07
**Depends on:** Phase 27
**Success Criteria** (what must be TRUE):
  1. `agents/` contains 26 .md files, each with valid YAML frontmatter (name, description, tools, model, color)
  2. `node src/bin/rapid-tools.cjs build-agents` regenerates all 26 agents from source modules
  3. No skill file contains `cat src/modules/roles/` or inline role module content
  4. Every agent-spawning skill references agents by registered name (e.g., "Spawn the rapid-bug-hunter agent")
  5. assembler.cjs is deleted, config.json has no agents section, assemble-agent CLI is removed
  6. setup.sh calls build-agents during installation
**Plans:** 3/3 plans complete

Plans:
- [x] 27.1-01-PLAN.md -- Build-agents infrastructure: add missing role entries, create build-agents command, TDD tests, generate 26 agents
- [x] 27.1-02-PLAN.md -- Update 8 agent-spawning skills to reference registered agents by name
- [x] 27.1-03-PLAN.md -- Normalize remaining 9 skills, remove assembler.cjs, clean config.json

### Phase 28: Workflow Clarity
**Goal**: Users and agents always know what step comes next, with correct context flowing between stages
**Depends on**: Phase 26 (numeric IDs used in next-step suggestions)
**Requirements**: FLOW-01, FLOW-02, FLOW-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Wave-plan skill accepts set+wave context (e.g., `/wave-plan 1.1`) and resolves both correctly
  2. Every agent's system prompt includes the canonical workflow order (init -> set-init -> discuss -> wave-plan -> execute -> review -> merge)
  3. Job granularity defaults to fewer, larger jobs per wave (coarser than v2.0 defaults)
  4. Each skill, upon successful completion, prints the exact next command the user should run with pre-filled numeric arguments
**Plans**: 2 plans

Plans:
- [ ] 28-01-PLAN.md -- TDD: --set flag on resolveWave, workflow order in core-identity.md, job granularity in role modules, rebuild agents
- [ ] 28-02-PLAN.md -- Replace end-of-skill AskUserQuestion with next-step blocks in all 7 stage skills, integrate --set flag in wave-aware skills

### Phase 29: Discuss Phase Optimization
**Goal**: Users answer half as many sequential questions during the discuss phase without losing decision quality
**Depends on**: Phase 28 (workflow clarity ensures discuss fits cleanly in the pipeline)
**Requirements**: UX-05
**Success Criteria** (what must be TRUE):
  1. Discuss phase presents related questions grouped into at most 2 interactions per gray area (down from 4)
  2. Each interaction presents a batched set of related questions with multiSelect or structured options
  3. Decision quality is preserved -- all gray areas from research are still resolved before planning begins
**Plans**: 1 plan

Plans:
- [ ] 29-01-PLAN.md -- Rewrite Step 4 (master delegation toggle) and Step 5 (2-round batched discussion) in discuss SKILL.md

### Phase 29.1: Make the Reviewing Set-Based Instead of Wave-Based (INSERTED)

**Goal:** Review pipeline runs once across all changed files at the set level instead of iterating per-wave, with directory chunking for parallel agent execution on large scopes
**Requirements**: SET-REVIEW-01, SET-REVIEW-02, SET-REVIEW-03, SET-REVIEW-04, SET-REVIEW-05, SET-REVIEW-06, SET-REVIEW-07
**Depends on:** Phase 29
**Success Criteria** (what must be TRUE):
  1. `/rapid:review <set-id>` runs a single review pass across all changed files in the set branch (no per-wave iteration)
  2. Wave argument is removed from `/rapid:review` -- review is set-only
  3. Review scope includes changed files plus one-hop dependents across all waves
  4. Unit test and bug hunt stages chunk by directory when scope exceeds 15 files, with parallel agents per chunk
  5. UAT runs once on full set scope (not chunked)
  6. All review artifacts (REVIEW-UNIT.md, REVIEW-BUGS.md, REVIEW-UAT.md, REVIEW-ISSUES.json) live at set level
  7. Findings are tagged with originating wave via JOB-PLAN.md file list attribution
  8. Lean review (wave-level, called from /rapid:execute) is completely unaffected
**Plans:** 4/4 plans complete

Plans:
- [ ] 29.1-01-PLAN.md -- TDD: Refactor review.cjs to set-level API (scopeSetForReview, chunkByDirectory, buildWaveAttribution, set-level issue management)
- [ ] 29.1-02-PLAN.md -- Update CLI review commands for dual-mode (set-level + lean compat), update 6 review role modules, rebuild agents
- [ ] 29.1-03-PLAN.md -- Rewrite review SKILL.md from per-wave loop to set-level orchestration with directory chunking
- [ ] 29.1-04-PLAN.md -- Gap closure: fix UAT issue type enum, add SET-REVIEW requirement definitions to REQUIREMENTS.md

### Phase 30: Plan Verifier
**Goal**: Job plans are validated for coverage gaps, file conflicts, and implementability before execution begins
**Depends on**: Phase 28 (workflow clarity defines where verification fits in pipeline)
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05
**Success Criteria** (what must be TRUE):
  1. After wave planning completes, a verifier agent checks that all wave requirements are covered by job plans
  2. Verifier checks that files referenced in job plans either exist or are explicitly created by an earlier step
  3. Verifier detects when two jobs in the same wave claim ownership of the same file and flags the conflict
  4. Verifier outputs a VERIFICATION-REPORT.md with a clear PASS / PASS_WITH_GAPS / FAIL verdict
  5. A FAIL verdict triggers a user decision gate offering re-plan, override, or cancel options
**Plans**: TBD

Plans:
- [ ] 30-01: TBD
- [ ] 30-02: TBD

### Phase 31: Wave Orchestration
**Goal**: A single command plans and executes all waves in a set with automatic sequencing and no unnecessary approval gates
**Depends on**: Phase 30 (each auto-chained wave needs plan verification)
**Requirements**: WAVE-01, WAVE-02, WAVE-03, WAVE-04
**Success Criteria** (what must be TRUE):
  1. User runs one command to plan all waves in a set, and waves are planned sequentially by default
  2. Waves with no file overlap or cross-references are detected and planned in parallel
  3. Dependent waves plan sequentially, with predecessor planning artifacts available to the next wave's planner
  4. Execute stage runs waves in order without requiring per-wave user approval between waves
**Plans**: TBD

Plans:
- [ ] 31-01: TBD
- [ ] 31-02: TBD

### Phase 32: Review Efficiency
**Goal**: Review agents receive only the files relevant to their concern, reducing context waste by 60-80%
**Depends on**: Phase 25 (role module stubs), independent of Phases 30-31
**Requirements**: REV-01, REV-02, REV-03, REV-04
**Success Criteria** (what must be TRUE):
  1. A scoper agent categorizes changed files by concern (e.g., state logic, UI, tests) before any review agent runs
  2. Each review agent receives only the files the scoper assigned to its concern area
  3. Files the scoper is uncertain about are included in all review scopes as cross-cutting (no silent omissions)
  4. Review results from scoped agents are merged before presentation to the user
**Plans**: TBD

Plans:
- [ ] 32-01: TBD
- [ ] 32-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 25 -> 26 -> 27 -> 27.1 -> 28 -> 29 -> 29.1 -> 30 -> 31 -> 32
Note: Phase 27 and Phase 32 can run in parallel with their neighbors (independent tracks).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 25. GSD Decontamination | 1/1 | Complete    | 2026-03-09 | - |
| 26. Numeric ID Infrastructure | 2/2 | Complete    | 2026-03-09 | - |
| 27. UX Branding & Colors | 2/2 | Complete    | 2026-03-09 | - |
| 27.1 Skill-to-Agent Overhaul | 3/3 | Complete    | 2026-03-09 | - |
| 28. Workflow Clarity | 2/2 | Complete    | 2026-03-09 | - |
| 29. Discuss Phase Optimization | 1/1 | Complete    | 2026-03-10 | - |
| 29.1 Set-Based Review | 4/4 | Complete    | 2026-03-10 | - |
| 30. Plan Verifier | v2.1 | 0/? | Not started | - |
| 31. Wave Orchestration | v2.1 | 0/? | Not started | - |
| 32. Review Efficiency | v2.1 | 0/? | Not started | - |
