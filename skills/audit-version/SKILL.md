---
description: Audit a completed milestone for gaps between planned requirements and actual delivery
allowed-tools: Bash(rapid-tools:*), AskUserQuestion, Read, Write, Glob, Grep, Agent
---

# /rapid:audit-version -- Milestone Audit

You are the RAPID milestone auditor. This skill audits a completed milestone by cross-referencing planned requirements (ROADMAP.md, REQUIREMENTS.md, CONTRACT.json) against actual delivery (STATE.json set statuses, VERIFICATION-REPORT.md). It produces a structured gap report at `.planning/v{version}-AUDIT.md` and offers remediation for identified gaps. Follow these steps IN ORDER. Do not skip steps.

## Step 0: Environment Setup + Banner

### 0a: Load environment

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
```

### Display Stage Banner

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display banner audit-version
```

### 0b: Parse Arguments

The user invokes with: `/rapid:audit-version [version]`

- If a version argument is provided, use it directly as TARGET_VERSION (e.g., `v4.1.0`).
- If no version argument is provided, resolve the most recently completed milestone:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
STATE_JSON=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
echo "${STATE_JSON}"
```

Parse the milestones array from the output. Find the most recent milestone where ALL sets have `status === 'merged'` AND the sets array is non-empty. This is the `TARGET_VERSION`.

Display: `Auditing milestone: {TARGET_VERSION}`

If no fully-completed milestone is found, ask the user which milestone to audit using AskUserQuestion.

## Step 1: Load Milestone Artifacts

Load and validate all artifacts needed for analysis:

1. **STATE.json milestone data** -- Load the milestone entry for TARGET_VERSION using:
   ```bash
   node "${RAPID_TOOLS}" state get milestone "<TARGET_VERSION>"
   ```
   Extract: milestone name, sets array, set statuses.

2. **ROADMAP.md** -- Read `.planning/ROADMAP.md` and extract the section for TARGET_VERSION. This contains the planned scope descriptions per set.

3. **REQUIREMENTS.md** -- Read `.planning/REQUIREMENTS.md` if it exists. If missing, set `REDUCED_CONFIDENCE=true` and log:
   > WARNING: REQUIREMENTS.md not found. Proceeding with ROADMAP.md + CONTRACT.json (reduced confidence).

4. **Per-set CONTRACT.json** -- For each set in the milestone, read `.planning/sets/{setId}/CONTRACT.json` if it exists. Extract acceptance criteria and owned files.

5. **Per-set VERIFICATION-REPORT.md** -- For each set, read `.planning/sets/{setId}/VERIFICATION-REPORT.md` if it exists.

6. **Validate milestone** -- If the milestone has an empty sets array, display error and STOP:
   > ERROR: Milestone {version} has no sets -- cannot audit (legacy milestone without tracking data).

7. **Two-pass threshold** -- Count the sets. If `setCount >= 5`, set `TWO_PASS=true` and log:
   > Large milestone ({setCount} sets) -- using two-pass analysis.

After loading, summarize the data inventory: how many sets, how many have CONTRACT.json, how many have VERIFICATION-REPORT.md, whether REQUIREMENTS.md was found.

## Step 2: Gap Analysis

### Step 2a: Build Analysis Context

Assemble the context payload for the auditor agent. The approach depends on the `TWO_PASS` flag set in Step 1.

**If TWO_PASS is false (fewer than 5 sets):**

Load all artifacts collected in Step 1 into a single analysis prompt:
- Milestone ROADMAP section (extracted in Step 1)
- REQUIREMENTS.md criteria (if available; omit if `REDUCED_CONFIDENCE=true`)
- All CONTRACT.json files (full content per set)
- All VERIFICATION-REPORT.md files (full content per set)
- Set statuses from STATE.json

**If TWO_PASS is true (5 or more sets):**

**Pass 1 -- Summary Scan:**

Build a lightweight summary table of each set with the following columns:
- Set ID
- Status (from STATE.json)
- Acceptance criteria count (from CONTRACT.json, or "N/A" if missing)
- Verification pass/fail counts (from VERIFICATION-REPORT.md, or "N/A" if missing)
- One-line scope description (from ROADMAP.md)

Present this table to the auditor agent (see Step 2b) and ask it to flag sets needing a deep-dive. A set should be flagged if ANY of the following are true:
- It has failed verifications
- It has no VERIFICATION-REPORT.md
- Its acceptance criteria count seems mismatched with its scope breadth
- Its ROADMAP scope description seems broader than its CONTRACT.json definition

Collect the list of flagged set IDs from the auditor's response.

**Pass 2 -- Deep Dive:**

For only the flagged sets from Pass 1, load full artifacts:
- Full CONTRACT.json
- Full VERIFICATION-REPORT.md
- wave-*-PLAN.md success criteria sections

Spawn the auditor agent again (Step 2b) with this focused deep-dive context plus the Pass 1 summary for unflagged sets (so the auditor has full picture).

### Step 2b: Spawn Role-Auditor Agent

Use the Agent tool to spawn the `rapid-auditor` agent. Provide the role file and the analysis context assembled in Step 2a.

**Agent spawn configuration:**
- **Role:** Load from `src/modules/roles/role-auditor.md`
- **Model:** Use default (inherit from parent)

**Prompt structure for the auditor agent:**

```
Audit milestone {TARGET_VERSION} ({MILESTONE_NAME}).

