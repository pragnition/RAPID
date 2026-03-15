# Wave 3 PLAN: Discuss-Set Batched Questions Rewrite

**Set:** ux-improvements
**Wave:** 3
**Objective:** Rewrite Steps 5-6 of `skills/discuss-set/SKILL.md` to implement the new batched question UX: remove the global "Let Claude decide all" top-level choice, increase questions per gray area from 2-3 to 4-5, add 2-3 concrete pre-filled approach options per question (radio-style), provide per-area "Claude decides" option, and position "I'll answer in my own words" as the last escape hatch on every freeform question.

---

## Task 1: Rewrite Step 5 -- Remove Global Skip, Restructure Gray Area Presentation

**File:** `skills/discuss-set/SKILL.md`

**Action:**

Replace the entire Step 5 section (lines ~147-172) with the following structure. The new Step 5 should:

### Remove the global "Let Claude decide all" option

The current Step 5 presents 5 options:
1. "Let Claude decide all" (REMOVE THIS)
2-5. Four gray area titles

Replace with an AskUserQuestion that presents ONLY the 4 gray areas as a multi-select. The user selects which areas they want to discuss:

```markdown
## Step 5: Identify 4 Gray Areas (Interactive Mode)

Analyze set context (CONTRACT.json, DEFINITION.md, SET-OVERVIEW.md, ROADMAP.md, source files) and identify exactly 4 gray areas. Gray areas are implementation facets where:

- Multiple valid approaches exist
- Integration points are ambiguous
- User experience decisions are needed
- Performance/quality tradeoffs exist

Present gray areas using AskUserQuestion:

```
"I've analyzed set '{SET_ID}' and identified 4 areas that would benefit from your input.
Select which areas you'd like to discuss:"
Options:
1. "{Gray area 1 title}" -- "{1-sentence description}"
2. "{Gray area 2 title}" -- "{1-sentence description}"
3. "{Gray area 3 title}" -- "{1-sentence description}"
4. "{Gray area 4 title}" -- "{1-sentence description}"
```

**Handling responses:**
- If the user selects specific areas: Record selected areas for Step 6. Unselected areas are recorded as "Claude's Discretion" in CONTEXT.md.
- If the user selects ALL 4 areas: All areas proceed to Step 6 for deep-dive discussion.
```

**Key change:** No global skip. The user MUST engage with at least the area selection. They can still skip individual areas in Step 6 by choosing "Claude decides" per-area.

### Update Key Principles and Anti-Patterns

Update the "Key Principles" section (near end of file):
- Change `"Claude decides" option: Available per-area and as a global "Let Claude decide all" option.` to `"Claude decides" option: Available per-area only. No global skip -- the user always sees the gray area list.`

Update the "Anti-Patterns" section:
- Remove or update any reference to the global "Let Claude decide all" option

**Verification:**
```bash
grep -c "Let Claude decide all" skills/discuss-set/SKILL.md
# Expected: 0 (all references removed)
grep -c "Claude decides" skills/discuss-set/SKILL.md
# Expected: at least 2 (per-area option references remain)
```

**Done when:** Step 5 no longer offers a global skip. The only way to skip discussion is per-area in Step 6.

---

## Task 2: Rewrite Step 6 -- Batched Questions with Pre-filled Options

**File:** `skills/discuss-set/SKILL.md`

**Action:**

Replace the entire Step 6 section (lines ~175-206) with the new batched question pattern. The new Step 6 should implement:

### Per-Area Deep Dive with 4-5 Questions

For EACH selected gray area (in order), present ONE AskUserQuestion that covers the area comprehensively with 4-5 questions. Each question within the batch should have its own pre-filled approach options.

```markdown
## Step 6: Deep-Dive Selected Areas (Batched Per Area)

For EACH selected gray area (in order):

1. Present ONE AskUserQuestion per area that covers it comprehensively. Include 4-5 questions per area, each with 2-3 concrete pre-filled approach options:

   ```
   "{Gray area title}

   Context: {2-3 sentences explaining the tradeoffs and why this matters}

   Questions:
   1. {Question about primary approach}
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}
      c) {Concrete option C} -- {1-sentence rationale} (optional, if 3 options are warranted)

   2. {Question about integration or edge case}
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}

   3. {Question about tradeoff or performance consideration}
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}

   4. {Question about UX or developer experience detail}
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}

   5. {Question about specific implementation detail} (optional 5th question if area warrants it)
      a) {Concrete option A} -- {1-sentence rationale}
      b) {Concrete option B} -- {1-sentence rationale}

   For each question, pick a letter (a/b/c) or write your own answer.
   Type 'Claude decides' to let me handle this entire area."
   ```

   **Options for the AskUserQuestion wrapper:**
   - "Claude decides" -- "Let Claude handle all decisions for this area"
   - "I'll answer in my own words" -- "Respond to all questions with free-form text"

   **Note on the hybrid format:** The question body contains inline lettered options (a/b/c) for each sub-question, while the AskUserQuestion wrapper provides the two escape hatches. Users can:
   - Pick letters for each sub-question (e.g., "1a, 2b, 3a, 4b")
   - Mix letters and prose (e.g., "1a, 2b, 3: I want to use Redis instead, 4a")
   - Select "Claude decides" to skip the whole area
   - Select "I'll answer in my own words" to write a full prose response

2. Parse the user's response. Extract decisions per sub-question:
   - Letter selections map to the corresponding approach option
   - Prose responses are recorded verbatim
   - "Claude decides" records all sub-questions as Claude's discretion with rationale

3. If user said "Claude decides": Record the entire area as Claude's discretion with rationale explaining why each sub-decision was made a particular way.

### Follow-Up (Only If Needed)

After ALL selected areas are discussed:
- Compile follow-up questions ONLY if genuine gaps remain after all 4 areas were covered.
- If gaps exist: ONE final AskUserQuestion with remaining questions. Include pre-filled options:
  ```
  - "These gaps don't matter" -- "Proceed without resolving these points"
  - "I'll answer in my own words" -- "Address the remaining gaps"
  ```
- If no gaps: Skip follow-up entirely.
```

