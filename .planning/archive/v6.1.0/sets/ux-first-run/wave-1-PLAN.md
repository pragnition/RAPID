# Wave 1 PLAN: SKILL.md Modifications

**Set:** ux-first-run
**Wave:** 1
**Objective:** Implement audit items 3.1, 3.2, 2.3, and 3.3 by modifying two SKILL.md files to improve the first-run experience and contextual guidance in the init and status skills.

**Files modified:** `skills/init/SKILL.md`, `skills/status/SKILL.md`
**Files NOT modified:** `src/bin/rapid-tools.cjs` (Wave 2 scope)

---

## Task 1: Post-Init Workflow Guide (Item 3.1)

**File:** `skills/init/SKILL.md`
**Action:** Insert a new Step 11.5 between the existing Step 11 (Completion summary, ends at line 1278) and Step 12 (Footer, starts at line 1280).

### What to add

Insert the following new section after the closing triple-backtick of Step 11 (after line 1278) and before the `## Step 12: Footer` heading (line 1280):

```markdown
## Step 11.5: Workflow Guide

Display the RAPID lifecycle as a compact reference:

` ` `markdown
### What's Next?

The RAPID lifecycle for each set:

1. `/rapid:status` -- see your project dashboard
2. `/rapid:start-set N` -- initialize a set for development
3. `/rapid:discuss-set N` -- capture implementation vision
4. `/rapid:plan-set N` -- research and plan waves
5. `/rapid:execute-set N` -- implement the plan
6. `/rapid:review N` -- review before merge
7. `/rapid:merge N` -- merge into main

Start with `/rapid:start-set 1` to begin your first set.
` ` `

This is pure markdown output -- no bash commands. The agent displays this text exactly as shown.
```

(Note: The triple-backtick delimiters in the SKILL.md should be actual triple backticks, not the escaped form shown here.)

### What NOT to do

- Do NOT modify any existing steps (Step 11 or Step 12).
- Do NOT add bash commands to this step -- it is pure markdown output like Step 11.
- Do NOT duplicate the footer breadcrumb -- the lifecycle list is a reference, not a navigation element.
- Do NOT renumber Step 12 to Step 13. The half-step pattern (11.5) is established in this file (Steps 0.5 and 10.5 already exist).

### Verification

Run: `grep -n "Step 11.5" skills/init/SKILL.md` -- should return a line number between 1278 and 1285.
Run: `grep -c "What's Next" skills/init/SKILL.md` -- should return 1.
Run: `grep -n "Step 12" skills/init/SKILL.md` -- should still exist and appear AFTER Step 11.5.

---

## Task 2: Fix Status Next-Action Mapping Bug (Item 2.3, prerequisite)

**File:** `skills/status/SKILL.md`
**Action:** Correct the off-by-one error in the Step 4 status-to-action mapping table (lines 165-172).

### Current (buggy) table

```
| Set Status | Suggested Action         |
| ---------- | ------------------------ |
| pending    | `/rapid:start-set {N}`   |
| discussed  | `/rapid:discuss-set {N}` |
| planned    | `/rapid:plan-set {N}`    |
| executed   | `/rapid:execute-set {N}` |
| complete   | `/rapid:review {N}`      |
| merged     | (done)                   |
```

### Corrected table

Each status should map to the command that ADVANCES the set to the next status, not the command that PUT it in the current status:

```
| Set Status | Suggested Action           |
| ---------- | -------------------------- |
| pending    | `/rapid:start-set {N}`     |
| discussed  | `/rapid:plan-set {N}`      |
| planned    | `/rapid:execute-set {N}`   |
| executed   | `/rapid:review {N}`        |
| complete   | `/rapid:merge {N}`         |
| merged     | (done)                     |
```

State machine reference (from `src/lib/state-transitions.cjs`):
- `pending` -> `discussed` (via `start-set`)
- `discussed` -> `planned` (via `plan-set`)
- `planned` -> `executed` (via `execute-set`)
- `executed` -> `complete` (via `review`)
- `complete` -> `merged` (via `merge`)

### What NOT to do

- Do NOT change the AskUserQuestion option formatting or the `{N}` placeholder convention.
- Do NOT modify any other part of Step 4 in this task.

### Verification

Run: `grep -A 8 "Set Status.*Suggested Action" skills/status/SKILL.md` -- the output should show `discussed` paired with `plan-set`, `planned` with `execute-set`, `executed` with `review`, and `complete` with `merge`.

---

## Task 3: Status Empty-State Guidance (Item 3.2)

**File:** `skills/status/SKILL.md`
**Action:** Expand the Edge Cases section (lines 155-159) to add a new "All sets pending" case and enrich the existing "No sets exist" case.

### Current edge cases (lines 155-159)

```markdown
### Edge Cases

- **No sets exist**: Display "No sets found. Run `/rapid:init` to get started."
- **All sets merged**: Display "All sets merged! Run `/rapid:new-version` to start the next milestone."
- **STATE.json missing**: Already handled in Step 2 -- display error message and skip to Step 4 fallback.
```

