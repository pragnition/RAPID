# Milestones

## v2.2 Subagent Merger & Documentation (Shipped: 2026-03-12)

**Phases:** 33-39 + 37.1 (8 phases, 16 plans, 31 tasks)
**Requirements:** 11/11 complete (MERGE-01-06, DOC-01-05)
**Timeline:** 3 days (2026-03-10 → 2026-03-12)
**Commits:** 149 | **Files changed:** 196 (+29,166 / -2,709 lines)
**Git range:** Phase 33 → Phase 39

**Delivered:** Merge pipeline restructured with subagent delegation for context efficiency, adaptive conflict resolution with confidence-band routing, comprehensive documentation rewrite, and new /rapid:migrate and /rapid:quick commands.

**Key accomplishments:**
1. Merge pipeline restructured with per-set subagent delegation and compressed results (~43 tokens/set)
2. Adaptive conflict resolution with confidence-band routing and per-conflict resolver agents
3. Complete README.md rewrite with architecture diagram, quick starts, and 18-command reference
4. Comprehensive technical documentation (6 docs) covering all 17 skills, 31 agents, state machines, and troubleshooting
5. New /rapid:migrate and /rapid:quick commands with set-level discuss redesign and wave hiding
6. CLI infrastructure fixes and documentation refresh ensuring all commands work end-to-end

---

## v2.1 Improvements & Fixes (Shipped: 2026-03-10)

**Phases:** 25-32 + 27.1, 29.1 (10 phases, 22 plans)
**Requirements:** 39/39 complete
**Timeline:** 1 day (2026-03-09 → 2026-03-10)
**Git range:** feat(25-01) → docs(phase-32)

**Delivered:** Streamlined workflow with agent registration pipeline, numeric ID shortcuts, concern-based review scoping, wave orchestration, and plan verification.

**Key accomplishments:**
1. GSD decontamination -- all agent types renamed to RAPID-native
2. Numeric ID infrastructure for set/wave references across all skills
3. UX branding banners and color-coded agent type display
4. Skill-to-agent overhaul with build-agents pipeline (26 generated agents)
5. Workflow clarity with next-step guidance and coarser job sizing
6. Batched questioning during discuss phase (halved interactions)
7. Set-based review replacing wave-level review with directory chunking
8. Plan verifier agent for coverage, implementability, and consistency validation
9. Wave orchestration with dependency-aware sequencing and auto-chaining
10. Context-efficient review with scoper delegation and concern-based scoping

---

## v2.0 Mark II (Shipped: 2026-03-09)

**Phases:** 16-24 (9 phases, 29 plans)
**Requirements:** 50/50 complete
**Timeline:** 3 days (2026-03-06 → 2026-03-09)
**Commits:** 223 | **Files changed:** 219 (+43,208 / -3,311 lines)
**Git range:** feat(16-01) → docs(phase-24)

**Delivered:** Complete overhaul of RAPID's development workflow around Sets/Waves/Jobs hierarchy with state machine foundation, comprehensive review pipeline, and adapted merge system.

**Key accomplishments:**
1. Hierarchical state machine with Zod schemas, validated transitions, and crash recovery
2. Overhauled /init with greenfield/brownfield detection, parallel research agents, and automatic roadmap creation
3. Full set lifecycle with worktree isolation, scoped CLAUDE.md, set planning, pause/resume/cleanup
4. Wave planning pipeline: discuss → research → plan → validate with contract enforcement
5. Parallel job execution with atomic commits, progress tracking, and dual-mode dispatch
6. 3-stage adversarial review module: unit tests, bug hunt (hunter/advocate/judge), Playwright UAT
7. Merge pipeline v2.0: 5-level conflict detection, 4-tier resolution cascade, bisection/rollback
8. Full Mark II documentation: DOCS.md (17 commands, architecture) + README.md landing page

---
