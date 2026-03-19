# VERIFICATION-REPORT: agent-prompts

**Set:** agent-prompts
**Wave:** wave-1 + wave-2 (full set verification)
**Verified:** 2026-03-19
**Verdict:** PASS_WITH_GAPS

## Coverage

| Requirement | Covered By | Status | Notes |
|-------------|------------|--------|-------|
| F1: Remove phantom `plan-check-gate` from TOOL_REGISTRY | Wave 1 Task 1 | PASS | Correctly identifies line 29 of tool-docs.cjs and the plan.cjs error message |
| F1: Update executor agent tools to match ROLE_TOOL_MAP | Wave 1 Task 2 | PASS | Adds 4 missing commands (memory-log-decision, memory-log-correction, hooks-run, hooks-list) |
| F1: Update planner agent tools to match ROLE_TOOL_MAP | Wave 1 Task 3 | PASS | Adds 2 missing commands (memory-query, memory-context) |
| F1: Regenerate all 22 generated agents with corrected TOOL_REGISTRY | Wave 2 Task 1 | PASS | Runs build-agents which propagates corrected data |
| F1: Audit all 26 agents for phantom commands | Wave 2 Task 2 | PASS | Comprehensive check of all `<tools>` sections against TOOL_REGISTRY |
| F3: discuss-set presents exactly 4 gray areas | Wave 1 Task 4 | PASS | Removes 5th option, updates Key Principles and Anti-Patterns |
| F3: Verify discuss-set fix persists after rebuild | Wave 2 Task 3 | PASS | Confirms SKILL.md is not overwritten by build-agents (skills are independent of agent build) |
| CONTEXT decision: Per-role CLI filtering via build pipeline | Wave 2 Task 1 | PASS | The existing `getToolDocsForRole()` in build-agents.cjs already implements this; rebuild propagates corrected data |
| CONTEXT decision: core-identity.md stays generic | Wave 1 + Wave 2 | PASS | No wave plan modifies core-identity.md, consistent with CONTEXT.md decision |
| CONTEXT decision: TOOL_REGISTRY drift test | Wave 1 Task 5 | PASS | Adds forward-direction drift guard (TOOL_REGISTRY -> USAGE) |
| CONTEXT decision: Hand-written agent guard test | Wave 1 Task 6 | PASS | Verifies SKIP_GENERATION, file existence, non-generated status, tools match |
| CONTRACT behavioral: no-hallucinated-commands (enforced_by: test) | Wave 1 Task 5 + Wave 2 Task 2 | PASS | Drift test + phantom audit cover this |
| CONTRACT behavioral: discuss-option-limit (enforced_by: test) | Wave 1 Task 4 | GAP | SKILL.md is fixed but no persistent automated test verifies the 4-option constraint. Contract says "enforced_by: test" but neither wave adds such a test. |
| CONTRACT behavioral: build-agents-propagation (enforced_by: test) | Wave 1 Task 6 + Wave 2 Task 1 | PASS | Hand-written agent guard test verifies tools match; build-agents run confirms propagation |
| CONTRACT export: cli-reference-in-core-identity | None | GAP | CONTRACT.json exports "## CLI Command Reference section" in core-identity.md, but CONTEXT.md decision explicitly says core-identity.md stays generic. The contract export is stale relative to the discussion decision. Plans correctly follow CONTEXT.md. |
| plan.cjs error message also contains phantom `update-gate` | Wave 1 Task 1 (partial) | GAP | Task 1 removes `check-gate` from the error message but `update-gate` is also present in the same error string (line 57) with no corresponding case handler. Not critical (not in TOOL_REGISTRY), but should be cleaned up. |

## Implementability

