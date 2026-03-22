# Wave 2: Layout Shell, Keyboard Navigation & UI Components

## Objective

Build the full application layout (sidebar with 3 collapse states, header with theme controls, content area with routing), the vim-style keyboard navigation system, command palette stub, and keyboard shortcut tooltip overlay. By the end of this wave, the app has a navigable UI with working sidebar, theme switching, keyboard shortcuts, and stub pages routed via React Router.

## Prerequisites

Wave 1 must be complete: project builds, theme CSS files exist, Tailwind @theme integration works.

## Tasks

### Task 1: Theme types and useTheme hook

**Files created:**
- `web/frontend/src/types/theme.ts`
- `web/frontend/src/hooks/useTheme.ts`

**Actions:**
1. Create `src/types/theme.ts` with:
   - `ThemeId` type: `'everforest' | 'catppuccin' | 'gruvbox' | 'tokyonight'`
   - `ThemeMode` type: `'dark' | 'light'`
   - `ThemeConfig` interface: `{ id: ThemeId; mode: ThemeMode; label: string }`
   - `THEMES` constant array: 4 entries with `id`, `label` (display name) for each theme.
   - Helper function `getThemeDataAttr(id: ThemeId, mode: ThemeMode): string` returning `${id}-${mode}`.
2. Create `src/hooks/useTheme.ts`:
   - Read initial values from `localStorage.getItem('rapid-theme')` (default `'everforest'`) and `localStorage.getItem('rapid-mode')` (default `'dark'`).
   - Expose: `themeId`, `mode`, `setThemeId(id)`, `setMode(mode)`, `toggleMode()`.
   - On any change, update `document.documentElement.dataset.theme` and write both values to localStorage.
   - Use `React.useSyncExternalStore` or `useState` with `useEffect` for syncing.
   - Export the hook and a `ThemeProvider` context wrapper so child components access theme via `useTheme()` hook.

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

---

### Task 2: Keyboard navigation system

**Files created:**
- `web/frontend/src/types/keyboard.ts`
- `web/frontend/src/hooks/useKeyboardNav.ts`
- `web/frontend/src/context/KeyboardContext.tsx`

**Actions:**
1. Create `src/types/keyboard.ts`:
   - `KeyBinding` interface: `{ key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; description: string; category: string; action: () => void; when?: () => boolean }`
   - `KeyCombo` type for display: `{ keys: string[]; description: string; category: string }`
   - Categories: `'navigation'`, `'global'`, `'sidebar'`, `'view'`
2. Create `src/hooks/useKeyboardNav.ts`:
   - Takes an array of `KeyBinding[]`.
   - Registers a single `keydown` listener on `document`.
   - **Input suppression:** Before matching, check if `document.activeElement` is an `INPUT`, `TEXTAREA`, or has `contentEditable`. If so, only allow `Escape` (which blurs the input). All other bindings are suppressed.
   - **Key matching:** Compare `event.key` (case-sensitive) against registered bindings. Check modifier flags (ctrl, shift, alt). If `when` predicate exists, only fire if it returns `true`.
   - **Prefix keys:** Support `g` as a prefix key. When `g` is pressed alone, enter a "pending prefix" state with a 500ms timeout. The next key press within the timeout matches `g+<key>` combinations (e.g., `gg` for go-to-top, `gp` for go-to-projects). If timeout expires, clear prefix state.
   - Cleanup: remove listener on unmount.
   - Return nothing (void) -- side-effect only hook.
3. Create `src/context/KeyboardContext.tsx`:
   - A context that holds the global binding registry.
   - `KeyboardProvider` component that wraps children.
   - `useRegisterBindings(bindings: KeyBinding[])` hook that registers bindings on mount, unregisters on unmount. This allows per-view bindings to layer on top of global bindings.
   - `useGlobalBindings()` hook that returns all registered `KeyCombo[]` for the tooltip overlay.

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

**What NOT to do:**
- Do NOT use `keyCode` -- use `event.key` only.
- Do NOT attach listeners to individual elements -- single document-level listener.
- Do NOT call `preventDefault()` unconditionally -- only prevent default for matched bindings to avoid breaking browser defaults (e.g., Ctrl+C for copy).

---

### Task 3: Sidebar component with 3 collapse states

**Files created:**
- `web/frontend/src/types/layout.ts`
- `web/frontend/src/components/layout/Sidebar.tsx`
- `web/frontend/src/hooks/useLayoutStore.ts`

**Actions:**
1. Create `src/types/layout.ts`:
   - `SidebarState` type: `'full' | 'compact' | 'hidden'`
   - `NavItem` interface: `{ id: string; label: string; icon: string; path: string; shortcut?: string }`
   - Navigation items constant: Dashboard (`/`), Projects (`/projects`), Graph (`/graph`), Notes (`/notes`), Settings (`/settings`). Use simple emoji or Unicode symbols for icons (no icon library in this set -- downstream can replace with Lucide/etc.).
