# Wave 1 PLAN: Foundation -- renderFooter(), CLI Subcommand, Policy, Unit Tests

## Objective

Build the renderFooter() utility function in `src/lib/display.cjs`, wire the `display footer` CLI subcommand in `src/commands/display.cjs`, create the CLEAR-POLICY.md reference document, and write comprehensive unit tests for renderFooter(). This wave establishes the complete foundation that Wave 2 will consume when wiring footers into skills.

## Files Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/display.cjs` | Modify | Add `renderFooter()` function and export it |
| `src/commands/display.cjs` | Modify | Add `case 'footer':` subcommand handler |
| `tests/display.test.cjs` | Create | Unit tests for renderFooter() |
| `.planning/CLEAR-POLICY.md` | Create | Policy document defining footer inclusion rules |

---

## Task 1: Implement renderFooter() in display.cjs

**File:** `src/lib/display.cjs`

**Action:** Add a `renderFooter(nextCommand, options)` function after the existing `renderBanner()` function (after line 111), and add it to the `module.exports` at the end.

**Behavior:**

1. `renderFooter(nextCommand, options?)` returns a multi-line string (does NOT write to stdout -- the caller decides output).
2. Parameters:
   - `nextCommand` (string, required): The next command to suggest (e.g., `/rapid:plan-set 1`).
   - `options` (object, optional):
     - `breadcrumb` (string, optional): Raw breadcrumb string to display as-is.
     - `clearRequired` (boolean, optional, default `true`): Whether to include the `/clear` reminder line.
3. The function builds an array of content lines:
   - If `clearRequired` is true (or omitted): add line `  Run /clear before continuing`
   - Always add line `  Next: {nextCommand}`
   - If `breadcrumb` is provided and non-empty: add line `  {breadcrumb}`
4. Calculate the separator width: find the longest content line's length, add 4 for padding (minimum width 40).
5. Build the separator string using `'─'` (U+2500, box-drawing horizontal) repeated to the calculated width.
6. Return: `\n{separator}\n{content lines joined by \n}\n{separator}`
7. The leading `\n` ensures visual separation from preceding output.

**NO_COLOR handling:** The footer uses no ANSI color codes, so NO_COLOR has no practical effect on the output. However, for contract compliance, if `process.env.NO_COLOR` is set to a non-empty value, use `-` (ASCII hyphen) instead of `─` (box-drawing) for the separator character. This mirrors the renderBanner() pattern of providing a plain-text alternative.

**Export:** Update `module.exports` from `{ renderBanner, STAGE_VERBS, STAGE_BG }` to `{ renderBanner, renderFooter, STAGE_VERBS, STAGE_BG }`.

