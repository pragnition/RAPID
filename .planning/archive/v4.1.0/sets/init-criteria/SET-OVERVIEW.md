# SET-OVERVIEW: init-criteria

## Approach

This set addresses two related problems in the `/rapid:init` workflow: a data-loss bug where re-running scaffold overwrites user-written `REQUIREMENTS.md` content with a blank template, and the lack of structured encoding in acceptance criteria that prevents the verifier from programmatically cross-referencing them during plan verification.

The fix is a two-phase approach. First, add an `existsSync` guard in `scaffold.cjs` so that `generateScaffold` (and the higher-level `scaffold()` orchestrator) never clobber an existing `REQUIREMENTS.md`. Second, update the init SKILL.md Step 4D instructions to generate criteria using a `{CATEGORY}-{NNN}` encoding scheme (e.g., FUNC-001, UIUX-002) instead of plain prose checkboxes. Finally, extend `verify.cjs` to parse these encoded criteria from `REQUIREMENTS.md` and produce a coverage report that maps each criterion to plan tasks.

The work is sequenced so the scaffold guard (the bug fix) comes first since it is a standalone safety change, followed by the criteria encoding format update in the skill instructions, and finally the verifier enhancement which depends on the encoding format being defined.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| src/lib/scaffold.cjs | Scaffold engine -- needs existsSync guard for REQUIREMENTS.md | Existing (modify) |
| skills/init/SKILL.md (Step 4D) | Init discovery -- criteria generation instructions | Existing (modify) |
| src/lib/verify.cjs | Verification utilities -- needs criteria coverage report | Existing (modify) |
| src/lib/scaffold.test.cjs | Unit tests for scaffold guard | Existing (add tests) |
| src/lib/verify.test.cjs | Unit tests for criteria cross-referencing | Existing (add tests) |

## Integration Points

- **Exports:**
  - `encoded-criteria-format`: REQUIREMENTS.md files will use `{CATEGORY}-{NNN}` identifiers (FUNC, UIUX, PERF, SEC, DATA, INTEG, COMPAT, A11Y, MAINT) that downstream consumers (verifier, plan-set agents) can parse and cross-reference.
  - `requirements-safe-write`: The scaffold engine will include an `existsSync` guard preventing REQUIREMENTS.md from being overwritten on re-run.
- **Imports:** None -- this set has no external dependencies.
- **Side Effects:** The verifier will produce a new "criteria coverage" section in verification reports, listing which encoded criteria are addressed by plan tasks and which remain uncovered.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SKILL.md Step 4D is agent-executed prose, not code -- changes to criteria format may not be consistently followed by the LLM | Medium | Add explicit format examples and a validation regex pattern in the skill instructions; add a test that parses sample output |
| Scaffold guard could be too aggressive, preventing legitimate template updates on fresh init | Low | Guard only applies to REQUIREMENTS.md specifically (not all scaffold files); the existing `generateScaffold` already skips files that exist, so the guard is consistent with current behavior |
| Verifier criteria parsing could break on edge cases (multiline criteria, missing IDs) | Medium | Define a strict regex for the `{CATEGORY}-{NNN}` pattern; handle parse failures gracefully by reporting "unparseable criteria" rather than crashing |
| REQUIREMENTS.md format change is not backward-compatible with existing projects | Low | Old-format REQUIREMENTS.md files without encoded IDs will simply result in zero criteria matches in the coverage report -- no errors, just reduced functionality |

## Wave Breakdown (Preliminary)

- **Wave 1:** Scaffold bug fix -- add `existsSync` guard for REQUIREMENTS.md in `scaffold.cjs`, add unit tests proving re-run preserves content
- **Wave 2:** Criteria encoding -- update SKILL.md Step 4D to generate `{CATEGORY}-{NNN}` encoded criteria; update `verify.cjs` to parse encoded criteria from REQUIREMENTS.md and produce a coverage report; add tests for the parser and report generation

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