**Verification:**
```bash
grep -c "4-5 questions" skills/discuss-set/SKILL.md
# Expected: at least 1
grep -c "I'll answer in my own words" skills/discuss-set/SKILL.md
# Expected: at least 2
grep -c "Claude decides" skills/discuss-set/SKILL.md
# Expected: at least 3 (per-area option, parsing handler, discretion recording)
```

**Done when:** Step 6 uses the new batched format with 4-5 questions per area, each with inline lettered options, and "I'll answer in my own words" as the last escape hatch.

---

## Task 3: Update Key Principles, Anti-Patterns, and Step Count References

**File:** `skills/discuss-set/SKILL.md`

**Action:**

### Update Key Principles section (near line ~316-327)

Change:
```
- **Batched questions per area:** Present 2-3 questions per gray area in a single AskUserQuestion call, not one at a time.
```
To:
```
- **Batched questions per area:** Present 4-5 questions per gray area in a single AskUserQuestion call with 2-3 concrete pre-filled approach options per question (radio-style). Not one question at a time.
```

Change:
```
- **"Claude decides" option:** Available per-area and as a global "Let Claude decide all" option.
```
To:
```
- **"Claude decides" option:** Available per-area only. No global skip -- the user always sees the gray area list and decides per-area.
```

### Update Anti-Patterns section (near line ~330-338)

Change:
```
- Do NOT ask one question at a time per area -- batch 2-3 questions per area into one AskUserQuestion.
```
To:
```
- Do NOT ask one question at a time per area -- batch 4-5 questions per area into one AskUserQuestion with inline lettered options.
- Do NOT present a global "Let Claude decide all" option -- "Claude decides" is per-area only.
- Do NOT present freeform AskUserQuestion calls without pre-filled options -- always include at least "Claude decides" and "I'll answer in my own words" as AskUserQuestion options.
```

### Verify Step 7 CONTEXT.md template

The Step 7 CONTEXT.md template should still work with the new format. Verify that:
- `{Area N Title}` sections can capture per-sub-question decisions (letter selections)
- Claude's Discretion section can capture per-area skips

No changes needed to Step 7 format unless the executor finds the template insufficient for capturing granular sub-question decisions. If so, add a sub-question breakdown under each area:

```markdown
### {Area Title}
- Q1: {decision or letter selection}
- Q2: {decision or letter selection}
- Q3: {decision or letter selection}
- Q4: {decision or letter selection}
```

**Verification:**
```bash
grep -c "4-5 questions" skills/discuss-set/SKILL.md
# Expected: at least 2 (one in Step 6, one in Key Principles)
grep "Let Claude decide all" skills/discuss-set/SKILL.md
# Expected: no output (all references removed)
```

**Done when:** Key Principles and Anti-Patterns reflect the new 4-5 question batched format with per-area Claude decides and no global skip.

---

## Success Criteria

- [ ] Step 5 no longer contains "Let Claude decide all" as an option
- [ ] Step 5 presents exactly 4 gray area options (no global skip)
- [ ] Step 6 describes 4-5 questions per gray area (not 2-3)
- [ ] Each sub-question has 2-3 inline lettered approach options (a/b/c)
- [ ] "Claude decides" is available per-area as an AskUserQuestion option
- [ ] "I'll answer in my own words" is the LAST option on every AskUserQuestion call in Steps 5-6
- [ ] Key Principles and Anti-Patterns sections are updated to match new behavior
- [ ] No remaining references to "Let Claude decide all" anywhere in the file
- [ ] The CONTEXT.md template (Step 7) can capture granular sub-question decisions

## What NOT To Do

- Do NOT modify any other skill files -- this wave exclusively owns `skills/discuss-set/SKILL.md`
- Do NOT modify `src/lib/display.cjs` or `src/lib/display.test.cjs`
- Do NOT change Steps 1-4 (environment, resolution, context gathering, skip mode) -- they are not in scope
- Do NOT change Steps 7-9 (CONTEXT.md writing, state transition, next steps) -- only update if the template needs sub-question granularity
- Do NOT change the number of gray areas from 4 -- the locked decision is exactly 4 areas
- Do NOT add the global "Let Claude decide all" back -- it was explicitly removed by user decision
