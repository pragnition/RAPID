# CONTEXT: clear-guidance-and-display

**Set:** clear-guidance-and-display
**Generated:** 2026-04-06
**Mode:** interactive

<domain>
## Set Boundary
Implement `renderFooter()` utility in `display.cjs`, define `/clear` policy document, wire `display footer` CLI subcommand, apply footer to all lifecycle skills (~12 skills), and add structural regression test. The footer consolidates next-step guidance, progress breadcrumb, and `/clear` reminder into a single unified output block at skill completion.
</domain>

<decisions>
## Implementation Decisions

### Footer Visual Design
- Multi-line framed block with ASCII separator lines above and below. No ANSI color — plain text with `─` separators. Lets the banner be the sole visual anchor.
- **Rationale:** A framed block is noticeable without competing with the colored banner. No color keeps it lightweight and avoids NO_COLOR complexity in the footer path.

### Content Consolidation Strategy
- Footer consolidates all three end-of-skill outputs: `/clear` reminder, next command suggestion, and progress breadcrumb. Removes existing scattered "Next step:" and breadcrumb patterns from skills. Breadcrumb is a line within the footer block.
- **Rationale:** A single unified output block is cleaner than three separate trailing blocks. Consolidation eliminates redundancy and gives users one place to look at skill completion.

### Clear Policy Boundary
- All lifecycle pipeline skills (init, start-set, discuss-set, plan-set, execute-set, review, merge, new-version) get footers. Ad-hoc/utility skills (quick, bug-fix) get footers. Supplementary skills (scaffold, branding, audit-version, add-set) get footers. Any skill that generates artifacts or consumes significant context gets a footer.
- **Rationale:** Broad, consistent coverage ensures users always get the /clear reminder after substantial work. No edge-case judgment calls — if it's a significant operation, it gets a footer.

### Structural Test Approach
- Canonical list of skill names hardcoded in the test file. Test also scans `skills/` directory and flags any unlisted skills as needing review (catches drift when new skills are added). Verification is a string-contains check for `display footer` in each SKILL.md.
- **Rationale:** Simple, explicit, and fast. The canonical list is easy to update, and string matching is sufficient since the invocation pattern is stable. Directory scan catches new skills that lack coverage.

### CLI Subcommand API Shape
- `display footer "<next-command>" --breadcrumb "<breadcrumb-string>"`. Next command is the first positional arg. Breadcrumb is passed as a raw string via `--breadcrumb` flag — renderFooter() includes it as-is with no parsing.
- **Rationale:** Raw string breadcrumb keeps renderFooter() simple (no parsing logic) and gives each skill full control over breadcrumb formatting. Two args cover all footer content needs.

### Policy Format
- CLEAR-POLICY.md is a human-readable prose document with a markdown table listing each skill and its footer status. Lives at `.planning/CLEAR-POLICY.md`. Test uses its own independent canonical list — no coupling between policy doc and test.
- **Rationale:** Clean separation of concerns. The policy doc serves humans (skill authors, contributors), the test serves CI. No fragile parsing of markdown in tests.

### Footer Variation
- Uniform template for all skills. Same format, same /clear wording. Only the next-command string and breadcrumb content change per skill.
- **Rationale:** Consistency builds recognition. Users learn to expect the same footer pattern and can scan it quickly. No complexity from tiered messaging.

### Footer Wording
- Action-focused: "Run /clear before continuing" — direct, imperative, minimal.
- **Rationale:** Users don't need the "why" explained every time. The imperative phrasing is scannable and actionable.

### Footer Width and Branding
- Content-driven width (no fixed width). Footer adapts to the longest content line. No RAPID brand motif in the footer — purely functional with separator lines and content only.
- **Rationale:** Content-driven width avoids breadcrumb truncation. No branding keeps the footer lightweight — the banner already establishes brand identity at the top.

### Claude's Discretion
- None — all gray areas were discussed and decided.
</decisions>

<specifics>
## Specific Ideas
- Footer separator uses `─` (box-drawing horizontal) characters for the top and bottom rules
- Example footer output:
  ```
  ─────────────────────────────────────────────────────────────────
    Run /clear before continuing
    Next: /rapid:plan-set 1
    init [done] > start-set [done] > discuss-set [done] > plan-set > execute-set > review > merge
  ─────────────────────────────────────────────────────────────────
  ```
- renderFooter() signature: `renderFooter(nextCommand, options?)` where options includes optional `breadcrumb` string
- Structural test scans `skills/` directory entries against canonical list to detect new unlisted skills
</specifics>

<code_context>
## Existing Code Insights
- `display.cjs` exports `renderBanner()`, `STAGE_VERBS`, `STAGE_BG` — renderFooter() fits alongside renderBanner()
- `renderBanner()` uses `process.env.NO_COLOR` check — renderFooter() should reuse the same pattern (but footer has no color, so NO_COLOR only affects separator chars if at all)
- `src/commands/display.cjs` has a switch on subcommand — add `case 'footer':` alongside existing `case 'banner':`
- CLI invocation pattern: `node "${RAPID_TOOLS}" display footer <next-command> --breadcrumb "<breadcrumb>"`
- Skills use env preamble `if [ -z "${RAPID_TOOLS:-}" ] ...` before every CLI call
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
