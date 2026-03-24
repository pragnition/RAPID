# PLAN: audit-version / Wave 1 -- Foundation

## Objective

Establish the infrastructure for the `/rapid:audit-version` command: the auditor role module, build-agents registration, display banner entries, and the SKILL.md skeleton with environment setup, version resolution, and state loading. Wave 2 builds the actual analysis and remediation logic on top of this foundation.

## Owned Files

| File | Action |
|------|--------|
| `src/modules/roles/role-auditor.md` | CREATE |
| `src/commands/build-agents.cjs` | MODIFY (4 map entries) |
| `src/lib/display.cjs` | MODIFY (2 map entries) |
| `skills/audit-version/SKILL.md` | CREATE (skeleton only -- Wave 2 fills in analysis steps) |

---

## Task 1: Create role-auditor.md

**File:** `src/modules/roles/role-auditor.md`
**Action:** CREATE

Create the auditor role module following the pattern of existing role modules (see `role-verifier.md`, `role-reviewer.md` for structure reference). The auditor is a **read-only analysis agent** -- it never mutates STATE.json or any project state.

**Content specification:**

1. H1 heading: `# Role: Auditor`
2. Introductory paragraph: You audit completed milestones by cross-referencing planned requirements against actual delivery. You produce structured gap reports identifying covered, partially covered, and uncovered requirements. You never mutate STATE.json or any project state -- you are strictly read-only.
3. Section `## Responsibilities` with these bullets:
   - **Cross-reference requirements against delivery.** Compare ROADMAP.md scope descriptions, REQUIREMENTS.md acceptance criteria, and CONTRACT.json definitions against actual set completion status and verification reports.
   - **Classify requirement coverage.** For each planned requirement, determine coverage status: COVERED (fully delivered with passing verification), PARTIAL (delivered but with gaps in acceptance criteria), or UNCOVERED (not addressed by any set).
   - **Produce severity-first gap reports.** Organize findings by severity -- uncovered items first, then partial, then covered. Include set cross-references showing which set was expected to deliver each item.
   - **Support two-pass analysis for large milestones.** For milestones with 5+ sets, perform a summary scan first (set statuses + CONTRACT.json acceptance counts), then deep-dive only on flagged sets to stay within context budget.
   - **Generate remediation recommendations.** For each gap, recommend either a remediation set (with scope description suitable for `/rapid:add-set`) or deferral to the next version with carry-forward context.
4. Section `## Analysis Inputs` as a table:
   - `.planning/ROADMAP.md` -- Planned scope per set, milestone descriptions
   - `.planning/REQUIREMENTS.md` -- Acceptance criteria (if available; fall back to ROADMAP.md + CONTRACT.json with reduced confidence warning)
   - `.planning/STATE.json` -- Set completion statuses (READ ONLY)
   - `.planning/sets/{setId}/CONTRACT.json` -- Per-set acceptance criteria and owned files
   - `.planning/sets/{setId}/VERIFICATION-REPORT.md` -- Verification results per set (if available)
   - `.planning/sets/{setId}/wave-*-PLAN.md` -- Planned tasks and success criteria per wave
5. Section `## Output Format` describing the audit report structure:
   - H1: `# AUDIT REPORT: v{version}`
   - Metadata table: version, date, milestone name, total sets, completion rate
   - `## UNCOVERED` section: requirements with no delivering set
   - `## PARTIAL` section: requirements delivered but with acceptance gaps
   - `## COVERED` section: requirements fully delivered with passing verification
   - `## Remediation Recommendations` section: per-gap recommendations
   - `## Confidence Notes` section: data quality warnings (missing REQUIREMENTS.md, empty CONTRACT.json, etc.)
6. Section `## Constraints` with these bullets:
   - NEVER mutate STATE.json -- this is a read-only analysis role
   - NEVER modify set artifacts -- only produce the audit report and deferral artifacts
   - For milestones with 5+ sets, ALWAYS use two-pass analysis to stay within context budget
   - If REQUIREMENTS.md is missing, proceed with ROADMAP.md + CONTRACT.json but add a confidence warning to the report
   - Flag any milestone with empty sets array as "unauditable" (legacy milestones v1.0-v3.0)

