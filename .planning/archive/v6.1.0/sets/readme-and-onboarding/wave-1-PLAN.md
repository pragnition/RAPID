# PLAN: readme-and-onboarding -- Wave 1

**Objective:** Rewrite README.md from scratch as a beginner-friendly onboarding document. The current README jumps straight into features without explaining what problem RAPID solves. The rewrite leads with context rot, presents one unambiguous install path, introduces the /clear mental model, provides an annotated quickstart with /clear interleaved, adds a First Project walkthrough, and preserves existing architecture diagrams, command reference, credits, and links.

**Owned Files:** `README.md`

**Read-Only References:** `.planning/CLEAR-POLICY.md`, `src/lib/display.cjs` (renderFooter), `branding/*.svg`, `DOCS.md` (for cross-reference accuracy)

---

## Task 1: Rewrite README.md -- Opening, Problem Statement, and Install

**File:** `README.md`

**Action:** Replace the entire file with a new structure. Preserve the banner SVG, badge block, and beta notice at the top. Then restructure as follows:

### Section 1: Banner + Badges (preserve existing)
- Keep `branding/banner-github.svg` centered
- Keep all four badges (version 6.0.0, MIT license, Claude Code plugin, Node.js 22+) with Everforest color scheme (`d3c6aa`, `2d353b`, `a7c080`)
- Keep the beta NOTE callout

### Section 2: Opening Hook (NEW -- replaces the current blockquote)
- Use hook-then-pivot approach: open with a relatable scenario about being deep in a Claude session and the model starts repeating itself or forgetting earlier decisions
- Pivot to: "That's context rot" -- one technical sentence explaining that as the context window fills, the model loses grip on earlier decisions and artifacts
- Then: "RAPID solves this" -- one sentence explaining that RAPID structures work into isolated sets with /clear between every command, so each step gets a fresh context window focused on exactly what matters
- Use narrative contrast (before/after woven into the story), NOT a comparison table
- Keep this section to 8-12 lines total. Do NOT use a heading for this -- it flows directly below the badges/beta notice as the first prose the reader encounters

### Section 3: `## Install` (rewrite)
- Single primary install path prominently displayed:
  ```
  claude plugin add pragnition/RAPID
  ```
- Immediately below: `/rapid:install` as the follow-up step to configure the environment
- Single prerequisite line: "Requires Node.js 22+"
- Do NOT show the old `pragnition/pragnition-public-plugins` path -- that is incorrect
- Do NOT show the git clone alternative here -- link to DOCS.md for alternative install methods
- The current README has contradictory install commands (`rapid@pragnition/pragnition-public-plugins` vs the correct `pragnition/RAPID`). The correct path is `claude plugin add pragnition/RAPID` as shown in DOCS.md

### Section 4: `## The /clear Mental Model` (NEW)
- 2-3 sentence explanation: after every RAPID command that produces artifacts, a box appears telling you to run `/clear` and what command comes next. This is intentional -- clearing context between steps keeps each command focused and prevents the degradation that ruins long sessions.
- Describe the box generically: "a box appears after each command with a /clear reminder and the suggested next step" -- do NOT hardcode the exact Unicode box characters
- Mention that 17 of 28 commands show this footer; informational commands like `/rapid:status` and `/rapid:help` do not
- End with a single-line callout: "Throughout this README, you will see `/clear` between every command. This is the pattern."

**What NOT to do:**
- Do not include any content after the /clear Mental Model section in this task -- the quickstart, walkthrough, and remaining sections come in subsequent tasks
- Do not remove the closing `</p>` tags from the centered banner/badge HTML
- Do not change badge colors or version numbers
- Do not use emoji anywhere

**Verification:**
```bash
# File exists and has the new structure
head -60 README.md | grep -q "context rot" && echo "PASS: problem statement present" || echo "FAIL"
head -60 README.md | grep -q "claude plugin add pragnition/RAPID" && echo "PASS: correct install path" || echo "FAIL"
head -60 README.md | grep -q "/clear" && echo "PASS: /clear mental model present" || echo "FAIL"
# Old broken install path is gone
grep -q "pragnition-public-plugins" README.md && echo "FAIL: old install path still present" || echo "PASS: old install path removed"
```

