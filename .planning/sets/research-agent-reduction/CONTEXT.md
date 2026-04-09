# CONTEXT: research-agent-reduction

**Set:** research-agent-reduction
**Generated:** 2026-04-09
**Mode:** interactive

<domain>
## Set Boundary
Reduce the number of research agents spawned during `/rapid:new-version` from a hardcoded 6 to a dynamically selected subset. All changes are confined to `skills/new-version/SKILL.md`. The 6 individual agent prompts (inline in Step 5) remain unchanged; the orchestration logic, synthesizer prompt (Step 6), description line, and anti-pattern rules are the edit targets.
</domain>

<decisions>
## Implementation Decisions

### Consolidation Grouping
- **No static consolidation.** Instead of merging agents into fixed pairs, the orchestrator dynamically decides which of the 6 research agents to spawn based on the milestone's goals. All 6 agent prompts remain available as options; the orchestrator selects the relevant subset per milestone.
- **Rationale:** Hardcoded groupings bake in assumptions about domain overlap that may not hold for every milestone. Dynamic selection lets the orchestrator adapt to the actual scope -- a pure CLI refactor might skip UX and stack, while a user-facing milestone spawns all 6.

### UX Domain Placement
- Follows from the dynamic selection approach -- the orchestrator decides whether UX research is needed for each milestone rather than permanently merging it with another domain.
- **Rationale:** UX relevance varies significantly across milestones. For a CLI plugin like RAPID, some milestones have no user-facing changes at all.

### Agent Count Target
- **Dynamic, not fixed.** The target is "fewer than 6 when appropriate" rather than a specific number. The orchestrator uses semantic analysis of the milestone goals to determine how many agents (1-6) are needed.
- **Rationale:** A fixed count (e.g., always 3) would either over-research simple milestones or under-research complex ones. The user's priority is preserving research depth -- when in doubt, spawn the agent.

### Selection Mechanism
- **Semantic analysis.** The orchestrator reads all milestone goals and reasons about which research domains are relevant. No keyword matching or category-to-agent mapping -- the model uses its judgment.
- **Rationale:** Goal categories don't map cleanly to research domains (e.g., a "tech debt" goal might need architecture + pitfalls research but not stack). Semantic analysis is more flexible and leverages model intelligence.

### Agent Prompts
- **Keep all 6 agent prompts unchanged.** The individual research agent spawn prompts in Step 5 remain as-is. Only the orchestration logic around them changes.
- **Rationale:** Zero risk of quality regression in individual agent outputs. The prompts are proven across 20+ milestones.

### Synthesizer Input
- **Dynamic file list.** The orchestrator passes the actual list of generated research files to the synthesizer prompt, rather than hardcoding 6 file paths.
- **Rationale:** Clean coordination -- the orchestrator knows exactly which agents ran and passes that information forward. No discovery logic needed in the synthesizer.

### Synthesizer Prompt
- **Generic restructuring.** Rewrite the synthesizer prompt to work with any set of research files without domain-specific references (no "deduplicate across stack and architecture" language). The synthesizer reads whatever files it's given and produces a unified synthesis.
- **Rationale:** The downstream consumer (roadmapper) reads synthesis as prose, not structured domain sections. A generic synthesizer handles variable input gracefully.

### Claude's Discretion
- Priority tradeoff: preserve depth (user confirmed). When the orchestrator is uncertain whether a research domain is relevant, it should err on the side of spawning the agent.
</decisions>

<specifics>
## Specific Ideas
- The orchestrator should add a brief reasoning step in SKILL.md (Step 5) where it analyzes the goals and lists which agents it will spawn and why, before actually spawning them. This makes the selection transparent and debuggable.
- The anti-pattern rule "MUST spawn all 6" should be replaced with language like "MUST semantically analyze goals before selecting agents" and "MUST NOT skip agents without explicit reasoning."
</specifics>

<code_context>
## Existing Code Insights
- All 6 agent spawn prompts are inline in `skills/new-version/SKILL.md` Step 5, each with identical structure: Milestone Brief, Brownfield Context, Carry-Forward Context, Deferred Context, Working Directory, Instructions.
- The synthesizer in Step 6 hardcodes 6 file paths (`{milestoneId}-research-{domain}.md`) and references domain names in its deduplication logic.
- The "Important Constraints" section states "All 6 research agents are independent" -- this still holds but needs rewording for dynamic selection.
- Anti-patterns section includes "Do NOT spawn only 5 researchers -- MUST spawn all 6" and "Do NOT skip the UX researcher" -- both need updating.
- The description line at the top says "6-researcher pipeline" -- needs updating.
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
