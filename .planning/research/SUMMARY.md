# Project Research Summary

**Project:** RAPID Mark II (Rapid Agentic Parallelizable and Isolatable Development)
**Domain:** Metaprompting plugin -- Claude Code workflow overhaul (Sets/Waves/Jobs hierarchy, review module, adversarial agents, merger adaptation)
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

RAPID Mark II is an overhaul of an existing Claude Code plugin that introduces hierarchical parallel development (Sets > Waves > Jobs), an adversarial multi-agent code review pipeline (Hunter/Devils-Advocate/Judge), automated UAT via Playwright, and an adapted 5-level merge conflict system from the gsd_merge_agent. The existing v1.0 codebase provides solid foundations -- worktree management, DAG computation, contract validation, lock-based state, and agent teams -- that Mark II extends rather than replaces. The recommended approach is to preserve the minimal-dependency CJS philosophy (only 1 new runtime dependency: `playwright`), replace the flat STATE.md with hierarchical JSON state as the single source of truth, and build outward from the state machine foundation through planning, execution, review, and merge phases.

The key risks are: (1) state schema bifurcation if the migration from flat Markdown to hierarchical JSON is not clean and atomic, (2) token cost explosion in the 3-agent adversarial review pipeline (estimated $15-45 per cycle without scoping controls), (3) hidden coupling in "kept" v1.0 modules that have implicit dependencies on the old workflow structure, and (4) agent specification ambiguity causing coordination failures between the 8+ new agent roles. Research shows specification ambiguity and coordination breakdowns account for ~79% of multi-agent system failures. Mitigation requires JSON schemas for all inter-agent messages, diff-scoped review (not full codebase), iteration caps on bug hunting, and a thorough dependency audit of kept modules before implementation begins.

The architecture follows RAPID's existing layered pattern (commands > skills > lib modules > state files > git layer) without introducing a central orchestrator agent. Instead, each skill reads STATE.json on entry and self-dispatches based on current state -- a re-entrant, state-driven pattern that survives context resets. The review module, planner chain, and merger can be built semi-independently once the state machine foundation exists, enabling parallel development of the overhaul itself.

## Key Findings

### Recommended Stack

The stack recommendation is aggressively minimal: 1 new runtime dependency (`playwright` for UAT browser automation) and zero new libraries for state management, agent coordination, or merge logic. The existing stack (Node.js v25.8, `ajv` for schema validation, `proper-lockfile` for concurrent access, `node:test` for testing) handles everything Mark II needs. The state machine is hand-rolled (~50-line transition table with JSON persistence), not a library like XState. The adversarial review pipeline uses pure prompt engineering + file-based report handoff, not LangChain or CrewAI.

**Core technologies:**
- **Playwright (library mode, ^1.52):** UAT browser automation -- use as library for programmatic `chromium.launch()`, not as `@playwright/test` runner. Falls back to MCP for interactive sessions, then to manual AskUserQuestion prompts.
- **Hand-rolled state machine (`state-machine.cjs`):** Transition validation table for Set/Wave/Job lifecycle states -- XState rejected as overkill for flat linear progressions. ~50 lines of plain JS with `ajv` schema validation.
- **`node:test` `run()` API:** Programmatic test execution with structured `TestsStream` events for the Unit Test agent. Zero new dependencies. Target projects use their own runners; RAPID detects and delegates.
- **`ajv` (existing, extended):** New schemas for BugReport, Verdict, Ruling, UAT Plan, Wave/Job state -- leverages existing validation infrastructure.

### Expected Features