---

## Task 2: Add Annotated Quickstart with /clear Interleaved

**File:** `README.md`

**Action:** Append the annotated quickstart section after the /clear Mental Model section.

### Section 5: `## Quickstart` (rewrite of "60-Second Quickstart")
- Show the full lifecycle as a numbered list (not a code block), with each command on its own line followed by a 1-line annotation and `/clear` between every step
- Format each step as:

```
1. **`/rapid:init`** -- Research your project, generate a roadmap, decompose work into sets
   > /clear

2. **`/rapid:start-set 1`** -- Create an isolated worktree for the first set
   > /clear

3. **`/rapid:discuss-set 1`** -- Capture your implementation vision and design decisions
   > /clear

4. **`/rapid:plan-set 1`** -- Research, produce wave-level plans, validate contracts
   > /clear

5. **`/rapid:execute-set 1`** -- Execute all planned waves with parallel agents
   > /clear

6. **`/rapid:review 1`** -- Scope the set for review (then optionally: unit-test, bug-hunt, uat)
   > /clear

7. **`/rapid:merge`** -- Integrate the completed set into main
   > /clear
```

- After the list, add a brief note: "Each command spawns specialized agents, produces artifacts, and advances the set through its lifecycle. The `/clear` between each step is not optional -- it is what keeps the whole system working."
- Add the existing solo mode TIP callout: "RAPID does not confine you to parallel development. Pass `--solo` to any command to work without worktrees."

**What NOT to do:**
- Do not include review sub-commands (unit-test, bug-hunt, uat) as separate numbered steps -- mention them parenthetically in step 6
- Do not include `/rapid:audit-version` or `/rapid:new-version` in the quickstart -- those are advanced commands
- Do not use a single code block for all commands -- the numbered list format with annotations is essential

**Verification:**
```bash
# Count /clear references in quickstart
grep -c "/clear" README.md | awk '{print ($1 >= 7) ? "PASS: sufficient /clear references" : "FAIL: not enough /clear references"}'
# Quickstart section exists
grep -q "## Quickstart" README.md && echo "PASS: quickstart section exists" || echo "FAIL"
```

---

## Task 3: Add First Project Walkthrough

**File:** `README.md`

**Action:** Append the First Project walkthrough section after the Quickstart.

### Section 6: `## Your First Project` (NEW)
- Target audience: someone who has never used an AI agent harness
- Use an abstract/generic project (no specific tech stack)
- Each step gets 2-3 lines explaining what happens and what to expect
- Total section length: approximately 40 lines
- Structure:

**Step 1: Install RAPID**
- Run the install command from the Install section
- Run `/rapid:install` to configure your environment
- Mention what install does (configures RAPID_TOOLS env var, builds agent files)
- /clear

**Step 2: Initialize your project**
- Navigate to your project directory in Claude Code
- Run `/rapid:init`
- Explain: RAPID will ask you questions about your project, then spawn 6 research agents in parallel to analyze it. You will be presented with a roadmap of sets (independent workstreams). Approve or adjust the roadmap.
- /clear

**Step 3: Start your first set**
- Run `/rapid:start-set 1`
- Explain: This creates an isolated copy of your repo (a git worktree) where the first set's work will happen. No changes touch your main branch until merge.
- /clear

**Step 4: Discuss implementation**
- Run `/rapid:discuss-set 1`
- Explain: RAPID identifies design decisions where multiple valid approaches exist and asks for your input. Your answers are recorded so the planner knows your intent.
- /clear

**Step 5: Plan**
- Run `/rapid:plan-set 1`
- Explain: A researcher investigates your codebase, a planner produces task-level plans for each wave, and a verifier checks for gaps. You get PLAN.md files you can review.
- /clear

**Step 6: Execute**
- Run `/rapid:execute-set 1`
- Explain: One executor agent per wave implements the planned tasks with atomic commits. If something goes wrong, re-running the command resumes from where it left off.
- /clear

