# Quick Task 13: Responsive Footer for Terminal Width

## Objective

The RAPID display footer renders a box-drawing border sized to its longest content line, which can exceed 150 columns for breadcrumb-heavy commands. On narrow terminals (< 80 cols) this wraps uglily and becomes unreadable. Detect terminal width at render time and produce a compact layout when space is limited.

## Current Behavior

`renderFooter()` in `src/lib/display.cjs` calculates `innerWidth = Math.max(maxLen + 4, 40)` and draws a fixed-width box. The longest real-world breadcrumbs push the box to ~155 columns. There is no terminal-width detection and no truncation or wrapping logic.

## Design

- Read `process.stdout.columns` (Node.js provides this; defaults to 80 if undefined, e.g., piped output).
- Define two layout modes:
  - **Full mode** (terminal >= 60 columns): Current box-drawing layout, but clamp `innerWidth` to `columns - 2` so the box never exceeds terminal width. Truncate content lines that exceed the available inner width with an ellipsis.
  - **Compact mode** (terminal < 60 columns): Drop the box-drawing frame entirely. Render plain text lines with a leading `---` separator, abbreviate breadcrumb stages (e.g., `[done]` to `[ok]`), and abbreviate the `/clear` line to just `> /clear`.
- The banner (`renderBanner`) does not need changes -- it is already fixed at 50 visible chars which fits any reasonable terminal.

---

## Task 1: Add terminal-width-aware layout to `renderFooter()`

**Files:** `src/lib/display.cjs`

**Action:**

1. At the top of `renderFooter()`, read terminal width: `const columns = process.stdout.columns || 80;`.
2. Add a compact mode check: `const compact = columns < 60;`.
3. For **full mode**:
   - Clamp `innerWidth` to `Math.min(currentInnerWidth, columns - 2)` (the `-2` accounts for the left and right border characters).
   - Before padding each content line, if a line's length exceeds `innerWidth - 4` (the inner padding), truncate it to `innerWidth - 7` characters and append `...`.
4. For **compact mode**:
   - Skip box-drawing entirely.
   - Render a plain `---` separator line.
   - If `clearRequired`, output `> /clear` instead of the full sentence.
   - Output `> ${nextCommand}` for the next command.
   - If breadcrumb exists, abbreviate `[done]` to `[ok]` globally, then output it prefixed with `> `.
   - End with another `---` separator.
5. Both modes still respect `NO_COLOR` (compact mode uses no ANSI codes anyway, so this is inherently compatible).

**Verification:**

```bash
# Full mode -- box should not exceed 60 columns
COLUMNS=60 node -e "
  process.stdout.columns = 60;
  const { renderFooter } = require('./src/lib/display.cjs');
  const out = renderFooter('/rapid:execute-set auth', { breadcrumb: 'init [done] > start-set [done] > discuss-set [done] > plan-set [done] > execute-set > review > merge', clearRequired: true });
  const lines = out.split('\n');
  const maxWidth = Math.max(...lines.map(l => l.length));
  console.log('Max line width:', maxWidth, maxWidth <= 60 ? 'OK' : 'FAIL');
  console.log(out);
"

# Compact mode -- no box characters, abbreviated
COLUMNS=40 node -e "
  process.stdout.columns = 40;
  const { renderFooter } = require('./src/lib/display.cjs');
  const out = renderFooter('/rapid:execute-set auth', { breadcrumb: 'init [done] > start-set [done]', clearRequired: true });
  console.log(out);
  const hasBox = out.includes('╔') || out.includes('╚');
  console.log('No box chars:', !hasBox ? 'OK' : 'FAIL');
"
```

**Done when:** `renderFooter()` never produces lines wider than `process.stdout.columns`, and terminals under 60 columns get a compact frameless layout.

---

## Task 2: Update unit tests for responsive footer behavior

**Files:** `src/commands/display.test.cjs`

**Action:**

1. Add a test group `describe('renderFooter -- responsive layout')` that imports `renderFooter` directly from `src/lib/display.cjs`.
2. Add test: **full mode clamps width** -- set `process.stdout.columns = 60`, call `renderFooter` with a long breadcrumb, assert no output line exceeds 60 characters.
3. Add test: **full mode truncates long lines with ellipsis** -- set `process.stdout.columns = 50`, call `renderFooter` with a breadcrumb longer than 50 chars, assert the breadcrumb line contains `...`.
4. Add test: **compact mode renders without box** -- set `process.stdout.columns = 40`, call `renderFooter`, assert output does not contain box-drawing characters (`\u2550`, `\u2551`, `\u2554`, `\u255A`).
5. Add test: **compact mode abbreviates [done] to [ok]** -- set `process.stdout.columns = 40`, call with breadcrumb containing `[done]`, assert output contains `[ok]` and not `[done]`.
6. Add test: **compact mode abbreviates clear line** -- set `process.stdout.columns = 40`, call with `clearRequired: true`, assert output contains `> /clear` and not `Run /clear before continuing`.
7. In each test, save and restore `process.stdout.columns` in before/after hooks to avoid test pollution.

**Verification:**

```bash
node --test src/commands/display.test.cjs
```

**Done when:** All existing tests still pass and the new responsive tests pass.

---

## Task 3: Update contract test to cover width-clamped output

**Files:** `src/bin/contract.test.cjs`

**Action:**

1. Locate the existing `display footer returns raw text (NOT JSON)` test.
2. Add a sibling test: **display footer respects terminal width** -- run the CLI with `COLUMNS=50` env var set, invoke `display footer "/rapid:test-cmd" --breadcrumb "init [done] > start-set [done] > discuss-set [done] > plan-set [done]"`, assert every non-empty output line is <= 50 characters wide.
3. Note: The CLI spawns a subprocess, so `process.stdout.columns` won't propagate directly. Instead, in the `renderFooter` function (Task 1), also check `process.env.COLUMNS` as a fallback: `const columns = process.stdout.columns || parseInt(process.env.COLUMNS, 10) || 80;`. This makes it testable from subprocess invocations.

**Verification:**

```bash
node --test src/bin/contract.test.cjs
```

**Done when:** Contract test suite passes with the new width-awareness test.

---

## Success Criteria

1. `node --test src/commands/display.test.cjs` -- all tests pass (existing + new responsive tests)
2. `node --test src/bin/contract.test.cjs` -- all tests pass (existing + new width test)
3. Real-world verification at 40 cols: `COLUMNS=40 node -e "process.stdout.columns=40; console.log(require('./src/lib/display.cjs').renderFooter('/rapid:plan-set 1', {breadcrumb:'init [done] > start-set [done] > plan-set',clearRequired:true}))"` produces compact output with no box
4. Real-world verification at 80 cols: same command with 80 produces box output clamped to 80 cols
5. No changes to `renderBanner()` (already 50 chars fixed width)
