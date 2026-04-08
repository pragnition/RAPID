# DEFERRED: fixes-and-housekeeping

**Set:** fixes-and-housekeeping
**Generated:** 2026-04-09

## Deferred Decisions

Items raised during discussion that fall outside this set's scope.

| # | Decision/Idea | Source | Suggested Target |
|---|--------------|--------|-----------------|
| 1 | Context file regeneration deferred to milestone close — all 4 files (CODEBASE.md, ARCHITECTURE.md, CONVENTIONS.md, STYLE_GUIDE.md) should be regenerated after all v6.3.0 sets merge to capture the full state | Context Regeneration Timing gray area | v6.3.0 milestone close (via /rapid:quick or /rapid:new-version) |
| 2 | Development mode detection — showing "dev" label in sidebar when running outside a production build could improve DX | Frontend Version Fallback gray area | Future UX polish milestone |
| 3 | Document-level keyboard shortcut conflict management — if multiple modals coexist, Ctrl+Enter handlers could conflict; a shortcut registry pattern may be needed | Keyboard Shortcut Scope gray area | Future interactive features set |

## Notes
- Item 1 is the most actionable: the context regeneration task from this set's definition is being deferred to milestone close
- Items 2-3 are speculative improvements noted during discussion
- These items should be reviewed during `/rapid:new-version` planning