**Step 7: Review and merge**
- Run `/rapid:review 1` followed by `/rapid:merge`
- Explain: Review scopes the changed files, and merge integrates the set branch into main with conflict detection.
- /clear

- End with: "That is the full cycle for one set. In a real project, multiple sets run in parallel -- each developer owns a set end-to-end, and RAPID handles the coordination."

**What NOT to do:**
- Do not reference any specific programming language, framework, or project type
- Do not include code snippets beyond the RAPID commands themselves
- Do not go over ~45 lines for this section
- Do not skip the /clear annotation between steps

**Verification:**
```bash
grep -q "## Your First Project" README.md && echo "PASS: walkthrough section exists" || echo "FAIL"
grep -q "rapid:init" README.md && grep -q "rapid:merge" README.md && echo "PASS: full lifecycle covered" || echo "FAIL"
```

---

## Task 4: Add Architecture, Command Reference, and Remaining Sections

**File:** `README.md`

**Action:** Append the remaining sections after the First Project walkthrough.

### Section 7: `## Architecture` (preserve existing)
- Keep both SVG diagrams centered:
  - `branding/lifecycle-flow.svg` (RAPID Lifecycle Flow)
  - `branding/agent-dispatch.svg` (Agent Dispatch Architecture)
- Do NOT include the "How It Works" prose that currently follows the diagrams -- that prose is being migrated to DOCS.md in Wave 2
- Add a single line below the diagrams: "For a detailed explanation of how each stage works, see [DOCS.md](DOCS.md#architecture-overview)."

### Section 8: `## Command Reference` (preserve existing table + expand)
- Keep the existing 7-command table format
- Keep the "See DOCS.md for the full reference covering all 28 commands" link below

### Section 9: `## Changelog` (preserve existing)
- Keep the existing format with link to docs/CHANGELOG.md

### Section 10: `## Documentation` (preserve existing)
- Keep the three-link format pointing to DOCS.md, technical_documentation.md, and docs/

### Section 11: `## Credits` (preserve existing verbatim)
- Keep the exact text about GSD and OpenSpec
- Keep the humanlayer article reference

### Section 12: `## Links` (preserve existing)
- Keep Contributing Guide and License links

**What NOT to do:**
- Do not modify the credits text at all
- Do not add new sections beyond what is listed here
- Do not remove the SVG diagram references
- Do not move the "How It Works" prose into this file -- it goes to DOCS.md in Wave 2

**Verification:**
```bash
# SVG references preserved
grep -q "lifecycle-flow.svg" README.md && grep -q "agent-dispatch.svg" README.md && echo "PASS: SVGs preserved" || echo "FAIL"
# Command reference table exists
grep -q "## Command Reference" README.md && echo "PASS: command reference exists" || echo "FAIL"
# Credits preserved
grep -q "get-shit-done" README.md && echo "PASS: credits preserved" || echo "FAIL"
# How It Works prose is NOT in README
grep -q "Research pipeline" README.md && echo "FAIL: How It Works prose should be in DOCS.md" || echo "PASS: How It Works prose removed from README"
# Full file structure check
for section in "## Install" "## The /clear Mental Model" "## Quickstart" "## Your First Project" "## Architecture" "## Command Reference" "## Changelog" "## Documentation" "## Credits" "## Links"; do
  grep -q "$section" README.md && echo "PASS: $section exists" || echo "FAIL: $section missing"
done
```

---

## Success Criteria

1. README.md opens with a relatable hook about context rot, not a feature list
2. Single unambiguous install path: `claude plugin add pragnition/RAPID` followed by `/rapid:install`
3. The old broken install path (`pragnition/pragnition-public-plugins`) is completely removed
4. /clear mental model is explained before the quickstart
5. Quickstart shows `/clear` between every lifecycle command
6. "Your First Project" walkthrough exists with ~40 lines, no tech-stack assumptions
7. Architecture SVGs are preserved
8. "How It Works" prose is NOT in README (migrated to DOCS.md in Wave 2)
9. Credits section is verbatim unchanged
10. No emoji anywhere in the file
