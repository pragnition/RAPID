# Milestones

## v2.2 Subagent Merger & Documentation (Shipped: 2026-03-12)

**Phases:** 33-37 (5 phases, 8 plans)
**Requirements:** All complete
**Timeline:** 2 days (2026-03-10 → 2026-03-12)
**Git range:** feat(33-01) → docs(phase-37)

**Delivered:** Restructured merge pipeline with subagent delegation, adaptive conflict resolution, and complete documentation rewrite.

**Key accomplishments:**
1. Merge pipeline restructured with per-set subagent delegation (orchestrator stays lean)
2. Adaptive nesting: confidence-band routing for conflict resolution (auto/resolver/human)
3. Independent sets merge in parallel when DAG allows
4. Fresh README.md with concept-explanation-first layout
5. Technical documentation with agent reference, state machine docs, troubleshooting guide

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
