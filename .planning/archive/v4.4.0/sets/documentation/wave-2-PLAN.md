# PLAN: documentation / Wave 2 -- DOCS.md Rewrite and docs/ Updates

## Objective

Rewrite DOCS.md as the comprehensive workflow reference covering all 28 skills in lifecycle order, serving as a hub that links to detailed docs/ files. Update all existing docs/ files to reflect v4.4.0 state and add breadcrumb headers. Create docs/auxiliary.md for non-lifecycle commands. Fill empty CHANGELOG.md stubs.

## Source of Truth

- Each skill's `skills/*/SKILL.md` is the canonical source for command descriptions
- Agent files in `agents/` are the canonical source for agent names and counts
- ROADMAP.md and its archive are the canonical source for changelog entries

## Tasks

### Task 1: Rewrite DOCS.md

**File:** `DOCS.md`

**Action:** Complete rewrite. The new DOCS.md is a hub-and-spoke index organized in workflow order.

**Structure:**

1. **Header:** Update version to 4.4.0. Update agent count to 27. Remove the reference to `technical_documentation.md`. Add a note that DOCS.md is the central reference hub.

2. **Table of Contents:** Organize by lifecycle phase, with links to both inline sections and docs/ files:
   - Installation (link to docs/setup.md)
   - Core Lifecycle: init, start-set, discuss-set, plan-set, execute-set, review, merge
   - Review Pipeline: unit-test, bug-hunt, uat
   - Auxiliary: status, install, new-version, add-set
   - Utilities: all 14 utility skills
   - Architecture Overview (link to docs/agents.md, docs/state-machines.md)
   - Configuration (link to docs/configuration.md)
   - Troubleshooting (link to docs/troubleshooting.md)
   - Changelog (link to docs/CHANGELOG.md)

3. **Per-command sections:** For each of the 28 skills, provide:
   - Command syntax with arguments
   - 2-3 sentence behavioral description (what it does, what it produces)
   - One usage example (command invocation only, no output transcripts)
   - Link to the relevant docs/ file for full details
   - Read the corresponding `skills/*/SKILL.md` to extract accurate descriptions

4. **Commands are grouped by lifecycle phase:**
   - **Getting Started:** install, init
   - **Set Lifecycle:** start-set, discuss-set, plan-set, execute-set
   - **Review Pipeline:** review, unit-test, bug-hunt, uat
   - **Integration:** merge
   - **Project Management:** status, new-version, add-set
   - **Workflow Helpers:** pause, resume, quick, bug-fix, assumptions
   - **Analysis & Generation:** context, documentation, scaffold, audit-version, branding, migrate
   - **Reference:** help, cleanup, register-web

5. **Architecture Overview section:** Keep but update to reference 27 agents. Simplify -- this is a summary pointing to docs/agents.md for details.

