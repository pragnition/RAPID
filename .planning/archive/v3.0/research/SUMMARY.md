# Project Research Summary

**Project:** RAPID v3.0 Refresh
**Domain:** Claude Code plugin — agent orchestration layer rewrite
**Researched:** 2026-03-12
**Confidence:** HIGH

## Executive Summary

RAPID v3.0 is a surgical rewrite of an existing, working Claude Code plugin that orchestrates parallel development through a hierarchy of sets, waves, and jobs. The v2.x system suffers from two compounding problems: orchestration complexity (wave-plan + job-plan as separate agent spawns forces 15-20 agent invocations per set and 5-10 user interactions) and agent confusion (agents hallucinate CLI commands because they lack embedded tool documentation). The v3.0 refresh addresses both by collapsing the planning pipeline into a single plan-set flow and embedding per-agent YAML tool docs into prompts. Critically, this is a reduction effort — zero new npm dependencies, significant code removal, and architectural simplification — which is both the appeal and the primary risk.

The recommended approach follows a strict build order: state machine first (everything downstream depends on it), tool docs registry second (agents and skills depend on it), CLI surface third (tool docs must reflect accurate commands), build pipeline fourth (regenerates all agents), core agent rewrites fifth (orchestrator/planner/executor/merger hand-written), then skill rewrites last (wire everything together). The review and merge pipelines are proven moats that must be preserved exactly — they represent RAPID's primary competitive differentiation against deep-plan, Claude-Code-Workflow, SuperClaude, and Ruflo, none of which implement a full lifecycle from init through adversarial review through structured merge.

The dominant risks are regression and simplification amnesia. The state machine, file locking, set gating, and wave-level discussion each look like good simplification targets but exist for specific edge cases discovered during v1.0-v2.1 development. Each must be replaced before it is removed, not removed in hope that nothing breaks. The "surgical rewrite" framing creates false confidence — the orchestration layer is deeply coupled to review and merge at three specific points (state transition sequences, CLI output schemas, RAPID:RETURN parsing contracts), and breaking any of these coupling points silently degrades the proven pipelines.

## Key Findings

### Recommended Stack

RAPID v3.0 requires zero new npm dependencies. The existing stack — Node.js >=18, Zod 3.25.76 (CommonJS, do not upgrade to v4), proper-lockfile 4.1.2, ajv 8.17.1, and git worktrees — handles all v3.0 requirements. The headline features (inline YAML tool docs, XML prompt structure, hybrid agent build) are build-time string operations implemented with template literals and JavaScript objects. No YAML parser, XML library, template engine, or state machine library is needed.

**Core technologies:**
- Node.js >=18: Runtime — no change, no new APIs needed
- Zod 3.25.76: Schema validation — simplify schemas (remove WaveState/JobState), keep CommonJS require(); do NOT upgrade to v4 (breaks CJS)
- proper-lockfile 4.1.2: File locking — reduced scope (remove set gating locks, keep STATE.json mutation locks for concurrent subagent scenarios)
- ajv 8.17.1 + ajv-formats 3.0.1: JSON Schema for CONTRACT.json — no change
- CommonJS (.cjs format): Module system — no change; avoid TypeScript for build pipeline
- git + worktrees: VCS and physical isolation — no change, core architecture
- node:test (built-in): Tests — new/updated tests for refactored build pipeline

**What NOT to introduce:** js-yaml, fast-xml-parser, Handlebars/EJS, XState, TypeScript for build pipeline, any MCP infrastructure.

### Expected Features

**Must have for v3.0 (table stakes — without these the refresh fails its purpose):**
- Collapsed plan-set flow — single command produces one PLAN.md per wave; reduces agent spawns from 15-20 to 2-4 per set
- XML-formatted prompt structure — foundational consistency; must be done first or in parallel with all other changes
- Inline YAML tool docs per agent — each agent knows exactly which CLI commands it can invoke; eliminates command hallucination
- /discuss-set with --skip flag — auto-generates CONTEXT.md from roadmap + codebase scan; removes the 5-10 questions-per-wave friction
- Interface contracts without gating — remove planning gate enforcement; sets execute when their own planning is done
- /start-set command — composes set-init + discuss-set + plan-set into one invocation
- /status command — unified project dashboard showing sets, phases, active worktrees
- 5th researcher (Domain/UX) — adds domain/UX patterns to init research pipeline; follows existing researcher pattern exactly
- Hybrid agent build refinement — explicit core/generated classification; 5 hand-written, ~15-17 generated

