# CONTEXT: bugfix-uat

**Set:** bugfix-uat
**Generated:** 2026-03-26
**Mode:** interactive

<domain>
## Set Boundary
Extend the existing `/rapid:bug-fix` skill to accept a `--uat [set-id]` argument. When provided, the skill reads `.planning/sets/{setId}/UAT-FAILURES.md`, extracts the embedded JSON metadata block, and dispatches the bugfix executor agent to fix each reported failure. Without `--uat`, the skill works identically to its current behavior (backward compatible). The only file modified is `skills/bug-fix/SKILL.md`.
</domain>

<decisions>
## Implementation Decisions

### Multi-failure Iteration Strategy
- Batch all failures sequentially with no intermediate confirmation prompts. Failures are sorted severity-descending (critical → high → medium → low) before processing.
- **Rationale:** The user wants maximum throughput when fixing UAT failures. Since the --uat flag is an explicit opt-in, the user has already committed to fixing these issues. Severity ordering ensures the most impactful bugs are addressed first, reducing cascading failures.

### Failure-to-Investigation Mapping
- Feed all UAT metadata fields (id, criterion, step, description, severity, relevantFiles, expectedBehavior, actualBehavior) into the investigation/executor as a structured seed. The relevantFiles array is treated as prioritized hints — investigation starts there but expands if the root cause isn't found.
- **Rationale:** Structured metadata provides a significant head start over freeform description. Treating relevantFiles as hints rather than strict scope avoids missing root causes in adjacent files while still benefiting from the UAT agent's file analysis.

### Skill Flow Divergence Point
- The --uat path replaces Steps 1-3 entirely. UAT metadata provides the problem identification (replacing Step 1 gather + Step 2 investigate + Step 3 present findings). The flow goes directly from metadata parsing to executor dispatch (Step 4) and results display (Step 5). The executor receives full UAT context including criterion, expected/actual behavior, severity, and relevantFiles.
- **Rationale:** With structured failure data already identifying the problem, file locations, and expected behavior, the investigation and confirmation steps are redundant. Passing full context to the executor helps it write more targeted fixes that address the specific acceptance criterion.

### Missing/Malformed File Handling
- When UAT-FAILURES.md doesn't exist: display error "No UAT-FAILURES.md found for set X. Run /rapid:uat first." and exit. When UAT-FAILURES.md exists but contains zero failures: display "All UAT tests passed for set X. Nothing to fix." and exit cleanly.
- **Rationale:** Clear error messages with actionable guidance prevent user confusion. The --uat flag is an explicit intent to fix UAT failures, so silently falling back to interactive mode would violate that intent.

### Claude's Discretion
- No areas deferred to Claude's discretion — all 4 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- Severity ordering: critical → high → medium → low before batch processing
- Full UAT context passed to executor: criterion, expectedBehavior, actualBehavior, severity, relevantFiles
- Clean exit paths for both missing file and zero-failures scenarios
</specifics>

<code_context>
## Existing Code Insights
- Current bug-fix SKILL.md has a 5-step flow: gather → investigate → present → execute → display
- The executor agent (rapid-executor) receives a plan with Task description, Files, Action, Verification, and Done-when fields
- UAT-FAILURES.md uses `<!-- UAT-FAILURES-META {JSON} -->` format with a `failures` array containing objects with fields: id, criterion, step, description, severity, relevantFiles, userNotes, expectedBehavior, actualBehavior
- The `<!-- UAT-FORMAT:v2 -->` marker identifies the file format version
- CONTRACT.json imports `uat-failures-format` from the `uat-workflow` set
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
