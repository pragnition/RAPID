# DEFERRED: bugfix-wave-splitting

**Set:** bugfix-wave-splitting
**Generated:** 2026-04-09

## Deferred Decisions

Items raised during discussion that fall outside this set's scope.

| # | Decision/Idea | Source | Suggested Target |
|---|--------------|--------|-----------------|
| 1 | Remove or restructure the `cross-wave-handoff` export from CONTRACT.json. User decided during discussion to skip handoff entirely, which contradicts the current contract. plan-set should either update the contract to reflect the no-handoff decision, or explicitly document the divergence. | Gray Area: Cross-wave handoff payload shape (follow-up question) | plan-set for this set (contract reconciliation before planning waves) |
| 2 | Remove or document-as-reserved the vestigial UAT default wave size (5) in the contract description. UAT mode is left unchanged by this set, so "default 5 for UAT" has no implementation target. | Gray Area: UAT mode interaction | plan-set for this set (contract reconciliation) |
| 3 | Re-tune default wave sizes (currently 3 normal) based on empirical data from real-world usage. Defaults are overridable via `--wave-size`, so tuning is non-breaking. | Gray Area: Wave-splitting trigger/floor | Future milestone after v6.3.0 ships and real usage data accumulates |
| 4 | Re-introduce cross-wave handoff as an opt-in `--wave-handoff` flag if regression issues surface in practice. Would preserve the simple default while giving power users an escape hatch. | Gray Area: Cross-wave handoff (follow-up discussion) | Future set, only if regression issues are observed |
| 5 | Apply wave-splitting to UAT mode as an opt-in enhancement. The "Sort-then-group" decision was captured during discussion but is currently moot since UAT is left unchanged; it could be revived if a future set enables wave-splitting for UAT. | Gray Area: UAT mode interaction / UAT sort order | Future milestone, only if UAT wave-splitting is proposed later |

## Notes
- Items 1 and 2 are **actionable for plan-set immediately** — they are contract reconciliation tasks that must be resolved before wave planning begins on this set.
- Items 3, 4, and 5 are future considerations that should be reviewed during `/rapid:new-version` planning for subsequent milestones.
- These items may be promoted to backlog entries or new sets in future milestones.
