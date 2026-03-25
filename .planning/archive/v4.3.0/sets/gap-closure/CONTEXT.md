# CONTEXT: gap-closure

**Set:** gap-closure
**Generated:** 2026-03-24
**Mode:** interactive

<domain>
## Set Boundary
Implement the `--gaps` flag in plan-set and execute-set skills so merged sets with remaining gaps (identified by the post-execution verifier in GAPS.md) can undergo targeted gap-closure planning and execution. The set modifies SKILL.md files (agent behavior prompts) and CLI command handlers. It does not change the state machine, merge pipeline, or review system.
</domain>

<decisions>
## Implementation Decisions

### Implementation Layer
- SKILL.md + CLI helpers: Skill prompts drive gap-closure behavior, CLI provides structured helpers for gap-wave discovery and numbering (e.g., extending existing subcommands with --gaps flag support).
- **Rationale:** Purely prompt-based logic lacks programmatic enforcement. CLI helpers give agents structured data (gap wave counts, next wave number) while keeping the SKILL.md as the behavioral driver.

### CLI Surface
- Extend existing subcommands with --gaps flag rather than adding new subcommands.
- **Rationale:** Keeps the API surface smaller and follows the familiar pattern of flag-based behavior modification. Existing subcommands gain conditional logic guarded by --gaps.

### Status Gate Relaxation
- Inline conditional in existing validation: Add `if (status === 'merged' && gapsFlag)` or `if (['complete', 'merged'].includes(status) && gapsFlag)` guards to existing status validation blocks in both SKILL.md files, then rejoin the normal flow where possible.
- Both plan-set and execute-set --gaps accept 'complete' AND 'merged' status (not just 'merged'), allowing gap closure before or after merge.
- **Rationale:** Inline conditionals minimize code duplication. Accepting both 'complete' and 'merged' gives users flexibility to close gaps at either lifecycle stage, while the --gaps flag guard prevents accidental gate relaxation for normal workflows.

### Gap Wave Numbering
- Simple sequential continuation: if set had waves 1-2, gap-closure waves become wave-3, wave-4, etc. Existing glob patterns (`wave-*-PLAN.md`) work unchanged.
- Gap-closure plans are marked via a metadata header inside the PLAN.md content (e.g., `## Gap Closure` section or `gap-closure: true` marker at top), not via filename conventions.
- **Rationale:** Sequential numbering directly satisfies the CONTRACT.json behavioral invariant. Metadata headers are self-documenting without breaking any existing tooling or path conventions.

### Plan Scoping Strategy
- GAPS.md as primary input: the planner reads GAPS.md for the list of unmet criteria, with CONTEXT.md and CONTRACT.json providing broader context for implementation.
- Researcher agent is optional: prompt the user via AskUserQuestion whether they want to run the researcher before gap-closure planning.
- **Rationale:** GAPS.md already contains well-defined, verifier-identified gaps. A full re-plan would wastefully re-analyze completed work. Making the researcher optional gives users a choice when the codebase may have drifted since original execution.

### Gap Wave Granularity
- Default to one wave per gap item, but the planner has discretion to group related/overlapping gaps into shared waves when there's clear file overlap or dependency.
- Gap-closure waves respect the same 1-4 wave limit as normal planning.
- **Rationale:** One-wave-per-gap gives clear traceability (gap -> wave -> verification). But forcing strictly independent waves when gaps share files would create unnecessary conflicts. The 1-4 limit keeps gap-closure targeted without being artificially constrained.

### Verification After Gaps
- Targeted gap-only verification: verifier checks only the items listed in GAPS.md, not all success criteria.
- GAPS.md is updated in-place with resolved markers (e.g., `[RESOLVED]`) next to each closed gap.
- **Rationale:** Re-verifying already-passing criteria is wasteful. Targeted verification is fast and focused. In-place markers preserve the history of what was identified and what was fixed.

### Re-Entry for Partial Gap-Closure
- Same WAVE-COMPLETE.md artifact detection as normal execution -- no gap-specific markers needed.
- GAPS.md is updated incrementally: each gap is marked resolved as its corresponding wave completes.
- **Rationale:** Reusing existing re-entry detection means zero new code for resumption. Incremental GAPS.md updates survive interruptions and give accurate progress tracking.

### GAPS.md Consumption Flow
- plan-set --gaps requires GAPS.md to exist. If missing, fail fast with direction to run execute-set first.
- Planner maps gaps to waves with default bias toward 1:1 mapping, but groups related gaps when file overlap warrants consolidation.
- **Rationale:** Requiring GAPS.md ensures gaps are always machine-identified by the verifier, maintaining the structured workflow. Allowing planner grouping prevents unnecessary wave proliferation when gaps share implementation surface.

### Claude's Discretion
- No areas were left to Claude's discretion -- all 8 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- The execute-set SKILL.md already mentions `--gaps` in Step 1 comments but the status-gate logic does not honor it -- this is the starting point for implementation.
- plan-set SKILL.md has no mention of --gaps at all -- needs a new conditional path added to Step 2 validation.
- GAPS.md format from execute-set Step 5 lists unmet criteria -- this becomes the structured input for gap-closure planning.
- The `gap-closure: true` metadata in PLAN.md files allows downstream agents (executor, verifier) to adjust behavior if needed without filename changes.
- AskUserQuestion gate for researcher agent: "Would you like to research before gap-closure planning? (Skip if codebase hasn't changed since original execution)"
</specifics>

<code_context>
## Existing Code Insights
- `skills/plan-set/SKILL.md`: Status validation in Step 2 rejects anything past 'discussed' with "Planning is complete." -- needs inline conditional for --gaps.
- `skills/execute-set/SKILL.md`: Step 1 already parses --gaps flag and mentions "gap closure mode" but Step 1 status validation rejects 'complete' and 'merged' sets -- needs conditional relaxation.
- `src/commands/plan.cjs`: Subcommands are `create-set`, `decompose`, `write-dag`, `list-sets`, `load-set`. May need `list-sets` or a new helper to expose gap-wave numbering info.
- `src/commands/execute.cjs`: Has `wave-status`, `verify`, `prepare-context` subcommands. The `wave-status` subcommand could be extended with --gaps to filter to gap-only waves.
- WAVE-COMPLETE.md markers and wave-N-PLAN.md glob patterns work unchanged with sequential gap wave numbering.
- GAPS.md is written by the rapid-verifier agent in execute-set Step 5 -- this file is the structured input for gap-closure planning.
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
