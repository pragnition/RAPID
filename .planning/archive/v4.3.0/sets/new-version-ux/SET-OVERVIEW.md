# SET-OVERVIEW: new-version-ux

## Approach

This set enhances the `/new-version` skill with two independent UX improvements that reduce friction during milestone creation. The first improvement adds an optional spec file argument that, when provided, pre-populates the 5-category goal-gathering sequence and collapses it to a single confirmation prompt. The second improvement auto-discovers all `DEFERRED.md` files across the project and includes their structured items in the researcher briefs automatically, removing the need for users to manually locate and select deferred decisions.

Both changes are additive modifications to `skills/new-version/SKILL.md`. The spec-aware path adds a new argument parsing step at the top of the flow and conditionally short-circuits the interactive goal-gathering loop. The deferred auto-discovery replaces the manual `find` command in Step 2C-v with a structured scan that always includes deferred items in the research pipeline input. Backward compatibility is preserved: invoking `/new-version` without arguments produces identical behavior to the current implementation.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/new-version/SKILL.md | Main skill definition -- all changes land here | Existing |

## Integration Points

- **Exports:**
  - `parseSpecFile(specPath)` -- Parses a spec file into `GoalCategory[]` and context string for pre-populating goal-gathering
  - `discoverDeferredItems(projectRoot)` -- Scans all `DEFERRED.md` files and returns structured `DeferredItem[]` for researcher briefs
- **Imports:** None -- this set has no dependencies on other sets
- **Side Effects:** When a spec file is provided, the 5-prompt interactive goal-gathering sequence is collapsed to 1 confirmation prompt. Deferred items from all sets (including archived milestones) are automatically included in researcher briefs.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Spec file format ambiguity -- no canonical spec format exists yet | Medium | Define a minimal spec schema (markdown with headings per goal category) and document it in the SKILL.md |
| DEFERRED.md files in archived milestones could pollute current briefs | Low | Scope discovery to `.planning/sets/*/DEFERRED.md` only, excluding `.planning/archive/` |
| Backward compatibility regression in no-argument path | High | Behavioral invariant enforced by test: no-arg invocation must behave identically to current implementation |
| Large spec files could bloat researcher prompts | Low | Truncate or summarize spec content beyond a reasonable threshold |

## Wave Breakdown (Preliminary)

- **Wave 1:** Spec file argument parsing, spec-aware goal pre-population, DEFERRED.md auto-discovery, backward compatibility preservation

Note: All 4 tasks are small and closely related -- they likely fit in a single wave. Detailed wave/job planning happens during /discuss and /plan.
