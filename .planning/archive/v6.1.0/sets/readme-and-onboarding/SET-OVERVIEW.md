# SET-OVERVIEW: readme-and-onboarding

## Approach

The current README.md jumps straight into features and install commands without explaining what problem RAPID solves or why a developer should care. It also presents two install paths (marketplace inline and marketplace via add) without clear prioritization, and the quickstart lists commands without explaining the /clear session model that is fundamental to the Claude Code workflow. This set rewrites the README from a beginner's perspective: lead with the problem (context rot in long AI sessions), present one unambiguous install path, and weave the /clear mental model into every example.

The work follows a content-first approach. The README rewrite is the primary deliverable -- it establishes the narrative structure (problem statement, single install, /clear explanation, annotated quickstart, First Project walkthrough). DOCS.md then receives targeted updates to reference /clear at command transitions, aligning with the CLEAR-POLICY.md that the `clear-guidance-and-display` set already merged. Finally, the help skill output is updated for consistency with the new README structure.

The `clear-guidance-and-display` set has already merged, so the `/clear` footer pattern (`renderFooter()` in `src/lib/display.cjs`) and `CLEAR-POLICY.md` are available as reference material. The README can accurately describe how every lifecycle command ends with a /clear reminder and next-command suggestion.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| README.md | Primary onboarding document -- problem statement, install, quickstart, walkthrough | Existing (rewrite) |
| DOCS.md | Technical reference -- needs /clear pattern references at command transitions | Existing (update) |
| skills/help/SKILL.md | Help command output -- must match README structure | Existing (update) |
| .planning/CLEAR-POLICY.md | Reference for which skills display /clear footers | Existing (read-only) |

## Integration Points

- **Exports:**
  - `README.md` -- Beginner-friendly README with problem statement, single install path, /clear mental model, annotated quickstart, and First Project walkthrough
  - `DOCS.md` -- Updated technical reference with /clear pattern at command transitions

- **Imports:**
  - `renderFooter()` from `clear-guidance-and-display` (already merged) -- README needs to accurately describe the /clear footer behavior that users will see after every lifecycle command
  - `CLEAR-POLICY.md` from `clear-guidance-and-display` (already merged) -- Reference for which commands produce /clear reminders, so documentation stays consistent with runtime behavior

- **Side Effects:** None. This set produces documentation only; no runtime code changes.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| README references /clear behavior that changes after merge | Medium | Cross-reference CLEAR-POLICY.md and renderFooter() implementation directly; avoid hardcoding exact footer text |
| Install instructions diverge from actual plugin marketplace path | High | Verify the canonical install command (`/plugin install rapid@pragnition/pragnition-public-plugins`) against current plugin infrastructure before finalizing |
| First Project walkthrough becomes stale as commands evolve | Low | Keep walkthrough focused on the stable 7-command lifecycle rather than auxiliary commands |
| DOCS.md is large; updates may conflict with other sets | Low | OWNERSHIP.json shows no other set owns DOCS.md; scope edits to adding /clear references, not restructuring |

## Wave Breakdown (Preliminary)

- **Wave 1:** README.md rewrite -- problem statement ("context rot"), single install path, /clear mental model explanation in the first 3 sections, annotated quickstart with /clear interleaved between every command
- **Wave 2:** First Project walkthrough (appended to README), DOCS.md updates to reference /clear at command transitions, help skill output alignment
- **Wave 3:** Cross-file consistency review -- verify all three files (README, DOCS, help) present commands and workflow identically

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
