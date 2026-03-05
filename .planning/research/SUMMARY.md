# Project Research Summary

**Project:** RAPID -- Rapid Agentic Parallelizable and Isolatable Development
**Domain:** Claude Code plugin / metaprompting framework for team-based parallel development
**Researched:** 2026-03-03
**Confidence:** HIGH

## Executive Summary

RAPID is a Claude Code plugin that orchestrates parallel development across git worktrees using interface contracts as the coordination mechanism. The research confirms this is a well-supported design: Claude Code's plugin system (commands, agents, skills, hooks), native worktree support (`isolation: worktree`), and experimental agent teams provide all the infrastructure needed. The recommended stack is deliberately zero-dependency -- bash scripts, Node.js (built into Claude Code's runtime), git, and Markdown with YAML frontmatter. No npm install step, no build process, no external services. The reference implementation (GSD plugin) validates this bash-first, node-when-needed approach. Existing frameworks (GSD, PAUL, Agent Orchestrator, Parallel Code) all solve parts of this problem, but none combine planning-time contract definition with worktree isolation and automated merge review -- this is RAPID's core differentiator.

The recommended approach follows a seven-component architecture organized into four build phases: Foundation (state management, orchestrator shell), Planning (planning engine, contract system), Execution (worktree manager, context generator, hook engine), and Integration (merge pipeline, agent teams). The most critical architectural decision is the "planning gate, independent execution, coordinated merge" lifecycle. All parallelism planning happens upfront with explicit interface contracts. After the planning gate, each set executes independently in its own worktree. Coordination resumes only at merge time, where a dedicated reviewer agent validates contract compliance. This "loose sync" model is what makes RAPID viable for teams -- it avoids both the blocking linearity of GSD/PAUL and the coordination chaos of fully ad-hoc agent teams.

