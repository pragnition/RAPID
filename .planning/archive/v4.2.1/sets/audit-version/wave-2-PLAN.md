# PLAN: audit-version / Wave 2 -- Analysis, Report, and Remediation

## Objective

Complete the `/rapid:audit-version` command by implementing the gap analysis logic (Step 2), audit report generation (Step 3), and remediation/deferral workflow (Step 4) in SKILL.md. This wave replaces the placeholder sections created in Wave 1 with full implementations.

## Owned Files

| File | Action |
|------|--------|
| `skills/audit-version/SKILL.md` | MODIFY (replace Step 2-4 placeholders with full implementations) |

**Note:** `role-auditor.md`, `build-agents.cjs`, and `display.cjs` are NOT modified in this wave -- they were completed in Wave 1.

---

## Task 1: Implement Step 2 -- Gap Analysis

**File:** `skills/audit-version/SKILL.md`
**Action:** MODIFY -- replace the `## Step 2: Gap Analysis` placeholder

Replace the Wave 2 placeholder with the full gap analysis implementation. This step spawns the role-auditor agent to perform the actual analysis.

**Implementation specification:**

### Step 2a: Build Analysis Context

Before spawning the auditor agent, assemble the analysis context based on whether `TWO_PASS` is active.

**If TWO_PASS is false (< 5 sets):**
- Load all artifacts collected in Step 1 into a single analysis prompt
- Include: milestone ROADMAP section, REQUIREMENTS.md criteria (if available), all CONTRACT.json files, all VERIFICATION-REPORT.md files, set statuses from STATE.json

**If TWO_PASS is true (>= 5 sets):**
- **Pass 1 (Summary Scan):** Build a lightweight summary of each set: set ID, status, CONTRACT.json acceptance criteria count, VERIFICATION-REPORT.md pass/fail counts (if available), ROADMAP.md one-line scope description. Present this as a table to the auditor agent and ask it to flag sets needing deep-dive (any with: failed verifications, missing verification reports, acceptance criteria count mismatch, or scope that seems broader than contract definition).
- **Pass 2 (Deep Dive):** For only the flagged sets from Pass 1, load full CONTRACT.json, full VERIFICATION-REPORT.md, and wave-*-PLAN.md success criteria. Spawn the auditor agent again with this focused context.

### Step 2b: Spawn Role-Auditor Agent

Spawn the `rapid-auditor` agent with this prompt structure:

```
Audit milestone {TARGET_VERSION} ({MILESTONE_NAME}).

## Milestone Data
{milestone metadata table: version, name, set count, completion date if available}

## Requirements Source
{REQUIREMENTS.md content OR "No REQUIREMENTS.md available -- using ROADMAP.md + CONTRACT.json (reduced confidence)"}

## ROADMAP Scope
{extracted ROADMAP.md section for this milestone}

## Set Delivery Data
{for each set: set ID, status, CONTRACT.json acceptance criteria, VERIFICATION-REPORT summary}

## Instructions
For each planned requirement or acceptance criterion:
1. Determine coverage status: COVERED, PARTIAL, or UNCOVERED
2. Identify which set(s) delivered it (or should have)
3. For PARTIAL items, specify what was delivered vs what is missing
4. For UNCOVERED items, explain why no set addressed it
5. Assess confidence level (HIGH if verification data available, MEDIUM if only contract data, LOW if only roadmap description)

Return your analysis as a structured JSON in your RAPID:RETURN data field:
{
  "uncovered": [{ "requirement": "...", "expectedSet": "...", "reason": "...", "confidence": "HIGH|MEDIUM|LOW", "severity": "critical|high|medium|low", "remediation": "..." }],
  "partial": [{ "requirement": "...", "deliveredBy": "...", "delivered": "...", "missing": "...", "confidence": "...", "severity": "...", "remediation": "..." }],
  "covered": [{ "requirement": "...", "deliveredBy": "...", "verification": "PASS|N/A", "confidence": "..." }],
  "confidenceNotes": ["..."]
}
```

Parse the auditor's RAPID:RETURN to extract the structured gap data.

