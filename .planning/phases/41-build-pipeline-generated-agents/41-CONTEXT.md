# Phase 41: Build Pipeline & Generated Agents - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Update handleBuildAgents() to implement hybrid build (SKIP_GENERATION for core agents, generate the rest with tool doc injection), prune obsolete v2 wave/job agents from the pipeline and codebase, add a 6th researcher (research-ux) for domain conventions and UX patterns in the init pipeline, and create minimal stubs for the 5 core agents.

</domain>

<decisions>
## Implementation Decisions

### SKIP_GENERATION mechanism
- Static hardcoded array: `SKIP_GENERATION = ['orchestrator', 'planner', 'executor', 'merger', 'reviewer']`
- Core agents stay in ROLE_CORE_MAP (used for tool doc generation, frontmatter lookups) -- build loop skips them
- Silent skip -- no log output for skipped agents
- Build summary shows both counts: "Built 22 agents (5 core skipped) in agents/"

### 5th researcher (research-ux)
- Agent name: `research-ux` (role module: `role-research-ux.md`, agent: `rapid-research-ux.md`)
- Focus: domain conventions (how similar products work, standard terminology, user expectations) AND UX patterns (interaction models, information architecture, accessibility)
- Tools: Read, Grep, Glob, WebFetch, WebSearch -- same as other research agents
- Pipeline position: spawns in parallel with the other 5 researchers, synthesizer waits for all 6

### Obsolete agent pruning
- Remove 5 v2 wave/job agents NOW (not deferred to Phase 45):
  - wave-planner, wave-researcher, wave-analyzer, job-planner, job-executor
- Full deletion: role modules (src/modules/roles/), generated agent files (agents/), and all registry entries (ROLE_CORE_MAP, ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS)
- Also clean up ROLE_TOOL_MAP in tool-docs.cjs for the 5 removed roles
- KEEP codebase-synthesizer and context-generator -- they still serve a purpose in v3

### Core agent file format
- Core agents use XML skeleton: identity, conventions, tools, returns sections follow standard structure
- `<role>` section is freeform -- hand-written with whatever structure fits the agent (Phase 42)
- SKIP_GENERATION array is the sole mechanism for identifying core agents -- no file-level markers
- Phase 41 creates stub files for the 5 core agents with:
  - YAML frontmatter (name, description, tools, model, color)
  - `<tools>` section injected from tool-docs.cjs
  - `<role>` section as TODO placeholder for Phase 42

### Claude's Discretion
- Exact content of the research-ux role module prompt
- How to update the init skill to spawn the 6th researcher
- Stub content for core agent `<role>` placeholders
- Whether to add a build-time validation that SKIP_GENERATION entries actually exist in ROLE_CORE_MAP

</decisions>

<specifics>
## Specific Ideas

- Build output: "Built 22 agents (5 core skipped) in agents/" -- explicit about hybrid nature
- research-ux covers "how similar products work in this space" + "how users expect to interact" -- the full user-facing picture
- Stubs should be functional enough for Claude Code discovery (frontmatter + tools) but clearly marked as Phase 42 work in the role section

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `handleBuildAgents()` in rapid-tools.cjs (line 450): Main build function -- add SKIP_GENERATION check in the build loop
- `assembleAgentPrompt()` (line 622): Already handles XML structure, tool doc injection -- reuse for stub generation
- `ROLE_CORE_MAP` (line 572): Central role registry -- add research-ux, remove 5 wave/job roles
- `ROLE_TOOLS` (line 461): Tool assignments per role -- add research-ux, remove 5 wave/job roles
- `ROLE_COLORS` (line 498): Color assignments -- add research-ux, remove 5 wave/job roles
- `ROLE_DESCRIPTIONS` (line 535): Descriptions -- add research-ux, remove 5 wave/job roles
- `tool-docs.cjs`: ROLE_TOOL_MAP -- add research-ux mapping, remove 5 wave/job role mappings
- `skills/init/SKILL.md` (lines 385-505): Init research pipeline -- add 6th researcher spawn

### Established Patterns
- All roles registered in 4 parallel maps: ROLE_TOOLS, ROLE_COLORS, ROLE_DESCRIPTIONS, ROLE_CORE_MAP
- Role modules at `src/modules/roles/role-{name}.md`
- Generated agents at `agents/rapid-{name}.md` with GENERATED comment prefix
- Research agents spawned in parallel, synthesizer waits for all to complete

### Integration Points
- `handleBuildAgents()` build loop (line 694): Insert SKIP_GENERATION check before assembleAgentPrompt call
- `skills/init/SKILL.md`: Add rapid-research-ux spawn alongside existing 5 researchers
- `tool-docs.cjs` ROLE_TOOL_MAP: Add research-ux entry, remove 5 wave/job entries

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 41-build-pipeline-generated-agents*
*Context gathered: 2026-03-12*
