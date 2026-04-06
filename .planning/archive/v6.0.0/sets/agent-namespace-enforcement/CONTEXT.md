# CONTEXT: agent-namespace-enforcement

**Set:** agent-namespace-enforcement
**Generated:** 2026-04-01
**Mode:** interactive

<domain>
## Set Boundary
Strengthen namespace isolation across RAPID agent prompts. The primary target is `src/modules/core/core-identity.md` (the Namespace Isolation section), but the set also includes sweeping all role module files to fix any agent/skill references that don't use the proper `rapid:` or `rapid-` prefix.
</domain>

<decisions>
## Implementation Decisions

### Deny-list Design
- General rule only — no concrete namespace examples in the deny-list. A single imperative rule: agents MUST NOT invoke any skill or agent outside the `rapid:` namespace.
- **Rationale:** Concrete examples require maintenance as the plugin ecosystem evolves. A general rule is durable and unambiguous. The user explicitly chose simplicity over example-anchored enforcement.

### Enforcement Language
- Rewrite the Namespace Isolation section with imperative MUST/MUST NOT language. Add a clear "NEVER call subagents without the `rapid:` prefix" directive.
- **Rationale:** The current advisory phrasing ("Ignore them entirely") is weak. Imperative language aligns with how LLMs respect directives.

### Agent File Sweep
- Sweep all agent role modules (`src/modules/roles/`) for references to agents or skills that don't use the proper `rapid:` or `rapid-` prefix. Fix any found references (e.g., "call the rapid executor" → "call the `rapid:executor` subagent").
- **Rationale:** User identified that existing agent prompts may reference other agents informally without the namespace prefix. Fixing these ensures consistency and models the correct behavior for agents.

### User-Override Semantics
- User intent can override namespace lockdown. When explicit user intent is passed through the skill prompt, agents may comply with non-RAPID skill requests.
- **Rationale:** RAPID agents are subagents, but user tasks may legitimately require non-RAPID capabilities. Strict lockdown would cause unnecessary BLOCKEDs.

### Claude's Discretion
- BLOCKED message format and content (include rejected skill name for transparency)
- Specific wording of the imperative enforcement directive
- How to handle edge cases in the agent file sweep (documentation references, comments, etc.)

### Build-time Validation
- Skip build-time regex validation. No automated check in `build-agents.cjs`.
- **Rationale:** User prefers simplicity. Future enhancement could use an LLM-based validator (deferred).
</decisions>

<specifics>
## Specific Ideas
- User wants references like "call the rapid executor" changed to "call the `rapid:executor` subagent" with proper backtick formatting
- The sweep should cover all role modules under `src/modules/roles/`
- After all changes, regenerate agents via `build-agents` so updated identity module propagates
</specifics>

<code_context>
## Existing Code Insights
- Current Namespace Isolation section is at line 39-41 of `src/modules/core/core-identity.md` — single paragraph with advisory language
- `build-agents.cjs` assembles agents from core modules + role modules. All roles include `core-identity.md` via `ROLE_CORE_MAP`
- Role modules live in `src/modules/roles/role-*.md`
- 4 core agents (planner, executor, merger, reviewer) are in SKIP_GENERATION — their files aren't overwritten by build-agents, but they still include core-identity.md content
- Assembled agents are output to the `agents/` directory under the RAPID plugin root
</code_context>

<deferred>
## Deferred Ideas
- LLM-based build-agents validation — spawn an executor agent post-build to validate namespace compliance (suggested as future enhancement)
</deferred>
