# Wave 2 PLAN: Discuss-Set UX Restructuring

## Objective

Fix two UX flaws in `skills/discuss-set/SKILL.md`:

1. **"Let Claude decide all" as peer checkbox**: Step 5 currently presents "Let Claude decide all" as option 1 in the same AskUserQuestion multiselect alongside the 4 gray-area topics. This conflates a meta-action (skip all discussion) with per-topic selection. Fix: remove it entirely and use the implicit unselected model -- topics the user does not select automatically default to Claude's discretion. Add explanatory text so the user understands this behavior.

2. **Bundled freeform questions in Step 6**: When a gray area has 2-3 questions, they are currently bundled into a single freeform AskUserQuestion. Fix: each question within a gray area should be its own AskUserQuestion header with prefilled options (including a "Claude decides" option per question), not a single freeform text block.

## Why This Matters

The current UX is confusing: users see "Let Claude decide all" alongside specific topics and do not understand the selection semantics. The freeform bundled questions force users to type paragraph responses when prefilled options would be faster and more structured. Both issues were reported in `todo.md`.

## Tasks

### Task 1: Restructure Step 5 -- Remove "Let Claude decide all" peer option

**File:** `skills/discuss-set/SKILL.md`

**Action:** Replace Step 5's AskUserQuestion block (lines 156-167) with the implicit unselected model:

**Current (lines 156-167):**
```
Present gray areas using AskUserQuestion:

\`\`\`
"I've analyzed set '{SET_ID}' and identified 4 areas that would benefit from your input.
Select which areas you'd like to discuss:"
Options:
1. "Let Claude decide all" -- "Skip discussion, all decisions at Claude's discretion"
2. "{Gray area 1 title}" -- "{1-sentence description}"
3. "{Gray area 2 title}" -- "{1-sentence description}"
4. "{Gray area 3 title}" -- "{1-sentence description}"
5. "{Gray area 4 title}" -- "{1-sentence description}"
\`\`\`
```

**Replace with:**
```
Present gray areas using AskUserQuestion:

\`\`\`
"I've analyzed set '{SET_ID}' and identified 4 areas that would benefit from your input.
Select which areas you'd like to discuss (unselected areas default to Claude's discretion):"
Options:
1. "{Gray area 1 title}" -- "{1-sentence description}"
2. "{Gray area 2 title}" -- "{1-sentence description}"
3. "{Gray area 3 title}" -- "{1-sentence description}"
4. "{Gray area 4 title}" -- "{1-sentence description}"
\`\`\`
```

Also update the **Handling responses** section (lines 169-171):

**Current:**
```
**Handling responses:**
- If "Let Claude decide all": Record all 4 areas as Claude's discretion. Skip to Step 7 (Write CONTEXT.md).
- If the user selects specific areas: Record selected areas for Step 6.
```

**Replace with:**
```
**Handling responses:**
- If the user selects no areas (empty selection): Record all 4 areas as Claude's discretion. Skip to Step 7 (Write CONTEXT.md).
- If the user selects specific areas: Record selected areas for Step 6. Unselected areas are recorded as Claude's discretion.
```

### Task 2: Restructure Step 6 -- Split bundled questions into individual AskUserQuestion calls

**File:** `skills/discuss-set/SKILL.md`

**Action:** Replace Step 6's per-area question format (lines 176-199). Currently it presents 2-3 questions as a single freeform AskUserQuestion. Change to: each question within a gray area gets its own AskUserQuestion with prefilled options.

**Current Step 6 question format (lines 179-192):**
```
1. Present ONE AskUserQuestion that covers the area comprehensively. Batch 2-3 questions per area into a single prompt:

   \`\`\`
   "{Gray area title}

   Context: {2-3 sentences explaining the tradeoffs and why this matters}

   Questions:
   1. {Question about approach}
   2. {Question about edge case or tradeoff}
   3. {Question about specific detail}

   Answer all questions above, or type 'Claude decides' to let me handle this area."
   \`\`\`

   This is a freeform AskUserQuestion -- the user answers all 2-3 questions about the area in one response.
```

**Replace with:**
```
1. For EACH question within the gray area, present a SEPARATE AskUserQuestion with prefilled options:

   \`\`\`
   "{Gray area title} -- {Question about approach}

   Context: {1-2 sentences explaining this specific tradeoff}
   "
   Options:
   1. "{Option A}" -- "{Brief explanation of approach A}"
   2. "{Option B}" -- "{Brief explanation of approach B}"
   3. "{Option C}" -- "{Brief explanation of approach C, if applicable}"
   4. "Claude decides" -- "Let Claude pick the best approach"
   \`\`\`

   Repeat for each question in the area (typically 2-3 questions per area). Each question is a separate AskUserQuestion call with its own prefilled options.
```

Also update the response parsing (lines 194-196):

**Current:**
```
2. Parse the user's response. Extract decisions.

3. If user said "Claude decides": Record as Claude's discretion with rationale.
```

**Replace with:**
```
2. Record the user's selected option for each question.

3. If user selected "Claude decides" for a question: Record that specific question as Claude's discretion.
```

### Task 3: Update anti-patterns section to match new behavior

**File:** `skills/discuss-set/SKILL.md`

**Action:** Update lines in the Anti-Patterns section (near end of file) that reference the old behavior:

1. Change `- Do NOT ask one question at a time per area -- batch 2-3 questions per area into one AskUserQuestion.` to `- Do NOT batch multiple questions into a single freeform AskUserQuestion -- each question gets its own AskUserQuestion with prefilled options.`

2. Add: `- Do NOT present "Let Claude decide all" as a checkbox option -- use the implicit unselected model instead.`

### Task 4: Update Key Principles section to match new behavior

**File:** `skills/discuss-set/SKILL.md`

**Action:** Update the Key Principles section:

1. Change `- **Batched questions per area:** Present 2-3 questions per gray area in a single AskUserQuestion call, not one at a time.` to `- **Individual questions with options:** Present each question within a gray area as a separate AskUserQuestion with prefilled options including "Claude decides".`

2. Change `- **"Claude decides" option:** Available per-area and as a global "Let Claude decide all" option.` to `- **"Claude decides" option:** Available as a prefilled option per question. Unselected gray areas in Step 5 automatically default to Claude's discretion.`

## Success Criteria

- [ ] Step 5 presents exactly 4 options (the gray areas), no "Let Claude decide all" peer option
- [ ] Step 5 explains that unselected areas default to Claude's discretion
- [ ] Step 6 presents each question within a gray area as a separate AskUserQuestion with prefilled options
- [ ] Each per-question AskUserQuestion includes a "Claude decides" option
- [ ] Anti-Patterns section forbids the old batched-freeform pattern and the old peer-checkbox pattern
- [ ] Key Principles section reflects the new individual-question-with-options model
- [ ] No references to "Let Claude decide all" remain in the file as a checkbox option

## Files Modified

| File | Action |
|------|--------|
| `skills/discuss-set/SKILL.md` | Restructure Steps 5-6, update Key Principles and Anti-Patterns |
