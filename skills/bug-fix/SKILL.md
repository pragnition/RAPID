---
description: Investigate and fix bugs -- user describes a bug, model investigates and applies a fix
allowed-tools: Bash(rapid-tools:*), Agent, AskUserQuestion, mcp__rapid__webui_ask_user, Read, Write, Glob, Grep
---

# /rapid:bug-fix -- Bug Investigation and Fix

You are the RAPID bug-fix skill. The user describes a bug they are facing, you investigate the codebase to find the root cause, and apply a fix using the executor agent. This is a general-purpose debugging tool that works from any branch or directory -- no set association required. When invoked with `--uat <set-id>`, it reads UAT failure reports and fixes them automatically without manual investigation.

**Dual-mode operation:** Every interactive prompt below checks `$RAPID_RUN_MODE`. When `RAPID_RUN_MODE=sdk`, the prompt is routed through the web bridge (free-form prompts use a dedicated MCP tool); otherwise the built-in tool is used. The if/else branches at each call site make both modes explicit.

Follow these steps IN ORDER. Do not skip steps.

## Step 0: Environment Setup + Banner

Load environment variables before any CLI calls:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

Use this environment preamble in ALL subsequent Bash commands within this skill.

Display a banner:

```
--- RAPID Bug Fix ---
Investigating and fixing bugs in the current working tree.
---------------------
```

## Step 0b: Parse --uat Flag

Check if the user's invocation includes `--uat`. The argument immediately after `--uat` is the set-id (e.g., `/rapid:bug-fix --uat my-set`).

1. **Flag detection:** If `--uat` is present but no set-id follows, display:
   ```
   Usage: /rapid:bug-fix --uat <set-id>
   ```
   and exit.

2. **Set resolution:** When `--uat` is detected, resolve the set-id:
   ```bash
   node "${RAPID_TOOLS}" resolve set "<set-id>"
   ```
   Extract the resolved `setId` from the JSON output. If resolution fails, display the error and exit.

3. **Flow branching:**
   - If `--uat` is detected: skip Steps 1-3 entirely and proceed directly to **Step UAT**.
   - If `--uat` is NOT present: continue to Step 1 as normal (no behavior change).

## Step 0c: Parse --wave-size Flag

Check if the user's invocation includes `--wave-size <n>`. The argument immediately after `--wave-size` is the wave size value.

1. **Flag detection:** If `--wave-size` is present, read the next argument as the wave size value.
   - If `--wave-size` is present but no argument follows, or the argument is not a positive integer (i.e., it is zero, negative, non-numeric, or a decimal), display a usage error and exit:
     ```
     Usage: /rapid:bug-fix [--wave-size <n>] [bug description]
     ```
   - If the argument is a valid positive integer (>= 1), record it as `WAVE_SIZE`.

2. **Default value:** If `--wave-size` is not present in the invocation, set `WAVE_SIZE = 3` (default).

3. **Strip flag from description:** If `--wave-size <n>` was present, remove it and its argument from the remaining input before passing the rest to subsequent steps. The wave-size flag is not part of the bug description.

4. Continue to Step 1 (or Step UAT if `--uat` was detected in Step 0b). The UAT path ignores `WAVE_SIZE` -- do not add any UAT-specific branching in this step.

## Step UAT: Read Failures and Dispatch Fixes

> This step is ONLY reached when the `--uat` flag is detected in Step 0b.

### UAT-a: Read and validate UAT-FAILURES.md

1. **File existence check:** Check if `.planning/sets/{setId}/UAT-FAILURES.md` exists. If NOT, display:
   ```
   No UAT-FAILURES.md found for set "{setId}". Run /rapid:uat first.
   ```
   and exit.

2. **Read file contents:** Read the entire UAT-FAILURES.md file.

3. **Extract JSON metadata:** Use the regex pattern `<!-- UAT-FAILURES-META ([\s\S]*?) -->` to extract the embedded JSON block. Parse the JSON to obtain the `failures` array.

