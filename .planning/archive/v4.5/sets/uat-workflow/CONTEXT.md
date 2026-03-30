# CONTEXT: uat-workflow

**Set:** uat-workflow
**Generated:** 2026-03-26
**Mode:** interactive

<domain>
## Set Boundary
Replace the current automation+human hybrid UAT with a fully human-driven step-by-step workflow. The UAT agent (role-uat.md) generates detailed test plans only — no execution. The UAT skill (SKILL.md) orchestrates the human through each step via AskUserQuestion, collecting pass/fail/skip verdicts. Failures are logged to a structured UAT-FAILURES.md file with embedded JSON metadata. This set defines the UAT-FAILURES.md format contract that the bugfix-uat set depends on.
</domain>

<decisions>
## Implementation Decisions

### Step Presentation Granularity
- **One step per prompt.** Each AskUserQuestion presents exactly one atomic test step to the human tester.
- **Rationale:** Maximizes precision and produces unambiguous pass/fail/skip per step. The human never has to disambiguate which step in a batch failed. Despite potentially higher prompt count (15-25 for a typical set), clarity is prioritized over speed.

### Failure Description Capture
- **Free-text note on failure.** When a step is marked "Fail", the skill prompts for a free-text description of what went wrong.
- **Rationale:** Human testers describe failures most effectively in their own words. This free-text is stored in both the JSON metadata block (for bugfix-uat parsing) and the markdown body (for human readability).

### Test Plan Structure
- **Grouped by acceptance criterion.** The UAT agent organizes scenarios under the acceptance criterion they validate, preserving the `[wave-N]` prefix for traceability.
- **Rationale:** Direct traceability from scenario to criterion. The human naturally verifies criterion-by-criterion, and downstream consumers (UAT-FAILURES.md, bugfix-uat) need clear criterion attribution.

### Cross-Cutting Scenarios
- **Duplicate under each criterion.** Scenarios that validate multiple criteria appear under every criterion they touch.
- **Rationale:** Every criterion shows complete coverage. No implicit cross-references that could be missed in reporting. Slight duplication is acceptable for completeness.

### Failure Metadata Schema
- **Rich with reproduction context.** The UAT-FAILURES.md JSON metadata extends beyond the CONTRACT.json minimum (id, criterion, step, description, severity, relevantFiles) to include: userNotes, expectedBehavior, actualBehavior.
- **Rationale:** The bugfix-uat agent benefits from full reproduction context. The human's free-text note, expected behavior, and actual behavior give the bugfix agent enough signal to act without re-deriving context from criterion text alone.

### Note Storage
- **Both JSON metadata and markdown body.** The human's free-text failure note appears in the embedded JSON block (machine-parseable) and in the markdown prose (human-readable).
- **Rationale:** No information loss. Bugfix-uat parses from JSON; humans read the markdown. Slight duplication is the right tradeoff for dual-audience usability.

### Role vs Skill Boundary
- **Role generates plan, skill orchestrates human loop.** The role (role-uat.md) is the QA brain — it produces the complete test plan with detailed step-by-step instructions. The skill (SKILL.md) is the interaction layer — it presents steps one at a time via AskUserQuestion and records verdicts.
- **Rationale:** Clean separation of concerns. The role can be reused by other consumers. The skill stays focused on orchestration without mixing in QA intelligence.

### Plan Detail Level
- **Detailed step-by-step instructions from the role.** The role outputs specific, actionable steps per scenario (e.g., "open file X, check line Y", "run command Z and verify output").
- **Rationale:** The human sees exactly what to do with zero ambiguity. The skill simply presents what the role generated without needing to flesh out vague scenario descriptions.

### Step Verdict Model
- **Pass / Fail / Skip.** Three verdicts covering all real outcomes. Skip is for steps that can't be tested in the current environment.
- **Rationale:** Covers the three actual outcomes without subjective middle-ground. "Partial" was rejected as too ambiguous — if something partially works, the free-text note captures the nuance.

### Failure Severity Assignment
- **Semantic analysis by the agent.** The UAT agent analyzes the criterion's importance contextually to assign severity, rather than mechanically deriving from wave number or burdening the human with severity prompts.
- **Rationale:** Wave ordering doesn't always reflect actual severity (a wave-3 security criterion could be critical). The agent has enough context from the acceptance criteria and set scope to make intelligent severity calls. This avoids extra friction during the human testing loop.

### Progress Persistence
- **Ephemeral — no checkpointing.** UAT runs in one session. If interrupted, the session restarts from scratch.
- **Rationale:** Simplicity. UAT is designed to be run in one sitting. Adding checkpoint files introduces format definition, stale cleanup, and skill complexity that isn't justified for typical set sizes.

### Re-run and Idempotency
- **Clean overwrite.** Re-running UAT overwrites both REVIEW-UAT.md and UAT-FAILURES.md. Git history preserves previous versions naturally.
- **Rationale:** Matches existing REVIEW-UAT.md behavior. Each run is a fresh assessment. Users who need previous results can check git log.

### Claude's Discretion
- No areas were left to Claude's discretion — all 8 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- Free-text failure notes should be captured via an "Other" or text input option on the Fail verdict, not as a separate follow-up prompt — keep the loop tight.
- The rich metadata schema (id, criterion, step, description, severity, relevantFiles, userNotes, expectedBehavior, actualBehavior) should be validated by the unit tests in wave 1 to lock the contract before the skill/role rewrites in wave 2.
- Agent-driven severity analysis should consider keywords in criterion text (e.g., "security", "data integrity" → high) alongside structural context.
</specifics>

<code_context>
## Existing Code Insights
- `skills/uat/SKILL.md` is ~450 lines with 10 steps. Steps 4 (browser config), 5-7 (agent spawn + execution), and 7a (retry) are the primary rewrite targets. Steps 0-3 (env setup, scope loading, context) and 8-10 (writing artifacts, logging, completion) largely survive.
- `src/modules/roles/role-uat.md` currently has Phase 1 (plan generation) and Phase 2 (execution). Phase 2 and all browser automation references are removed. Phase 1 stays but is rewritten to produce detailed step-by-step human instructions instead of automated/human tagged steps.
- The `<!-- RAPID:RETURN {...} -->` structured return pattern is used throughout RAPID agents. The UAT-FAILURES.md `<!-- UAT-FAILURES-META {...} -->` follows the same embedded-comment-JSON pattern.
- `node "${RAPID_TOOLS}" review log-issue` CLI is the existing issue logging interface — failures from the new human-driven UAT will use the same API.
</code_context>

<deferred>
## Deferred Ideas
- Regression tracking across UAT runs (diffing failure files over time) — suggested for a future analytics set
- Checkpoint-based resumable UAT sessions for very large test plans — revisit if UAT plans regularly exceed 20+ steps
</deferred>
