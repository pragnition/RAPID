# SET-OVERVIEW: frontend-shell

## Approach

This set bootstraps the entire frontend SPA from scratch under `web/frontend/`. The core objective is to establish the foundational React application skeleton that every other frontend set (`read-only-views`, `interactive-features`) will build upon. The work centers on three pillars: project scaffolding with modern tooling (Vite 8, React 19, TypeScript, Tailwind CSS 4.2), a cohesive visual identity using the Everforest color palette with dark/light theming, and a keyboard-first navigation system inspired by vim keybindings.

The implementation strategy is bottom-up: first establish the build toolchain and project configuration, then layer in the theme system via CSS custom properties, then build the layout shell (sidebar, header, content area), and finally wire up the data layer (TanStack Query client, Zustand store, typed API client). This ordering ensures each layer has a stable foundation before dependent code is written.

Since this set has zero imports from other sets, it is fully independent and can execute in parallel with all backend sets. However, it is a critical dependency for both `read-only-views` and `interactive-features`, which import `AppLayout`, `useKeyboardNav`, `useProjectStore`, and `apiClient` from this set. Getting the exported API surface right on the first pass is essential to avoid blocking downstream sets.

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `web/frontend/package.json` | Project dependencies and scripts | New |
| `web/frontend/vite.config.ts` | Vite 8 build configuration with React plugin | New |
| `web/frontend/tailwind.config.ts` | Tailwind CSS 4.2 with Everforest color tokens | New |
| `web/frontend/tsconfig.json` | TypeScript configuration | New |
| `web/frontend/index.html` | SPA entry HTML | New |
| `web/frontend/src/main.tsx` | React root mount, providers wrapping | New |
| `web/frontend/src/App.tsx` | Route definitions, top-level provider composition | New |
| `web/frontend/src/styles/everforest.css` | Everforest palette as CSS custom properties (dark + light) | New |
| `web/frontend/src/styles/global.css` | Base styles, Tailwind directives, resets | New |
| `web/frontend/src/components/layout/AppLayout.tsx` | Root layout: sidebar + header + content slot | New |
| `web/frontend/src/components/layout/Sidebar.tsx` | Navigation sidebar with collapsible behavior | New |
| `web/frontend/src/components/layout/Header.tsx` | Top header bar with theme toggle and project selector | New |
| `web/frontend/src/components/ui/TooltipOverlay.tsx` | Keyboard shortcut help overlay (? key) | New |
| `web/frontend/src/hooks/useKeyboardNav.ts` | Vim-style keyboard navigation hook (hjkl, /, :, g, Esc, Tab) | New |
| `web/frontend/src/hooks/useTheme.ts` | Theme provider and useTheme() hook for dark/light toggle | New |
| `web/frontend/src/stores/projectStore.ts` | Zustand store for active project and project list | New |
| `web/frontend/src/lib/apiClient.ts` | Typed fetch wrapper with base URL and error handling | New |
| `web/frontend/src/lib/queryClient.ts` | Pre-configured TanStack Query client | New |

## Integration Points

- **Exports (consumed by downstream sets):**
  - `AppLayout` -- Root layout component used by `read-only-views` and `interactive-features` to wrap their page views
  - `useKeyboardNav` -- Keyboard binding hook used by `read-only-views` and `interactive-features` for view-specific shortcuts
  - `useProjectStore` -- Zustand store used by `read-only-views` to scope data fetching to the active project
  - `apiClient` -- Typed fetch wrapper used by `read-only-views` and `interactive-features` for all backend calls
  - `ThemeProvider` -- Theme context consumed by all frontend components
  - `queryClient` -- Shared TanStack Query client for data fetching and caching
  - `TooltipOverlay` -- Shortcut help overlay available application-wide

- **Imports:** None. This set is fully self-contained with no dependencies on other sets.

- **Side Effects:**
  - Theme preference persisted to `localStorage` and applied via CSS class on `<html>` element
  - Active project ID persisted in Zustand store (likely `localStorage` backed)
  - API client configured with base URL pointing to backend at `http://127.0.0.1:8998` (from `service-infrastructure`)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Vite 8 and React 19 are bleeding-edge; plugin compatibility may be unstable | Medium | Pin exact versions in package.json; verify React plugin compatibility before committing to version |
| Tailwind CSS 4.2 has a different configuration model than v3 | Medium | Use context7 MCP to verify latest Tailwind 4.x config syntax; test build before moving to layout work |
| Everforest palette must be consumed by downstream sets without raw hex values leaking | High | Enforce CSS custom properties exclusively; add tests that grep for hex values in component files |
| Keyboard navigation conflicts with browser defaults or downstream view-specific bindings | Medium | Design useKeyboardNav with layered binding priority; allow views to override/extend global bindings |
| Exported API surface changes would break read-only-views and interactive-features | High | Finalize export signatures during Wave 1; treat CONTRACT.json signatures as frozen after initial implementation |
| Sidebar collapse behavior at <768px must not break downstream page layouts | Low | Use CSS-only collapse with content area flex-grow; test at boundary widths |

## Wave Breakdown (Preliminary)

- **Wave 1:** Project scaffolding and theme foundation -- Initialize Vite 8 + React 19 + TypeScript project, configure Tailwind CSS 4.2, define Everforest CSS custom properties for dark and light modes, implement ThemeProvider with useTheme hook and localStorage persistence
- **Wave 2:** Layout shell and navigation -- Build AppLayout, Sidebar, and Header components; implement vim-style useKeyboardNav hook; create TooltipOverlay for shortcut discovery; wire up basic route structure
- **Wave 3:** Data layer and API integration -- Set up TanStack Query client with default configuration, create Zustand projectStore, implement typed apiClient wrapper, compose all providers in main.tsx/App.tsx

Note: This is a preliminary breakdown. Detailed wave/job planning happens during /discuss and /plan.
