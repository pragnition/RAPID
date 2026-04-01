# DEFERRED: scaffold-overhaul

**Set:** scaffold-overhaul
**Generated:** 2026-04-01

## Deferred Decisions

Items raised during discussion that fall outside this set's scope.

| # | Decision/Idea | Source | Suggested Target |
|---|--------------|--------|-----------------|
| 1 | Multi-language stub marker support (Python `#`, Go `//`, Rust `//`) -- currently JS-only with `.rapid-stub` sidecar as language-agnostic bridge | RAPID-STUB marker richness | Future milestone if RAPID expands beyond CJS |
| 2 | Transitive stub generation across deeply nested dependency chains -- deferred in favor of planner-driven stub decisions | Cross-group stub transitivity | Future milestone if multi-team workflows demand it |
| 3 | Ongoing foundation set scope enforcement via commit hooks -- deferred in favor of scaffold-time-only validation | Foundation scope enforcement | Future milestone if scope violations become a problem |

## Notes
- These items should be reviewed during `/rapid:new-version` planning
- Items may be promoted to backlog entries or new sets in future milestones