2. Create `src/hooks/useLayoutStore.ts`:
   - A small Zustand store (separate from the project store).
   - State: `sidebarState: SidebarState` (default `'full'`), `isMobileDrawerOpen: boolean` (default `false`).
   - Actions: `cycleSidebarForward()` (full -> compact -> hidden -> full), `cycleSidebarBack()` (reverse), `setSidebarState(state)`, `toggleMobileDrawer()`, `closeMobileDrawer()`.
   - Persist `sidebarState` to `localStorage.setItem('rapid-sidebar')` on change. Read initial value from localStorage.
3. Create `src/components/layout/Sidebar.tsx`:
   - Renders a `<nav>` element with fixed position on the left.
   - **Full state (width ~240px):** Shows icon + label for each nav item, with keyboard shortcut hint text in `text-muted` to the right of each label.
   - **Compact state (width ~64px):** Shows icon only, with tooltip on hover showing label.
   - **Hidden state (width 0):** Sidebar is not visible. Content takes full width.
   - **CSS transitions:** Use `transition-all duration-200` for smooth width changes.
   - **Mobile (<768px):** Sidebar renders as an overlay drawer. When `isMobileDrawerOpen` is true, sidebar slides in from the left over a semi-transparent backdrop. Clicking backdrop or pressing Esc calls `closeMobileDrawer()`.
   - **Project selector at top:** A dropdown/select at the top of the sidebar (above nav links) showing the active project name. This is a stub placeholder -- the actual project list comes from the Zustand store in Wave 3. For now, render "No project selected" as static text.
   - Each nav item is a `<NavLink>` from React Router with `activeClassName` styling using `bg-hover text-accent` for active state.
   - Bottom section: version text "RAPID v4.0.0" in `text-muted text-xs`.

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

---

### Task 4: Header component with theme controls

**Files created:**
- `web/frontend/src/components/layout/Header.tsx`

**Actions:**
1. Create `src/components/layout/Header.tsx`:
   - Fixed top bar spanning the width minus the sidebar.
   - Background: `bg-surface-0` with a bottom border `border-b border-border`.
   - **Left section:** Hamburger menu icon (mobile only, `md:hidden`) that toggles `isMobileDrawerOpen`. Breadcrumb placeholder text.
   - **Right section:**
     - Theme selector dropdown: A `<select>` element listing all 4 themes by label. Value is the current `themeId`. On change, calls `setThemeId()`.
     - Dark/light mode toggle: A button that calls `toggleMode()`. Shows a sun/moon Unicode symbol based on current mode.
     - Keyboard shortcut hint: "?" button that toggles the tooltip overlay visibility.
   - Style all controls with theme-aware classes: `bg-surface-1`, `text-fg`, `border-border`, hover states using `hover:bg-hover`.

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

---

### Task 5: AppLayout and React Router setup

**Files created:**
- `web/frontend/src/components/layout/AppLayout.tsx`
- `web/frontend/src/router.tsx`
- `web/frontend/src/pages/DashboardPage.tsx`
- `web/frontend/src/pages/ProjectsPage.tsx`
- `web/frontend/src/pages/NotFoundPage.tsx`

**Actions:**
1. Create `src/components/layout/AppLayout.tsx`:
   - Composes `Sidebar` and `Header` with an `<Outlet />` content area.
   - Layout: Sidebar on left (position depends on state), Header at top of content area, `<Outlet />` below header with appropriate padding.
   - Content area adjusts its left margin based on sidebar state: `ml-60` (full), `ml-16` (compact), `ml-0` (hidden). Use Tailwind classes switched dynamically.
   - Registers global keyboard bindings via `useRegisterBindings`:
     - `l`: cycle sidebar forward
     - `h`: cycle sidebar backward
     - `/`: open command palette
     - `?`: toggle shortcut overlay
     - `Escape`: close any open overlay/drawer, or blur focused input
     - `g` then `g`: scroll to top
     - `g` then `p`: navigate to /projects
     - `g` then `d`: navigate to /dashboard (home)
   - Wraps children in `ThemeProvider` and `KeyboardProvider`.
2. Create `src/router.tsx`:
   - Use `createBrowserRouter` from `react-router` (Data Mode, NOT Framework Mode).
   - Root route uses `AppLayout` as the element.
   - Child routes: `/` -> `DashboardPage`, `/projects` -> `ProjectsPage`, `*` -> `NotFoundPage`.
   - Stub routes for `/graph`, `/notes`, `/settings` that render placeholder pages.
3. Create stub page components:
   - `DashboardPage.tsx`: Heading "Dashboard" with `text-fg`, subtext "Welcome to RAPID Mission Control" in `text-muted`. Styled placeholder cards for future widgets.
   - `ProjectsPage.tsx`: Heading "Projects" with a placeholder message "Project list will load here" in `text-muted`.
   - `NotFoundPage.tsx`: "404 - Page Not Found" with a link back to dashboard.
4. Update `src/App.tsx` (from Wave 1):
   - Replace the placeholder content with `<RouterProvider router={router} />` from `react-router`.
   - Wrap in `ThemeProvider` and `KeyboardProvider`.