4. **Validate format marker:** Confirm the file contains `<!-- UAT-FORMAT:v2 -->`. If missing, display a warning: `"Warning: UAT-FAILURES.md missing v2 format marker. Proceeding anyway."` but continue (do not hard-fail on format version).

5. **Check for empty failures:** If the `failures` array is empty or has length 0, display:
   ```
   All UAT tests passed for set "{setId}". Nothing to fix.
   ```
   and exit cleanly.

### UAT-b: Sort failures by severity

Sort the failures array by severity in descending order: `critical` first, `low` last.

Use a lookup map for sort ordering:
```
{ critical: 0, high: 1, medium: 2, low: 3 }
```

### UAT-c: Display failure summary banner

Display a summary before processing:

```
--- RAPID Bug Fix (UAT Mode) ---
Set: {setId}
Failures: {count} ({critical}C / {high}H / {medium}M / {low}L)
Processing in severity order...
---------------------------------
```

### UAT-d: Iterate and dispatch executor for each failure

For each failure in the sorted array, spawn the **rapid-executor** agent with this task:

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
- Parse the `RAPID:RETURN` from the executor's output.
- **If COMPLETE:** Record the commit hash and continue to the next failure.
- **If BLOCKED:** Record the blocker, display it, and continue to the next failure (do NOT stop the entire batch).
- **If CHECKPOINT:** Record it and continue to the next failure.

### UAT-e: Proceed to results

After all failures have been processed, proceed to **Step UAT-Results**. Do NOT fall through to Step 1.

## Step UAT-Results: Display Combined Results

Display a combined results summary:

```
--- RAPID Bug Fix (UAT Mode) Complete ---
Set: {setId}
Total failures: {count}
Fixed: {number of COMPLETE results}
Blocked: {number of BLOCKED results}
Partial: {number of CHECKPOINT results}

Results:
| # | Failure ID | Severity | Status  | Commit/Detail |
|---|-----------|----------|---------|---------------|
| 1 | {id}      | {sev}    | FIXED   | {hash}        |
| 2 | {id}      | {sev}    | BLOCKED | {blocker}     |
...
------------------------------------------
```

Exit. Do NOT fall through to Step 1 or any subsequent step. The `--uat` path terminates here.

## Step 1: Gather Bug Description

### Inline invocation path

If the user provided a bug description inline with the command (e.g., `/rapid:bug-fix the merge command fails when .planning/ has untracked files`), inspect the description for multi-bug structure:

- **Multi-bug trigger:** The inline description contains multiple items on separate lines each beginning with `-`, `*`, or a number followed by a period (e.g., `1.`, `2.`), OR the user writes an explicit enumeration header such as "bugs:" or "issues:" followed by multiple items.
- **Single-bug path (default):** If no multi-bug structure is detected, treat the entire description as one bug exactly as today. No behavior change from the current single-bug flow.
- **Multi-bug path:** If multi-bug structure is detected, parse each bullet or numbered item into a separate bug. Record the result as an array `BUGS` with entries `{ id: <1-indexed>, description: <verbatim text of that item> }`.

### Freeform invocation path

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__ask_free_text with:
  #   question: "Describe the bug you are experiencing. Include any error messages, reproduction steps, or symptoms."
  # Wait for the free-form text answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # If the user did NOT provide an inline description, use AskUserQuestion (freeform):
  # > "Describe the bug you are experiencing. Include any error messages, reproduction steps, or symptoms."
