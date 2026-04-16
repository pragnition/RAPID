# SET-OVERVIEW: wireframe-rollout

## Approach

This set is a two-part rollout of the Mission Control redesign: it makes the branded wireframe real in the frontend code, and then propagates the design's structural implications backward into the planning artifacts (CONTRACT.json, DEFINITION.md) of the four pending downstream sets so they plan and execute against the correct UI shape. The branding/wireframe work itself is already complete — its artifacts live under `.planning/branding/` and should be treated as the source of truth for layout, theme, and component primitives.

The implementation strategy is frontend-shell-first: introduce the design tokens and shared primitives (colors, spacing, typography, layout scaffolding) in `web/frontend/` before touching feature surfaces, so that downstream work can build against a stable theme and component library. Once the shell is in place, update routing and top-level components to match the new layout. The contract rewrite phase is deliberately separated from the code phase — each downstream set's CONTRACT.json is rewritten as a focused editorial task grounded in what the new wireframe actually exposes (surfaces, props, data needs), not in what the old contracts assumed.

Because this set blocks four downstream sets (`web-tool-bridge`, `skill-invocation-ui`, `kanban-autopilot`, `agents-chats-tabs`), its contract rewrites are effectively the handoff. Getting the exports/imports right matters more than getting every pixel of the frontend shell perfect — downstream sets can refine visual details, but they cannot recover from mis-specified contracts without costly replanning.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/frontend/**` (theme / tokens) | Design tokens: colors, spacing, typography | New or heavily updated |
| `web/frontend/**` (layout shell) | Top-level layout, routing scaffold | Updated |
| `web/frontend/**` (shared primitives) | Component library primitives introduced by wireframe | New |
| `.planning/branding/**` | Wireframe source of truth (read-only input) | Existing |
| `.planning/sets/web-tool-bridge/CONTRACT.json` | Rewritten to reflect new UI surfaces | Rewrite |
| `.planning/sets/skill-invocation-ui/CONTRACT.json` | Rewritten for redesigned skill invocation surface | Rewrite |
| `.planning/sets/kanban-autopilot/CONTRACT.json` | Rewritten for redesigned kanban surface | Rewrite |
| `.planning/sets/agents-chats-tabs/CONTRACT.json` | Rewritten for redesigned agents + chats tab surface | Rewrite |
| `.planning/sets/{downstream}/DEFINITION.md` | Scope/file-list updates where UI materially shifted | Targeted edits |

## Integration Points

- **Exports:** CONTRACT.json currently declares no exports. The *real* handoff is the rewritten downstream CONTRACT.json files — those become the binding interface for the four pending sets. The frontend shell also exports design tokens and shared primitives consumed by all downstream UI work.
- **Imports:** Consumes the merged `agent-runtime-foundation` backend (runtime APIs the redesigned frontend calls) and the wireframe artifacts under `.planning/branding/`.
- **Side Effects:** Rewriting downstream CONTRACT.json files changes the planning substrate for four sets. Any of those sets that have already been discussed or planned will need replanning against the new contracts. DAG edges should be added so the four downstream sets declare `wireframe-rollout` as a dependency.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rewritten downstream contracts drift from what the wireframe actually implies | High | Ground each CONTRACT.json rewrite in specific wireframe artifacts; cite the exact screen/component in the contract |
| Frontend shell changes break unrelated existing screens not covered by the wireframe | Medium | Keep shell changes additive where possible; introduce new primitives alongside old ones and migrate per-surface |
| Downstream sets already started/planned under old contracts require rework | Medium | Check status of `web-tool-bridge`, `skill-invocation-ui`, `kanban-autopilot`, `agents-chats-tabs` before rewriting; flag any that need explicit replan |
| Design tokens collide with existing styles | Medium | Namespace new tokens; audit existing theme usage before replacing |
| DEFINITION.md edits on downstream sets are too aggressive and invalidate their scope | Low | Edit only where UI scope *materially* shifted; leave unchanged where wireframe is additive |
| Branding artifacts under `.planning/branding/` are incomplete or ambiguous | Medium | Verify artifact completeness in Wave 1 before implementation; escalate gaps rather than improvising |

## Wave Breakdown (Preliminary)

- **Wave 1:** Audit `.planning/branding/` artifacts and current `web/frontend/` state. Introduce design tokens and shared primitives. No feature-surface changes yet.
- **Wave 2:** Apply new layout, routing, and top-level components in `web/frontend/` — the frontend shell becomes the wireframe.
- **Wave 3:** Rewrite the four downstream CONTRACT.json files and apply targeted DEFINITION.md edits where UI scope has materially shifted. Ensure DAG edges are in place so downstream sets depend on this one.

Note: This is a preliminary breakdown. Detailed wave/job planning happens during `/rapid:discuss-set` and `/rapid:plan-set`.