**Error handling:** If the auditor agent fails or returns invalid data, display error and STOP with: "Audit analysis failed. Check agent output above for details."

---

## Task 2: Implement Step 3 -- Generate Audit Report

**File:** `skills/audit-version/SKILL.md`
**Action:** MODIFY -- replace the `## Step 3: Generate Audit Report` placeholder

Replace the placeholder with the full report generation logic.

**Implementation specification:**

### Step 3a: Build Report Markdown

Generate the audit report from the gap analysis data. The report structure is:

```markdown
# AUDIT REPORT: v{version}

**Milestone:** {name}
**Audited:** {ISO date}
**Sets:** {total} ({merged count} merged)
**Overall Coverage:** {covered count}/{total requirements} ({percentage}%)

## Summary

| Status | Count | Percentage |
|--------|-------|------------|
| COVERED | {n} | {%} |
| PARTIAL | {n} | {%} |
| UNCOVERED | {n} | {%} |

## UNCOVERED Requirements

{For each uncovered item, severity-sorted (critical first):}

### {requirement description}
- **Severity:** {critical|high|medium|low}
- **Expected Set:** {set ID or "none identified"}
- **Reason:** {why it was not delivered}
- **Confidence:** {HIGH|MEDIUM|LOW}
- **Recommended Action:** {remediation description}

## PARTIAL Requirements

{For each partial item, severity-sorted:}

### {requirement description}
- **Severity:** {critical|high|medium|low}
- **Delivered By:** {set ID}
- **What Was Delivered:** {description}
- **What Is Missing:** {description}
- **Confidence:** {HIGH|MEDIUM|LOW}
- **Recommended Action:** {remediation description}

## COVERED Requirements

{For each covered item as a compact table:}

| Requirement | Delivered By | Verification | Confidence |
|-------------|-------------|--------------|------------|
| {req} | {set} | {PASS/N/A} | {level} |

## Confidence Notes

{List any data quality warnings:}
- {e.g., "REQUIREMENTS.md was not available -- coverage assessment based on ROADMAP.md + CONTRACT.json only"}
- {e.g., "Sets X, Y have no VERIFICATION-REPORT.md -- verification status marked N/A"}
- {e.g., "Legacy milestone -- limited tracking data available"}
```

### Step 3b: Write Report Artifact

Write the report to `.planning/v{version}-AUDIT.md`.

Display: `Audit report written to .planning/v{version}-AUDIT.md`

**Verification:**
```bash
test -f .planning/v${TARGET_VERSION}-AUDIT.md && echo "PASS" || echo "FAIL"
```

---

## Task 3: Implement Step 4 -- Remediation and Deferral

**File:** `skills/audit-version/SKILL.md`
**Action:** MODIFY -- replace the `## Step 4: Remediation and Deferral` placeholder

Replace the placeholder with the full remediation workflow.

**Implementation specification:**

### Step 4a: Determine if Remediation is Needed

If there are no UNCOVERED or PARTIAL items:
- Display: "No gaps found -- milestone {version} is fully covered."
- Skip to Step 5 (completion banner).

If there are gaps, display a summary:
```
--- Gap Summary ---
UNCOVERED: {count} ({critical count} critical)
PARTIAL: {count}
-------------------
```

### Step 4b: Remediation Decision -- Critical/Uncovered Items

For each UNCOVERED item with severity `critical` or `high`, prompt the user individually using AskUserQuestion:

> "Gap: {requirement description}\nSeverity: {severity}\n\nHow should this be addressed?"
> Options: ["Create remediation set", "Defer to next version", "Accept risk (skip)"]

- **"Create remediation set":** Invoke the add-set logic. Use the auditor's remediation recommendation as the scope description. Call:
  ```bash
  # Display the recommended scope for the remediation set
  echo "Recommended scope for remediation set:"
  echo "{remediation description from gap analysis}"
  echo ""
  echo "Proceeding to create remediation set..."
  ```
  Then use AskUserQuestion to ask the user to provide a set name for the remediation, and create the set directory with a DEFINITION.md containing the remediation scope. The actual `/rapid:add-set` invocation is left to the user as a next step (print the command they should run).

