# PLAN: discuss-ux / Wave 1

**Objective:** Consolidate gray area prompts into fewer AskUserQuestion calls (Step 5), replace Format A markdown table with structured list (Step 6), and update all test assertions to match the new SKILL.md content.

---

## Task 1: Rewrite Step 5 gray area presentation for consolidated AskUserQuestion calls

**File:** `skills/discuss-set/SKILL.md`

**What to change:**

Lines 183-222 currently describe presenting gray areas as separate AskUserQuestion calls per batch of 4. Rewrite this section so that ALL batches are packed into a SINGLE AskUserQuestion call with multiple questions (one question per batch of 4).

**Specific edits:**

1. Replace the subsection heading "### Presenting Gray Areas in Batches" (line 183) with "### Presenting Gray Areas (Consolidated)".

2. Replace the n=1 block (lines 187-197). Keep the same structure but clarify it is 1 AskUserQuestion call with 1 multiSelect question containing 4 options. The current content is already correct for n=1, so minimal change needed -- just ensure the framing says "One AskUserQuestion call with 1 question".

3. Replace the n=2 block (lines 199-214). Currently shows TWO separate AskUserQuestion calls. Rewrite to show ONE AskUserQuestion call with 2 questions, each containing 4 options:

   ```
   **For n=2 (8 gray areas):** One AskUserQuestion call with 2 questions:

   ```
   "I've analyzed set '{SET_ID}' and identified 8 areas that would benefit from your input.
   Select which areas you'd like to discuss (unselected areas default to Claude's discretion):"
   Question 1 (multiSelect: true): "Core Architecture"
   Options 1-4: {first 4 gray areas}
   Question 2 (multiSelect: true): "Integration & Boundaries"
   Options 1-4: {next 4 gray areas}
   ```
   ```

4. Replace the n=3 block (line 216). Currently says "Three AskUserQuestion calls". Rewrite to ONE AskUserQuestion call with 3 questions:

   ```
   **For n=3 (12 gray areas):** One AskUserQuestion call with 3 questions. Use descriptive category labels for each question (e.g., "Core Architecture", "Integration & Boundaries", "UX & Presentation").
   ```

5. Update "### Handling Responses Across Batches" (lines 218-222). Replace "across all batches" language with "across all questions" since it is now a single call. Replace "empty selection in every batch" with "empty selection across all questions". The subsection heading should become "### Handling Responses".

6. In "## Key Principles" (line 476), replace `"Batched questions with options"` with `"Consolidated questions with options"` and update the description to say: "Present all gray area batches as questions within a single AskUserQuestion call. Each question has prefilled options including 'Claude decides'."

7. In "## Anti-Patterns" (line 497), update the anti-pattern about freeform batching. Currently reads: "Do NOT batch multiple questions into a single freeform AskUserQuestion -- each question gets its own AskUserQuestion with prefilled options." Change to: "Do NOT use freeform text in AskUserQuestion -- each question must have prefilled multiSelect options. Gray area batches are packed as structured questions within a single call, not as freeform prompts."

**What NOT to do:**
- Do NOT change the 4n scaling model (the complexity heuristic table at lines 159-163)
- Do NOT change the n=1 example's 4 numbered options (tests 1 and 2 count these)
- Do NOT add a 5th option line in any example block (test 2 checks for absence of "5.")
- Do NOT remove the "When the set's context" UI/UX conditional guidance paragraph (tests 10-11 check for it)

**Verification:**
```bash
cd /home/kek/Projects/RAPID && grep -c 'AskUserQuestion call' skills/discuss-set/SKILL.md
# For n=2 and n=3 blocks, should see "One AskUserQuestion call" not "Two" or "Three"
grep 'Two AskUserQuestion' skills/discuss-set/SKILL.md && echo "FAIL: still says Two" || echo "PASS"
grep 'Three AskUserQuestion' skills/discuss-set/SKILL.md && echo "FAIL: still says Three" || echo "PASS"
```

---

## Task 2: Replace Step 6 Format A markdown table with structured list

**File:** `skills/discuss-set/SKILL.md`

**What to change:**

Lines 241-246 contain the Format A example with a markdown table:

```
| Option | Pros | Cons |
|--------|------|------|
| A: {name} | {pros} | {cons} |
| B: {name} | {pros} | {cons} |
| C: {name} (Recommended) | {pros} | {cons} |
```

Replace with a labeled-block list format:

```
**A: {name}**
**Pros:** {pros}
**Cons:** {cons}

**B: {name}**
**Pros:** {pros}
**Cons:** {cons}

**C: {name} (Recommended)**
**Pros:** {pros}
**Cons:** {cons}
```

**Specific edits:**

1. In the Format A code block (inside the AskUserQuestion prompt string), replace the 5-line markdown table (header row, separator row, 3 data rows) with the 11-line labeled-block format shown above.

2. Update the Format A description line (line 235) from "Best for straightforward choices between distinct approaches:" -- keep this unchanged, it still applies.

**What NOT to do:**
- Do NOT modify Format B (Preview Panels) or Format C (Question Context Block)
- Do NOT change the Options list below the prompt (the 1-4 numbered options)
- Do NOT change the "Context:" line or its length guideline

**Verification:**
```bash
cd /home/kek/Projects/RAPID
# Table syntax should be gone from Format A area
grep -n '| Option | Pros | Cons |' skills/discuss-set/SKILL.md && echo "FAIL: table still present" || echo "PASS: table removed"
# Labeled blocks should be present
grep -c '\*\*Pros:\*\*' skills/discuss-set/SKILL.md
# Should find at least 3 occurrences (one per option A, B, C)
```

