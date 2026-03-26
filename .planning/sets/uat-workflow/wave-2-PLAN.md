# PLAN: uat-workflow / Wave 2

## Objective

Rewrite the UAT role and skill to implement the fully human-driven step-by-step workflow. The role becomes plan-generation-only (no execution phase). The skill replaces automated browser execution with an AskUserQuestion-driven loop that presents one step at a time and collects pass/fail/skip verdicts. On completion, the skill writes both REVIEW-UAT.md and UAT-FAILURES.md (using the format locked in Wave 1).

## Owned Files

| File | Action |
|------|--------|
| src/modules/roles/role-uat.md | Rewrite |
| skills/uat/SKILL.md | Rewrite |

## Tasks

### Task 1: Rewrite src/modules/roles/role-uat.md

**File:** `src/modules/roles/role-uat.md`
**Action:** Rewrite to be plan-generation-only. Remove all execution responsibilities.

**Remove entirely:**
- Phase 2 (Execution) section and all its contents
- All `[automated]` / `[human]` step classification logic and the classification table
- Dev server readiness check (`curl -s -o /dev/null ...`)
- Browser automation references (Chrome DevTools MCP, Playwright MCP, screenshot capture)
- Human step checkpoint pattern (`CHECKPOINT` with `humanStep` data)
- The execution-complete RAPID:RETURN variant

**Keep and modify:**
- The role title and opening paragraph -- update to: "You generate detailed step-by-step acceptance test plans for human verification. You are a quality assurance agent -- you derive test scenarios from acceptance criteria and produce actionable verification instructions that a human tester follows."
- Phase 1 (Plan Generation) -- rename to just "## Plan Generation" (no phase numbering). Modify the scenario structure:
  - Remove `type` field (no automated/human distinction)
  - Each scenario gets: `name`, `criterion` (with `[wave-N]` prefix), `steps` (array of objects with `instruction` and `expected` fields), `files` (relevant source files)
  - Steps must be written as specific human-actionable instructions (e.g., "Navigate to /login in your browser" not "Navigate to /login")
  - Group scenarios under the acceptance criterion they validate per CONTEXT.md decision
  - Duplicate cross-cutting scenarios under each criterion they touch

**Keep unchanged:**
- Constraints section (update to remove browser-specific constraints, keep "never modify source files" and "never spawn sub-agents")

**New structured return format (plan-only):**
```
<!-- RAPID:RETURN {"status":"COMPLETE","data":{"testPlan":[{"name":"...","criterion":"[wave-N] ...","steps":[{"instruction":"...","expected":"..."}],"files":["..."]}]}} -->
```

**New sections to add:**
- "## Severity Assignment" -- Document the semantic analysis approach: the agent analyzes the criterion's importance (core functionality vs polish) and the step's position in the workflow to assign severity. Severity values: `critical`, `high`, `medium`, `low`.
- "## Step Detail Level" -- Instruct the agent to write detailed, specific instructions. Each step instruction must tell the human exactly what to do (which URL, which button, which input field, what value to enter, what to look at). Each `expected` field must describe the specific observable outcome.

**Verification:**
```bash
# Check file exists and has no Phase 2
test -f src/modules/roles/role-uat.md && echo "EXISTS" || echo "MISSING"
grep -c "Phase 2" src/modules/roles/role-uat.md  # must be 0
grep -c "automated" src/modules/roles/role-uat.md  # must be 0
grep -c "browser" src/modules/roles/role-uat.md  # must be 0 (case-insensitive check too)
grep -ci "playwright\|chrome.devtools\|dev.server" src/modules/roles/role-uat.md  # must be 0
grep -c "COMPLETE" src/modules/roles/role-uat.md  # must be >= 1 (the RAPID:RETURN)
grep -c "CHECKPOINT" src/modules/roles/role-uat.md  # must be 0 (no more checkpoint returns)
```

---

### Task 2: Rewrite skills/uat/SKILL.md

**File:** `skills/uat/SKILL.md`
**Action:** Major rewrite. Remove browser automation, replace agent execution phase with skill-driven human loop.

The rewrite follows the step map from CONTEXT.md research. Here is the complete step-by-step specification for the new SKILL.md:

**Frontmatter:** Keep existing. Ensure `allowed-tools` includes `AskUserQuestion`. Remove `Agent` from allowed-tools -- the skill no longer spawns execution agents (it still spawns the plan-generation agent via `Agent`). Actually, keep `Agent` since Step 5 still spawns the plan agent.

**Step 0 (env + set resolution):** Keep unchanged. All substeps (0a, 0b, 0d) remain as-is.

**Step 1 (load REVIEW-SCOPE.md):** Keep unchanged.

**Step 2 (parse scope data):** Keep unchanged.

**Step 3 (load context):** Keep unchanged.

**Step 4 (browser automation):** REMOVE ENTIRELY. Delete the entire Step 4 section. Renumber subsequent steps.