## Milestone Data

| Field | Value |
|-------|-------|
| Version | {TARGET_VERSION} |
| Name | {MILESTONE_NAME} |
| Set Count | {setCount} |
| Completion Date | {date if available, or "In progress"} |

## Requirements Source

{Full REQUIREMENTS.md content if available, OR:
"No REQUIREMENTS.md available -- using ROADMAP.md + CONTRACT.json (reduced confidence)"}

## ROADMAP Scope

{Extracted ROADMAP.md section for this milestone}

## Set Delivery Data

{For each set, include:
- Set ID and status
- CONTRACT.json acceptance criteria (full list)
- VERIFICATION-REPORT.md summary (pass/fail counts and any failure details)
- If TWO_PASS Pass 2: include wave-*-PLAN.md success criteria for flagged sets}

## Instructions

For each planned requirement or acceptance criterion:
1. Determine coverage status: COVERED, PARTIAL, or UNCOVERED
2. Identify which set(s) delivered it (or should have)
3. For PARTIAL items, specify what was delivered vs what is missing
4. For UNCOVERED items, explain why no set addressed it
5. Assess confidence level:
   - HIGH: verification data available and passing
   - MEDIUM: only contract data, no verification report
   - LOW: only roadmap description, no contract or verification

Return your analysis as a structured JSON in your RAPID:RETURN data field:
{
  "uncovered": [{ "requirement": "...", "expectedSet": "...", "reason": "...", "confidence": "HIGH|MEDIUM|LOW", "severity": "critical|high|medium|low", "remediation": "..." }],
  "partial": [{ "requirement": "...", "deliveredBy": "...", "delivered": "...", "missing": "...", "confidence": "HIGH|MEDIUM|LOW", "severity": "critical|high|medium|low", "remediation": "..." }],
  "covered": [{ "requirement": "...", "deliveredBy": "...", "verification": "PASS|N/A", "confidence": "HIGH|MEDIUM|LOW" }],
  "confidenceNotes": ["..."]
}
```

### Step 2c: Parse Auditor Response

Parse the auditor agent's RAPID:RETURN to extract the structured gap data. Look for the `<!-- RAPID:RETURN {...} -->` marker in the agent's output and extract the JSON payload.

Store the parsed data as `GAP_DATA` with keys: `uncovered`, `partial`, `covered`, `confidenceNotes`.

**Error handling:** If the auditor agent fails, returns no RAPID:RETURN marker, or returns invalid JSON:
- Display: `ERROR: Audit analysis failed. Check agent output above for details.`
- STOP execution. Do not proceed to Step 3.

## Step 3: Generate Audit Report

### Step 3a: Build Report Markdown

Using `GAP_DATA` from Step 2, generate the audit report. Compute summary statistics first:

- `totalRequirements = GAP_DATA.covered.length + GAP_DATA.partial.length + GAP_DATA.uncovered.length`
- `coveredPct = Math.round(GAP_DATA.covered.length / totalRequirements * 100)`
- `partialPct = Math.round(GAP_DATA.partial.length / totalRequirements * 100)`
- `uncoveredPct = Math.round(GAP_DATA.uncovered.length / totalRequirements * 100)`

Sort UNCOVERED items by severity (critical > high > medium > low). Sort PARTIAL items the same way.

Generate the report with this structure:

```markdown
# AUDIT REPORT: v{TARGET_VERSION}

**Milestone:** {MILESTONE_NAME}
**Audited:** {current ISO date}
**Sets:** {total set count} ({merged count} merged)
**Overall Coverage:** {covered count}/{totalRequirements} ({coveredPct}%)

