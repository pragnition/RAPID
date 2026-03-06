# Feature Research

**Domain:** AI-powered parallel development orchestration (Claude Code plugin) -- Mark II Overhaul
**Researched:** 2026-03-06
**Confidence:** HIGH

**Scope:** This research covers ONLY the new Mark II features. Existing v1.0 features (/init, /plan, /execute, /merge, /status, /context, /assumptions, /pause, /cleanup) are already built and not re-researched here.

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for the Mark II overhaul to function. Without these, the upgrade from v1.0 is broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **State machine with persistence across context resets** | Users clear context between /discuss, /plan, /execute, /review. Without persistent state, the multi-phase workflow collapses. Every similar framework (LangGraph, CrewAI, gsd_merge_agent) persists state to disk. | HIGH | v1.0 has `state.cjs` with lock-based read/write to STATE.md. Mark II must expand from flat field tracking to hierarchical state (project > milestone > set > wave > job) with transition validation. Use JSON state file per set for machine-parseable transitions. Keep STATE.md as human-readable summary generated from JSON. Transitions must be validated (e.g., a job cannot go from "pending" to "validated" without passing through "executing"). |
| **Sets/Waves/Jobs hierarchy with DAG-based ordering** | This IS the Mark II value proposition. Turborepo, Nx, and Bazel all use DAG-based task graphs for parallel execution. Without the hierarchy, there is no Mark II. | HIGH | v1.0 already has `dag.cjs` with topological sort (Kahn's algorithm) and BFS wave assignment -- directly reusable for wave computation within a set. The hierarchy: Sets are independent (no inter-set DAG needed), Waves within a set are sequential, Jobs within a wave are parallel. This matches Bazel's action-graph model where independent actions run concurrently, dependent actions are serialized. |
| **Orchestrator for command dispatch** | Every multi-agent system uses a coordinator. Microsoft's AI Agent Design Patterns documentation identifies the Supervisor pattern as the standard: central orchestrator receives requests, decomposes into subtasks, delegates to specialized agents. Without an orchestrator, each command is a disconnected script. | MEDIUM | Single entry point that reads state, determines current phase, validates transitions, spawns appropriate subagents. Similar to gsd_merge_agent's orchestrator that handles new/resume/continue/rollback/abort modes from a single skill. Must detect EXPERIMENTAL_AGENT_TEAMS with subagent fallback (v1.0's `teams.cjs` has detection logic). |
| **/set-init with worktree + branch creation** | RAPID's core value is physical isolation via git worktrees. After /init creates the roadmap, users need to create isolated workspaces per set. Without /set-init, the worktree promise is hollow. | MEDIUM | v1.0 has `worktree.cjs` for worktree management. /set-init extends this with: branch creation from set spec, set-level planning state initialization (JSON state file in the worktree), CLAUDE.md generation for the worktree (via existing `context.cjs`). Must validate set exists in roadmap before creating worktree. |
| **Wave Planner agent** | The discuss > plan > execute > review loop requires a planner that decomposes waves into actionable job plans. Without this, execution agents have no instructions. This is the "Planner" role identified in agentic coding research as essential (Planners explore and create tasks, Workers execute). | HIGH | Wave Planner spawns research subagents for investigation, produces high-level per-job plans, and discusses with user via AskUserQuestion. Outputs structured plans consumed by Job Planner and Executor. Must batch questions to minimize token cost (project constraint). Output format must be machine-parseable JSON/structured markdown. |
| **Job Planner agent** | Jobs are the atomic execution unit. Without detailed plans, executor agents hallucinate implementations. The mark2.md spec calls this out as carrying "huge responsibility" because implementation details are crucial. | HIGH | Must engage user in implementation detail discussion via AskUserQuestion. Produces structured execution plan with file lists, function signatures, test expectations. Plans reference interface contracts from v1.0's `contract.cjs`. This is where user vision is captured -- skipping discussion leads to misaligned implementations. |
| **Merger with 5-level conflict detection** | Parallel branches WILL conflict. A merge tool that only handles textual conflicts misses structural/API/semantic issues. The gsd_merge_agent already solves this with proven architecture -- not adapting it wastes existing work. | HIGH | Adapt gsd_merge_agent's 5-level detection (textual, structural, dependency, API, semantic) and 4-tier resolution cascade (deterministic, heuristic, AI-assisted, human escalation). Key adaptations needed: (1) change branch naming from `phase/NN-*` to set-based naming, (2) integrate with RAPID's state machine instead of `.gsd-merge/state.json`, (3) use AskUserQuestion instead of raw prompts, (4) map merge phases to set lifecycle states. The gsd_merge_agent's per-phase state machine (pending > merging > merged > validating > validated) maps cleanly to per-set merge tracking. |

### Differentiators (Competitive Advantage)

Features that set RAPID Mark II apart. These are not found in comparable frameworks.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Review: Hunter/Devils-Advocate/Judge bug hunting pipeline** | Adversarial multi-agent code review is cutting-edge. A 2025 research paper on Multi-Agent Adversarial Testing Frameworks found 47% increase in unique bug discovery and 33% reduction in recurring vulnerabilities vs baseline approaches when using Red-Blue team dynamics. Most tools use single-pass review. RAPID's 3-agent pipeline with scoring incentives (Hunter: +3 true positive, -2 missed; DA: +2 false positive proven, -1 missed) creates genuine tension that minimizes both false positives AND false negatives. | HIGH | Three agent prompts already drafted in mark2-plans/review-module/. Pipeline: Hunter (broad static analysis, minimize false negatives, categorize by risk+confidence) -> Devils Advocate (skeptic, examine full code context, verdict: DISPROVEN/WEAKENED/CONFIRMED/ESCALATED) -> Judge (final ruling: DISMISSED/ACCEPTED/DEFERRED, prioritized fix order, HITL for contested findings) -> Bugfix subagent. Iterates until Judge rules no bugs remain. |
| **Review: UAT with Playwright automation** | Automated UAT that acts like a real user is rare in dev frameworks. Playwright 1.56+ (Oct 2025) introduced native Planner/Generator/Healer agents for intelligent test automation. Playwright MCP enables AI-driven test generation. Most dev tools skip UAT entirely or leave it fully manual. | MEDIUM | Existing `playwright-cli` skill already in .claude/skills/. UAT agent: (1) generates multi-step test plan following app workflow, (2) tags steps as "automated" (Playwright handles) or "human" (needs user), (3) executes automated steps via playwright-cli, (4) prompts user for human steps, (5) collates failures for bugfix agent. Runs FIRST in review pipeline because glaring app-breaking issues should be caught before investing in unit tests or bug hunting. |
| **Review: Unit test agent with plan approval flow** | Most automated testing generates tests blindly, producing fluff. RAPID's approach adds a critical HITL loop: generate plan -> user approves/edits -> write tests -> run -> report with full command output -> user reviews -> bugfix. The plan approval step ensures every test justifies its existence. | MEDIUM | Multi-layer validation principle: validate at every layer data passes through (input entry, business logic, data access). Test plan format specified in mark2-plans/review-module/unit-test.md. Agent logs exact commands and full stdout/stderr to log file for observability. Minimize API costs with compact test data. Regression test-first for bug fixes (write test that fails, then fix). |
| **Bisection recovery for merge failures** | When all sets pass individually but combined result fails, binary search isolates the breaking interaction in O(log n). No other metaprompting framework offers this. Directly adapted from gsd_merge_agent. | MEDIUM | Already fully designed in gsd_merge_agent DOCS.md. Creates temporary bisection branches, replays merges up to midpoint, validates. Reports: single-phase breaker, interaction failure, or inconclusive. Does not mutate integration branch during analysis. Three user options per result type. |
| **Discuss phase with comprehensive context gathering** | Most AI coding tools skip discussion and jump to planning/execution, causing misaligned implementations. RAPID's explicit discuss phase (per wave) captures user vision before planning begins. The mark2.md spec emphasizes this: "Discussion/Context gathering with the user is SO SO important." | LOW | Per-wave discussion before planning via AskUserQuestion. Agent probes for implementation vision, flags uncovered important facets, asks about edge cases. Only acts autonomously if user opts in. Output is structured discussion summary consumed by Wave Planner. Low complexity because it is primarily a prompt engineering task, not a systems engineering task. |
| **AskUserQuestion-driven UX with batched queries** | Consistent, batched user interaction via Claude Code's AskUserQuestion tool instead of scattered prompt questions. The mark2.md spec mandates this: agents should "ALWAYS BATCH their queries to save on tokens and time." No other metaprompting framework enforces batched UX. | LOW | Every agent uses AskUserQuestion at decision gates. Queries are batched (ask 5 questions at once, not 5 separate prompts). This saves tokens, reduces round trips, and creates auditable decision records in state. |
| **Merger rollback with cascade revert** | When a merged set breaks validation, revert it and cascade-revert all later sets, then re-merge without the problematic set. Adapted from gsd_merge_agent's proven rollback flow. | MEDIUM | gsd_merge_agent handles: (1) validate target set has merge commit, (2) analyze cascade impact, (3) confirm with user showing what will be lost, (4) revert in reverse chronological order, (5) re-merge later sets, (6) re-validate. Rerere integration replays previous conflict resolutions during re-merge, avoiding rework. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time cross-set synchronization** | "Sets should know about each other's progress" | Destroys isolation guarantees. If Set A watches Set B, you get coupling, race conditions, and blocking -- defeating RAPID's core value. Turborepo and Nx execute independent tasks without cross-task communication by design. | Loose sync model: shared planning gate (sets defined together with contracts), independent execution, merge-time reconciliation. Interface contracts define boundaries upfront. |
| **Dynamic set creation during execution** | "I just realized I need another set while others are running" | Creates merge nightmares. New sets have no contract coverage with in-progress sets. Integration surface grows unpredictably. PROJECT.md explicitly marks this out of scope. | Sets defined at planning time only. Use /insert-job (deferred to v2.1) for ad-hoc additions within existing sets. New sets require re-entering planning or starting a new milestone. |
| **Fully automated review (no HITL)** | "Just fix everything automatically without asking me" | AI code review without human judgment leads to false confidence. The Judge agent exists precisely because contested findings need human arbitration. Unit test plans without user approval produce fluff tests. The mark2.md spec mandates AskUserQuestion at all decision points. | HITL at key decision points: test plan approval, contested bug rulings, UAT step verification. Automation handles work; humans validate judgment calls. |
| **Central server for state coordination** | "Use a database or API so the team can see state in real time" | Adds infrastructure requirements, breaks offline usage, creates a single point of failure, contradicts the git-native constraint in PROJECT.md. | Git-native state with lock files (proven in v1.0 via `lock.cjs`). JSON state files per set, lockfile-protected writes, auditable via git history. |
| **Global undo/redo across all sets** | "Let me undo any action in any set from one place" | Cross-set undo requires a global transaction log, breaks set independence, interacts badly with git history across worktrees. | Per-set state machines with clear transition paths. Merger has rollback with cascade revert for merge-time issues. Individual sets can be reset independently within their own worktrees. |
| **Auto-spawning fix waves based on failures** | "If a job fails, automatically create a wave to fix it" | Unbounded retry loops, token cost explosion, potential infinite regress. A failing job might indicate a planning issue, not an execution issue. | Review module handles failures explicitly with termination conditions: UAT loops until requirements pass, unit tests loop until user approves, bug hunting loops until Judge rules no bugs remain. Each has HITL gates preventing runaway loops. |
| **AI-only merge conflict resolution** | "Just let the AI resolve all merge conflicts automatically" | Merge conflicts between sets often indicate contract violations -- architectural problems that should surface, not be papered over. Auto-resolution hides root causes. | 4-tier cascade: deterministic (lockfiles, whitespace), heuristic (pattern matching), AI-assisted (with validation -- proposal must pass build+tests), human escalation (scaffold with rationale). AI resolution is ONE tier, not the only tier, and it requires validation before acceptance. |

## Feature Dependencies

```
[State Machine (hierarchical JSON)]
    |
    +--foundation-for--> [Orchestrator]
    |                        |
    |                        +--routes--> [/set-init]
    |                        |                |
    |                        |                +--enables--> [Wave Planner]
    |                        |                                  |
    |                        |                                  +--feeds--> [Job Planner]
    |                        |                                                  |
    |                        |                                                  +--feeds--> [Executor]
    |                        |
    |                        +--routes--> [Merger (core)]
    |                                         |
    |                                         +--extends--> [Bisection Recovery]
    |                                         |
    |                                         +--extends--> [Rollback + Cascade Revert]
    |
    +--foundation-for--> [Sets/Waves/Jobs Hierarchy]

[Review Module: UAT]
    +--requires--> [State Machine] (reads what was built)
    +--requires--> [playwright-cli skill] (ALREADY EXISTS)
    +--independent-of--> [Planner/Executor chain]

[Review Module: Unit Tests]
    +--requires--> [State Machine] (reads what was built)
    +--independent-of--> [Planner/Executor chain]

[Review Module: Bug Hunting]
    +--requires--> [State Machine] (reads what was built)
    +--enhances--> [Review Module: Unit Tests] (bugs found inform test targets)

[Merger]
    +--requires--> [State Machine]
    +--requires--> [Sets/Waves/Jobs Hierarchy] (set-based branch naming)
    +--can-trigger--> [Review Module] (post-merge validation)
```

### Dependency Notes

- **State Machine is the foundation.** Every other feature reads/writes state. Must be built first. v1.0's `state.cjs` provides read/write primitives but needs expansion from flat fields to hierarchical JSON with transition validation.
- **Sets/Waves/Jobs Hierarchy requires State Machine.** The hierarchy is a data structure stored and tracked in state. DAG computation (v1.0's `dag.cjs`) operates on this data.
- **Orchestrator requires State Machine.** Reads state to determine mode, validates transitions, routes commands. Without state, it has nothing to orchestrate.
- **/set-init requires Orchestrator.** It is a command routed through the orchestrator. Also requires hierarchy (from /init's roadmap) to validate set exists before creating worktree.
- **Wave Planner requires /set-init.** Cannot plan waves until a set workspace exists with its planning context established.
- **Job Planner requires Wave Planner.** Job plans are scoped within the wave plan's structure.
- **Review Module is INDEPENDENT of the planning/execution chain.** It operates on built code, not on plans. Can be built in parallel with the planner/executor chain as long as State Machine exists. This is a key insight for phase ordering.
- **Merger is INDEPENDENT of planners.** Requires state and hierarchy for set tracking but does not depend on how the code was planned or executed. Can be built in parallel with the planner chain.
- **Bisection and Rollback extend Merger.** They are advanced recovery features that require the core merger to exist first.

## MVP Definition

### Launch With (Mark II Core)

The minimum for the Sets/Waves/Jobs workflow to function end-to-end.

- [ ] **State machine (hierarchical JSON)** -- Foundation. Tracks project > milestone > set > wave > job with validated transitions. Persists across context resets via JSON files with lock-protected writes.
- [ ] **Sets/Waves/Jobs hierarchy data model** -- Data structures, DAG computation (extend v1.0's `dag.cjs`), roadmap format representing the new hierarchy.
- [ ] **Orchestrator** -- Command dispatch, state-driven routing, subagent spawning, EXPERIMENTAL_AGENT_TEAMS detection (extend v1.0's `teams.cjs`).
- [ ] **/set-init** -- Worktree + branch creation, set-level state initialization, CLAUDE.md generation. Reuses v1.0's `worktree.cjs` and `context.cjs`.
- [ ] **Wave Planner agent** -- Per-wave planning with research subagents and user discussion. Structured output for Job Planner consumption.
- [ ] **Job Planner agent** -- Detailed per-job implementation planning with user discussion and contract validation.
- [ ] **Executor agent** -- Job execution with atomic commits. Partially exists in v1.0's `execute.cjs`.
- [ ] **Merger (core)** -- 5-level conflict detection, 4-tier resolution cascade, per-set merge state tracking. Adapted from gsd_merge_agent.

### Add After Core Validates (Mark II.1)

Once the discuss > plan > execute > merge loop works end-to-end.

- [ ] **Review module: UAT** -- Trigger: core loop works, need quality gates before marking sets complete. Playwright automation for web projects.
- [ ] **Review module: Unit tests** -- Trigger: core loop works, need regression safety nets. Plan approval flow + multi-layer validation.
- [ ] **Review module: Bug hunting** -- Trigger: unit tests work, need deeper adversarial analysis. Hunter/DA/Judge pipeline.
- [ ] **Bisection recovery** -- Trigger: merger works, multi-set merges fail and need systematic isolation.
- [ ] **Merger rollback with cascade revert** -- Trigger: basic merger works, need safe undo for complex merge sequences.

### Future Consideration (v2.1+)

Explicitly deferred per PROJECT.md.

- [ ] **/quick ad-hoc task command** -- Deferred. Requires working state machine and executor but should not delay core overhaul.
- [ ] **/insert-job ad-hoc job insertion** -- Deferred. Needs careful design around mid-execution state changes and wave recalculation.
- [ ] **/new-milestone** -- Mentioned in mark2.md but not in active requirements. Needs milestone lifecycle and state transition design.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Reuses From v1.0 |
|---------|------------|---------------------|----------|-------------------|
| State machine (hierarchical) | HIGH | HIGH | P1 | `state.cjs`, `lock.cjs` (extend) |
| Sets/Waves/Jobs hierarchy | HIGH | MEDIUM | P1 | `dag.cjs` (extend) |
| Orchestrator | HIGH | MEDIUM | P1 | `teams.cjs`, `core.cjs` (extend) |
| /set-init | HIGH | MEDIUM | P1 | `worktree.cjs`, `context.cjs` (reuse) |
| Wave Planner agent | HIGH | HIGH | P1 | New agent prompt + structured output |
| Job Planner agent | HIGH | HIGH | P1 | New agent prompt + structured output |
| Executor agent | HIGH | MEDIUM | P1 | `execute.cjs` (partial reuse) |
| Merger (core) | HIGH | HIGH | P1 | gsd_merge_agent (full adaptation) |
| Review: UAT | MEDIUM | MEDIUM | P2 | `playwright-cli` skill (reuse) |
| Review: Unit tests | MEDIUM | MEDIUM | P2 | New agent prompt + test framework |
| Review: Bug hunting | MEDIUM | HIGH | P2 | New (3 agent prompts + pipeline orchestration) |
| Bisection recovery | LOW | MEDIUM | P3 | gsd_merge_agent (adaptation) |
| Merger rollback/cascade | LOW | MEDIUM | P3 | gsd_merge_agent (adaptation) |

**Priority key:**
- P1: Must have for Mark II launch (core workflow end-to-end)
- P2: Should have, add once core loop validates (quality gates)
- P3: Nice to have, advanced recovery (operational resilience)

## Competitor Feature Analysis

| Feature | Turborepo/Nx | Bazel | GSD (predecessor) | CrewAI | gsd_merge_agent | RAPID Mark II |
|---------|-------------|-------|-------------------|--------|-----------------|---------------|
| **Task hierarchy** | Package > task (flat within package) | Workspace > package > target > action | Project > phase (linear) | Crew > task (sequential or parallel) | N/A (merge only) | Project > milestone > set > wave > job |
| **Parallel execution** | DAG-based automatic parallelization | Action-level DAG with --jobs resource control | Wave-based within single dev | Sequential or parallel task execution per crew | N/A | Jobs parallel within wave, waves sequential, sets independent |
| **Dependency model** | package.json workspace deps | Fine-grained BUILD file target deps | Phase N depends on phase N-1 | Task dependencies within crew | Phase merge order | DAG within sets via `dag.cjs` topological sort |
| **State persistence** | Cache artifacts (turbo.json) | Action cache + repository cache | STATE.md flat fields | Session state via framework memory | `.gsd-merge/state.json` per session | Hierarchical JSON per set, lock-protected, survives context resets |
| **Conflict resolution** | N/A (no branch merging) | N/A (no branch merging) | Single-pass review | N/A | 5-level detection, 4-tier cascade | Adapted 5-level detection + 4-tier cascade from gsd_merge_agent |
| **Code review** | N/A | N/A | Basic verification | N/A | Merge-time validation | Adversarial 3-agent pipeline (Hunter/DA/Judge) + UAT + unit tests |
| **Recovery** | Re-run failed tasks | Re-run failed actions | Manual | N/A | Bisection + cascade rollback | Adapted bisection + cascade rollback from gsd_merge_agent |
| **User interaction** | CLI flags, no discussion | CLI flags, no discussion | Minimal prompting | Task instructions | Prompt-based escalation | AskUserQuestion with batched queries at every decision gate |

## Sources

- [Turborepo, Nx, and Lerna: Monorepo Tooling in 2026](https://dev.to/dataformathub/turborepo-nx-and-lerna-the-truth-about-monorepo-tooling-in-2026-71) -- MEDIUM confidence (community article, verified against official patterns)
- [How Bazel Works: Dependency Graphs, Caching, and Remote Execution](https://www.gocodeo.com/post/how-bazel-works-dependency-graphs-caching-and-remote-execution) -- MEDIUM confidence (third-party explanation of official architecture)
- [Bazel Task-Based Build Systems](https://bazel.build/basics/task-based-builds) -- HIGH confidence (official documentation)
- [AI Coding Agents in 2026: Coherence Through Orchestration](https://mikemason.ca/writing/ai-coding-agents-jan-2026/) -- MEDIUM confidence (industry analysis)
- [Azure AI Agent Orchestration Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) -- HIGH confidence (official Microsoft architecture guidance)
- [Google ADK Multi-Agent Patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) -- HIGH confidence (official Google developer guide)
- [Multi-Agent Adversarial Testing Framework](https://www.researchgate.net/publication/396904463_An_Adversarial_Testing_Framework_for_Multi-Agent_Red-Blue_Systems_in_Automated_Software_Hardening) -- MEDIUM confidence (peer-reviewed research)
- [Playwright MCP: AI-Powered Test Automation 2026](https://www.testleaf.com/blog/playwright-mcp-ai-test-automation-2026/) -- MEDIUM confidence (industry blog with version-specific claims)
- [LangGraph State Machines for Agent Task Flows](https://dev.to/jamesli/langgraph-state-machines-managing-complex-agent-task-flows-in-production-36f4) -- LOW confidence (community article)
- gsd_merge_agent DOCS.md (local: mark2-plans/gsd_merge_agent/DOCS.md) -- HIGH confidence (first-party source, complete technical reference)
- Review module specs (local: mark2-plans/review-module/) -- HIGH confidence (first-party specs with draft agent prompts)
- RAPID v1.0 codebase (local: src/lib/) -- HIGH confidence (existing working code with tests)
- mark2.md (local: mark2-plans/mark2.md) -- HIGH confidence (first-party design spec from project owner)

---
*Feature research for: RAPID Mark II workflow overhaul*
*Researched: 2026-03-06*