6. **File Structure section:** Update the tree to include all 28 skill directories (just list them, don't expand each).

7. **Practical Tips section:** Keep and update. Fix the review section to reflect split review pipeline.

8. **Deprecated Commands section:** Keep as-is -- the v2 deprecation table is still valid.

9. **Remove** the "Further Reading" reference to `technical_documentation.md`.

**What NOT to do:**
- Do not include full SKILL.md content -- keep descriptions to 2-3 sentences
- Do not include output transcripts or multi-command workflow examples
- Do not duplicate the README quickstart

**Verification:**
```bash
# All 28 skills mentioned
for skill in add-set assumptions audit-version branding bug-fix bug-hunt cleanup context discuss-set documentation execute-set help init install merge migrate new-version pause plan-set quick register-web resume review scaffold start-set status uat unit-test; do
  grep -q "$skill" DOCS.md || echo "MISSING: $skill"
done
# Version updated
grep -q "4.4.0" DOCS.md
# No technical_documentation.md reference
! grep -q "technical_documentation.md" DOCS.md
```

### Task 2: Update docs/setup.md

**File:** `docs/setup.md`

**Action:** Add breadcrumb header. Update content to reflect current installation methods. Read `skills/install/SKILL.md` for current install behavior.

**Breadcrumb header (first line):** `[DOCS.md](../DOCS.md) > Setup`

**Content updates:**
- Ensure plugin marketplace install is primary method
- Ensure git clone method is documented
- Ensure requirements list Node.js 18+, git 2.30+
- Reference `/rapid:install` for shell configuration

**Verification:**
```bash
head -1 docs/setup.md | grep -q "DOCS.md"
```

### Task 3: Update docs/planning.md

**File:** `docs/planning.md`

**Action:** Add breadcrumb header. Update to cover the full planning lifecycle: init, discuss-set, plan-set. Read `skills/init/SKILL.md`, `skills/discuss-set/SKILL.md`, `skills/plan-set/SKILL.md` for current behavior.

**Breadcrumb header:** `[DOCS.md](../DOCS.md) > Planning`

**Content updates:**
- Ensure init section describes the 6-researcher pipeline and roadmapper
- Ensure discuss-set covers the `--skip` flag and 4-gray-area discovery
- Ensure plan-set covers the 3-step pipeline (researcher, planner, verifier)
- Update any stale agent counts or version references

**Verification:**
```bash
head -1 docs/planning.md | grep -q "DOCS.md"
grep -q "discuss-set" docs/planning.md
```

### Task 4: Update docs/execution.md

**File:** `docs/execution.md`

**Action:** Add breadcrumb header. Update to reflect current execute-set behavior. Read `skills/execute-set/SKILL.md`.

**Breadcrumb header:** `[DOCS.md](../DOCS.md) > Execution`

**Content updates:**
- Ensure crash recovery description is current (WAVE-COMPLETE.md markers + git commit verification)
- Ensure per-wave executor + verifier agent count is accurate
- Add mention of the pause/resume workflow for interrupted execution

**Verification:**
```bash
head -1 docs/execution.md | grep -q "DOCS.md"
```

### Task 5: Update docs/review.md

**File:** `docs/review.md`

**Action:** Add breadcrumb header. CRITICAL UPDATE: The review pipeline has been split into 4 separate skills since this file was written. Update to reflect the current architecture.

**Breadcrumb header:** `[DOCS.md](../DOCS.md) > Review`

**Content updates:**
- `/rapid:review` now ONLY scopes the review (produces REVIEW-SCOPE.md)
- `/rapid:unit-test` is a separate skill for unit test generation and execution
- `/rapid:bug-hunt` is a separate skill for the adversarial bug hunting cycle
- `/rapid:uat` is a separate skill for acceptance testing
- Document each of the 4 skills with their own subsection
- Read `skills/review/SKILL.md`, `skills/unit-test/SKILL.md`, `skills/bug-hunt/SKILL.md`, `skills/uat/SKILL.md` for current behavior

**Verification:**
```bash
head -1 docs/review.md | grep -q "DOCS.md"
grep -q "unit-test" docs/review.md
grep -q "bug-hunt" docs/review.md
grep -q "uat" docs/review.md
```

### Task 6: Update docs/merge-and-cleanup.md

**File:** `docs/merge-and-cleanup.md`

**Action:** Add breadcrumb header. Update merge documentation. Read `skills/merge/SKILL.md` and `skills/cleanup/SKILL.md`.

**Breadcrumb header:** `[DOCS.md](../DOCS.md) > Merge & Cleanup`

**Content updates:**
- Ensure 5-level conflict detection and 4-tier resolution cascade are accurately described
- Ensure cleanup documents safety checks and branch deletion confirmation
- Update any stale references

**Verification:**
```bash
head -1 docs/merge-and-cleanup.md | grep -q "DOCS.md"
```

### Task 7: Update docs/agents.md

**File:** `docs/agents.md`

**Action:** Add breadcrumb header. Update agent count from 26 to 27. Add `rapid-auditor` which was added in v4.2.1.

**Breadcrumb header:** `[DOCS.md](../DOCS.md) > Agents`

**Content updates:**
- Update all references from "26 agents" to "27 agents"
- Add `rapid-auditor` to the agent list in the appropriate category (Utility)
- Verify every agent in `agents/` directory has an entry
- Cross-reference `agents/` directory listing: rapid-auditor, rapid-bugfix, rapid-bug-hunter, rapid-codebase-synthesizer, rapid-conflict-resolver, rapid-context-generator, rapid-devils-advocate, rapid-executor, rapid-judge, rapid-merger, rapid-planner, rapid-plan-verifier, rapid-research-architecture, rapid-research-features, rapid-research-oversights, rapid-research-pitfalls, rapid-research-stack, rapid-research-synthesizer, rapid-research-ux, rapid-reviewer, rapid-roadmapper, rapid-scoper, rapid-set-merger, rapid-set-planner, rapid-uat, rapid-unit-tester, rapid-verifier

**Verification:**
```bash
head -1 docs/agents.md | grep -q "DOCS.md"
grep -q "27" docs/agents.md
grep -q "auditor" docs/agents.md
```

### Task 8: Update docs/state-machines.md

**File:** `docs/state-machines.md`

**Action:** Add breadcrumb header. Verify state machine documentation is current.

**Breadcrumb header:** `[DOCS.md](../DOCS.md) > State Machines`

**Content updates:**
- Verify the set lifecycle states are correct: pending -> discussing -> planning -> executing -> complete -> merged
- Verify reviewing state is documented if it exists in the current state machine
- Update any stale references
- Read `skills/review/SKILL.md` to check if review has its own state (it should show complete -> reviewing -> merged or similar)

**Verification:**
```bash
head -1 docs/state-machines.md | grep -q "DOCS.md"
```

### Task 9: Update docs/troubleshooting.md

**File:** `docs/troubleshooting.md`

**Action:** Add breadcrumb header. Review for stale content.

**Breadcrumb header:** `[DOCS.md](../DOCS.md) > Troubleshooting`

**Content updates:**
- Ensure all referenced commands still exist
- Add troubleshooting entries for common v4.x issues if any are evident from the codebase
- Ensure RAPID_TOOLS troubleshooting is current

**Verification:**
```bash
head -1 docs/troubleshooting.md | grep -q "DOCS.md"
```

### Task 10: Update docs/configuration.md

**File:** `docs/configuration.md`

**Action:** Add breadcrumb header. Update configuration reference.

**Breadcrumb header:** `[DOCS.md](../DOCS.md) > Configuration`

**Content updates:**
- Verify config.json schema documentation is current
- Verify environment variables (RAPID_TOOLS, NO_COLOR) are documented
- Add any new configuration options from v4.x

**Verification:**
```bash
head -1 docs/configuration.md | grep -q "DOCS.md"
```

### Task 11: Update docs/CHANGELOG.md

**File:** `docs/CHANGELOG.md`

**Action:** Fill empty v4.2.1 and v4.3.0 stubs. Add v4.4.0 entry.

**Content updates:**
- **v4.4.0 (in progress):** Document the 3 sets: colouring, review-state, documentation
- **v4.3.0:** Read `.planning/archive/v4.3.0/` to find set details. Add 2-3 bullet highlights.
- **v4.2.1:** Read `.planning/archive/v4.2.1/` to find set details. Add 2-3 bullet highlights. Key addition: rapid-auditor agent, /rapid:audit-version skill.
- **v4.1.0:** Verify existing entry is complete.

**Verification:**
```bash
# v4.2.1 and v4.3.0 stubs are no longer empty
grep -A 2 "v4.2.1" docs/CHANGELOG.md | grep -q "Added\|Changed\|Fixed"
grep -A 2 "v4.3.0" docs/CHANGELOG.md | grep -q "Added\|Changed\|Fixed"
```

### Task 12: Create docs/auxiliary.md

**File:** `docs/auxiliary.md` (NEW FILE)

**Action:** Create a new file documenting non-lifecycle commands that do not fit naturally into existing docs/ files.

**Breadcrumb header:** `[DOCS.md](../DOCS.md) > Auxiliary Commands`

**Commands to cover (read each skill's SKILL.md for descriptions):**
- `/rapid:branding` -- Optional branding customization
- `/rapid:scaffold` -- Project scaffold generation
- `/rapid:audit-version` -- Version audit and validation
- `/rapid:migrate` -- Version migration tooling
- `/rapid:register-web` -- Register project with web dashboard
- `/rapid:bug-fix` -- Targeted bug investigation and fixing
- `/rapid:quick` -- Ad-hoc changes without set structure
- `/rapid:add-set` -- Add sets mid-milestone
- `/rapid:documentation` -- Agent-driven documentation generation

**Format per command:**
- Command name and syntax
- 2-3 sentence description of what it does
- When to use it (workflow context)
- Link back to DOCS.md

**Verification:**
```bash
test -f docs/auxiliary.md
head -1 docs/auxiliary.md | grep -q "DOCS.md"
grep -q "branding" docs/auxiliary.md
grep -q "scaffold" docs/auxiliary.md
grep -q "audit-version" docs/auxiliary.md
```

## Success Criteria

- DOCS.md covers all 28 skills with accurate descriptions
- DOCS.md version is 4.4.0, agent count is 27
- All 10 existing docs/ files have breadcrumb headers
- docs/auxiliary.md exists with documentation for 9 non-lifecycle commands
- docs/review.md reflects the 4-skill split review architecture
- docs/agents.md lists 27 agents including rapid-auditor
- docs/CHANGELOG.md has non-empty entries for v4.2.1, v4.3.0, and v4.4.0
- No references to `technical_documentation.md` in any docs/ file
- No stale "26 agents" references
