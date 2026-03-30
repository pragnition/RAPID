# SET-OVERVIEW: review-state

## Approach

The review pipeline currently runs four stages (scope, unit-test, bug-hunt, uat) but has no persistent memory of which stages have completed for a given set. If a review session is interrupted or the user invokes the pipeline again, every stage must be re-run from scratch. This set adds a per-set REVIEW-STATE.json file that tracks stage completion, enabling skip/resume behavior.

The implementation follows the MERGE-STATE.json precedent already established in `src/lib/merge.cjs`: a Zod-validated JSON file written atomically via temp-file-then-rename, with read/write/update helper functions. The new schema lives in `src/lib/review.cjs` alongside the existing review schemas (ReviewIssue, ConcernFile, etc.). The review command handler in `src/commands/review.cjs` gains a new `state` subcommand for CLI inspection, and the four SKILL.md files are updated to read/write state and offer skip/re-run prompts for already-completed stages.

Prerequisite enforcement is a key behavioral invariant: scope must complete before any other stage; UAT must not run until unit-test has completed; bug-hunt and unit-test can run in either order after scope. This is enforced at runtime in the library functions, not in the skills themselves.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/review.cjs` | ReviewState Zod schema, read/write/markStageComplete functions, prerequisite logic | Existing (extend) |
| `src/lib/review.test.cjs` | Unit tests for new state functions | Existing (extend) |
| `src/commands/review.cjs` | New `state` subcommand for CLI inspection of review progress | Existing (extend) |
| `src/commands/review.test.cjs` | Tests for the new subcommand | Existing (extend) |
| `skills/review/SKILL.md` | Update to write state after scope completes, check for existing state | Existing (modify) |
| `skills/unit-test/SKILL.md` | Update to write state after unit-test completes, check prerequisites | Existing (modify) |
| `skills/bug-hunt/SKILL.md` | Update to write state after bug-hunt completes, check prerequisites | Existing (modify) |
| `skills/uat/SKILL.md` | Update to write state after uat completes, enforce unit-test prerequisite | Existing (modify) |

## Integration Points

- **Exports:**
  - `readReviewState(setId)` -- returns current review pipeline state or null
  - `writeReviewState(setId, state)` -- atomically persists review state
  - `markStageComplete(setId, stage, verdict)` -- records a stage as done with its verdict
  - `REVIEW-STATE.json` schema at `.planning/sets/{setId}/REVIEW-STATE.json`
- **Imports:** None -- this set is self-contained and has no dependencies on other sets
- **Side Effects:** Creates/updates `REVIEW-STATE.json` files in set planning directories; skill files gain conditional skip/re-run prompts that change agent behavior during review

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extending review.cjs without breaking existing exports | High | Additive changes only; run existing review tests to confirm no regressions |
| Skill markdown changes alter agent behavior unexpectedly | Medium | Keep skill diffs minimal and focused on state read/write calls; test with a dry-run review |
| Atomic write race if multiple agents review same set | Low | Same temp-file-then-rename pattern used by merge state; single-writer assumption holds for review |
| Prerequisite logic too strict for edge cases (e.g., re-running scope after partial completion) | Medium | Implement idempotent re-entry: completed stages prompt skip/re-run rather than hard-blocking |

## Wave Breakdown (Preliminary)

- **Wave 1:** Foundation -- Define ReviewState Zod schema, implement read/write/markStageComplete in review.cjs, add prerequisite checking logic, write unit tests
- **Wave 2:** Integration -- Update review command handler with `state` subcommand, update all four SKILL.md files to use review state, add command-level tests

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
