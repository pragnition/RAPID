# Bug Hunt Review

**Set:** path-resolution-fix
**Date:** 2026-03-23
**Cycle:** 1
**Findings:** 7 | Accepted: 3 | Dismissed: 2 | Deferred: 2

## Accepted Bugs

### Finding 3 [Priority 4] - CONTEXT.md hallucinated a 5th require() occurrence
- **File:** .planning/sets/path-resolution-fix/CONTEXT.md:45
- **Category:** set-planning-artifacts
- **Hunter evidence:** CONTEXT.md claims "init/SKILL.md has 3 broken requires" including "add-set.cjs (line ~901, inside `node -e`)". Grep for 'add-set.cjs' in init/SKILL.md returns zero matches.
- **Advocate response:** Confirmed. The 5th occurrence does not exist.
- **Ruling:** ACCEPTED -- Both hunter and advocate agree. CONTEXT.md line 45 references a non-existent `add-set.cjs` require at line ~901. The actual fix set correctly fixed only 4 occurrences (2 per file), so no code damage resulted, but the planning artifact is factually wrong. Priority 4 because this is a documentation inaccuracy with zero runtime impact.

### Finding 5 [Priority 4] - Contradictory occurrence counts between artifacts
- **File:** .planning/sets/path-resolution-fix/CONTEXT.md:16
- **Category:** set-planning-artifacts
- **Hunter evidence:** CONTEXT.md claims "5 occurrences (3 in init, 2 in register-web)" while SET-OVERVIEW.md and the actual execution fixed 4.
- **Advocate response:** Confirmed as a direct consequence of the hallucinated 5th occurrence.
- **Ruling:** ACCEPTED -- Direct corollary of Finding 3. The "5 occurrences" claim on line 16 is factually incorrect; there are 4. Priority 4 since this is the same documentation issue.

### Finding 6 [Priority 4] - WAVE-1-COMPLETE.md branch field discrepancy
- **File:** .planning/sets/path-resolution-fix/WAVE-1-COMPLETE.md:8
- **Category:** set-planning-artifacts
- **Hunter evidence:** WAVE-1-COMPLETE.md records "Branch: main" but STATE.json records the set branch as "rapid/path-resolution-fix".
- **Advocate response:** Commit 7f0b81b is verifiably on main only. The branch field is factually accurate to where the commit landed.
- **Ruling:** ACCEPTED -- The commit is indeed on main (confirmed via `git branch --contains`), and no `rapid/path-resolution-fix` branch exists. This means the set was executed directly on main rather than in an isolated worktree branch, which bypasses RAPID's worktree isolation model. The WAVE-1-COMPLETE.md is technically accurate about where it ran, but the process deviation (executing on main instead of a set branch) is the real issue. STATE.json and the actual branch are inconsistent. Priority 4 because the fix was small and correct -- no merge conflict risk materialized.

## Dismissed Findings

### Finding 0 - Missing .catch() on registerProjectWithWeb().then()
- **File:** skills/register-web/SKILL.md:45
- **Advocate evidence:** registerProjectWithWeb() at web-client.cjs lines 122-148 wraps its entire body in try/catch and always returns `{ success: false, error: err.message }` on any exception. The async function structurally cannot reject.
- **Ruling:** DISMISSED -- The advocate is correct. I verified the source: `registerProjectWithWeb()` has a try/catch at lines 127-147 that catches all exceptions and returns a success:false result object. The promise will always resolve, never reject. A .catch() handler would be dead code. The hunter's finding is a false positive based on a general best-practice rule without checking the actual implementation.

### Finding 4 - VERIFICATION-REPORT.md validated against wrong count
- **File:** .planning/sets/path-resolution-fix/VERIFICATION-REPORT.md:12
- **Category:** set-planning-artifacts
- **Hunter evidence:** VERIFICATION-REPORT validated against CONTRACT.json's "2 affected lines" without catching CONTEXT.md's claim of 3.
- **Advocate response:** No code damage resulted since CONTRACT.json's count of 2 was the actual correct count.
- **Ruling:** DISMISSED -- The VERIFICATION-REPORT validated against CONTRACT.json (the authoritative spec), which correctly stated 2 affected lines in init/SKILL.md. The report is not obligated to cross-reference CONTEXT.md's erroneous claim. The verification was correct in substance -- 2 require() calls in init/SKILL.md were broken and both were fixed.

## Deferred (Needs Human Review)

### Finding 1 - Shell injection via single quote in RAPID_TOOLS path
- **File:** skills/register-web/SKILL.md:22
- **Hunter says:** RAPID_TOOLS is shell-expanded inside a `node -e` double-quoted string and placed within JS single quotes. If the path contains a single quote, the Node code breaks or allows injection.
- **Advocate says:** Technically correct but practical risk is negligible since RAPID_TOOLS paths are set by the installer and never contain single quotes.
- **Why deferred:** Both sides are correct on the facts. The vulnerability exists in theory (any path with a single quote breaks the JS string literal), but the practical risk depends on how much the project trusts its own installer. This is a security-vs-pragmatism tradeoff that benefits from a human decision on whether defensive coding is warranted here.

### Finding 2 - /tmp/rapid-test-frameworks.json symlink attack vector
- **File:** skills/init/SKILL.md:567
- **Hunter says:** Writing to fixed `/tmp/rapid-test-frameworks.json` path is vulnerable to symlink attacks (TOCTOU race) on multi-user systems.
- **Advocate says:** Technically correct but RAPID is a single-user developer tool, making this extremely low risk.
- **Why deferred:** The vulnerability is real but the threat model is debatable. RAPID is a developer CLI tool typically run on personal machines, not shared servers. Whether to use mktemp or a project-local path is a design decision that depends on the project's security posture and target deployment environment.
