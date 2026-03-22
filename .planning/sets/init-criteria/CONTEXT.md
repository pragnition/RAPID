# CONTEXT: init-criteria

**Set:** init-criteria
**Generated:** 2026-03-22
**Mode:** interactive

<domain>
## Set Boundary
Fixes the REQUIREMENTS.md overwrite bug in the `/rapid:init` workflow and enhances the acceptance criteria system to use encoded category prefixes (`{CATEGORY}-{NNN}`) that the verifier can programmatically cross-reference during plan verification. Touches three files: `skills/init/SKILL.md` (Step 4D), `src/lib/scaffold.cjs`, and `src/lib/verify.cjs`.
</domain>

<decisions>
## Implementation Decisions

### Scaffold Guard Placement

- Guard goes in **SKILL.md Step 4D only** (prompt-level). No code changes to scaffold.cjs.
- On re-init, if REQUIREMENTS.md already has user content, Step 4D should **append new criteria** below the existing content (separated by a header), not overwrite.

### Criteria Category Taxonomy

- Categories are **flexible per-project** -- the full set (FUNC, UIUX, PERF, SEC, DATA, INTEG, COMPAT, A11Y, MAINT) is available, but the agent picks only relevant categories based on the specific project type during init. Not all categories need to be used.
- Numbering is **per-category** (FUNC-001, FUNC-002, UIUX-001) -- each category has its own counter, making it easy to add criteria without renumbering.

### Verifier Coverage Report

- Coverage report appears as a **new section in the existing VERIFICATION.md** report, not a standalone file.
- For REQUIREMENTS.md files without encoded criteria IDs (old format or freeform): **warn with suggestion** -- note in the report that no encoded criteria were found and suggest re-running init to generate them.

### SKILL.md Encoding Instructions

- Step 4D instructions should use a **strict template** approach: exact format rules, 3-4 examples across categories, and a regex pattern (e.g., `/^[A-Z]+-\d{3}:/`) the LLM must follow.
- A **post-generation validation step in the SKILL.md** should self-check the generated criteria against the regex pattern before writing REQUIREMENTS.md.

### Claude's Discretion

- None -- all areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- The encoded format is `CATEGORY-NNN: description` (e.g., `FUNC-001: User can log in with email and password`)
- The verifier's coverage section should map each encoded criterion to the plan tasks that address it, and flag uncovered criteria as gaps
- The SKILL.md validation step should parse the generated criteria and verify they match the regex before writing the file
</specifics>

<code_context>
## Existing Code Insights

- `generateScaffold()` in `scaffold.cjs` already has an `existsSync` guard that skips files that already exist -- but REQUIREMENTS.md is not part of the scaffold templates. It is written by the init SKILL.md Step 4D via the Write tool, which always overwrites.
- `verify.cjs` currently has `verifyLight()` (file existence + git commits) and `verifyHeavy()` (tests + content checks) plus `generateVerificationReport()` which produces a markdown report. The criteria coverage section needs to integrate into this existing report structure.
- The init SKILL.md Step 4D currently says "Write the acceptance criteria to `.planning/REQUIREMENTS.md` using the Write tool" with no existence check -- this is the root cause of the overwrite bug.
- `scaffold.cjs` templates cover project archetypes (webapp, api, library, cli) with language variants but do not include REQUIREMENTS.md.
</code_context>

<deferred>
## Deferred Ideas
- Future: a CLI command to retroactively encode existing freeform criteria in old REQUIREMENTS.md files
- Future: criteria coverage dashboard in the Mission Control web UI
</deferred>
