# RAPID — Rapid Agentic Parallelizable and Isolatable Development

## What This Is

RAPID is a Claude Code plugin (metaprompting framework) that enables team-based parallel development. Unlike linear frameworks like GSD and PAUL where phases depend on previous phases and block other developers, RAPID ensures that work can be planned into isolated, parallelizable "sets" that multiple developers can build simultaneously in their own git worktrees, then merge back together through an automated review process.

## Core Value

Multiple developers using Claude Code can work on the same project simultaneously without blocking each other, with confidence that their independent work will merge cleanly.

## Current Milestone: v1.1 UI UX Improvements

**Goal:** Replace freeform interaction patterns with structured prompts, polish install flow, add error recovery paths, and improve visibility during long operations.

**Target features:**
- Structured AskUserQuestion prompts across all 8+ skills
- Shell detection and auto-sourcing after install
- Error recovery paths replacing bare "STOP" handling
- Progress indicators during subagent operations

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

### Active

- [ ] All skills use AskUserQuestion for decision gates (14 prompt points)
- [ ] Install skill detects shell, auto-sources config, verifies RAPID_TOOLS
- [ ] Error recovery paths with structured options replace bare STOP handling
- [ ] Progress indicators during subagent operations

### Out of Scope

- Standalone CLI — RAPID is a Claude Code plugin, not its own binary
- Central server/service — all state is git-native
- Ad-hoc set creation during execution — sets are defined during planning only
- Fully synchronized phase gates — sets have independent phase lifecycles with loose sync points

## Context

- Inspired by GSD (get-shit-done) and PAUL metaprompting frameworks
- GSD uses a linear phase model: Phase 1 → Phase 2 → Phase 3, each depending on the previous
- PAUL provides similar structured development but also linear
- Both work well for solo developers but break down with teams due to blocking
- Claude Code supports EXPERIMENTAL_AGENT_TEAMS for multi-agent coordination
- Claude Code plugin architecture provides skills, agents, hooks, and commands
- Git worktrees allow multiple branches to be checked out simultaneously in separate directories
- The project will be hosted at github.com/fishjojo1/RAPID

## Constraints

- **Platform**: Must be a Claude Code plugin — leverages existing plugin infrastructure (skills, agents, hooks)
- **State management**: Git-native only — no external services, databases, or APIs required
- **Compatibility**: Must detect and leverage EXPERIMENTAL_AGENT_TEAMS when available, gracefully fall back to subagents
- **Isolation**: Sets must be truly independent — no shared mutable state during execution except through defined sync points

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude Code plugin (not standalone CLI) | Leverages existing plugin infrastructure, familiar to Claude Code users | — Pending |
| Git worktrees for physical isolation | Native git feature, no external tools needed, clean separation | — Pending |
| Interface contracts between sets | Enables true parallelism — each dev builds against contracts, not each other's code | — Pending |
| Git + lock files for shared state | Zero infrastructure requirements, works offline, auditable via git history | — Pending |
| Loose sync (shared planning gate, independent execution) | Pragmatic balance — ensures alignment before work starts, freedom during execution | — Pending |
| Sets defined at planning time only | Keeps isolation guarantees tight, prevents scope creep during execution | — Pending |
| Full-context CLAUDE.md generation | Every Claude instance needs consistent knowledge — style, patterns, conventions, project context | — Pending |
| Team-first design (solo = team of one) | Avoids separate code paths, ensures the parallel model works at any scale | — Pending |

---
*Last updated: 2026-03-05 after milestone v1.1 start*