**File modified:**
- `web/frontend/src/App.tsx` (replace placeholder with router)

**Verification:**
```bash
cd web/frontend && npx vite build 2>&1 | tail -5
```
Build must succeed.

**What NOT to do:**
- Do NOT use `<BrowserRouter>` component -- use `createBrowserRouter` + `<RouterProvider>` (Data Mode).
- Do NOT import from `react-router-dom` -- in React Router v7, import from `react-router` only.

---

### Task 6: Command palette stub

**Files created:**
- `web/frontend/src/components/ui/CommandPalette.tsx`
- `web/frontend/src/types/command.ts`

**Actions:**
1. Create `src/types/command.ts`:
   - `Command` interface: `{ id: string; label: string; shortcut?: string; category: string; action: () => void }`
   - `CommandRegistry` class or object pattern:
     - `commands: Command[]` array
     - `register(command: Command): void` -- adds to the array
     - `unregister(id: string): void` -- removes by id
     - `search(query: string): Command[]` -- filters by label substring match (case-insensitive)
   - Export a singleton `commandRegistry` instance. This is the extensibility point for downstream sets.
2. Create `src/components/ui/CommandPalette.tsx`:
   - Modal overlay with semi-transparent backdrop (`bg-black/50`).
   - Centered panel: `bg-surface-0 border border-border rounded-lg shadow-lg` with max-width ~500px.
   - Search input at top: text input with `bg-surface-1` styling, autofocused when opened.
   - Results list below: filtered commands matching the search query. Each result shows label, category tag, and shortcut hint.
   - **Keyboard interaction:** Arrow keys navigate results, Enter executes selected command, Escape closes palette.
   - Register default navigation commands on mount: "Go to Dashboard", "Go to Projects", "Go to Graph", "Go to Notes", "Go to Settings" -- each navigates to the respective route using `useNavigate()`.
   - Visibility controlled by a boolean state. The `/` key binding in AppLayout sets this to true. Escape sets it to false.

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

---

### Task 7: Keyboard shortcut tooltip overlay

**Files created:**
- `web/frontend/src/components/ui/TooltipOverlay.tsx`

**Actions:**
1. Create `src/components/ui/TooltipOverlay.tsx`:
   - Full-screen semi-transparent overlay (`bg-black/60`) that appears when `?` is pressed.
   - Centered panel listing all registered keyboard shortcuts grouped by category.
   - Each category is a section heading (e.g., "Navigation", "Global", "Sidebar").
   - Each shortcut shows: key combo (styled as `<kbd>` tags with `bg-surface-2 px-2 py-0.5 rounded text-sm font-mono`), description text.
   - Reads shortcuts from `useGlobalBindings()` context hook.
   - Close on `Escape` key or clicking outside the panel.
   - Fade-in/fade-out transition using CSS transitions or React state.

**Verification:**
```bash
cd web/frontend && npx vite build 2>&1 | tail -5
```
Full build must succeed with all Wave 2 components.

---

## Success Criteria

1. `npm run build` succeeds with all Wave 2 files included.
2. Sidebar renders in 3 states (full/compact/hidden) with `h`/`l` cycling between them.
3. Header shows theme selector dropdown and dark/light toggle that actually switch themes.
4. React Router navigates between Dashboard, Projects, and stub pages.
5. `/` key opens command palette with navigation commands searchable by text.
6. `?` key shows the shortcut overlay listing all registered shortcuts.
7. Keyboard shortcuts are suppressed when focus is in text inputs.
8. Mobile viewport (<768px) shows hamburger menu that opens sidebar as drawer overlay.
9. Sidebar collapse state persists across page refreshes via localStorage.

## File Ownership

| File | Status |
|------|--------|
| `web/frontend/src/types/theme.ts` | create |
| `web/frontend/src/types/keyboard.ts` | create |
| `web/frontend/src/types/layout.ts` | create |
| `web/frontend/src/types/command.ts` | create |
| `web/frontend/src/hooks/useTheme.ts` | create |
| `web/frontend/src/hooks/useKeyboardNav.ts` | create |
| `web/frontend/src/hooks/useLayoutStore.ts` | create |
| `web/frontend/src/context/KeyboardContext.tsx` | create |
| `web/frontend/src/components/layout/Sidebar.tsx` | create |
| `web/frontend/src/components/layout/Header.tsx` | create |
| `web/frontend/src/components/layout/AppLayout.tsx` | create |
| `web/frontend/src/components/ui/CommandPalette.tsx` | create |
| `web/frontend/src/components/ui/TooltipOverlay.tsx` | create |
| `web/frontend/src/router.tsx` | create |
| `web/frontend/src/pages/DashboardPage.tsx` | create |
| `web/frontend/src/pages/ProjectsPage.tsx` | create |
| `web/frontend/src/pages/NotFoundPage.tsx` | create |
| `web/frontend/src/App.tsx` | modify (replace placeholder with router) |
