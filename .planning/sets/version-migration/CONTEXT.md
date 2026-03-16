# CONTEXT: version-migration

**Set:** version-migration
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
This set introduces a `/rapid:migrate` command that enables users to upgrade their `.planning/` state from older RAPID versions to the current version. The command detects the current version, creates a backup, performs migration, and reports results. Scope includes the migration skill, CLI command handler, and the agent-driven migration logic. Scope excludes changes to existing state schemas or other commands.
</domain>

<decisions>
## Implementation Decisions

### Version Detection
- Use **heuristic detection** to infer the current RAPID version when `rapidVersion` is missing from STATE.json
- Heuristics should examine: milestone naming patterns, state schema shape, presence of specific fields (e.g., `rapidVersion`, wave/job structures)
- After detection, **show the detected version and ask the user to confirm** before proceeding with migration
- If detection is ambiguous, present the user with the most likely candidates

### Migration Strategy (Agent-Driven)
- **No hardcoded migration step functions.** Instead of a registry of `(fromVersion, toVersion)` step functions, the migration spawns an agent that dynamically analyzes the current `.planning/` state against the target version's expected format
- The agent explores the codebase to understand the current RAPID version's conventions and the target version's expected structure, then performs whatever transformations are needed
- This replaces the originally proposed `registerMigration()` framework with a more flexible agent-based approach
- The CONTRACT.json `migrationStepFramework` export should be dropped or replaced with the agent-based approach

### Backup Strategy
- Claude's Discretion (user did not select this area for discussion)
- Recommendation: full recursive copy of `.planning/` to `.planning/.pre-migrate-backup/` before any changes, with auto-cleanup on successful migration

### Skill UX & Report
- `--dry-run` flag: agent produces a plan of **proposed changes** (diff-style preview) without writing any files, shown to the user for review
- Migration report: **printed to stdout only**, not written as a persistent file
- Before applying changes: **prompt the user for confirmation** after showing proposed changes (even in non-dry-run mode)
- Flow: detect version -> confirm detected version -> backup -> agent analyzes & proposes changes -> show changes -> confirm -> apply -> report to stdout
</decisions>

<specifics>
## Specific Ideas
- The migration agent should be smart enough to explore the codebase and infer what transformations are needed rather than relying on pre-written migration scripts
- Version detection heuristics can leverage milestone ID patterns (e.g., numeric IDs like "01-plugin-infrastructure" vs string IDs like "status-rename") and schema fields
</specifics>

<code_context>
## Existing Code Insights
- `rapidVersion` field is optional in `ProjectState` Zod schema at `src/lib/state-schemas.cjs:35`
- `createInitialState()` in `src/lib/state-machine.cjs:22` accepts and stamps `rapidVersion`
- CLI router at `src/bin/rapid-tools.cjs` imports handlers from `src/commands/*.cjs` -- new `migrate` command follows this pattern
- Existing command pattern: `src/commands/<name>.cjs` exports a `handle<Name>()` function
- Foundation-hardening (Set 1) already merged, so `rapidVersion` infrastructure is available
</code_context>

<deferred>
## Deferred Ideas
- Automated migration testing against snapshots of real historical `.planning/` directories
- Migration rollback command (`/rapid:migrate --rollback`) to restore from backup
</deferred>
