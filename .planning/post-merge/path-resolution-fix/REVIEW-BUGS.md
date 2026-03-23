# REVIEW-BUGS: path-resolution-fix

## Summary
| Metric | Value |
|--------|-------|
| Cycle | 1 |
| Total Findings | 7 |
| Accepted | 3 |
| Dismissed | 4 |
| Deferred | 0 |

## Accepted Findings

### BUG-1: CONTEXT.md claims phantom 5th require() occurrence
- **File:** `.planning/sets/path-resolution-fix/CONTEXT.md`
- **Line:** 45
- **Severity:** medium
- **Evidence:** `- init/SKILL.md has 3 broken requires: context.cjs (line ~564), add-set.cjs (line ~901, inside node -e), web-client.cjs (line ~971)`
- **Suggested Fix:** Correct CONTEXT.md to reflect the actual 4 occurrences (2 per file). Remove the phantom add-set.cjs reference.
- **Judge Ruling:** ACCEPTED
- **Judge Leaning:** accept (confidence: high)
- **Concern:** set-planning-artifacts

### BUG-2: CONTEXT.md scope count contradicts SET-OVERVIEW.md
- **File:** `.planning/sets/path-resolution-fix/CONTEXT.md`
- **Line:** 16
- **Severity:** low
- **Evidence:** `- Fix all 5 occurrences across both files (3 in init/SKILL.md, 2 in register-web/SKILL.md), not just the 4 specified in CONTRACT.json`
- **Suggested Fix:** Correct to say 4 occurrences (2 per file) to match SET-OVERVIEW.md and reality.
- **Judge Ruling:** ACCEPTED
- **Judge Leaning:** accept (confidence: high)
- **Concern:** set-planning-artifacts

### BUG-3: WAVE-1-COMPLETE.md branch field inconsistent with STATE.json
- **File:** `.planning/sets/path-resolution-fix/WAVE-1-COMPLETE.md`
- **Line:** 8
- **Severity:** medium
- **Evidence:** `**Branch:** main`
- **Suggested Fix:** Document that this set was executed directly on main, or correct STATE.json branch field to reflect reality.
- **Judge Ruling:** ACCEPTED
- **Judge Leaning:** accept (confidence: high)
- **Concern:** set-planning-artifacts

## Dismissed Findings

### BUG-4: Missing .catch() on registerProjectWithWeb() promise
- **File:** `skills/register-web/SKILL.md`
- **Line:** 45
- **Severity:** medium
- **Judge Ruling:** DISMISSED
- **Judge Leaning:** reject (confidence: high)
- **Rationale:** registerProjectWithWeb() wraps its entire body in try/catch and always returns {success:false, error:err.message}. The promise structurally cannot reject. A .catch() handler would be dead code.

### BUG-5: Single-quote injection in RAPID_TOOLS path
- **File:** `skills/register-web/SKILL.md`
- **Line:** 22
- **Severity:** low
- **Judge Ruling:** DISMISSED
- **Judge Leaning:** uncertain (confidence: medium)
- **Rationale:** User dismissed -- RAPID_TOOLS is installer-controlled and will never contain single quotes in practice.

### BUG-6: Fixed /tmp path TOCTOU race
- **File:** `skills/init/SKILL.md`
- **Line:** 567
- **Severity:** low
- **Judge Ruling:** DISMISSED
- **Judge Leaning:** uncertain (confidence: medium)
- **Rationale:** User dismissed -- RAPID is a single-user dev tool; symlink attacks are not a realistic threat.

### BUG-7: VERIFICATION-REPORT validated against stale contract
- **File:** `.planning/sets/path-resolution-fix/VERIFICATION-REPORT.md`
- **Line:** 12
- **Severity:** low
- **Judge Ruling:** DISMISSED
- **Judge Leaning:** reject (confidence: high)
- **Rationale:** VERIFICATION-REPORT correctly validated against CONTRACT.json (the authoritative spec) which had the correct count of 2. Not obligated to cross-reference CONTEXT.md's erroneous claim.

## Deferred Findings

(none)