### New edge cases (replace the entire Edge Cases subsection)

```markdown
### Edge Cases

- **STATE.json missing**: Already handled in Step 2 -- display error message and skip to Step 4 fallback.

- **No sets in milestone**: Display "No sets found in this milestone. Run `/rapid:add-set` to create one, or `/rapid:new-version` to start a new milestone."

- **All sets pending** (sets exist but none have been started): Display a "Getting Started" guide:

  ```markdown
  ### Getting Started

  Your project has {N} sets ready to develop. The RAPID lifecycle for each set:

  1. `/rapid:start-set N` -- initialize a set for development
  2. `/rapid:discuss-set N` -- capture implementation vision
  3. `/rapid:plan-set N` -- research and plan waves
  4. `/rapid:execute-set N` -- implement the plan
  5. `/rapid:review N` -- review before merge
  6. `/rapid:merge N` -- merge into main

  Start with `/rapid:start-set 1` to begin your first set.
  ```

  Then continue to Step 4 (which will offer `/rapid:start-set` actions for each pending set).

- **All sets merged**: Display "All sets merged! Run `/rapid:new-version` to start the next milestone."
```

### Detection logic

The agent determines which case applies by examining the set data loaded in Step 2:
1. If STATE.json is missing -> already handled by Step 2 error path.
2. If the milestone has 0 sets -> "No sets in milestone" case.
3. If all sets have status `pending` -> "All sets pending" case (show Getting Started guide).
4. If all sets have status `merged` -> "All sets merged" case.
5. Otherwise -> normal Step 3 + Step 4 flow.

### What NOT to do

- Do NOT change the "STATE.json missing" behavior -- it is already handled in Step 2.
- Do NOT make the Getting Started guide interactive (no AskUserQuestion here) -- it is informational output before the Step 4 AskUserQuestion.
- Do NOT skip Step 4 after showing the Getting Started guide -- the user still needs the action options.

### Verification

Run: `grep -c "All sets pending" skills/status/SKILL.md` -- should return 1.
Run: `grep -c "Getting Started" skills/status/SKILL.md` -- should return at least 1.
Run: `grep "No sets in milestone" skills/status/SKILL.md` -- should return a match.
Run: `grep "add-set" skills/status/SKILL.md` -- should return a match (the add-set suggestion).

---

## Task 4: Status Contextual Progress Insights (Item 2.3)

**File:** `skills/status/SKILL.md`
**Action:** Add a "Progress Insights" subsection to Step 4, inserted BEFORE the "Present actions" subsection (which starts at line 176).

### What to add

Insert the following between the `Where {N}` line (line 174) and the `### Present actions` heading (line 176):

```markdown
### Progress Insights

Before presenting actionable options, analyze the set data for patterns and display relevant insights. Only display insights that apply -- if none apply, skip this subsection entirely (no empty heading).

**Wave advancement:** If DAG.json was loaded in Step 2 and all sets in a DAG wave have status `merged` or `complete`, display:
> "Wave {W} sets are all complete. Wave {W+1} sets are ready to start."

Replace {W} with the wave number. Only display for the most recently completed wave (not historical ones).

**Batch opportunity:** If 2 or more non-merged sets share the same status, display:
> "{count} sets are at '{status}' status. Consider batch-processing them with the same command."

Only display this once for the most common shared status.

**Near completion:** If only 1 set remains unmerged, display:
> "Almost there! Only '{set-name}' remains before milestone completion."

Display at most 2 insights to keep the output concise. Prioritize in order: near completion > wave advancement > batch opportunity.
```

### What NOT to do

- Do NOT modify the AskUserQuestion behavior or the action mapping table (already corrected in Task 2).
- Do NOT add insights that require data beyond what Step 2 already loads (STATE.json + DAG.json + git activity).
- Do NOT display the "Progress Insights" heading if no insights apply -- the subsection is entirely conditional.

### Verification

Run: `grep -n "Progress Insights" skills/status/SKILL.md` -- should return a line number between the action mapping table and the "Present actions" heading.
Run: `grep "Wave.*sets are all complete" skills/status/SKILL.md` -- should return a match.
Run: `grep "batch-processing" skills/status/SKILL.md` -- should return a match.
Run: `grep "Almost there" skills/status/SKILL.md` -- should return a match.

---

## Success Criteria

1. `skills/init/SKILL.md` contains a new Step 11.5 with the RAPID lifecycle workflow guide.
2. `skills/status/SKILL.md` Step 4 action mapping correctly maps each status to its NEXT command (not the command that produced the status).
3. `skills/status/SKILL.md` edge cases distinguish between "no sets in milestone," "all sets pending," and "all sets merged."
4. `skills/status/SKILL.md` Step 4 includes conditional Progress Insights before the AskUserQuestion.
5. Item 3.3 (init-to-first-set bridge) is satisfied by the combination of Tasks 1 and 3: the init workflow guide points to `/rapid:start-set 1`, and the status empty-state guide reinforces that guidance.
6. No modifications to `src/bin/rapid-tools.cjs` (Wave 2 scope).
