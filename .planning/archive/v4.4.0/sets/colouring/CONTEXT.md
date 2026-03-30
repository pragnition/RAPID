# CONTEXT: colouring

**Set:** colouring
**Generated:** 2026-03-25
**Mode:** interactive

<domain>
## Set Boundary
Switch all bright ANSI background colour codes (10Xm range) to dark backgrounds (4Xm range) in `src/lib/display.cjs` for better terminal readability. Add missing banner registrations for `unit-test`, `bug-hunt`, `uat`, and `bug-fix` stages. Implement NO_COLOR environment variable support per the no-color.org standard. Update `src/lib/display.test.cjs` assertions accordingly.
</domain>

<decisions>
## Implementation Decisions

### Color Grouping for New Stages
- All 4 new stages (`unit-test`, `bug-hunt`, `uat`, `bug-fix`) use the red/review background color
- **Rationale:** All four stages are triggered from the review pipeline. Keeping them in the same color group as `review` and `merge` maintains simplicity and consistency, even though `bug-fix` writes code.

### NO_COLOR Scope & Behavior
- NO_COLOR check happens inside `renderBanner()` at call-time only; `STAGE_BG` remains a plain exported object
- **Rationale:** No callers currently use `STAGE_BG` directly for terminal output (only tests assert on values). A call-time check in `renderBanner()` is the simplest, most testable approach and avoids breaking the plain-object API with Proxies or getters.

### Dark Palette Mapping Strategy
- Direct 1:1 hue swap: `104m` → `44m` (blue), `102m` → `42m` (green), `101m` → `41m` (red)
- **Rationale:** Preserves the established semantic grouping (blue=planning, green=execution, red=review) with minimal cognitive change. The dark variants are readable across most terminal themes.

### Fallback Banner Under NO_COLOR
- Use decorated ASCII format: `--- RAPID > STAGE  target ---`
- **Rationale:** Retains a visually distinct banner feel without relying on ANSI codes or Unicode decorators, making output clean in NO_COLOR environments while still being recognizable as a RAPID banner.

### Claude's Discretion
- None -- all gray areas were discussed with the developer.
</decisions>

<specifics>
## Specific Ideas
- New stage verbs: `unit-test` → "UNIT TESTING", `bug-hunt` → "BUG HUNTING", `uat` → "UAT TESTING", `bug-fix` → "BUG FIXING"
- The NO_COLOR fallback format uses dashes for visual framing: `--- RAPID > EXECUTING SET  auth-system ---`
</specifics>

<code_context>
## Existing Code Insights
- `display.cjs` exports 3 items: `renderBanner`, `STAGE_VERBS`, `STAGE_BG`
- Currently 17 stages registered across 3 color groups (11 blue, 3 green, 3 red including audit-version)
- The unknown-stage fallback already returns `[RAPID] Unknown stage: ${stage}` -- NO_COLOR fallback will use a different decorated format
- Tests use `require('node:test')` and `assert/strict`, checking stage counts, verb mappings, color codes, and banner content
- Tests currently assert exact ANSI codes (e.g. `\x1b[104m`) -- these will need updating for dark equivalents
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