**Must have (table stakes -- Mark II is broken without these):**
- Hierarchical state machine with JSON persistence across context resets
- Sets/Waves/Jobs hierarchy with DAG-based ordering (reuses v1.0's `dag.cjs`)
- Orchestrator pattern via state-driven re-entrant skills (not a central agent)
- `/set-init` with worktree + branch creation + wave planning
- Wave Planner agent (decomposes sets into parallelizable job waves)
- Job Planner agent (detailed per-job implementation plans with user discussion)
- Merger with 5-level conflict detection and 4-tier resolution cascade (adapted from gsd_merge_agent)

**Should have (differentiators -- competitive advantage):**
- Hunter/Devils-Advocate/Judge adversarial bug hunting pipeline (47% more unique bug discovery per research)
- UAT with Playwright automation (automated + human step tagging)
- Unit test agent with plan approval flow (HITL prevents fluff tests)
- Bisection recovery for merge failures (O(log n) isolation of breaking set)
- Discuss phase with structured context gathering per wave
- Merger rollback with cascade revert

**Defer (v2.1+):**
- `/quick` ad-hoc task command
- `/insert-job` ad-hoc job insertion mid-execution
- `/new-milestone` lifecycle management

### Architecture Approach

The architecture extends RAPID's existing layered pattern without introducing new architectural concepts. The biggest change is inside each set: replacing the monolithic discuss/plan/execute cycle with a Wave Planner > Job Planner > Executor > Reviewer pipeline. State moves from flat STATE.md (regex-parsed) to hierarchical STATE.json (source of truth) with STATE.md as a read-only human projection. Agent chaining follows the existing pattern: skills orchestrate, agents execute and write structured reports to disk, the next agent reads the previous agent's output. No agent spawns agents (Claude Code platform limitation).

**Major components:**
1. **Hierarchical State Machine** -- JSON-based state tracking for Project > Milestone > Set > Wave > Job with validated transitions, atomic writes, and crash-recovery breadcrumbs. Replaces `state.cjs` internals while preserving backward-compatible API wrappers.
2. **Wave/Job Planning Engine** -- Two new agents (Wave Planner, Job Planner) plus `plan.cjs` extensions for WAVES.json and per-job PLAN.md files. Extends existing `dag.cjs` with intra-set job DAGs.
3. **Review Module** -- Five new agents (Hunter, Devils-Advocate, Judge, Unit-Test, UAT) plus `review.cjs` lib module. Three sub-pipelines (UAT > Unit Tests > Bug Hunt) orchestrated by a review skill. Additive -- does not modify existing modules.
4. **Enhanced Merger** -- 5-level conflict classification (textual, structural, dependency, API, semantic) and 4-tier resolution cascade (deterministic, heuristic, AI-assisted, human escalation) adapted from gsd_merge_agent. Includes bisection recovery and cascade rollback. Enhances `merge.cjs` internals.
5. **Command Surface** -- New commands (`/set-init`, `/discuss`, `/review`, `/uat`, `/unit-test`, `/bug-hunt`) plus enhanced existing commands (`/execute`, `/merge`, `/status`).

### Critical Pitfalls

1. **State schema bifurcation** -- Attempting to layer hierarchical JSON on top of the existing flat STATE.md regex parsing creates a hybrid that fails at boundaries. **Avoid:** Clean break to STATE.json from day one. No hybrid format. Migration function for existing projects.
2. **Token explosion in review pipeline** -- 3 serial agents each needing full codebase context costs $15-45/cycle with unbounded iterations. **Avoid:** Scope to diff (changed files only), cap iterations at 2, use Sonnet for hunter/DA (Opus only for judge), pre-filter with static analysis.
3. **Hidden coupling in "kept" modules** -- Modules labeled "keep" (worktree.cjs, merge.cjs) have implicit dependencies on v1.0 data structures via imports. **Avoid:** Dependency audit before coding, adapter interfaces between kept and rewritten modules, integration tests at boundaries.
4. **Agent specification ambiguity** -- Free-form prose prompts cause 41.77% of multi-agent failures. **Avoid:** JSON schemas for every inter-agent message, output validation at every handoff, concrete examples in prompts, retry-on-validation-failure.
5. **State loss across context resets** -- Multi-step operations (discuss > plan > execute > review) span many context resets. Partial writes leave inconsistent state. **Avoid:** Atomic state transitions (single JSON write per transition), last-operation breadcrumbs, filesystem reconciliation on session start.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: State Machine Foundation
**Rationale:** Every other feature depends on hierarchical state. This is the universal dependency. Both ARCHITECTURE.md and PITFALLS.md identify this as the "must be first" component. Pitfall 1 (state bifurcation) and Pitfall 5 (state loss) must be addressed here or they cascade through everything.
**Delivers:** STATE.json schema, rewritten `state.cjs` with hierarchical accessors, STATE.md auto-generation, transition validation table, atomic write semantics, crash-recovery breadcrumbs, CLI extensions for state queries.
**Addresses:** State machine (P1 table stake), Sets/Waves/Jobs hierarchy data model (P1)
**Avoids:** Pitfall 1 (state bifurcation), Pitfall 5 (state loss on context reset)

### Phase 2: Dependency Audit and Adapter Layer
**Rationale:** Pitfall 6 (hidden coupling) specifically calls for a "Phase 0" pre-work step. Before building new features on kept modules, their implicit dependencies on v1.0 structures must be mapped and adapted. Skipping this causes every subsequent phase to encounter unexpected breakage.
**Delivers:** Module-by-module dependency map, adapter interfaces for `worktree.cjs`, `merge.cjs`, `execute.cjs`, `plan.cjs` interactions with new data structures, integration tests at module boundaries.
**Addresses:** Foundation for all subsequent phases
**Avoids:** Pitfall 6 (hidden coupling in kept modules)

### Phase 3: Wave/Job Planning Infrastructure
**Rationale:** Execution depends on having wave/job plans. This phase creates the data structures and agents that decompose sets into actionable work units.
**Delivers:** WAVES.json schema, `plan.cjs` extensions (createWavePlan, loadWavePlan, createJobPlan, loadJobPlan), `dag.cjs` extension (createJobDAG), Wave Planner agent, Job Planner agent.
**Addresses:** Wave Planner (P1), Job Planner (P1)
**Avoids:** Pitfall 7 (agent specification ambiguity) -- schemas for wave/job plan outputs defined here

### Phase 4: /set-init and Discuss Commands
**Rationale:** Depends on state machine (Phase 1) and wave planning (Phase 3). This is the entry point for Mark II workflow -- users cannot start without it.
**Delivers:** `/rapid:set-init` command and skill, `/rapid:discuss` command and skill, worktree creation + wave planning trigger, port allocation per worktree.
**Addresses:** /set-init (P1), Discuss phase (differentiator)
**Avoids:** Pitfall 8 (resource conflicts across worktrees) -- port allocation established here

### Phase 5: Enhanced Execution
**Rationale:** Depends on wave/job structure (Phase 3) and set-init (Phase 4). Transforms execution from set-level to job-level dispatch within waves.
**Delivers:** Rewritten execute skill with job-level dispatch, per-job commit tracking, job-level pause/resume, parallel job execution within waves.
**Addresses:** Executor agent (P1)

### Phase 6: Review Module
**Rationale:** Independent of the planner/executor chain -- only needs state machine. Can conceptually be built in parallel with Phases 3-5, but sequencing after execution ensures the pipeline can be tested end-to-end. This is the highest-complexity differentiator.
**Delivers:** `review.cjs`, 6 agent prompts (Hunter, DA, Judge, Unit-Test, UAT, Bugfix), 4 new skills and commands, JSON schemas for inter-agent messages, Playwright UAT integration, review gate for merge.
**Addresses:** Bug hunting pipeline (P2 differentiator), UAT (P2), Unit tests (P2)
**Avoids:** Pitfall 3 (token explosion -- scoping and caps), Pitfall 4 (Playwright flakiness), Pitfall 7 (agent ambiguity -- schemas)

### Phase 7: Enhanced Merger
**Rationale:** Depends on review module (Phase 6) for review gate integration. Most complex adaptation from gsd_merge_agent. Building after review ensures merge validation can include review checks.
**Delivers:** 5-level conflict classification, 4-tier resolution cascade, integration branch pattern, merge state in STATE.json, enhanced merge skill.
**Addresses:** Merger core (P1 table stake), 5-level conflict detection
**Avoids:** Pitfall 2 (merge namespace collision -- unified state, RAPID branch naming)

### Phase 8: Advanced Recovery and Polish
**Rationale:** Bisection and rollback extend the core merger. /init overhaul and status enhancements are polish that should not block the core workflow.
**Delivers:** Bisection recovery, cascade rollback, enhanced /init with roadmap creation, enhanced /status with wave/job display, /review --quick mode.
**Addresses:** Bisection (P3), Rollback (P3), /init overhaul

### Phase Ordering Rationale

- **State machine first** because it is the universal dependency. Architecture, features, and pitfalls research all converge on this.
- **Dependency audit second** because hidden coupling in kept modules (Pitfall 6) will silently break every subsequent phase if not addressed upfront. This is cheap insurance.
- **Planning before execution** because executors need plans to execute. DAG/wave/job structures must exist before dispatch logic.
- **Review after execution** because it needs built code to review, and end-to-end testing requires the full pipeline.
- **Merger after review** because the review gate must exist before the merger can enforce it. The merger is also the most complex adaptation and benefits from having all other infrastructure stable.
- **Recovery and polish last** because these extend core features and have the lowest user value relative to complexity.
- **Phases 3-5 and Phase 6 have limited interdependency** -- in practice, they could be parallelized if two developers are available. Review only needs the state machine, not the full planner chain.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 6 (Review Module):** Highest complexity, 6 new agents, 3 sub-pipelines, Playwright integration, token cost optimization. Needs research on optimal agent prompt design, inter-agent schema finalization, and Playwright MCP vs library mode tradeoffs per UAT scenario.
- **Phase 7 (Enhanced Merger):** Complex adaptation from gsd_merge_agent (26 TypeScript files to CJS port). Needs research on exact algorithm translation for conflict classification and resolution cascade.
- **Phase 2 (Dependency Audit):** Needs thorough code analysis of all 12 lib modules to map cross-cutting dependencies. Not research in the traditional sense but requires systematic investigation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (State Machine):** Well-understood problem. JSON state with transition tables is a solved pattern. The ARCHITECTURE.md research provides complete schema and implementation guidance.
- **Phase 4 (/set-init):** Composes existing worktree.cjs functions with new state machine. Straightforward wiring.
- **Phase 5 (Enhanced Execution):** Extension of existing execute.cjs with job-level dispatch. Pattern already established in v1.0.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on direct codebase analysis of existing dependencies, version compatibility verified, alternatives systematically evaluated and rejected with clear rationale. Only 1 new dependency. |
| Features | HIGH | Features derived from first-party design docs (mark2.md, review module specs, gsd_merge_agent docs) plus competitor analysis against Turborepo, Nx, Bazel, CrewAI. Dependency graph validated against codebase. |
| Architecture | HIGH | Based on thorough analysis of existing codebase (12 lib modules, all skills, all agents). Integration points mapped with specific function names and file paths. Anti-patterns identified from platform constraints (no nested agent spawning). |
| Pitfalls | HIGH | Grounded in existing code analysis, published multi-agent failure research (UC Berkeley), cost modeling from Claude Code pricing, and direct experience with gsd_merge_agent integration surface. Recovery costs estimated per pitfall. |

**Overall confidence:** HIGH

All four research files drew from first-party sources (existing RAPID codebase, mark2.md design doc, gsd_merge_agent specs, review module drafts) supplemented by official documentation (Node.js, Playwright, Microsoft/Google agent patterns) and peer-reviewed research. The domain is well-understood because the existing v1.0 codebase provides concrete implementation reference.

### Gaps to Address

- **Sonnet vs Opus for review agents:** The recommendation to use Sonnet for hunter/DA and Opus for judge is based on cost analysis, not empirical testing. Validate during Phase 6 implementation that Sonnet produces adequate finding quality for the hunter role.
- **EXPERIMENTAL_AGENT_TEAMS reliability:** The architecture assumes agent teams with subagent fallback, but teams behavior under heavy load (8+ concurrent agents across worktrees) is not well-documented. Test team stability during Phase 5/6.
- **Port allocation scheme:** The suggested deterministic port offset (Set 1: 3000, Set 2: 3100, etc.) may conflict with projects that use non-standard port ranges. Needs validation against real project configurations during Phase 4.
- **STATE.md backward compatibility:** The migration from STATE.md to STATE.json needs a concrete migration path for existing RAPID v1.0 projects. Design the migration function during Phase 1 implementation.
- **Playwright in worktree environments:** The interaction between Playwright browser lifecycle, Claude Code sandbox restrictions, and git worktree working directories is untested. Validate during Phase 6 with a real web project.

## Sources

### Primary (HIGH confidence)
- RAPID v1.0 codebase (`src/lib/*.cjs`, 12 modules, 16 test files) -- existing architecture, module APIs, data structures
- mark2.md design document (`mark2-plans/mark2.md`) -- project owner's design spec for Mark II
- gsd_merge_agent documentation (`mark2-plans/gsd_merge_agent/DOCS.md`, 26 TypeScript modules) -- merge pipeline reference
- Review module specifications (`mark2-plans/review-module/*.md`) -- agent prompt drafts and pipeline design
- Node.js v25.8.0 `node:test` documentation -- `run()` API, TestsStream events
- Playwright Library documentation -- library vs test runner mode, API surface
- Bazel official documentation -- task-based build system patterns

### Secondary (MEDIUM confidence)
- Microsoft Azure AI Agent Design Patterns -- supervisor/orchestrator patterns
- Google ADK Multi-Agent Patterns -- agent coordination strategies
- Multi-Agent Adversarial Testing Framework (ResearchGate) -- 47% bug discovery improvement with Red-Blue dynamics
- Simon Willison: Playwright MCP with Claude Code -- MCP integration approach
- Turborepo/Nx community analysis -- monorepo tooling patterns

### Tertiary (LOW confidence)
- LangGraph State Machines article -- agent task flow patterns (community article, used for comparison only)
- Claude Code context window analysis (Morph) -- 200K limit, compaction behavior (third-party analysis)

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