## Summary

| Status | Count | Percentage |
|--------|-------|------------|
| COVERED | {covered count} | {coveredPct}% |
| PARTIAL | {partial count} | {partialPct}% |
| UNCOVERED | {uncovered count} | {uncoveredPct}% |

## UNCOVERED Requirements

{For each uncovered item, sorted by severity (critical first):}

### {requirement description}
- **Severity:** {critical|high|medium|low}
- **Expected Set:** {expectedSet or "none identified"}
- **Reason:** {reason}
- **Confidence:** {HIGH|MEDIUM|LOW}
- **Recommended Action:** {remediation}

{If no uncovered items: "No uncovered requirements found."}

## PARTIAL Requirements

{For each partial item, sorted by severity (critical first):}

### {requirement description}
- **Severity:** {critical|high|medium|low}
- **Delivered By:** {deliveredBy}
- **What Was Delivered:** {delivered}
- **What Is Missing:** {missing}
- **Confidence:** {HIGH|MEDIUM|LOW}
- **Recommended Action:** {remediation}

{If no partial items: "No partial requirements found."}

## COVERED Requirements

| Requirement | Delivered By | Verification | Confidence |
|-------------|-------------|--------------|------------|
{For each covered item:}
| {requirement} | {deliveredBy} | {verification} | {confidence} |

## Confidence Notes

{For each note in GAP_DATA.confidenceNotes:}
- {note}

{Always include these contextual notes where applicable:}
- If REDUCED_CONFIDENCE was true: "REQUIREMENTS.md was not available -- coverage assessment based on ROADMAP.md + CONTRACT.json only"
- For any sets missing VERIFICATION-REPORT.md: "Sets {list} have no VERIFICATION-REPORT.md -- verification status marked N/A"
- If milestone has any non-merged sets: "Sets {list} are not yet merged -- audit may be incomplete"
```

### Step 3b: Write Report Artifact

Write the generated report to `.planning/v{TARGET_VERSION}-AUDIT.md` using the Write tool.

Display: `Audit report written to .planning/v{TARGET_VERSION}-AUDIT.md`

Verify the artifact was created:

```bash
test -f .planning/v${TARGET_VERSION}-AUDIT.md && echo "PASS: Audit report exists" || echo "FAIL: Audit report not created"
```

## Step 4: Remediation and Deferral

### Step 4a: Determine if Remediation is Needed

Check `GAP_DATA` for any UNCOVERED or PARTIAL items.

**If there are no gaps (both arrays empty):**
- Display: `No gaps found -- milestone {TARGET_VERSION} is fully covered.`
- Skip to Step 5.

**If there are gaps, display a summary:**

```
--- Gap Summary ---
UNCOVERED: {uncovered count} ({critical count} critical)
PARTIAL: {partial count}
-------------------
```

Initialize tracking lists:
- `DEFERRAL_LIST = []` -- items the user chose to defer
- `REMEDIATION_LIST = []` -- items the user chose to create remediation sets for

### Step 4b: Remediation Decision -- Critical and High Severity Items

For each UNCOVERED item with severity `critical` or `high`, prompt the user individually using AskUserQuestion:

**Prompt:**
> Gap: {requirement description}
> Severity: {severity}
> Expected Set: {expectedSet}
> Reason: {reason}
>
> How should this be addressed?

**Options:** `["Create remediation set", "Defer to next version", "Accept risk (skip)"]`

Handle each response:

- **"Create remediation set":** Add to `REMEDIATION_LIST` with the item's remediation recommendation. Display:
  ```
  Recommended scope for remediation set:
  {remediation description from gap analysis}

  You will be prompted for a set name after all gaps are reviewed.
  ```

- **"Defer to next version":** Add to `DEFERRAL_LIST` with full context (requirement, severity, reason, remediation recommendation as carry-forward context).

- **"Accept risk (skip)":** Log the decision. Display: `Accepted risk for: {requirement description}`

Repeat the same process for each PARTIAL item with severity `critical` or `high`, adjusting the prompt to show what was delivered and what is missing.

### Step 4c: Remediation Decision -- Minor Items

Collect all remaining items: UNCOVERED with severity `medium` or `low`, and PARTIAL with severity `medium` or `low`.

If there are no minor items, skip to Step 4d.

Present them as a batch using AskUserQuestion:

**Prompt:**
> The following minor gaps were identified:
> {numbered list: "1. [UNCOVERED] {requirement} (severity: {level})" or "1. [PARTIAL] {requirement} -- missing: {missing} (severity: {level})"}
>
> What action for these items?

**Options:** `["Defer all to next version", "Review individually", "Accept all risks"]`

Handle the response:

- **"Defer all to next version":** Add all items to `DEFERRAL_LIST`.

- **"Review individually":** Loop through each item with the same 3-option prompt as Step 4b (Create remediation set / Defer / Accept risk).

- **"Accept all risks":** Log the decision. Display: `Accepted risk for {count} minor gap(s).`

### Step 4d: Write Deferral Artifacts

If `DEFERRAL_LIST` is empty, skip to Step 4e.

**Artifact 1: `.planning/v{TARGET_VERSION}-DEFERRED.md`**

Write this file using the Write tool:

```markdown
# DEFERRED FROM v{TARGET_VERSION}

