# CONTEXT: backlog-system

**Set:** backlog-system
**Generated:** 2026-04-06
**Mode:** interactive

<domain>
## Set Boundary
Introduces a backlog capture system to RAPID via a new `/rapid:backlog` skill. Users and agents can capture out-of-scope feature ideas as individual files in `.planning/backlog/`. The audit-version skill is updated to surface accumulated backlog items during milestone audit. Agent role prompts (executor, planner) and the discuss-set skill are updated to hint at backlog usage. Scope is limited to capture and audit surfacing -- no management features (editing, deleting, listing, prioritization).
</domain>

<decisions>
## Implementation Decisions

### Backlog Item File Format
- **Markdown with YAML frontmatter** -- structured metadata in frontmatter, freeform description in body
- **Rationale:** Balances machine parseability with human readability, aligns with existing RAPID artifact conventions (CONTEXT.md, DEFERRED.md). Frontmatter holds title and creation date; body holds the description.

### Backlog Item Validation
- **No validation** on write or read in v1
- **Rationale:** Zero friction capture is the priority. Agents should never fail to persist an idea because of schema enforcement. Malformed items are rare and can be caught naturally during audit review.

### Agent Invocation Mechanism
- **Skill invocation** -- agents invoke `/rapid:backlog` the same way users do
- **Rationale:** Keeps the skill file as the single source of truth for format and logic. Consistent path for both users and agents, even though it's a heavier invocation than direct file writes.

### Source Tagging
- **No source tracking** -- backlog items do not capture which set they originated from
- **Rationale:** Keeps items minimal. Source context isn't worth the overhead; the item's description should be self-explanatory.

### Audit-Version Surfacing Strategy
- **Batch summary table** -- all backlog items shown in one table during audit
- **Rationale:** Efficient for any backlog size. User sees the full picture at once and can make batch or individual decisions without per-item prompting overhead.

### Audit Promotion Path
- **Both promote and defer** -- mirrors existing audit remediation flow
- **Rationale:** User chooses per item/batch whether to create a remediation set (via pending-sets artifact) or defer to the next version's planning. Consistent with audit-version's existing "create remediation set" / "defer" options.

### Post-Promotion Lifecycle
- **Delete the backlog file** after promotion or deferral, but **persist content to downstream artifacts** first
- **Rationale:** Clean backlog directory prevents re-surfacing stale items. Content is written to the audit report, pending-sets JSON, or deferred list before deletion so /add-set and /new-version can discover it. The audit report serves as the provenance record.

### Staleness Handling
- **No staleness mechanism** in v1
- **Rationale:** Trust the audit process to surface all items. Keep v1 scope minimal.

### Skill Invocation UX
- **Argument-driven with fallback prompts** -- accepts args when provided (`/rapid:backlog "idea title"`), prompts via AskUserQuestion when args are missing
- **Rationale:** Works for both interactive users (who may omit args) and agents (who always provide args). Dual-mode keeps friction low without sacrificing guidance.

### List Mode
- **No list mode** in v1 -- capture only
- **Rationale:** Users can browse `.planning/backlog/` directly. Audit-version surfaces items during milestone review. A --list flag is deferred to a future backlog-management set.

### Cross-Worktree Persistence
- **Committed with set work** -- backlog items are committed in the worktree and merge alongside set changes
- **Rationale:** Automatic, no special handling needed. Respects the worktree isolation model. Items lost if a set is abandoned, but this is acceptable since abandoned sets imply abandoned context.

### Duplicate Awareness
- **No write-time dedup** -- handle duplicates during audit review
- **Rationale:** Duplicates are rare in practice. Breaking worktree isolation for dedup is not worth the complexity. The batch summary table during audit naturally surfaces duplicates for human resolution.

### Agent Prompt Integration Depth
- **Dedicated section with examples** in executor and planner role prompts
- **Rationale:** Clear guidance with when/how examples ensures agents actually use the system. Adds ~5-8 lines per role prompt -- balanced presence without being overbearing.

### Agent Detection Model
- **Explicit capture only** -- agents capture when they naturally encounter out-of-scope ideas, not by actively scanning
- **Rationale:** High signal-to-noise ratio. Proactive scanning slows execution and risks false positives.

### Priority and Categorization
- **No priority field, no categories** -- items are simple title + description
- **Rationale:** Minimalist v1 approach. All items treated equally during audit triage. Priority and tagging deferred to future version.

### Claude's Discretion
- No areas were left to Claude's discretion -- all 8 gray areas were discussed.
</decisions>

<specifics>
## Specific Ideas
- Backlog item metadata is minimal: YAML frontmatter with `title` and `created` fields, Markdown body for description
- Audit-version integration should be an additive section (not restructuring existing flow) that reads `.planning/backlog/`, presents a batch table, and offers promote/defer per item
- When promoting, write content to `.planning/pending-sets/{name}.json` before deleting the backlog file
- When deferring, write content to the deferred items list (v{VERSION}-DEFERRED.md) before deleting the backlog file
- Discuss-set hint should mention backlog for out-of-scope ideas encountered during discussion
- Agent role prompt sections should include a concrete example: "If you discover a feature idea outside your set's scope, invoke `/rapid:backlog` with a title and description"
</specifics>

<code_context>
## Existing Code Insights
- `skills/audit-version/SKILL.md` already has Step 4 (Remediation and Deferral) with pending-sets artifacts and deferred items -- backlog surfacing should be a new step inserted before or alongside this
- `src/modules/roles/role-executor.md` has a Constraints section mentioning scope boundaries ("Never modify files outside your set's ownership list") -- the backlog hint section fits naturally after Constraints
- `src/modules/roles/role-planner.md` has a Constraints section about set boundaries -- similar integration point
- `skills/discuss-set/SKILL.md` Step 6.5 already captures deferred decisions -- the backlog hint could go in the Key Principles or Anti-Patterns section
- `.planning/backlog/` directory does not yet exist and will be created by the skill on first invocation
- The audit-version skill already writes `.planning/pending-sets/{name}.json` for remediation -- the same format can be reused for backlog promotions
</code_context>

<deferred>
## Deferred Ideas
- List mode (--list flag) for browsing existing backlog items
- Priority/categorization system for structured triage ordering
- Staleness mechanism for items unreviewed across milestones
- Proactive agent detection of out-of-scope ideas via code scanning
- Backlog management features (editing, deleting, re-prioritizing items)
</deferred>
