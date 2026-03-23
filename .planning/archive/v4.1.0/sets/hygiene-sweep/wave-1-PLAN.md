# PLAN: hygiene-sweep / Wave 1 -- Repository URL Correction

## Objective

Replace all user-facing references to `fishjojo1/RAPID` with `pragnition/RAPID` across documentation and service files. This corrects the clone/install URLs to point to the canonical organization repository.

## Scope

4 files, 5 replacements. All are literal string substitutions.

**Excluded from modification** (per CONTEXT.md decisions):
- `.claude-plugin/plugin.json` -- personal author attribution stays
- `.planning/` files -- historical records
- `issues-todo.md`, `issues.md` -- temporary scratch files

---

## Task 1: Update DOCS.md

**File:** `DOCS.md`
**Action:** Replace 2 occurrences of `fishjojo1` with `pragnition`.

Specific replacements:
1. Line 25: `claude plugin add fishjojo1/RAPID` -> `claude plugin add pragnition/RAPID`
2. Line 33: `git clone https://github.com/fishjojo1/RAPID.git` -> `git clone https://github.com/pragnition/RAPID.git`

**Verification:**
```bash
grep -n "fishjojo1" DOCS.md  # Expected: zero matches
grep -c "pragnition" DOCS.md  # Expected: >= 2
```

---

## Task 2: Update README.md

**File:** `README.md`
**Action:** Replace 1 occurrence of `fishjojo1` with `pragnition`.

Specific replacement:
1. Line 22: `claude plugin add fishjojo1/RAPID` -> `claude plugin add pragnition/RAPID`

**Verification:**
```bash
grep -n "fishjojo1" README.md  # Expected: zero matches
grep -c "pragnition" README.md  # Expected: >= 1
```

---

## Task 3: Update LICENSE

**File:** `LICENSE`
**Action:** Replace 1 occurrence of `fishjojo1` with `pragnition`.

Specific replacement:
1. Line 3: `Copyright (c) 2026 fishjojo1` -> `Copyright (c) 2026 pragnition`

**Verification:**
```bash
grep -n "fishjojo1" LICENSE  # Expected: zero matches
grep "pragnition" LICENSE  # Expected: 1 match on copyright line
```

---

## Task 4: Update rapid-web.service

**File:** `web/backend/service/rapid-web.service`
**Action:** Replace 1 occurrence of `fishjojo1` with `pragnition` in the Documentation URL.

Specific replacement:
1. Line 4: `Documentation=https://github.com/fishjojo1/RAPID` -> `Documentation=https://github.com/pragnition/RAPID`

**Do NOT modify** the `__RAPID_ROOT__` template placeholders on lines 8-9 -- those are unrelated.

**Verification:**
```bash
grep -n "fishjojo1" web/backend/service/rapid-web.service  # Expected: zero matches
grep "pragnition" web/backend/service/rapid-web.service  # Expected: 1 match
```

---

## Task 5: Final URL sweep verification

**Action:** Run a comprehensive grep across the entire tree to confirm zero actionable `fishjojo1` references remain.

**Verification:**
```bash
grep -r "fishjojo1" \
  --include="*.md" --include="*.service" --include="*.json" \
  /home/kek/Projects/RAPID/ \
  | grep -v ".planning/" \
  | grep -v ".archive/" \
  | grep -v "plugin.json" \
  | grep -v "issues-todo.md" \
  | grep -v "issues.md" \
  | grep -v "agents/"
# Expected: zero matches
```

---

## Success Criteria

1. Zero `fishjojo1` references in DOCS.md, README.md, LICENSE, or rapid-web.service
2. All replacement strings read `pragnition/RAPID` (not `pragnition/rapid` or other variants)
3. No modifications to plugin.json, .planning/ files, or issues files
4. `__RAPID_ROOT__` placeholders in rapid-web.service are untouched
