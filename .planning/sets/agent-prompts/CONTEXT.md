# CONTEXT: agent-prompts

**Set:** agent-prompts
**Generated:** 2026-03-19
**Mode:** interactive

<domain>
## Set Boundary
Fix CLI command references across all 26 agents and 24 skills so they use exact subcommand syntax from TOOL_REGISTRY (F1). Fix discuss-set to limit gray area options to exactly 4, matching AskUserQuestion's constraint (F3). The approach centers on adding a CLI command reference to `core-identity.md` that propagates through the `build-agents` pipeline, then rebuilding all agents.
</domain>

<decisions>
## Implementation Decisions

### CLI Reference Format

- Use grouped one-liners format (commands grouped by domain with condensed one-liner syntax per command)
- Each agent receives only its **role-filtered** subset of commands via ROLE_TOOL_MAP, not the full TOOL_REGISTRY catalog
- This requires build-pipeline changes: `build-agents.cjs` must inject the role-specific command list into each agent's prompt during assembly
- `core-identity.md` itself stays generic (no inline command list) — the per-role injection happens at build time

### TOOL_REGISTRY Drift Test

- Add a **static unit test** that parses the USAGE string from `rapid-tools.cjs` and compares against TOOL_REGISTRY keys
- Test should fail if any TOOL_REGISTRY key doesn't correspond to an actual CLI subcommand, or if a CLI subcommand is missing from TOOL_REGISTRY

### Hand-written Agent Safety

- **Verify the existing guard** (`<!-- CORE: Hand-written agent -->` comment) in `build-agents.cjs` works correctly
- Add a test that confirms hand-written agents (executor, planner, merger, reviewer) are never overwritten by the build pipeline
- No new safeguard mechanisms needed — just verify and test the existing one

### Gray Area Count Policy

- discuss-set must always identify **exactly 4** gray areas — no more, no fewer
- Update SKILL.md Step 5 heading and Key Principles section from "2-5 gray areas" to "exactly 4 gray areas"
- This aligns perfectly with AskUserQuestion's 4-option constraint
</decisions>

<specifics>
## Specific Ideas
- The grouped one-liner format should mirror TOOL_REGISTRY's domain groupings (State, Planning, Execution, Memory, Merge, Worktree, etc.)
- Per-role filtering means agents like the researcher only see state-read and planning commands, while the executor sees execution + state commands
- The drift test should be in `src/lib/tool-docs.test.cjs` alongside existing tool-docs tests
</specifics>

<code_context>
## Existing Code Insights

- `TOOL_REGISTRY` in `src/lib/tool-docs.cjs` is the source of truth for all CLI commands, organized by domain (state, planning, execution, memory, merge, worktree, set-init, review, resolve, display)
- `ROLE_TOOL_MAP` in the same file maps agent roles to their permitted command subsets
- `build-agents.cjs` assembles agent prompts from modules in `src/modules/` — it already has a `<!-- CORE: Hand-written agent -->` guard to skip hand-written agents
- `core-identity.md` at `src/modules/core/core-identity.md` is included in every agent's prompt — it covers identity, workflow, tool invocation, and state rules
- There are exactly 26 agent `.md` files in `agents/`
- The discuss-set SKILL.md at `skills/discuss-set/SKILL.md` has Step 5 listing 5 numbered options and Key Principles saying "2-5 gray areas"
</code_context>

<deferred>
## Deferred Ideas
- None identified during discussion
</deferred>
