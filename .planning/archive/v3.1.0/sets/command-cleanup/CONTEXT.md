# CONTEXT: command-cleanup

**Set:** command-cleanup
**Generated:** 2026-03-13
**Mode:** interactive

<domain>
## Set Boundary
Remove all remaining references to 6 deprecated command families (set-init, discuss, wave-plan, plan-set, execute, new-milestone) from TOOL_REGISTRY, ROLE_TOOL_MAP, CLI handlers, display maps, worktree suggestions, role markdown files, and tests. This is a deletion-focused set with zero imports and low risk. The underlying library functions (e.g., `wt.setInit()` in worktree.cjs) are NOT deprecated -- only the CLI command surface and registry entries are being removed.
</domain>

<decisions>
## Implementation Decisions

### plan-verifier Role Handling
- Claude's Discretion: Investigate whether the plan-verifier role is actively used by generated agents. If it has no remaining valid tool keys after wave-plan-validate removal, remove the role entry from ROLE_TOOL_MAP entirely. If it's still referenced by generated agents, leave it with the 2 remaining tools (state-get, plan-load-set). Verify all dependencies and resolve accordingly.

### worktree.cjs Suggested Action Replacement
- Replace `/set-init {set.id}` with `/rapid:start-set {set.id}` (using the string set ID, not numeric index).
- Also scan for and replace any other occurrences of `/set-init` in role files, comments, or non-archive documentation.

### Standalone Stage Cleanup in display.cjs
- Remove exactly 4 deprecated keys from STAGE_VERBS and STAGE_BG: `set-init`, `discuss`, `wave-plan`, `execute`.
- Keep `init`, `review`, `merge`, `plan-set` -- these are actively used by current skill SKILL.md files (`display banner init`, `display banner review`, `display banner merge`, `display banner plan-set`).
- Update JSDoc comments to remove references to deprecated stages (the Legacy (8) list and group descriptions).

### handleSetInit Function Removal
- Claude's Discretion: Delete the entire `handleSetInit` function and its `case 'set-init':` dispatch branch from rapid-tools.cjs. The underlying `wt.setInit()` in worktree.cjs remains untouched (still used by start-set skill). The `list-available` subcommand is redundant with `/rapid:status` which already shows set states, so it can be removed. Also remove the `set-init` lines from the USAGE string.
</decisions>

<specifics>
## Specific Ideas
- Use exact-match patterns when grepping to avoid over-deleting (e.g., don't accidentally remove `discuss-set` when targeting `discuss`)
- The plan-verifier role dependency check should look at `src/modules/roles/` and generated agent files to confirm usage
- TOOL_REGISTRY cleanup targets: `set-init-create`, `set-init-list`, `wave-plan-resolve`, `wave-plan-create-dir`, `wave-plan-validate`, `wave-plan-list-jobs`
- ROLE_TOOL_MAP cleanup target: `wave-plan-validate` in the `plan-verifier` entry
</specifics>

<code_context>
## Existing Code Insights
- TOOL_REGISTRY (tool-docs.cjs:62-69): 6 deprecated entries across set-init-* and wave-plan-* prefixes
- ROLE_TOOL_MAP (tool-docs.cjs:126): plan-verifier references wave-plan-validate
- STAGE_VERBS (display.cjs:24-39): 4 deprecated entries (set-init, discuss, wave-plan, execute)
- STAGE_BG (display.cjs:50-65): Same 4 deprecated entries
- rapid-tools.cjs:78-79: USAGE string has set-init help text
- rapid-tools.cjs:190-191: case 'set-init' dispatch
- rapid-tools.cjs:1303-1364: handleSetInit function (entire function is dead code)
- worktree.cjs:792: `/set-init ${set.id}` suggested action
- role-roadmapper.md: references `/rapid:wave-plan`
</code_context>

<deferred>
## Deferred Ideas
- Consider adding a deprecation warning system for future command renames instead of silent removal
- The `new-milestone` command family may have references in older role files worth auditing in a separate pass
</deferred>
