# SET-OVERVIEW: review-cycle-confirmation

## Approach

The bug-hunt skill currently runs up to 3 iterative cycles automatically (Step 3 loop in SKILL.md). Each cycle spawns hunter, advocate, judge, and bugfix agents, then narrows scope to modified files and repeats. There is no user confirmation between cycles -- if cycle 1 produces accepted bugs and the bugfix agent modifies files, cycle 2 starts immediately. This can lead to runaway agent spawning where the user has no opportunity to review intermediate results or halt the process.

This set introduces an `AskUserQuestion` confirmation gate at the boundary between bug-hunt cycles (between Steps 3.9 and 3.10, before looping back to 3.1). When the user declines continuation, the skill must perform an early exit that preserves all findings accumulated so far by writing them to REVIEW-BUGS.md. The unit-test skill receives a similar but lighter-weight treatment: a retry confirmation when test execution fails, preventing silent retry loops.

The implementation is entirely within the two SKILL.md files -- these are declarative instruction documents (not executable code), so changes involve editing the markdown step descriptions and adding new sub-steps. No changes to `src/lib/review.cjs` or other runtime code are needed since the skills execute via agent interpretation of the SKILL.md instructions.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/bug-hunt/SKILL.md | Bug-hunt pipeline instructions with hunter-advocate-judge cycle loop | Existing (modify) |
| skills/unit-test/SKILL.md | Unit test pipeline instructions with test plan and execution | Existing (modify) |

## Integration Points

- **Exports:**
  - `cycleConfirmationGate`: AskUserQuestion prompt inserted between bug-hunt cycles asking whether to continue to the next cycle or stop. Presented after the bugfix agent completes and before the next cycle begins.
  - `earlyExitWithFindings`: When the user declines continuation, writes all accumulated findings from `allAcceptedBugs` across completed cycles to REVIEW-BUGS.md, then jumps to the Step 4 completion banner.

- **Imports:** None. This set has no dependencies on other sets.

- **Side Effects:**
  - Bug-hunt may now complete after fewer than 3 cycles if the user declines continuation.
  - REVIEW-BUGS.md will contain findings from all completed cycles (partial results are preserved, not discarded).
  - Unit-test skill may halt earlier if the user declines retry after failure.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Confirmation gate placement breaks the cycle loop logic | High | Insert gate as a new sub-step (e.g., 3.9a) after bugfix completes but before cycleNumber increment and loop-back, keeping existing control flow intact |
| Early exit skips REVIEW-BUGS.md write | High | Early exit path must explicitly call the Step 3.8 write logic using `allAcceptedBugs` accumulated so far, then jump to Step 4 |
| First cycle triggers unnecessary confirmation | Medium | Gate only activates before cycle 2+ (cycleNumber >= 1 after first cycle completes), matching the behavioral contract "must not start cycle 2 or 3 without confirmation" |
| AskUserQuestion options are ambiguous | Low | Use clear options: "Continue to cycle N" vs "Stop and save findings" to make the choice unambiguous |
| Unit-test retry confirmation scope creep | Low | Keep unit-test changes minimal -- only add confirmation on execution failure, do not alter the test planning or approval flow |

## Wave Breakdown (Preliminary)

- **Wave 1:** Add the cycle confirmation gate to bug-hunt SKILL.md (new sub-step between 3.9 and 3.10, AskUserQuestion with continue/stop options, skip logic for cycle 1)
- **Wave 2:** Implement the early-exit path in bug-hunt SKILL.md (when user declines: write accumulated findings via Step 3.8 format, jump to Step 4 completion banner, update behavioral contract notes)
- **Wave 3:** Add retry-on-failure confirmation to unit-test SKILL.md (AskUserQuestion after test failures in Step 5, option to retry or accept failures and proceed)

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