| File | Job | Action | Status | Notes |
|------|-----|--------|--------|-------|
| `src/lib/tool-docs.cjs` | Wave 1 Task 1 | Modify | PASS | File exists at line 29 with `plan-check-gate` entry confirmed |
| `src/commands/plan.cjs` | Wave 1 Task 1 | Modify | PASS | File exists; line 57 contains `check-gate` in error message confirmed |
| `agents/rapid-executor.md` | Wave 1 Task 2 | Modify | PASS | File exists; `<tools>` section at lines 101-106 with 3 commands confirmed |
| `agents/rapid-planner.md` | Wave 1 Task 3 | Modify | PASS | File exists; `<tools>` section at lines 101-112 with 9 commands confirmed |
| `skills/discuss-set/SKILL.md` | Wave 1 Task 4 | Modify | PASS | File exists; 5th option at line 170, Key Principles at line 328, Anti-Patterns at line 345 all confirmed |
| `src/lib/tool-docs.test.cjs` | Wave 1 Tasks 5-6 | Modify | PASS | File exists; new describe blocks to be appended after existing `phantom command guard` section (line 274) |
| `agents/rapid-set-planner.md` | Wave 2 Task 1 | Regenerated | PASS | File exists, will be overwritten by build-agents |
| `agents/rapid-verifier.md` | Wave 2 Task 1 | Regenerated | PASS | File exists, will be overwritten by build-agents |
| `agents/rapid-bugfix.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-bug-hunter.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-unit-tester.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-devils-advocate.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-judge.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-uat.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-codebase-synthesizer.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-context-generator.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-research-stack.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-research-features.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-research-architecture.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-research-pitfalls.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-research-oversights.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-research-ux.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-research-synthesizer.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-roadmapper.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-plan-verifier.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-scoper.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-set-merger.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |
| `agents/rapid-conflict-resolver.md` | Wave 2 Task 1 | Regenerated | PASS | File exists |

## Consistency

| File | Claimed By | Status | Resolution |
|------|------------|--------|------------|
| `src/lib/tool-docs.cjs` | Wave 1 Task 1 only | PASS | Single owner |
| `src/commands/plan.cjs` | Wave 1 Task 1 only | PASS | Single owner |
| `agents/rapid-executor.md` | Wave 1 Task 2 only | PASS | Wave 2 skips hand-written agents |
| `agents/rapid-planner.md` | Wave 1 Task 3 only | PASS | Wave 2 skips hand-written agents |
| `skills/discuss-set/SKILL.md` | Wave 1 Task 4, Wave 2 Task 3 | PASS | Wave 2 Task 3 only verifies (reads), does not modify |
| `src/lib/tool-docs.test.cjs` | Wave 1 Tasks 5-6 only | PASS | Both tasks modify same file but append different describe blocks -- no conflict |

## Cross-Job Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Wave 2 depends on Wave 1 completion | PASS | Wave 2 prerequisites section explicitly states Wave 1 must be complete. build-agents consumes the corrected TOOL_REGISTRY from Wave 1 Task 1. |
| Wave 1 Task 5 drift test depends on Task 1 (plan-check-gate removal) | PASS | Test would fail if plan-check-gate still exists. Tasks are ordered sequentially within the wave. |
| Wave 1 Task 6 guard test depends on Tasks 2-3 (executor/planner tools update) | PASS | The test checks tools sections match ROLE_TOOL_MAP, which requires Tasks 2-3 to be complete first. |
| Wave 2 Task 2 (phantom audit) depends on Wave 2 Task 1 (build-agents) | PASS | Must build first, then audit. Tasks are ordered. |

## Edits Made

| File | Change | Reason |
|------|--------|--------|
| (none) | No auto-fixes applied | All issues found are either minor gaps or require scope decisions beyond auto-fix rules |

## Summary

**Verdict: PASS_WITH_GAPS** -- The plans are structurally sound and implementable. All file references are valid, all CONTEXT.md decisions are reflected in the wave plans, there are no file ownership conflicts between waves, and cross-wave dependencies are correctly sequenced. Three minor gaps exist: (1) The CONTRACT.json `cli-reference-in-core-identity` export is stale relative to the CONTEXT.md decision that core-identity.md stays generic -- the contract should be updated but this does not affect execution; (2) The `discuss-option-limit` behavioral contract says "enforced_by: test" but neither wave plan adds a persistent automated test for the 4-option constraint; (3) The plan.cjs error message (line 57) also contains `update-gate` alongside `check-gate`, but the plan only removes `check-gate` -- the executor should also remove `update-gate` as a minor cleanup. None of these gaps are structural blockers.