fi
```

After receiving the response, run the same multi-bug detection described above on the response. If the response contains multiple items on separate lines each beginning with `-`, `*`, or a number followed by a period, treat each as a separate bug and populate the `BUGS` array. Otherwise, treat it as a single bug.

### Record bug count

Record `BUG_COUNT = BUGS.length`. When `BUG_COUNT == 1`, all subsequent steps MUST behave exactly as today -- this preserves backward compatibility for the common single-bug case. The `BUGS` array always has at least one entry.

## Step 2: Investigate the Codebase

Using the bug description, investigate the codebase to find the root cause:

1. **Search for relevant code:** Use Grep and Glob to find files related to the bug description. Search for error messages, function names, module names mentioned in the description.

2. **Read relevant files:** Read the files that are most likely to contain the bug. Focus on:
   - Files mentioned in error messages or stack traces
   - Entry points for the failing functionality
   - Recently modified files (use `git log --oneline -10` to check recent changes)

3. **Trace the execution path:** Follow the code path from the entry point to understand where the failure occurs.

4. **Identify the root cause:** Determine exactly what is wrong -- is it a missing check, incorrect logic, wrong type, missing import, etc.

## Step 3: Present Findings

Present the investigation results to the user:

```
--- Bug Investigation Results ---
Root Cause: {brief description of what is wrong}
File(s): {list of files involved}
Analysis: {explanation of why the bug occurs}

Proposed Fix: {description of the fix to apply}
---------------------------------
```

```
if [ "${RAPID_RUN_MODE}" = "sdk" ]; then
  # SDK mode: route through the web bridge.
  # Call mcp__rapid__webui_ask_user with:
  #   question: "Apply the proposed fix?"
  #   options: ["Apply fix", "Investigate further", "Cancel"]
  #   allow_free_text: false
  # Wait for the answer, then continue as below.
else
  # CLI mode: use the built-in tool exactly as before.
  # Use AskUserQuestion:
  # - **question:** "Apply the proposed fix?"
  # - **options:**
  #   - "Apply fix" -- description: "Dispatch executor agent to apply the fix and commit"
  #   - "Investigate further" -- description: "Continue investigating with additional context"
  #   - "Cancel" -- description: "Exit without making changes"
fi
```

If "Cancel": Display "Bug fix cancelled." and exit.

If "Investigate further": Return to Step 2 with the user's additional context. Repeat investigation with broader or different search terms.

If "Apply fix": Continue to Step 4.

## Step 4: Dispatch Executor Agent

Build a plan for the fix. The plan should be a concise description of exactly what needs to change, in which files, and how to verify the fix.

### Step 4 Branching: Single Executor vs Wave Splitting

Before dispatching, check whether wave splitting applies:

- If `BUG_COUNT < 2 * WAVE_SIZE`, skip wave logic and fall through to the legacy single-executor dispatch unchanged. This preserves exact backward compatibility for small bug lists.
- If `BUG_COUNT >= 2 * WAVE_SIZE`, proceed to Step 4a (Wave Decomposition). Do NOT execute the single-executor block below -- the wave loop replaces it for this invocation.

**Worked examples:**

- `BUG_COUNT = 5`, `WAVE_SIZE = 3` -- `5 < 6`, floor NOT met, single-executor path (legacy, unchanged).
- `BUG_COUNT = 6`, `WAVE_SIZE = 3` -- `6 >= 6`, floor met, wave splitting triggers with 2 waves of 3.
- `BUG_COUNT = 10`, `WAVE_SIZE = 3` -- `10 >= 6`, floor met, wave splitting triggers with 4 waves of sizes 3, 3, 3, 1.

When `BUG_COUNT == 1` (single-bug invocation), the floor is never met regardless of `WAVE_SIZE`, so the single-executor path below always runs -- preserving exact backward compatibility.

### Legacy Single-Executor Dispatch

> The block below runs only when wave splitting does NOT trigger (i.e., `BUG_COUNT < 2 * WAVE_SIZE`).

Spawn the **rapid-executor** agent with this task:

```
Fix a bug in the codebase.

## Your PLAN
### Task 1: {fix description}

**Files:**
- {file1}
- {file2}

**Action:**
{detailed description of what to change}

**Verification:**
{command to verify the fix works}

**Done when:** {success criteria}

## Commit Convention
After applying the fix, commit with: fix(bug-fix): {brief description}