**Verification:**
```bash
test -f src/modules/roles/role-auditor.md && grep -q "# Role: Auditor" src/modules/roles/role-auditor.md && echo "PASS" || echo "FAIL"
```

---

## Task 2: Register auditor in build-agents.cjs

**File:** `src/commands/build-agents.cjs`
**Action:** MODIFY (add 4 entries to existing maps)

Add the `auditor` role to all four registration maps. The auditor is a read-only analysis agent that needs read and search tools but no write or edit tools.

**Specific changes:**

1. **ROLE_TOOLS** -- Add entry after the last existing entry (currently `'conflict-resolver'`):
   ```
   'auditor': 'Read, Grep, Glob, Bash',
   ```
   Rationale: Auditor reads artifacts and runs CLI commands to query state but never writes files directly (the skill handles file writes).

2. **ROLE_COLORS** -- Add entry:
   ```
   'auditor': 'blue',
   ```
   Rationale: Blue is the planning/analysis color group.

3. **ROLE_DESCRIPTIONS** -- Add entry:
   ```
   'auditor': 'RAPID auditor agent -- cross-references requirements against delivery for gap analysis',
   ```

4. **ROLE_CORE_MAP** -- Add entry:
   ```
   'auditor': ['core-identity.md', 'core-returns.md'],
   ```
   Rationale: Auditor does not commit code, so no `core-conventions.md`.

