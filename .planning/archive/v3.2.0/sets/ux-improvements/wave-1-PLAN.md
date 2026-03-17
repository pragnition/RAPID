# Wave 1 PLAN: Banner Color Change

**Set:** ux-improvements
**Wave:** 1
**Objective:** Change all 9 planning-stage banner backgrounds from bright blue (`\x1b[104m`) to dark purple/magenta (`\x1b[45m`) in `src/lib/display.cjs`, and update the corresponding test assertions in `src/lib/display.test.cjs`.

---

## Task 1: Update STAGE_BG planning colors in display.cjs

**Files:** `src/lib/display.cjs`

**Action:**

In the `STAGE_BG` object (lines 50-65), replace `\x1b[104m` with `\x1b[45m` for all 9 planning-stage entries:

1. `'init': '\x1b[45m'` (was `\x1b[104m`)
2. `'set-init': '\x1b[45m'` (was `\x1b[104m`)
3. `'discuss': '\x1b[45m'` (was `\x1b[104m`)
4. `'wave-plan': '\x1b[45m'` (was `\x1b[104m`)
5. `'plan-set': '\x1b[45m'` (was `\x1b[104m`)
6. `'start-set': '\x1b[45m'` (was `\x1b[104m`)
7. `'discuss-set': '\x1b[45m'` (was `\x1b[104m`)
8. `'new-version': '\x1b[45m'` (was `\x1b[104m`)
9. `'add-set': '\x1b[45m'` (was `\x1b[104m`)

Also update the comment block above STAGE_BG (lines 42-49) to say "dark purple bg" or "magenta bg" instead of "bright blue bg" for planning stages.

Do NOT change execution stages (`execute`, `execute-set`, `quick` -- remain `\x1b[102m`) or review stages (`review`, `merge` -- remain `\x1b[101m`).

**Verification:**

```bash
node -e "const d = require('./src/lib/display.cjs'); const planning = ['init','set-init','discuss','wave-plan','plan-set','start-set','discuss-set','new-version','add-set']; const ok = planning.every(s => d.STAGE_BG[s] === '\x1b[45m'); const exec_ok = ['execute','execute-set','quick'].every(s => d.STAGE_BG[s] === '\x1b[102m'); const rev_ok = ['review','merge'].every(s => d.STAGE_BG[s] === '\x1b[101m'); console.log('Planning purple:', ok, '| Execution green:', exec_ok, '| Review red:', rev_ok); if (!ok || !exec_ok || !rev_ok) process.exit(1);"
```

**Done when:** All 9 planning stages use `\x1b[45m`. Execution and review stages are unchanged.

---

## Task 2: Update display.test.cjs to match new purple color

**Files:** `src/lib/display.test.cjs`

**Action:**

Update 2 test blocks that assert `\x1b[104m` for planning stages:

1. **STAGE_BG test (around line 67-77):** The test titled `'planning stages ... use blue background ANSI code'` asserts `\x1b[104m`. Change:
   - The test title from "blue background" to "dark purple background" (or "magenta background")
   - The expected value from `'\x1b[104m'` to `'\x1b[45m'`
   - The assertion message from "bright blue background (\\x1b[104m)" to "dark purple background (\\x1b[45m)"

2. **renderBanner test (around line 269-279):** The test titled `'planning stages use blue background ANSI code in banner'` asserts `result.includes('\x1b[104m')`. Change:
   - The test title from "blue background" to "dark purple background"
   - The `includes` check from `'\x1b[104m'` to `'\x1b[45m'`
   - The assertion message from "bright blue background code (\\x1b[104m)" to "dark purple background code (\\x1b[45m)"

Do NOT change execution-stage tests (`\x1b[102m`) or review-stage tests (`\x1b[101m`).

**Verification:**

```bash
cd /home/kek/Projects/RAPID && node --test src/lib/display.test.cjs
```

**Done when:** All display tests pass with the new purple color assertions. No test references `\x1b[104m`.

---

## Success Criteria

- [ ] All 9 planning-stage entries in `STAGE_BG` use `\x1b[45m`
- [ ] Execution stages remain `\x1b[102m`, review stages remain `\x1b[101m`
- [ ] All display.test.cjs assertions pass with the new color
- [ ] No remaining references to `\x1b[104m` in either file
- [ ] `node --test src/lib/display.test.cjs` exits 0
