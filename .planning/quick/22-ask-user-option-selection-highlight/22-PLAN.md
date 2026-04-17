# Quick Task 22 -- Ask User Option: Select-then-Submit

## Objective

Change the ask-user option buttons from single-click-to-submit to a two-step
select-then-submit interaction. Clicking an option should visually highlight it
(border glow, background tint) without submitting. The user must then press a
Submit button to confirm. This applies to **both** rendering locations:

1. **ChatThreadPage inline prompt** (option buttons above the composer)
2. **AskUserModal dialog** (radio-button list in the modal overlay)

---

## Task 1 -- ChatThreadPage inline option selection

**Files to modify:**
- `web/frontend/src/pages/ChatThreadPage.tsx`

**Action:**

Currently the inline option buttons call `handleAnswer(opt)` directly on click
(line 533), which immediately submits. Change this to a two-step flow:

1. Add a `selectedOption` state variable (string or null), initialized to `null`.
   Reset it whenever `pendingQuestion` changes (either via useEffect or by
   keying on `pendingQuestion?.promptId`).

2. Replace the option button's `onClick={() => handleAnswer(opt)}` with
   `onClick={() => setSelectedOption(opt)}`. The button should NOT submit.

3. Style the selected option button distinctly. When `selectedOption === opt`,
   apply classes that produce a visible highlight:
   - `border-accent bg-accent/10 ring-1 ring-accent/40` (accent-colored border,
     subtle background tint, and a thin ring glow)
   - Keep the unselected style as-is: `border-border hover:border-accent hover:bg-hover`

4. Below the options list (inside the same `mb-3` container or after it, before
   the free-text input area), render a Submit button that is **only visible when
   `selectedOption` is non-null AND `!pendingQuestion.allowFreeText`** (when
   free text is also shown, the existing free-text Submit button already exists --
   but see note below). The Submit button calls `handleAnswer(selectedOption)`.

   **When both options AND free text are shown (`allowFreeText === true`):**
   - Selecting an option populates `selectedOption` and the existing free-text
     input should be cleared (or ignored). The existing Submit button should
     submit the selected option if one is selected, falling back to the typed
     free-text otherwise.
   - Typing in the free-text input should clear `selectedOption` to `null`.
   - The existing Submit button's disabled state should account for
     `selectedOption` as well: enabled if `selectedOption || pendingAnswer.trim()`.

   **When only options are shown (`allowFreeText === false`):**
   - Render a new Submit button below the options. Disabled when `selectedOption`
     is null. Calls `handleAnswer(selectedOption)` on click.

5. Reset `selectedOption` to `null` in `handleAnswer` after submission (alongside
   the existing `setPendingAnswer("")`).

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit
```

**Done criteria:**
- Clicking an option in the inline prompt highlights it without submitting.
- A Submit button appears that sends the selected option.
- The highlight uses the project's `accent` colour token for visual consistency.
- TypeScript compiles without errors.

---

## Task 2 -- AskUserModal option selection highlight

**Files to modify:**
- `web/frontend/src/components/prompts/AskUserModal.tsx`

**Action:**

The modal already uses radio buttons with a `selectedOption` state and a separate
Submit button, so the two-step flow is already wired. However, the visual
feedback on the selected radio option is minimal (just the native radio dot).
Enhance the highlight on the selected option's label wrapper:

1. On the `<label>` element wrapping each option (line ~195-210), conditionally
   add highlight classes when `selectedOption === opt`:
   - Selected: `border-accent bg-accent/10 ring-1 ring-accent/40`
   - Unselected (current): `border-border bg-surface-1 hover:border-accent`

   This makes the entire option row glow when selected, matching the inline
   prompt's new visual style.

2. Apply the same highlight treatment to the "Other (type below)" label when
   `selectedOption === OTHER_OPTION_SENTINEL`.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend && npx tsc --noEmit
```

**Done criteria:**
- Selecting a radio option in the AskUserModal produces a visible border + background highlight on the entire option row.
- The "Other" option row also highlights when selected.
- Visual style matches the inline prompt highlight from Task 1 (accent border, accent/10 bg, accent/40 ring).
- TypeScript compiles without errors.

---

## Summary

| # | Task | Files | Scope |
|---|------|-------|-------|
| 1 | Inline option select-then-submit | `ChatThreadPage.tsx` | State + click handler + conditional Submit button |
| 2 | Modal option highlight | `AskUserModal.tsx` | CSS class swap on selected label |