**Should have (differentiators to preserve from v2.x):**
- Adversarial review pipeline (hunter/advocate/judge) — already shipped, preserve as-is; no competitor replicates this
- 5-level merge conflict detection + 4-tier resolution — already shipped, preserve as-is; unique in the ecosystem
- Git worktree physical isolation — already shipped, core architecture; do not touch

**Defer to v3.x:**
- /add-set command — add when users request mid-milestone set additions in practice
- /new-version command — add when multi-milestone usage observed
- Auto-context deep mode — full codebase pattern scanning beyond roadmap/contracts
- Single-command lifecycle (/start-set through merge) — requires v3.0 proven reliable first

**Anti-features (explicitly do NOT build):**
- Real-time cross-set synchronization — destroys isolation guarantees
- AI-only merge conflict resolution (no HITL) — DORA 2025 data shows AI adoption correlates with 91% increase in code review time; escalation to human is correct
- Dynamic set creation during execution — creates race conditions in contract resolution
- Plugin-to-plugin skill invocation — Claude Code architecture does not support it
- More than ~12 total commands — v3 target of 7 core + 4 auxiliary is exactly right per Miller's Law

### Architecture Approach

The v3.0 architecture simplifies in one direction (orchestration and state management) while preserving two proven subsystems completely (review and merge). The state machine collapses from a 5-level hierarchy (project > milestone > set > wave > job) to 3 levels (project > milestone > set), eliminating WaveState and JobState entirely. Planning artifacts restructure from per-wave WAVE-CONTEXT.md and per-job JOB-PLAN.md to per-set CONTEXT.md and per-wave PLAN.md. The build pipeline gains a SKIP_GENERATION set (hand-written agents) and a ROLE_TOOL_DOCS map (per-agent CLI command registry). The key pattern shift is "state-as-bookmark" — STATE.json records where the project is, not drives control flow.

**Major components:**
1. Simplified state machine (state-schemas.cjs, state-transitions.cjs, state-machine.cjs) — sets only; removing WaveState, JobState, derived status propagation, and lock acquisition inside transitions; crash recovery triad preserved (detectCorruption, recoverFromGit, commitState)
2. Tool docs registry (new: src/lib/tool-docs.cjs) — per-role CLI command specs rendered as compact YAML (1,000-token budget per agent); replaces core-state-access.md and core-context-loading.md with per-role `<tools>` sections
3. Hybrid build pipeline (handleBuildAgents() in rapid-tools.cjs) — SKIP_GENERATION set for 5 hand-written core agents; ROLE_TOOL_DOCS map injects `<tools>` XML section per generated agent
4. Collapsed planning pipeline (plan-set/SKILL.md rewrite) — 2-3 agent spawns per set (set-researcher + plan-set-agent + optional verifier) vs. 15-20 in v2.x
5. Hand-written core agents (rapid-orchestrator.md, rapid-planner.md, rapid-executor.md, rapid-merger.md, rapid-reviewer.md) — authored directly in agents/, never overwritten by build pipeline
6. Preserved review + merge pipelines — kept entirely intact; only state reference updates permitted

**Build order (must follow this sequence):**
1. State machine simplification (Phase 1)
2. Tool docs registry + core module refactor (Phase 2)
3. CLI command surface update (Phase 3)
4. Build pipeline + generated agent updates (Phase 4)
5. Core agent rewrites, hand-written (Phase 5)
6. Skill rewrites (Phase 6)
7. Documentation, contracts, cleanup (Phase 7)

### Critical Pitfalls

1. **Accidental regression breaking review/merge** — The orchestration layer has three coupling points with review/merge: state transition sequences (review checks `set.status === 'reviewing'`), CLI output schemas (merge skill parses specific JSON fields), and RAPID:RETURN contracts. Any change at these coupling points silently breaks the proven pipelines. Prevention: map the blast radius before cutting; write integration tests for review and merge precondition checks; use adapter layer if status names change; phase the rewrite so orchestration-only modules change before anything review/merge depends on.

2. **Simplification amnesia removing non-redundant functionality** — File locks, set gating, wave-level discuss, and derived status propagation each look like over-engineering but exist for specific edge cases: concurrent STATE.json writes from orchestrator + subagent, contract drift between dependent sets, mid-execution gray area questions, and set-level status without traversing the full tree. Prevention: classify before removing (known unnecessary / redundant / unknown purpose); only remove what is known unnecessary; build replacement before removing.

