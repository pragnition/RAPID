# SET-OVERVIEW: new-version-comprehensive

## Approach

The /new-version skill currently gathers milestone goals through a single freeform question (Step 2C), which risks incomplete requirement coverage. This set enhances the goal-gathering phase by replacing that single prompt with a structured, multi-category interview that systematically covers features, bug fixes, tech debt, UX improvements, and deferred decisions from the previous milestone. The result is a more thorough requirements capture before the research pipeline kicks off.

The core implementation modifies `skills/new-version/SKILL.md` in two areas: (1) expanding the goal-gathering step (Step 2C) into a structured multi-category prompt sequence, and (2) adding a new sub-step that reads `.planning/sets/*/DEFERRED.md` files from the previous milestone and surfaces those deferred items for the user to include or exclude. A completeness confirmation gate ensures the user explicitly signs off on the full requirement set before research begins.

The deferred-decisions import depends on the `discuss-overhaul` set producing DEFERRED.md files. The implementation reads these files at runtime, so the dependency is soft -- if no DEFERRED.md files exist (because discuss-overhaul has not been used yet), the feature gracefully skips that category rather than failing.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/new-version/SKILL.md | Main skill definition -- all changes land here | Existing (modify) |

## Integration Points

- **Exports:**
  - `comprehensive-goal-gathering` -- Structured prompts covering features, bugs, tech debt, UX improvements, and deferred decisions. Downstream consumers (research agents) receive richer, categorized goal input.
  - `deferred-decisions-import` -- Reads `.planning/sets/*/DEFERRED.md` and surfaces deferred items for new milestone consideration.

- **Imports:**
  - `deferred-decisions-format` (from `discuss-overhaul`) -- Expects DEFERRED.md files at `.planning/sets/{set-id}/DEFERRED.md`. This is a file-format dependency; the files are read at runtime during goal-gathering.

- **Side Effects:**
  - The milestone goals passed to the 6 research agents (Step 5) will be richer and more structured, potentially improving research output quality.
  - Users will experience a longer goal-gathering step (multiple category prompts instead of one freeform question).

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| No DEFERRED.md files exist yet (discuss-overhaul not merged/used) | Low | Gracefully skip deferred category with informational message; do not error |
| DEFERRED.md format changes in discuss-overhaul after this set ships | Medium | Read files as plain Markdown text; avoid brittle parsing of specific structure |
| Structured prompts feel tedious for small milestones | Medium | Allow users to skip categories or confirm "nothing for this category" quickly |
| Goal output format change breaks downstream research agent prompts | Medium | Keep final goal string format compatible with existing Step 5 agent spawning |

## Wave Breakdown (Preliminary)

- **Wave 1:** Add structured goal-gathering categories to Step 2C -- replace the single freeform question with a multi-category AskUserQuestion sequence covering features, bugs, tech debt, and UX improvements. Add the completeness confirmation gate.
- **Wave 2:** Implement deferred-decisions import -- add logic to glob `.planning/sets/*/DEFERRED.md`, parse and present deferred items, and let the user include/exclude them as goals. Handle the case where no DEFERRED.md files exist.
- **Wave 3:** Integration polish -- ensure the structured goal output feeds cleanly into the research agent prompts (Step 5), verify end-to-end flow, and handle edge cases (empty categories, very large deferred lists).

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
