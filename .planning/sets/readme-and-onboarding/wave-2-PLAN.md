# PLAN: readme-and-onboarding -- Wave 2

**Objective:** Update DOCS.md with a new Session Management section, migrate the "How It Works" prose from the old README, fix the Node.js version requirement, and update the help skill output for consistency with the rewritten README. These are secondary deliverables that build on the README patterns established in Wave 1.

**Owned Files:** `DOCS.md`, `skills/help/SKILL.md`

**Read-Only References:** `README.md` (Wave 1 output), `.planning/CLEAR-POLICY.md`, `src/lib/display.cjs` (renderFooter), `technical_documentation.md`

---

## Task 1: Add Session Management Section to DOCS.md

**File:** `DOCS.md`

**Action:** Insert a new "Session Management" section between the existing "Installation" section (ends at line 58 with the setup.md link) and the "Core Lifecycle" section (starts at line 62). This is the primary /clear integration point for DOCS.md.

### New Section: `## Session Management`

Content to include:

**Why /clear matters:**
- RAPID commands spawn specialized agents that consume significant context. After each command completes, the context window is filled with agent output, planning artifacts, and execution logs.
- Running `/clear` between commands resets the context window so the next command starts fresh, focused on its own task rather than carrying stale context from the previous step.
- This is the core mechanism that prevents context rot -- the degradation that occurs when too much prior conversation competes for the model's attention.

**The footer box:**
- After every lifecycle command that produces artifacts, RAPID displays a bordered box containing:
  - "Run /clear before continuing"
  - The suggested next command (e.g., "Next: /rapid:plan-set 1")
  - An optional progress breadcrumb showing the current stage
- This footer is produced by `renderFooter()` in `src/lib/display.cjs`

**Which commands show the footer (17 of 28):**
- All core lifecycle commands: init, start-set, discuss-set, plan-set, execute-set, review, merge
- Review sub-pipeline: unit-test, bug-hunt, uat
- Project management: new-version, add-set
- Generation: scaffold, audit-version, branding, documentation, quick, bug-fix

**Which commands do NOT show the footer (10 of 28):**
- Informational: help, status, assumptions
- Setup/maintenance: install, cleanup, pause, resume, context, migrate, register-web
- Rationale: these commands produce no artifacts and consume minimal context, so /clear after them is unnecessary

**The pattern in practice:**
- Show a brief example sequence (3 commands) with /clear between each:
  ```
  /rapid:start-set 1
  /clear
  /rapid:discuss-set 1
  /clear
  /rapid:plan-set 1
  ```
- Note: "If you skip /clear, RAPID still works -- but command quality degrades as the session gets longer. The footer is a strong recommendation, not a hard gate."

**Cross-reference:**
- Add a note: "For the technical specification of which skills include footers and why, see the CLEAR-POLICY in the planning directory."
- Do NOT link to CLEAR-POLICY.md directly from DOCS.md (per CONTEXT.md decision). The cross-reference to CLEAR-POLICY.md belongs in `technical_documentation.md`, which is handled by a separate note at the end of this task.

**What NOT to do:**
- Do not hardcode the exact Unicode box characters (they vary based on NO_COLOR env var)
- Do not list every single command with its specific "Next:" suggestion -- that level of detail belongs in CLEAR-POLICY.md
- Do not modify any existing section of DOCS.md in this task

**Verification:**
```bash
grep -q "## Session Management" DOCS.md && echo "PASS: session management section exists" || echo "FAIL"
grep -q "/clear" DOCS.md && echo "PASS: /clear referenced" || echo "FAIL"
grep -q "renderFooter" DOCS.md && echo "PASS: renderFooter referenced" || echo "FAIL"
grep -q "context rot" DOCS.md && echo "PASS: context rot explained" || echo "FAIL"
```

---

## Task 2: Migrate "How It Works" Prose to DOCS.md Architecture Overview

**File:** `DOCS.md`

**Action:** The "How It Works" prose was removed from README.md in Wave 1. Migrate it to the existing "Architecture Overview" section in DOCS.md (currently at line 436). Insert the prose BEFORE the existing "Agent Dispatch" subsection, as a new subsection called "### How It Works".

### Content to migrate (adapted from old README lines 80-96):

