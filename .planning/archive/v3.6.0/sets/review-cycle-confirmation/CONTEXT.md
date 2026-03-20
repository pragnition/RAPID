# CONTEXT: review-cycle-confirmation

**Set:** review-cycle-confirmation
**Generated:** 2026-03-19
**Mode:** interactive

<domain>
## Set Boundary
Add AskUserQuestion confirmation gates between bug-hunt review cycles to prevent runaway automatic cycling. Implement early-exit path that preserves all accumulated findings in REVIEW-BUGS.md. Additionally, add retry-on-failure confirmation to both the unit-test and UAT skills. The set modifies three SKILL.md files (declarative agent instruction documents, not executable code).
</domain>

<decisions>
## Implementation Decisions

### Gate Placement & Wording

- **Bug-hunt:** Insert confirmation gate after Step 3.9 (bugfix agent completes) and before Step 3.10 (cycle-end check), so the user sees fix results before deciding whether to continue
- **Unit-test & UAT:** Add confirmation gate after test execution completes with failures, asking whether to retry failed tests/scenarios or accept results as-is
- **Scope expansion:** The original contract mentions bug-hunt and unit-test only. User has requested UAT be included as well (3 skills total)
- **Wording:** Use specific cycle number format, e.g., "Continue to cycle 2 of 3" / "Stop and save N findings"

### Cycle Summary at Gate

- **Bug-hunt gate:** Show findings counts (accepted/dismissed/deferred) AND list of modified files from the bugfix agent before the confirmation prompt
- **Unit-test/UAT gate:** Show pass/fail counts before asking about retry

### Early-Exit Behavior

- **Partial metadata:** When user stops bug-hunt early, add `Partial: Yes (stopped after cycle N of 3)` and `Cycles Completed: N` rows to the REVIEW-BUGS.md summary table
- **Issue logging:** Always log all accepted findings via `review log-issue` even on early exit -- they are real bugs regardless of whether all cycles ran
- **REVIEW-BUGS.md write:** Early exit must write REVIEW-BUGS.md with all accumulated findings from completed cycles before jumping to the completion banner

### Unit-Test & UAT Retry Scope

- **Retry limit:** Up to 2 retries after initial failure (3 total attempts max)
- **Fix on retry:** The agent should attempt to fix failing test code (not source code) before re-running on each retry
- **Applies to both:** unit-test and UAT skills get the same retry behavior
- **Confirmation prompt:** After each failed attempt, ask the user whether to retry (with fix attempt) or accept results as-is
</decisions>

<specifics>
## Specific Ideas
- Bug-hunt gate preview format should match the mockup: cycle complete header, findings counts, modified files list, then the question
- Unit-test/UAT retry should only fix test code, never the source code under test
- The UAT skill currently has no cycle loop, so the retry gate is purely a post-execution retry mechanism
</specifics>

<code_context>
## Existing Code Insights

### Bug-hunt SKILL.md (skills/bug-hunt/SKILL.md)
- Cycle loop is in Step 3 (Steps 3.1-3.10), max 3 iterations
- `cycleNumber` tracks current cycle, `modifiedFiles` tracks bugfix changes, `allAcceptedBugs` accumulates findings
- Step 3.8 writes REVIEW-BUGS.md -- early exit must reuse this format
- Step 3.9 spawns bugfix agent and updates `modifiedFiles`
- Loop exits at end of Step 3 when: cycleNumber >= 3, modifiedFiles empty, or all dismissed/deferred
- The gate should be a new sub-step between 3.9 and 3.10 (only for cycle 2+)

### Unit-test SKILL.md (skills/unit-test/SKILL.md)
- Single-pass execution: plan (Step 3) -> approve (Step 4) -> execute (Step 5) -> write results (Step 6)
- No existing retry mechanism
- Retry gate goes after Step 5 execution, before Step 6 write

### UAT SKILL.md (skills/uat/SKILL.md)
- Single-pass execution: plan (Step 5) -> approve (Step 6) -> execute (Step 7) -> write results (Step 8)
- Has CHECKPOINT mechanism for human verification but no retry loop
- Retry gate goes after Step 7 execution, before Step 8 write
</code_context>

<deferred>
## Deferred Ideas
- Could add confirmation gates to the merge pipeline's conflict resolution cycles (out of scope for this set)
- Could make retry limits configurable via .planning/config.json (out of scope)
</deferred>
