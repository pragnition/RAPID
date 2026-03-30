# SET-OVERVIEW: generous-planning

## Approach

This set adds a user-facing granularity selection prompt to the `/rapid:new-version` skill, allowing users to control how many sets the roadmapper decomposes a milestone into. Currently, the roadmapper receives no explicit guidance on set count, which tends to produce minimal decompositions. This change introduces a `targetSetCount` parameter with four options -- Compact (3-5), Standard (6-10), Granular (11-15), and Auto -- and passes the selection through to the roadmapper agent spawn.

The implementation touches two files in a straightforward sequence: first, the new-version SKILL.md gets an AskUserQuestion prompt injected between goal confirmation (Step 2C-vi) and research pipeline launch (Step 5), capturing the user's granularity preference. Second, the roadmapper role definition (`role-roadmapper.md`) is updated so that its "Auto" default behavior biases toward the 6-10 range rather than producing minimal set counts. The roadmapper already has `targetSetCount` parameter support (input item 6 in role-roadmapper.md), so the role-side change is primarily about adjusting the default bias when no explicit count is given.

This is a small, self-contained set with no cross-set dependencies and no imports from other sets.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/new-version/SKILL.md | Add AskUserQuestion for targetSetCount between Steps 2C-vi and 5 | Existing -- modify |
| src/modules/roles/role-roadmapper.md | Update default decomposition bias to prefer 6-10 range | Existing -- modify |

## Integration Points

- **Exports:** `granularity-prompt` -- an AskUserQuestion interaction in new-version Step 7 that lets users select Compact/Standard/Granular/Auto before the roadmapper is spawned.
- **Imports:** None. This set is fully independent.
- **Side Effects:** The roadmapper agent spawn in Step 7 of new-version will include the `targetSetCount` value in its task string. When "Auto" is selected (or no selection is made), the roadmapper defaults to a more generous 6-10 range instead of its current minimal tendency.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Step numbering collision -- inserting a new step between existing steps could misalign references | Medium | Insert as Step 2D (after 2C-vi confirmation, before Step 3) rather than renumbering all subsequent steps |
| Roadmapper already has targetSetCount support but wording may not match | Low | Verify the exact parameter name and format in role-roadmapper.md input section (item 6) before wiring |
| Backward compatibility -- users who skip the prompt must get identical behavior to pre-change | Medium | Behavioral invariant: "Auto" selection and prompt-skip both default to 6-10 range; enforce with test |

## Wave Breakdown (Preliminary)

- **Wave 1:** Add the AskUserQuestion granularity prompt to new-version SKILL.md and pass `targetSetCount` to the roadmapper agent spawn task string. Update role-roadmapper.md default behavior to prefer 6-10 range for Auto mode.

Note: This is a small (S) set -- a single wave is likely sufficient. Detailed wave/job planning happens during /discuss and /plan.
