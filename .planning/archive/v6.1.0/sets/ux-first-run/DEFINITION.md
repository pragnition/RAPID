# Set: ux-first-run

**Created:** 2026-04-07 (via /add-set)
**Milestone:** v6.1.0

## Scope
Implement 5 deferred first-run UX items from the v6.1.0 audit: post-init workflow guide, status empty-state guidance, init-to-first-set bridge, fuzzy command matching, and status contextual hints. All require SKILL.md modifications.

## Key Deliverables
- Post-init workflow guide (item 3.1): after /rapid:init completes, display a brief workflow guide showing the next steps
- Status empty-state guidance (item 3.2): when /rapid:status shows no sets, display helpful guidance for getting started
- Init-to-first-set bridge (item 3.3): bridge the gap between init completion and starting the first set
- Fuzzy command matching (item 2.2): suggest similar commands when an unknown command is entered
- Status contextual hints (item 2.3): /rapid:status shows contextual next-step suggestions based on current state

## Dependencies
None

## Files and Areas
- skills/init/SKILL.md
- skills/status/SKILL.md
- src/bin/rapid-tools.cjs
- Carry-forward context: .planning/v6.1.0-UX-AUDIT.md
