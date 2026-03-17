# VERIFICATION-REPORT: review-pipeline

**Set:** review-pipeline
**Waves:** wave-1, wave-2
**Verified:** 2026-03-16
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| REVIEW-SCOPE.md structured schema with machine-readable SCOPE-META | Wave 1 Tasks 2-3 (serializeReviewScope, parseReviewScope) | PASS | Schema, serialization, and parsing all planned |
| Sections: changed files, dependent files, chunks, wave attribution, concerns, acceptance criteria, metadata | Wave 1 Task 2 (serializeReviewScope format spec) | PASS | All sections enumerated in task actions |
| File paths with metadata only, no full contents | Wave 1 Task 2 (explicit "What NOT to do") | PASS | |
| Skill Registration: flat names (skills/unit-test/, skills/bug-hunt/, skills/uat/) | Wave 2 Tasks 1-3 | PASS | Correct paths specified |
| /rapid:review becomes scoping-only | Wave 1 Task 5 | PASS | Full rewrite planned with stage removal |
| Old monolithic behavior fully removed | Wave 1 Task 5 (explicit removal of Steps 4-6) | PASS | |
| Independence: no chaining, no --all flag, no stage selection | Wave 1 Task 5, Wave 2 Tasks 1-3 | PASS | Each skill independently invocable |
| Scope guard: each downstream skill detects missing REVIEW-SCOPE.md | Wave 2 Tasks 1-3 (Step 1 in each) | PASS | Clear error message planned |
| Post-merge mode: postMerge field in SCOPE-META, per-skill --post-merge | Wave 1 Task 2 (SCOPE-META), Wave 2 Tasks 1-3 (path logic) | PASS | |
| CONTRACT: scopeRequired | Wave 2 Tasks 1-3 | PASS | Scope detection guard in each new skill |
| CONTRACT: idempotentRerun | Wave 2 Tasks 1-3 (overwrite semantics) | PASS | Each skill overwrites previous output |
| CONTRACT: judgeLeaningVisible | Wave 2 Task 2 (bug-hunt Step 3.6, 3.8) | PASS | Judge leaning with confidence in REVIEW-BUGS.md |
| CONTRACT: noStagePrompting | Wave 1 Task 5 (no stage menu), Wave 2 Tasks 1-3 (single-purpose) | PASS | |
| EXPORT: reviewScope (.planning/sets/{setId}/REVIEW-SCOPE.md) | Wave 1 Tasks 2, 5 | PASS | |
| EXPORT: unitTestSkill (skills/unit-test/SKILL.md) | Wave 2 Task 1 | PASS | |
| EXPORT: bugHuntSkill (skills/bug-hunt/SKILL.md) | Wave 2 Task 2 | PASS | |
| EXPORT: uatSkill (skills/uat/SKILL.md) | Wave 2 Task 3 | PASS | |
| buildWaveAttribution fix (flat file lookup) | Wave 1 Task 1 | PASS | Bug confirmed in current codebase (line 381 filters isDirectory()) |
| extractAcceptanceCriteria (from Success Criteria sections) | Wave 1 Task 4 | PASS | |
| Unit tests for new functions | Wave 1 Task 6 | PASS | |
| Help skill update with new commands | Wave 2 Task 5 | PASS | |
| Artifact path correctness (.planning/sets/ not .planning/waves/) | Wave 2 Task 4 | PASS | |
| SET-OVERVIEW: role-scoper.md "minor updates" | None | GAP | SET-OVERVIEW lists role-scoper.md as needing minor updates, but no wave task covers it. CONTEXT.md says roles "remain largely intact" so this is non-critical. |
| SET-OVERVIEW: agents/rapid-scoper.md "rebuild" | None | GAP | SET-OVERVIEW lists agent rebuild, but no wave task covers it. Agent rebuild is typically a post-execution step and may be handled outside set scope. |

## Implementability