**New Step 4 (was Step 5 -- Spawn UAT Agent for Plan):** Spawn the `rapid-uat` agent for plan generation only. Modify the agent prompt:
- Remove the `## Browser Automation` section entirely
- Remove `type` field from the scenario spec (no automated/human distinction)
- Change the Instructions to: "Generate a comprehensive UAT test plan with detailed step-by-step human verification instructions for each acceptance criterion."
- Change the scenario structure in the prompt to match the new role format: `name`, `criterion`, `steps` (array of `{instruction, expected}`), `files`
- The agent returns `COMPLETE` (never `CHECKPOINT`) with `testPlan` data

**New Step 5 (was Step 6 -- Present Plan for Approval):** Display the test plan WITHOUT automated/human tags:
```
--- UAT Test Plan ---
Set: {setId}
Total Scenarios: {count}
Total Steps: {totalSteps}

Scenario 1: {name}
  Criterion: {criterion}
  Steps: {step count} steps
  Files: {file list}

---------------------
```

AskUserQuestion options: `["Approve", "Modify", "Skip"]`
- **Approve:** Proceed to Step 6
- **Modify:** Allow user to request changes, re-spawn agent with modifications, re-display
- **Skip:** Skip to Step 7 (artifact writing) with empty results

**New Step 6 (replaces old Step 7 -- Human Verification Loop):** This is the core new behavior. The skill drives a sequential loop through ALL steps of ALL scenarios.

Implementation specification:
1. Flatten all scenarios' steps into a sequential list with metadata: `{scenarioName, criterion, stepIndex, totalSteps, instruction, expected, files}`
2. Initialize counters: `passed = 0`, `failed = 0`, `skipped = 0`, `failures = []`
3. For each step in the flattened list:
   a. Use AskUserQuestion:
      - **question:** `"Step {globalIndex}/{totalGlobalSteps} -- {criterion}\n\n**Scenario:** {scenarioName}\n\n**{instruction}**\n\nExpected: {expected}\n\nDoes this pass?"`
      - **options:** `["Pass", "Fail", "Skip", "Pass all remaining"]`
   b. On **Pass**: increment `passed`, continue
   c. On **Fail**: increment `failed`, then prompt for failure description:
      - AskUserQuestion: `"Describe what went wrong:"` (freeform -- use question with no options, or a single option `["Continue"]` after user types description. Note: AskUserQuestion requires options, so present the question and ask user to type their description, then present `["Continue"]` to proceed.)
      - Actually, AskUserQuestion only supports predefined options. So instead: use AskUserQuestion with question `"Step failed. Please describe what went wrong in the question below and select a severity."` and options `["Critical", "High", "Medium", "Low"]`. The severity selection IS the follow-up. For the free-text note, after severity selection, display: "Note: To add a failure description, type it now and press Enter, or say 'skip' to continue without a note." -- Actually this won't work with AskUserQuestion.
      - **Revised approach:** On Fail, use AskUserQuestion:
        - **question:** `"Step {globalIndex} FAILED.\n\nWhat severity level?"`
        - **options:** `["Critical", "High", "Medium", "Low"]`
      - Record severity from user choice
      - The `userNotes` field will be empty string (AskUserQuestion does not support freeform input). The `description` field is auto-populated from the step's `instruction` + `expected`. The `actualBehavior` is set to "Failed (human reported)".
      - Push failure object to `failures` array:
        ```
        {id: "<setId>-uat-<globalIndex>", criterion, step: instruction, description: "Expected: {expected}. Step: {instruction}", severity: userChoice.toLowerCase(), relevantFiles: files, userNotes: "", expectedBehavior: expected, actualBehavior: "Failed (human reported)"}
        ```
   d. On **Skip**: increment `skipped`, continue
   e. On **Pass all remaining**: set all remaining steps to passed, break loop. This is the budget-exhaustion escape hatch noted in CONTEXT.md research.

**Remove old Step 7a (retry on failure):** Delete entirely. Human verdicts are final -- no retry concept.

**New Step 7 (was Step 8 -- Write REVIEW-UAT.md):** Modify the format:
- Remove `Type` column from scenario results (no automated/human distinction)
- Remove `Browser Automation` row from summary table
- Replace with `Human Verified` count (which equals passed + failed + skipped -- all steps are human-verified)
- Keep path logic (standard vs post-merge) unchanged
- Write is idempotent (overwrite)

**New Step 7b (new -- Write UAT-FAILURES.md):** If `failures.length > 0`, write UAT-FAILURES.md using the format from Wave 1:
- Path: `.planning/sets/{setId}/UAT-FAILURES.md` (or `.planning/post-merge/{setId}/UAT-FAILURES.md` if post-merge)
- Content follows the `buildUatFailuresMd` pattern from Wave 1 tests:
  - `<!-- UAT-FORMAT:v2 -->` version marker
  - `<!-- UAT-FAILURES-META {JSON} -->` embedded metadata block
  - Markdown failure sections mirroring the JSON data
