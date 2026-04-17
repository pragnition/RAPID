# Quick Task 18: Shrink Next-Action Footer Banner

**Objective:** Replace the oversized box-drawing footer (7 lines) with a compact 1-2 line inline format that fits on any terminal width.

**Constraint:** The function signature `renderFooter(nextCommand, options)` and its parameters (`breadcrumb`, `clearRequired`) are unchanged. 18 skill files call `display footer` -- they must continue to work without modification.

---

## Task 1: Replace full-mode box with compact inline footer

**Files:** `src/lib/display.cjs`

**Action:**

Replace the full-mode branch (lines 150-194) with a compact inline renderer. The compact-mode branch (lines 136-148) already works well for narrow terminals. The new full mode should produce output in this style:

```
▶ Run /clear before continuing
▶ Next: /rapid:status  ·  init [done] > start-set [done] > ...
```

Specific implementation:

1. Remove the entire full-mode block (lines 150-194): the box-drawing character definitions, `contentLines` array, `maxLen`/`innerWidth` calculations, `topBorder`/`botBorder`, `truncate()`, `padLine()`, `emptyLine`, and the `boxLines` assembly loop.
2. Replace it with a simple line-based renderer:
   - If `clearRequired`, emit: `▶ Run /clear before continuing`
   - Build the next-command string: `▶ Next: ${nextCommand}`
   - If a breadcrumb is provided, append it inline to the next-command line separated by `  ·  ` (two spaces, middle dot U+00B7, two spaces). If the combined line exceeds `columns - 2`, truncate the breadcrumb with `...` so it fits.
   - If `noColor` is true, use `>` instead of `▶` (U+25B6) as the bullet character.
3. Return `'\n' + lines.join('\n')` (same trailing format as current).
4. The compact-mode branch (columns < 60) stays untouched -- it already uses the right approach.

**Do NOT:**
- Change the function signature or parameter names
- Modify the compact-mode branch (lines 136-148)
- Add ANSI color codes to the footer (it currently has none)
- Change the `noColor` detection logic

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test tests/display.test.cjs src/commands/display.test.cjs
```
Tests will fail initially because existing assertions check for box-drawing characters (`╔`, `╚`, `║`). That is expected -- Task 2 updates the tests.

**Done when:** `renderFooter()` produces at most 3 lines of output (1 blank leading + 1-2 content lines) at any terminal width >= 60, with no box-drawing characters.

---

## Task 2: Update tests to match new compact format

**Files:** `tests/display.test.cjs`, `src/commands/display.test.cjs`

**Action:**

Update both test files to assert the new compact output format instead of box-drawing layout.

### In `tests/display.test.cjs`:

1. **Test "basic output structure" (line 16):** Remove assertions for `╔`, `╚`, `║` box-drawing characters. Instead assert:
   - Output includes `▶ Run /clear before continuing` (or `>` prefix when `NO_COLOR`)
   - Output includes `Next: /rapid:plan-set 1`
   - Output is a string with no ANSI escape codes (keep existing assertion)
   - Total non-blank lines count is 2 (clear line + next line)

2. **Test "includes breadcrumb when provided" (line 27):** Keep the assertion that breadcrumb text appears and comes after `Next:`. No box-drawing assertions to remove here.

3. **Test "omits breadcrumb when not provided" (line 36):** Change the line filter -- no longer filtering for `║`. Assert there are exactly 2 non-blank lines (clear + next). Remove the `║`-based filter.

4. **Test "NO_COLOR uses ASCII box characters" (line 49):** Replace entirely. Assert that when `NO_COLOR=1`, the output uses `>` as bullet instead of `▶`. Assert it does NOT contain box-drawing characters (keep the negative assertions for `╔`, `║`).

5. **Test "box width adapts to content" (line 59):** Remove or replace this test entirely. With compact format there is no box. Replace with a test that verifies long breadcrumbs are truncated with `...` when they would exceed terminal width.

6. **Test "all three lines present with full options" (line 73):** Update the line filter (remove `║` dependency). Assert the output contains all three pieces of information: clear reminder, next command, and breadcrumb text, in that order. Assert the breadcrumb is on the same line as `Next:` (inline format).

### In `src/commands/display.test.cjs`:

1. **Test "full mode clamps width to terminal columns" (line 143):** Keep this test but the assertion stays the same -- all lines must be <= 60 chars. The compact format naturally satisfies this.

2. **Test "full mode truncates long lines with ellipsis" (line 155):** Keep -- assert `...` appears when breadcrumb is too long for 60-column terminal.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test tests/display.test.cjs src/commands/display.test.cjs
```

**Done when:** All tests pass with the new compact footer format. Zero test failures, zero box-drawing assertions remaining in footer tests.

---

## Task 3: Manual visual verification

**Files:** None (read-only verification)

**Action:**

Run the actual display command to visually confirm the output looks correct at different terminal widths.

```bash
cd /home/kek/Projects/RAPID
# Full width
node src/cli.cjs display footer '/rapid:status' --breadcrumb 'init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set > review > merge'

# Without breadcrumb
node src/cli.cjs display footer '/rapid:status'

# Without clear
node src/cli.cjs display footer '/rapid:status' --no-clear --breadcrumb 'init [done] > start-set'

# Narrow terminal simulation (compact mode, should be unchanged)
COLUMNS=40 node src/cli.cjs display footer '/rapid:status' --breadcrumb 'init [done] > start-set [done]'
```

Confirm:
- No box-drawing characters appear in full mode
- Output is 1-2 content lines (plus leading blank)
- Breadcrumb is inline with next command, separated by ` · `
- Long breadcrumbs are truncated with `...`
- Compact mode (COLUMNS=40) still works as before

**Done when:** Visual output matches the target format described in the task description. All four commands above produce correct output.
