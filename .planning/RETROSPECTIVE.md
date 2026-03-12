# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Mark II

**Shipped:** 2026-03-09
**Phases:** 9 | **Plans:** 29

### What Was Built
- Hierarchical state machine (project > milestone > set > wave > job) with Zod-validated transitions
- Full Sets/Waves/Jobs development lifecycle: init → set-init → discuss → plan → execute → review → merge
- 3-stage adversarial review pipeline: unit tests, bug hunt (hunter/advocate/judge), Playwright UAT
- Merge pipeline v2.0: 5-level conflict detection, 4-tier resolution cascade, bisection recovery, rollback
- 17 skills, 21 runtime libraries, 14 agent role modules
- Comprehensive DOCS.md (17 commands, architecture, state machine) and README.md landing page

### What Worked
- Selective reuse from v1.0 — agent framework, plugin shell, context gen, worktrees all carried forward without rewrites
- Phase-by-phase execution from state machine outward (16→17→18→19→20→21→22→23→24) ensured each layer was solid before building on it
- Adapting gsd_merge_agent provided a proven conflict detection model without designing from scratch
- Zod schemas at every boundary caught integration issues early
- Summary-driven phase tracking allowed clean context handoffs between sessions

### What Was Inefficient
- v1.0 phases 4-9 had incomplete plan checkboxes in ROADMAP.md despite having SUMMARY.md files — created confusion about completion status
- STATE.md progress counter (65/66, 98%) didn't distinguish v2.0 phases from v1.0 phases, making milestone readiness unclear
- Phase 09.1 (marketplace packaging) still partial (2/3 plans) from v1.0 — tech debt carried forward
- No milestone audit run before completion — recommended but skipped

### Patterns Established
- Wave artifacts stored at `.planning/waves/{setId}/{waveId}/` — namespaced by set for multi-set projects
- Three-stage planning pipeline: WAVE-CONTEXT → WAVE-RESEARCH → WAVE-PLAN → JOB-PLAN
- Leaf-agent pattern: specialized agents (merger, reviewer) don't spawn sub-agents or make commits
- AskUserQuestion at every decision gate — 13 gates in review pipeline alone
- Contract validation before execution — violations flagged with escalation options (fix plan, update contract, override)

### Key Lessons
1. Clean breaks beat migration paths — deleting state.cjs and starting fresh with state-machine.cjs avoided hybrid state confusion
2. Sequential pipeline with parallel fan-out is the sweet spot — research → wave plan → parallel job planners balances thoroughness with speed
3. Adversarial review (hunter + advocate + judge) is more trustworthy than single-pass review but needs scope controls to manage token cost
4. Agent roles should be leaf-only: no sub-agent spawning, no commits, clear tool boundaries per role
5. Defer features aggressively — /quick and /insert-job pushed to v2.1 kept v2.0 scope manageable

### Cost Observations
- Model mix: primarily opus for planning and execution, sonnet for research agents
- 223 commits across 3 days of development
- Notable: 9 phases with 29 plans completed in 3 days — high velocity enabled by reuse of v1.0 infrastructure

---

## Milestone: v2.1 — Improvements & Fixes

**Shipped:** 2026-03-10
**Phases:** 10 | **Plans:** 22

### What Was Built
- GSD decontamination — all agent types renamed to RAPID-native identifiers
- Numeric ID infrastructure for set/wave references across all 17 skills
- UX branding banners and color-coded agent type display
- Skill-to-agent overhaul: 26 generated agents from role modules via build-agents pipeline
- Set-based review replacing wave-level review with directory chunking
- Plan verifier agent for coverage, implementability, and consistency validation
- Wave orchestration with dependency-aware sequencing and auto-chaining
- Context-efficient review with scoper delegation and concern-based scoping

### What Worked
- Decimal phase numbering (27.1, 29.1) for urgent insertions without renumbering
- Build-agents pipeline reduced agent maintenance from manual to automated
- Batched questioning in discuss phase halved user interactions

### What Was Inefficient
- v2.1 shipped without retrospective entry (added retroactively during v2.2 completion)
- 10 phases in 1 day was high velocity but limited integration testing between phases

