# PLAN: bugfix-uat / Wave 1

**Objective:** Extend `/rapid:bug-fix` to accept a `--uat [set-id]` flag that reads UAT failure metadata from `.planning/sets/{setId}/UAT-FAILURES.md`, sorts failures by severity, and dispatches the executor agent to fix each one sequentially. Without `--uat`, the skill behaves identically to its current implementation.

**Owned Files:** `skills/bug-fix/SKILL.md` (modify)

---

## Task 1: Insert argument parsing block after Step 0

**Files:**
- `skills/bug-fix/SKILL.md`

**Action:**
Insert a new section `## Step 0b: Parse --uat Flag` immediately after the existing `## Step 0: Environment Setup + Banner` section and before `## Step 1: Gather Bug Description`.

The section must contain:

1. **Flag detection:** Check if the user's invocation includes `--uat`. The argument immediately after `--uat` is the set-id (e.g., `/rapid:bug-fix --uat my-set`). If `--uat` is present but no set-id follows, display an error: `"Usage: /rapid:bug-fix --uat <set-id>"` and exit.

2. **Set resolution:** When `--uat` is detected, resolve the set-id using:
   ```bash
   node "${RAPID_TOOLS}" resolve set "<set-id>"
   ```
   Extract the resolved `setId` from the JSON output. If resolution fails, display the error and exit.

3. **Flow branching:** If `--uat` is detected, instruct the skill to skip Steps 1-3 entirely and proceed to "Step UAT" (defined in Task 2). If `--uat` is NOT present, continue to Step 1 as normal (no behavior change).

**Verification:**
- Read the modified file and confirm Step 0b appears between Step 0 and Step 1.
- Confirm the non-`--uat` path is completely unchanged (Steps 1-5 untouched).

**Done when:** The flag parsing section is present and correctly branches the flow. The existing Steps 1-5 are byte-identical to the original.

---

## Task 2: Insert UAT failure reader and multi-failure executor loop

**Files:**
- `skills/bug-fix/SKILL.md`

**Action:**
Insert a new section `## Step UAT: Read Failures and Dispatch Fixes` after Step 0b (from Task 1) and before Step 1. This section is ONLY reached when `--uat` flag is detected (Step 0b branching).

The section must contain:

### 2a: Read and validate UAT-FAILURES.md

1. **File existence check:** Check if `.planning/sets/{setId}/UAT-FAILURES.md` exists. If NOT, display:
   ```
   No UAT-FAILURES.md found for set "{setId}". Run /rapid:uat first.
   ```
   and exit.

2. **Read file contents:** Read the entire file.

3. **Extract JSON metadata:** Use the regex pattern `<!-- UAT-FAILURES-META ([\s\S]*?) -->` to extract the embedded JSON block. Parse the JSON.

4. **Validate format marker:** Confirm the file contains `<!-- UAT-FORMAT:v2 -->`. If missing, display a warning but continue (do not hard-fail on format version).

5. **Check for empty failures:** If the `failures` array is empty or has length 0, display:
   ```
   All UAT tests passed for set "{setId}". Nothing to fix.
   ```
   and exit cleanly.

### 2b: Sort failures by severity

Sort the failures array by severity: `critical` (first) > `high` > `medium` > `low` (last). Use a lookup map: `{ critical: 0, high: 1, medium: 2, low: 3 }`.

### 2c: Display failure summary banner

Display a summary before processing:
```
--- RAPID Bug Fix (UAT Mode) ---
Set: {setId}
Failures: {count} ({critical}C / {high}H / {medium}M / {low}L)
Processing in severity order...
---------------------------------
```

### 2d: Iterate and dispatch executor for each failure

For each failure in the sorted array, dispatch the **rapid-executor** agent with this plan format:

```
Fix a UAT failure in the codebase.

## Your PLAN
### Task 1: Fix {failure.id} -- {failure.criterion}

**Files:**
- {each file from failure.relevantFiles, one per line}

**Action:**
A UAT verification found this failure:
- **Criterion:** {failure.criterion}
- **Step:** {failure.step}
- **Expected behavior:** {failure.expectedBehavior}
- **Actual behavior:** {failure.actualBehavior}
- **Severity:** {failure.severity}
- **Description:** {failure.description}

Investigate the relevant files and fix the code so that the expected behavior is achieved. The relevantFiles list is a starting point -- expand your search if the root cause is not found there.

**Verification:**
{If failure has a step field, include: "Manually verify that the following step now succeeds: {failure.step}"}
{Otherwise: "Verify the fix addresses the criterion: {failure.criterion}"}

**Done when:** The code change makes the expected behavior ({failure.expectedBehavior}) occur instead of the actual behavior ({failure.actualBehavior}).

## Commit Convention
After applying the fix, commit with: fix(bug-fix): {failure.id} -- {brief description}

## Working Directory
{current working directory}
```

