# Wave 3: Data Layer & API Integration

## Objective

Implement the typed API client, TanStack Query configuration with devtools, Zustand project store, and wire the data layer into the existing layout components (sidebar project selector, projects page). By the end of this wave, the frontend can fetch projects from the backend API, display them, switch active projects, and all data flows through properly typed TanStack Query hooks and Zustand stores.

## Prerequisites

Wave 2 must be complete: layout shell renders, sidebar and header work, routing functional.

## Tasks

### Task 1: TypeScript API types

**Files created:**
- `web/frontend/src/types/api.ts`

**Actions:**
1. Create `src/types/api.ts` with TypeScript interfaces mirroring the backend Pydantic schemas exactly:
   ```typescript
   export interface ProjectSummary {
     id: string;           // UUID as string
     name: string;
     path: string;
     status: string;
     current_milestone: string | null;
     set_count: number;
     registered_at: string; // ISO 8601 datetime
     last_seen_at: string | null;
   }

   export interface ProjectDetail extends ProjectSummary {
     milestones: Record<string, unknown>[];
     metadata_json: string;
   }

   export interface ProjectListResponse {
     items: ProjectSummary[];
     total: number;
     page: number;
     per_page: number;
   }

   export interface ProjectStatusResponse {
     id: string;
     status: string;
     message: string | null;
   }

   export interface HealthResponse {
     status: string;
     version: string;
     uptime: number;
   }

   export interface ReadyResponse {
     status: string;
     database: string;
   }

   export interface ApiErrorDetail {
     detail: string;
   }

   export interface PaginationParams {
     page?: number;
     per_page?: number;
   }
   ```

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

---

### Task 2: Typed API client

**Files created:**
- `web/frontend/src/lib/apiClient.ts`

**Actions:**
1. Create `src/lib/apiClient.ts`:
   - Define `ApiError` class extending `Error`:
     ```typescript
     export class ApiError extends Error {
       status: number;
       detail: string;
       constructor(status: number, detail: string) {
         super(detail);
         this.name = 'ApiError';
         this.status = status;
         this.detail = detail;
       }
     }
     ```
   - Define the base URL constant: `const API_BASE = '/api'`. In development, Vite's proxy (configured in Wave 1) forwards `/api` to `http://127.0.0.1:8998`. In production, the same path works if served behind a reverse proxy.
   - Export the main `apiClient` function:
     ```typescript
     export async function apiClient<T>(
       path: string,
       options?: RequestInit,
     ): Promise<T> {
       const url = `${API_BASE}${path}`;
       const response = await fetch(url, {
         headers: {
           'Content-Type': 'application/json',
           ...options?.headers,
         },
         ...options,
       });
       if (!response.ok) {
         let detail = response.statusText;
         try {
           const body = await response.json();
           detail = body.detail || detail;
         } catch {
           // response body not JSON
         }
         throw new ApiError(response.status, detail);
       }
       // Handle 204 No Content
       if (response.status === 204) {
         return undefined as T;
       }
       return response.json() as Promise<T>;
     }
     ```
   - Export convenience methods:
     ```typescript
     apiClient.get = <T>(path: string) => apiClient<T>(path);
     apiClient.post = <T>(path: string, body: unknown) =>
       apiClient<T>(path, { method: 'POST', body: JSON.stringify(body) });
     apiClient.delete = <T>(path: string) =>
       apiClient<T>(path, { method: 'DELETE' });
     ```

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

**What NOT to do:**
- Do NOT hardcode `http://127.0.0.1:8998` -- use relative `/api` path and let Vite proxy handle it.
- Do NOT use axios or any HTTP library -- use native `fetch`.
- Do NOT wrap results in `Result<T, E>` pattern -- throw `ApiError` and let TanStack Query catch it.

---

### Task 3: TanStack Query client and provider

**Files created:**
- `web/frontend/src/lib/queryClient.ts`
- `web/frontend/src/providers/QueryProvider.tsx`