The top risks are: (1) custom agents cannot spawn subagents/teams (confirmed bug #23506), requiring RAPID to use skill/command-based entry points instead of `--agent` mode; (2) inter-agent specification misalignment where agents interpret contracts differently, mitigated by machine-verifiable contracts with typed examples and test fixtures; (3) file-based lock race conditions, mitigated by using `mkdir`-based atomic locking with stale detection; (4) context window overflow from injecting too much project context into worktree CLAUDE.md files, mitigated by per-set scoping and a 15K token budget; and (5) merge conflicts from shared files (package.json, config files) not covered by contracts, mitigated by explicit shared-file ownership planning.

## Key Findings

### Recommended Stack

RAPID requires zero external dependencies beyond what Claude Code already provides. The plugin is a collection of Markdown files (commands, agents, skills), bash scripts (git operations, locking, state management), and Node.js scripts (JSON processing for hook stdin/stdout protocol). State lives in JSON and Markdown files under `.planning/`, committed to git. Locking uses `mkdir`-based atomic operations -- no npm packages needed.

**Core technologies:**
- **Claude Code Plugin System (v2.1.62+):** Platform for commands, agents, skills, hooks -- this is not a choice, it is the platform
- **Bash scripts:** Hook scripts, git worktree management, file locking, state management -- the primary implementation language
- **Node.js (v18+, built-in):** Complex hook scripts requiring JSON processing (hook stdin/stdout protocol)
- **Git with worktrees (v2.30+):** Core isolation mechanism -- each set gets its own worktree and branch
- **Markdown with YAML frontmatter:** All plugin component definitions, interface contracts, state files
- **EXPERIMENTAL_AGENT_TEAMS:** Optional enhancement for multi-agent coordination; always implement subagent fallback
- **jq (v1.6+):** JSON processing from bash scripts; dependency check needed at init time

### Expected Features

**Must have (table stakes):**
- Project initialization (`/rapid:init`) -- scaffold `.planning/`, detect existing codebase, generate CLAUDE.md and style guide
- Set-based planning with interface contracts (`/rapid:plan`) -- decompose work into parallelizable sets with explicit API/data/behavioral contracts
- Git worktree orchestration -- create, manage, cleanup worktrees per set with branch lifecycle management
- Per-set execution in fresh context windows (`/rapid:execute`) -- subagent per set with only relevant context
- Merge reviewer agent -- deep code review validating contract compliance, test coverage, style consistency
- State management with session resume -- STATE.md tracking set statuses, decisions, blockers; resume from any point
- Progress tracking (`/rapid:status`) -- show all sets, lifecycle phases, and next actions
- CLAUDE.md generation -- auto-generated per-worktree context files with contracts, style guide, architecture knowledge
- Help command (`/rapid:help`) -- command reference and workflow guidance

**Should have (differentiators -- add after core validation):**
- Cleanup agent -- spawned on-demand when merge reviewer finds fixable issues
- Agent Teams detection with subagent fallback -- dual-mode execution
- Set dependency graph -- DAG of set relationships with ordering constraints
- Cross-worktree style consistency -- auto-generated style guide from codebase analysis
- Verification/UAT phase -- structured acceptance testing beyond merge review

**Defer (v2+):**
- Cross-agent-tool support (Codex, Gemini CLI)
- Replan workflow (`/rapid:replan`)
- Custom merge strategies
- Issue tracker integration (GitHub Issues, Linear)
- Plugin/extension system

### Architecture Approach

The architecture is a seven-layer system with clear component boundaries: Orchestrator Layer (thin commands dispatching to agents), Planning Engine (set decomposition and boundary definition), Contract System (interface definition and enforcement), State Management Layer (git-native `.planning/` directory with lock files), Worktree Manager (git worktree lifecycle), Context Generator (per-worktree CLAUDE.md generation), and Merge Pipeline (validation, review, merge, cleanup). The key patterns are: thin command / fat agent (commands validate preconditions, agents do work in their own context), state as source of truth (all state in `.planning/`, committed to git), progressive context loading (load only what the current operation needs), and hook-based enforcement (deterministic boundary checking via PreToolUse hooks, not just prompting).

**Major components:**
1. **Orchestrator Layer** -- user-facing slash commands; validates preconditions, dispatches to specialized agents
2. **State Management** -- `.planning/` directory with JSON config, Markdown state, per-set definitions; `mkdir`-based locking
3. **Planning Engine** -- `rapid-planner` agent that decomposes work into sets with file ownership and contracts
4. **Contract System** -- structured interface definitions (types, endpoints, schemas) with enforcement at merge time
5. **Worktree Manager** -- creates/tracks/cleans up git worktrees per set; integrates with Claude Code native worktree support
6. **Context Generator** -- produces per-worktree CLAUDE.md with set-specific contracts, style guide, architecture context
7. **Merge Pipeline** -- multi-stage pipeline: pre-merge validation, test execution, reviewer agent, decision gate, merge, cleanup

### Critical Pitfalls

1. **Custom agents cannot spawn subagents/teams (bug #23506)** -- Design RAPID around skills and commands invoked from plain `claude` sessions, not `--agent` mode. The Task tool is missing in custom agent sessions, breaking all orchestration. Validate the spawning pathway in Phase 1 before building anything on top.

2. **Inter-agent specification misalignment** -- The #1 multi-agent failure mode (ICLR 2025, 150+ case study). Make contracts machine-verifiable with TypeScript types, JSON schemas, and concrete examples. Generate contract test stubs that both sides must pass. The merge reviewer must validate contract compliance, not just code quality.

3. **File-based lock race conditions** -- Use `mkdir` for atomic lock acquisition (POSIX atomic). Store PID + timestamp for stale detection. Set 5-minute max lock age. Use fine-grained per-file locks, not a global lock that serializes all operations.

4. **Context window overflow** -- Keep RAPID's total context injection under 15K tokens. Generate per-set CLAUDE.md with only relevant contracts. Limit MCP servers per worktree session. Test with realistic project sizes (5 sets, 20 contracts).

5. **Shared file merge conflicts** -- During planning, explicitly identify shared files (package.json, config, routes) and designate one set as owner of each. Use file-per-set patterns for extensible registries. Dry-merge (`git merge --no-commit`) before attempting resolution.

## Implications for Roadmap

Based on research, the architecture has clear dependency-driven phase ordering. The suggested structure below groups features by component dependency, not arbitrary chunking.

### Phase 1: Foundation -- Plugin Shell and State Management

**Rationale:** Every component reads from and writes to `.planning/`. State management, directory structure, and lock files must be correct before anything else can function. The plugin manifest and command shell must exist to provide the user-facing interface. This phase also validates the critical spawning pathway (bug #23506) before any orchestration logic is built.
**Delivers:** Working plugin skeleton with `/rapid:init`, `/rapid:status`, `/rapid:help`; `.planning/` directory management; `mkdir`-based atomic locking; dependency checking (git version, jq availability, agent teams detection)
**Addresses features:** Project initialization, persistent state, progress tracking, help command
**Avoids pitfalls:** #1 (custom agent spawning -- validate entry point), #3 (lock race conditions -- implement `mkdir` locking), #8 (no nested teams -- design flat orchestration), #10 (hook environment -- build hook test harness), #12 (namespace collision -- deliberate skill naming)

### Phase 2: Planning Engine and Contract System

**Rationale:** Planning produces the artifacts all other components consume. Sets, contracts, and boundaries must be defined before worktrees can be created or execution can begin. The contract system is RAPID's core innovation and the most novel component -- it needs the most design iteration.
**Delivers:** `/rapid:plan` command; `rapid-planner` agent; set decomposition with file ownership; interface contract format (typed, with examples and test stubs); set dependency graph; shared-file ownership identification
**Addresses features:** Set-based planning, interface contract definition, set dependency graph, codebase mapping (basic)
**Avoids pitfalls:** #4 (inter-agent misalignment -- machine-verifiable contracts with concrete examples), #6 (shared file conflicts -- explicit ownership planning)

### Phase 3: Worktree Orchestration and Context Generation

**Rationale:** Execution depends on physical isolation via worktrees and proper context injection via CLAUDE.md. These must work together: worktree creation triggers CLAUDE.md generation, and CLAUDE.md content is scoped to the specific set's contracts and boundaries.
**Delivers:** Worktree Manager (create/track/cleanup worktrees per set); Context Generator (per-worktree CLAUDE.md with contracts, style guide, boundaries); `WorktreeCreate`/`WorktreeRemove` hooks; boundary enforcement via PreToolUse hooks; style guide generation from codebase analysis
**Addresses features:** Git worktree orchestration, CLAUDE.md generation, cross-worktree style consistency, execution with fresh context windows
**Avoids pitfalls:** #2 (branch exclusivity -- never design workflows requiring same branch in multiple worktrees), #5 (context overflow -- per-set scoping, 15K token budget), #7 (worktree pollution -- automated cleanup hooks), #11 (CLAUDE.md inconsistency -- immutable during execution, layered base + per-set), #13 (submodule incompatibility -- detect and handle), #14 (wrong worktree edits -- path scoping in PreToolUse hooks)

### Phase 4: Per-Set Execution Engine

**Rationale:** With state, planning, worktrees, and context in place, the execution engine connects them: spawn subagents in worktrees with proper context, track progress, handle session pause/resume.
**Delivers:** `/rapid:execute` and `/rapid:execute-all` commands; `rapid-executor` agent with `isolation: worktree`; per-set lifecycle management (discuss/plan/execute phases within each set); atomic git commits per task; session pause/resume via STATE.md checkpoints
**Addresses features:** Per-set execution, atomic commits, session pause/resume, discuss phase per set
**Avoids pitfalls:** #9 (premature termination -- explicit "Definition of Done" in CLAUDE.md, verification before marking complete)

### Phase 5: Merge Pipeline and Review

**Rationale:** This is the final stage of the core workflow. Merge review validates that independent work actually integrates. This phase depends on everything above being functional -- you need completed worktrees with executed code to merge and review.
**Delivers:** `/rapid:merge` command; `rapid-reviewer` agent (deep code review against contracts); `rapid-cleanup` agent (targeted fixes when review finds issues); multi-stage merge pipeline (dry merge, test execution, contract validation, review, merge, cleanup); merge ordering based on set dependency graph
**Addresses features:** Merge reviewer agent, cleanup agent, interface contract validation at merge time, verification/UAT
**Avoids pitfalls:** #4 (misalignment caught at merge), #6 (shared file conflicts resolved by reviewer), #9 (premature termination caught by independent verification)

### Phase 6: Agent Teams Integration and Polish

**Rationale:** Agent teams are an optimization layer on a system that already works with subagents. This phase adds dual-mode support (agent teams when available, subagent fallback when not) and polishes the user experience.
**Delivers:** EXPERIMENTAL_AGENT_TEAMS detection and runtime mode switching; team-based parallel execution with `TeammateIdle`/`TaskCompleted` hooks; quality gates via hook enforcement; improved status dashboard; error message improvements
**Addresses features:** Agent Teams detection with subagent fallback, team-first design
**Avoids pitfalls:** #1 (spawning validation -- by this point, the subagent path is proven), #8 (no nested teams -- flat orchestration confirmed)

### Phase Ordering Rationale

- **Phase 1 before everything:** State management is the central data bus. Every component depends on it. The spawning pathway validation (bug #23506) must happen here to avoid building on a broken foundation.
- **Phase 2 before Phase 3:** Worktrees cannot be created for sets that do not exist. Contracts must be defined before CLAUDE.md can include them.
- **Phase 3 before Phase 4:** Execution requires worktrees and context. Without physical isolation and proper CLAUDE.md injection, agents produce inconsistent, unmerge-able code.
- **Phase 4 before Phase 5:** The merge pipeline operates on completed worktrees. Without executed code, there is nothing to merge or review.
- **Phase 6 last:** Agent teams are experimental and optional. The core system must work without them. Adding them last means the subagent fallback is already battle-tested.
- **Contract system in Phase 2 (early):** Contracts are a cross-cutting concern. Their format affects planning (Phase 2), context generation (Phase 3), execution guidance (Phase 4), and merge validation (Phase 5). Getting the format right early prevents cascading rework.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Planning Engine + Contracts):** The contract format and automated decomposition are novel. No existing framework does this. Needs prototype validation with a real project to determine if contracts are sufficiently specific for LLM agents to follow. Research the specific contract schema, test fixture generation, and planning agent prompt engineering.
- **Phase 5 (Merge Pipeline):** The merge reviewer agent reliably catching contract violations is unproven. Needs research into how to structure the review prompt, what constitutes a "contract violation" in code, and how to handle the reviewer's false positive/negative rate.

Phases with standard patterns (skip deep research):
- **Phase 1 (Foundation):** Plugin structure, state management, and locking are well-documented. GSD provides a reference implementation. Official Claude Code plugin docs cover everything needed.
- **Phase 3 (Worktree Orchestration):** Git worktrees are well-understood. Claude Code's native worktree support is documented. Multiple community projects validate this pattern.
- **Phase 4 (Execution):** Subagent spawning with `isolation: worktree` is a documented Claude Code feature. GSD's wave execution model provides a reference for task-level execution.
- **Phase 6 (Agent Teams):** Official documentation covers the API. The main work is integration, not research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official Claude Code documentation, GSD reference implementation, and git official docs. Zero novel dependencies. |
| Features | HIGH | Comprehensive competitor analysis across 6+ frameworks. Feature priorities validated against PROJECT.md requirements. Clear MVP definition. |
| Architecture | HIGH (structure) / MEDIUM (contracts) | Seven-layer architecture follows proven patterns (thin controller, file-based state, hook enforcement). The contract system's specific format and enforcement for LLM agents is novel and less validated. |
| Pitfalls | HIGH | Critical pitfalls verified via official docs, confirmed GitHub issues, peer-reviewed ICLR 2025 research, and established CS literature on file locking and concurrent systems. |

**Overall confidence:** HIGH -- the platform (Claude Code plugins), isolation mechanism (git worktrees), and coordination patterns (subagents, hooks) are all well-documented with official sources. The main uncertainty is around the contract system's effectiveness for LLM agent coordination, which is RAPID's novel contribution and requires prototype validation.

### Gaps to Address

- **Contract schema design:** No existing framework provides a reference for machine-verifiable interface contracts consumed by LLM agents. The contract format must be concrete enough for automated validation but flexible enough for diverse project types. Needs prototype testing with a real multi-set project during Phase 2 planning.
- **Planning agent decomposition quality:** Automated set decomposition by an LLM is novel. The quality of decomposition (appropriate boundaries, balanced complexity, complete shared-file identification) is hard to predict. Plan for iterative refinement of the planner agent's prompt.
- **Agent Teams stability:** EXPERIMENTAL_AGENT_TEAMS is experimental with known bugs (#23506). The API may change. All agent teams integration must be behind feature detection with graceful degradation. Do not design any core workflow that requires agent teams.
- **Merge reviewer accuracy:** The merge reviewer agent's ability to reliably catch contract violations vs. producing false positives is unknown. Start with a conservative reviewer (strict validation) and tune based on real usage.
- **Disk space at scale:** Each worktree copies the full repo. With 5+ sets on a large project, disk usage could be significant. May need to investigate sparse checkout or shared `node_modules` strategies if this becomes a real problem.

## Sources

### Primary (HIGH confidence)
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) -- plugin system, component types, manifest schema
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams) -- agent teams architecture, hooks, limitations
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents) -- subagent frontmatter, `isolation: worktree`, tool restrictions
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- all hook events, WorktreeCreate/WorktreeRemove, exit codes
- [Claude Code Skills](https://code.claude.com/docs/en/skills) -- skill definition, auto-invocation, frontmatter format
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) -- CLAUDE.md guidance, permission model
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree) -- branch exclusivity, lifecycle, prune
- [GSD Plugin Source](local: ~/.claude/get-shit-done/) -- reference implementation of complex Claude Code plugin
- [Anthropic C Compiler Case Study](https://www.anthropic.com/engineering/building-c-compiler) -- real-world 16-agent parallel development
- [Why Do Multi-Agent LLM Systems Fail? (ICLR 2025)](https://arxiv.org/html/2503.13657v1) -- 14 failure modes, inter-agent misalignment analysis

### Secondary (MEDIUM confidence)
- [GSD GitHub](https://github.com/gsd-build/get-shit-done) -- feature set, wave execution model
- [PAUL Framework](https://github.com/ChristopherKahler/paul) -- PAU loop, state management patterns
- [Composio Agent Orchestrator](https://github.com/ComposioHQ/agent-orchestrator) -- parallel worktree execution, CI handling
- [Parallel Code](https://github.com/johannesjo/parallel-code) -- GUI, worktree management
- [ccswarm](https://github.com/nwiizo/ccswarm) -- role-based agents, worktree isolation
- [CCPM](https://github.com/automazeio/ccpm) -- worktrees for parallel agent execution with GitHub Issues
- [Contract Driven Development](https://dojoconsortium.org/docs/work-decomposition/contract-driven-development/) -- established development practice
- [Claude Code Worktree Guide](https://claudefa.st/blog/guide/development/worktree-guide) -- community documentation

### Tertiary (LOW confidence)
- [proper-lockfile](https://github.com/moxystudio/node-proper-lockfile) -- mkdir-based locking strategy (pattern reference only, not a dependency)
- [Spec-Driven Development Guide](https://www.augmentcode.com/guides/what-is-spec-driven-development) -- SDD patterns, interface-first design

---
*Research completed: 2026-03-03*
*Ready for roadmap: yes*