3. **Inline YAML tool docs bloating agent context windows** — 60+ commands at 80-120 tokens each = 4,800-7,200 tokens if naively embedded. Anthropic guidance: budget no more than 5-10% of context window for system prompt. Prevention: embed only commands the agent actually calls (3-8 commands, not 60); use ultra-compact one-line signatures (~30 tokens per command vs ~100 for full YAML); enforce a hard 1,000-token budget per agent's tool block; validate format with one agent before scaling to all 31.

4. **XML formatting inconsistency across 31+ agent prompts** — Without a schema document, tag names diverge across agents. Mixed Markdown/XML within a single agent is worse than either pure format. Prevention: define the XML schema document before any conversion (exactly which tags are allowed, what they contain, nesting rules); migrate in batches with validation; use the build pipeline to inject XML wrappers so human authors write Markdown content only.

5. **State simplification losing crash recovery and re-entry** — The current state machine provides crash recovery (detectCorruption + recoverFromGit), idempotent re-entry (status-based gates that skip completed work), and atomic writes (temp file + rename). Simplifying the state model can break all three. Prevention: preserve the crash recovery triad regardless of other simplifications; keep temp-file-then-rename atomic writes even if locks are removed; design simplified status values with re-entry scenarios as explicit acceptance criteria.

6. **Interface contracts without enforcement becoming write-once-read-never artifacts** — Removing the planning gate without replacing contract enforcement creates contracts with no teeth. Prevention: replace gate with continuous enforcement at three points (after planning, during execution commits, before merge); make contracts immutable after planning; add executor-side contract verification in execute-set skill; keep merge-time contract regression test as ultimate safety net.

### Domain/UX Key Findings

The UX research identifies five specific anti-patterns in v2.x to fix in v3.0: (1) the "which command" problem from 17 overlapping commands — fix is 7 core + 4 auxiliary = 11 total, each doing exactly one thing; (2) the "context required" problem where commands implicitly depend on conversation history — fix is every command bootstrapping exclusively from STATE.json + artifacts on disk; (3) the "decision menu" problem of 3-5 AskUserQuestion options after every operation — fix is strong defaults with exactly one suggested next step; (4) the "missing prerequisite" problem of cryptic errors — fix is error messages that show full progress breadcrumb (what's done, what's missing, what to run next); (5) the "wave vs set confusion" from /wave-plan and /plan-set coexisting — fix is one command (/plan-set) handling all waves automatically.

**UX design principles for v3.0:** Every command is a transaction (read state from disk → validate → do work → write state atomically → suggest one next action). Progressive disclosure (7+4 command structure; devs learn 7 first, discover 4 as needed). Strong defaults, rare questions (strong autonomy dial; reserve AskUserQuestion for genuine ambiguity only). Errors as navigation (breadcrumb trail + next command, not cryptic state names). Commands that explain themselves (embedded tool docs per agent).

## Implications for Roadmap

Based on combined research, the architecture file's 7-phase build order is the correct phase structure. Each phase has been designed so it can be independently tested before the next phase begins.

### Phase 1: State Machine Simplification
**Rationale:** Everything downstream depends on the state schema. Changed last, it requires re-touching every component. Changed first, all other phases build on a stable foundation.
**Delivers:** Simplified SetStatus enum (adds `discussing`, removes wave/job states); streamlined state-machine.cjs (no lock acquisition in transitions, no derived status propagation, crash recovery triad preserved); updated unit tests for all 3 state files; atomic write pattern retained.
**Addresses:** FEATURES.md collapsed plan-set flow (requires `discussing` state); DOMAIN-UX.md self-contained commands (status model must support re-entry after /clear).
**Avoids:** PITFALLS Pitfall 5 (crash recovery must survive simplification — preserve detectCorruption, recoverFromGit, commitState, and atomic temp-file writes even as the hierarchy flattens).
**Research flag:** Standard patterns — well-understood refactoring with clear test coverage. Skip research-phase.

