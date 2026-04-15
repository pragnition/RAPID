# PLAN: wireframe-rollout / Wave 2 — Shell & Pages Rewrite

**Set:** wireframe-rollout
**Wave:** 2 of 3
**Status:** pending (blocked on Wave 1)
**Set worktree path:** `.rapid-worktrees/wireframe-rollout/`

## Objective

Make the branded wireframe real in the live frontend. Rewrite the application shell (sidebar, header, layout), restructure the router, reconcile the keyboard bindings to the CONTEXT map, rebind the command palette to ⌘K with sets+pages+commands search, and restyle all 11 pages using the Wave 1 primitives. Add placeholder `/agents` and `/chats` routes.

Why: delivers the user-visible redesign per CONTEXT "Migration Strategy: In-place rewrite" and "Scope of Page Restyling: Fully restyle all 11 existing pages".

## Prerequisite

Wave 1 is merged / present on the set branch. Verify before starting:

```
ls web/frontend/src/components/primitives/index.ts
grep -c "^export" web/frontend/src/components/primitives/index.ts   # expect >= 22
```

If either check fails, STOP and emit a BLOCKED return with category `DEPENDENCY`.

## File Ownership (exclusive)

Wave 2 owns exclusively:

- `web/frontend/src/components/layout/AppLayout.tsx`
- `web/frontend/src/components/layout/Header.tsx`
- `web/frontend/src/components/layout/Sidebar.tsx`
- `web/frontend/src/router.tsx`
- `web/frontend/src/App.tsx`
- `web/frontend/src/types/layout.ts`
- `web/frontend/src/components/ui/CommandPalette.tsx` (rebind, extend)
- `web/frontend/src/pages/**` — ALL 11 existing files PLUS two NEW files `AgentsPage.tsx`, `ChatsPage.tsx`
- `web/frontend/src/types/command.ts` — only if the command registry needs a new entry kind for set-jump; prefer leaving the type untouched and encoding via `category`

Wave 2 must NOT touch:

- `web/frontend/src/components/primitives/**` (Wave 1 territory — consume only)
- `web/frontend/src/styles/**` (Wave 1 territory — already frozen post-Wave 1)
- `web/frontend/src/hooks/useTheme.ts`, `web/frontend/src/hooks/useLayoutStore.ts` — per CONTEXT "ThemeProvider NO change needed" and risk R12 "Do NOT rename `rapid-sidebar` localStorage key". Read-only.
- `web/frontend/src/components/ui/TooltipOverlay.tsx` — retain as-is; only CommandPalette gets rebind edits.
- `web/frontend/src/components/{editor,graph,kanban,prompts}/**` — render them from pages, but do not refactor their internals in this wave. If a page import needs adapting, wrap it instead of editing the sub-component.
- Any `.planning/**` file — that is Wave 3.

## Geometry Reconciliation (do this before any layout edit)

Wireframe mandates `grid-template-columns: 232px 1fr; grid-template-rows: 56px 1fr` (wireframe.html line 82). Current app uses `w-60` (240px) sidebar + `h-12` (48px) header. Three files must change together:

- `Sidebar.tsx`: `w-60` → `w-58` is closest Tailwind; actually use `w-[232px]` arbitrary value to match wireframe exactly. Compact state stays `w-16`. Hidden state stays `w-0 overflow-hidden`.
- `Header.tsx`: `h-12` → `h-14` (56px). Left/right margin to match sidebar width: `md:ml-60` → `md:ml-[232px]` for full; `md:ml-16` for compact; `md:ml-0` for hidden.
- `AppLayout.tsx`: `pt-12` → `pt-14`; match sidebar offsets: `md:ml-60` → `md:ml-[232px]`, keep `md:ml-16` and `md:ml-0`.

All three changes are atomic — must ship in one commit per risk R11.

## Tasks

### Task 1 — NAV_ITEMS grouping + shortcut reconciliation

**Edit:** `web/frontend/src/types/layout.ts`.

Replace the flat `NAV_ITEMS` with the grouped shape:

