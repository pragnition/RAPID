# DEFERRED: docs-and-housekeeping

**Set:** docs-and-housekeeping
**Generated:** 2026-04-08

## Deferred Decisions

Items raised during discussion that fall outside this set's scope.

| # | Decision/Idea | Source | Suggested Target |
|---|--------------|--------|-----------------|
| 1 | Finalize ROADMAP.md v6.2.0 entry (mark shipped, collapse to `<details>` block) — explicit user directive: do NOT touch ROADMAP in this set | ROADMAP follow-up question | User-managed; outside RAPID set workflow |
| 2 | Pin policy for devDependencies (currently runtime-only) | Pin scope question | Future hardening set |
| 3 | `.npmrc save-exact=true` global policy as a second enforcement layer for dependency pins | Pin enforcement question | Future hardening set, only if pins regress |
| 4 | Nuanced version-string sweep that distinguishes historical markers from live references in `.planning/sets/*/CONTEXT.md` | Sweep scope question | Future docs cleanup set |

## Notes

- Item 1 (ROADMAP) is unique: the user has explicitly reserved it for themselves rather than deferring it to a future set.
- Items 2-4 should be reviewed during `/rapid:new-version` planning for the next milestone.
- Items may be promoted to backlog entries or new sets in future milestones.
