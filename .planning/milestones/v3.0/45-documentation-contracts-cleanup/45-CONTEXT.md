# Phase 45: Documentation, Contracts & Cleanup - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Make v3.0 the documented, clean official version. Rewrite README.md as a landing page, create technical_documentation.md as the full reference, remove dead code (unused libraries, retired agents, wave/job artifacts), and simplify contracts (remove GATES.json entirely, retain CONTRACT.json, prune lock.cjs to STATE.json locks only). DOCS.md is NOT touched.

</domain>

<decisions>
## Implementation Decisions

### Documentation structure
- README.md: full rewrite as a landing page targeting new users
- technical_documentation.md: new file, full deep reference for v3
- DOCS.md: untouched — do not modify
- Full rewrite for both README and tech docs (not editing v2.2 content in-place)
- Primary audience: new users discovering RAPID for the first time

### README content
- Rich landing page: what RAPID is, install instructions, 60-second quickstart
- Architecture overview with ASCII diagram
- Command table
- Real-world example workflow
- Link to technical_documentation.md for full docs

### technical_documentation.md content
- Workflow-first structure: walk through full lifecycle (init -> plan -> execute -> review -> merge) with examples
- Commands woven into the narrative rather than isolated reference tables
- Full agent reference: table/section listing each agent, its role, when spawned, what it produces
- No troubleshooting section — keep focused on usage
- No references to wave-plan, job-plan, or other removed v2 concepts

### Dead code cleanup
- Delete entire files if fully unused (not just dead exports) — libraries, tests, and agent files
- Delete test files alongside their dead source files (no archiving)
- Delete retired agent .md files that are no longer referenced in v3 skills
- **CRITICAL: verify imports before deleting** — trace every file's consumers to confirm it's truly dead before removal
- Keep Phase 40's deprecation stubs (v2 commands still show migration messages)

### Contract simplification
- GATES.json: remove everything — generation, validation, loading, and all references across the codebase
- CONTRACT.json: keep as-is, no format changes (sole contract artifact in v3)
- lock.cjs: retain STATE.json mutation locks only, remove all set-gating lock logic

### Claude's Discretion
- Order of operations (docs first vs cleanup first vs interleaved)
- Exact ASCII diagram design for README
- Which agent files qualify as "retired" (verify through skill reference tracing)
- technical_documentation.md section ordering beyond the workflow-first principle
- How thorough the import tracing needs to be for dead code verification

</decisions>

<specifics>
## Specific Ideas

- "Make sure that you don't delete anything that is still needed/referenced" — dead code cleanup must be verified, not assumed
- README should feel like a GitHub landing page that sells RAPID to a new user
- technical_documentation.md replaces the v2.2 technical_documentation.md that existed before
- The v2.2 docs were a good effort but v3 changes are fundamental enough to warrant a clean slate

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- README.md (225 lines): v2.2 landing page — being fully rewritten
- DOCS.md (1045 lines): staying untouched
- technical_documentation.md: v2.2 version existed — being replaced

### Dead Code Candidates (require import verification)
- `src/lib/wave-planning.cjs` + `wave-planning.test.cjs`: v2 wave planning library
- `src/lib/teams.cjs` + `teams.test.cjs`: Agent Teams integration (v3 uses subagents only)
- GATES.json generation in `plan.cjs`, references in `rapid-tools.cjs`, `rapid-tools.test.cjs`
- ~15 files reference `wave-plan`, `job-plan`, `WaveState`, `JobState` — need line-level cleanup

### Established Patterns
- All v3 skills use set-level state only (Phase 38 simplification)
- Deprecation stubs use `disable-model-invocation: true` for zero-cost output (Phase 40)
- Phase 41 pruned 5 v2 roles during build pipeline — some agent files may already be gone

### Integration Points
- `src/lib/lock.cjs`: needs gating lock removal while preserving state lock
- `src/lib/plan.cjs`: GATES.json generation to remove
- `src/bin/rapid-tools.cjs`: CLI commands referencing GATES.json
- Agent files in `agents/`: check each against v3 skill SKILL.md files for references

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-documentation-contracts-cleanup*
*Context gathered: 2026-03-13*