```ts
export type NavGroupId = "workspace" | "execution" | "library";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  shortcut?: string;
}

export interface NavGroupDef {
  id: NavGroupId;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "\u2302", path: "/", shortcut: "gd" },
      { id: "projects", label: "Projects", icon: "\u25A3", path: "/projects", shortcut: "gp" },
      { id: "codebase", label: "Codebase", icon: "\u2630", path: "/codebase" },
    ],
  },
  {
    id: "execution",
    label: "Execution",
    items: [
      { id: "graph", label: "Knowledge Graph", icon: "\u25CB", path: "/graph", shortcut: "gh" },
      { id: "kanban", label: "Kanban", icon: "\u25A6", path: "/kanban", shortcut: "gk" },
      { id: "worktrees", label: "Worktrees", icon: "\u2442", path: "/worktrees", shortcut: "gw" },
      { id: "state", label: "State", icon: "\u25C9", path: "/state", shortcut: "gs" },
      { id: "agents", label: "Agents", icon: "\u2726", path: "/agents", shortcut: "ga" },
      { id: "chats", label: "Chats", icon: "\u2630", path: "/chats", shortcut: "gc" },
    ],
  },
  {
    id: "library",
    label: "Library",
    items: [
      { id: "notes", label: "Notes", icon: "\u270E", path: "/notes" },
      { id: "settings", label: "Settings", icon: "\u2699", path: "/settings" },
    ],
  },
];

// Back-compat flat list for CommandPalette registry iteration
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
```

Shortcut map matches CONTEXT authoritative: `gd=/, gp=/projects, gh=/graph, gk=/kanban, gw=/worktrees, gs=/state, ga=/agents, gc=/chats`. Codebase / Notes / Settings receive no `shortcut` per CONTEXT.

Verification: `npx tsc -b` passes; existing imports of `NAV_ITEMS` still resolve.

### Task 2 — Sidebar rewrite

**Edit:** `web/frontend/src/components/layout/Sidebar.tsx`.

Changes:

1. Swap `w-60` → `w-[232px]` on desktop nav; preserve `w-16` compact and `w-0 overflow-hidden` hidden. Mobile drawer stays `w-60` (drawer overlay geometry is not in wireframe scope).
2. Replace the flat `NAV_ITEMS.map` render with a loop over `NAV_GROUPS` that wraps each group's items in the `NavGroup` primitive from `@/components/primitives`. When `isCompact`, render items only (no group labels — labels look awful in 64px column).
3. Replace the active-item class `bg-hover text-accent` with the wireframe's exact pattern (wireframe.html line 650 `.active`): `bg-bg-2 text-accent border-l-[3px] border-accent -ml-[3px] pl-[11px]` (the negative margin + reduced pl keeps total horizontal space stable per risk R9).
4. Replace the `<span className="text-lg flex-shrink-0">{item.icon}</span>` icon with the wireframe's 6px status dot pattern: render `<StatusDot tone={isActive ? "accent" : "muted"} size="sm" />` (from primitives). Keep this behavior only in `isFull` mode; compact mode still shows the glyph icon for legibility.
5. Replace the bottom "RAPID v<version>" bare-`span` footer with a two-row block: row 1 is `<HealthDot online={true} />` + small mono meta text ("backend online · <uptime>") per wireframe.html lines 663, 802. For now, supply `online={true}` statically and the meta line as `"backend online"` — no wiring to a live probe (out of scope; `agents-chats-tabs` owns `consolidated_dashboard_endpoint`). The version label becomes `text-muted text-xs` below the health row.
6. Retain `ProjectSelector` and `CompactProjectIndicator` but move `ProjectSelector` into a small "brand row" at the top: a 28×28 `rounded-md bg-bg-1 border border-accent text-accent font-mono text-[11px] flex items-center justify-center` containing `R` (wireframe brand mark — wireframe.html section on `.brand`), followed by the project selector below it. Compact mode collapses to just the brand mark. Do NOT change `useProjects` / `useProjectStore` behavior.
7. Preserve the three sidebar states (`full`, `compact`, `hidden`) per risk R10. Preserve `rapid-sidebar` localStorage key — **do not touch `useLayoutStore`** (risk R12).

