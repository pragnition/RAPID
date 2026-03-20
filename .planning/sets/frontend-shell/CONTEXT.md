# CONTEXT: frontend-shell

**Set:** frontend-shell
**Generated:** 2026-03-21
**Mode:** interactive

<domain>
## Set Boundary
React 19 + Vite 8 + TypeScript SPA skeleton under `web/frontend/`. Establishes the foundational application shell that all downstream frontend sets (`read-only-views`, `interactive-features`) build upon. Scope includes: project scaffolding, multi-theme system with dark/light modes, vim-style keyboard navigation, sidebar layout with 3 collapse states, stub command palette, TanStack Query client, Zustand store scaffolding, typed API client, and keyboard shortcut tooltip overlay. This set has zero imports — fully independent — but is a critical dependency for downstream sets via its exported API surface.
</domain>

<decisions>
## Implementation Decisions

### Sidebar & Layout

- **3 collapse states:** Full (labels + icons) → Compact (icons only) → Hidden. Keyboard shortcut h/l to cycle states. CSS transition between states.
- **Project selector in sidebar top:** Dropdown at the top of the sidebar, above nav links (Linear/Notion pattern). Groups project context with navigation.
- **Overlay drawer on mobile (<768px):** Sidebar slides over content as a drawer with backdrop, triggered by hamburger menu icon. Esc or backdrop click closes it.

### Keyboard Navigation

- **Full global key capture:** hjkl (nav), / (command palette), ? (shortcut overlay), Esc (close/deselect), g (go-to prefix: gg=top, gp=projects), Tab (cycle sidebar → content). Per-view bindings layer on top.
- **Tooltips for discoverability:** Include inline tooltips/hints so users intuitively learn keyboard navigation features without needing the ? overlay.
- **Auto-suppress in text inputs:** Keyboard shortcuts automatically disabled when focus is inside input/textarea/contenteditable. Esc exits input focus back to nav mode. Implementation checks `document.activeElement.tagName`.
- **Stub command palette in this set:** Wire / key to open a basic CommandPalette modal with navigation items (go-to pages). Downstream sets extend with project-specific commands, note search, graph filters, etc.

### Theme & Styling

- **CSS-first with Tailwind 4.2 @theme:** Define all palette tokens as CSS custom properties in theme CSS files. Reference them in Tailwind 4.2's CSS-first `@theme` directive. No JS config file for colors.
- **Multi-theme system with 4 themes:** Everforest (default), Catppuccin, Gruvbox, and Tokyo Night. Each provides dark + light variants. All themes define the same generic CSS custom property interface (prefix `--th-` for theme-generic tokens).
- **Functional semantic tokens:** Map tokens by function, not palette name:
  - `--color-accent` → green equivalent
  - `--color-link` → aqua equivalent
  - `--color-warning` → yellow equivalent
  - `--color-error` → red equivalent
  - `--color-info` → blue equivalent
  - `--color-muted` → grey equivalent
  - `--color-highlight` → purple equivalent
  - `--color-surface-*` → background layer hierarchy
- **Theme selector dropdown in header:** Small dropdown next to the dark/light mode toggle. Theme choice and mode (dark/light) are independent selections.
- **localStorage + data-theme attribute:** Store theme ID and mode in localStorage. Apply via `data-theme` attribute on `<html>`. Inline script in index.html prevents flash of wrong theme on load.

### Data Layer Setup

- **Dashboard-optimized TanStack Query defaults:** 30s stale time, 5min GC time, refetch on window focus, 1 retry with exponential backoff. Suitable for a local dashboard that stays reasonably fresh without hammering the server.
- **Flat Zustand store with selectors:** Single flat store with `activeProjectId`, `projects` list, and setter actions. Consumers use selectors for derived state. Simple and extensible for downstream sets.
- **Typed ApiError throws:** `apiClient` returns typed `Promise<T>`, throws `ApiError` (with status/detail) on failure. TanStack Query's error handling catches these. No result-type wrappers.

### Claude's Discretion

- (None — all areas discussed)
</decisions>

<specifics>
## Specific Ideas
- Keyboard tooltips should appear inline near interactive elements to guide users intuitively
- Theme CSS files should use a generic `--th-` prefix so components never reference theme-specific names
- CommandPalette stub should be designed with an extensible registration pattern for downstream sets to add commands
- Sidebar collapse state should persist in localStorage alongside theme preference
</specifics>

<code_context>
## Existing Code Insights

- **Backend API base:** `http://127.0.0.1:8998`, all endpoints under `/api/` prefix
- **CORS configured:** Backend allows origins `http://127.0.0.1:5173` and `http://localhost:5173` (Vite dev server defaults)
- **Project endpoints:** `GET /api/projects` (paginated list), `GET /api/projects/{id}` (detail), `POST /api/projects` (register), `DELETE /api/projects/{id}` (deregister)
- **Health endpoints:** `GET /api/health` (liveness), `GET /api/ready` (readiness with DB check)
- **Response schemas:** `ProjectSummary` (id, name, path, status, current_milestone, set_count, registered_at, last_seen_at), `ProjectDetail` (full detail with milestones), `ProjectListResponse` (items + pagination)
- **No existing frontend:** `web/frontend/` directory does not exist yet — fully greenfield
- **Backend stack:** Python 3.12+, FastAPI, SQLModel, SQLite with WAL mode
</code_context>

<deferred>
## Deferred Ideas
- System-preference-aware theme detection (prefers-color-scheme media query) — could layer on later
- Custom theme creation/editing UI
- Keyboard shortcut customization/rebinding
</deferred>
