# Phase 42: Core Agent Rewrites - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Hand-write the `<role>` sections for 4 core agents (planner, executor, merger, reviewer), update the shared identity section for v3, remove the orchestrator agent entirely, and update roadmap success criteria to reflect 4 core agents. Each agent gets a GUIDED autonomy classification with appropriate escape hatches.

</domain>

<decisions>
## Implementation Decisions

### Orchestrator removal
- Remove orchestrator entirely — each skill (SKILL.md) is its own orchestrator
- Drop from SKIP_GENERATION (4 core agents, not 5)
- Delete agents/rapid-orchestrator.md and src/modules/roles/role-orchestrator.md
- Remove from all registry maps (ROLE_CORE_MAP, ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_TOOL_MAP)
- Update ROADMAP.md success criteria: "4 hand-written core agents" instead of 5
- Skills remain the sole dispatchers of subagents — all core agents are leaf agents
- RAPID:RETURN protocol stays — agents still emit structured returns, skills parse them

### Agent autonomy levels
- All 4 core agents are GUIDED — framework + flexibility, no strict scripting
- Planner: guided decomposition framework, adapts approach to project structure
- Executor: guided implementation flow, adapts when plan needs adjustment
- Merger: guided conflict detection/resolution protocol, flexibility in resolution approach
- Reviewer: guided code review with prioritization guidance, decides severity
- No SCRIPTED or AUTONOMOUS agents — GUIDED is the right balance for all 4

### Size budget
- Raise file size cap from 8KB to 12KB — stubs already consume 7.5-8.7KB without role content
- Role sections: agent-specific depth (not uniform)
  - Merger/planner: comprehensive roles (complex protocols, ~2-4KB)
  - Executor/reviewer: compact roles (simpler tasks, ~1-2KB)
- Behavior description only — no inline worked examples in role sections

### Identity section update
- Update core-identity.md workflow description for v3 in this phase (not deferred)
- v3 workflow: init > start-set > discuss > plan-set > execute-set > review > merge
- Remove wave/job references from identity
- Remove orchestrator references — skills dispatch directly
- Reflect independent sets (no sync gates)

### Planner role rewrite
- Full rewrite for v3 pipeline — not adapted from v2's 264-line JSON decomposition role
- v3 planner produces PLAN.md per wave (not JSON set proposal)
- Keep decomposition thinking and contract concepts but change output format entirely
- Match the collapsed plan-set pipeline (2-4 agent spawns, not 15-20)

### Executor role adaptation
- Adapt for PLAN.md-based execution flow
- Read PLAN.md files, implement tasks, determine completion from planning artifacts (not wave/job state)
- Keep atomic commits and set boundary enforcement
- Enable re-entry after crash via artifact inspection

### Merger role preservation
- Preserve and adapt the proven v2 semantic conflict detection protocol
- Keep: confidence scoring, escalation rules, resolution process, L5 detection + T3 resolution focus
- Adapt: update state transitions for v3 model, remove wave references
- Core protocol intact — this is battle-tested

### Reviewer role expansion
- Expand from minimal 27-line checklist to guided review with prioritization
- Add guidance: contract compliance > correctness > style (priority order)
- Add severity assessment guidance
- Add structured output format for findings
- Still a leaf agent — does NOT spawn UAT/bug-hunt/unit-test subagents (skill handles that)

### Claude's Discretion
- Exact content structure within each `<role>` section
- How to compress identity section while keeping essential v3 workflow info
- Edge-case escape hatch design for GUIDED classification
- How to phrase executor's artifact-based completion detection

</decisions>

<specifics>
## Specific Ideas

- Orchestrator removal mirrors the same pattern that emerged: each skill already orchestrates its own pipeline, the "orchestrator" was a vestigial v2 concept
- Subagents can't spawn sub-subagents (hard Claude Code platform constraint) — if nested dispatch is ever needed, use `claude -p` (CLI subprocess), not the Agent tool
- Merger role should keep the confidence scoring thresholds (0.5-1.0 bands) and escalation rules — these are the most valuable part of the v2 merger

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agents/rapid-planner.md` (8.7KB stub): Has identity, conventions, tools, returns. Needs `<role>` section written
- `agents/rapid-executor.md` (8.4KB stub): Same structure. Needs `<role>` section
- `agents/rapid-merger.md` (8.4KB stub): Same structure. Needs `<role>` section
- `agents/rapid-reviewer.md` (7.6KB stub): Same structure. Needs `<role>` section
- `src/modules/roles/role-planner.md` (264 lines): v2 decomposition logic — rewrite source material
- `src/modules/roles/role-executor.md` (69 lines): v2 execution flow — adaptation source
- `src/modules/roles/role-merger.md` (127 lines): v2 conflict protocol — preserve and adapt
- `src/modules/roles/role-reviewer.md` (27 lines): v2 checklist — expansion source
- `src/modules/core/core-identity.md`: Shared identity section — update for v3 workflow

### Established Patterns
- XML prompt schema (PROMPT-SCHEMA.md): 6 tags, assembly order: identity > conventions > tools > role > returns
- SKIP_GENERATION array protects core agents from build overwrite
- RAPID:RETURN protocol with COMPLETE/CHECKPOINT/BLOCKED statuses
- YAML frontmatter (name, description, tools, model, color)

### Integration Points
- `rapid-tools.cjs` SKIP_GENERATION: Remove orchestrator, update to 4 entries
- `rapid-tools.cjs` registry maps: Remove orchestrator from ROLE_CORE_MAP, ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS
- `tool-docs.cjs` ROLE_TOOL_MAP: Remove orchestrator entry
- `core-identity.md`: Update workflow description for v3
- `ROADMAP.md` Phase 42 success criteria: Update to 4 core agents

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-core-agent-rewrites*
*Context gathered: 2026-03-12*