## Working Directory
{current working directory}
```

Parse RAPID:RETURN from the executor's output.

**If COMPLETE:**
Continue to Step 5.

**If BLOCKED:**
Display the blocker details:
```
Bug fix blocked.
Blocker: {blocker description}
```
Exit.

**If CHECKPOINT:**
Display checkpoint details:
```
Bug fix paused at checkpoint.
Done: {what was completed}
Remaining: {what remains}
```
Exit.

### Step 4a: Wave Decomposition

> This step is ONLY reached when `BUG_COUNT >= 2 * WAVE_SIZE` (the wave-splitting trigger from Step 4 Branching).

1. Compute `WAVE_COUNT = ceil(BUG_COUNT / WAVE_SIZE)`.

2. Partition `BUGS` into `WAVES[1..WAVE_COUNT]` where each wave (except possibly the last) contains exactly `WAVE_SIZE` bugs, and the final wave contains the remainder.

3. **Acceptance examples (codified):**
   - 10 bugs with `--wave-size 3` produces 4 waves of sizes 3, 3, 3, 1 (the final wave holds the remainder).
   - 6 bugs with `--wave-size 3` produces 2 waves: [3, 3].
   - 7 bugs with `--wave-size 3` produces 3 waves: [3, 3, 1].

4. Display a decomposition summary banner before entering the dispatch loop:

```
--- Wave Decomposition ---
Total bugs: {BUG_COUNT}
Wave size: {WAVE_SIZE}
Waves: {WAVE_COUNT}
Distribution: {comma-separated list of wave sizes, e.g. "3, 3, 3, 1"}
--------------------------
```

### Step 4b: Sequential Dispatch Loop

**CRITICAL: Waves execute strictly SEQUENTIALLY on the same branch; no parallel wave execution. Each wave dispatch MUST be in its own assistant response. Never use parallel Agent tool calls in this loop. This mirrors `skills/merge/SKILL.md` Step 3: sets within a wave merge sequentially (not in parallel) -- each dispatch sees the result of the previous one.**

For each wave N from 1 to WAVE_COUNT:

1. **Display per-wave banner:**

```bash
node "${RAPID_TOOLS}" display banner bug-fix "Wave {N} of {WAVE_COUNT}"
```

2. **Build and dispatch per-wave executor prompt.** Spawn the **rapid-executor** agent with this task:

```
Fix a batch of bugs in the codebase.

## Your PLAN
### Task 1: {BUGS[0].description -- brief}
**Files:** {to be determined by executor via investigation}
**Action:** {root cause + fix description -- executor investigates}
**Verification:** {command or criterion}
**Done when:** {success criterion}

### Task 2: {BUGS[1].description -- brief}
...

(repeat for each bug in this wave only)

## Commit Convention
After each fix, commit with: fix(bug-fix): {brief description}

## Working Directory
{current working directory}
```

The prompt MUST contain only the current wave's bugs. Do NOT include bugs from prior or subsequent waves. Do NOT include a cross-wave handoff section -- each wave receives only its assigned bug list with no modified-files list, no commit log, and no prior-wave summary.

3. **Parse RAPID:RETURN and switch on status:**

After each wave's executor returns, parse the `<!-- RAPID:RETURN { ... } -->` HTML comment and switch on `status`:

- **If COMPLETE:** Record the wave's commits and artifacts in `WAVE_RESULTS[N]`. Display the per-wave result block (see below) and continue to wave N+1.
- **If CHECKPOINT:** Record the wave's partial progress in `WAVE_RESULTS[N]` with status `CHECKPOINT`. Display the per-wave result block and continue to wave N+1. Partial progress counts as progress, not failure.
- **If BLOCKED:** Record the blocker in `WAVE_RESULTS[N]` with status `BLOCKED`. Display the per-wave result block AND the blocker details. **STOP the entire run.** Do NOT dispatch waves N+1..WAVE_COUNT. Proceed directly to Step 4c (Aggregate Results) and render the aggregate with the waves completed so far.

> NOTE: This differs from Step UAT-d, which continues on BLOCKED. In wave splitting, BLOCKED STOPS the run to prevent compounding failures across waves.

4. **Per-wave result block** (displayed after each dispatch, regardless of status):

```
--- Wave {N} Result ---
Status: {COMPLETE|CHECKPOINT|BLOCKED}
Bugs in wave: {count}
Commits: {comma-separated hashes or "(none)"}
Files modified: {count}
{If CHECKPOINT: "Note: partial progress -- continuing to next wave."}
{If BLOCKED: "Blocker: {details}. STOPPING run."}
-----------------------
```

### Step 4c: Aggregate Results

After the dispatch loop terminates -- either naturally via completion of all WAVE_COUNT waves, or prematurely via BLOCKED in a wave -- render an aggregate summary. The aggregate MUST render even on a halted run.

```
--- RAPID Bug Fix (Wave Splitting) Complete ---
Total bugs: {BUG_COUNT}
Wave size: {WAVE_SIZE}
Waves dispatched: {number of waves actually dispatched, may be < WAVE_COUNT on BLOCKED}
Waves completed: {count of COMPLETE}
Waves checkpointed: {count of CHECKPOINT}
Waves blocked: {count of BLOCKED}
Total commits: {sum of commits across all waves}
Total files modified: {sum of distinct files across all waves}

