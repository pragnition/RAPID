# Phase 8: Merge Pipeline - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Independent set work merges cleanly into main with automated deep review, contract enforcement, and dependency-aware ordering. The merge pipeline reviews each set, fixes automatable issues, validates contracts and ownership, and merges in dependency-graph order with post-wave integration gates.

</domain>

<decisions>
## Implementation Decisions

### Review depth and scope
- Layered contract validation: programmatic first (compileContract + generateContractTest from contract.cjs as hard gate), then agent reviews for semantic compliance (behavioral invariants, intent matching)
- Tests must pass (run `node --test` in worktree) AND reviewer agent checks for untested critical paths (exported functions without tests, error paths without assertions). Missing coverage = request changes, not block
- Ownership violations block merge UNLESS the set declared a CONTRIBUTIONS.json entry for that file. Undeclared cross-set modifications are hard blocks
- Review output written to `.planning/sets/{name}/REVIEW.md` with sections: verdict (approve/changes/block), contract results, ownership check, test results, findings list. Machine-parseable verdict line

### Cleanup agent behavior
- New `rapid-cleanup` agent type (separate from rapid-executor) with constrained scope: only style fixes and test generation. Has Read, Edit, Write, Bash, Grep, Glob tools
- Auto-fix and re-review: cleanup agent spawns in the set's worktree, fixes issues, commits, then reviewer re-reviews automatically. No human intervention unless it fails twice
- Fixable issues: style violations (naming, formatting), missing test coverage for untested exports
- Blocking issues (require human): contract violations, logic errors, architectural issues, ownership violations
- Max 2 cleanup rounds. If issues remain after 2 rounds, escalate to human with a summary of what couldn't be fixed

### Merge ordering strategy
- Merge commit per set (preserves branch history, no squash)
- Sets merge in dependency-graph order using DAG (dag.cjs toposort/wave assignment)
- Independent sets within the same wave merge sequentially (not in parallel) — each merge sees the result of the previous
- If any set fails to merge, halt the entire sequence. Already-merged sets stay merged. Developer resolves conflict manually, then resumes
- Post-wave integration gate: after each wave's sets merge, run full test suite on main. If tests fail, halt before next wave

### Merge workflow UX
- Both auto-trigger and manual: /rapid:merge for explicit trigger, auto-starts after all sets complete execution successfully
- /rapid:merge merges all completed sets by default, /rapid:merge {set-name} merges a specific set (with its dependencies)
- Live wave-by-wave progress display in terminal: which set is being reviewed, cleanup status, merge result. Updates as each step completes
- Merged worktrees kept until developer runs /rapid:cleanup (not auto-removed after merge)

### Claude's Discretion
- Exact REVIEW.md format and verdict line syntax
- Cleanup agent prompt design and tool constraints
- Live progress display implementation details
- How auto-trigger detects "all sets complete"

</decisions>

<specifics>
## Specific Ideas

- Review pipeline follows a clear sequence per set: programmatic contract validation → test run → agent deep review → verdict
- Cleanup is a tight loop: reviewer finds fixable issues → cleanup agent fixes → reviewer re-reviews (max 2 rounds)
- Merge order reuses the same DAG structure from execution (dag.cjs) — no separate ordering system needed
- Post-wave gate on main ensures integration issues are caught before dependent sets merge

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `contract.cjs`: compileContract(), generateContractTest(), checkOwnership(), createContribution() — all directly usable for programmatic validation
- `dag.cjs`: toposort(), assignWaves(), getExecutionOrder() — provides merge ordering out of the box
- `worktree.cjs`: gitExec(), createWorktree(), detectMainBranch() — git operations for merge execution
- `rapid-reviewer.md`: Agent definition already exists with review checklist, structured returns, and state access protocol
- `verify.cjs`: verifyLight() — existing verification that could inform review checks
- `execute.cjs`: prepareSetContext(), assembleExecutorPrompt() — pattern for preparing agent contexts

### Established Patterns
- Agent definitions in `rapid/agents/` as `.md` files with YAML frontmatter (name, description, tools, model)
- Structured return protocol (COMPLETE/CHECKPOINT/BLOCKED) with machine-parseable JSON in HTML comments
- State access through rapid-tools.cjs CLI — never direct file writes
- Library modules in `rapid/src/lib/` with matching `.test.cjs` files using node:test

### Integration Points
- New `rapid-cleanup.md` agent definition in `rapid/agents/`
- New `merge.cjs` library in `rapid/src/lib/` with matching tests
- New `/rapid:merge` skill in `rapid/skills/merge/`
- CLI subcommand `merge` in `rapid-tools.cjs`
- REVIEW.md files in `.planning/sets/{name}/`
- Hooks into execution completion to auto-trigger merge pipeline

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-merge-pipeline*
*Context gathered: 2026-03-04*
