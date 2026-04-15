# Set: wireframe-rollout

**Created:** 2026-04-15 (via /add-set)
**Milestone:** v7.0.0

## Scope

Apply the newly branded wireframe (produced via the branding skill) across the Mission Control frontend shell AND rewrite the CONTRACT.json files for every pending downstream set in this milestone so their exports/imports/file-ownership reflect the new UI structure.

This set is the rollout vehicle for the redesign: it makes the wireframe real in code, then propagates the design's implications through the planning artifacts so downstream sets execute against the new shape instead of the pre-redesign contracts.

## Key Deliverables

- Updated frontend shell — layout, theme, routing, and top-level components — to match the new branded wireframe.
- New design tokens / shared components introduced by the wireframe (colors, spacing, typography, primitives) wired into `web/frontend/`.
- Rewritten `.planning/sets/web-tool-bridge/CONTRACT.json` reflecting UI surfaces the bridge now feeds.
- Rewritten `.planning/sets/skill-invocation-ui/CONTRACT.json` aligned to the redesigned skill invocation surface.
- Rewritten `.planning/sets/kanban-autopilot/CONTRACT.json` aligned to the redesigned kanban surface.
- Rewritten `.planning/sets/agents-chats-tabs/CONTRACT.json` aligned to the redesigned agents + chats tab surface.
- DEFINITION.md updates on any downstream set whose UI scope shifts materially under the new wireframe.

## Dependencies

- `agent-runtime-foundation` (merged) — backend runtime the redesigned frontend consumes.

This set is intended to land **before** the four pending downstream sets (`web-tool-bridge`, `skill-invocation-ui`, `kanban-autopilot`, `agents-chats-tabs`), since they will consume its rewritten contracts. Those sets should declare `wireframe-rollout` as a dependency when they are planned, so the DAG orders them after this set.

## Files and Areas

- `web/frontend/**` — layout, theme, component library, routes, design tokens (wireframe implementation).
- `.planning/sets/web-tool-bridge/CONTRACT.json`
- `.planning/sets/skill-invocation-ui/CONTRACT.json`
- `.planning/sets/kanban-autopilot/CONTRACT.json`
- `.planning/sets/agents-chats-tabs/CONTRACT.json`
- `.planning/sets/{downstream}/DEFINITION.md` — touch only where UI scope has materially shifted under the new wireframe.

## Notes

The wireframe itself was produced via `/rapid:branding` and is already in place (check `.planning/branding/` for the generated artifacts). This set does not redo branding — it implements and propagates it.
