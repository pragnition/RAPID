# Feature Research

**Domain:** Agent orchestration meta-framework for parallel development (Claude Code plugin)
**Researched:** 2026-03-12
**Confidence:** HIGH
**Milestone:** v3.0 Refresh -- Surgical rewrite of orchestration layer

**Scope:** This research covers ONLY the v3.0 features. All v2.0-v2.2 features (state machine, sets/waves/jobs, concern-based review, wave orchestration, plan verifier, batched questioning, set-based review, subagent merge delegation, adversarial code review, 5-level conflict detection) are already built and shipped. The review and merge pipelines are kept as-is.

## Feature Landscape

### Table Stakes (Users Expect These)

Features that v3.0 must deliver for the rewrite to be considered successful. Without these, the "refresh" fails its stated purpose.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Collapsed plan-set flow (wave-plan + job-plan unified) | Core v3.0 goal. The current two-step pipeline (wave-plan then job-plan per wave) forces 4-10 user interactions per set. Every competitor (deep-plan, Claude-Code-Workflow, SuperClaude) achieves planning in a single command invocation. RAPID v2.x plan-set already partially collapses this, but still runs wave-plan and job-plan as separate agent dispatches with an interleaved verification step. v3.0 should produce one PLAN.md per wave in a single pipeline pass. | MEDIUM | Existing plan-set SKILL.md, wave-planner role, job-planner role. Must consolidate wave-plan+job-plan roles into a unified planner that produces a single PLAN.md per wave. | The v2.x plan-set skill already orchestrates the full pipeline. The change is structural: merge the wave-planner and job-planner agent roles into a single role that receives wave context and produces a complete PLAN.md (wave-level overview + per-job detail). The verification step stays. This reduces subagent spawn count from (1 wave-planner + N job-planners + 1 verifier) per wave to (1 unified-planner + 1 verifier) per wave. |
| /discuss-set with --skip flag (auto-context) | Stated v3.0 requirement. Current /discuss requires per-wave interactive discussion (5-10 questions each). With --skip, RAPID should auto-generate WAVE-CONTEXT.md from roadmap descriptions + codebase scan + contract analysis. deep-plan uses a similar "research" phase to gather codebase context before interviewing users; Claude-Code-Workflow's ACE tool does semantic codebase search. The difference: --skip bypasses the interview entirely, delegating all decisions to Claude. | MEDIUM | Roadmap DEFINITION.md per set, CONTRACT.json, codebase scan via context detect or Glob/Grep, existing discuss SKILL.md refactored to accept --skip. | Implementation: when --skip is passed, skip Steps 4-5 (gray area identification and deep-dive discussion), auto-generate WAVE-CONTEXT.md by reading DEFINITION.md, SET-OVERVIEW.md, CONTRACT.json, and performing targeted source file reads. All gray areas documented as "Claude's discretion." The discuss SKILL.md already has a "Let Claude decide all" path -- --skip simply auto-selects that option for all waves in the set. |
| /start-set command | Combines set-init + discuss-set + plan-set into a single user invocation. Every competitive framework provides a single "go" command (Claude-Code-Workflow's /ccw, SuperClaude's /sc:workflow, deep-plan's single invocation). Users should not need to remember 3 sequential commands to start working on a set. | LOW | set-init SKILL.md, discuss SKILL.md, plan-set SKILL.md. start-set is a thin orchestrator that calls the three in sequence. | New SKILL.md that runs: (1) set-init create to create worktree, (2) discuss-set [--skip if passed] for all waves, (3) plan-set for all waves. Each substep reuses existing skill logic inline (not skill-to-skill calls, since Claude Code skills cannot call other skills). The --skip flag passes through to the discuss phase. |
| /add-set command | Adds a new set to an existing milestone after initial planning. Currently sets are frozen at planning time. PROJECT.md says "Dynamic set creation during execution -- sets defined at planning time only" is out of scope, but /add-set is a controlled addition BEFORE execution starts. Users need this when requirements surface after roadmap creation but before work begins. | LOW | STATE.json set addition, worktree creation, contract generation. Reuses plan create-set and worktree create from rapid-tools.cjs. | Guard: only allowed when no set in the milestone has entered "executing" state. Validates the new set doesn't conflict with existing contracts. Adds to STATE.json, creates planning artifacts, but does NOT re-run the full init pipeline. |
| /new-version command | Creates a new milestone version, carrying forward unfinished work. Currently requires manual STATE.md editing and /rapid:new-milestone. Users need a clean "bump version" command that archives the current milestone state and starts fresh. | LOW | state add-milestone from rapid-tools.cjs, milestone archival logic. | Implementation: snapshot current milestone to .planning/milestones/vX.Y-ARCHIVE.md, call state add-milestone with new version ID, optionally carry forward incomplete sets. |
| /status command | Shows current project state: milestone, sets with statuses, waves with statuses, active worktrees, merge pipeline state. Every competitor has a status/dashboard command (Claude-Code-Workflow /ccw-coordinator, wshobson/agents status). RAPID has execute wave-status and worktree status but no unified view. | LOW | state get --all, worktree status --json, merge status. Composites existing CLI outputs into a formatted display. | New SKILL.md. Calls 3 existing CLI commands, formats as a single dashboard table. No new infrastructure needed. |
| XML-formatted consistent prompt structure | Stated v3.0 requirement. Anthropic's own context engineering guidance recommends XML tags for prompt section organization (<background_information>, <instructions>, etc.). Current SKILL.md files use markdown headers inconsistently. Agent role modules use markdown. XML tags provide clear section boundaries that models parse more reliably. | MEDIUM | All 17 SKILL.md files and 31 agent role modules need structural migration from markdown sections to XML-wrapped sections. | This is a cross-cutting refactor. Each SKILL.md gets XML wrapper tags around its major sections (<environment_setup>, <steps>, <error_handling>, <anti_patterns>). Agent roles get <role>, <responsibilities>, <constraints>, <output_format> tags. The content inside tags stays markdown (XML is structural, not content). |
| Inline YAML tool documentation per agent | Stated v3.0 requirement. Current agents reference rapid-tools.cjs via freeform prose. Competitors like CrewAI embed tool definitions directly in agent prompts. Anthropic's tool documentation guidance says tools should be "self-contained" with "descriptive, unambiguous" parameters. Inline YAML gives each agent exactly the CLI commands it needs with argument schemas, instead of referencing a shared 80-line USAGE block. | MEDIUM | rapid-tools.cjs command inventory, all agent role modules. Each role module gets a <tools> YAML block listing only the CLI commands that agent uses, with argument schemas. | Generate YAML tool blocks from rapid-tools.cjs USAGE string. Each agent role gets a subset. Example: the executor role gets state transition, execute prepare-context, execute verify, verify-artifacts. The merger role gets merge detect, merge resolve, merge update-status. This replaces the current pattern of copying bash snippets into SKILL.md instructions. |
| 5th researcher: Domain/UX | Stated v3.0 requirement. Current init spawns 4 researchers (Stack, Features, Architecture, Pitfalls). Missing: domain-specific UX patterns, user workflow analysis, accessibility considerations. deep-plan's interview phase partially covers this. SuperClaude has /sc:research for domain research. | LOW | New role-research-domain-ux.md module, init SKILL.md updated to spawn 5 researchers, synthesizer updated to incorporate Domain/UX findings. | Follows identical pattern to existing 4 researchers: receives project description + user requirements, produces .planning/research/DOMAIN-UX.md. Covers: domain conventions, UX patterns users expect, workflow ergonomics, accessibility, competitor UX analysis. |

### Differentiators (Competitive Advantage)

Features that set RAPID apart from deep-plan, Claude-Code-Workflow, SuperClaude, Ruflo, and wshobson/agents. Not required for v3.0 launch, but create significant value.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Interface contracts as dependency mechanism (no gating) | Unique to RAPID. No competitor uses typed interface contracts between parallel work units. deep-plan has sections but no cross-section contracts. Claude-Code-Workflow uses JSON-driven task specs but no inter-agent contracts. Ruflo has stream-json chaining but that is runtime data flow, not compile-time contracts. RAPID v2.x already has CONTRACT.json per set. v3.0 removes the "set gating" enforcement (all sets must finish planning before any executes) and replaces it with contract-based dependency tracking. Sets can execute independently as long as they code against declared contracts. | MEDIUM | Existing CONTRACT.json infrastructure, set-init contract generation, execute generate-stubs. Remove planning gate checks from orchestrator. | This is a design simplification that increases parallelism. Currently the orchestrator enforces "all sets must finish planning before execution begins." With interface contracts, a set can begin execution once its own planning is complete AND all contracts it imports from are published. Other sets' execution state is irrelevant. The stub generation system already supports this -- stubs are generated from contracts, not from actual implementations. |
| Hybrid agent build pipeline | No competitor has this. Most (wshobson/agents with 112 agents, Claude-Code-Workflow with 22 agents) hand-write all agent definitions. RAPID v2.1 already has build-agents that generates 29 agents from role modules + core modules. v3.0 refines this: core orchestration agents (orchestrator, merger, reviewer) are hand-written for precision. Repetitive agents (job-executor-1 through job-executor-N, per-set researchers) are generated from templates. This keeps critical path agents carefully crafted while scaling routine agents automatically. | LOW | Existing build-agents pipeline in rapid-tools.cjs. Classify agents into core (hand-written) and generated (template-based). | Already partially implemented. The refinement is making the distinction explicit and adjusting the build pipeline to skip hand-written agents during generation. Core agents get version-controlled .md files in agents/. Generated agents get regenerated on each build from role modules. |
| Adversarial code review (hunter/advocate/judge) | Unique multi-agent review pattern. No competitor implements adversarial review with explicit role separation. Ruflo claims "pair programming mode" but it is collaborative, not adversarial. wshobson/agents has "parallel code review" but with homogeneous reviewers, not hunter-advocate-judge adversarial roles. RAPID's approach (hunter finds issues, devil's advocate challenges them, judge adjudicates) produces higher-quality review by reducing both false positives and false negatives. | Already built | Already shipped in v2.1. No v3.0 work needed -- preserve as-is. | Competitive moat. Document prominently. The 3-cycle iteration with scope narrowing is a genuine differentiator no competitor replicates. |
| 5-level merge conflict detection + 4-tier resolution | No competitor implements structured conflict detection at multiple levels (textual, structural, semantic, contract, behavioral). Ruflo's merge handling is basic git operations. deep-plan has no merge concept. Claude-Code-Workflow has no merge pipeline. RAPID's L1-L4 detection with T1-T2 resolution cascade and adaptive conflict resolver agents is architecturally unique. | Already built | Already shipped in v2.0-v2.2. No v3.0 work needed -- preserve as-is. | Competitive moat. The subagent delegation pattern (v2.2) further strengthens this by isolating per-set merge work. |
| Worktree-based physical isolation | Standard in the industry for parallel agent work (Mike Mason's article confirms git worktrees are becoming the standard isolation mechanism). RAPID pioneered this approach in the Claude Code plugin space. Competitors using it: Claude Code Agent Teams (native worktree per teammate). Not using it: deep-plan (single codebase), Claude-Code-Workflow (single codebase), SuperClaude (single codebase). | Already built | Already shipped in v1.0. No v3.0 work needed -- preserve as-is. | Core architecture. The worktree create/cleanup/reconcile infrastructure is stable and should not be touched in v3.0. |
| Auto-context from codebase scan (--skip deep mode) | Beyond basic --skip (which reads roadmap + contracts), a "deep" mode could run context detect + Glob/Grep pattern matching to discover implementation patterns, existing test conventions, API styles, and code organization. This mirrors deep-plan's research phase but runs automatically without user interaction. | MEDIUM | context detect from rapid-tools.cjs, Glob/Grep for pattern discovery, WAVE-CONTEXT.md auto-generation with discovered patterns. | Enhancement to --skip. Instead of just reading planning artifacts, also scan the actual codebase in the worktree for: existing test patterns (jest/vitest/mocha conventions), API patterns (REST/GraphQL conventions), state management patterns, error handling conventions. Write discoveries into the "Code Context" section of WAVE-CONTEXT.md. |
| Single-command lifecycle (/start-set through merge) | The aspiration: user runs /start-set and RAPID handles the entire lifecycle through merge without additional commands. No competitor achieves full end-to-end autonomous execution. deep-plan stops at planning. Claude-Code-Workflow requires manual command chaining. This would be RAPID's ultimate differentiator -- but requires high confidence in every pipeline stage. | HIGH | All skills working reliably end-to-end, robust error recovery, compaction strategy for long-running sessions. | Defer to v3.1 or later. The current v3.0 focus should be making each individual command reliable and streamlined. Full automation comes after the individual pieces are proven. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. These are explicitly scoped out of v3.0.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time cross-set synchronization | Users want instant visibility into what other sets are doing. Seems like it would improve coordination. | Destroys isolation guarantees. If Set A can see Set B's in-progress changes, coupling creeps in. Sets start depending on uncommitted code. The whole point of worktree isolation is that each set works against contracts, not implementations. Claude-Code-Workflow's "event-driven beat model" attempts this and reports coordination overhead. | Interface contracts + /status command. Contracts define the API boundary. /status shows progress. No runtime coupling. |
| AI-only merge conflict resolution (no HITL) | Users want fully autonomous merge. Seems like natural automation target. | Google's 2025 DORA Report: AI adoption correlates with 91% increase in code review time and 154% increase in PR size. Multi-file semantic conflicts require human judgment about intent. RAPID's current escalation model (confidence < 0.3 goes to human) is correct. Removing the human gate risks silent semantic regressions. | Keep the escalation model. Conflicts below 0.3 confidence or involving API signature changes always go to humans. The adaptive conflict resolver handles mid-confidence (0.3-0.8) programmatically. |
| Dynamic set creation during execution | Users want to add sets while other sets are executing. Seems flexible. | Creates race conditions in contract resolution. If Set A is executing against Set B's contract, and a new Set C appears that modifies the same contract, Set A's stubs become invalid mid-execution. The isolation model breaks. | /add-set command with guard: only allowed when no set has entered "executing" state. Plan-time additions are safe; execution-time additions are not. |
| Plugin-to-plugin skill invocation | Skills calling other skills would simplify orchestration (e.g., /start-set calls /discuss-set). Seems like natural composition. | Claude Code architecture does not support skill-to-skill invocation. Skills run as user-invoked commands, not composable functions. Attempting to nest them causes context confusion and state corruption. The v2.x plan-set skill already proves the correct pattern: replicate the pipeline logic inline. | Inline replication. /start-set includes the discuss and plan logic directly, following the same pattern plan-set uses for wave-plan and job-plan pipelines. |
| Real-time agent coordination via MCP | Ruflo uses MCP for 87 tool definitions. Seems modern and standardized. | MCP adds infrastructure complexity (server process, connection management) that conflicts with RAPID's "git-native, zero infrastructure" constraint. Every dependency on an external process is a failure point for a CLI plugin. Ruflo's MCP dependency means it requires a running server; RAPID works with just Node.js and git. | CLI tool layer (rapid-tools.cjs). Synchronous, predictable, zero infrastructure. Inline YAML documentation makes CLI commands as discoverable as MCP tools without the runtime overhead. |
| Embedding entire codebase in agent context | Claude-Code-Workflow's CodexLens indexes the full codebase with SQLite FTS5. Seems comprehensive. | Context window saturation. Anthropic's own guidance: use Tool Search when 30+ tools exist, and prefer "agentic search" (just-in-time reads) over pre-embedding. Repository maps (tree-sitter ASTs with PageRank) fit in ~1000 tokens. Full codebase embedding wastes context on irrelevant files. | Targeted reads: context detect for overview, Glob/Grep for specific patterns, Read for individual files. This is what Claude Code's Explore subagent already does, and RAPID's existing context-loading module follows this pattern. |
| Version control for agent prompts (git-tracked prompt versioning) | Treating prompts as first-class version-controlled entities. Recent VLDB 2026 paper advocates "prompt algebra" with runtime refinement. | RAPID's agent .md files are already version-controlled in git. The additional abstraction of a "prompt registry" with versioned schemas adds complexity without benefit for a single-plugin system. The build-agents pipeline already provides a compilation step where modules compose into final agents. | Keep the current pattern: role modules + core modules -> build-agents -> agent .md files, all tracked in git. The build step IS the compilation layer. |

## Feature Dependencies

```
/start-set
    |--requires--> /discuss-set (with --skip flag support)
    |                  |--requires--> XML prompt structure (for consistent WAVE-CONTEXT.md generation)
    |                  |--requires--> auto-context from codebase scan
    |--requires--> plan-set (collapsed flow)
    |                  |--requires--> unified planner role (wave-plan + job-plan merged)
    |                  |--requires--> inline YAML tool docs (planner needs CLI reference)
    |--requires--> set-init (already exists)

/add-set
    |--requires--> STATE.json set addition (state add-milestone reuse)
    |--requires--> contract generation (existing plan create-set)
    |--independent-of--> /start-set (separate command)

/new-version
    |--requires--> milestone archival logic
    |--independent-of--> all other v3.0 features

/status
    |--independent-of--> all other v3.0 features (composites existing CLI outputs)

XML prompt structure --enhances--> all SKILL.md files and agent roles
Inline YAML tool docs --enhances--> all agent roles
5th researcher (Domain/UX) --enhances--> /init pipeline
Interface contracts (no gating) --conflicts-with--> set gating enforcement (must remove gating)
Hybrid agent build --enhances--> all generated agents
```

### Dependency Notes

- **/start-set requires /discuss-set + plan-set:** It is a composition of three commands. Both discuss-set and plan-set must be updated to v3.0 patterns (XML prompts, inline YAML) before start-set can compose them.
- **XML prompt structure enhances all skills/agents:** Cross-cutting. Must be done as a foundational step before other SKILL.md refactors, or simultaneously during the refactor of each skill. Doing it first prevents double-refactoring.
- **Interface contracts conflict with set gating:** Removing the planning gate (currently in orchestrator) is a prerequisite for contract-based dependency tracking. Cannot have both active simultaneously.
- **Inline YAML tool docs enhances agents:** Can be done in parallel with XML prompt migration since they target different sections of agent role modules (<tools> is a new section, XML is structural wrapping of existing sections).
- **5th researcher is independent:** Can be added to init at any time. No dependency on other v3.0 features.
- **/status and /new-version are independent:** Pure additions with no cross-dependencies.

## MVP Definition

### Launch With (v3.0 Core)

Minimum features for v3.0 to be considered "shipped."

- [ ] **XML prompt structure** -- Foundational consistency. All SKILL.md and agent roles use XML section tags. Enables reliable parsing by Claude models.
- [ ] **Inline YAML tool docs** -- Self-contained agents. Each agent knows exactly which CLI commands it can use with argument schemas.
- [ ] **Collapsed plan-set flow** -- Core simplification. Single planner produces one PLAN.md per wave.
- [ ] **/discuss-set with --skip** -- Auto-context generation from roadmap + codebase scan. Removes the biggest friction point (5-10 questions per wave).
- [ ] **Interface contracts (no gating)** -- Remove planning gate enforcement. Sets execute when their own planning is done and imported contracts exist.
- [ ] **/start-set** -- Single command to init + discuss + plan a set.
- [ ] **/status** -- Unified project dashboard.
- [ ] **5th researcher (Domain/UX)** -- Completes the research pipeline.
- [ ] **Hybrid agent build refinement** -- Explicit core/generated classification.

### Add After Validation (v3.x)

Features to add once core v3.0 is working reliably.

- [ ] **/add-set** -- When users request mid-milestone set additions in practice
- [ ] **/new-version** -- When users actually use multiple milestones
- [ ] **Auto-context deep mode** -- Full codebase pattern scanning beyond roadmap/contracts
- [ ] **Merge dry-run mode** -- When merge pipeline is exercised enough to warrant preview

### Future Consideration (v4+)

Features to defer until v3.0 is battle-tested.

- [ ] **Single-command lifecycle** -- Full /start-set through merge automation
- [ ] **Agent Teams native integration** -- When EXPERIMENTAL_AGENT_TEAMS is stable and widely available
- [ ] **Cross-milestone dependency tracking** -- When users run 5+ milestones on a single project

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| XML prompt structure | MEDIUM | MEDIUM | P1 -- foundational, must come first or in parallel |
| Inline YAML tool docs | HIGH | MEDIUM | P1 -- agent self-containment is core v3.0 goal |
| Collapsed plan-set flow | HIGH | MEDIUM | P1 -- primary simplification |
| /discuss-set --skip | HIGH | MEDIUM | P1 -- removes biggest UX friction |
| Interface contracts (no gating) | HIGH | MEDIUM | P1 -- architectural simplification |
| /start-set | HIGH | LOW | P1 -- composition of above features |
| /status | MEDIUM | LOW | P1 -- quick win, high utility |
| 5th researcher (Domain/UX) | MEDIUM | LOW | P1 -- follows existing pattern exactly |
| Hybrid agent build refinement | MEDIUM | LOW | P1 -- classification change only |
| /add-set | MEDIUM | LOW | P2 -- add when users request it |
| /new-version | LOW | LOW | P2 -- add when multi-milestone usage observed |
| Auto-context deep mode | MEDIUM | MEDIUM | P2 -- enhancement to --skip |
| Merge dry-run | MEDIUM | LOW | P2 -- nice-to-have for risk assessment |
| Single-command lifecycle | HIGH | HIGH | P3 -- requires proven reliability first |

**Priority key:**
- P1: Must have for v3.0 launch
- P2: Should have, add when validated
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature Area | deep-plan | Claude-Code-Workflow | SuperClaude | Ruflo | wshobson/agents | RAPID v3.0 |
|-------------|-----------|---------------------|-------------|-------|-----------------|------------|
| **Planning** | Single-command research+interview+plan. Sections split for parallel implementation. | /ccw auto-orchestration selects workflow from intent. 3 plan variants (lite, standard, TDD). | /sc:workflow for implementation planning. | Neural routing to specialized agents. | Manual workflow selection. | Collapsed plan-set: single command, one PLAN.md per wave with auto-sequencing. |
| **Auto-context** | Codebase exploration + web research phase (user-controlled). | CodexLens with FTS5/semantic/hybrid search. ACE semantic code search. | Deep Research via Tavily MCP integration. | RAG integration with vector store. | No specific auto-context. | --skip flag: roadmap + codebase scan + contract analysis. No external infrastructure. |
| **Tool docs** | Not applicable (single skill, no CLI layer). | JSON-driven skill definitions. | Slash commands with embedded descriptions. | 87 MCP tool definitions in mcp__claude-flow__ namespace. | 79 tools across 72 plugins. | Inline YAML per agent: subset of CLI commands with argument schemas. |
| **Parallel execution** | Section-level parallelism via subagents. | Event-driven beat model with parallel spawning. | Sequential only. | Configurable concurrency (up to 8 concurrent). Stream-JSON chaining. | Multi-agent teams (7+ agents). | Sets execute in parallel worktrees. Waves sequence within sets. |
| **Isolation** | None (single codebase). | None (single codebase). | None (single codebase). | Agent-level isolation. | Plugin-level isolation. | Git worktree per set. Physical filesystem isolation. |
| **Contract/dependency** | None. | JSON task specs, no inter-agent contracts. | None. | Stream-JSON data flow. | No explicit contracts. | Typed CONTRACT.json per set with exports/imports, stub generation, contract validation. |
| **Merge** | None. | None. | None. | Basic git operations. | No merge pipeline. | 5-level detection, 4-tier resolution, adaptive conflict resolver, subagent delegation per set. |
| **Review** | External LLM review (Gemini/OpenAI). | TDD workflow. | None. | Truth Verification System. | Parallel code review (homogeneous). | Adversarial hunter/advocate/judge with concern-based scoping. |
| **Agent count** | 1 (planning agent). | 22. | ~30 commands. | 64. | 112. | 31 agents (v2.2), refined in v3.0. |

### Key Competitive Insights

1. **RAPID's moat is the full lifecycle.** No competitor covers init through merge. deep-plan stops at planning. Claude-Code-Workflow stops at execution. SuperClaude provides commands but no orchestrated pipeline. Ruflo has the broadest feature set but no merge pipeline.

2. **Auto-context is table stakes now.** Every competitor has some form of codebase analysis. RAPID's --skip flag brings parity. The differentiator is what RAPID does WITH the context (contracts, isolation, structured planning) vs. just feeding it to a single agent.

3. **Interface contracts are genuinely unique.** No competitor implements typed cross-agent contracts with stub generation and contract validation. This is RAPID's strongest architectural differentiator for parallel development.

4. **XML prompt structure aligns with Anthropic's guidance.** The official context engineering recommendations explicitly suggest XML tags for prompt organization. Adopting this puts RAPID in alignment with the platform vendor's best practices.

5. **Inline tool documentation follows emerging patterns.** CrewAI embeds tool definitions in agent prompts. Anthropic recommends self-contained tools. The YAML approach is a pragmatic middle ground: structured enough for reliable parsing, lightweight enough to not bloat context.

## Sources

- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- Tool documentation, prompt structure, sub-agent architecture
- [AI Coding Agents in 2026: Coherence Through Orchestration, Not Autonomy (Mike Mason)](https://mikemason.ca/writing/ai-coding-agents-jan-2026/) -- Interface contracts, coordination mechanisms, git worktree isolation
- [deep-plan: Claude Code Plugin for Comprehensive Planning](https://github.com/piercelamb/deep-plan) -- Research+interview+plan pipeline, section splitting
- [Claude-Code-Workflow (catlog22)](https://github.com/catlog22/Claude-Code-Workflow) -- JSON-driven orchestration, CodexLens auto-context, beat model
- [SuperClaude Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) -- Command structure, slash command patterns
- [Ruflo: Agent Orchestration Platform for Claude](https://github.com/ruvnet/ruflo) -- Stream-JSON chaining, MCP tools, parallel concurrency
- [wshobson/agents: Multi-Agent Orchestration for Claude Code](https://github.com/wshobson/agents) -- 112 agents, 72 plugins, team orchestration
- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams) -- Agent Teams vs subagents, parallel execution
- [CrewAI Framework](https://docs.crewai.com/en/concepts/agents) -- Role-based agent design, embedded tool definitions
- [AutoGen vs LangGraph vs CrewAI (2026 comparison)](https://dev.to/synsun/autogen-vs-langgraph-vs-crewai-which-agent-framework-actually-holds-up-in-2026-3fl8) -- Framework performance benchmarks

---
*Feature research for: RAPID v3.0 Refresh orchestration rewrite*
*Researched: 2026-03-12*
