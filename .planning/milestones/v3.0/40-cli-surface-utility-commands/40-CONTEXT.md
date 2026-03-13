# Phase 40: CLI Surface & Utility Commands - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Make rapid-tools.cjs and skill directories reflect the v3.0 command structure (7 core + 4 auxiliary + help + kept utilities). Rename commands to v3 names, delete obsolete skill dirs, add deprecation stubs for removed commands, and update /status, /install, /review, /merge to work with the simplified set-level-only state schema from Phase 38.

</domain>

<decisions>
## Implementation Decisions

### Command mapping
- **7 core commands (renamed):** init, start-set (was set-init), discuss-set (was discuss), plan-set (stays), execute-set (was execute), review, merge
- **4 auxiliary commands:** status, install, new-version (was new-milestone), add-set (deferred to Phase 44)
- **1 meta command:** help — free, outside the 7+4 structure
- **Kept utilities (unlisted):** assumptions, pause, resume, context, cleanup — rewrite if necessary to work with v3 state, but not part of the official 7+4
- **Deprecation stubs:** /rapid:plan → minimal skill file saying "Use /rapid:plan-set instead"
- **Deleted entirely:** wave-plan skill dir, old renamed dirs (set-init, discuss, execute, new-milestone after rename)
- **/add-set and /quick:** deferred to Phase 44 (execution skills)

### Deprecation UX
- Deprecation stubs live as minimal skill files (SKILL.md only) — not in rapid-tools.cjs
- Message format: simple one-liner (e.g., "/rapid:plan was removed in v3.0. Use /rapid:plan-set instead.")
- Skills-level deprecation only — CLI subcommands in rapid-tools.cjs are internal (agents call them, users don't)
- Obsolete CLI subcommands in rapid-tools.cjs (wave-plan, job-level state ops) are NOT removed in this phase — deferred to Phase 45 (docs/cleanup)

### /status dashboard redesign
- Dashboard shows: set status + last git activity (commit timestamp/message on each set's branch)
- No wave/job breakdown — set-level only
- Per-set next-action suggestions based on status (e.g., "Run /rapid:discuss-set 1" for pending sets)
- Implementation approach: Claude's discretion (adapt existing commands or create new subcommand)

### Review state updates
- /review gates on set status = 'complete' before allowing review
- Note: /execute-set must transition set to 'complete' when done (Phase 44 responsibility)
- Review scoping: keep current scoper logic (already works at set level from v2.1) — just remove wave references from orchestration
- Review pipeline internals (unit test, bug hunt, UAT) stay intact

### Merge state updates
- /merge checks set status = 'complete' (not wave completion)
- Rewrite merge state handling to fully embrace simplified schema — not just patching wave/job references
- Auto-transition set to 'merged' status after successful merge to main
- Merge pipeline internals (DAG ordering, conflict detection, subagent delegation) stay intact

### Claude's Discretion
- Implementation approach for /status data fetching (adapt existing commands vs new subcommand)
- How to restructure the help skill to reflect the new 7+4+help+utilities structure
- Exact content of the /plan deprecation stub
- How to update /install for v3 (likely minimal changes)
- How much of the utility commands (assumptions, pause, resume, context, cleanup) need rewriting vs just removing wave/job references

</decisions>

<specifics>
## Specific Ideas

- "These [assumptions, pause, resume, context, cleanup] are still important. Rewrite if necessary." — User wants utility commands preserved as functional, just not in the official command list
- "/plan was to plan for the entire project previously" — deprecation message should reflect this (project-level planning now handled differently)
- "Gate on complete status, but remember that /execute has to update the status too" — cross-phase dependency: Phase 44 must implement the execute → complete transition
- Merge state handling should be a real rewrite, not a patch job

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/status/SKILL.md`: Current v2 status dashboard — rewrite to drop wave/job hierarchy, add set + last activity
- `skills/install/SKILL.md`: Current install skill — likely minimal v3 changes
- `skills/review/SKILL.md`: Review orchestrator — remove wave references, gate on set status
- `skills/merge/SKILL.md`: Merge orchestrator — rewrite state handling, add auto-transition to merged
- `skills/help/SKILL.md`: Help reference — rewrite to reflect v3 command structure
- `src/lib/tool-docs.cjs`: TOOL_REGISTRY (59 commands) and ROLE_TOOL_MAP (18 roles) — will need cleanup in Phase 41/45 after CLI surface changes

### Established Patterns
- Skills use `CLAUDE_SKILL_DIR` to find RAPID_ROOT, load .env for RAPID_TOOLS
- CLI subcommands dispatched via case statements in rapid-tools.cjs
- `display banner` CLI command for branded stage banners
- AskUserQuestion for all user interaction within skills
- `node "${RAPID_TOOLS}" <subcommand>` pattern for CLI calls from skills

### Integration Points
- `rapid-tools.cjs` main dispatch: case statements need updating for renamed subcommands
- `skills/` directory structure: new dirs for renamed commands, deleted dirs for removed commands
- `tool-docs.cjs` ROLE_TOOL_MAP: wave-planner, job-planner, wave-analyzer roles reference obsolete commands — cleanup deferred to Phase 41/45
- STATE.json set-level status checks replace wave/job traversal in review and merge skills

</code_context>

<deferred>
## Deferred Ideas

- /rapid:add-set creation — Phase 44
- /rapid:quick creation — Phase 44
- Obsolete CLI subcommand removal from rapid-tools.cjs — Phase 45
- TOOL_REGISTRY and ROLE_TOOL_MAP cleanup — Phase 41/45

</deferred>

---

*Phase: 40-cli-surface-utility-commands*
*Context gathered: 2026-03-12*
