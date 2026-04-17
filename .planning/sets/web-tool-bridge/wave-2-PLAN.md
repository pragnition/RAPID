# Wave 2 — Frontend (AskUserModal + hooks + route wiring)

## Objective

Add the React UI that consumes the backend bridge shipped in Wave 1: a reusable `<AskUserModal>` with sessionStorage-backed drafts, four hooks (`useAgentEventStream`, `useAnswerPrompt`, `usePendingPrompt`, `useReopenPrompt`), and integration into the relevant page(s) so that an agent run in the dashboard surfaces structured prompts to the user.

## Committed Decisions (carried forward from research)

- **Toast library: `sonner`** — added as a new devDep. Justification: small (<5KB gz), React-19 compatible, accessible out of the box. The alternative (inline tailwind toast + portal + accessible role=status) is three extra files of infra we'd then maintain.
- **Modal shape:** copy the `components/kanban/CardDetailModal.tsx` pattern — fixed overlay + stopPropagation + Escape-to-cancel + Ctrl+Enter-to-submit.
- **Location:** `web/frontend/src/components/prompts/AskUserModal.tsx` (new subdir).
- **Draft persistence:** `window.sessionStorage` directly, keyed by `prompt:<prompt_id>`. No wrapper.
- **SSE client:** native `EventSource` with `Last-Event-ID` reconnect via its native reconnect protocol (the server already supports it). We do NOT reimplement reconnect by hand unless we need `withCredentials` — we don't.
- **409 recovery:** toast ("This prompt was superseded — showing current pending prompt") + auto-swap modal to the current pending prompt from `GET /pending-prompt` + preserve rejected draft as a collapsible "Previous draft" panel. No manual refresh required.

## Files Owned by this Wave (exclusive)

