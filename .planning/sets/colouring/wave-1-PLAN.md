# PLAN: colouring -- Wave 1

**Set:** colouring
**Wave:** 1 of 1
**Objective:** Switch bright ANSI backgrounds to dark, add 4 missing stage registrations, implement NO_COLOR support, and update all test assertions.

## Owned Files
- `src/lib/display.cjs` (modify)
- `src/lib/display.test.cjs` (modify)

---

## Task 1: Replace bright background codes with dark equivalents in display.cjs

**File:** `src/lib/display.cjs`

### Actions

1. In the `STAGE_BG` object (lines 55-73), replace every ANSI code from the bright range to dark:
   - `\x1b[104m` (bright blue) --> `\x1b[44m` (dark blue) -- applies to: init, set-init, discuss, wave-plan, plan-set, start-set, discuss-set, new-version, add-set, scaffold, branding
   - `\x1b[102m` (bright green) --> `\x1b[42m` (dark green) -- applies to: execute, execute-set, quick
   - `\x1b[101m` (bright red) --> `\x1b[41m` (dark red) -- applies to: review, merge, audit-version

2. Update the JSDoc comment on the `STAGE_BG` object (lines 46-54):
   - Change "bright background variants (10Xm)" to "dark background variants (4Xm)"
   - Change "bright blue bg" to "dark blue bg", "bright green bg" to "dark green bg", "bright red bg" to "dark red bg"

3. Update the inline comments on each STAGE_BG entry:
   - `// bright blue` --> `// dark blue`
   - `// bright green` --> `// dark green`
   - `// bright red` --> `// dark red`
   - Same for parenthetical variants like `// bright blue (planning stage)` --> `// dark blue (planning stage)`

### Verification
```bash
# No bright background codes (10Xm) should remain
! grep -P '\\x1b\[10[0-7]m' src/lib/display.cjs
# Dark codes should be present
grep -c '\\x1b\[4[0-7]m' src/lib/display.cjs
```

---

## Task 2: Add 4 missing stage registrations in display.cjs

**File:** `src/lib/display.cjs`

### Actions

1. Add entries to `STAGE_VERBS` (after `'audit-version': 'AUDITING'` on line 43):
   ```
   'unit-test': 'UNIT TESTING',
   'bug-hunt': 'BUG HUNTING',
   'uat': 'UAT TESTING',
   'bug-fix': 'BUG FIXING',
   ```

2. Add entries to `STAGE_BG` (after `'audit-version': '\x1b[41m'` -- which was just updated in Task 1):
   ```
   'unit-test': '\x1b[41m',    // dark red (review stage)
   'bug-hunt': '\x1b[41m',     // dark red (review stage)
   'uat': '\x1b[41m',          // dark red (review stage)
   'bug-fix': '\x1b[41m',      // dark red (review stage)
   ```
   All four use the red/review color group per the CONTEXT.md decision.

3. Update the JSDoc comment block above `STAGE_VERBS` (lines 17-25) to reflect 21 total stages. Add a new line:
   ```
   * Review  (4): unit-test, bug-hunt, uat, bug-fix
   ```

4. Update the JSDoc comment block above `STAGE_BG` (lines 46-54) to include the 4 new review stages in the "Review stages" parenthetical.

5. Update the `@param` JSDoc on `renderBanner` (line 81) to list the new stage names.

### Verification
```bash
# All 4 new verbs should exist
node -e "const d = require('./src/lib/display.cjs'); ['unit-test','bug-hunt','uat','bug-fix'].forEach(s => { if (!d.STAGE_VERBS[s]) throw new Error('missing verb: '+s); if (!d.STAGE_BG[s]) throw new Error('missing bg: '+s); }); console.log('OK')"
```

---

## Task 3: Implement NO_COLOR support in display.cjs

**File:** `src/lib/display.cjs`

### Actions

1. Update the module-level JSDoc (lines 3-8): change line 7 from `Always outputs colors (no NO_COLOR checking).` to `Respects NO_COLOR (https://no-color.org) when set to a non-empty value.`

2. In `renderBanner()` (line 85), add an NO_COLOR check **after** the unknown-stage fallback (line 90) but **before** the colored output construction (line 93). The logic:
   ```javascript
   // NO_COLOR support (https://no-color.org) -- any non-empty value suppresses color
   if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
     return `--- RAPID > ${verb}  ${target || ''} ---`;
   }
   ```

