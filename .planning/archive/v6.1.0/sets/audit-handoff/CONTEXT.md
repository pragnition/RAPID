# CONTEXT: audit-handoff

**Set:** audit-handoff
**Generated:** 2026-04-06
**Mode:** interactive

<domain>
## Set Boundary
Design and implement the REMEDIATION artifact for audit-to-set handoff. Audit-version writes structured context to `.planning/pending-sets/`. Add-set auto-discovers and pre-populates scope. Status displays pending sets. Synchronize Node.js minimum version to >=22.
</domain>

<decisions>
## Implementation Decisions

### Artifact Schema Richness
- Claude's Discretion -- determine appropriate field set for the remediation JSON artifact
- **Rationale:** The schema is a straightforward data structure question; Claude can derive the right fields from the CONTRACT.json exports and the audit-version gap data model.

### Artifact Persistence Strategy
- Gitignored -- artifacts are local-only ephemeral handoff files, not git-tracked
- Directory created lazily on first write via `mkdirSync({ recursive: true })`
- **Rationale:** Remediation artifacts are inherently transient (written then consumed). Git-tracking would add noise for files that exist briefly between audit and add-set invocations. Lazy creation avoids empty directories in projects that never use audit-version.

### Artifact Lifecycle and Cleanup
- Delete consumed artifacts after successful commit -- not on read, not manually
- No expiry or staleness logic -- artifacts persist until consumed or manually deleted; status surfaces them for awareness
- **Rationale:** Deleting after commit is safe (if add-set fails mid-flow, the artifact survives for retry). No expiry keeps the module simple; RAPID is a power-user tool where explicit cleanup is preferable to magic.

### Validation Approach
- Manual checks -- simple `JSON.parse` + field existence validation, no Zod/Ajv dependency
- On malformed artifact: warn and return null, so callers fall through to their default path (add-set falls to interactive discovery, status skips the entry)
- **Rationale:** The artifact is a simple flat JSON with ~5 fields. Zod/Ajv would create unnecessary coupling. The gracefulFallback behavioral contract already requires null-return handling, so warn-and-null is consistent.

### Audit Write Granularity
- One artifact per suggested remediation set -- maps 1:1 to what add-set creates
- Filename uses the user-provided kebab-case set name from audit Step 4e (e.g., `fix-auth-validation.json`)
- **Rationale:** The user already names remediation sets during the audit flow. One artifact per named set gives a clean 1:1 mapping to add-set's one-set-at-a-time model, and the filename naturally becomes the suggested set ID.

### Add-Set Discovery UX
- Always check for pending artifacts on every add-set invocation (no `--from-audit` flag needed)
- Present artifact context and confirm before proceeding -- user sees what the audit recommended and can adjust
- **Rationale:** Checking is a negligible `fs.existsSync` + `readdirSync`. Presenting and confirming respects user agency -- they should see and approve what's being pre-populated, not have it silently injected.

### Status Dashboard Integration
- Separate "Pending Remediations" section below the set table (not inline count)
- Detail level: name + 1-line scope description per artifact
- **Rationale:** Pending remediations are a different concept from sets -- they're suggestions waiting to become sets. A separate section with name + scope gives enough context to decide whether to act, without cluttering the main set dashboard.

### Multi-Artifact Selection
- When multiple artifacts exist: present list, let user pick which to create
- When exactly one artifact exists: auto-select it (skip the selection list)
- **Rationale:** User controls ordering when multiple exist. Auto-select for single artifacts avoids unnecessary friction in the common case. The "present and confirm" step still applies regardless.

### Claude's Discretion
- Artifact schema richness (field selection for the remediation JSON structure)
</decisions>

<specifics>
## Specific Ideas
- Artifact filenames double as suggested set IDs in add-set, reducing friction
- The `listPendingRemediations()` function powers both status display and add-set discovery
- Cleanup responsibility lives in add-set Step 7 (after commit), not in the remediation module itself
</specifics>

<code_context>
## Existing Code Insights
- `src/lib/remediation.cjs` is a new module -- no existing code to modify
- `skills/audit-version/SKILL.md` Step 4e already asks for set names in kebab-case -- the artifact write integrates naturally here
- `skills/add-set/SKILL.md` Step 1 loads state -- artifact discovery fits before Step 2 (interactive discovery)
- `skills/status/SKILL.md` Step 3 displays the dashboard -- pending remediations section goes after the set table
- The behavioral contract specifies `noStateMutation` -- artifacts operate entirely outside STATE.json
- The behavioral contract specifies `gracefulFallback` -- add-set must work identically when no artifact exists
</code_context>

<deferred>
## Deferred Ideas
- No deferred items identified.
</deferred>
