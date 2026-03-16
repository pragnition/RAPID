# CONTEXT: foundation-hardening

**Set:** foundation-hardening
**Generated:** 2026-03-16
**Mode:** interactive

<domain>
## Set Boundary
Foundation reliability and hygiene fixes that other v3.3.0 sets depend on. Covers: Zod `.passthrough()` on all state schemas to prevent field stripping, version synchronization between package.json and plugin.json, `rapidVersion` field in STATE.json, atomic `writeRegistry()`, `npm test` script, and schema versioning strategy.

No skill or agent prompt files are modified. No new dependencies. All changes are confined to library modules and package manifests.
</domain>

<decisions>
## Implementation Decisions

### Version Sync Target
- Sync both package.json and plugin.json to **3.2.0**
- `version.cjs` continues reading from **package.json** as the canonical source
- Add a test asserting both files contain the same version string

### Schema Version Strategy
- Change `z.literal(1)` to `z.number().min(1)` — open-ended, allowing future schema version bumps without code changes
- Existing STATE.json files with `version: 1` will continue to validate

### rapidVersion Field
- Populated during `/rapid:init` only (new projects) — NOT backfilled on every writeState() call
- Field is `z.string().optional()` in the schema (semver string, e.g., "3.2.0")
- Existing projects without the field will pass validation (optional)

### npm test Script
- Use `node --test 'src/**/*.test.cjs'` with recursive glob
- Minimal flags — no --experimental-test-coverage or other extras
- Keep it simple and fast

### Claude's Discretion
- `.passthrough()` application strategy (which schemas get it, ordering)
- Atomic `writeRegistry()` implementation details (tmp file naming, error handling)
- Test organization and assertion patterns
</decisions>

<specifics>
## Specific Ideas
- Version sync test: read both package.json and plugin.json, assert versions match
- Schema passthrough: apply `.passthrough()` to all object schemas (JobState, WaveState, SetState, MilestoneState, ProjectState)
- Atomic writeRegistry: mirror the existing tmp+rename pattern from writeState() in state-machine.cjs
</specifics>

<code_context>
## Existing Code Insights
- `state-schemas.cjs`: 5 Zod object schemas (JobState, WaveState, SetState, MilestoneState, ProjectState) — none use `.passthrough()`
- `state-machine.cjs`: `writeState()` already uses atomic tmp+rename pattern at line 82-85 — good reference for writeRegistry()
- `worktree.cjs`: `writeRegistry()` at line 225-233 uses bare `fs.writeFileSync()` — no atomic protection
- `version.cjs`: reads from `../../package.json` relative to __dirname — correct path resolution
- `package.json`: version 3.0.0, no `scripts.test` field
- `plugin.json`: version 3.2.0 — this is the current accurate version
- `ProjectState.parse()` is called in `writeState()` (line 76) and `withStateTransaction()` (line 167) — both strip unknown fields currently
</code_context>

<deferred>
## Deferred Ideas
- Node.js 22 engine bump (mentioned in ROADMAP but not in CONTRACT.json — out of scope for this set)
- Test coverage reporting (could be added later as a separate concern)
</deferred>
