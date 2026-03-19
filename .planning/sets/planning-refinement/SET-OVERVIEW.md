# SET-OVERVIEW: planning-refinement

## Approach

This set addresses two low-to-medium priority refinements in the RAPID planning and review pipeline: strengthening UI/UX emphasis in the discuss-set and plan-set skills (F9), and fixing review file discovery so downstream skills auto-detect post-merge mode without requiring an explicit `--post-merge` flag (F7).

Both changes are prompt-engineering modifications to existing skill files -- no library code or CLI commands need to change. The discuss-set skill gains conditional UI/UX gray area guidance so that sets with user-facing components surface UI/UX considerations as a gray area category. The plan-set skill's planner prompt gains an optional UI/UX section in the wave plan template. For review discovery, the unit-test, bug-hunt, and uat skills gain a path fallback that checks `.planning/post-merge/{setId}/REVIEW-SCOPE.md` when the standard path is not found, eliminating the need for users to remember the `--post-merge` flag on every downstream invocation.

The work is small and isolated -- all changes are in skill markdown files with no file ownership overlap with other v3.5.0 sets. The set can be executed in a single wave.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/discuss-set/SKILL.md | Set discussion facilitator -- gray area identification | Existing (modify) |
| skills/plan-set/SKILL.md | Set planning orchestrator -- planner agent prompt | Existing (modify) |
| skills/unit-test/SKILL.md | Unit test pipeline -- reads REVIEW-SCOPE.md | Existing (modify) |
| skills/bug-hunt/SKILL.md | Adversarial bug hunt pipeline -- reads REVIEW-SCOPE.md | Existing (modify) |
| skills/uat/SKILL.md | User acceptance testing -- reads REVIEW-SCOPE.md | Existing (modify) |

## Integration Points

- **Exports:**
  - `ux-gray-area-category`: discuss-set surfaces UI/UX as a gray area category for sets with user-facing components (new section in Step 5 guidance)
  - `ux-plan-template-section`: plan-set wave template includes optional UI/UX consideration prompts (new section in planner agent prompt)
  - `auto-detect-post-merge-review`: unit-test, bug-hunt, and uat skills auto-detect post-merge mode by checking both REVIEW-SCOPE.md paths when the standard path is missing
- **Imports:** None -- this set has no dependencies on other v3.5.0 sets
- **Side Effects:** Downstream review skills will now find REVIEW-SCOPE.md without the `--post-merge` flag, changing behavior for users who previously got a "not found" error

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| UI/UX gray area guidance causes non-frontend sets to waste a gray area slot on irrelevant UI/UX topics | Medium | Make the guidance conditional -- only suggest UI/UX gray areas when the set context mentions frontend, UI, or user-facing components |
| Auto-detect post-merge path may find stale REVIEW-SCOPE.md from a previous review cycle | Low | The fallback only triggers when the standard path does not exist; if both paths exist, standard path takes precedence |
| Modifying discuss-set Step 5 could conflict with agent-prompts set changes to the same file (F3 AskUserQuestion fix) | Medium | Verify file ownership boundaries -- discuss-set gray area content (Step 5 guidance text) vs. option count (template structure) are distinct sections; coordinate if merge conflicts arise |

## Wave Breakdown (Preliminary)

- **Wave 1:** All changes in a single wave -- modify discuss-set Step 5 with conditional UI/UX guidance, add UI/UX section to plan-set planner prompt template, and add path fallback logic to unit-test, bug-hunt, and uat Step 1 REVIEW-SCOPE.md loading

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
