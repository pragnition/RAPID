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

Implemented in Wave 2. Spawns role-auditor agent for requirement cross-referencing.

## Step 3: Generate Audit Report

Implemented in Wave 2. Writes `.planning/v{version}-AUDIT.md`.

## Step 4: Remediation and Deferral

Implemented in Wave 2. Offers remediation via add-set or deferral with carry-forward context.