**Generated:** {current ISO date}
**Source:** /rapid:audit-version

## Deferred Items

| # | Requirement | Original Severity | Reason for Deferral | Carry-Forward Context |
|---|------------|-------------------|--------------------|-----------------------|
{For each item in DEFERRAL_LIST:}
| {n} | {requirement} | {severity} | User decision during audit | {remediation recommendation or context for next version planning} |
```

**Artifact 2: Append to ROADMAP.md**

Read `.planning/ROADMAP.md`, find the section for `TARGET_VERSION`, and append after it (or at the end of that milestone's section):

```markdown
### Deferred from v{TARGET_VERSION}
The following items were identified during audit and deferred:
{For each deferred item:}
- {requirement description} (severity: {severity})
```

Use the Edit tool to append this section. If the milestone section cannot be located precisely, append to the end of ROADMAP.md.

Display: `Deferral artifacts written to .planning/v{TARGET_VERSION}-DEFERRED.md and ROADMAP.md`

### Step 4e: Print Remediation Commands

If `REMEDIATION_LIST` is not empty:

For each item in `REMEDIATION_LIST`, use AskUserQuestion to ask the user for a set name:

**Prompt:**
> Remediation needed for: {requirement description}
> Recommended scope: {remediation description}
>
> What should this remediation set be named? (Use kebab-case, e.g., "fix-auth-validation")

Collect the set names.

For each item in `REMEDIATION_LIST` with its collected set name, write a remediation artifact using the Write tool:

Write `.planning/pending-sets/{set-name}.json` with this structure:

```json
{
  "setName": "{set-name}",
  "scope": "{remediation description from gap analysis}",
  "files": [],
  "deps": [],
  "severity": "{severity from gap item}",
  "source": "v{TARGET_VERSION}-AUDIT.md",
  "createdAt": "{current ISO date}"
}
```

Create the `.planning/pending-sets/` directory first if it does not exist:

```bash
mkdir -p .planning/pending-sets
```

The `files` and `deps` arrays are left empty -- they will be populated by the user during add-set discovery. The `source` field references the audit report for traceability.

Then display:

```
--- Remediation Next Steps ---
Run these commands to create remediation sets:
{For each remediation item:}
  /rapid:add-set {set-name}   (scope: {remediation description})
-------------------------------

Remediation artifacts written to .planning/pending-sets/
These will be auto-discovered when you run /rapid:add-set.
```

If `REMEDIATION_LIST` is empty, skip this step.

## Step 5: Completion Banner

Display the final summary:

```
--- RAPID Audit Complete ---
Milestone: {TARGET_VERSION} ({MILESTONE_NAME})
Coverage: {covered count}/{totalRequirements} ({coveredPct}%)
Gaps: {uncovered + partial count}
Report: .planning/v{TARGET_VERSION}-AUDIT.md
{If DEFERRAL_LIST is not empty: "Deferred: .planning/v{TARGET_VERSION}-DEFERRED.md"}
{If REMEDIATION_LIST is not empty: "Remediation sets suggested: {count}"}
----------------------------
```

Display the completion footer:

```bash
if [ -z "${RAPID_TOOLS:-}" ] && [ -n "${CLAUDE_SKILL_DIR:-}" ] && [ -f "${CLAUDE_SKILL_DIR}/../../.env" ]; then export $(grep -v '^#' "${CLAUDE_SKILL_DIR}/../../.env" | xargs); fi
if [ -z "${RAPID_TOOLS}" ]; then echo "[RAPID ERROR] RAPID_TOOLS is not set. Run /rapid:install or ./setup.sh to configure RAPID."; exit 1; fi
node "${RAPID_TOOLS}" display footer "/rapid:new-version"
```
