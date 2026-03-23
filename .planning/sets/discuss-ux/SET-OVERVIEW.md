# SET-OVERVIEW: discuss-ux

## Approach

This set delivers two targeted UX improvements to the discuss-set skill (SKILL.md) and its accompanying test suite (SKILL.test.cjs). Both changes are purely within the skill definition layer -- no runtime code, CLI tooling, or state management is affected.

The first improvement consolidates gray area presentation in Step 5. Currently, gray areas are batched into multiple AskUserQuestion prompts of 4 items each (e.g., n=2 yields two separate prompts). The new behavior consolidates all gray areas into a single multiSelect prompt with up to 8 checkboxes, reducing interaction friction when the user just wants to scan and select.

The second improvement replaces the markdown table in Step 6 Format A (the option-description format) with a structured list layout. Markdown tables break or render poorly in narrow terminals; a list format renders reliably at any width. Both changes require updating the test suite assertions that validate Step 5 option counts and structural expectations.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/discuss-set/SKILL.md | Discuss-set skill definition (Steps 5, 6, Key Principles, Anti-Patterns) | Existing -- modify |
| skills/discuss-set/SKILL.test.cjs | Structural assertions for SKILL.md content | Existing -- modify |

## Integration Points

- **Exports:** None -- this set does not export functions or types consumed by other sets.
- **Imports:** None -- this set has no dependencies on other sets.
- **Side Effects:** The discuss-set skill is consumed by agents running `/rapid:discuss-set`. Changes to prompt structure affect the interactive discussion flow but do not alter the output artifacts (CONTEXT.md, DEFERRED.md) or state transitions.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Consolidating gray areas into one prompt could exceed reasonable checkbox count for n=3 (12 items) | Medium | CONTRACT.json caps at 8 checkboxes per prompt; for n=3, two prompts of 6 each or similar split may be needed. Clarify the boundary during implementation. |
| Test assertions are tightly coupled to literal phrases in SKILL.md (e.g., "Exactly 4 gray areas", "fewer or more than 4") | Medium | Update all affected literal-match assertions in lockstep with SKILL.md wording changes. Run tests after each edit. |
| Format A table replacement could break existing references or examples elsewhere in SKILL.md | Low | Grep for table-pipe syntax (`| Option |`) across the file to ensure all Format A instances are updated consistently. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Rewrite Step 5 gray area presentation to use consolidated multiSelect format (max 8 per prompt), rewrite Step 6 Format A from markdown table to structured list format, update Key Principles and Anti-Patterns wording to match new behavior, and update all SKILL.test.cjs assertions for the new structure.

Note: This is a preliminary breakdown. Given the small scope (2 files, 3 tightly coupled tasks), a single wave is likely sufficient. Detailed wave/job planning happens during /discuss and /plan.
