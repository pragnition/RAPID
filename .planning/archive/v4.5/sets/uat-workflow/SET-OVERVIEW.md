# SET-OVERVIEW: uat-workflow

## Approach

The current UAT system is a hybrid that mixes automated browser execution with human verification steps. This creates fragility -- browser automation is environment-dependent, flaky, and requires a running dev server. The goal of this set is to replace that hybrid model with a fully human-driven step-by-step workflow where the UAT agent generates a test plan and the SKILL.md orchestrates the human through each step via AskUserQuestion, recording pass/fail verdicts without ever touching a browser.

The implementation rewrites two files: the UAT skill (`skills/uat/SKILL.md`) and the UAT role (`src/modules/roles/role-uat.md`). The skill rewrite removes all browser automation logic (Steps 4, 7's automated execution, the browser config prompt) and replaces it with a sequential AskUserQuestion loop that presents each test step individually and collects human verdicts. The role rewrite strips execution responsibilities so the agent only generates structured test plans from acceptance criteria.

Additionally, this set defines the UAT-FAILURES.md format as a shared contract. When human testing reveals failures, the skill writes a structured markdown file with an embedded `<!-- UAT-FAILURES-META {...} -->` JSON block. This format is consumed downstream by the `bugfix-uat` set's `--uat` flag. Unit tests validate round-trip write/parse of this format.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| skills/uat/SKILL.md | UAT skill orchestrating human-driven step-by-step testing | Existing (rewrite) |
| src/modules/roles/role-uat.md | UAT role that generates test plans only | Existing (rewrite) |
| .planning/sets/{setId}/UAT-FAILURES.md | Structured failure artifact with embedded JSON | New (format definition) |

## Integration Points

- **Exports:**
  - `uat-failures-format` -- The UAT-FAILURES.md file format with embedded `<!-- UAT-FAILURES-META {...} -->` JSON block containing an array of failure objects (id, criterion, step, description, severity, relevantFiles)
  - `uat-skill-rewrite` -- The rewritten SKILL.md implementing human-driven AskUserQuestion loop
  - `uat-role-rewrite` -- The rewritten role-uat.md producing test plans without execution
- **Imports:** None -- this set is a leaf dependency with no upstream requirements
- **Side Effects:** After this set merges, UAT will no longer execute any browser automation. All UI testing becomes human-driven. Callers of `/rapid:uat` will experience a different interaction pattern (sequential question prompts instead of automated execution with checkpoint pauses).

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Removing browser automation breaks existing review pipeline expectations | Medium | The REVIEW-UAT.md output format is preserved; only the execution method changes. Step 8 writing logic stays compatible. |
| UAT-FAILURES.md JSON format is consumed by bugfix-uat before format is stable | High | Define format precisely in CONTRACT.json (already done). Write parser unit tests first to lock the schema. |
| AskUserQuestion loop could become tedious for large test plans | Medium | Keep test plan generation focused on acceptance criteria only (no speculative edge cases). Role rewrite should produce concise, actionable steps. |
| Skill rewrite is large (~450 lines currently) and touches many steps | Medium | Wave 1 establishes the UAT-FAILURES.md format and tests first. Wave 2 tackles the skill/role rewrites with the format contract already locked. |

## Wave Breakdown (Preliminary)

- **Wave 1:** Define the UAT-FAILURES.md format and write unit tests for round-trip parsing of the embedded JSON metadata block. This locks the contract that bugfix-uat depends on.
- **Wave 2:** Rewrite `src/modules/roles/role-uat.md` to be plan-generation-only (remove execution responsibilities, browser automation references, dev server checks). Rewrite `skills/uat/SKILL.md` to replace automated execution with AskUserQuestion-driven human verification loop. Remove browser config prompt, automated retry logic, and all browser MCP references.
- **Wave 3:** Integration verification -- ensure REVIEW-UAT.md output remains compatible, UAT-FAILURES.md is written correctly on failures, and the end-to-end flow from `/rapid:uat` invocation through human step completion to artifact writing works cleanly.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
