# PLAN: Update Version References to v3.4.0

## Objective

Bump all user-facing and configuration version strings from their current values (mix of 3.0.0, 3.3.0, 3.3.1) to 3.4.0. This ensures the plugin metadata, skill prompts, config, and documentation all consistently reflect the current release version.

## Scope

Only files that declare the **current version** of RAPID or reference it in user-facing skill text. Excludes: test fixtures, archive/research docs, historical comments, STATE.json (already correct), and source code where the version is read dynamically from package.json.

---

## Task 1: Update package metadata files

**Files:**
- `package.json` (line 3: `"version": "3.3.0"` -> `"3.4.0"`)
- `.claude-plugin/plugin.json` (line 3: `"version": "3.3.1"` -> `"3.4.0"`)
- `.planning/config.json` (line 4: `"version": "3.0.0"` -> `"3.4.0"`)

**Action:**
In each file, replace the `"version"` field value with `"3.4.0"`.

**Verification:**
```bash
node -e "
  const files = ['package.json', '.claude-plugin/plugin.json', '.planning/config.json'];
  const ok = files.every(f => { const v = require('./' + f).version || require('./' + f).project?.version; const pass = v === '3.4.0'; console.log(f + ': ' + v + (pass ? ' OK' : ' FAIL')); return pass; });
  process.exit(ok ? 0 : 1);
"
```

**Done when:** All three files report version `3.4.0`.

---

## Task 2: Update DOCS.md version header

**Files:**
- `DOCS.md` (line 5: `**Version:** 3.0.0` -> `**Version:** 3.4.0`)

**Action:**
Replace the version line near the top of DOCS.md.

**Verification:**
```bash
grep -n '^\*\*Version:\*\*' DOCS.md
# Expected: **Version:** 3.4.0
```

**Done when:** The grep output shows `**Version:** 3.4.0` and no other version lines.

---

## Task 3: Update skill file version references

**Files:**
- `skills/install/SKILL.md` -- Replace all `v3.3.0` occurrences with `v3.4.0` (description line, heading, body text). There are approximately 7 occurrences.
- `skills/status/SKILL.md` -- Replace all `v3.3.0` occurrences with `v3.4.0` (heading, body text, rules section). There are approximately 6 occurrences.
- `skills/help/SKILL.md` -- Replace all `v3.3.0` occurrences with `v3.4.0` (heading, footer). There are 2 occurrences.

**Action:**
In each file, do a global find-and-replace of `v3.3.0` with `v3.4.0`. Do NOT touch any other version strings (e.g., `v3.0` in historical context comments, or `v3` as a generic architecture reference).

**What NOT to do:**
- Do not modify `skills/new-version/SKILL.md` or `skills/init/SKILL.md` -- their `v3` references are about the v3 architecture, not the release version.
- Do not modify `src/lib/display.cjs` line 22 -- the `v3.0` there is a historical changelog comment.
- Do not modify `src/lib/version.cjs` line 9 -- the `'3.0.0'` there is a JSDoc example format, not an actual version.

**Verification:**
```bash
# Should return zero matches in skill files
grep -rn 'v3\.3\.0' skills/install/SKILL.md skills/status/SKILL.md skills/help/SKILL.md && echo "FAIL: stale v3.3.0 refs remain" || echo "OK: no stale refs"

# Should show the new version
grep -rn 'v3\.4\.0' skills/install/SKILL.md skills/status/SKILL.md skills/help/SKILL.md | head -5
```

**Done when:** Zero `v3.3.0` matches in the three skill files, and `v3.4.0` appears in their expected locations.

---

## Success Criteria

1. `package.json`, `.claude-plugin/plugin.json`, and `.planning/config.json` all declare version `3.4.0`
2. `DOCS.md` header shows `**Version:** 3.4.0`
3. `skills/install/SKILL.md`, `skills/status/SKILL.md`, and `skills/help/SKILL.md` reference `v3.4.0` with zero remaining `v3.3.0` occurrences
4. `npm test` passes (no test breakage from version changes)
