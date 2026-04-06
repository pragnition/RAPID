# SET-OVERVIEW: ux-first-run

## Approach

This set addresses the five deferred UX items from the v6.1.0 audit (items 2.2, 2.3, 3.1, 3.2, 3.3) that were out of scope for the original ux-audit set because they require modifications to SKILL.md files and the CLI command dispatcher. The core theme is reducing friction for new users between project initialization and productive development -- the "cold start" gap.

The work divides into two natural clusters. The first cluster is the SKILL.md authoring work: adding a post-init workflow guide to the init skill, adding empty-state guidance and contextual next-step hints to the status skill, and bridging the init-to-first-set gap (items 3.1, 3.2, 3.3, 2.3). These are purely prompt-engineering changes to Markdown files that instruct the agent's behavior. The second cluster is the fuzzy command matching feature (item 2.2), which requires code changes to `rapid-tools.cjs` to suggest the closest valid command when the user enters an unrecognized one.

The init-to-first-set bridge (item 3.3) is not a standalone file change but an emergent property of items 3.1 and 3.2 working together: when the post-init guide tells the user what to do next, and the status empty-state reinforces that guidance, the gap is bridged. This means 3.3 is validated through the combined behavior of 3.1 and 3.2 rather than requiring a separate implementation artifact.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/init/SKILL.md | Add post-init workflow guide output (item 3.1) | Existing -- modify |
| skills/status/SKILL.md | Add empty-state guidance (3.2) and contextual hints (2.3) | Existing -- modify |
| src/bin/rapid-tools.cjs | Add fuzzy command matching in the `default` branch of the command switch (item 2.2) | Existing -- modify |

## Integration Points

- **Exports:** None. This set produces no functions or types consumed by other sets.
- **Imports:** None. All changes are self-contained within the files listed above.
- **Side Effects:**
  - The init skill will produce additional terminal output (workflow guide) after successful initialization.
  - The status skill will display guidance text when no sets exist, and contextual next-step suggestions based on set states.
  - The CLI will suggest similar commands on typos instead of only printing the usage string.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| File ownership conflict: `skills/status/SKILL.md` is currently owned by `docs-housekeeping` in OWNERSHIP.json | Medium | The docs-housekeeping set is already merged (`complete` status per recent commits). Update OWNERSHIP.json to transfer ownership to this set, or verify no concurrent modifications. |
| SKILL.md prompt changes produce inconsistent agent behavior across models | Low | Keep added instructions concrete and imperative (e.g., "Display the following table") rather than vague suggestions. Test with actual `/rapid:init` and `/rapid:status` invocations. |
| Fuzzy matching adds a runtime dependency or increases startup time | Low | Use a simple Levenshtein distance or substring-match approach with the existing command list -- no external dependency needed. The command list is static and small (~20 entries). |
| Item 3.3 (init-to-first-set bridge) is hard to validate in isolation | Low | Validate as an integration check: run `/rapid:init` then `/rapid:status` with no sets and confirm the guidance chain is coherent. |

## Wave Breakdown (Preliminary)

- **Wave 1:** SKILL.md modifications (items 3.1, 3.2, 2.3) -- Post-init workflow guide in `skills/init/SKILL.md`, empty-state guidance and contextual next-step hints in `skills/status/SKILL.md`. Item 3.3 emerges from 3.1 + 3.2.
- **Wave 2:** Fuzzy command matching (item 2.2) -- Add Levenshtein/edit-distance logic and wire it into the `default` case of the command switch in `src/bin/rapid-tools.cjs`. Add unit tests.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