### Key Lessons
1. Build pipelines (build-agents) that generate artifacts from source modules prevent drift
2. Set-level operations (review, discuss) are more natural than wave-level for users
3. Scoper agents can reduce review token cost by delegating focused context

---

## Milestone: v2.2 — Subagent Merger & Documentation

**Shipped:** 2026-03-12
**Phases:** 8 | **Plans:** 16

### What Was Built
- Merge pipeline restructured with per-set subagent delegation (~43 tokens/set compressed results)
- Adaptive conflict resolution with confidence-band routing (<0.3 human, 0.3-0.8 resolver agent, >0.8 auto)
- Complete README.md rewrite with architecture diagram, quick starts, 18-command reference
- Technical documentation: 6 docs covering all 17 skills, 31 agents, state machines, troubleshooting
- /rapid:migrate command with detect-confirm-backup-transform interactive flow
- /rapid:quick command for freeform task execution with auto-commit and state tracking
- Set-level discuss redesign (single-round replacing wave-level 2-round)
- Wave hiding across all user-facing skills
- CLI infrastructure fixes for display stages, flag parsing, and SKILL.md subcommands

### What Worked
- Milestone audit before completion caught 4 integration issues and 2 stale documentation gaps
- Gap closure phases (38, 39) added post-audit ensured all requirements were satisfied before shipping
- Synopsis+link pattern for technical docs prevented documentation rot (single source of truth in SKILL.md)
- Compressed result protocol (~43 tokens/set) well under 100-token budget — merge stays context-efficient

### What Was Inefficient
- Phase 37.1 (inserted) caused documentation staleness in Phase 36 README and Phase 37 technical docs — required Phase 39 to fix
- Audit found FIX-03/FIX-04 integration issues that should have been caught during 37.1 execution
- SUMMARY.md one_liner fields were null across all phases — summary-extract tool not utilized during plan execution

### Patterns Established
- Milestone audit → gap closure phases → completion is the reliable pattern for clean milestone shipping
- Subagent delegation pattern: dispatch → collect → compress eliminates orchestrator context overflow
- Confidence-band routing: tiered automation with human safety net at both ends
- Synopsis+link for documentation: 2-3 sentence synopsis + SKILL.md reference as authoritative source

### Key Lessons
1. Inserted phases (decimal) invalidate documentation written by earlier phases — plan documentation refresh as part of any inserted phase
2. Milestone audits are not optional — they catch integration issues that individual phase verification misses
3. Subagent delegation with compressed results is the scalable pattern for any pipeline that touches multiple independent units
4. Tool-calling reliability in agents requires explicit env loading — multi-fallback preamble is the proven approach
5. Gap closure phases are lightweight and effective — better to add them than ship with known gaps

### Cost Observations
- Model mix: primarily opus for planning and execution, haiku for research agents
- 149 commits across 3 days of development
- Notable: 8 phases (16 plans, 31 tasks) completed in 3 days — consistent with v2.0 velocity

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Days | Key Change |
|-----------|--------|-------|------|------------|
| v1.0 Core | 11 | 28 | 3 | Established plugin architecture, agent framework, worktree orchestration |
| v1.1 UX | 6 | 8 | 3 | AskUserQuestion for all decision gates, error recovery, progress indicators |
| v2.0 Mark II | 9 | 29 | 3 | Sets/Waves/Jobs hierarchy, state machine, review pipeline, merge overhaul |
| v2.1 Improvements | 10 | 22 | 1 | Agent build pipeline, set-based review, wave orchestration, plan verifier |
| v2.2 Subagent Merger | 8 | 16 | 3 | Merge subagent delegation, adaptive conflict resolution, comprehensive docs |

### Top Lessons (Verified Across Milestones)

1. Selective reuse accelerates major rewrites — v2.0 reused v1.0 agent framework and worktrees, proving the component boundaries were right
2. Git-native state (no external services) keeps the system simple and portable across milestones
3. Milestone audits catch integration issues that per-phase verification misses — run before every completion
4. Inserted phases (decimal) require documentation refresh — plan for staleness when inserting urgent work
5. Subagent delegation with compressed results is the scalable pattern for context-bounded pipelines