- **"Defer to next version":** Add the item to the deferral list (collected for Step 4d).

- **"Accept risk":** Log the decision and move on.

### Step 4c: Remediation Decision -- Minor/Partial Items

For remaining PARTIAL items and UNCOVERED items with severity `medium` or `low`, present them as a batch using AskUserQuestion:

> "The following minor gaps were identified:\n{numbered list of items}\n\nWhat action for these items?"
> Options: ["Defer all to next version", "Review individually", "Accept all risks"]

- **"Defer all":** Add all to deferral list.
- **"Review individually":** Loop through each with the same 3-option prompt as Step 4b.
- **"Accept all":** Log and move on.

### Step 4d: Write Deferral Artifacts

If any items were deferred, write two artifacts:

1. **`.planning/v{version}-DEFERRED.md`:**
   ```markdown
   # DEFERRED FROM v{version}

   **Generated:** {ISO date}
   **Source:** /rapid:audit-version

   ## Deferred Items

   | # | Requirement | Original Severity | Reason for Deferral | Carry-Forward Context |
   |---|------------|-------------------|--------------------|-----------------------|
   | 1 | {req} | {severity} | User decision during audit | {context for next version} |
   ```

2. **Append to ROADMAP.md:** Add a section at the end of the active milestone section (or after it):
   ```markdown
   ### Deferred from v{version}
   The following items were identified during audit and deferred:
   - {requirement description} (severity: {level})
   ```

### Step 4e: Print Remediation Commands

For any items where the user chose "Create remediation set", print:
```
--- Remediation Next Steps ---
Run these commands to create remediation sets:
  /rapid:add-set   (scope: {remediation description})
-------------------------------
```

### Step 5: Completion Banner

Display:
```
--- RAPID Audit Complete ---
Milestone: {version} ({name})
Coverage: {covered}/{total} ({%}%)
Gaps: {uncovered + partial count}
Report: .planning/v{version}-AUDIT.md
{if deferred: "Deferred: .planning/v{version}-DEFERRED.md"}
{if remediation sets suggested: "Remediation sets suggested: {count}"}
----------------------------
```

---

## Success Criteria

1. `/rapid:audit-version` SKILL.md contains complete Steps 2-4 with no placeholder text remaining
2. Step 2 implements two-pass analysis when `TWO_PASS=true` (milestone with 5+ sets)
3. Step 3 writes `.planning/v{version}-AUDIT.md` with severity-first organization
4. Step 4 offers per-item remediation for critical gaps and batch handling for minor gaps
5. Deferral writes both `.planning/v{version}-DEFERRED.md` and appends to ROADMAP.md
6. STATE.json is never mutated anywhere in the skill (grep for `state set` or `state transition` should find zero matches in the SKILL.md)
7. The skill handles missing REQUIREMENTS.md gracefully with reduced confidence warnings
8. The skill handles legacy milestones (empty sets array) with an informative error and STOP

## Verification Commands

```bash
# Verify no STATE.json mutation commands
grep -c "state set\|state transition\|writeState\|mutate" skills/audit-version/SKILL.md | xargs -I{} test {} -eq 0 && echo "READ-ONLY PASS" || echo "READ-ONLY FAIL"

# Verify all steps present
grep -c "## Step [0-4]" skills/audit-version/SKILL.md | xargs -I{} test {} -ge 5 && echo "STEPS PASS" || echo "STEPS FAIL"

# Verify two-pass logic present
grep -q "TWO_PASS" skills/audit-version/SKILL.md && echo "TWO-PASS PASS" || echo "TWO-PASS FAIL"

# Verify remediation workflow present
grep -q "AskUserQuestion" skills/audit-version/SKILL.md && echo "REMEDIATION PASS" || echo "REMEDIATION FAIL"

# Verify deferral artifacts
grep -q "DEFERRED.md" skills/audit-version/SKILL.md && echo "DEFERRAL PASS" || echo "DEFERRAL FAIL"
```