**Actions:**
1. Create `src/lib/queryClient.ts`:
   - Export a `QueryClient` instance with these defaults:
     ```typescript
     import { QueryClient } from '@tanstack/react-query';

     export const queryClient = new QueryClient({
       defaultOptions: {
         queries: {
           staleTime: 30 * 1000,          // 30 seconds
           gcTime: 5 * 60 * 1000,         // 5 minutes (formerly cacheTime)
           refetchOnWindowFocus: true,
           retry: 1,
           retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
         },
         mutations: {
           retry: 0,
         },
       },
     });
     ```
2. Create `src/providers/QueryProvider.tsx`:
   - Wraps children in `<QueryClientProvider client={queryClient}>`.
   - Includes `<ReactQueryDevtools initialIsOpen={false} />` from `@tanstack/react-query-devtools` in development mode only (check `import.meta.env.DEV`).

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

---

### Task 4: Project query hooks

**Files created:**
- `web/frontend/src/hooks/useProjects.ts`

**Actions:**
1. Create `src/hooks/useProjects.ts`:
   - `useProjects(params?: PaginationParams)`: Returns `useQuery` result for `GET /projects?page=X&per_page=Y`. Query key: `['projects', params]`. Returns `ProjectListResponse`.
   - `useProjectDetail(projectId: string | null)`: Returns `useQuery` result for `GET /projects/${projectId}`. Query key: `['project', projectId]`. Enabled only when `projectId` is not null. Returns `ProjectDetail`.
   - `useHealthCheck()`: Returns `useQuery` result for `GET /health`. Query key: `['health']`. Stale time: 10s. Returns `HealthResponse`.
   - All hooks use `apiClient.get<T>()` as the query function.
   - All hooks properly type the `error` as `ApiError` using TanStack Query's generic: `useQuery<T, ApiError>(...)`.

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

---

### Task 5: Zustand project store

**Files created:**
- `web/frontend/src/stores/projectStore.ts`

