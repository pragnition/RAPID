# VERIFICATION-REPORT: clear-guidance-and-display

**Set:** clear-guidance-and-display
**Waves:** wave-1, wave-2
**Verified:** 2026-04-06
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| Implement renderFooter() in display.cjs | Wave 1 Task 1 | PASS | Full implementation spec with NO_COLOR, content-driven width, plain text |
| Wire `display footer` CLI subcommand | Wave 1 Task 2 | PASS | Handles positional arg, --breadcrumb, --no-clear flags |
| Create CLEAR-POLICY.md policy document | Wave 1 Task 3 | PASS | Markdown doc with skill categorization table |
| Unit tests for renderFooter() | Wave 1 Task 4 | PASS | 8 test cases covering all behaviors |
| Apply footer to lifecycle skills (init, start-set, discuss-set, plan-set, execute-set, review, merge, new-version) | Wave 2 Tasks 1-8 | PASS | All 8 lifecycle skills covered |
| Apply footer to supplementary skills (add-set, scaffold, audit-version) | Wave 2 Tasks 9-11 | PASS | All 3 supplementary skills covered |
| Apply footer to ad-hoc/utility skills (quick, bug-fix) | Wave 2 Tasks 12, 18 | PASS | Both ad-hoc skills covered |
| Apply footer to artifact-producing skills (branding, documentation, unit-test, bug-hunt, uat) | Wave 2 Tasks 13-17 | PASS | All 5 additional skills covered |
| Structural regression test | Wave 2 Task 19 | PASS | Canonical list + directory scan for drift detection |
| Replace existing scattered "Next step:" patterns | Wave 2 | PASS | Each skill task specifies replacing existing patterns |
| Footer visual design: ASCII separator, no color, content-driven width | Wave 1 Task 1 | PASS | Matches CONTEXT.md decisions exactly |
| NO_COLOR respect in renderFooter() | Wave 1 Tasks 1, 4 | PASS | ASCII hyphen fallback + test coverage |
| Contract export: renderFooter function | Wave 1 Task 1 | PASS | Exported from display.cjs |
| Contract export: CLEAR_POLICY file | Wave 1 Task 3 | PASS | Created at .planning/CLEAR-POLICY.md |
| Contract behavioral: footerConsistency enforced by test | Wave 2 Task 19 | PASS | Structural test verifies all lifecycle skills |
| Contract behavioral: noColorRespect | Wave 1 Task 1 | PASS | Runtime NO_COLOR check in renderFooter() |
| CONTRACT.json breadcrumb option not in signature | Wave 1 Task 1 | GAP | CONTRACT.json signature only shows `{ clearRequired?: boolean }` but Wave 1 plan implements `{ breadcrumb?: string, clearRequired?: boolean }`. Contract is narrower than implementation -- not blocking but inconsistent documentation. |

## Implementability

| File | Wave/Task | Action | Status | Notes |
|------|-----------|--------|--------|-------|
| `src/lib/display.cjs` | W1 Task 1 | Modify | PASS | File exists (113 lines), renderBanner at line 94, exports at line 113 |
| `src/commands/display.cjs` | W1 Task 2 | Modify | PASS | File exists (25 lines), switch statement at line 8, case 'banner' at line 9 |
| `tests/display.test.cjs` | W1 Task 4 | Create | PASS | File does not exist on disk |
| `.planning/CLEAR-POLICY.md` | W1 Task 3 | Create | PASS | File does not exist on disk |
| `skills/init/SKILL.md` | W2 Task 1 | Modify | PASS | File exists |
| `skills/start-set/SKILL.md` | W2 Task 2 | Modify | PASS | File exists |
| `skills/discuss-set/SKILL.md` | W2 Task 3 | Modify | PASS | File exists |
| `skills/plan-set/SKILL.md` | W2 Task 4 | Modify | PASS | File exists |
| `skills/execute-set/SKILL.md` | W2 Task 5 | Modify | PASS | File exists |
| `skills/review/SKILL.md` | W2 Task 6 | Modify | PASS | File exists |
| `skills/merge/SKILL.md` | W2 Task 7 | Modify | PASS | File exists |
| `skills/new-version/SKILL.md` | W2 Task 8 | Modify | PASS | File exists |
| `skills/add-set/SKILL.md` | W2 Task 9 | Modify | PASS | File exists |
| `skills/scaffold/SKILL.md` | W2 Task 10 | Modify | PASS | File exists |
| `skills/audit-version/SKILL.md` | W2 Task 11 | Modify | PASS | File exists |
| `skills/quick/SKILL.md` | W2 Task 12 | Modify | PASS | File exists |
| `skills/branding/SKILL.md` | W2 Task 13 | Modify | PASS | File exists |
| `skills/documentation/SKILL.md` | W2 Task 14 | Modify | PASS | File exists |
| `skills/unit-test/SKILL.md` | W2 Task 15 | Modify | PASS | File exists |
| `skills/bug-hunt/SKILL.md` | W2 Task 16 | Modify | PASS | File exists |
| `skills/uat/SKILL.md` | W2 Task 17 | Modify | PASS | File exists |
| `skills/bug-fix/SKILL.md` | W2 Task 18 | Modify | PASS | File exists |
| `tests/display.test.cjs` | W2 Task 19 | Modify | PASS | Will exist after Wave 1 creates it |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `tests/display.test.cjs` | W1 Task 4 (Create), W2 Task 19 (Modify) | PASS | Cross-wave dependency -- W1 creates, W2 modifies. Sequential wave ordering ensures correctness. |

No intra-wave file ownership conflicts detected. Each file within a wave is claimed by exactly one task.

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| W2 depends on W1 for `renderFooter()` | PASS | Wave ordering enforces this -- Wave 2 cannot start until Wave 1 completes |
| W2 depends on W1 for `tests/display.test.cjs` | PASS | Wave 2 Task 19 modifies the file Wave 1 Task 4 creates |
| W2 depends on W1 for `display footer` CLI subcommand | PASS | All 18 skill modifications use `display footer` CLI which Wave 1 Task 2 wires |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | -- | No auto-fixes needed |

## Summary

Both wave plans are structurally sound and fully implementable. All 17 requirements from CONTEXT.md, CONTRACT.json, and the wave plans are covered. All 23 file references are valid -- files marked "Modify" exist on disk, and files marked "Create" do not yet exist. No intra-wave file ownership conflicts exist. The only gap is a minor documentation inconsistency: CONTRACT.json omits the `breadcrumb` option from the `renderFooter` signature while the implementation plan includes it. This is non-blocking (the contract is a subset of the actual API) but should be corrected in CONTRACT.json for accuracy. Verdict: **PASS_WITH_GAPS**.