### Phase 2: Tool Docs Registry and Core Module Refactor
**Rationale:** Agents and skills reference tool docs. The registry must exist before any agent or skill can be written or rebuilt. Core module consolidation clears the way for the build pipeline update in Phase 4.
**Delivers:** New src/lib/tool-docs.cjs with TOOL_REGISTRY + getToolDocsForRole() + ROLE_TOOL_MAP; new core-tools.md template module; new core-conventions.md (merges core-git.md + code style); updated core-identity.md (absorbs context-loading guidance); XML schema document defining all allowed tags and nesting rules; retired core-state-access.md and core-context-loading.md.
**Addresses:** FEATURES.md inline YAML tool docs; ARCHITECTURE.md Component 3 (tool docs registry); XML schema definition prerequisite for all subsequent prompt work.
**Avoids:** PITFALLS Pitfall 3 (context bloat) — establish ultra-compact one-line format and 1,000-token-per-agent budget here before scaling; PITFALLS Pitfall 4 (XML inconsistency) — define the XML schema document as part of this phase before any agent file is touched.
**Research flag:** Standard patterns — build pipeline manipulation is well-understood. Validate compact format with one real agent before scaling.

### Phase 3: CLI Command Surface Update
**Rationale:** Tool docs must reflect accurate command signatures. The CLI surface must be finalized before tool-docs.cjs can be populated with correct specs.
**Delivers:** Pruned rapid-tools.cjs (wave/job subcommands removed, help text updated); path-related commands adapted for new artifact structure (.planning/sets/{set}/waves/ instead of .planning/waves/{set}/); clear deprecation errors for removed commands; stub skills for old command names with migration messages.
**Addresses:** DOMAIN-UX.md 7+4 command reduction; FEATURES.md collapsed plan-set flow requirements.
**Avoids:** PITFALLS Pitfall 9 (command surface confusion) — clean cut on all renames in one phase rather than gradual renaming; stub skills prevent muscle-memory failures from 17 v2 commands.
**Research flag:** Standard patterns — removing code is straightforward. The risk is in user-facing command naming, mitigated by deprecation messages.

### Phase 4: Build Pipeline and Generated Agent Updates
**Rationale:** The build pipeline produces all generated agents. It must be updated — and new agent format validated — before core hand-written agents are authored in Phase 5.
**Delivers:** Updated handleBuildAgents() with SKIP_GENERATION set and `<tools>` section injection from tool-docs.cjs; updated ROLE_CORE_MAP; new role-domain-researcher.md (5th researcher); retired role modules for wave-analyzer, wave-researcher, wave-planner, job-planner, job-executor; regenerated all ~15-17 generated agents.
**Addresses:** FEATURES.md hybrid agent build refinement; FEATURES.md 5th researcher (Domain/UX); STACK.md hybrid build pipeline details.
**Avoids:** PITFALLS Pitfall 8 (hybrid agent quality inconsistency) — core modules must carry quality patterns (RAPID:RETURN parsing, error handling, state access) so generated agents inherit them automatically; PITFALLS Pitfall 3 (context bloat) — validate per-agent token budget during build before committing format.
**Research flag:** Standard patterns — extends established build-agents pipeline. Validate one generated agent fully before regenerating all 17.

### Phase 5: Core Agent Rewrites (Hand-Written)
**Rationale:** Core agents define the user-facing experience of v3.0. They depend on all prior phases: finalized state schema (Phase 1), tool docs registry (Phase 2), CLI surface (Phase 3), and build pipeline skip-list (Phase 4). Writing them last in the agent sequence ensures they reference stable foundations.
**Delivers:** Hand-written agents/rapid-orchestrator.md, rapid-planner.md, rapid-executor.md, rapid-merger.md, rapid-reviewer.md — each under 8KB target; per-agent tool docs embedded directly (not template-injected); XML section structure; v3.0 state transitions; edge case escape hatches in scripted sections.
**Addresses:** ARCHITECTURE.md Component 5; FEATURES.md hybrid agent build; DOMAIN-UX.md agents that know their tools.
**Avoids:** PITFALLS Pitfall 7 (autonomy miscalibration) — explicitly classify each core agent as SCRIPTED/GUIDED/AUTONOMOUS before writing; include edge case escape hatches in scripted prompts; PITFALLS Pitfall 1 (accidental regression) — orchestrator and merger must preserve exact state transition sequences and RAPID:RETURN parsing that review and merge skills depend on.
**Research flag:** Needs research-phase. Orchestrator and merger are the highest-risk agents. Research should enumerate the exact coupling points (state transitions, CLI output schemas, RAPID:RETURN fields) that the new hand-written versions must preserve before authoring begins.