**What NOT to do:**
- Do NOT add `auditor` to the `SKIP_GENERATION` array -- it should be auto-generated like most roles.
- Do NOT change the order of existing entries in any map.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
  const ba = require('./src/commands/build-agents.cjs');
  // Dry-run build to check auditor is registered
  const fs = require('fs');
  const src = fs.readFileSync('./src/commands/build-agents.cjs', 'utf-8');
  const hasTools = src.includes(\"'auditor':\") && src.includes('ROLE_TOOLS');
  const hasColors = src.includes(\"'auditor':\") && src.includes('ROLE_COLORS');
  const hasDesc = src.includes(\"'auditor':\") && src.includes('ROLE_DESCRIPTIONS');
  const hasCore = src.includes(\"'auditor':\") && src.includes('ROLE_CORE_MAP');
  console.log('ROLE_TOOLS:', hasTools ? 'PASS' : 'FAIL');
  console.log('ROLE_COLORS:', hasColors ? 'PASS' : 'FAIL');
  console.log('ROLE_DESCRIPTIONS:', hasDesc ? 'PASS' : 'FAIL');
  console.log('ROLE_CORE_MAP:', hasCore ? 'PASS' : 'FAIL');
"
```

---

## Task 3: Add display.cjs banner entries

**File:** `src/lib/display.cjs`
**Action:** MODIFY (add 2 map entries)

Add `audit-version` stage to both display maps so the banner renders correctly.

**Specific changes:**

1. **STAGE_VERBS** -- Add entry after the `'branding'` entry:
   ```
   'audit-version': 'AUDITING',
   ```

2. **STAGE_BG** -- Add entry after the `'branding'` entry:
   ```
   'audit-version': '\x1b[101m',   // bright red (review/analysis stage)
   ```
   Rationale: Audit is an analysis/review-like stage, so it uses the bright red background like `review` and `merge`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
  const { STAGE_VERBS, STAGE_BG, renderBanner } = require('./src/lib/display.cjs');
  console.log('STAGE_VERBS:', STAGE_VERBS['audit-version'] === 'AUDITING' ? 'PASS' : 'FAIL');
  console.log('STAGE_BG:', STAGE_BG['audit-version'] ? 'PASS' : 'FAIL');
  const banner = renderBanner('audit-version', 'v4.1.0');
  console.log('renderBanner:', banner.includes('AUDITING') ? 'PASS' : 'FAIL');
  console.log('Banner preview:', banner);
"
```

---

## Task 4: Create SKILL.md skeleton

**File:** `skills/audit-version/SKILL.md`
**Action:** CREATE (skeleton with Steps 0-1 fully implemented; Steps 2-4 as placeholders for Wave 2)

Create the skill definition file. This skeleton includes the frontmatter, environment setup, banner, argument parsing, version resolution, milestone validation, and state loading. The analysis steps (2-4) are marked as Wave 2 placeholders.

**Content specification:**

1. **Frontmatter:**
   ```yaml
   ---
   description: Audit a completed milestone for gaps between planned requirements and actual delivery
   allowed-tools: Bash(rapid-tools:*), AskUserQuestion, Read, Write, Glob, Grep, Agent
   ---
   ```

2. **H1:** `# /rapid:audit-version -- Milestone Audit`

3. **Intro paragraph:** You are the RAPID milestone auditor. This skill audits a completed milestone by cross-referencing planned requirements (ROADMAP.md, REQUIREMENTS.md, CONTRACT.json) against actual delivery (STATE.json set statuses, VERIFICATION-REPORT.md). It produces a structured gap report at `.planning/v{version}-AUDIT.md` and offers remediation for identified gaps. Follow these steps IN ORDER. Do not skip steps.

4. **Step 0: Environment Setup + Banner**
   - Standard env preamble (same as all other skills)
   - Display banner: `node "${RAPID_TOOLS}" display banner audit-version`

5. **Step 0b: Parse Arguments**
   - The user invokes with: `/rapid:audit-version [version]`
   - If version argument provided, use it directly (e.g., `v4.1.0`)
   - If no version argument, resolve the most recently completed milestone:
     ```bash
     STATE_JSON=$(node "${RAPID_TOOLS}" state get --all 2>/dev/null)
     ```
     Parse milestones array. Find the most recent milestone where all sets have `status === 'merged'` (and the sets array is non-empty). This is the `TARGET_VERSION`.
   - Display: `Auditing milestone: {TARGET_VERSION}`

6. **Step 1: Load Milestone Artifacts**
   - Load STATE.json milestone data for TARGET_VERSION
   - Load ROADMAP.md -- extract the section for TARGET_VERSION
   - Load REQUIREMENTS.md -- if missing, set `REDUCED_CONFIDENCE=true` and log warning: "REQUIREMENTS.md not found. Proceeding with ROADMAP.md + CONTRACT.json (reduced confidence)."
   - For each set in the milestone: load `.planning/sets/{setId}/CONTRACT.json` (if exists)
   - For each set: load `.planning/sets/{setId}/VERIFICATION-REPORT.md` (if exists)
   - Validate: if milestone has empty sets array, display error "Milestone {version} has no sets -- cannot audit (legacy milestone without tracking data)" and STOP
   - Count sets. If `setCount >= 5`, set `TWO_PASS=true` and log: "Large milestone ({setCount} sets) -- using two-pass analysis."

7. **Steps 2-4: Placeholder comments**
   Add these as H2 sections with a single line each:
   - `## Step 2: Gap Analysis` -- "Implemented in Wave 2. Spawns role-auditor agent for requirement cross-referencing."
   - `## Step 3: Generate Audit Report` -- "Implemented in Wave 2. Writes .planning/v{version}-AUDIT.md."
   - `## Step 4: Remediation and Deferral` -- "Implemented in Wave 2. Offers remediation via add-set or deferral with carry-forward context."

**What NOT to do:**
- Do NOT implement the gap analysis logic in Wave 1 -- that is Wave 2's scope
- Do NOT use `require('${RAPID_TOOLS}/../lib/...')` -- this path pattern is broken (known bug from path-resolution-fix set). Use `node "${RAPID_TOOLS}"` CLI calls only.
- Do NOT mutate STATE.json anywhere in the skill

**Verification:**
```bash
test -f skills/audit-version/SKILL.md && grep -q "audit-version" skills/audit-version/SKILL.md && grep -q "Step 0" skills/audit-version/SKILL.md && grep -q "Step 1" skills/audit-version/SKILL.md && echo "PASS" || echo "FAIL"
```

---

## Success Criteria

1. `src/modules/roles/role-auditor.md` exists with correct structure and read-only constraints
2. `src/commands/build-agents.cjs` has all 4 map entries for `auditor` role
3. `src/lib/display.cjs` renders `audit-version` banner correctly
4. `skills/audit-version/SKILL.md` exists with Steps 0-1 fully specified and Steps 2-4 as placeholders
5. `node -e "require('./src/lib/display.cjs').renderBanner('audit-version', 'v4.1.0')"` outputs a colored banner containing "AUDITING"
6. No existing tests are broken: `cd /home/kek/Projects/RAPID && node --test src/lib/display.test.cjs src/commands/build-agents.test.cjs 2>&1 | tail -5`
