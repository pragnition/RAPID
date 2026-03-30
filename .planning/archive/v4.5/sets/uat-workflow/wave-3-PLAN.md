# PLAN: uat-workflow / Wave 3

## Objective

Integration verification. Write structural tests for the rewritten SKILL.md to ensure it conforms to the human-driven workflow contract, then run all tests together to confirm end-to-end consistency across the Wave 1 format tests and Wave 2 rewrites.

## Owned Files

| File | Action |
|------|--------|
| skills/uat/SKILL.test.cjs | Create |

## Tasks

### Task 1: Create SKILL.md structural tests

**File:** `skills/uat/SKILL.test.cjs`
**Action:** Create new test file following the `skills/branding/SKILL.test.cjs` pattern.

This file validates the structural properties of the rewritten SKILL.md -- ensuring the human-driven workflow contract is enforced and no browser automation references leaked back in.

**Test cases (using `describe`/`it` from `node:test`):**

1. **`file exists`** -- Assert `skills/uat/SKILL.md` exists. Load content for subsequent tests.

2. **`valid YAML frontmatter with required keys`** -- Split on `---`, extract frontmatter. Assert `description` and `allowed-tools` keys are present.

3. **`frontmatter allowed-tools includes AskUserQuestion`** -- Parse `allowed-tools` value. Assert it contains `AskUserQuestion`.

4. **`frontmatter allowed-tools includes Agent`** -- Assert `Agent` is in allowed-tools (needed for plan-generation spawn).

5. **`no browser automation references`** -- Assert content does NOT contain any of: `browserConfig`, `BROWSER_TOOL`, `chrome-devtools`, `Chrome DevTools`, `playwright`, `Playwright MCP`, `browser automation`. Use case-insensitive check for "playwright" and "chrome devtools".

6. **`no automated retry logic`** -- Assert content does NOT contain: `Step 7a`, `rapid-uat-fixer`, `retryCount`, `Retry on Failure`.

7. **`no automated/human step classification`** -- Assert content does NOT contain: `[automated]`, `type: "automated"`, `type: "human"`, `autoCount`, `humanCount` as execution-phase concepts. (Note: `humanCount` or `Human Verified` may appear in the summary table -- that is fine. Check specifically for the classification patterns from the old skill.)

8. **`step ordering is sequential`** -- Extract all `## Step N` headings via regex. Assert they form a contiguous sequence starting at 0. Assert there are at least 8 steps (Steps 0 through at least 9, given Step 0 has substeps).

9. **`Step 6 contains human verification loop with AskUserQuestion`** -- Find the section starting with `## Step 6` (or the step heading containing "Human Verification" or "Verification Loop"). Assert it contains `AskUserQuestion` and all four verdict options: `Pass`, `Fail`, `Skip`, `Pass all remaining`.

10. **`Step 6 failure path collects severity`** -- In the Step 6 section, assert the failure path includes severity options: `Critical`, `High`, `Medium`, `Low`.

11. **`UAT-FAILURES.md writing step exists`** -- Assert content contains `UAT-FAILURES.md` and `UAT-FAILURES-META` and `UAT-FORMAT:v2`.

12. **`completion banner has no Automated count`** -- Find the completion banner section (Step 9 or the step containing "Completion Banner"). Assert it does NOT contain `Automated:` as a metric line.

13. **`REVIEW-UAT.md format has no Type column`** -- Find the REVIEW-UAT.md writing step. Assert the format template does NOT contain `| Type |` as a table header.

14. **`Important Notes section has no browser references`** -- Find the `## Important Notes` section. Assert it does not contain `browser`, `Browser`, `CHECKPOINT` (since CHECKPOINT returns from the agent are removed).

**Verification:**

```bash
node --test skills/uat/SKILL.test.cjs
```

All 14 tests must pass.

---

### Task 2: Run all UAT tests together

**Action:** Run both test files to confirm full consistency.

```bash
node --test skills/uat/uat-failures.test.cjs skills/uat/SKILL.test.cjs
```

Both files must pass with 0 failures. If any test fails, it indicates a mismatch between the Wave 1 format contract and the Wave 2 skill implementation -- fix the implementation (in the appropriate Wave 2 file), do NOT weaken the tests.

**Verification:**

```bash
node --test skills/uat/uat-failures.test.cjs skills/uat/SKILL.test.cjs 2>&1 | tail -5
# Expected: "# tests 22" (8 + 14), "# pass 22", "# fail 0"
```

## Success Criteria

- [ ] `skills/uat/SKILL.test.cjs` exists with 14 structural test cases
- [ ] All 14 SKILL.test.cjs tests pass
- [ ] All 8 uat-failures.test.cjs tests pass (from Wave 1)
- [ ] Combined test run shows 22 tests, 0 failures
- [ ] No browser automation, retry logic, or automated/human classification references remain in the skill

## What NOT To Do

- Do NOT modify `skills/uat/SKILL.md` or `src/modules/roles/role-uat.md` in this wave -- those are Wave 2 artifacts. If tests fail, the executor should fix the Wave 2 files to match the contract, but the test expectations defined here are authoritative.
- Do NOT weaken tests to match implementation bugs -- fix the implementation instead.
- Do NOT add runtime/integration tests that require a running RAPID instance -- these are structural/static tests only.
- Do NOT test the content of `agents/rapid-uat.md` -- it is generated and its correctness follows from the role source.
