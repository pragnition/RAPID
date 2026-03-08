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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 Core | 11 | 28 | Established plugin architecture, agent framework, worktree orchestration |
| v1.1 UX | 6 | 8 | AskUserQuestion for all decision gates, error recovery, progress indicators |
| v2.0 Mark II | 9 | 29 | Sets/Waves/Jobs hierarchy, state machine, review pipeline, merge overhaul |

### Top Lessons (Verified Across Milestones)

1. Selective reuse accelerates major rewrites — v2.0 reused v1.0 agent framework and worktrees, proving the component boundaries were right
2. Git-native state (no external services) keeps the system simple and portable across milestones