Per-Wave Summary:
| Wave | Bugs | Status     | Commits              | Files |
|------|------|------------|----------------------|-------|
| 1    | 3    | COMPLETE   | abc1234, def5678, .. | 4     |
| 2    | 3    | CHECKPOINT | 9a0bcde              | 2     |
| 3    | 3    | BLOCKED    | (none)               | 0     |
...
------------------------------------------------
```

After rendering the aggregate, proceed to Step 5 for the final completion footer. If the run was halted by BLOCKED, Step 5 still displays the footer -- there is no separate error exit.

## Step 5: Display Results

Display the fix results:

```
--- RAPID Bug Fix Complete ---
Bug: {brief description from Step 1}
Root Cause: {from Step 3}
Fix Applied: {description of the fix}
Commits: {commit hashes from executor return}
Files Modified: {file list from executor return}
-------------------------------
```

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:status"
```

## Important Notes

- **No set association required.** This skill works from any branch in any directory. It does not read or modify set state.
- **No review pipeline connection.** This skill does NOT read REVIEW-UNIT.md, REVIEW-BUGS.md, or any review artifacts. It is a standalone bug investigation tool.
- **Commits to current branch.** Fixes are committed directly to whatever branch is currently checked out.
- **Uses the executor agent.** The rapid-executor agent handles the actual code changes and commits, ensuring atomic commits and verification.
- **General-purpose.** Works for any kind of bug -- runtime errors, incorrect behavior, test failures, build issues, etc.
- **UAT mode (`--uat`).** When invoked with `--uat <set-id>`, the skill reads `.planning/sets/{setId}/UAT-FAILURES.md` and fixes each reported failure sequentially (severity-descending). Steps 1-3 are skipped entirely -- the UAT metadata replaces manual bug description and investigation. Without `--uat`, the skill works identically to its normal flow.
- **Wave splitting (`--wave-size <n>`).** When the non-UAT path receives a multi-bug bullet list AND the bug count reaches the floor (2 × `WAVE_SIZE`, default 6), the skill dispatches one rapid-executor per wave strictly sequentially. CHECKPOINT in any wave continues to the next wave; BLOCKED halts the run and renders the aggregate with partial progress. Single-bug invocations and bug lists below the floor use the legacy single-executor path with exact backward compatibility.
- **Contract divergence (post-merge cleanup).** `.planning/sets/bugfix-wave-splitting/CONTRACT.json` contains two vestigial items not implemented per the discussion decisions: (1) `exports.cross-wave-handoff` -- cross-wave handoff was explicitly skipped, each wave receives only its assigned bugs with no prior-wave context; (2) the `"5 UAT"` default mentioned in `exports.wave-splitting.description` -- UAT mode is left unchanged, wave splitting applies only to the normal path. Both items are flagged for post-merge cleanup (strike from contract, no code changes required). Precedent: `.planning/sets/code-graph-backend/VERIFICATION-REPORT.md` recorded a similar divergence as an Advisory Note without modifying `CONTRACT.json`.
