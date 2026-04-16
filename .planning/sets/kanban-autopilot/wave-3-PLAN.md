# PLAN: kanban-autopilot / Wave 3 — Frontend UI Integration

## Objective

Extend the frontend kanban components to surface agent activity: status badges on cards, autopilot toggle on columns, agent metadata display in the card detail modal, and updated TypeScript types. The frontend becomes aware of the agent-managed card lifecycle without introducing new primitives (uses existing StatusBadge and SurfaceCard patterns from the design system).

## Prerequisites

Wave 1 (schema + service) and Wave 2 (tools + worker + router) must be complete. The API now returns `rev`, `agent_status`, `locked_by_run_id`, `completed_by_run_id`, `agent_run_id`, `retry_count`, `created_by` on cards and `is_autopilot` on columns.

## File Ownership

| File | Action |
|------|--------|
| `web/frontend/src/types/api.ts` | Modify — extend kanban interfaces |
| `web/frontend/src/components/kanban/KanbanCard.tsx` | Modify — add agent status badges |
| `web/frontend/src/components/kanban/KanbanColumn.tsx` | Modify — add autopilot toggle |
| `web/frontend/src/components/kanban/CardDetailModal.tsx` | Modify — show agent metadata |
| `web/frontend/src/hooks/useKanban.ts` | Modify — add autopilot toggle mutation, pass rev on move |
| `web/frontend/src/components/kanban/AgentStatusBadge.tsx` | Create — reusable badge component |
| `web/frontend/src/pages/KanbanBoard.tsx` | Modify — wire autopilot toggle + pass rev on move |

## Tasks

### Task 1: Extend TypeScript API types

**File:** `web/frontend/src/types/api.ts`

Update the `KanbanCardResponse` interface (lines 190-198):

```typescript
export interface KanbanCardResponse {
  id: string;
  column_id: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
  // Agent fields (v2)
  rev: number;
  created_by: string;
  agent_status: "idle" | "claimed" | "running" | "blocked" | "completed";
  locked_by_run_id: string | null;
  completed_by_run_id: string | null;
  agent_run_id: string | null;
  retry_count: number;
}
```

Update the `KanbanColumnResponse` interface (lines 200-207):

```typescript
export interface KanbanColumnResponse {
  id: string;
  project_id: string;
  title: string;
  position: number;
  created_at: string;
  is_autopilot: boolean;
  cards: KanbanCardResponse[];
}
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -30
```

### Task 2: Create AgentStatusBadge component

**File:** `web/frontend/src/components/kanban/AgentStatusBadge.tsx`

A small presentational component that maps `agent_status` to visual badges. Uses Tailwind classes consistent with the existing design system (see StatusBadge tones: accent, info, warning, error, highlight, muted).

```tsx
interface AgentStatusBadgeProps {
  agentStatus: KanbanCardResponse["agent_status"];
  createdBy: string;
  lockedByRunId: string | null;
  completedByRunId: string | null;
  retryCount: number;
}
```

Badge rendering logic:

| Condition | Badge text | Style |
|-----------|-----------|-------|
| `agent_status === "claimed"` | "Agent claimed" | `bg-blue-500/10 text-blue-400 border-blue-500/20` (info tone) |
| `agent_status === "running"` | "Agent running" | `bg-blue-500/10 text-blue-400 border-blue-500/20` with pulse animation |
| `agent_status === "blocked"` | "Blocked" | `bg-red-500/10 text-red-400 border-red-500/20` (error tone) |
| `agent_status === "completed"` | "Agent completed" | `bg-emerald-500/10 text-emerald-400 border-emerald-500/20` (accent tone) |
| `createdBy.startsWith("agent:")` | "Agent created" | `bg-violet-500/10 text-violet-400 border-violet-500/20` (highlight tone) |
| `retryCount > 0 && agent_status === "blocked"` | `"Failed x${retryCount}"` | appended to blocked badge |

When `agent_status === "idle"` and `createdBy === "human"`, render nothing (no badge).

Each badge is a small pill: `inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full border`.