Citations: wireframe.html lines 643–666 (sidebar shell), 171–198 (header adjacency), guidelines.html "Sidebar nav groups" section.

Verification: `npx tsc -b` + `npx vite build`; manual visual check — switch through full/compact/hidden via existing keybinds `l`/`h`; confirm group labels render only in full mode and active item has the 3px left accent bar.

### Task 3 — Header rewrite

**Edit:** `web/frontend/src/components/layout/Header.tsx`.

Changes:

1. `h-12` → `h-14`. `md:ml-60` → `md:ml-[232px]`. Keep hidden/compact offsets correct.
2. Replace the "RAPID Mission Control" placeholder with the `Breadcrumb` primitive consuming `useLocation()` from `react-router`. Segment derivation: strip leading `/`, split on `/`, title-case each segment. Root path renders `[{ label: "RAPID" }, { label: "Dashboard" }]`. Link each non-terminal segment back to its parent path.
3. In the center slot (was empty), insert the `SearchInput` primitive with `shortcutHint={<Kbd>⌘K</Kbd>}`, `minWidth={280}`, `placeholder="Search sets, pages, commands"`. Clicking or focusing this input opens the command palette — wire via `onFocus` to a new prop `onOpenPalette` that AppLayout passes through, OR (simpler) via `onSubmit={(v) => openPalette(v)}`. Pick whichever requires fewer prop additions; document choice in a comment.
4. Replace the existing `<select>` theme picker + mode-toggle `<button>` with a single `<ThemePicker>` primitive instance wired to `useTheme()`. Props: `themeId`, `mode`, `onThemeIdChange={setThemeId}`, `onModeToggle={toggleMode}`, and a derived `themes` array from `THEMES` (map `{id, label}` → `{id, label, swatch: <hex>}` — look up each theme's accent color from the theme's css file or hardcode a small table; hardcoding the 4 accent swatches is acceptable here since the list is frozen).
5. Keep the mobile hamburger button. It still calls `toggleMobileDrawer`.
6. Pass `onToggleShortcuts` through unchanged.

Citations: wireframe.html lines 669–694 (header with breadcrumb + `.mc-search` + theme-swatch cluster).

Verification: `npx tsc -b` + `npx vite build`; manual check — header is 56px tall, search input renders with ⌘K hint, 4 theme swatches toggle themes instantly.

### Task 4 — AppLayout rewrite

**Edit:** `web/frontend/src/components/layout/AppLayout.tsx`.

Changes:

1. `pt-12` → `pt-14`. `md:ml-60` → `md:ml-[232px]`.
2. Keyboard bindings reconciliation (risk R2). Replace the current `bindings` array with the reconciled CONTEXT map:

   | key | action | retained? |
   |-----|--------|-----------|
   | `l` | Expand sidebar | yes |
   | `h` | Collapse sidebar | **CONFLICT** — CONTEXT map binds `gh` → `/graph`. Keep `h` for sidebar but be aware `gh` chord has higher precedence because it's a chord starting with `g`. Existing keyboard library already handles chord-vs-key ordering. Verify by probing `types/keyboard.ts` before editing. |
   | `/` | Open command palette | **retain as ALTERNATE** per risk R3 ("Keep `/` as alternate") |
   | `Meta+k` / `Control+k` | Open command palette | **NEW** primary |
   | `?` (shift) | Toggle shortcut overlay | yes |
   | `Escape` | Close overlays | yes |
   | `gg` | Scroll to top | yes |
   | `gd` | `/` | yes |
   | `gp` | `/projects` | yes |
   | `gh` | `/graph` | **NEW** (was `gk=/graph`) |
   | `gk` | `/kanban` | **NEW** (was `gb=/kanban`) |
   | `gw` | `/worktrees` | yes |
   | `gs` | `/state` | yes |
   | `ga` | `/agents` | **NEW** |
   | `gc` | `/chats` | **NEW** (was `gc=/codebase`) |

   Removed bindings: `gk=/graph` (reassigned), `gb` (if present), `gc=/codebase` (reassigned). Codebase gets NO shortcut (CONTEXT).

   Add `Meta+k` / `Ctrl+k` by constructing a binding with `key: "k"` and `ctrl: true` plus a second binding with `key: "k"` and `alt: false` — actually use the `KeyBinding` interface fields per `types/keyboard.ts` (`ctrl?`, `shift?`, `alt?`). If Meta is not distinguishable from Ctrl in that interface, use `ctrl: true` which on macOS the keyboard lib should translate. **Verify by reading `types/keyboard.ts` and `KeyboardContext.tsx` before committing** and adjust as needed.