### Phase 6: Skill Rewrites
**Rationale:** Skills wire agents, state, and CLI together. They must be written after all underlying components are finalized. Writing skills last eliminates the risk of skills referencing components that later change.
**Delivers:** Rewritten discuss-set, plan-set, execute-set, start-set, init, status, new-version skills; new quick and add-set skills; preserved review, merge, install, help skills (minor state reference updates only); retired discuss, wave-plan, execute, set-init skills.
**Addresses:** All FEATURES.md P1 features; DOMAIN-UX.md all 5 UX anti-patterns; ARCHITECTURE.md Component 7 (discuss-set), Component 2 (collapsed planning pipeline).
**Avoids:** PITFALLS Pitfall 1 (regression) — update review and merge skills' state references atomically with state machine changes; PITFALLS Pitfall 6 (contracts without enforcement) — add executor-side contract verification into execute-set skill; DOMAIN-UX.md transaction pattern — each skill reads state from disk, validates preconditions, does work, writes state atomically, suggests exactly one next action.
**Research flag:** Needs research-phase for plan-set and execute-set specifically. The collapsed planning pipeline (2-3 agent spawns replacing 15-20) is the highest-complexity new skill. Research should validate the plan-set-agent prompt can reliably produce PLAN.md for 3-5 wave scenarios before the skill is written.