For the "running" state, add a small animated dot: `<span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

### Task 3: Update KanbanCard component

**File:** `web/frontend/src/components/kanban/KanbanCard.tsx`

Import and render `AgentStatusBadge` inside the card. Place the badge(s) below the title, above the description.

Changes:
1. Import `AgentStatusBadge`.
2. After the title `<p>` and before the description `<p>`, add:
```tsx
<AgentStatusBadge
  agentStatus={card.agent_status}
  createdBy={card.created_by}
  lockedByRunId={card.locked_by_run_id}
  completedByRunId={card.completed_by_run_id}
  retryCount={card.retry_count}
/>
```

3. When `card.locked_by_run_id` is set (card is claimed by an agent), reduce the drag handle opacity and add a subtle left border accent:
```tsx
const isAgentActive = card.agent_status === "claimed" || card.agent_status === "running";
```
Add to the outer div className: `${isAgentActive ? "border-l-2 border-l-blue-500/50" : ""}`.

4. When `card.agent_status === "completed"`, add a subtle checkmark or completion accent:
   Add to the outer div className: `${card.agent_status === "completed" ? "border-l-2 border-l-emerald-500/50" : ""}`.

Do NOT disable drag-and-drop for agent-active cards (the design decision is soft warning, not hard lock). The human can still move the card.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

### Task 4: Update KanbanColumn component with autopilot toggle

**File:** `web/frontend/src/components/kanban/KanbanColumn.tsx`

Add an autopilot toggle indicator in the column header area, next to the card count.

1. Accept a new prop: `onToggleAutopilot: (columnId: string, enabled: boolean) => void`.
2. In the column header (between the card count `<span>` and the delete button), add a small toggle button:

```tsx
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onToggleAutopilot(column.id, !column.is_autopilot);
  }}
  className={`
    w-5 h-5 flex items-center justify-center
    rounded text-[10px]
    transition-colors duration-100
    ${column.is_autopilot
      ? "text-blue-400 bg-blue-500/10"
      : "text-muted opacity-0 group-hover:opacity-100 hover:text-blue-400"
    }
  `}
  title={column.is_autopilot ? "Autopilot enabled" : "Enable autopilot"}
  aria-label={column.is_autopilot ? "Disable autopilot" : "Enable autopilot"}
>
  {/* Simple robot/auto icon using text character */}
  {column.is_autopilot ? "⚡" : "⚡"}
</button>
```

When autopilot is enabled, the icon is always visible (blue). When disabled, it appears on hover (muted).

Note: This is an emoji exception — the lightning bolt is used as a small icon indicator, consistent with common UI patterns for automation indicators. If the design system has a specific icon set, replace with the appropriate icon class.

3. Update the `KanbanColumnProps` interface to include `onToggleAutopilot`.

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

### Task 5: Update CardDetailModal with agent metadata

**File:** `web/frontend/src/components/kanban/CardDetailModal.tsx`

When the card has agent activity (any agent field is non-default), show an "Agent Activity" section below the description textarea.

1. Update the `card` prop type to use the full `KanbanCardResponse` (it already does).
2. Below the description textarea and above the action buttons, add:

```tsx
{(card.agent_status !== "idle" || card.created_by !== "human") && (
  <div className="mt-4 p-3 bg-surface-1 border border-border rounded text-xs space-y-1.5">
    <p className="font-medium text-fg text-xs uppercase tracking-wide mb-2">Agent Activity</p>
    {card.created_by !== "human" && (
      <p className="text-muted">Created by: <span className="text-fg">{card.created_by}</span></p>
    )}
    {card.agent_status !== "idle" && (
      <p className="text-muted">Status: <span className="text-fg">{card.agent_status}</span></p>
    )}
    {card.agent_run_id && (
      <p className="text-muted">Run: <span className="text-fg font-mono text-[10px]">{card.agent_run_id.slice(0, 8)}</span></p>
    )}
    {card.retry_count > 0 && (
      <p className="text-muted">Retries: <span className="text-fg">{card.retry_count}/3</span></p>
    )}
    <p className="text-muted">Rev: <span className="text-fg">{card.rev}</span></p>
  </div>
)}
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

