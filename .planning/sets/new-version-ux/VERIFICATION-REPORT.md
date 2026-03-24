# VERIFICATION-REPORT: wave-1

**Set:** new-version-ux
**Wave:** wave-1
**Verified:** 2026-03-24
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| Add spec file argument parsing to /new-version (CONTRACT task 1) | Task 1 | PASS | Step 0.5 parses `--spec <path>` argument with graceful fallback |
| Implement spec-aware goal pre-population (CONTRACT task 2) | Task 2 | PASS | Flow A/Flow B conditional with single confirmation prompt |
| Implement DEFERRED.md auto-discovery (CONTRACT task 3) | Task 3 | PASS | Expanded to include archive via previous milestone ID |
| Preserve backward compatibility (CONTRACT task 4) | Task 5 | PASS | Explicit verification task for no-argument path |
| Spec file format: structured Markdown with LLM semantic matching (CONTEXT decision) | Task 2 | PASS | Semantic category extraction uses LLM understanding for heading mapping |
| Goal pre-population UX: Accept/Augment/Replace (CONTEXT decision) | Task 2 | GAP | CONTEXT.md describes sequential pre-filled prompts; plan uses single confirmation with optional individual review. Spirit preserved (Accept/Augment/Replace exists) but flow differs. CONTRACT.json authorizes the plan's approach ("collapsed to single confirmation prompt"). |
| DEFERRED.md discovery: active sets + previous milestone archive (CONTEXT decision) | Task 3 | PASS | Both sources scanned; first-ever milestone handled gracefully |
| Spec parsing failure: graceful fallback to interactive (CONTEXT decision) | Task 1, Task 2 | PASS | Task 1 sets specContent=null on failure; Task 2 Flow B falls back to interactive |
| Deferred items included in researcher briefs (CONTRACT behavioral) | Task 4 | PASS | All 6 researcher brief templates get `## Deferred Context` section |
| Backward compatibility enforced by test (CONTRACT behavioral) | Task 5 | PASS | Task 5 performs end-to-end review of unchanged no-argument path |
| Spec reduces prompts to single confirmation (CONTRACT behavioral) | Task 2 | PASS | Single confirmation with Accept all / Review individually / Add more |

## Implementability

| File | Job | Action | Status | Notes |
|------|-----|--------|--------|-------|
| skills/new-version/SKILL.md | Task 1 | Modify | PASS | File exists (670 lines). Insertion point after line 29 is valid. |
| skills/new-version/SKILL.md | Task 2 | Modify | PASS | File exists. Step 2C starts at line 74, insertion point valid. |
| skills/new-version/SKILL.md | Task 3 | Modify | PASS | File exists. Step 2C-v at lines 122-146 with existing `find` command at lines 126-129. |
| skills/new-version/SKILL.md | Task 4 | Modify | PASS | File exists. Step 5 at lines 317-457 with 6 researcher brief templates. |
| skills/new-version/SKILL.md | Task 5 | Modify | PASS | File exists. Verification + minor addition to Important Constraints section. |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| skills/new-version/SKILL.md | Tasks 1, 2, 3, 4, 5 | PASS | All 5 tasks modify distinct, non-overlapping sections of the same file: Task 1 targets Step 0 (line ~29), Task 2 targets Step 2C (line ~74), Task 3 targets Step 2C-v (lines 122-146), Task 4 targets Step 5 (lines 317-457), Task 5 targets Important Constraints (line ~643). No merge conflicts expected when applied sequentially. |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Task 2 depends on Task 1 | PASS | Task 2's Flow A/Flow B conditional requires `specContent` variable set by Task 1. Tasks must execute in order 1 -> 2. |
| Task 2 depends on Task 3 | PASS | Task 2's "Deferred Items Injection" step references the expanded discovery from Task 3. Task 3 should execute before or alongside Task 2. |
| Task 4 depends on Task 3 | PASS | Task 4's `## Deferred Context` section references items discovered by Task 3's expanded discovery. Task 3 should execute first. |
| Task 5 depends on Tasks 1-4 | PASS | Task 5 is an end-to-end verification that all prior tasks are correct. Must execute last. |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | -- | No auto-fixes required |

## Summary

The wave-1 plan is structurally sound with full coverage of CONTRACT.json tasks and behavioral requirements. All 5 tasks target distinct sections of the single owned file (`skills/new-version/SKILL.md`), so no file ownership conflicts exist. One minor gap: the CONTEXT.md describes sequential pre-filled category prompts while the plan implements a single confirmation prompt with optional individual review -- but the CONTRACT.json explicitly authorizes the plan's approach, and the Accept/Augment/Replace UX from CONTEXT.md is preserved within the "Review individually" option. Verdict is PASS_WITH_GAPS due to this CONTEXT/plan divergence, which is benign given CONTRACT.json alignment.
