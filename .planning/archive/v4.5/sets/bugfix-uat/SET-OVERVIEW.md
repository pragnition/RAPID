# SET-OVERVIEW: bugfix-uat

## Approach

This set extends the existing `/rapid:bug-fix` skill to accept a `--uat` flag that bridges UAT failure reports into the bug-fix pipeline. When a user runs `/rapid:bug-fix --uat [set-id]`, the skill reads the structured `UAT-FAILURES.md` artifact produced by the uat-workflow set, extracts the embedded JSON metadata block, and converts each failure entry into an investigation target. These targets then flow through the existing bug-fix pipeline (investigate, present findings, dispatch executor).

The implementation is additive -- the current bug-fix skill remains fully functional without the `--uat` flag. The core work is: (1) parse the `--uat` flag and resolve the set-id, (2) read and parse `UAT-FAILURES.md` from `.planning/sets/{setId}/`, (3) convert failure objects into the investigation format the executor expects. No new agents or roles are introduced; this is a single-skill enhancement with a well-defined input contract.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/bug-fix/SKILL.md | Bug-fix skill definition -- add --uat flag handling | Existing (modify) |

## Integration Points

- **Exports:** `bugfix-uat-flag` -- the `--uat [set-id]` argument on `/rapid:bug-fix` that reads UAT failures and dispatches fixes through the executor pipeline.
- **Imports:** `uat-failures-format` from `uat-workflow` -- reads `.planning/sets/{setId}/UAT-FAILURES.md` containing an embedded `<!-- UAT-FAILURES-META {...} -->` JSON block with failure objects (id, criterion, step, description, severity, relevantFiles).
- **Side Effects:** None. The skill reads UAT-FAILURES.md but never modifies it. Fixes are committed to the current branch via the standard executor agent.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| UAT-FAILURES.md format not yet stable (uat-workflow set may still be iterating) | Medium | Rely on CONTRACT.json's `failure-file-parseable` behavioral invariant; add defensive parsing with clear error messages if format is malformed |
| Multiple failures in a single UAT-FAILURES.md may overwhelm the executor with sequential fix attempts | Low | Process failures one at a time with user confirmation between each, matching the existing "Apply fix / Investigate further / Cancel" UX pattern |
| --uat flag parsing conflicts with future bug-fix arguments | Low | Use explicit flag format (`--uat <set-id>`) with clear argument boundaries |

## Wave Breakdown (Preliminary)

- **Wave 1:** Flag parsing and UAT-FAILURES.md reader -- add `--uat` argument handling to SKILL.md, implement the metadata extraction logic that parses the embedded JSON from the HTML comment wrapper.
- **Wave 2:** Pipeline wiring and multi-failure UX -- wire parsed failure objects into the existing Step 2/3/4 investigation-and-fix flow, handle iteration over multiple failures with user prompts between each.
- **Wave 3:** Tests and backward compatibility verification -- unit tests for flag parsing, failure file reading, and confirmation that omitting `--uat` preserves identical behavior.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
