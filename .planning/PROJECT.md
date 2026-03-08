# RAPID — Rapid Agentic Parallelizable and Isolatable Development

## What This Is

RAPID is a Claude Code plugin (metaprompting framework) that enables team-based parallel development using a Sets/Waves/Jobs hierarchy. Multiple developers work in isolated git worktrees, go through discuss → plan → execute → review loops per wave, then merge back via an automated pipeline with 5-level conflict detection and adversarial code review.

## Core Value

Multiple developers using Claude Code can work on the same project simultaneously without blocking each other, with confidence that their independent work will merge cleanly.

## Requirements

### Validated

- ✓ Sets defined during planning with interface contracts and boundaries — v1.0
- ✓ Each set gets its own git worktree/branch for physical isolation — v1.0
- ✓ Interface contracts define boundaries between sets upfront — v1.0
- ✓ Loose sync model — shared planning gate, independent execution phases — v1.0
- ✓ Git-native shared state with lock files to prevent concurrent modification — v1.0
- ✓ Merge reviewer agent that does deep code review and blocks on contract/test violations — v1.0
- ✓ Cleanup agent spawnable when merge reviewer finds issues — v1.0
- ✓ CLAUDE.md generation with full context (code style, architecture, API conventions) — v1.0
- ✓ EXPERIMENTAL_AGENT_TEAMS support with subagent fallback — v1.0
- ✓ Plugin architecture (skills, agents, hooks in .claude/) — v1.0
- ✓ Discuss/plan/execute phase strategy per set — v1.0
- ✓ Styling guide auto-generated during init — v1.0
- ✓ All skills use AskUserQuestion for decision gates — v1.1
- ✓ Install skill detects shell, auto-sources config, verifies RAPID_TOOLS — v1.1
- ✓ Error recovery paths with structured options replace bare STOP handling — v1.1
- ✓ Progress indicators during subagent operations — v1.1
- ✓ Sets/Waves/Jobs hierarchy replacing linear phase model — v2.0
- ✓ Hierarchical state machine with Zod schemas and validated transitions — v2.0
- ✓ Overhauled /init with greenfield/brownfield detection and roadmap creation — v2.0
- ✓ /set-init command for per-set worktree+branch creation with set planning — v2.0
- ✓ Wave Planner agent for per-wave parallel job planning — v2.0
- ✓ Job Planner agent for detailed per-job implementation planning — v2.0
- ✓ Executor agent for job execution with atomic commits — v2.0
- ✓ Review module: UAT testing with Playwright automation — v2.0
- ✓ Review module: Unit test agent with test plan approval flow — v2.0
- ✓ Review module: Bug hunting pipeline (hunter/devils-advocate/judge) — v2.0
- ✓ Merger with 5-level conflict detection and 4-tier resolution cascade — v2.0
- ✓ Bisection recovery and rollback with cascade detection — v2.0
- ✓ Orchestrator agent for command dispatch and subagent spawning — v2.0
- ✓ Comprehensive DOCS.md and README.md for Mark II — v2.0

### Active

#### Current Milestone: v2.1 Improvements & Fixes

**Goal:** Streamline the RAPID workflow, remove GSD vestiges, reduce UX friction, and improve context efficiency through better subagent delegation.

**Target features:**
- GSD agent type decontamination in skill files
- Streamlined workflow (init → auto-plan → set-init → discuss → wave-plan → execute → review → merge)
- Parallel wave planning with dependency-aware sequencing
- Plan verifier agent (coverage + implementability checks)
- Numeric ID shorthand for set commands
- Batched questioning during discuss phase
- Context-efficient review with scoper delegation
- Leaner review stage overall

### Out of Scope

- Standalone CLI — RAPID is a Claude Code plugin, not its own binary
- Central server/service — all state is git-native
- Dynamic set creation during execution — sets defined at planning time only
- Fully synchronized phase gates — sets have independent lifecycles with loose sync points
- Fully automated review (no HITL) — AI review without human judgment leads to false confidence
- Real-time cross-set synchronization — destroys isolation guarantees
- AI-only merge conflict resolution — multi-file conflicts need human judgment

## Context

Shipped v2.0 Mark II with ~26,829 LOC (JavaScript/CommonJS + JSON).
Tech stack: Node.js, Zod 3.24.4, git worktrees, Claude Code plugin API.
17 skills, 21 runtime libraries, 14 agent role modules.
Hosted at github.com/fishjojo1/RAPID.

v1.0 established core plugin infrastructure (agent framework, state, worktrees, merge).
v1.1 polished UX with structured prompts and error recovery.
v2.0 overhauled the entire workflow around Sets/Waves/Jobs hierarchy.

## Constraints

- **Platform**: Claude Code plugin — leverages existing plugin infrastructure (skills, agents, hooks)
- **State management**: Git-native only — no external services, databases, or APIs required
- **Compatibility**: Detects EXPERIMENTAL_AGENT_TEAMS when available, falls back to subagents
- **Isolation**: Sets are truly independent — no shared mutable state during execution except defined sync points
- **Shell**: Use ~ instead of $HOME in all shell commands for Node compatibility
- **UX**: AskUserQuestion for all user interactions; batch queries to save tokens/time

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude Code plugin (not standalone CLI) | Leverages existing plugin infrastructure, familiar to Claude Code users | ✓ Good |
| Git worktrees for physical isolation | Native git feature, no external tools needed, clean separation | ✓ Good |
| Interface contracts between sets | Enables true parallelism — each dev builds against contracts, not each other's code | ✓ Good |
| Git + lock files for shared state | Zero infrastructure requirements, works offline, auditable via git history | ✓ Good |
| Loose sync (shared planning gate, independent execution) | Pragmatic balance — ensures alignment before work starts, freedom during execution | ✓ Good |
| Sets defined at planning time only | Keeps isolation guarantees tight, prevents scope creep during execution | ✓ Good |
| Full-context CLAUDE.md generation | Every Claude instance needs consistent knowledge — style, patterns, conventions, project context | ✓ Good |
| Team-first design (solo = team of one) | Avoids separate code paths, ensures the parallel model works at any scale | ✓ Good |
| Selective reuse for v2.0 | Keep proven v1.0 components, rewrite workflow/planning/review/merge | ✓ Good — enabled rapid v2.0 delivery |
| Adapt gsd_merge_agent for merger | Proven 5-level detection and tiered resolution for parallel branch merging | ✓ Good — L1-L4 detection + T1-T2 resolution working |
| Hunter/Devils-Advocate/Judge pipeline | Adversarial multi-agent approach minimizes false negatives while pruning false positives | ✓ Good — 3-cycle iteration with scope narrowing |
| Jobs = v1.0 plans in granularity | Proven granularity — contains multiple related tasks per job | ✓ Good — natural decomposition unit |
| Defer /quick and /insert-job to v2.1 | Focus v2.0 on core workflow overhaul | ⚠️ Revisit — /quick may not be needed if workflow is streamlined |
| Zod 3.24.4 for schemas | CommonJS compatibility (3.25+ breaks require) | ✓ Good — type-safe validation everywhere |
| Hand-rolled state machine (~50 lines) | Simpler than XState, sufficient for hierarchical state tracking | ✓ Good — crash recovery + validated transitions |
| STATE.json replaces STATE.md | Clean break, machine-readable source of truth | ✓ Good — no hybrid state confusion |
| Sequential pipeline with parallel fan-out | Research → wave plan → parallel job planners, each producing validated artifacts | ✓ Good — clean handoff boundaries |

---
*Last updated: 2026-03-09 after v2.1 milestone started*
