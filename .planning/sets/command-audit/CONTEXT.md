# CONTEXT: command-audit

**Set:** command-audit
**Generated:** 2026-03-14
**Mode:** interactive

<domain>
## Set Boundary
Audit all skills and agents for references to non-existent rapid-tools.cjs `wave-plan-*` commands. Remove 4 phantom entries from TOOL_REGISTRY in tool-docs.cjs (`wave-plan-resolve`, `wave-plan-create-dir`, `wave-plan-validate`, `wave-plan-list-jobs`), update ROLE_TOOL_MAP to drop references to removed keys, and rewrite skill/agent passages that invoke these commands. Add a consistency test to enforce the invariant going forward.
</domain>

<decisions>
## Implementation Decisions

### Review Skill Job Discovery
- **Decision:** Replace `wave-plan list-jobs` CLI call (lines 190-193 of skills/review/SKILL.md) with glob-based filesystem scan using `Glob .planning/waves/{setId}/*/JOB-PLAN.md`. Agents already have Glob access, so no new tooling needed.

### Contract Validation in Plan-Set
- **Decision:** Remove the `wave-plan validate-contracts` section entirely from skills/plan-set/SKILL.md (lines 274-288, Step 7). Contracts are enforced at execution/merge time, not during planning. No replacement logic needed.

### Plan-Verifier Agent Tools
- **Decision:** Remove `wave-plan-validate` from plan-verifier's ROLE_TOOL_MAP entry with no replacement. Plan-verifier validates plans via reading files (Read/Glob) -- no CLI tool needed for contract checking.

### Consistency Test Scope
- **Decision:** Scan active source only: `skills/`, `agents/`, `src/lib/tool-docs.cjs`. Exclude `.planning/`, archives, `display.cjs` stage map, and test files. The `wave-plan` string in display.cjs is a valid display stage name (not a CLI subcommand) and should not be flagged.
</decisions>

<specifics>
## Specific Ideas
- The ROLE_TOOL_MAP consistency test should assert that every key referenced in any role's tool list exists in TOOL_REGISTRY
- The phantom command test should grep active skill/agent .md files for `wave-plan` CLI invocations (node commands, not prose references)
</specifics>

<code_context>
## Existing Code Insights
- `src/lib/tool-docs.cjs` lines 66-69: The 4 phantom entries are `wave-plan-resolve`, `wave-plan-create-dir`, `wave-plan-validate`, `wave-plan-list-jobs`
- `src/lib/tool-docs.cjs` line 126: ROLE_TOOL_MAP `plan-verifier` role references `wave-plan-validate` -- this causes `getToolDocsForRole('plan-verifier')` to throw
- `skills/review/SKILL.md` lines 190-193: Uses `node "${RAPID_TOOLS}" wave-plan list-jobs <set-id> <wave-id>` to discover job plans
- `skills/plan-set/SKILL.md` line 280: Uses `node "${RAPID_TOOLS}" wave-plan validate-contracts "${SET_ID}" "wave-${N}"`
- `agents/rapid-plan-verifier.md`: References `wave-plan-validate` in tools section
- `src/lib/display.cjs`: Uses `wave-plan` as a valid display stage name -- this is NOT a CLI subcommand and must be preserved
- `skills/wave-plan/SKILL.md`: Already a deprecated redirect stub pointing to plan-set -- no changes needed
</code_context>

<deferred>
## Deferred Ideas
- A future set could add a proper `contract validate` CLI subcommand if runtime contract validation during planning becomes needed
- Consider auditing other deprecated command stubs beyond wave-plan in a separate pass
</deferred>
