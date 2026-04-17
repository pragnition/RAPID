# DEFERRED: skill-invocation-ui

**Set:** skill-invocation-ui
**Generated:** 2026-04-16

## Deferred Decisions

Items raised during discussion that fall outside this set's scope.

| # | Decision/Idea | Source | Suggested Target |
|---|--------------|--------|-----------------|
| 1 | Recent-use / usage-tracking sort for the SkillGallery, requiring a small SQLite table to record launches per user | Gallery sort follow-up (Area 8) | Post-v7.0.0 polish milestone; revisit once real usage data is available |
| 2 | Full-state-introspection preconditions (DAG readiness, wave completeness, branch state) as a richer alternative to shallow gates | Precondition depth (Area 1) | Future hardening milestone; add only if shallow gates prove to leak too many bad dispatches |
| 3 | `CONTRACT.json` revision on `sanitized_args_contract` \u2014 the clause \"rejects shell metacharacters in set-ref args\" needs to be dropped/rewritten because we're skipping set-ref sanitization end-to-end; the <user_input> wrap + length caps remain | Set-ref sanitization follow-up | Handled inside this set during planning; not strictly deferred, but flagged here so plan-set treats the contract edit as an explicit wave task |
| 4 | Two-axis gallery taxonomy (behavior \u00d7 domain) if the flat 3-category filter proves insufficient as the skill catalog grows beyond 30 | Taxonomy depth (Area 5) | Future UI polish milestone |
| 5 | Multi-step launcher wizard for skills whose args benefit from staged input collection (none known today, but may arise as arg coverage grows) | Launcher layout (Area 6) | Future iteration if any skill crosses the ~10-arg cap or has strongly-staged input |

## Notes
- These items should be reviewed during `/rapid:new-version` planning
- Items may be promoted to backlog entries or new sets in future milestones
- Item #3 is a contract edit that belongs in this set's planning, not deferred \u2014 included here for visibility so plan-set picks it up
