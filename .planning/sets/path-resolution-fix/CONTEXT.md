# CONTEXT: path-resolution-fix

**Set:** path-resolution-fix
**Generated:** 2026-03-23
**Mode:** interactive

<domain>
## Set Boundary
Fix all `require('${RAPID_TOOLS}/../lib/...')` path resolution bugs in `skills/init/SKILL.md` and `skills/register-web/SKILL.md`. Node.js treats the `.cjs` filename in the RAPID_TOOLS path as a directory component, causing `../` to navigate incorrectly. The fix replaces all occurrences with `path.dirname()`-based resolution. Also update CONTRACT.json to reflect accurate occurrence counts.
</domain>

<decisions>
## Implementation Decisions

### Fix Scope Boundary
- Fix all 5 occurrences across both files (3 in init/SKILL.md, 2 in register-web/SKILL.md), not just the 4 specified in CONTRACT.json
- Update CONTRACT.json to reflect the true count (3 affected lines in init, not 2)
- **Rationale:** Leaving a known broken require unfixed would be counterproductive. The CONTRACT should accurately reflect actual work.

### Resolution Pattern Consistency
- Use `path.dirname()` consistently in all contexts -- both multi-line JS code blocks and bash `node -e` one-liners
- **Rationale:** A single consistent pattern is easier to grep for and maintain, even if it adds slight verbosity to one-liners.

### Repo-Wide Sweep
- Fix only the 5 known occurrences. No additional sweep task or preventive comments.
- **Rationale:** Grep already confirmed no other occurrences exist beyond the 2 owned files. Adding comments to dense SKILL.md files is low-value noise.

### Contract Accuracy
- Update CONTRACT.json task 1 from "2 affected lines" to "3 affected lines"
- **Rationale:** Keeps the planning artifact accurate and consistent with the expanded fix scope decision.

### Claude's Discretion
- No areas were left to Claude's discretion -- all 4 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- The `path.dirname()` pattern should be: `require(path.join(path.dirname('${RAPID_TOOLS}'), '..', 'lib', '<module>.cjs'))`
- For `node -e` one-liners, inline `const path=require('path')` before the require call
- Ensure `const path = require('path')` exists at the top of multi-line JS code blocks that don't already have it
</specifics>

<code_context>
## Existing Code Insights
- init/SKILL.md has 3 broken requires: context.cjs (line ~564), add-set.cjs (line ~901, inside `node -e`), web-client.cjs (line ~971)
- register-web/SKILL.md has 2 broken requires: web-client.cjs (lines ~22 and ~44)
- The `node -e` one-liner on line ~901 is a bash command, not a JS code block -- path must be required inline
- `RAPID_TOOLS` points to `src/bin/rapid-tools.cjs`, so `path.dirname()` yields `src/bin/` and `../lib/` correctly resolves to `src/lib/`
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