**What NOT to do:**
- Do NOT add ANSI color codes to the footer. It is plain text only.
- Do NOT add the RAPID brand motif or logo to the footer.
- Do NOT hardcode a fixed width -- the width adapts to content.
- Do NOT write to stdout inside renderFooter() -- return the string.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node -e "
const { renderFooter } = require('./src/lib/display.cjs');
const out = renderFooter('/rapid:plan-set 1', { breadcrumb: 'init [done] > start-set [done] > discuss-set > plan-set' });
console.log(out);
console.log('---');
// Verify no ANSI codes
if (out.includes('\x1b')) { console.error('FAIL: contains ANSI codes'); process.exit(1); }
// Verify separator uses box-drawing char
if (!out.includes('─')) { console.error('FAIL: missing box-drawing separator'); process.exit(1); }
// Verify /clear line present
if (!out.includes('Run /clear before continuing')) { console.error('FAIL: missing /clear reminder'); process.exit(1); }
// Verify next command present
if (!out.includes('Next: /rapid:plan-set 1')) { console.error('FAIL: missing next command'); process.exit(1); }
// Verify breadcrumb present
if (!out.includes('init [done]')) { console.error('FAIL: missing breadcrumb'); process.exit(1); }
console.log('PASS: renderFooter basic test');
"
```

---

## Task 2: Wire display footer CLI subcommand

**File:** `src/commands/display.cjs`

**Action:** Add a `case 'footer':` block to the existing switch statement in `handleDisplay()`, after the `case 'banner':` block (after line 18).

**Behavior:**

1. Parse args:
   - `args[0]` is the next-command string (required). If missing, throw `CliError('Usage: rapid-tools display footer <next-command> [--breadcrumb "<text>"]')`.
   - Scan remaining args for `--breadcrumb` flag: find the index of `'--breadcrumb'` in `args.slice(1)`, and if found, the value is `args[flagIndex + 2]` (the arg after the flag). Use the raw string value as-is.
   - Scan for `--no-clear` flag: if `'--no-clear'` is present in args, set clearRequired to false.
2. Call `renderFooter(nextCommand, { breadcrumb, clearRequired })` from `../lib/display.cjs`.
3. Write the result to `process.stdout.write(result + '\n')`.

**Import update:** The existing lazy require at line 6 loads `renderBanner` only. Change it to also destructure `renderFooter`: `const { renderBanner, renderFooter } = require('../lib/display.cjs');`

Actually, since the require is inside the function body and only `renderBanner` is destructured, move the require to be shared at the top of the switch or destructure both. The simplest approach: change the existing destructure on line 6 to `const { renderBanner, renderFooter } = require('../lib/display.cjs');` -- this is fine since both cases need the same module.

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node src/bin/rapid-tools.cjs display footer "/rapid:plan-set 1" --breadcrumb "init [done] > start-set [done] > discuss-set > plan-set"
```
Expected: Multi-line footer output with separator, /clear line, next command, and breadcrumb.

```bash
cd /home/kek/Projects/RAPID && node src/bin/rapid-tools.cjs display footer "/rapid:execute-set 1"
```
Expected: Footer without breadcrumb line, but with /clear and next command.

```bash
cd /home/kek/Projects/RAPID && node src/bin/rapid-tools.cjs display footer "/rapid:review 1" --no-clear
```
Expected: Footer without /clear line, just next command.

---

## Task 3: Create CLEAR-POLICY.md

**File:** `.planning/CLEAR-POLICY.md`

**Action:** Create a new markdown document defining the /clear footer policy.

**Content structure:**

1. Title: `# CLEAR Policy -- Footer Inclusion Rules`
2. Brief prose paragraph explaining the purpose: all lifecycle skills display a standardized footer at completion with a /clear reminder, next command suggestion, and optional progress breadcrumb. The footer is produced by `renderFooter()` in `src/lib/display.cjs` and invoked via `node "${RAPID_TOOLS}" display footer`.
3. Markdown table with columns: `| Skill | Footer | Next Command Pattern | Notes |`
4. Rows for all skills that get footers (18 total):

| Skill | Footer | Next Command Pattern | Notes |
|-------|--------|---------------------|-------|
| init | Yes | `/rapid:start-set 1` | First lifecycle step; suggests starting first set |
| start-set | Yes | `/rapid:discuss-set {setIndex}` | Pipeline progression |
| discuss-set | Yes | `/rapid:plan-set {setIndex}` | Pipeline progression |
| plan-set | Yes | `/rapid:execute-set {setIndex}` | Pipeline progression; `--gaps` variant exists |
| execute-set | Yes | `/rapid:review {setIndex}` | Pipeline progression; conditional on gap status |
| review | Yes | `/rapid:unit-test {setIndex}` | Scoping step before test stages |
| merge | Yes | `/rapid:cleanup` or `/rapid:new-version` | Terminal pipeline step; multiple next options |
| new-version | Yes | `/rapid:start-set 1` | Starts new milestone cycle |
| add-set | Yes | `/rapid:start-set {setIndex}` | Ad-hoc set addition |
| scaffold | Yes | `/rapid:start-set` | Foundation generation |
| audit-version | Yes | `/rapid:new-version` or `/rapid:add-set` | Milestone audit |
| quick | Yes | `/rapid:status` | Ad-hoc task |
| branding | Yes | `/rapid:status` | Artifact generation |
| documentation | Yes | `/rapid:status` | Artifact generation |
| unit-test | Yes | `/rapid:bug-hunt {setIndex}` | Review sub-pipeline |
| bug-hunt | Yes | `/rapid:uat {setIndex}` | Review sub-pipeline |
| uat | Yes | `/rapid:review summary {setIndex}` | Review sub-pipeline |
| bug-fix | Yes | `/rapid:status` | Standalone fix |

