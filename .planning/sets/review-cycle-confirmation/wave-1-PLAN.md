# Wave 1 PLAN: Bug-Hunt Confirmation Gate + Early Exit

## Objective

Add an AskUserQuestion confirmation gate between bug-hunt review cycles to prevent runaway automatic cycling. When the user declines continuation, implement an early-exit path that preserves all accumulated findings in REVIEW-BUGS.md with partial-cycle metadata.

## Owned Files

| File | Action |
|------|--------|
| `skills/bug-hunt/SKILL.md` | Modify |

## Task 1: Insert Step 3.9a -- Cycle Continuation Confirmation Gate

**File:** `skills/bug-hunt/SKILL.md`
**Location:** Between current Step 3.9 (Spawn Bugfix Agent) and Step 3.10 (Cycle 3 Remaining Bugs)

Insert a new sub-step `### 3.9a: Cycle Continuation Confirmation` with the following content:

### Content to Insert

After the paragraph `Update modifiedFiles with the files reported by the bugfix agent. Add accepted findings to allAcceptedBugs.` (end of Step 3.9), and before `### 3.10: Cycle 3 Remaining Bugs`, insert:

```markdown
### 3.9a: Cycle Continuation Confirmation

**This step fires only before cycles 2 and 3** (i.e., when `cycleNumber >= 1` after incrementing). Skip this step entirely on cycle 1.

Before starting the next cycle, present the user with a summary and confirmation prompt.

**Display cycle summary:**

```
--- Bug Hunt Cycle {cycleNumber + 1} Complete ---
Findings: {accepted} accepted, {dismissed} dismissed, {deferred} deferred
Modified files this cycle: {modifiedFiles list, or 'none'}
```

Use AskUserQuestion:
- **question:** "Bug hunt cycle {cycleNumber + 1} of 3 complete.\n\nAccepted: {accepted} | Dismissed: {dismissed} | Deferred: {deferred}\nFiles modified by bugfix: {modifiedFiles.length > 0 ? modifiedFiles.join(', ') : 'none'}\n\nContinue to the next cycle?"
- **options:** ["Continue to cycle {cycleNumber + 2} of 3", "Stop and save {allAcceptedBugs.length} findings"]

**If user chooses "Continue...":** Proceed normally -- increment `cycleNumber` and continue to Step 3.1.

**If user chooses "Stop and save...":** Execute the early-exit path (Step 3.9b).
```

### Verification

- Read `skills/bug-hunt/SKILL.md` and confirm Step 3.9a exists between 3.9 and 3.10
- Confirm the gate references `AskUserQuestion` with two options
- Confirm the gate only fires when `cycleNumber >= 1` (before cycles 2 and 3)

## Task 2: Insert Step 3.9b -- Early Exit Path

**File:** `skills/bug-hunt/SKILL.md`
**Location:** Immediately after the new Step 3.9a

Insert a new sub-step `### 3.9b: Early Exit Path` that handles the case where the user declines continuation.

### Content to Insert

```markdown
### 3.9b: Early Exit Path

When the user chooses to stop early at the confirmation gate (Step 3.9a):

**1. Write partial REVIEW-BUGS.md**

Write REVIEW-BUGS.md using the same format as Step 3.8, but add two additional rows to the Summary table:

| Metric | Value |
|--------|-------|
| Partial | Yes (stopped after cycle {cycleNumber + 1} of 3) |
| Cycles Completed | {cycleNumber + 1} |

These rows go after the existing Deferred row. All other content (Accepted/Dismissed/Deferred findings sections) uses the same format as Step 3.8, populated from `allAcceptedBugs` and findings from all completed cycles.

**2. Log all accepted findings**

For every finding in `allAcceptedBugs`, log an issue using the same command as Step 4:

```bash
node "${RAPID_TOOLS}" review log-issue \
  --set-id "{setId}" \
  --type "bug" \
  --severity "{severity}" \
  --file "{file}" \
  --line {line} \
  --description "{description}" \
  --source "bug-hunt"
```

These are real bugs found in completed cycles -- they must be logged regardless of whether all cycles ran.

**3. Jump to Step 4 (Completion Banner)**

After writing REVIEW-BUGS.md and logging issues, skip directly to Step 4. The completion banner should reflect the partial run (use the actual `cycleNumber + 1` for the Cycles count).
```

### Verification

- Read `skills/bug-hunt/SKILL.md` and confirm Step 3.9b exists after 3.9a
- Confirm the partial REVIEW-BUGS.md includes `Partial` and `Cycles Completed` rows
- Confirm all accepted bugs are logged via `review log-issue`
- Confirm the exit path jumps to Step 4

## Task 3: Update the Cycle Loop Exit Documentation

**File:** `skills/bug-hunt/SKILL.md`
**Location:** The paragraph at the end of Step 3.10 that describes cycle loop exit conditions

The current text at line 335-338 reads:

```
**End of cycle loop.** Increment `cycleNumber` and repeat from 3.1 unless:
- `cycleNumber >= 3`
- `modifiedFiles` is empty (no changes in last cycle)
- All findings were DISMISSED or DEFERRED
```

Update this to add a fourth exit condition:

```
**End of cycle loop.** Increment `cycleNumber` and repeat from 3.1 unless:
- `cycleNumber >= 3`
- `modifiedFiles` is empty (no changes in last cycle)
- All findings were DISMISSED or DEFERRED
- User chose to stop at the confirmation gate (Step 3.9a)
```

### Verification

- Read the end-of-loop section and confirm the fourth exit condition is listed
- Confirm it references Step 3.9a

## Task 4: Add Behavioral Contract Note

**File:** `skills/bug-hunt/SKILL.md`
**Location:** The `## Important Notes` section at the bottom of the file (currently lines 379-394)

Add a new bullet to the Important Notes section:

```markdown
- **Cycle continuation requires user confirmation.** Before starting cycle 2 or 3, the user is prompted with a summary of findings and modified files from the completed cycle. The user can choose to continue or stop early. Early exit preserves all accumulated findings in REVIEW-BUGS.md with partial-cycle metadata (Partial: Yes, Cycles Completed: N). All accepted findings are logged via `review log-issue` regardless of early exit. This satisfies the `no-runaway-cycles` and `preserve-partial-findings` behavioral contracts.
```

### Verification

- Read `## Important Notes` section and confirm the new bullet exists
- Confirm it references both behavioral contracts by name

## Success Criteria

1. Step 3.9a exists between Steps 3.9 and 3.10, containing an AskUserQuestion confirmation gate
2. The gate fires only before cycles 2 and 3 (not cycle 1)
3. The gate displays findings counts (accepted/dismissed/deferred) and modified files list
4. Step 3.9b defines the early-exit path with partial REVIEW-BUGS.md write
5. Early-exit REVIEW-BUGS.md includes `Partial` and `Cycles Completed` metadata rows
6. All accepted findings are logged via `review log-issue` on early exit
7. The cycle loop exit conditions list includes user-stopped as a fourth condition
8. Important Notes section documents the behavioral contracts