The following prose was in the old README under "How It Works". Adapt it slightly for DOCS.md context (it is now in a reference document, not an intro document):

- **Research pipeline.** `/rapid:init` runs a structured discovery conversation, spawns 6 parallel researchers (stack, features, architecture, pitfalls, oversights, UX) to analyze the project, synthesizes findings, and generates a roadmap with sets.
- **Isolation.** `/rapid:start-set` creates a dedicated git worktree per set so each agent works in its own copy of the repo.
- **Discussion.** `/rapid:discuss-set` captures implementation vision and design decisions into CONTEXT.md before planning begins.
- **Interface contracts.** Sets connect through `CONTRACT.json` -- machine-verifiable specs defining which functions, types, and endpoints each set exposes. Contracts are validated after planning, during execution, and before merge.
- **Planning.** `/rapid:plan-set` runs researcher, planner, and verifier agents to produce per-wave PLAN.md files.
- **Execution.** `/rapid:execute-set` runs one executor per wave with atomic commits and artifact-based crash recovery.
- **Review pipeline.** Four sequential stages: scoping, unit tests, adversarial bug hunt (hunter/advocate/judge, up to 3 rounds), and acceptance testing.
- **Merge.** `/rapid:merge` detects conflicts at 5 levels and resolves them through a confidence cascade.

Present this as a flowing narrative with bold topic labels (matching the format above), NOT as a bulleted list or table. This preserves the original README style.

**What NOT to do:**
- Do not duplicate content that already exists in the Architecture Overview section (Agent Dispatch, State Machine, Data Flow subsections are already there)
- Do not remove or modify the existing Architecture Overview subsections
- Do not add this content to any section other than Architecture Overview

**Verification:**
```bash
grep -q "### How It Works" DOCS.md && echo "PASS: How It Works migrated" || echo "FAIL"
grep -q "Research pipeline" DOCS.md && echo "PASS: content migrated" || echo "FAIL"
```

---

## Task 3: Fix Node.js Version and Update Version Badge in DOCS.md

**File:** `DOCS.md`

**Action:** Fix two known inaccuracies:

1. **Node.js version requirement:** Line 55 currently says "Node.js 20+" -- change to "Node.js 22+". The actual requirement is 22+ as enforced by `package.json` engines field and `src/bin/rapid-tools.cjs` prereqs check.

2. **Version badge/header:** The version at line 5 says "6.0.0". Verify this matches `package.json` version. If package.json says 6.0.0, leave it. If it differs, update DOCS.md to match.

3. **Table of Contents update:** Add "Session Management" to the Table of Contents, positioned after "Installation" and before "Core Lifecycle". The anchor should be `#session-management`. The TOC entry should be:
   ```
   - [Session Management](#session-management) -- /clear pattern, footer behavior, context hygiene
   ```

**What NOT to do:**
- Do not change any other version numbers or requirements
- Do not reformat the existing Requirements section beyond the version fix

**Verification:**
```bash
# Node.js version is correct
grep "Node.js 20" DOCS.md && echo "FAIL: still says 20" || echo "PASS: 20 reference removed"
grep -q "Node.js 22" DOCS.md && echo "PASS: says 22+" || echo "FAIL: 22 not found"
# TOC updated
grep -q "Session Management" DOCS.md && echo "PASS: TOC updated" || echo "FAIL"
```

---

## Task 4: Update Help Skill Output

**File:** `skills/help/SKILL.md`

**Action:** Update the help skill output for consistency with the rewritten README and current command set. This file has `disable-model-invocation: true`, which means every character is outputted verbatim -- changes must be exact final text.

### Changes required:

**1. Add /clear to the workflow diagram (lines 23-31):**
- Insert `/clear` annotations between steps in the ASCII workflow diagram. Update the diagram to show:
  ```
  INIT -> /clear -> START-SET -> /clear -> DISCUSS-SET -> /clear -> PLAN-SET -> /clear -> EXECUTE-SET -> /clear -> REVIEW -> /clear -> MERGE
  ```
  The exact formatting of the multi-line diagram needs to accommodate the /clear additions while remaining readable. If the single-line version becomes too wide, use a two-line or stacked format.

**2. Add /clear tip line:**
- After the workflow diagram, before the "7 Core Lifecycle Commands" table, add:
  ```
  > Tip: Run /clear between every command. Each RAPID step works best with a fresh context window.
  ```