**Actions:**
1. Create `src/stores/projectStore.ts`:
   - Flat store with `create` from Zustand:
     ```typescript
     interface ProjectStore {
       activeProjectId: string | null;
       setActiveProject: (id: string | null) => void;
     }
     ```
   - Read initial `activeProjectId` from `localStorage.getItem('rapid-active-project')`.
   - `setActiveProject` writes to localStorage and updates state.
   - Export `useProjectStore` as the hook.
   - Document that consumers should use `useShallow` from `zustand/shallow` when selecting multiple values to prevent re-render loops:
     ```typescript
     // Usage example (in a comment):
     // const { activeProjectId, setActiveProject } = useProjectStore(
     //   useShallow((s) => ({ activeProjectId: s.activeProjectId, setActiveProject: s.setActiveProject }))
     // );
     ```

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
```

**What NOT to do:**
- Do NOT store the full projects list in Zustand -- that lives in TanStack Query's cache. Zustand only stores UI state (which project is selected).
- Do NOT use `persist` middleware -- manually handle localStorage for simplicity and control.

---

### Task 6: Wire data layer into App and layout components

**Files modified:**
- `web/frontend/src/App.tsx` (wrap with QueryProvider)
- `web/frontend/src/components/layout/Sidebar.tsx` (wire project selector)
- `web/frontend/src/pages/ProjectsPage.tsx` (display project list)
- `web/frontend/src/pages/DashboardPage.tsx` (show health status)

**Actions:**
1. Update `src/App.tsx`:
   - Wrap the `RouterProvider` in `QueryProvider` (outermost provider).
   - Provider order from outside in: `QueryProvider` > `ThemeProvider` > `KeyboardProvider` > `RouterProvider`.
2. Update `src/components/layout/Sidebar.tsx`:
   - Replace the static "No project selected" text with a `<select>` dropdown.
   - Use `useProjects()` hook to fetch the project list.
   - Use `useProjectStore()` to get/set `activeProjectId`.
   - Dropdown shows project names. Selecting a project calls `setActiveProject(id)`.
   - Show loading state (`text-muted` "Loading...") while projects are fetching.
   - Show error state (`text-error` "Failed to load") if the query fails.
   - If no projects exist, show "No projects registered" in `text-muted`.
3. Update `src/pages/ProjectsPage.tsx`:
   - Replace placeholder with actual project list using `useProjects()`.
   - Render a simple table/list with columns: Name, Path, Status, Milestone, Sets, Registered.
   - Style the table with theme-aware classes: `bg-surface-0` rows, `border-border` dividers, `text-fg` text.
   - Show loading skeleton (pulsing `bg-surface-1` blocks) while fetching.
   - Show error message with `text-error` if fetch fails, with a "Retry" button that calls `refetch()`.
   - Show "No projects registered yet" empty state when items array is empty.
   - Clicking a project row navigates to a future detail view (for now, just sets `activeProjectId`).
4. Update `src/pages/DashboardPage.tsx`:
   - Add a small health indicator using `useHealthCheck()`:
     - Green dot + "Backend connected" when health returns ok.
     - Red dot + "Backend offline" when health query fails.
     - Show backend version and uptime from the health response.
   - Show the active project name (from `useProjectStore` + `useProjects` data) in a welcome card.

**Verification:**
```bash
cd web/frontend && npx vite build 2>&1 | tail -5
```
Build must succeed with all data layer wiring.

---

### Task 7: Export barrel and contract verification

**Files created:**
- `web/frontend/src/index.ts`

**Actions:**
1. Create `src/index.ts` as the public API barrel export matching the CONTRACT.json:
   ```typescript
   // Layout
   export { AppLayout } from './components/layout/AppLayout';

   // Theme
   export { ThemeProvider, useTheme } from './hooks/useTheme';

   // Keyboard
   export { useKeyboardNav } from './hooks/useKeyboardNav';

   // Tooltip
   export { TooltipOverlay } from './components/ui/TooltipOverlay';

   // Data layer
   export { queryClient } from './lib/queryClient';
   export { useProjectStore } from './stores/projectStore';
   export { apiClient, ApiError } from './lib/apiClient';

   // Types (re-export for downstream consumers)
   export type { ThemeId, ThemeMode, ThemeConfig } from './types/theme';
   export type { KeyBinding, KeyCombo } from './types/keyboard';
   export type { SidebarState, NavItem } from './types/layout';
   export type { Command } from './types/command';
   export type {
     ProjectSummary,
     ProjectDetail,
     ProjectListResponse,
     PaginationParams,
   } from './types/api';
   ```
2. Verify every export listed in CONTRACT.json is present:
   - `AppLayout` -- exported
   - `ThemeProvider` with `useTheme()` -- exported
   - `useKeyboardNav` -- exported
   - `queryClient` -- exported
   - `useProjectStore` -- exported
   - `TooltipOverlay` -- exported
   - `apiClient` -- exported

**Verification:**
```bash
cd web/frontend && npx tsc -b --noEmit
cd web/frontend && npx vite build 2>&1 | tail -10
```
Both must succeed. The barrel file must compile without missing imports.

---

## Success Criteria

1. `npm run build` succeeds with the complete frontend application.
2. `apiClient` fetches from `/api` and throws typed `ApiError` on failure.
3. TanStack Query client is configured with 30s stale time, 1 retry, refetch on window focus.
4. Zustand store persists `activeProjectId` to localStorage.
5. Sidebar project selector shows real projects from the API (or graceful error/empty states).
6. Projects page renders a styled list of projects from the backend.
7. Dashboard page shows backend health status.
8. All CONTRACT.json exports are available from `src/index.ts`.
9. No `any` types in the data layer -- all API responses are fully typed.
10. ReactQuery DevTools appear in development mode.

## File Ownership

| File | Status |
|------|--------|
| `web/frontend/src/types/api.ts` | create |
| `web/frontend/src/lib/apiClient.ts` | create |
| `web/frontend/src/lib/queryClient.ts` | create |
| `web/frontend/src/providers/QueryProvider.tsx` | create |
| `web/frontend/src/hooks/useProjects.ts` | create |
| `web/frontend/src/stores/projectStore.ts` | create |
| `web/frontend/src/index.ts` | create |
| `web/frontend/src/App.tsx` | modify (wrap with QueryProvider) |
| `web/frontend/src/components/layout/Sidebar.tsx` | modify (wire project selector) |
| `web/frontend/src/pages/ProjectsPage.tsx` | modify (render project list) |
| `web/frontend/src/pages/DashboardPage.tsx` | modify (health indicator) |
