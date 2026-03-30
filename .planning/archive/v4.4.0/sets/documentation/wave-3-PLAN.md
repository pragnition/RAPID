# PLAN: documentation / Wave 3 -- Cross-Reference Audit

## Objective

Verify 100% documentation coverage: every skill in `skills/` has corresponding documentation in DOCS.md and/or docs/ files. Fix any gaps or stale references found during the audit. This is the final quality gate before the set is considered complete.

## Tasks

### Task 1: Cross-Reference Audit

**Files to read (not modify unless gaps found):** `DOCS.md`, all `docs/*.md` files, `skills/` directory listing.

**Action:** Perform a systematic audit:

1. **Enumerate all 28 skills** by listing `skills/` subdirectories (exclude any `.test.cjs` files):
   add-set, assumptions, audit-version, branding, bug-fix, bug-hunt, cleanup, context, discuss-set, documentation, execute-set, help, init, install, merge, migrate, new-version, pause, plan-set, quick, register-web, resume, review, scaffold, start-set, status, uat, unit-test

2. **For each skill, verify:**
   - It appears in DOCS.md (search for the skill name)
   - It appears in at least one docs/ file (search all docs/*.md files)
   - The description in DOCS.md matches the SKILL.md canonical description (no contradictions)

3. **Check for stale references:**
   - Search all owned files for "v3.0", "v3.5", "26 agents", "technical_documentation.md"
   - Search for any command references that do not exist in skills/ (e.g., old deprecated names used as if current)
   - Search for references to removed features or files

4. **Fix any gaps found:**
   - If a skill is missing from DOCS.md, add it in the appropriate section
   - If a docs/ file has stale references, update them
   - If descriptions contradict SKILL.md, update to match SKILL.md

**Verification script (run this as the primary verification):**
```bash
#!/bin/bash
PASS=true

# 1. Check every skill is in DOCS.md
for skill in add-set assumptions audit-version branding bug-fix bug-hunt cleanup context discuss-set documentation execute-set help init install merge migrate new-version pause plan-set quick register-web resume review scaffold start-set status uat unit-test; do
  if ! grep -q "$skill" DOCS.md; then
    echo "FAIL: $skill missing from DOCS.md"
    PASS=false
  fi
done

# 2. Check no stale version references
for file in README.md DOCS.md docs/*.md; do
  if grep -q "RAPID v3\.0" "$file" 2>/dev/null; then
    echo "FAIL: Stale 'RAPID v3.0' in $file"
    PASS=false
  fi
  if grep -q "26 agents" "$file" 2>/dev/null; then
    echo "FAIL: Stale '26 agents' in $file"
    PASS=false
  fi
  if grep -q "technical_documentation\.md" "$file" 2>/dev/null; then
    echo "FAIL: Stale technical_documentation.md reference in $file"
    PASS=false
  fi
done

# 3. Check breadcrumb headers in docs/ files
for file in docs/setup.md docs/planning.md docs/execution.md docs/review.md docs/merge-and-cleanup.md docs/agents.md docs/state-machines.md docs/troubleshooting.md docs/configuration.md docs/auxiliary.md; do
  if [ -f "$file" ] && ! head -1 "$file" | grep -q "DOCS.md"; then
    echo "FAIL: Missing breadcrumb in $file"
    PASS=false
  fi
done

# 4. Check CHANGELOG has non-empty version entries
for version in "v4.2.1" "v4.3.0"; do
  if ! grep -A 3 "$version" docs/CHANGELOG.md | grep -q "Added\|Changed\|Fixed"; then
    echo "FAIL: Empty changelog entry for $version"
    PASS=false
  fi
done

# 5. Check DOCS.md version
if ! grep -q "4.4.0" DOCS.md; then
  echo "FAIL: DOCS.md version not updated to 4.4.0"
  PASS=false
fi

# 6. Check agents.md has 27 agents
if ! grep -q "27" docs/agents.md; then
  echo "FAIL: agents.md does not reference 27 agents"
  PASS=false
fi

if $PASS; then
  echo "AUDIT PASSED: All checks green"
else
  echo "AUDIT FAILED: See above"
  exit 1
fi
```

### Task 2: Fix Audit Failures

**Files:** Any file from Wave 1 or Wave 2 that has audit failures.

**Action:** For each failure reported by the audit script, make the targeted fix. Re-run the audit script until all checks pass.

**What NOT to do:**
- Do not rewrite sections that passed the audit -- only fix failures
- Do not modify files outside this set's ownership (README.md, DOCS.md, docs/*.md)

**Verification:** Re-run the full audit script above. All checks must pass.

## Success Criteria

- Audit script runs and reports "AUDIT PASSED: All checks green"
- Every one of the 28 skills appears in DOCS.md
- No stale version references in any owned file
- All docs/ files have breadcrumb headers
- CHANGELOG has populated entries for v4.2.1 and v4.3.0
- docs/agents.md references 27 agents