3. Keep `showCommandPalette` state, `showShortcuts` state, `closeAllOverlays`, `toggleShortcuts` unchanged in shape.
4. Pass-through to `Header` an `onOpenPalette={() => setShowCommandPalette(true)}` prop (Task 3 consumes it).

Citations: wireframe.html command palette overlay (lines 1201–1226); BRANDING.md `<interaction-patterns>` keyboard-first spec.

Verification: `npx tsc -b` + `npx vite build`; manual check — every CONTEXT shortcut navigates correctly; ⌘K opens palette; `/` still opens palette.

### Task 5 — CommandPalette rebind + extended search

**Edit:** `web/frontend/src/components/ui/CommandPalette.tsx`.

Current state: auto-registers 5 nav commands on mount, renders a fuzzy-search overlay, triggered from `/`. Changes:

1. Trigger is now `⌘K` per Task 4; no edit inside CommandPalette is needed for the trigger itself (AppLayout wires it).
2. Extend command registration: on mount, register a command for each item in `NAV_ITEMS` (from the new grouped `types/layout.ts`) via `commandRegistry.register` — use the nav item's `shortcut` as hint, category `"navigation"`, icon `"#"` per wireframe entry-type icon mapping.
3. Add a new category `"set-jump"` — on mount, fetch `.planning/sets` via the existing projects/sets API (check `web/frontend/src/hooks/` for an existing sets hook; if none exists, use a one-shot `fetch("/api/sets?project=...")` inside a `useEffect`; if no such API exists yet, skip set-jump registration silently with a `// TODO: wire set-jump once sets API lands` comment — this is acceptable because `agents-chats-tabs` owns the consolidated dashboard endpoint). Entries render with icon `@` per wireframe.
4. Register slash-commands: for each entry in the array `["rapid:status", "rapid:plan-set", "rapid:execute-set", "rapid:discuss-set", "rapid:start-set", "rapid:review", "rapid:merge"]` register a command with icon `>`, category `"command"`, action that logs a toast "command <name> is dispatched via agent runtime" (the actual dispatch lives in `agents-chats-tabs`). Keep the list as a `const COMMANDS = [...]` at module top.
5. Restyle the palette overlay using primitives: backdrop `bg-black/40`, palette body `SurfaceCard` `elevation={2}` `className="w-[640px] max-w-[90vw]"`. Input uses `SearchInput` primitive with the `>` prefix faked via an absolutely-positioned `<span class="text-accent">` inside the relative wrapper (exact match to wireframe.html line 568 `.cmd-input::before`). Result rows: `grid grid-cols-[24px_1fr_auto] items-center gap-3 px-3 py-2 rounded-md` — active row adds `bg-surface-3`. Icon column renders the entry-type symbol; label column renders the `label` (support `<b>` highlighting of matched substring — the existing registry's search result should already provide match spans). Hint column renders via the `Kbd` primitive.
6. Keyboard: `↑`/`↓` navigate, `↵` executes active, `Esc` closes (already handled by overlay escape in AppLayout).

Citations: wireframe.html lines 552–577 + 1201–1226; BRANDING.md `<interaction-patterns>` "`⌘K` palette".

Verification: `npx tsc -b` + `npx vite build`; manual — open via ⌘K, type "exec" → `rapid:execute-set` command appears with `>` icon; type "kan" → Kanban nav appears with `#` icon and `gk` hint; type "wire" → set-jump entry appears with `@` icon (if sets API is wired).

### Task 6 — Router: add `/agents` and `/chats` stubs

**Edit:** `web/frontend/src/router.tsx`.

Add two imports + two route children. The new pages live at `web/frontend/src/pages/AgentsPage.tsx` and `web/frontend/src/pages/ChatsPage.tsx` (Task 7 creates them).

```
import { AgentsPage } from "@/pages/AgentsPage";
import { ChatsPage } from "@/pages/ChatsPage";
// ...
{ path: "agents", element: <AgentsPage /> },
{ path: "chats", element: <ChatsPage /> },
```

Place them between `kanban` and `notes` to match the Execution group ordering. Do NOT alter the `<AppLayout />` root or existing routes (risk R6).

Verification: `npx tsc -b` + `npx vite build`; navigate to `/agents` and `/chats` — placeholder page renders.

### Task 7 — Stub pages for `/agents` and `/chats`

**Create:** `web/frontend/src/pages/AgentsPage.tsx`:

```tsx
import { PageHeader, EmptyState, StatusBadge } from "@/components/primitives";

export function AgentsPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Agents"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Agents" }]}
        description="Autonomous skill runs. Detail filled by the agents-chats-tabs set."
        actions={<StatusBadge label="stub" tone="muted" />}
      />
      <EmptyState
        title="No agent runs yet"
        description="The agents-chats-tabs set wires this surface. Launcher lands after skill-invocation-ui merges."
      />
    </div>
  );
}
```

**Create:** `web/frontend/src/pages/ChatsPage.tsx` — same shape with `title="Chats"`, breadcrumb last segment `"Chats"`, description mentions `agents-chats-tabs`, empty state message "No chat threads yet".

Citation: CONTEXT.md "Future-Facing Nav Stubs".

Verification: both pages render, `npx tsc -b` + `npx vite build` pass.

### Task 8 — Restyle 11 existing pages

Each page adopts the wireframe's page shell: `PageHeader` at the top (title + breadcrumb + optional actions), main content in `SurfaceCard` or primitive-composed sections, empty states via `EmptyState`, tables via `DataTable`, lifecycle state via `StatusBadge`. Preserve all current behavior — `useQuery` calls, form handlers, mutation wires — only **visual composition** changes.

Per-page directives below. For each, the executor reads the current file, identifies visual regions, and swaps raw markup for primitive compositions. Behavior tests (there are none — risk R14) do not gate; typecheck + build do.

#### `DashboardPage.tsx` — wireframe section 01 (lines 640–785)
- Render `<NextActionBanner>` at the top with mock command text "rapid:execute-set web-tool-bridge" and `<StatusBadge label="ready" tone="accent" />` (content stubbed; actual wiring lives with `agents-chats-tabs` consolidated dashboard endpoint).
- Below the banner, a 4-column `grid grid-cols-2 lg:grid-cols-4 gap-4` of `StatCard`s: "Sets in progress" (value from existing state hook), "Running agents" (stub 0 for now with a TODO comment to wire `consolidated_dashboard_endpoint`), "Waves executed today" (stub 0), "Worktrees" (from existing worktrees hook).
- Below stat cards, two-column layout `grid grid-cols-[2fr_1fr] gap-6`: left column is "Recent Activity" feed (use `SurfaceCard` + `DataTable` with columns: time (mono, `text-muted`), agent (mono), message, status `StatusBadge`); right column is a key-value `SurfaceCard` showing project metadata from existing project hook.
- Page title: "Dashboard"; breadcrumb `[{ label: "RAPID", to: "/" }, { label: "Dashboard" }]`.

#### `ProjectsPage.tsx` — wireframe section 04 (lines 1100–1200)
- `PageHeader` title "Projects". Action slot: "Register Project" button using primary `bg-accent text-bg-0 rounded px-3 py-1.5` style.
- Body: `DataTable` with columns derived from existing list — name (mono), path (mono text-muted), status (`StatusBadge`), last activity (mono text-muted), action (ghost button "Open").
- Empty state via `EmptyState` primitive with action button "Register your first project".

#### `KanbanBoard.tsx` — wireframe section 03 (lines 983–1080)
- `PageHeader` title "Kanban", breadcrumb ends at "Kanban", actions: filter controls (retain current filter UI but wrap in the action slot).
- Keep the existing `components/kanban/` column/card rendering — but wrap each column header in the `SurfaceCard` primitive with `elevation=1` and the column title in `text-xs uppercase tracking-wider text-muted`. Retain the existing card-drag behavior untouched.
- Column count: wireframe grid uses 4 columns; current data may have more — retain data-driven count, do not hard-code to 4.

#### `KnowledgeGraphPage.tsx` — wireframe section 02 (lines 785–980)
- `PageHeader` title "Knowledge Graph", breadcrumb ends "Knowledge Graph".
- Wireframe shows a left rail with node list + right canvas; current page already has a similar layout. Wrap the left rail `<aside>` in `SurfaceCard` `elevation=1`; the canvas remains untouched (graph rendering is in `components/graph/`, out of scope).
- If the existing page has a loading skeleton, replace it with the existing Suspense fallback but style the text as `text-muted mono`.

#### `WorktreePage.tsx`
- `PageHeader` title "Worktrees".
- Body: `DataTable` columns — set ID (mono), branch (mono text-muted), status (`StatusBadge`), path (mono truncated with tooltip), last commit (mono text-muted), actions (ghost buttons).

#### `StatePage.tsx`
- `PageHeader` title "State", description "Live project state. Canonical source is .planning/STATE.json."
- Existing JSON/tree view: wrap container in `SurfaceCard` with `elevation=1 className="p-0 overflow-hidden"` to let the tree fill. No primitive exists for tree view — leave the tree component intact.

#### `CodebasePage.tsx`
- `PageHeader` title "Codebase".
- Body: two-column layout — left rail `SurfaceCard` for folder tree; right `SurfaceCard` for file view. If current page has a different structure, retain it but swap containers for `SurfaceCard`.

#### `NotesPage.tsx`
- `PageHeader` title "Notes", action: "New Note" primary button.
- List of notes: `DataTable` columns — title, updated (mono text-muted), tags (chips via `StatusBadge` with `tone="info"`).
- **IMPORTANT:** NotesPage imports `NoteEditor` from `pages/NoteEditor.tsx` (risk R4). Do NOT rename or move `NoteEditor.tsx`; treat it as a component even though it lives under `pages/`.

#### `NoteEditor.tsx`
- Since it's imported as a component, keep its outer shape minimal. Wrap the editor's top bar in the `SurfaceCard` pattern with `elevation=2`. Do NOT add `PageHeader` here (NotesPage renders the header).

#### `SettingsPage.tsx`
- `PageHeader` title "Settings".
- Sections as `SurfaceCard`s: "Theme" (wrap `ThemePicker` inline for redundancy with header), "Keyboard shortcuts" (render the full shortcut table via `DataTable`), "About" (version + paths).

#### `NotFoundPage.tsx`
- Center an `EmptyState` with `title="Page not found"`, description "The requested route does not exist.", action: ghost button "Back to Dashboard" navigating to `/`.

Verification per page: `npx tsc -b` passes; navigate via sidebar / ⌘K / g-prefix shortcut; visual sanity — no unstyled regions, no console errors, no broken data hooks.

### Task 9 — Geometry atomicity commit

The Sidebar/Header/AppLayout geometry edits from Tasks 2, 3, 4 must land in a single atomic commit to avoid intermediate broken states (risk R11). If Tasks 2/3/4 are split across multiple commits during iteration, **squash** the geometry-specific hunks into one commit named `refactor(wireframe-rollout): reconcile shell geometry to 232px/56px per wireframe`. The rest of each task's scope (nav grouping, theme picker wiring, keybindings) can be in separate commits.

## Acceptance (Wave 2 Success Criteria)

1. `npx tsc -b` (from `web/frontend`) reports zero errors.
2. `npx vite build` (from `web/frontend`) succeeds.
3. Manual navigation via every CONTEXT shortcut lands on the right page: `gd→/`, `gp→/projects`, `gh→/graph`, `gk→/kanban`, `gw→/worktrees`, `gs→/state`, `ga→/agents`, `gc→/chats`.
4. `⌘K` opens the command palette; `/` also opens it (alternate retained per risk R3).
5. Sidebar shows three nav groups ("Workspace", "Execution", "Library") in full mode; group labels hide in compact mode; all three sidebar states still cycle via `l`/`h`; `rapid-sidebar` localStorage key still used (verify in DevTools).
6. Header is 56px tall; sidebar is 232px wide in full mode; content area has `pt-14 ml-[232px]` offsets.
7. Every page (`/`, `/projects`, `/state`, `/worktrees`, `/graph`, `/codebase`, `/kanban`, `/notes`, `/settings`, `/agents`, `/chats`, and `/nonexistent` for NotFound) renders without console errors and uses at least one primitive from `@/components/primitives`.
8. `git diff --stat main` shows file changes only under the Wave 2 ownership list above. Zero edits under `components/primitives/**` or `styles/**`.
9. `rapid-theme` / `rapid-mode` localStorage keys still function (risk: verify by switching themes via new `ThemePicker`, reloading, confirming persistence).
10. The existing `CommandPalette` auto-registered commands still work (existing 5 plus the new nav entries, command entries, and set-jump entries when sets API is wired).

## Commit Plan

- `refactor(wireframe-rollout): restructure NAV_ITEMS into grouped NAV_GROUPS` (Task 1)
- `refactor(wireframe-rollout): reconcile shell geometry to 232px/56px per wireframe` (atomic Sidebar+Header+AppLayout geometry hunks — Task 9)
- `feat(wireframe-rollout): render sidebar with nav groups and primitives` (remainder of Task 2)
- `feat(wireframe-rollout): render header with breadcrumb search and theme picker` (remainder of Task 3)
- `refactor(wireframe-rollout): reconcile keyboard bindings to CONTEXT map` (remainder of Task 4)
- `feat(wireframe-rollout): extend CommandPalette with pages/commands/set-jump and ⌘K binding` (Task 5)
- `feat(wireframe-rollout): add /agents and /chats stub routes` (Task 6 + Task 7)
- `feat(wireframe-rollout): restyle dashboard page with wireframe surfaces` (Task 8 — DashboardPage)
- One commit per subsequent page in Task 8: `feat(wireframe-rollout): restyle <page> per wireframe` — 10 more commits. Do not batch multiple page rewrites into one commit (per CONVENTIONS "Each task produces exactly one commit").

## Notes for Executor

- Do **not** edit `components/primitives/**` to fix a Wave 2 need — if a primitive's API is wrong, report BLOCKED with category `DEPENDENCY` and a precise list of what's missing. Wave 1 owns that surface.
- When a page's existing behavior collides with primitive composition (e.g. a table's custom sort), retain the behavior first; composition is cosmetic. Never regress working functionality for visual parity.
- ⌘K detection: verify against `context/KeyboardContext.tsx` before writing the binding. If the existing library represents Meta-key as its own field (not `ctrl`), use that field explicitly.
- If a page imports something from `components/ui/` that isn't in primitives, leave the import. Do not migrate higher-level widgets into primitives — CONTEXT says `ui/` is retained.
- Chord conflict sanity: the `h` binding (collapse sidebar) should NOT shadow the `gh` chord (→ /graph). `KeyboardContext` must evaluate chord-prefix `g` first. Verify by manual test; if broken, fix the chord detection in `KeyboardContext` and report the fix in CHECKPOINT notes — but prefer to route the fix via CONTEXT ownership boundaries if it turns out to be a non-trivial library change.