### Phase 7: Documentation, Contracts, and Cleanup
**Rationale:** Polish phase. All functional work is complete. This phase removes dead code, simplifies contracts, and makes v3.0 the official version.
**Delivers:** Simplified CONTRACT.json (removed GATES.json generation); minimized lock.cjs (set-gating locks removed, mutation locks retained); updated DOCS.md and README.md; updated commands/*.md reference files; version bump to 3.0.0; pruned unused libraries and test files.
**Addresses:** FEATURES.md interface contracts without gating (finalize by removing GATES.json); ARCHITECTURE.md data flow cleanup.
**Avoids:** PITFALLS Pitfall 6 (contracts without enforcement) — replacement enforcement must be verified end-to-end (continuous validation, executor-side checks, merge-time regression test) before GATES.json is removed.
**Research flag:** Standard patterns — documentation and cleanup. Contract enforcement replacement should be validated end-to-end before removing the gate.

### Phase Ordering Rationale

- **State first** because all schemas, tests, and agents reference state types; changing state last means touching everything twice
- **Tool docs before agents** because agents need accurate command specs; authoring agents before the registry is complete forces guessing
- **CLI before tool docs population** because tool docs must reflect the real CLI surface; removing commands after tool docs are written forces tool docs revision
- **Generated agents before hand-written agents** because the build pipeline skip-list must be in place before hand-written files are created (otherwise build-agents overwrites them on next run)
- **Skills last** because skills reference specific agent return formats, specific CLI commands, and specific state transitions — all of which must be stable before skills are authored
- **Review and merge preserved throughout** because they are the primary competitive moats and the source of silent failures if coupling points change without synchronized updates

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Core Agent Rewrites):** Orchestrator and merger are the highest-risk agents. Research should enumerate the exact coupling points (state transitions, CLI output schemas, RAPID:RETURN fields) that new hand-written versions must preserve.
- **Phase 6 (Skill Rewrites, specifically plan-set and execute-set):** The collapsed planning pipeline is the primary architectural change. Research should validate that a single plan-set-agent can reliably produce PLAN.md for multi-wave scenarios without the verification overhead of the v2.x cascade.

Phases with standard patterns (skip research-phase):
- **Phase 1 (State Machine):** Well-understood refactoring with clear test coverage. Code removal, not addition.
- **Phase 2 (Tool Docs Registry):** Extends existing build-agents patterns. Format validation experiment is sufficient — no full research phase.
- **Phase 3 (CLI Surface):** Code removal with deprecation stubs. No new patterns.
- **Phase 4 (Build Pipeline):** Extends existing handleBuildAgents() with SKIP_GENERATION and ROLE_TOOL_DOCS maps. Well-understood extension.
- **Phase 7 (Cleanup):** Documentation and dead code removal. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings based on direct codebase inspection. Zero new dependencies confirmed. Zod CJS compatibility verified. Existing dependencies verified working. |
| Features | HIGH | Competitive analysis against 5 frameworks plus Anthropic's official context engineering guidance. MVP definition is clear with explicit P1/P2/P3 prioritization. |
| Architecture | HIGH | Full codebase analysis of 32 agents, 21 libraries, 17 skills, and the refresh.md spec. Build order validated against dependency graph. Component-level change descriptions are precise with file names. |
| Pitfalls | HIGH | Based on RAPID's own retrospective (4 shipped versions), direct codebase analysis of 26,829 LOC, industry research on multi-agent failures, and Anthropic's guidance. Each pitfall has concrete warning signs and prevention steps. |
| Domain/UX | HIGH | Patterns well-established across Cursor 2.0, Copilot Workspace, Devin 2.0, and Claude Code native. Five specific v2 anti-patterns identified with concrete fixes and interaction model comparisons. |

**Overall confidence:** HIGH

### Gaps to Address

- **Plan-set agent capability boundary:** The collapsed plan-set flow (single agent producing all PLAN.md files for a 3-5 wave set) has not been validated in practice. The v2.x cascade exists because early testing showed single-agent planning degraded for complex sets. The v3.0 single-agent approach should be prototyped against a realistic multi-wave set before being committed in the Phase 6 skill rewrite (flagged for Phase 6 research-phase).

- **Contract enforcement replacement completeness:** The plan to replace set gating with continuous contract enforcement (three enforcement points: after planning, during execution, before merge) is architecturally sound but has not been validated in a concurrent multi-set scenario. The specific mechanism for "contract immutability after planning" needs precise definition — who owns contract mutation? What is the explicit change request process?

- **Tool doc format token validation:** The PITFALLS research establishes a 1,000-token budget per agent's tool block. This should be validated during Phase 2 with a real generated agent before committing the format. The compact one-line signature format (~30 tokens per command) is the recommendation, but its effect on agent command accuracy versus the verbose YAML format (~100 tokens per command) needs empirical confirmation.

- **Crash recovery re-entry at set level only:** The simplified state machine loses wave/job-level re-entry granularity. If Claude Code crashes mid-wave-execution, the executor must determine completion by reading planning artifacts (which PLAN.md files have implementation commits) rather than from STATE.json wave/job statuses. This executor-side re-entry logic must be explicitly designed in Phase 5 and tested in Phase 6.

## Sources

### Primary (HIGH confidence)
- RAPID v2.2.0 codebase — direct analysis of 32 agents, 21 libraries, 17 skills, 105KB CLI (rapid-tools.cjs); state machine (460 lines), build-agents pipeline, all role and core modules; 26,829 LOC total
- refresh/refresh.md — v3.0 design spec authored by project owner
- .planning/PROJECT.md — project context, requirements, key decisions
- Anthropic: Effective Context Engineering for AI Agents — tool documentation, prompt structure, sub-agent architecture
- Anthropic: Claude Code Best Practices — context management, subagent patterns

### Secondary (MEDIUM confidence)
- Mike Mason (mikemason.ca, 2026-01) — interface contracts, coordination mechanisms, git worktree isolation as industry pattern
- deep-plan (piercelamb/deep-plan) — research+interview+plan pipeline, section splitting
- Claude-Code-Workflow (catlog22) — JSON-driven orchestration, CodexLens auto-context, beat model
- SuperClaude Framework (SuperClaude-Org) — command structure, slash command patterns
- Ruflo (ruvnet/ruflo) — Stream-JSON chaining, MCP tools, 87-tool MCP surface
- wshobson/agents — 112 agents, 72 plugins, team orchestration
- Cursor 2.0, GitHub Copilot Workspace, Devin 2.0 — competitive UX analysis, interaction model comparison
- CrewAI Framework — role-based agent design, embedded tool definitions

### Tertiary (MEDIUM-LOW confidence)
- Google DORA Report 2025 — AI adoption and code review time correlation (cited in anti-features rationale)
- Smashing Magazine: Designing For Agentic AI (2026-02) — autonomy dial UX pattern
- CLI UX Guidelines (clig.dev, Atlassian, Evil Martians, Lucas F. Costa) — progressive disclosure, error navigation
- AutoGen vs LangGraph vs CrewAI 2026 comparison (ByteByteGo) — framework performance benchmarks
- Temporal.io research — workflow state autosaving and checkpointing patterns (cited in Pitfall 5)

---
*Research completed: 2026-03-12*
*Ready for roadmap: yes*