**3. Fix stale "Phase 44" note (line 61):**
- Remove "(Phase 44 -- not yet available)" from the add-set description
- Replace with: "Add sets mid-milestone with discovery and contract generation"

**4. Add missing commands:**
- The current help output is missing 7 commands that exist in DOCS.md. Add them to the appropriate sections:
  - `documentation` -- Generate and update project documentation
  - `bug-fix` -- Investigate and fix bugs with targeted agents
  - `migrate` -- Migrate .planning/ state from older RAPID versions
  - `scaffold` -- Generate project-type-aware foundation files
  - `branding` -- Conduct structured branding interview
  - `audit-version` -- Audit completed milestone for gaps
  - `register-web` -- Register project with Mission Control dashboard

  Add these to a new section between "Kept Utilities" and "Typical Workflow":
  ```
  ## Additional Commands

  | Command | Description |
  |---------|-------------|
  | `/rapid:documentation` | Generate and update project documentation |
  | `/rapid:bug-fix` | Investigate and fix bugs with targeted agents |
  | `/rapid:migrate` | Migrate .planning/ state from older versions |
  | `/rapid:scaffold` | Generate project-type-aware foundation files |
  | `/rapid:branding` | Conduct structured branding interview |
  | `/rapid:audit-version` | Audit completed milestone for delivery gaps |
  | `/rapid:register-web` | Register project with Mission Control dashboard |
  ```

**5. Update the "Typical Workflow" section:**
- Add `/clear` between every step in the workflow listing, matching the README quickstart pattern
- Change step 4 from "Capture vision for each wave in the set" to "Capture your implementation vision and design decisions"
- This matches the README language

**6. Update the footer line:**
- Change from `7+3+4 commands` to `28 commands` for accuracy (7 core + 3 review + 4 auxiliary + 7 additional + 5 kept utilities + 1 meta + 1 help = 28)
- Keep: `RAPID v6.0.0 | 28 commands | Rapid Agentic Parallelizable and Isolatable Development`

**What NOT to do:**
- Do not change the YAML frontmatter (description and disable-model-invocation fields)
- Do not add any instructional preamble text -- the existing "You are the RAPID help command" instructions must stay
- Do not remove any existing commands from any table
- Do not reorder existing sections beyond what is specified

**Verification:**
```bash
# /clear in workflow diagram
grep -q "/clear" skills/help/SKILL.md && echo "PASS: /clear in help output" || echo "FAIL"
# Phase 44 removed
grep -q "Phase 44" skills/help/SKILL.md && echo "FAIL: stale Phase 44 reference" || echo "PASS: Phase 44 removed"
# Missing commands added
grep -q "documentation" skills/help/SKILL.md && echo "PASS: documentation command present" || echo "FAIL"
grep -q "bug-fix" skills/help/SKILL.md && echo "PASS: bug-fix command present" || echo "FAIL"
grep -q "migrate" skills/help/SKILL.md && echo "PASS: migrate command present" || echo "FAIL"
grep -q "scaffold" skills/help/SKILL.md && echo "PASS: scaffold command present" || echo "FAIL"
grep -q "branding" skills/help/SKILL.md && echo "PASS: branding command present" || echo "FAIL"
grep -q "audit-version" skills/help/SKILL.md && echo "PASS: audit-version command present" || echo "FAIL"
grep -q "register-web" skills/help/SKILL.md && echo "PASS: register-web command present" || echo "FAIL"
# 28 commands count
grep -q "28 commands" skills/help/SKILL.md && echo "PASS: command count updated" || echo "FAIL"
```

---

## Success Criteria

1. DOCS.md has a new "Session Management" section between Installation and Core Lifecycle
2. Session Management explains why /clear matters, which commands show the footer, and which do not
3. "How It Works" prose is migrated to DOCS.md Architecture Overview section
4. Node.js version in DOCS.md says 22+ (not 20+)
5. Session Management appears in the DOCS.md Table of Contents
6. Help skill workflow diagram includes /clear between steps
7. Help skill has a /clear tip line
8. "Phase 44 -- not yet available" is removed from help skill
9. All 7 missing commands are added to help skill
10. Help skill footer line says "28 commands"
11. No emoji anywhere in either file