### Task 6: Update useKanban hooks

**File:** `web/frontend/src/hooks/useKanban.ts`

#### 6a: Add autopilot toggle mutation

```typescript
export function useToggleColumnAutopilot(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    KanbanColumnResponse,
    ApiError,
    { columnId: string; isAutopilot: boolean }
  >({
    mutationFn: ({ columnId, isAutopilot }) =>
      apiClient.put<KanbanColumnResponse>(
        `/projects/${projectId}/kanban/columns/${columnId}/autopilot`,
        { is_autopilot: isAutopilot },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["kanban-board", projectId],
      });
    },
  });
}
```

#### 6b: Pass rev in move card mutation

Update the `useMoveCard` mutation to include `rev` in the body sent to the server. The existing `onMutate` optimistic update logic does not need `rev` — it works on the client-side cache. But the `mutationFn` body should include `rev` from the card being moved:

Update the mutation variables type:
```typescript
{ cardId: string; column_id: string; position: number; rev?: number }
```

And in `mutationFn`:
```typescript
mutationFn: ({ cardId, ...body }) =>
  apiClient.put<KanbanCardResponse>(
    `/projects/${projectId}/kanban/cards/${cardId}/move`,
    body, // now includes rev if provided
  ),
```

The caller (the kanban board page) should pass `rev` from the card data when initiating a move. This is a soft addition — if `rev` is undefined, the backend treats it as no-OCC-check (backward compatible from Wave 1 Task 3d).

#### 6c: Add import for new types if needed

Ensure `KanbanColumnResponse` import includes `is_autopilot` (the type update in Task 1 handles this).

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

### Task 7: Wire autopilot toggle and rev-aware moves in KanbanBoard page

**File:** `web/frontend/src/pages/KanbanBoard.tsx`

This file renders `<KanbanColumn />` at line 266. Make these changes:

#### 7a: Import and use `useToggleColumnAutopilot`

Add to the import from `@/hooks/useKanban`:
```typescript
import { ..., useToggleColumnAutopilot } from "@/hooks/useKanban";
```

In the component body (around line 43), add:
```typescript
const toggleAutopilot = useToggleColumnAutopilot(projectId);
```

Add a handler:
```typescript
const handleToggleAutopilot = useCallback(
  (columnId: string, enabled: boolean) => {
    toggleAutopilot.mutate({ columnId, isAutopilot: enabled });
  },
  [toggleAutopilot],
);
```

#### 7b: Pass `onToggleAutopilot` to `<KanbanColumn />`

At line 266, update the JSX:
```tsx
<KanbanColumn
  key={column.id}
  column={column}
  onEditCard={handleEditCard}
  onDeleteCard={handleDeleteCard}
  onAddCard={handleAddCard}
  onUpdateColumn={handleUpdateColumn}
  onDeleteColumn={handleDeleteColumn}
  onToggleAutopilot={handleToggleAutopilot}
/>
```

#### 7c: Pass rev on move

In `handleDragEnd` (line 131), the `moveCard.mutate` call currently sends `{ cardId, column_id, position }`. Look up the card being moved to get its current `rev`:

```typescript
const movedCard = sourceCol.cards.find((c) => c.id === activeId);
moveCard.mutate({
  cardId: activeId,
  column_id: destColId,
  position: destPosition,
  rev: movedCard?.rev,
});
```

**Verification:**
```bash
cd /home/kek/Projects/RAPID/web/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

## Success Criteria

1. TypeScript compiles without errors (`npx tsc --noEmit` exits 0)
2. Agent status badges render correctly for each state (claimed/running/blocked/completed/agent-created)
3. Agent-active cards have a subtle left border accent
4. Column autopilot toggle button is visible on hover (disabled state) or always visible (enabled state)
5. Card detail modal shows agent metadata when present
6. Move card includes rev in API call when available
7. New `useToggleColumnAutopilot` hook correctly calls the autopilot endpoint
8. No visual regressions on cards with `agent_status === "idle"` and `created_by === "human"` (they render exactly as before)
9. Frontend builds successfully: `cd web/frontend && npm run build`