| File | Wave/Task | Action | Status | Notes |
|------|-----------|--------|--------|-------|
| `src/lib/review.cjs` | Wave 1 Tasks 1-4 | Modify | PASS | Exists at /home/kek/Projects/RAPID/src/lib/review.cjs (861+ lines). buildWaveAttribution at line 372. |
| `skills/review/SKILL.md` | Wave 1 Task 5 | Modify | PASS | Exists at /home/kek/Projects/RAPID/skills/review/SKILL.md (1034 lines). |
| `src/lib/review.test.cjs` | Wave 1 Task 6 | Modify | PASS | Exists at /home/kek/Projects/RAPID/src/lib/review.test.cjs (1573 lines). Has existing buildWaveAttribution tests. |
| `skills/unit-test/SKILL.md` | Wave 2 Task 1 | Create | PASS | Does not exist. Directory skills/unit-test/ does not exist. Parent skills/ exists. |
| `skills/bug-hunt/SKILL.md` | Wave 2 Task 2 | Create | PASS | Does not exist. Directory skills/bug-hunt/ does not exist. Parent skills/ exists. |
| `skills/uat/SKILL.md` | Wave 2 Task 3 | Create | PASS | Does not exist. Directory skills/uat/ does not exist. Parent skills/ exists. |
| `skills/help/SKILL.md` | Wave 2 Task 5 | Modify | PASS | Exists at /home/kek/Projects/RAPID/skills/help/SKILL.md. |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `src/lib/review.cjs` | Wave 1 Tasks 1, 2, 3, 4 | PASS | All four tasks modify different functions in the same file. Task 1: buildWaveAttribution. Task 2: serializeReviewScope (new). Task 3: parseReviewScope (new). Task 4: extractAcceptanceCriteria (new). No overlap -- each adds/fixes a distinct function. |
| `skills/unit-test/SKILL.md` | Wave 2 Tasks 1, 4 | PASS | Task 1 creates the file; Task 4 verifies/corrects artifact paths within it. Task 4 is a verification pass on Task 1's output, not a conflict. |
| `skills/bug-hunt/SKILL.md` | Wave 2 Tasks 2, 4 | PASS | Same pattern: Task 2 creates; Task 4 verifies paths. No conflict. |
| `skills/uat/SKILL.md` | Wave 2 Tasks 3, 4 | PASS | Same pattern: Task 3 creates; Task 4 verifies paths. No conflict. |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Wave 2 depends on Wave 1 (REVIEW-SCOPE.md format) | PASS | Sequential wave execution ensures Wave 1 completes first. Wave 2 skills consume the REVIEW-SCOPE.md format defined by Wave 1's serializeReviewScope. |
| Wave 1 Tasks 2-4 depend on Task 1 (buildWaveAttribution fix) | PASS | extractAcceptanceCriteria (Task 4) uses similar directory reading logic. serializeReviewScope (Task 2) consumes waveAttribution data. All within same wave, sequential task execution. |
| Wave 2 Task 4 depends on Tasks 1-3 | PASS | Task 4 verifies artifact paths in files created by Tasks 1-3. Must execute after them. |
| Wave 2 Task 5 (help update) independent of Tasks 1-3 | PASS | Can execute in any order relative to skill creation tasks. |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | -- | No auto-fixes needed. All plans are structurally sound. |

## Summary

The wave plans for review-pipeline are structurally sound and well-organized. All CONTRACT.json exports and behavioral requirements are covered by specific tasks across the two waves. All file references are valid: files to modify exist on disk, files to create do not yet exist, and parent directories are in place. No file ownership conflicts exist -- the four tasks modifying `src/lib/review.cjs` each target distinct functions with no overlap.

The verdict is PASS_WITH_GAPS rather than full PASS due to two minor gaps: the SET-OVERVIEW lists `src/modules/roles/role-scoper.md` as needing "minor updates" and `agents/rapid-scoper.md` as needing a "rebuild", but no wave task covers either. These are non-critical -- the CONTEXT.md states agent roles "remain largely intact", and agent rebuilds are typically a post-execution step handled by the `scaffold` command. The core deliverables (scoping rewrite, three new skills, library functions, tests, help update) are fully covered.
