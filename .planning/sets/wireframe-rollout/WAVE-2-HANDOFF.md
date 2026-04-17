# Wave 2 Handoff — Shell & Pages Rewrite

## Status
Complete. `npx tsc -b` clean. `npx vite build` succeeds.

## What landed
- `types/layout.ts` — restructured into `NAV_GROUPS` (3 groups: Workspace, Execution, Library) with back-compat `NAV_ITEMS` flat list. Added `Agents` (ga) and `Chats` (gc) entries. Updated shortcuts: `gh→/graph`, `gk→/kanban`. Codebase now shortcut-less.
- Shell geometry reconciled to 232px sidebar / 56px header (atomic commit 5122283).
- `Sidebar.tsx` — groups nav items via `NavGroup`; active item rail with `StatusDot accent` + 3px left border; bottom footer with `HealthDot online` row + version row; top brand "R" mark. Preserves full/compact/hidden states and `rapid-sidebar` localStorage.
- `Header.tsx` — `Breadcrumb` from `useLocation()`; center `SearchInput` wrapped in click-through that opens palette; `ThemePicker` with verified dark-mode accent swatches (`#A7C080`/`#A6E3A1`/`#B8BB26`/`#9ECE6A`); mobile hamburger preserved; `onToggleShortcuts` unchanged.
- `AppLayout.tsx` — keyboard bindings reconciled to CONTEXT map. Added `⌘K` and `Ctrl+K` palette triggers, `ga`/`gc`/`gh`/`gk` nav chords. Removed obsolete `gb`, changed `gk→/kanban` (was `/graph`). Codebase binding removed. Passes `onOpenPalette` to Header.
- `CommandPalette.tsx` — full restyle using `SurfaceCard` elevation=2; `>` accent prefix on input; grid rows (icon/label+category/kbd) with `bg-surface-3` active state. Registers commands per `NAV_ITEMS` (category `navigation`, icon `#`) and `SLASH_COMMANDS` array (category `command`, icon `>`). Set-jump category stubbed with `// TODO: wire set-jump once sets API lands`.
- `router.tsx` — new `/agents` (`AgentsPage`) and `/chats` (`ChatsPage`) routes between kanban and notes.
- 2 new stub pages (`AgentsPage.tsx`, `ChatsPage.tsx`) with `PageHeader` + `EmptyState` + `StatusBadge label="stub"`.
- 11 existing pages restyled with primitives: Dashboard, Projects, Kanban, KnowledgeGraph, Worktrees, State, Codebase, Notes, NoteEditor, Settings, NotFound. Behavior preserved — only visual composition changed.

## Decisions
- **Keyboard infra extension**: added `meta?: boolean` to `KeyBinding` and `useKeyboardNav.ts` matches `e.metaKey`. This was necessary for true ⌘K on macOS (the prior infra had no Meta field). Change is additive and 2 lines across 2 files; no behavioral change to existing bindings. These files were not in Wave 2 ownership list but were not in the "MUST NOT touch" exclusion either.
- **Ctrl+K also bound** alongside ⌘K for cross-platform ergonomics.
- **Set-jump**: no `useSets` hook exists yet; registration is TODO per plan.
- **Slash commands**: stub `console.log(...)` dispatch per plan — real runtime wiring deferred to skill-invocation-ui set.
- **Kanban inner column styling**: plan asked to wrap each column header in `SurfaceCard`, but `KanbanColumn` is inside `components/kanban/` (Wave 2 MUST NOT touch). Only the outer page shell was restyled. This is a known compositional gap documented for review.
- **NoteEditor**: wrapped title+toolbar block in single `SurfaceCard elevation=2` with `rounded-none border-x-0 border-t-0` to keep the full-width top-bar look while using the primitive.
- **SettingsPage**: pulls keyboard shortcut rows from `useGlobalBindings()` so the page auto-reflects the live keybinding registry; no hardcoded shortcut list.
- **DashboardPage**: all stats are stubbed (`--` / `0`) with TODO comments pointing at `consolidated_dashboard_endpoint`.
- **TooltipOverlay** deliberately untouched per exclusion list.

## Commit log
```
25c7685 feat(wireframe-rollout): restyle NotFoundPage per wireframe
d1526ab feat(wireframe-rollout): restyle SettingsPage per wireframe
0e4080f feat(wireframe-rollout): restyle NoteEditor per wireframe
2a7b89b feat(wireframe-rollout): restyle NotesPage per wireframe
734fac9 feat(wireframe-rollout): restyle CodebasePage per wireframe
f6554f6 feat(wireframe-rollout): restyle StatePage per wireframe
78612ee feat(wireframe-rollout): restyle WorktreePage per wireframe
3b6c5ac feat(wireframe-rollout): restyle KnowledgeGraphPage per wireframe
46b63be feat(wireframe-rollout): restyle KanbanBoard per wireframe
d5634e8 feat(wireframe-rollout): restyle ProjectsPage per wireframe
c3ae4ff feat(wireframe-rollout): restyle DashboardPage per wireframe
f68a3df feat(wireframe-rollout): add /agents and /chats stub routes
7cc2594 feat(wireframe-rollout): extend CommandPalette with pages/commands/set-jump and ⌘K binding
8a40d41 feat(wireframe-rollout): render header with breadcrumb search and theme picker
8bb47c3 feat(wireframe-rollout): render sidebar with nav groups and primitives
5122283 refactor(wireframe-rollout): reconcile shell geometry to 232px/56px per wireframe
967c120 refactor(wireframe-rollout): restructure NAV_ITEMS into grouped NAV_GROUPS
```

## Wave 3 handoff notes
- Wave 3 should be free to touch any file, including primitives. This wave's ownership list is released.
- Known gaps (intentionally scoped out):
  - Dashboard stats need `consolidated_dashboard_endpoint` wiring (TODOs in DashboardPage.tsx).
  - Command palette set-jump needs `useSets` hook (TODO in CommandPalette.tsx).
  - Slash-command dispatch needs agent runtime (TODO in CommandPalette.tsx).
  - Kanban column headers not wrapped in SurfaceCard (owned by `components/kanban/`).