3. Important edge cases:
   - `NO_COLOR=''` (empty string) must NOT suppress color -- per no-color.org spec, only a "set" (non-empty) value suppresses
   - `NO_COLOR` unset (undefined) must NOT suppress color
   - The unknown-stage fallback (`[RAPID] Unknown stage: ...`) fires first and is not affected by NO_COLOR since it already has no ANSI codes
   - The NO_COLOR fallback format is `--- RAPID > VERB  target ---` (two spaces between verb and target, matching the colored format's double-space)

### Verification
```bash
# With NO_COLOR set, output should have no ANSI
node -e "process.env.NO_COLOR='1'; delete require.cache[require.resolve('./src/lib/display.cjs')]; const d = require('./src/lib/display.cjs'); const r = d.renderBanner('init'); if (r.includes('\x1b[')) throw new Error('ANSI found'); console.log('OK:', r)"
# With NO_COLOR empty, output SHOULD have ANSI
node -e "process.env.NO_COLOR=''; delete require.cache[require.resolve('./src/lib/display.cjs')]; const d = require('./src/lib/display.cjs'); const r = d.renderBanner('init'); if (!r.includes('\x1b[')) throw new Error('ANSI missing'); console.log('OK')"
```

---

## Task 4: Update display.test.cjs assertions

**File:** `src/lib/display.test.cjs`

### Actions

This is the largest task. Every test that references stage counts or ANSI codes needs updating.

#### 4a. Update stage count references (17 --> 21)

Every test description and stage-list array that says "17 stages" must change to "21 stages". There are 3 occurrences:
- Line 17: `it('maps all 17 stages to uppercase verb strings'` --> `'maps all 21 stages to uppercase verb strings'`
- Line 54: `it('maps all 17 stages to ANSI background escape codes'` --> `'maps all 21 stages to ANSI background escape codes'`
- Line 221: `it('all 17 stages produce valid banner strings'` --> `'maps all 21 stages produce valid banner strings'`

#### 4b. Add new stages to all expectedStages arrays

Add `'unit-test', 'bug-hunt', 'uat', 'bug-fix'` to every array that lists all stages. These arrays appear at:
- Line 19 (STAGE_VERBS test)
- Line 56 (STAGE_BG test)
- Line 223 (renderBanner all-stages test)
- Line 243 (renderBanner reset-code test)
- Line 257 (renderBanner padded-width test)

#### 4c. Add verb mapping assertions

In the "has expected verb mappings" test (starting line 32), add after the `audit-version` assertion (which is currently missing -- add it too):
```javascript
assert.equal(display.STAGE_VERBS['audit-version'], 'AUDITING');
assert.equal(display.STAGE_VERBS['unit-test'], 'UNIT TESTING');
assert.equal(display.STAGE_VERBS['bug-hunt'], 'BUG HUNTING');
assert.equal(display.STAGE_VERBS['uat'], 'UAT TESTING');
assert.equal(display.STAGE_VERBS['bug-fix'], 'BUG FIXING');
```

#### 4d. Replace all bright ANSI code assertions with dark equivalents

Every test that asserts specific ANSI escape codes must be updated:
- `\x1b[104m` --> `\x1b[44m]` in all planning-stage tests (lines 75, 277)
- `\x1b[102m` --> `\x1b[42m]` in all execution-stage tests (lines 87, 289)
- `\x1b[101m` --> `\x1b[41m]` in all review-stage tests (lines 99, 301)
- Update test descriptions too: "bright blue" --> "dark blue", "bright green" --> "dark green", "bright red" --> "dark red"

#### 4e. Add review stages to review-stage test arrays

The review-stage tests at lines 93 and 297 currently only list `['review', 'merge']`. They must be expanded to include all review stages:
```javascript
const reviewStages = ['review', 'merge', 'audit-version', 'unit-test', 'bug-hunt', 'uat', 'bug-fix'];
```

#### 4f. Add new NO_COLOR test block

Add a new `describe('NO_COLOR support', ...)` block inside the outer `describe('display', ...)`, after the `renderBanner` describe block (after line 321). This block should contain:

1. **Test: suppresses ANSI when NO_COLOR is set** -- Set `process.env.NO_COLOR = '1'`, clear require cache, require display, call `renderBanner('init')`, assert result does NOT contain `\x1b[`, assert result contains `--- RAPID >` and `INITIALIZING`, then `delete process.env.NO_COLOR`.

2. **Test: uses decorated ASCII format** -- Set `process.env.NO_COLOR = '1'`, clear require cache, call `renderBanner('execute', 'auth-system')`, assert result equals `--- RAPID > EXECUTING  auth-system ---`, then clean up.

3. **Test: does NOT suppress when NO_COLOR is empty string** -- Set `process.env.NO_COLOR = ''`, clear require cache, call `renderBanner('init')`, assert result DOES contain `\x1b[`, then clean up.

4. **Test: does NOT suppress when NO_COLOR is undefined** -- Delete `process.env.NO_COLOR`, clear require cache, call `renderBanner('init')`, assert result DOES contain `\x1b[`.

5. **Test: unknown stage fallback unaffected by NO_COLOR** -- Set `process.env.NO_COLOR = '1'`, clear require cache, call `renderBanner('nonexistent')`, assert result contains `Unknown stage`, then clean up.

Important for all NO_COLOR tests: each test must `delete require.cache[require.resolve(displayPath)]` before requiring, since the module is cached. And each test must clean up `process.env.NO_COLOR` after (delete it) to avoid polluting other tests.

#### 4g. Add banner tests for new stages

Add individual renderBanner tests for each new stage (inside the existing `describe('renderBanner', ...)` block), following the pattern of existing tests:

```javascript
it('renderBanner("unit-test") returns string containing "UNIT TESTING"', () => { ... });
it('renderBanner("bug-hunt") returns string containing "BUG HUNTING"', () => { ... });
it('renderBanner("uat") returns string containing "UAT TESTING"', () => { ... });
it('renderBanner("bug-fix") returns string containing "BUG FIXING"', () => { ... });
```

Each should assert: result includes 'RAPID', result includes the verb, result includes `\x1b[` (ANSI present).

### Verification
```bash
node --test src/lib/display.test.cjs
```

---

## Success Criteria

1. `node --test src/lib/display.test.cjs` -- all tests pass, 0 failures
2. No bright background codes (`10Xm`) remain anywhere in `display.cjs`
3. All 21 stages produce valid banners
4. `NO_COLOR=1 node -e "..."` produces output with zero ANSI escape sequences
5. `NO_COLOR='' node -e "..."` still produces colored output (empty string does not suppress)

## Commit Format

This wave produces a single commit touching both files:
```
feat(colouring): dark ANSI backgrounds, new stage banners, and NO_COLOR support
```