After each executor dispatch:
- Parse the RAPID:RETURN from executor output.
- If COMPLETE: record the commit hash and continue to next failure.
- If BLOCKED: record the blocker, display it, and continue to next failure (do NOT stop the entire batch).
- If CHECKPOINT: record it and continue to next failure.

### 2e: After all failures processed, jump to Step UAT-Results

Display a combined results table after all failures have been processed (defined in Task 3). Do NOT fall through to Step 1.

**Verification:**
- Read the modified file and confirm Step UAT appears after Step 0b and before Step 1.
- Confirm the executor dispatch format matches the pattern from the existing Step 4 (same agent name, same structural format).
- Confirm severity sorting is described with the correct lookup map.
- Confirm error handling for missing file and empty failures.

**Done when:** The UAT step reads failures, sorts by severity, displays a summary, iterates through each failure dispatching the executor, and handles all three executor return statuses.

---

## Task 3: Insert UAT results display section

**Files:**
- `skills/bug-fix/SKILL.md`

**Action:**
Insert a new section `## Step UAT-Results: Display Combined Results` after the Step UAT section (from Task 2) and before Step 1. This section is the exit point for the `--uat` path.

The section must display:

```
--- RAPID Bug Fix (UAT Mode) Complete ---
Set: {setId}
Total failures: {count}
Fixed: {number of COMPLETE results}
Blocked: {number of BLOCKED results}
Partial: {number of CHECKPOINT results}

Results:
| # | Failure ID | Severity | Status | Commit |
|---|-----------|----------|--------|--------|
| 1 | {id}      | {sev}    | FIXED  | {hash} |
| 2 | {id}      | {sev}    | BLOCKED| {blocker} |
...
------------------------------------------
```

After displaying results, exit. Do NOT fall through to Step 1 or any subsequent step.

**Verification:**
- Read the modified file and confirm Step UAT-Results appears after Step UAT and before Step 1.
- Confirm the results table includes all relevant columns.
- Confirm the section ends with an explicit "Exit" instruction.

**Done when:** The results display section shows a summary table with per-failure status and the `--uat` path terminates cleanly.

---

## Task 4: Update the Important Notes section

**Files:**
- `skills/bug-fix/SKILL.md`

**Action:**
Add a new bullet to the `## Important Notes` section at the bottom of the file:

```
- **UAT mode (`--uat`).** When invoked with `--uat <set-id>`, the skill reads `.planning/sets/{setId}/UAT-FAILURES.md` and fixes each reported failure sequentially (severity-descending). Steps 1-3 are skipped entirely -- the UAT metadata replaces manual bug description and investigation. Without `--uat`, the skill works identically to its normal flow.
```

Also update the skill description paragraph at the top (line 8, the opening paragraph after the heading) to mention the `--uat` capability. Append one sentence:

```
When invoked with `--uat <set-id>`, it reads UAT failure reports and fixes them automatically without manual investigation.
```

**Verification:**
- Read the Important Notes section and confirm the new bullet is present.
- Read the opening paragraph and confirm the `--uat` mention is present.
- Confirm no existing bullets were removed or modified.

**Done when:** Both the opening paragraph and Important Notes section document the `--uat` capability.

---

## Success Criteria

1. `/rapid:bug-fix --uat my-set` reads `UAT-FAILURES.md`, sorts failures by severity, dispatches executor for each, and displays combined results.
2. `/rapid:bug-fix --uat my-set` with no `UAT-FAILURES.md` displays a clear error message and exits.
3. `/rapid:bug-fix --uat my-set` with zero failures displays "nothing to fix" and exits cleanly.
4. `/rapid:bug-fix` (without `--uat`) works identically to the current implementation -- Steps 1-5 are unchanged.
5. The executor dispatch format follows the existing pattern from Step 4.
6. Failures are processed in severity order: critical > high > medium > low.
7. A blocked executor does not halt processing of remaining failures.
