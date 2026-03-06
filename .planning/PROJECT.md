# RAPID — Rapid Agentic Parallelizable and Isolatable Development

## What This Is

RAPID is a Claude Code plugin (metaprompting framework) that enables team-based parallel development. Unlike linear frameworks like GSD and PAUL where phases depend on previous phases and block other developers, RAPID ensures that work can be planned into isolated, parallelizable "sets" that multiple developers can build simultaneously in their own git worktrees, then merge back together through an automated review process.

## Core Value

Multiple developers using Claude Code can work on the same project simultaneously without blocking each other, with confidence that their independent work will merge cleanly.

## Current Milestone: v2.0 Mark II

**Goal:** Major overhaul of the workflow hierarchy, agent system, and development lifecycle — restructuring around Sets/Waves/Jobs with comprehensive review capabilities and an adapted merge pipeline.

**Target features:**
- New hierarchy: Project > Milestones > Sets > Waves > Jobs
- Overhauled /init with greenfield/brownfield detection and roadmap creation
- /set-init for worktree+branch creation per set with set planning
- Per-wave discuss > plan > execute > review loop
- Review module with UAT, unit testing, and bug hunting (hunter/devils-advocate/judge pipeline)
- Merger agent adapted from gsd_merge_agent with 5-level conflict detection
- State machine for continuous state tracking across context resets
- AskUserQuestion-driven UX throughout all commands

## Requirements

### Validated

- Sets defined during planning with interface contracts and boundaries
- Each set gets its own git worktree/branch for physical isolation
- Interface contracts define boundaries between sets upfront
- Loose sync model — shared planning gate, independent execution phases
- Git-native shared state with lock files to prevent concurrent modification
- Merge reviewer agent that does deep code review and blocks on contract/test violations
- Cleanup agent spawnable when merge reviewer finds issues
- CLAUDE.md generation with full context (code style, architecture patterns, API conventions, project knowledge)
- EXPERIMENTAL_AGENT_TEAMS support with subagent fallback
- Plugin architecture (skills, agents, hooks in .claude/)
- Discuss/plan/execute phase strategy per set
- Styling guide auto-generated during init for cross-worktree consistency
- All skills use AskUserQuestion for decision gates
- Install skill detects shell, auto-sources config, verifies RAPID_TOOLS
- Error recovery paths with structured options replace bare STOP handling
- Progress indicators during subagent operations

### Active

- [ ] Sets/Waves/Jobs hierarchy replacing linear phase model
- [ ] Overhauled /init with integrated roadmap creation
- [ ] /set-init command for per-set worktree+branch creation
- [ ] Wave Planner agent for per-wave parallel job planning
- [ ] Job Planner agent for detailed per-job implementation planning
- [ ] Executor agent for job execution with atomic commits
- [ ] Review module: UAT testing with Playwright automation
- [ ] Review module: Unit test agent with test plan approval flow
- [ ] Review module: Bug hunting pipeline (hunter/devils-advocate/judge)
- [ ] Merger agent adapted from gsd_merge_agent (5-level conflict detection, tiered resolution)
- [ ] State machine with continuous tracking across context resets
- [ ] Orchestrator agent for command dispatch and subagent spawning

### Out of Scope

- Standalone CLI — RAPID is a Claude Code plugin, not its own binary
- Central server/service — all state is git-native
- /quick ad-hoc task command — deferred to v2.1
- /insert-job ad-hoc job insertion — deferred to v2.1
- Fully synchronized phase gates — sets have independent phase lifecycles with loose sync points

## Context

- Inspired by GSD (get-shit-done) and PAUL metaprompting frameworks
- GSD uses a linear phase model: Phase 1 > Phase 2 > Phase 3, each depending on the previous
- Both work well for solo developers but break down with teams due to blocking
- Claude Code supports EXPERIMENTAL_AGENT_TEAMS for multi-agent coordination
- Claude Code plugin architecture provides skills, agents, hooks, and commands
- Git worktrees allow multiple branches to be checked out simultaneously in separate directories
- The project will be hosted at github.com/fishjojo1/RAPID
- v1.0 and v1.1 established the core plugin infrastructure — v2.0 selectively reuses proven components
- gsd_merge_agent (mark2-plans/gsd_merge_agent/) provides a proven merge pipeline to adapt
- Review module specs (mark2-plans/review-module/) define hunter/devils-advocate/judge/unit-test agent architecture

## Constraints

- **Platform**: Must be a Claude Code plugin — leverages existing plugin infrastructure (skills, agents, hooks)
- **State management**: Git-native only — no external services, databases, or APIs required
- **Compatibility**: Must detect and leverage EXPERIMENTAL_AGENT_TEAMS when available, gracefully fall back to subagents
- **Isolation**: Sets must be truly independent — no shared mutable state during execution except through defined sync points
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
| Selective reuse for v2.0 | Keep proven v1.0 components (agent framework, plugin shell, context gen, worktrees), rewrite workflow/planning/review/merge | — Pending |
| Adapt gsd_merge_agent for merger | Proven 5-level conflict detection and tiered resolution, already works for parallel branch merging | — Pending |
| Hunter/Devils-Advocate/Judge bug pipeline | Adversarial multi-agent approach minimizes false negatives while pruning false positives | — Pending |
| Jobs ≈ v1.0 plans in granularity | Proven granularity from v1.0 — contains multiple related tasks per job | — Pending |
| Defer /quick and /insert-job to v2.1 | Focus v2.0 on core workflow overhaul, add ad-hoc features later | — Pending |

---
*Last updated: 2026-03-06 after milestone v2.0 start*
