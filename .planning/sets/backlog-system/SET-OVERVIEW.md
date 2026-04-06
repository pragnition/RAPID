# SET-OVERVIEW: backlog-system

## Approach

This set introduces a backlog capture system to RAPID, solving a gap in the current workflow: when agents or users encounter feature ideas that fall outside the current set's scope, there is no structured way to preserve them. The `/rapid:backlog` skill will provide a first-class mechanism to persist these ideas as individual structured files in `.planning/backlog/`, preventing scope creep while ensuring good ideas are never lost.

The implementation follows a three-layer strategy. First, build the core backlog skill itself -- the SKILL.md file in a new `skills/backlog/` directory, the CLI-level support for the backlog storage format, and the `.planning/backlog/` directory convention. Second, integrate backlog surfacing into the existing `audit-version` skill so that accumulated backlog items are reviewed during milestone audits and can be promoted to deferred items or new sets. Third, update the `discuss-set` skill and relevant agent role prompts (execute-set, plan-set) to hint at backlog usage whenever out-of-scope ideas are encountered during development.

The backlog item format will be individual JSON or Markdown files with structured metadata (title, description, source set, priority suggestion, creation date) stored in `.planning/backlog/`. This per-file approach aligns with RAPID's existing artifact conventions and avoids merge conflicts when multiple agents write backlog items concurrently from different worktrees.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `skills/backlog/SKILL.md` | Main backlog skill -- slash command and agent-callable interface | New |
| `skills/audit-version/SKILL.md` | Updated to parse `.planning/backlog/` and surface items during audit | Existing (modify) |
| `skills/discuss-set/SKILL.md` | Updated to hint at backlog usage for out-of-scope ideas | Existing (modify) |
| `src/modules/roles/role-executor.md` | Updated to mention backlog capture when hitting scope boundaries | Existing (modify) |
| `src/modules/roles/role-planner.md` | Updated to reference backlog for out-of-scope discoveries during planning | Existing (modify) |
| `.planning/backlog/` | Runtime directory for persisted backlog item files | New (directory) |

## Integration Points

- **Exports:** The `/rapid:backlog` skill provides a callable interface for both users (slash command) and agents (programmatic invocation). Backlog items are written as individual files to `.planning/backlog/`, which serves as the shared data contract.
- **Imports:** The backlog skill itself has no imports from other sets. The `audit-version` skill reads from `.planning/backlog/` to discover accumulated items. The `discuss-set` skill and agent roles only add instructional hints (no runtime dependency).
- **Side Effects:** Creates files in `.planning/backlog/` at runtime. Modifies audit output to include backlog item recommendations. Changes agent behavior by prompting backlog capture instead of silently dropping out-of-scope ideas.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Concurrent backlog writes from parallel worktrees causing conflicts | Medium | Use individual files with unique names (timestamp + slug) rather than a single backlog file |
| Backlog skill invocation complexity for agents (must know the interface) | Low | Keep the interface minimal -- a single command with title and description; add clear examples in role prompts |
| Audit-version integration increasing skill complexity | Medium | Keep backlog parsing as an additive section in audit-version rather than restructuring the existing flow |
| Scope creep into backlog management features (prioritization, editing, deletion) | Low | Limit v1 to capture and surfacing only; defer management features to a future set (and use the backlog system itself to track them) |

## Wave Breakdown (Preliminary)

- **Wave 1:** Core backlog skill -- create `skills/backlog/SKILL.md`, define the backlog item file format and naming convention, establish `.planning/backlog/` directory handling
- **Wave 2:** Audit integration -- update `skills/audit-version/SKILL.md` to scan `.planning/backlog/`, parse items, and present them as deferral or new-set candidates during milestone audit
- **Wave 3:** Agent prompt updates -- update `skills/discuss-set/SKILL.md`, `role-executor.md`, and `role-planner.md` to hint at backlog usage when out-of-scope ideas arise

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
