# Phase 25: GSD Decontamination - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove all GSD vestiges from RAPID's product code, tests, and runtime identities. After this phase, agents identify as RAPID-native at every layer — source code, test assertions, and runtime agent spawn names. No source file in src/ should contain "gsd" in any agent type name or variable identifier.

</domain>

<decisions>
## Implementation Decisions

### State version key rename
- Rename `gsd_state_version: 1.0` to `rapid_state_version: 1.0` in `src/lib/init.cjs` (the STATE.md template RAPID generates for user projects)
- Key rename only — version stays at 1.0 (it represents the state format version, not RAPID's product version)
- Update `src/lib/init.test.cjs` assertions to match the new key name
- Update `test/.planning/STATE.md` test fixture to use `rapid_state_version: 1.0`

### Planning doc cleanup scope
- Do NOT modify `.planning/` files in this repo — those are GSD workflow tool artifacts, not RAPID product code
- Only RAPID product code (src/, skills/, test fixtures) gets cleaned
- The distinction: GSD-the-workflow-tool generated these planning docs, which is fine. RAPID-the-product should not emit "gsd" in its own outputs.

### Legacy archive handling
- Move `mark2-plans/` directory to `.archive/mark2-plans/` — entire directory is v2.0 planning artifacts, all historical
- Move `.review/` directory to `.archive/review/` — old review scope artifacts from v1.0/v1.1
- Use `.archive/` (hidden directory) to keep repo root clean

### Migration strategy
- Add auto-migration logic in `src/bin/rapid-tools.cjs` — a shared function that any skill calling rapid-tools can trigger
- When `gsd_state_version` is detected in a user's STATE.md, silently rewrite it to `rapid_state_version` (preserving the version number)
- Migration is silent — no user-facing notice, just do it
- Clean break for new projects: `/rapid:init` generates `rapid_state_version: 1.0` from the start

### Claude's Discretion
- Exact placement of migration function within rapid-tools.cjs
- Whether to add .archive/ to .gitignore or keep it tracked
- Any additional GSD references found during implementation in comments/strings that the grep missed

</decisions>

<specifics>
## Specific Ideas

- The broader grep for GSD/gsd/GetShitDone/get-shit-done across src/ and skills/ found contamination ONLY in `src/lib/init.cjs` and its test — skills and modules are already clean
- `src/modules/roles/` and `src/modules/core/` have zero GSD references
- All SKILL.md files already use RAPID naming (no GSD agent types)
- The `assembler.cjs` already generates `rapid-{role}` frontmatter for agents

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/init.cjs:generateStateMd()` — the single function that emits `gsd_state_version`. Direct edit target.
- `src/bin/rapid-tools.cjs` — CLI tool called by all skills. Natural home for shared migration logic.

### Established Patterns
- Agent names follow `rapid-{role}` pattern (already established in assembler.cjs)
- YAML frontmatter format: `---` delimited, key: value pairs
- Test fixtures in `test/.planning/` mirror production output format

### Integration Points
- `rapid-tools.cjs` is invoked by skills via `node ~/.claude/rapid/src/bin/rapid-tools.cjs` — migration runs at this entry point
- `init.cjs` is imported by init skill and by rapid-tools.cjs for project initialization
- No other file reads or parses `gsd_state_version` at runtime — purely a template output token

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-gsd-decontamination*
*Context gathered: 2026-03-09*
