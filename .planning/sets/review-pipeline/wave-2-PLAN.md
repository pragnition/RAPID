# Wave 2: Independent Review Skills -- /unit-test, /bug-hunt, /uat

## Objective

Create three new independently invocable skills that consume REVIEW-SCOPE.md (produced by Wave 1's `/review`) as their input. Each skill runs one stage of the review pipeline: unit testing, adversarial bug hunting, or user acceptance testing. The skills are standalone -- the user explicitly invokes whichever stage they want, in any order, without going through a stage-selection menu. Each skill validates that REVIEW-SCOPE.md exists before proceeding.

## Tasks

### Task 1: Create `skills/unit-test/SKILL.md`

**Files:** `skills/unit-test/SKILL.md` (new directory and file)

**Actions:**
1. Create `skills/unit-test/` directory.
2. Create `skills/unit-test/SKILL.md` with the full unit test skill.

3. The skill structure:

```
---
description: Run unit test pipeline on a scoped set -- reads REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion, Glob, Grep
---

# /rapid:unit-test -- Unit Test Pipeline
```

4. Steps:

**Step 0: Environment + Set Resolution**
- Same env preamble as `/review` (load RAPID_TOOLS, display banner for `unit-test`)
- Parse arguments: `/rapid:unit-test <set-id>` or numeric shorthand
- Resolve set reference using `node "${RAPID_TOOLS}" resolve set "<set-input>"`
- Detect `--post-merge` flag

**Step 1: Load REVIEW-SCOPE.md**
- Determine scope file path:
  - Standard: `.planning/sets/{setId}/REVIEW-SCOPE.md`
  - Post-merge: `.planning/post-merge/{setId}/REVIEW-SCOPE.md`
- If file does not exist, display clear error and stop:
  ```
  REVIEW-SCOPE.md not found for set '{setId}'.
  Run `/rapid:review {setId}` first to generate the review scope.
  ```
- Read the file. Parse SCOPE-META JSON block to extract metadata (setId, postMerge, worktreePath, totalFiles, useConcernScoping).
- If REVIEW-SCOPE.md has `postMerge: true`, set `POST_MERGE=true` regardless of CLI flag (scope file is authoritative).

**Step 2: Parse Scope Data**
- Parse the full REVIEW-SCOPE.md to extract:
  - Changed files (from `## Changed Files` section)
  - Dependent files (from `## Dependent Files` section)
  - Directory chunks (from `## Directory Chunks` section)
  - Concern scoping data (from `## Concern Scoping` section)
  - Acceptance criteria (from `## Acceptance Criteria` section)
- Build the concern groups or directory chunks for spawning agents.

**Step 3: Unit Test Plan Generation (same as old Step 4a.1)**
- If concern scoping is active: spawn one rapid-unit-tester per concern group (up to 5 concurrent). Each agent gets its concern group's files plus cross-cutting files. Sub-chunk if >15 files.
- If concern scoping fell back: spawn one rapid-unit-tester per directory chunk (or single agent for <=1 chunk).
- Collect test plans from all agents.

**Step 4: Present Test Plan for Approval (same as old Step 4a.2)**
- Present combined test plan grouped by chunk/concern.
- AskUserQuestion: Approve / Modify / Skip.

**Step 5: Execute Tests (same as old Step 4a.3)**
- Spawn rapid-unit-tester agents for execution phase.
- Merge results across chunks/concerns.

**Step 6: Write REVIEW-UNIT.md (same as old Step 4a.5)**
- Write to `.planning/sets/{setId}/REVIEW-UNIT.md` (standard) or `.planning/post-merge/{setId}/REVIEW-UNIT.md` (post-merge).
- Overwrite any existing REVIEW-UNIT.md (idempotent).

**Step 7: Log Issues (same as old Step 4a.6)**
- Log failed tests as issues using `review log-issue` CLI.
- Use `--post-merge` flag if in post-merge mode.

**Step 8: Completion Banner**
```
--- RAPID Unit Test Complete ---
Set: {setId}
Tests written: {testsWritten}
Tests passed: {testsPassed}
Tests failed: {testsFailed}

Artifact: {artifact path}

Suggest: node "${RAPID_TOOLS}" review summary {setId}
Next: /rapid:bug-hunt {setIndex} or /rapid:uat {setIndex}
---------------------------------
```

5. Important notes section at the bottom covering:
   - Each agent runs in its own context window (no sub-subagents)
   - Concern groups include cross-cutting files
   - Idempotent -- re-running overwrites REVIEW-UNIT.md
   - Uses `node --test` framework exclusively

**What NOT to do:**
- Do NOT include any stage selection prompting -- this skill runs unit tests only.
- Do NOT include bug hunt or UAT logic.
- Do NOT modify `src/lib/review.cjs` -- that was done in Wave 1.
- Do NOT include the concern scoping (scoper agent) step -- that was done by `/review` and is captured in REVIEW-SCOPE.md.

**Verification:**
```bash
# Skill file exists and is reasonable length
test -f skills/unit-test/SKILL.md && wc -l skills/unit-test/SKILL.md
# Expected: file exists, ~250-350 lines

# No stage selection references
grep -i "which review stages\|stage selection" skills/unit-test/SKILL.md
# Expected: zero matches

# References REVIEW-SCOPE.md
grep "REVIEW-SCOPE.md" skills/unit-test/SKILL.md
# Expected: multiple matches

# Has scope detection guard
grep -i "not found\|Run.*review" skills/unit-test/SKILL.md
# Expected: matches present
```

### Task 2: Create `skills/bug-hunt/SKILL.md`

**Files:** `skills/bug-hunt/SKILL.md` (new directory and file)

**Actions:**
1. Create `skills/bug-hunt/` directory.
2. Create `skills/bug-hunt/SKILL.md` with the full adversarial bug hunt skill.

3. The skill structure:

```
---
description: Run adversarial bug hunt on a scoped set -- reads REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion, Glob, Grep
---

# /rapid:bug-hunt -- Adversarial Bug Hunt Pipeline
```

4. Steps:

**Step 0: Environment + Set Resolution**
- Same as `/unit-test` Step 0.

**Step 1: Load REVIEW-SCOPE.md**
- Same scope detection guard as `/unit-test` Step 1.
- Same SCOPE-META parsing.

**Step 2: Parse Scope Data**
- Same scope parsing as `/unit-test` Step 2.
- Build concern groups or directory chunks.

**Step 3: Bug Hunt Cycle Loop (max 3 iterations)**
Migrate the full adversarial pipeline from old Steps 4b.1 through 4b.9:

**Step 3.1: Determine scope (old 4b.1)**
- Cycle 1: full scope with concern/chunk grouping
- Cycle 2+: narrow to modifiedFiles from previous bugfix cycle

**Step 3.2: Spawn bug-hunter agents (old 4b.2)**
- Concern-scoped: one rapid-bug-hunter per concern group (up to 5 concurrent), with concern-index prefixed finding IDs
- Fallback: one rapid-bug-hunter per directory chunk (or single agent)
- Cycles 2-3: single flat-scope hunter on modified files only

**Step 3.3: Merge and Deduplicate (old 4b.2.5)**
- Merge findings from all hunters
- Deduplicate using same-file + description similarity >0.7 (normalized Levenshtein)
- Use `node "${RAPID_TOOLS}"` CLI or inline logic

**Step 3.4: Zero findings check (old 4b.3)**
- If zero findings: print message and break loop

**Step 3.5: Spawn devils-advocate (old 4b.4)**
- ONE rapid-devils-advocate on merged findings

**Step 3.6: Spawn judge (old 4b.5)**
- ONE rapid-judge on findings + assessments
- Judge rulings must include leaning indicator (ACCEPTED/DISMISSED/DEFERRED with confidence)

**Step 3.7: Handle DEFERRED rulings (old 4b.6)**
- Present each deferred finding to user with evidence from both sides
- AskUserQuestion: Accept / Dismiss / Defer

**Step 3.8: Write REVIEW-BUGS.md (old 4b.7)**
- Write to `.planning/sets/{setId}/REVIEW-BUGS.md` or post-merge path
- Format must include judge leaning (ruling + confidence) for each finding per CONTRACT behavioral requirement `judgeLeaningVisible`
- Overwrite any existing REVIEW-BUGS.md (idempotent)

**Step 3.9: Spawn bugfix agent (old 4b.8)**
- Collect ACCEPTED bugs
- Spawn rapid-bugfix agent
- Track modifiedFiles for scope narrowing
- Log issues, update fixed statuses

**Step 3.10: After cycle 3 remaining bugs (old 4b.9)**
- Present remaining unfixed bugs to user
- Per-bug options: Fix manually / Defer / Dismiss

**Step 4: Completion Banner**
```
--- RAPID Bug Hunt Complete ---
Set: {setId}
Cycles: {cycle}
Accepted: {accepted}
Dismissed: {dismissed}
Deferred: {deferred}
Fixed: {fixed}
Unfixable: {unfixable}

Artifact: {artifact path}

Suggest: node "${RAPID_TOOLS}" review summary {setId}
Next: /rapid:unit-test {setIndex} or /rapid:uat {setIndex}
--------------------------------
```

5. Key behavioral requirements from CONTRACT:
   - `judgeLeaningVisible`: REVIEW-BUGS.md must include judge leaning (accept/reject/uncertain) with confidence for each finding. In the findings table, add a "Leaning" column or field showing the judge's disposition and confidence level.
   - `noStagePrompting`: No stage selection menu -- this skill runs bug hunt only.
   - `idempotentRerun`: Re-running overwrites REVIEW-BUGS.md cleanly.
   - `scopeRequired`: Guard at Step 1 detects missing REVIEW-SCOPE.md.

**What NOT to do:**
- Do NOT include unit test or UAT logic.
- Do NOT include stage selection prompting.
- Do NOT spawn the scoper agent -- concern scoping data comes from REVIEW-SCOPE.md.
- Do NOT modify any library files.

**Verification:**
```bash
# Skill file exists
test -f skills/bug-hunt/SKILL.md && wc -l skills/bug-hunt/SKILL.md
# Expected: file exists, ~400-500 lines (bug hunt is the largest stage)

# No stage selection
grep -i "which review stages\|stage selection" skills/bug-hunt/SKILL.md
# Expected: zero matches

# Has scope guard
grep -i "not found\|Run.*review" skills/bug-hunt/SKILL.md
# Expected: matches

# Judge leaning visible
grep -i "leaning\|confidence" skills/bug-hunt/SKILL.md
# Expected: matches (judge leaning format documented)

# REVIEW-SCOPE.md referenced
grep "REVIEW-SCOPE.md" skills/bug-hunt/SKILL.md
# Expected: multiple matches
```

### Task 3: Create `skills/uat/SKILL.md`

**Files:** `skills/uat/SKILL.md` (new directory and file)

**Actions:**
1. Create `skills/uat/` directory.
2. Create `skills/uat/SKILL.md` with the full UAT skill.

3. The skill structure:

```
---
description: Run user acceptance testing on a scoped set -- reads REVIEW-SCOPE.md
allowed-tools: Read, Write, Bash, Agent, AskUserQuestion, Glob, Grep
---

# /rapid:uat -- User Acceptance Testing
```

4. Steps:

**Step 0: Environment + Set Resolution**
- Same as `/unit-test` Step 0.

**Step 1: Load REVIEW-SCOPE.md**
- Same scope detection guard.
- Same SCOPE-META parsing.

**Step 2: Parse Scope Data**
- Parse changed files, dependent files, and acceptance criteria from REVIEW-SCOPE.md.
- UAT uses full scope (never concern-scoped or chunked -- UAT tests user workflows, not individual files).

**Step 3: Load Context for Test Scenarios**
- Read acceptance criteria from REVIEW-SCOPE.md (already parsed in Step 2).
- Optionally read CONTEXT.md from the set for design decisions that inform test scenarios.

**Step 4: Determine Browser Automation Tool (old 4c.2)**
- Check `.planning/config.json` for `browserAutomation` field.
- If not set, AskUserQuestion: Chrome DevTools MCP / Playwright MCP / Skip automated steps.

**Step 5: Spawn UAT Agent -- Test Plan Phase (old 4c.3)**
- Spawn rapid-uat with full set scope, acceptance criteria, browser config, working directory.
- Collect test plan via CHECKPOINT return.

**Step 6: Present Test Plan for Approval (old 4c.4)**
- Display test plan with automated/human tags.
- AskUserQuestion: Approve / Modify tags / Skip UAT.

**Step 7: Spawn UAT Agent -- Execution Phase (old 4c.5)**
- Re-invoke rapid-uat for execution.
- Handle CHECKPOINT returns for human verification steps.
- Collect final results.

**Step 8: Write REVIEW-UAT.md (old 4c.6)**
- Write to `.planning/sets/{setId}/REVIEW-UAT.md` or post-merge path.
- Overwrite any existing file (idempotent).

**Step 9: Log Failed Steps (old 4c.7)**
- Log failed UAT steps as issues.

**Step 10: Completion Banner**
```
--- RAPID UAT Complete ---
Set: {setId}
Steps passed: {stepsPassed}
Steps failed: {stepsFailed}
Steps skipped: {stepsSkipped}

Artifact: {artifact path}

Suggest: node "${RAPID_TOOLS}" review summary {setId}
Next: /rapid:unit-test {setIndex} or /rapid:bug-hunt {setIndex}
---------------------------
```

5. Key behavioral requirements:
   - UAT runs ONCE on the full set scope -- never chunked.
   - `noStagePrompting`: No stage selection.
   - `idempotentRerun`: Re-running overwrites REVIEW-UAT.md.
   - `scopeRequired`: Guard at Step 1.

**What NOT to do:**
- Do NOT include unit test or bug hunt logic.
- Do NOT chunk the scope -- UAT tests user workflows across the full set.
- Do NOT include stage selection.
- Do NOT modify any library files.

**Verification:**
```bash
# Skill file exists
test -f skills/uat/SKILL.md && wc -l skills/uat/SKILL.md
# Expected: file exists, ~250-350 lines

# No chunking logic
grep -i "chunks.length\|chunk " skills/uat/SKILL.md
# Expected: zero or minimal matches (UAT uses full scope)

# Has scope guard
grep -i "not found\|Run.*review" skills/uat/SKILL.md
# Expected: matches

# REVIEW-SCOPE.md referenced
grep "REVIEW-SCOPE.md" skills/uat/SKILL.md
# Expected: multiple matches
```

### Task 4: Update artifact path references in all new skills

**Files:** `skills/unit-test/SKILL.md`, `skills/bug-hunt/SKILL.md`, `skills/uat/SKILL.md`

**Actions:**
1. Verify that ALL artifact output paths in the three new skills use `.planning/sets/{setId}/` for standard mode and `.planning/post-merge/{setId}/` for post-merge mode. Research finding #1 identified that the old skill used `.planning/waves/{setId}/` which is incorrect.

2. Specifically check and correct any references to:
   - `.planning/waves/{setId}/` -> must be `.planning/sets/{setId}/`
   - REVIEW-UNIT.md path
   - REVIEW-BUGS.md path
   - REVIEW-UAT.md path
   - REVIEW-ISSUES.json path (via `review log-issue` CLI)

3. Verify that the `review summary` CLI command suggestion uses the correct set-id format.

**What NOT to do:**
- Do NOT change `.planning/post-merge/{setId}/` paths -- those are correct as-is.

**Verification:**
```bash
# Check no .planning/waves/ references in new skills
grep -r "planning/waves" skills/unit-test/ skills/bug-hunt/ skills/uat/
# Expected: zero matches

# Check correct paths are used
grep "planning/sets" skills/unit-test/SKILL.md skills/bug-hunt/SKILL.md skills/uat/SKILL.md
# Expected: matches in all three files
```

### Task 5: Update help skill command list

**Files:** `skills/help/SKILL.md`

**Actions:**
1. Add the three new commands to the command list table in the help skill:
   - `/rapid:unit-test` -- Run unit test pipeline (reads REVIEW-SCOPE.md)
   - `/rapid:bug-hunt` -- Run adversarial bug hunt (reads REVIEW-SCOPE.md)
   - `/rapid:uat` -- Run user acceptance testing (reads REVIEW-SCOPE.md)

2. Update the `/rapid:review` description from "Review completed sets -- orchestrates unit test, bug hunt, and UAT pipeline" to "Scope a completed set for review -- produces REVIEW-SCOPE.md".

3. Group the review-related commands together in the table (review, unit-test, bug-hunt, uat).

4. Update the total command count in the footer if one exists.

**What NOT to do:**
- Do NOT remove any existing non-deprecated commands from the list.
- Do NOT change the help skill's overall structure or format.

**Verification:**
```bash
grep -i "unit-test\|bug-hunt\|rapid:uat\|REVIEW-SCOPE" skills/help/SKILL.md
# Expected: matches for all three new commands and the updated review description
```

### Task 6: Final verification

**Files:** None modified (verification only)

**Actions:**
1. Verify all four skill files exist and are reasonable length:
   ```bash
   wc -l skills/review/SKILL.md skills/unit-test/SKILL.md skills/bug-hunt/SKILL.md skills/uat/SKILL.md
   ```
   Expected: review ~200-300, unit-test ~250-350, bug-hunt ~400-500, uat ~250-350.

2. Verify no old monolithic review logic remains:
   ```bash
   grep -c "Step 4a\|Step 4b\|Step 4c\|Stage Selection" skills/review/SKILL.md
   # Expected: 0
   ```

3. Verify REVIEW-SCOPE.md is the handoff artifact:
   ```bash
   for skill in unit-test bug-hunt uat; do
     echo "--- $skill ---"
     grep -c "REVIEW-SCOPE.md" skills/$skill/SKILL.md
   done
   # Expected: positive counts for all three
   ```

4. Verify behavioral contracts from CONTRACT.json:
   ```bash
   # scopeRequired: all downstream skills detect missing REVIEW-SCOPE.md
   for skill in unit-test bug-hunt uat; do
     grep -l "not found" skills/$skill/SKILL.md && echo "$skill: scope guard present"
   done

   # noStagePrompting: no skills prompt for stage selection
   grep -ri "which review stages\|stage selection" skills/unit-test/ skills/bug-hunt/ skills/uat/
   # Expected: zero matches

   # judgeLeaningVisible: bug-hunt includes judge leaning format
   grep -i "leaning" skills/bug-hunt/SKILL.md
   # Expected: matches
   ```

5. Run the review library tests to confirm Wave 1 functions are stable:
   ```bash
   node --test src/lib/review.test.cjs
   ```

## Success Criteria

- `skills/unit-test/SKILL.md` exists and implements the full unit test pipeline reading from REVIEW-SCOPE.md
- `skills/bug-hunt/SKILL.md` exists and implements the full adversarial bug hunt reading from REVIEW-SCOPE.md
- `skills/uat/SKILL.md` exists and implements the full UAT pipeline reading from REVIEW-SCOPE.md
- All three skills validate REVIEW-SCOPE.md existence with clear error pointing to `/rapid:review`
- No skill prompts for stage selection (each is independently invocable)
- REVIEW-BUGS.md format includes judge leaning with confidence per finding
- All artifact paths use `.planning/sets/{setId}/` (standard) or `.planning/post-merge/{setId}/` (post-merge)
- Help skill lists all four review commands with updated descriptions
- Re-running any skill overwrites its previous output cleanly (idempotent)