- If `failures.length === 0`, do NOT write UAT-FAILURES.md (no file = no failures)
- If re-running and a previous UAT-FAILURES.md exists, overwrite it (clean overwrite per CONTEXT.md decision)

**New Step 8 (was Step 9 -- Log Failed Steps):** Keep issue logging via `node "${RAPID_TOOLS}" review log-issue`. Adjust: remove automated/human distinction from severity heuristic. Use the severity the human selected in Step 6.

**New Step 8b (was Step 9b -- Record Completion):** Keep unchanged.

**New Step 9 (was Step 10 -- Completion Banner):** Modify:
- Remove `Automated: {count}` line
- Remove `Browser Automation` reference entirely
- Add `Failures Logged: {failures.length}`
- Update next-steps to remove `/rapid:unit-test` mention of automated tests

**Important Notes section:** Update:
- Remove bullet about browser automation being optional
- Remove bullet about CHECKPOINT returns from UAT agent
- Remove bullet about retry on failure
- Add bullet: "All testing is human-driven. Each step is presented individually via AskUserQuestion. The 'Pass all remaining' option provides an escape hatch for large test plans."
- Keep bullets about UAT running once on full scope, acceptance criteria being primary input, idempotent overwrite, REVIEW-SCOPE.md being sole input, no stage selection

**Verification:**
```bash
# Structural checks
grep -c "Browser Automation\|browser.automation\|browserConfig\|BROWSER_TOOL\|chrome-devtools\|playwright\|Chrome DevTools" skills/uat/SKILL.md  # must be 0
grep -c "Step 7a\|Retry on Failure\|rapid-uat-fixer\|retryCount" skills/uat/SKILL.md  # must be 0
grep -c "AskUserQuestion" skills/uat/SKILL.md  # must be >= 3 (plan approval, step verdict, severity)
grep -c "Pass all remaining" skills/uat/SKILL.md  # must be >= 1
grep -c "UAT-FAILURES.md" skills/uat/SKILL.md  # must be >= 1
grep -c "UAT-FAILURES-META" skills/uat/SKILL.md  # must be >= 1
grep -c "UAT-FORMAT:v2" skills/uat/SKILL.md  # must be >= 1
```

---

### Task 3: Regenerate agents/rapid-uat.md via build-agents

**File:** `agents/rapid-uat.md`
**Action:** Regenerate from modified role source.

After Task 1 modifies `src/modules/roles/role-uat.md`, run the build-agents command to regenerate the composite agent file:

```bash
node src/commands/build-agents.cjs
```

**Verification:**
```bash
# Agent file was regenerated
grep -c "generates and executes" agents/rapid-uat.md  # must be 0 (old description removed)
grep -c "Phase 2" agents/rapid-uat.md  # must be 0
grep -c "automated" agents/rapid-uat.md  # must be 0
grep -c "browser" agents/rapid-uat.md  # must be 0
```

**What NOT to do:** Do NOT edit `agents/rapid-uat.md` directly. It is generated by build-agents from source modules.

## Success Criteria

- [ ] `src/modules/roles/role-uat.md` contains plan-generation-only responsibilities with no execution phase
- [ ] `src/modules/roles/role-uat.md` contains no references to browser automation, automated steps, Phase 2, CHECKPOINT, or dev server checks
- [ ] `skills/uat/SKILL.md` has no browser automation logic (Step 4 removed, browserConfig gone)
- [ ] `skills/uat/SKILL.md` has no retry/fixer logic (Step 7a removed)
- [ ] `skills/uat/SKILL.md` implements the AskUserQuestion-driven human verification loop with Pass/Fail/Skip/Pass-all-remaining options
- [ ] `skills/uat/SKILL.md` writes UAT-FAILURES.md on failures using the `<!-- UAT-FAILURES-META -->` format from Wave 1
- [ ] `skills/uat/SKILL.md` includes the `<!-- UAT-FORMAT:v2 -->` version marker in UAT-FAILURES.md output
- [ ] `agents/rapid-uat.md` is regenerated and contains no browser/execution references
- [ ] All verification grep checks pass with expected counts

## What NOT To Do

- Do NOT modify `skills/uat/uat-failures.test.cjs` -- that is Wave 1's artifact.
- Do NOT modify Steps 0-3 of SKILL.md beyond what is specified (they work correctly as-is).
- Do NOT add a separate parser module for UAT-FAILURES.md -- the format is simple enough for inline regex extraction.
- Do NOT add CHECKPOINT returns to the role -- the agent returns COMPLETE only.
- Do NOT add freeform text input to AskUserQuestion calls -- it only supports predefined options.
- Do NOT edit `agents/rapid-uat.md` directly -- always regenerate via build-agents.
