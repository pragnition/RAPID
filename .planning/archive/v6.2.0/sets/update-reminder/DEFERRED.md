# DEFERRED: update-reminder

**Set:** update-reminder
**Generated:** 2026-04-07

## Deferred Decisions

Items raised during discussion that fall outside this set's scope.

| # | Decision/Idea | Source | Suggested Target |
|---|--------------|--------|-----------------|
| 1 | Method-aware banner CTA: detect marketplace vs clone install and tailor the suggested command (e.g., `git pull && /rapid:install` for clone users) | Gray area: Banner CTA | Future UX polish milestone |
| 2 | CLI `--threshold-days` flag on `state install-meta` for one-off programmatic threshold overrides | Gray area: Threshold knob | Future DX milestone (only if user demand emerges) |
| 3 | Store `.rapid-install-meta.json` in `~/.config/rapid/` to survive plugin upgrades | Gray area: Meta file location | Future install/lifecycle milestone (only if upgrade-survival becomes a real requirement) |
| 4 | Snooze / dismiss command: `state install-meta --snooze 7d` with a `snoozedUntil` field | Gray area: Snooze | Future UX polish milestone (only if NO_UPDATE_NOTIFIER proves too coarse) |
| 5 | Surface the update reminder in additional skills beyond status/install (e.g., /rapid:help, /rapid:init) | Gray area: Banner emission point | Future onboarding milestone |

## Notes
- These items should be reviewed during `/rapid:new-version` planning
- Items may be promoted to backlog entries or new sets in future milestones
- All deferred items are intentional scope cuts -- the v6.2.0 design follows the canonical update-notifier convention as closely as possible