---

## Task 3: Update SKILL.test.cjs assertions for new content

**File:** `skills/discuss-set/SKILL.test.cjs`

**What to change:**

Five tests need updating because their literal string assertions no longer match the updated SKILL.md:

### Test 3 (line 42-49): "Key Principles says 'Exactly 4 gray areas'"
The Key Principles section no longer contains the phrase "Exactly 4 gray areas" (it was changed to "Variable gray area count (4n)" in a prior update). Update the assertion:
- Change the test name to: `'Key Principles mentions variable gray area count (4n)'`
- Change the assertion to check for `'Variable gray area count (4n)'` instead of `'Exactly 4 gray areas'`

### Test 4 (line 53-60): "Anti-Patterns says 'fewer or more than 4'"
The Anti-Patterns section no longer contains "fewer or more than 4" (it was changed to "non-multiple-of-4"). Update:
- Change the test name to: `'Anti-Patterns warns against non-multiple-of-4 gray area counts'`
- Change the assertion to check for `'non-multiple-of-4'` instead of `'fewer or more than 4'`

### Test 5 (line 64-72): "Step 5 heading mentions '4 Gray Areas'"
Step 5 heading is now "## Step 5: Identify Gray Areas (Interactive Mode)" -- it no longer contains "4". Update:
- Change the test name to: `'Step 5 heading mentions Gray Areas'`
- Change the assertion from checking for `'4'` to checking for `'Gray Areas'`
- Update the error message accordingly

### Test 10 (line 117-143): "Step 5 UI/UX conditional guidance paragraph exists between criteria list and AskUserQuestion block"
The test checks for the string `'UI/UX decisions need to be made'` which no longer exists in SKILL.md. The equivalent bullet is now `'UI/UX decisions:'` (line 174 of SKILL.md). Update:
- Change the `lastCriterionIdx` search string from `'UI/UX decisions need to be made'` to `'UI/UX decisions:'`
- Update the assertion message from `'Step 5 should contain the "UI/UX decisions need to be made" criterion'` to `'Step 5 should contain the "UI/UX decisions:" criterion'`
- Also update the heading text "Present gray areas using AskUserQuestion" to match the new subsection heading -- after Task 1, this becomes "### Presenting Gray Areas (Consolidated)". Check that the string `'Present gray areas'` still appears; if the heading changed, use the new text. The safest anchor is `'Presenting Gray Areas'` since both old and new headings contain it.
- Change `askUserIdx` search from `'Present gray areas using AskUserQuestion'` to `'Presenting Gray Areas'`

### Test 12 (NEW): Add a test for consolidated AskUserQuestion behavior
Add a new test that verifies Step 5 uses "One AskUserQuestion call" for n=2:
```javascript
it('Step 5 uses consolidated AskUserQuestion calls for n=2', () => {
  const step5Match = content.match(/## Step 5[\s\S]*?(?=## Step 6)/);
  assert.ok(step5Match, 'Should find Step 5 section');
  const step5 = step5Match[0];
  // n=2 should say "One AskUserQuestion call" not "Two AskUserQuestion calls"
  assert.ok(
    step5.includes('One AskUserQuestion call with 2 questions'),
    'n=2 should use one consolidated AskUserQuestion call with 2 questions',
  );
});
```

### Test 13 (NEW): Add a test for Format A list format
Add a new test that verifies Format A uses labeled blocks instead of a table:
```javascript
it('Step 6 Format A uses labeled-block list, not markdown table', () => {
  const step6Match = content.match(/### Format A[\s\S]*?(?=### Format B)/);
  assert.ok(step6Match, 'Should find Format A section');
  const formatA = step6Match[0];
  // Should NOT contain table syntax
  assert.ok(
    !formatA.includes('| Option | Pros | Cons |'),
    'Format A should not contain markdown table header',
  );
  // Should contain labeled blocks
  assert.ok(
    formatA.includes('**Pros:**'),
    'Format A should use **Pros:** labeled blocks',
  );
  assert.ok(
    formatA.includes('**Cons:**'),
    'Format A should use **Cons:** labeled blocks',
  );
});
```

**What NOT to do:**
- Do NOT modify tests 1, 2, 6, 7, 8, 9, or 11 -- they should pass without changes
- Do NOT change the test file structure (describe block, imports, etc.)

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test skills/discuss-set/SKILL.test.cjs
# All tests should pass (0 failures)
```

---

## Success Criteria

1. `grep 'Two AskUserQuestion' skills/discuss-set/SKILL.md` returns nothing (consolidated)
2. `grep 'Three AskUserQuestion' skills/discuss-set/SKILL.md` returns nothing (consolidated)
3. `grep '| Option | Pros | Cons |' skills/discuss-set/SKILL.md` returns nothing (table removed)
4. `grep '**Pros:**' skills/discuss-set/SKILL.md` returns matches (list format present)
5. `node --test skills/discuss-set/SKILL.test.cjs` exits 0 with all tests passing

## Commit

After all 3 tasks are verified:

```bash
cd /home/kek/Projects/RAPID
git add skills/discuss-set/SKILL.md skills/discuss-set/SKILL.test.cjs
git commit -m "feat(discuss-ux): consolidate gray area prompts and replace Format A table with list"
```