Create:
- `web/frontend/src/components/prompts/AskUserModal.tsx`
- `web/frontend/src/components/prompts/PendingPromptController.tsx` (top-level host — mounts sonner `Toaster` + subscribes to the current run's ask_user events + renders `AskUserModal`)
- `web/frontend/src/hooks/useAgentEventStream.ts`
- `web/frontend/src/hooks/useAnswerPrompt.ts`
- `web/frontend/src/hooks/usePendingPrompt.ts`
- `web/frontend/src/hooks/useReopenPrompt.ts`
- `web/frontend/src/types/agentPrompt.ts` — TS mirror of `PendingPromptResponse` + the SSE `ask_user` event payload.

Edit:
- `web/frontend/package.json` — add `sonner` to `dependencies`.
- `web/frontend/src/App.tsx` — mount `<Toaster />` inside the provider stack (above `RouterProvider`).
- `web/frontend/src/pages/DashboardPage.tsx` — mount `<PendingPromptController runId={activeRunId} />` conditional on there being an active agent run. If DashboardPage does not currently own an "active agent run" notion, add a minimal local state wiring it to query `GET /api/agents/runs?status=running` (the endpoint already exists; look at the `useProjects` hook for the pattern).
- `web/frontend/src/lib/apiClient.ts` — no direct edits; use `apiClient.get/post` as-is. (Bookkeeping: document the ApiError `.status === 409` case in a comment if a new consumer confuses detail-string for structured error. No code change required.)

## Tasks

### Task 1 — TypeScript types + sonner dep

**Files:**
- `web/frontend/src/types/agentPrompt.ts` (new) — export:
  ```
  export type AgentPromptPayload = {
    prompt_id: string;
    run_id: string;
    kind: "ask_user";
    question: string;
    options: string[] | null;
    allow_free_text: boolean;
    created_at: string;
    batch_id: string | null;
    batch_position: number | null;
    batch_total: number | null;
  };
  export type AskUserSseEvent = AgentPromptPayload & { seq: number; ts: string; tool_use_id: string };
  ```
- `web/frontend/package.json` — add `"sonner": "^2.0.0"` (latest stable; confirm with context7 MCP if uncertain about exact pin) to `dependencies`. Run `npm install` inside the worktree.
- `web/frontend/src/App.tsx` — import `{ Toaster }` from `sonner`, render `<Toaster position="top-right" richColors />` inside the provider stack.

**Verification:**
```bash
cd web/frontend && npm install && npx tsc --noEmit
cd web/frontend && grep -q "sonner" package.json
```

### Task 2 — `useAgentEventStream` hook

**File:** `web/frontend/src/hooks/useAgentEventStream.ts`

Native `EventSource`-based hook. Signature:

```
export function useAgentEventStream(runId: string | null, opts?: { onAskUser?: (evt: AskUserSseEvent) => void }): { connected: boolean; lastError: string | null }
```

Behaviour:
- When `runId` is null, no EventSource is opened.
- Opens `new EventSource('/api/agents/runs/' + runId + '/events')`.
- Attaches `addEventListener('ask_user', (e) => onAskUser(JSON.parse(e.data)))`.
- Tracks readyState; exposes `connected`. Auto-reconnects via the EventSource spec; do not implement manual backoff.
- Cleanup on unmount / runId change: `es.close()`.
- Use a ref to pin the latest `onAskUser` callback to avoid re-subscribing on prop identity changes.

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit
```

### Task 3 — `usePendingPrompt`, `useAnswerPrompt`, `useReopenPrompt` hooks

**Files:**
- `web/frontend/src/hooks/usePendingPrompt.ts` — `useQuery({ queryKey: ['pendingPrompt', runId], queryFn: () => apiClient.get<AgentPromptPayload | null>('/agents/runs/'+runId+'/pending-prompt'), enabled: !!runId })`. Handle `204` → `null` (apiClient already normalizes 204 to `undefined`, cast to `null`).
- `web/frontend/src/hooks/useAnswerPrompt.ts` — `useMutation<void, ApiError, { runId: string; promptId: string; answer: string }>({ mutationFn: ({runId, promptId, answer}) => apiClient.post('/agents/runs/'+runId+'/answer', { prompt_id: promptId, tool_use_id: promptId, answer }) })`. On error with `.status === 409`, the caller should refetch pending-prompt.
- `web/frontend/src/hooks/useReopenPrompt.ts` — `useMutation<void, ApiError, { runId: string; promptId: string }>({ mutationFn: ... })`.

All three hooks must invalidate `['pendingPrompt', runId]` via `queryClient.invalidateQueries` on success.

**Do NOT:** add retry logic on mutations; that's the caller's job via `onError`.

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit
```

### Task 4 — `AskUserModal` component

**File:** `web/frontend/src/components/prompts/AskUserModal.tsx`

Props: `{ prompt: AgentPromptPayload, onSubmit: (answer: string) => void, onCancel?: () => void, submitting?: boolean, previousDraft?: string | null }`.

Behaviour:
- Renders fixed-overlay modal (Tailwind `fixed inset-0 z-50 flex items-center justify-center bg-black/50`), content `onClick` uses `stopPropagation`, overlay `onClick` triggers `onCancel?.()`.
- If `prompt.options` is non-null and non-empty: render a radio list + an optional free-text field when `prompt.allow_free_text` is true. Submit value is the selected option, or the free-text content if "Other" is chosen.
- If `prompt.options` is null: single `<textarea>` for free-text answer.
- Display batch indicator when `prompt.batch_total > 1`: "Question {batch_position+1} of {batch_total}".
- Persist the in-progress answer to sessionStorage key `prompt:<prompt.prompt_id>` on every change (use `useEffect` + debounced write OR write on every `onChange` — latter is simpler and fine at this scale). On mount, hydrate from sessionStorage if present.
- Keyboard: `Escape` → `onCancel` (if provided). `Ctrl+Enter` (or `Cmd+Enter` on mac) → submit.
- On successful submit: clear sessionStorage for this prompt_id.
- If `previousDraft` is non-null, render a collapsible "Previous draft (not saved)" panel below the main form with a "Copy into answer" button.

**Do NOT:** include approve/reject/edit triad UI — that's deferred (DEFERRED.md items 1-2).

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit
```

### Task 5 — `PendingPromptController`

**File:** `web/frontend/src/components/prompts/PendingPromptController.tsx`

Host component that ties the hooks together. Props: `{ runId: string | null }`.

Flow:
1. `usePendingPrompt(runId)` as source of truth.
2. `useAgentEventStream(runId, { onAskUser: (evt) => queryClient.setQueryData(['pendingPrompt', runId], evt) })` — immediate optimistic update on SSE event; the subsequent `invalidateQueries` keeps it honest.
3. `useAnswerPrompt()` — on success: nothing extra (invalidate handles it). On error with `.status === 409`: `toast.warning("This prompt was superseded — showing current pending prompt")`, stash the rejected draft in state, refetch pending-prompt, pass stashed draft as `previousDraft` to the modal.
4. Render `<AskUserModal prompt={pendingPrompt} onSubmit={...} previousDraft={previousDraft} />` when `pendingPrompt` is non-null.

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit
```

### Task 6 — Dashboard wiring

**File:** `web/frontend/src/pages/DashboardPage.tsx`

Identify (or introduce) the "current active agent run" accessor. Options:
- If the page already surfaces agent runs: pick the current `run.id` where `status === 'running' || status === 'waiting'`.
- If not: introduce a minimal `useActiveAgentRun()` hook that calls `GET /api/agents/runs?status=running` (you may need to introduce this router endpoint if it doesn't exist; if so, STOP and flag — Wave 1 would need to add it). Per research findings 3, the existing router at `routers/agents.py` does NOT have a list endpoint — **do NOT invent one here**. Instead, surface activeRunId from whatever state already exists on the page (likely via `useProjects` or a similar existing hook that carries recent run metadata), or accept `null` and have the modal simply never appear until the user is looking at a specific run's detail view.

Simplest correct integration for this set's scope: mount `<PendingPromptController runId={null} />` unconditionally, and in a follow-up set add the active-run plumbing. **Plan-set commits to the null-mounted pattern for now;** the modal infrastructure is landed and the wiring turns on when a later set adds `activeRunId`. This keeps the set tightly scoped and unblockable.

Add 1-2 sentences of comment explaining the deliberate `runId={null}` placeholder.

**Verification:**
```bash
cd web/frontend && npx tsc --noEmit && npm run build
```

## Success Criteria

- `npm run build` succeeds with no TS errors.
- `sonner` appears in `package.json` dependencies and `<Toaster />` is mounted in `App.tsx`.
- `<AskUserModal>` renders in Storybook/manual-mount with realistic prompt props (multi-choice, free-form, N-question variants).
- `useAgentEventStream` opens an EventSource to `/api/agents/runs/:id/events` and dispatches `onAskUser` on matching events. (Verify via Chrome DevTools when manually testing against a running backend.)
- Draft persists across page reload for the same `prompt_id`.
- On 409 from `/answer`, a sonner toast fires, the modal swaps to the current pending prompt, and the rejected draft appears as "Previous draft".

## Out of Scope (do NOT touch in this wave)

- Backend anything (Wave 1 owns that).
- SKILL.md patches (Wave 3).
- New vitest/RTL tests (deferred per research finding 6 — simplicity ethos).
- Approval/permission modals (deferred).
- An active-run plumbing beyond mounting the controller with `runId={null}` as documented.
