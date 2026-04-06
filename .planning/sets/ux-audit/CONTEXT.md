# CONTEXT: ux-audit

**Set:** ux-audit
**Generated:** 2026-04-06
**Mode:** interactive

<domain>
## Set Boundary
Systematic UX audit of the RAPID CLI covering four pillars: breadcrumb consistency in error messages, command discoverability, first-run experience polish, and auto-regroup wiring. The audit is bounded by a predefined checklist with pass/fail/deferred criteria -- not open-ended exploration. Also wires `partitionIntoGroups()` into the add-set flow (deferred from v6.0.0). Produces a structured audit report at `.planning/v6.1.0-UX-AUDIT.md`.
</domain>

<decisions>
## Implementation Decisions

### Auto-regroup Wiring Location
- Call `partitionIntoGroups()` explicitly in `addSetToMilestone()` after the existing `recalculateDAG()` call (line 71 of `add-set.cjs`), not inside `recalculateDAG()` itself.
- **Rationale:** Keeps the wiring explicit and scoped to set-addition operations. Other callers of `recalculateDAG()` (e.g., init, manual rebuilds) are not affected. The tradeoff of needing to remember to add regroup calls to future set-mutation call sites is acceptable given the current single call site.

### Team-Size Parameter Resolution
- Store `teamSize` in STATE.json during init, read it at add-set time for `partitionIntoGroups()`.
- **Rationale:** Creates a single source of truth that's always available. The value is already captured during the init flow via `--team-size`; persisting it in STATE.json requires only a small schema addition and eliminates guesswork at regroup time.

### Breadcrumb Scope Boundary
- Focus breadcrumb standardization on state transition errors and set lifecycle command errors (init, plan, execute, merge). Skip internal utility errors (stdin validation, JSON parsing, etc.).
- **Rationale:** State transitions and lifecycle commands are the errors users actually encounter and need recovery guidance for. The ~277 throw sites are too many to standardize in a bounded audit; focusing on the highest-impact paths delivers the most user value within scope.

### Breadcrumb Recovery Commands
- All breadcrumb-standardized error messages must include an actionable recovery command suggestion (e.g., "Run: /rapid:discuss-set 2").
- **Rationale:** The entire purpose of the breadcrumb pattern is guiding users to recovery. Informational-only messages that say "expected state X" without telling users how to get there defeat the purpose.

### Error Breadcrumb Format
- Use a compact inline format: `[ERROR] {context}. Run: {recovery command}`. Do not mirror the `renderFooter()` block format.
- **Rationale:** Error messages need to be concise and scannable. The block format used for success-path footers is too verbose for error contexts. A compact 1-2 line format fits naturally in terminal error output.

### Error Message Styling
- Minimal color: red ANSI for the `[ERROR]` label, default terminal color for the rest of the message.
- **Rationale:** Matches common CLI conventions. Full color matching `display.cjs` would be over-styled for errors, and no color at all would make errors harder to spot in dense output.

### Audit Checklist Organization
- Organize the checklist by pillar: Breadcrumb Consistency, Command Discoverability, First-Run Experience, Auto-Regroup Wiring. Each pillar has its own section with categorized items.
- **Rationale:** The 4 pillars are already well-defined in the CONTRACT tasks and map cleanly to distinct audit concerns. Pillar-based organization makes it easy to track progress and spot coverage gaps per area.

### Audit Checklist Grading
- Three-state grading: Pass / Fail / Deferred. No severity scales.
- **Rationale:** Simple enough to be objective. "Deferred" captures items that are identified during the audit but intentionally left for future milestones, avoiding the false binary of pass/fail for items that are out of scope but worth noting.

### Command Discoverability
- Enhance `/rapid:status` output to include contextual next-step suggestions based on current project state (e.g., "No sets started yet. Run `/rapid:start-set 1` to begin.").
- **Rationale:** Users naturally check `/rapid:status` when unsure what to do next. Adding contextual suggestions there avoids creating a new command and meets users where they already look. The USAGE string is for skill authors, not end users.

### USAGE String Restructuring
- Light restructuring: add workflow-based section headers (Setup, Planning, Execution, Review & Merge, Utilities) to group commands. No inline descriptions -- argument names are sufficiently descriptive.
- **Rationale:** Section headers help skill authors find relevant commands faster without bloating the already 100+ line USAGE string. Workflow-based grouping matches how authors think ("what stage am I debugging?") rather than module-based grouping.

### First-Run Experience Scope
- Focus on post-init experience: the gap between "project initialized" and "user confidently running their first set through the lifecycle."
- **Rationale:** Pre-init is already handled by `/rapid:init` and the README walkthrough. The real confusion point is after init completes and users don't know the `start-set -> discuss-set -> plan-set -> execute-set` flow.

### First-Run Guidance Delivery
- Show workflow guide at the end of `/rapid:init` output AND include it in `/rapid:status` when no sets have been started yet.
- **Rationale:** Dual placement catches users at both moments they need guidance: immediately after init (what do I do now?) and when checking status later (I forgot what to do next).

### Claude's Discretion
- No areas were left to Claude's discretion -- all 8 gray areas were discussed and resolved.
</decisions>

<specifics>
## Specific Ideas
- Error format example: `[ERROR] Set 'auth' is pending, not discussed. Run: /rapid:discuss-set 2`
- Status contextual hints should be state-aware: different suggestions for "no sets started", "sets discussed but not planned", "sets executing", etc.
- Team-size field in STATE.json should be top-level (alongside `currentMilestone`), not nested per milestone, since it's a project-wide setting.
</specifics>

<code_context>
## Existing Code Insights
- `addSetToMilestone()` in `src/lib/add-set.cjs:33` already calls `recalculateDAG()` at line 71 -- the auto-regroup call goes right after this
- `partitionIntoGroups(dag, contracts, numDevelopers)` in `src/lib/group.cjs:29` is fully implemented with tests; needs no modifications, only wiring
- `renderFooter()` in `src/lib/display.cjs:125` is the success-path pattern; error-path breadcrumbs should NOT reuse this function but follow a similar spirit
- `CliError` in `src/lib/errors.cjs` and `exitWithError()` are the error output mechanisms; breadcrumb standardization happens at throw sites, not in these utilities
- The USAGE string starts at `src/bin/rapid-tools.cjs:30` and runs ~70 lines
- `handleState` in `src/commands/state.cjs` handles state transitions -- this is where most state-transition errors originate
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
