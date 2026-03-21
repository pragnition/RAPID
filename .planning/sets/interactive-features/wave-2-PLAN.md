# PLAN: interactive-features / Wave 2 — Kanban Board Frontend

## Objective

Build the complete Kanban Board feature on the frontend: install dnd-kit dependencies, create the KanbanBoard page with drag-and-drop columns and cards, add the `/kanban` route to the router, add the Kanban nav item to the sidebar, and create TanStack Query hooks for kanban data fetching. This wave delivers a fully interactive kanban board with optimistic updates and server reconciliation.

## Prerequisites

- Wave 1 complete: backend API endpoints for kanban CRUD are operational
- `apiClient.put()` available from Wave 1
- TypeScript types (`KanbanBoardResponse`, `KanbanColumnResponse`, `KanbanCardResponse`) available from Wave 1

## File Ownership

| File | Action |
|------|--------|
| `web/frontend/package.json` | Modify: add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| `web/frontend/src/pages/KanbanBoard.tsx` | Create: kanban board page component |
| `web/frontend/src/components/kanban/KanbanColumn.tsx` | Create: column component with card list |
| `web/frontend/src/components/kanban/KanbanCard.tsx` | Create: card component (draggable) |
| `web/frontend/src/components/kanban/AddColumnButton.tsx` | Create: add column button with inline edit |
| `web/frontend/src/components/kanban/CardDetailModal.tsx` | Create: modal for card expand/edit |
| `web/frontend/src/hooks/useKanban.ts` | Create: TanStack Query hooks for kanban API |
| `web/frontend/src/router.tsx` | Modify: add `/kanban` route with lazy import |
| `web/frontend/src/types/layout.ts` | Modify: add Kanban nav item to NAV_ITEMS |

---

## Task 1: Install dnd-kit dependencies

### What
Add `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` to the frontend dependencies.

Run from `web/frontend/`:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

These are the stable v6/v10 packages (not the pre-release `@dnd-kit/react`). They support React 19 via their peer dependency range.