5. Rows for skills that do NOT get footers:

| Skill | Footer | Notes |
|-------|--------|-------|
| help | No | Informational only, no artifacts |
| install | No | One-time setup, not a workflow step |
| status | No | Read-only dashboard |
| cleanup | No | Maintenance utility |
| pause | No | State management utility |
| resume | No | State management utility |
| assumptions | No | Research utility |
| context | No | Research utility |
| migrate | No | One-time migration |
| register-web | No | One-time registration |

6. Brief "Rationale" section: Footer is shown by skills that generate artifacts or consume significant context. Informational, setup, and maintenance skills that produce no artifacts and consume minimal context are excluded.

**What NOT to do:**
- Do NOT couple this document to the structural test -- the test uses its own independent canonical list.
- Do NOT add implementation details to this document -- it is policy only.

**Verification:**
```bash
test -f /home/kek/Projects/RAPID/.planning/CLEAR-POLICY.md && echo "PASS: CLEAR-POLICY.md exists" || echo "FAIL: missing"
```

---

## Task 4: Create unit tests for renderFooter()

**File:** `tests/display.test.cjs`

**Action:** Create a new test file using Node.js built-in test runner (`node:test`).

**Test cases:**

1. **basic output structure**: Call `renderFooter('/rapid:plan-set 1')` with no options. Assert:
   - Result is a string.
   - Contains `'Run /clear before continuing'`.
   - Contains `'Next: /rapid:plan-set 1'`.
   - Contains the `─` separator character.
   - Does NOT contain ANSI escape codes (`\x1b`).

2. **includes breadcrumb when provided**: Call with `{ breadcrumb: 'init [done] > start-set' }`. Assert:
   - Contains the breadcrumb text.
   - Breadcrumb appears after the next-command line.

3. **omits breadcrumb when not provided**: Call without breadcrumb option. Assert:
   - Output has exactly 2 content lines between separators (clear + next).

4. **clearRequired false omits clear line**: Call with `{ clearRequired: false }`. Assert:
   - Does NOT contain `'Run /clear'`.
   - Still contains next command.

5. **NO_COLOR uses ASCII separator**: Set `process.env.NO_COLOR = '1'`, call renderFooter. Assert:
   - Contains `'-'` separator instead of `'─'`.
   - Clean up: delete `process.env.NO_COLOR` after test.

6. **separator width adapts to content**: Call with a short next command and a long next command. Assert:
   - Separator length differs between the two calls.
   - Separator is at least 40 characters.

7. **all three lines present with full options**: Call with next command, breadcrumb, and clearRequired true. Assert:
   - Contains all three content lines in order: clear, next, breadcrumb.

8. **renderFooter is exported**: Assert `typeof renderFooter === 'function'`.

**Test file structure:**
```javascript
'use strict';
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { renderFooter } = require('../src/lib/display.cjs');
// ... test cases
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID && node --test tests/display.test.cjs
```
Expected: All tests pass.

---

## Success Criteria

- [ ] `renderFooter()` is exported from `src/lib/display.cjs` and returns correct multi-line footer string
- [ ] `node rapid-tools.cjs display footer "<cmd>"` works from CLI with optional `--breadcrumb` and `--no-clear` flags
- [ ] `.planning/CLEAR-POLICY.md` exists with complete skill categorization table
- [ ] All unit tests in `tests/display.test.cjs` pass via `node --test`
- [ ] No existing tests are broken (run `node --test tests/merge-regression.test.cjs`)