### Where
`web/frontend/package.json` will be modified by npm.

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && node -e "require('@dnd-kit/core'); require('@dnd-kit/sortable'); console.log('dnd-kit OK')"
```

---

## Task 2: Create useKanban hook

### What
Create `web/frontend/src/hooks/useKanban.ts` following the pattern from `useViews.ts` and `useProjects.ts`.

Define these hooks:

**`useKanbanBoard(projectId: string | null)`:**
- `useQuery` with key `["kanban-board", projectId]`
- Fetches `GET /projects/${projectId}/kanban`
- `enabled: projectId !== null`
- `staleTime: 2000`

**`useCreateColumn(projectId: string)`:**
- `useMutation` that POSTs to `/projects/${projectId}/kanban/columns`
- `onSuccess`: invalidate `["kanban-board", projectId]`

**`useUpdateColumn(projectId: string)`:**
- `useMutation` that PUTs to `/projects/${projectId}/kanban/columns/${columnId}`
- Mutation function takes `{ columnId: string, title?: string, position?: number }`
- `onSuccess`: invalidate `["kanban-board", projectId]`

**`useDeleteColumn(projectId: string)`:**
- `useMutation` that DELETEs `/projects/${projectId}/kanban/columns/${columnId}`
- `onSuccess`: invalidate `["kanban-board", projectId]`

**`useCreateCard(projectId: string)`:**
- `useMutation` that POSTs to `/projects/${projectId}/kanban/columns/${columnId}/cards`
- Mutation function takes `{ columnId: string, title: string, description?: string }`
- `onSuccess`: invalidate `["kanban-board", projectId]`

**`useUpdateCard(projectId: string)`:**
- `useMutation` that PUTs to `/projects/${projectId}/kanban/cards/${cardId}`
- `onSuccess`: invalidate `["kanban-board", projectId]`

**`useMoveCard(projectId: string)`:**
- `useMutation` that PUTs to `/projects/${projectId}/kanban/cards/${cardId}/move`
- Mutation function takes `{ cardId: string, column_id: string, position: number }`
- **Optimistic update:** Use `queryClient.setQueryData` in `onMutate` to immediately move the card in the cached board data. Save previous data for rollback.
- **Rollback:** In `onError`, restore the previous cached data.
- **Reconcile:** In `onSettled`, invalidate `["kanban-board", projectId]` to refetch server truth.

**`useDeleteCard(projectId: string)`:**
- `useMutation` that DELETEs `/projects/${projectId}/kanban/cards/${cardId}`
- `onSuccess`: invalidate `["kanban-board", projectId]`

### Where
New file: `web/frontend/src/hooks/useKanban.ts`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 3: Create KanbanCard component

### What
Create `web/frontend/src/components/kanban/KanbanCard.tsx`.

This is a draggable card component using `@dnd-kit/sortable`'s `useSortable` hook.

Props:
- `card: KanbanCardResponse`
- `onEdit: (card: KanbanCardResponse) => void` -- opens the detail modal
- `onDelete: (cardId: string) => void`

Behavior:
- Uses `useSortable({ id: card.id, data: { type: "card", card } })` for drag-and-drop
- Applies `transform` and `transition` styles from useSortable
- Shows card title (bold) and truncated description (2-3 lines with `line-clamp-3`)
- Click opens the card for editing (calls `onEdit`)
- Has a small delete button (x icon) in the top-right corner, visible on hover
- Uses Everforest theme classes: `bg-surface-1`, `border-border`, `text-fg`, `text-muted`, `hover:bg-hover`
- While dragging, reduce opacity to 0.5

### Where
New file: `web/frontend/src/components/kanban/KanbanCard.tsx`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 4: Create KanbanColumn component

### What
Create `web/frontend/src/components/kanban/KanbanColumn.tsx`.

This is a droppable column that contains sortable cards.

Props:
- `column: KanbanColumnResponse`
- `onEditCard: (card: KanbanCardResponse) => void`
- `onDeleteCard: (cardId: string) => void`
- `onAddCard: (columnId: string, title: string) => void`
- `onUpdateColumn: (columnId: string, title: string) => void`
- `onDeleteColumn: (columnId: string) => void`

Behavior:
- Uses `useDroppable({ id: column.id })` from `@dnd-kit/core` OR `SortableContext` from `@dnd-kit/sortable` for the card list area
- Column header: editable title (click to edit inline, enter to save, esc to cancel), delete button (visible on hover)
- Card list area: renders `KanbanCard` components for each card in the column, wrapped in `SortableContext` with `verticalListSortingStrategy`
- Bottom: "Add card" button/input. Click reveals an input field, enter to create, esc to cancel.
- Column has a fixed width (`w-72` or `w-80`), with a max-height and `overflow-y-auto` for the card list
- Theme: `bg-surface-0` column background, `border-border` border, `text-fg` header

Use `@dnd-kit/sortable`'s `SortableContext` with `verticalListSortingStrategy` for the cards within the column. The column items array should be the card IDs.

### Where
New file: `web/frontend/src/components/kanban/KanbanColumn.tsx`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 5: Create AddColumnButton component

### What
Create `web/frontend/src/components/kanban/AddColumnButton.tsx`.

Props:
- `onAdd: (title: string) => void`

Behavior:
- Renders a "+" button with text "Add Column"
- When clicked, transforms into an inline input field
- Enter submits and creates the column, Escape cancels
- Width matches column width (`w-72` or `w-80`)
- Styled as a dashed border placeholder: `border-2 border-dashed border-border`
- Theme: `text-muted`, `hover:text-fg`, `hover:border-accent`

### Where
New file: `web/frontend/src/components/kanban/AddColumnButton.tsx`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 6: Create CardDetailModal component

### What
Create `web/frontend/src/components/kanban/CardDetailModal.tsx`.

Props:
- `card: KanbanCardResponse`
- `onSave: (cardId: string, updates: { title?: string; description?: string }) => void`
- `onClose: () => void`

Behavior:
- Modal overlay with backdrop (`bg-black/50`, click backdrop to close)
- Card title: editable text input at the top
- Card description: multiline textarea for editing
- Save button and Cancel button at bottom
- Close on Escape key
- Theme: `bg-surface-0` modal body, `border-border`, `text-fg`
- Max width `max-w-lg`, centered in viewport

### Where
New file: `web/frontend/src/components/kanban/CardDetailModal.tsx`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 7: Create KanbanBoard page

### What
Create `web/frontend/src/pages/KanbanBoard.tsx`.

This is the main page component that orchestrates the entire kanban board.

Behavior:
1. Get `activeProjectId` from `useProjectStore`
2. If no project selected, show a message: "Select a project to view its kanban board"
3. Use `useKanbanBoard(activeProjectId)` to fetch board data
4. Show loading skeleton while fetching (similar to `ProjectsPage` pattern)
5. Show error state with retry button on fetch error
6. Render the board:
   - Horizontal scrollable container (`flex overflow-x-auto gap-4 p-6`)
   - For each column, render `KanbanColumn`
   - After the last column, render `AddColumnButton`
7. Set up `DndContext` from `@dnd-kit/core` wrapping the board:
   - Use `PointerSensor` and `KeyboardSensor` from `@dnd-kit/core`
   - Use `closestCorners` collision detection (better for multi-container)
   - `onDragStart`: track which card is being dragged (for the drag overlay)
   - `onDragEnd`: determine source and destination column/position, call `useMoveCard` mutation
   - `onDragOver`: handle cross-column moves (update visual state)
8. Render a `DragOverlay` with a clone of the dragged card for smooth animation
9. Wire up all mutation hooks: `useCreateColumn`, `useUpdateColumn`, `useDeleteColumn`, `useCreateCard`, `useUpdateCard`, `useMoveCard`, `useDeleteCard`
10. Manage `CardDetailModal` open/close state for card editing

Page header: "Kanban Board" title with project name subtitle, matching other pages.

### Where
New file: `web/frontend/src/pages/KanbanBoard.tsx`

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Task 8: Add kanban route and nav item

### What

**router.tsx changes:**
1. Add lazy import at top: `const KanbanBoard = React.lazy(() => import("@/pages/KanbanBoard").then(m => ({ default: m.KanbanBoard ?? m.default })));` -- OR use a direct import if code splitting is not critical for the first version. Given the research recommends lazy loading, use `React.lazy`.
2. Actually, the current router uses direct imports (not lazy). To keep consistency, add a direct import: `import { KanbanBoard } from "@/pages/KanbanBoard";`
3. Add route: `{ path: "kanban", element: <KanbanBoard /> }` after the `codebase` route and before `notes`.

**layout.ts changes:**
Add kanban nav item to `NAV_ITEMS` array, after "codebase" and before "notes":
```typescript
{ id: "kanban", label: "Kanban", icon: "\u25A6", path: "/kanban", shortcut: "gb" },
```

Use the Unicode character `\u25A6` (square with orthogonal crosshatch fill) as the icon for the kanban board. The shortcut `gb` follows the `g` prefix convention (g for "go", b for "board").

### Where
- `web/frontend/src/router.tsx` (modify)
- `web/frontend/src/types/layout.ts` (modify)

### Verification
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

---

## Success Criteria

1. `npm install` completes without errors after adding dnd-kit packages
2. `/kanban` route navigates to the KanbanBoard page
3. Kanban nav item appears in sidebar between Codebase and Notes
4. Board loads columns and cards from API when project is selected
5. Cards can be dragged between columns with smooth animation
6. Optimistic updates move cards instantly; server errors trigger full board refetch
7. New columns can be added via the "+" button
8. Cards can be created, edited (via modal), and deleted
9. Column titles can be edited inline
10. TypeScript compiles with zero errors

## What NOT To Do

- Do NOT install CodeMirror packages -- that is Wave 3
- Do NOT modify `NotesPage.tsx` -- that is Wave 3
- Do NOT modify any backend files -- those are all Wave 1
- Do NOT add `@dnd-kit/react` (the pre-release package) -- use stable `@dnd-kit/core` + `@dnd-kit/sortable`
- Do NOT implement column drag reordering in this wave -- focus on card movement first. Column order can be adjusted via the update API but visual column dragging is a stretch goal.
- Do NOT over-engineer the drag overlay -- a simple card clone with slight opacity/shadow is sufficient
