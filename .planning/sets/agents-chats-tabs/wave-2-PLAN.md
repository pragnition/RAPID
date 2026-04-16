# Wave 2 Plan — Frontend Foundation (stores, hooks, a11y)

**Set:** agents-chats-tabs
**Wave:** 2 of 3
**Focus:** Zustand status store, data-layer hooks, accessibility helpers, Vite SSE proxy config

---

## Objective

Ship the frontend **infrastructure** (state + data hooks + a11y primitives + dev-proxy config) that Wave 3's pages compose. No UI pages land in this wave — only the reusable plumbing.

1. **`statusStore.ts`** — Zustand store for cross-page aggregate status (run counts, chat counts, budget, recent items).
2. **`useAgentEvents` hook** — SSE primary + 2-5s jittered polling fallback + all 10 event kinds + `?since=N` replay. Replaces the narrow `useAgentEventStream` usage in new code while keeping the old hook in place for `PendingPromptController`.
3. **`useChats`, `useChatThread` hooks** — @tanstack/react-query based (useQuery + useMutation) with `queryClient.setQueryData` live-merge from SSE.
4. **`LiveRegion` component + `useFocusTrap` hook** — a11y surface for streaming content announcements and modal focus management.
5. **Vite dev-server SSE proxy headers** — `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `Connection: keep-alive` preserved through proxy.
6. **Hook-level unit tests** for the above.

**Why this wave exists separately from Wave 3:** hooks and stores have no DOM dependencies — they're pure logic and testable with vitest. Separating them lets page-level tests in Wave 3 mock at the hook boundary rather than the network boundary, which is cleaner and faster. Wave 2 also has **no overlap** with Wave 1 (backend) and **disjoint** files from Wave 3 (pages).

File ownership: Wave 2 creates/modifies files in `web/frontend/src/hooks/`, `web/frontend/src/stores/`, `web/frontend/src/components/a11y/`, `web/frontend/src/types/`, and `web/frontend/vite.config.ts`. No pages, no router, no package.json changes — those belong to Wave 3.

---

## Tasks

### T1. Chat + dashboard TypeScript types — `web/frontend/src/types/chats.ts` and `web/frontend/src/types/dashboard.ts` (new)

**Files modified:**
- `web/frontend/src/types/chats.ts` (new)
- `web/frontend/src/types/dashboard.ts` (new)

**Implementation:**

Mirror the Pydantic shapes from Wave 1 exactly (so a tsc build catches drift). Reference `web/backend/app/schemas/chats.py` (Wave 1 T4) and `web/backend/app/schemas/dashboard.py` (Wave 1 T5).

```ts
// chats.ts
export type ChatSessionStatus = "active" | "idle" | "archived";
export type ChatMessageRole = "user" | "assistant" | "tool";

export interface ChatToolCall {
  tool_use_id: string;
  tool_name: string;
  input: Record<string, unknown>;
  output?: unknown;
  is_error?: boolean;
}

export interface Chat {
  id: string;
  project_id: string;
  skill_name: string;
  title: string;
  session_status: ChatSessionStatus;
  created_at: string;  // ISO-8601
  last_message_at: string;
  archived_at: string | null;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  seq: number;
  role: ChatMessageRole;
  content: string;
  tool_calls: ChatToolCall[];
  tool_use_id: string | null;
  agent_run_id: string | null;
  temp_id: string | null;
  created_at: string;
}

export interface ChatListResponse {
  items: Chat[];
  total: number;
}

export interface ChatCreateRequest {
  project_id: string;
  skill_name: string;
  title?: string;
}

export interface ChatMessageCreateRequest {
  content: string;
  temp_id?: string;
}
```

```ts
// dashboard.ts
export interface RecentRun {
  id: string;
  skill_name: string;
  status: string;
  started_at: string;
}

export interface RunsSummary {
  running: number;
  waiting: number;
  failed: number;
  completed: number;
  recent: RecentRun[];
}

export interface RecentThread {
  id: string;
  title: string;
  skill_name: string;
  last_message_at: string;
  session_status: string;
}

export interface ChatsSummary {
  active: number;
  idle: number;
  archived: number;
  recent: RecentThread[];
}

export interface KanbanSummary {
  total: number;
  in_progress: number;
  blocked: number;
}

export interface BudgetRemaining {
  daily_cap: number;
  spent_today: number;
  remaining: number;
}

export interface ActivityItem {
  kind: "run" | "chat";
  id: string;
  title: string;
  status: string;
  ts: string;
}

export interface DashboardResponse {
  runs_summary: RunsSummary;
  chats_summary: ChatsSummary;
  kanban_summary: KanbanSummary;
  budget_remaining: BudgetRemaining;
  recent_activity: ActivityItem[];
}
```

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
```

---

### T2. SSE event types — `web/frontend/src/types/sseEvents.ts` (new)

**Files modified:**
- `web/frontend/src/types/sseEvents.ts` (new)

**Implementation:**

Discriminated union mirroring `web/backend/app/schemas/sse_events.py:22-108`. Must include **all 10** event kinds (per CONTEXT frozen list):

```ts
export type SseEventKind =
  | "assistant_text"
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "ask_user"
  | "permission_req"
  | "status"
  | "run_complete"
  | "replay_truncated"
  | "retention_warning";

export interface BaseSseEvent {
  seq: number;
  ts: string;  // ISO
  run_id: string;
}

export interface AssistantTextEvent extends BaseSseEvent { kind: "assistant_text"; text: string; }
export interface ThinkingEvent extends BaseSseEvent { kind: "thinking"; text: string; }
export interface ToolUseEvent extends BaseSseEvent { kind: "tool_use"; tool_name: string; tool_use_id: string; input: Record<string, unknown>; }
export interface ToolResultEvent extends BaseSseEvent { kind: "tool_result"; tool_use_id: string; output: unknown; is_error: boolean; }
export interface AskUserEvent extends BaseSseEvent { kind: "ask_user"; prompt_id: string; tool_use_id: string; question: string; options: string[] | null; allow_free_text: boolean; }
export interface PermissionReqEvent extends BaseSseEvent { kind: "permission_req"; tool_name: string; tool_use_id: string; reason: string; blocked: boolean; }
export interface StatusEvent extends BaseSseEvent { kind: "status"; status: "pending" | "running" | "waiting" | "interrupted" | "failed" | "completed"; detail: string | null; }
export interface RunCompleteEvent extends BaseSseEvent { kind: "run_complete"; status: "completed" | "failed" | "interrupted"; total_cost_usd: number; turn_count: number; duration_s: number; error_code: string | null; error_detail: Record<string, unknown> | null; }
export interface ReplayTruncatedEvent extends BaseSseEvent { kind: "replay_truncated"; oldest_available_seq: number; requested_since_seq: number; reason: "retention_cap" | "archived"; }
export interface RetentionWarningEvent extends BaseSseEvent { kind: "retention_warning"; event_count: number; cap: number; }

export type SseEvent =
  | AssistantTextEvent
  | ThinkingEvent
  | ToolUseEvent
  | ToolResultEvent
  | AskUserEvent
  | PermissionReqEvent
  | StatusEvent
  | RunCompleteEvent
  | ReplayTruncatedEvent
  | RetentionWarningEvent;
```

**What NOT to do:**
- Do NOT use `kind: string` — use a discriminated union so exhaustive checks work in switch statements.
- Do NOT narrow `output` to `string` in `ToolResultEvent` — backend is `dict | str | None`, so `unknown` is correct.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
```

---

### T3. Zustand status store — `web/frontend/src/stores/statusStore.ts` (new)

**Files modified:**
- `web/frontend/src/stores/statusStore.ts` (new)

**Implementation:**

Follow the existing Zustand pattern from `web/frontend/src/stores/projectStore.ts:1-25`. No middleware (not needed here). The store is a cache of the last dashboard poll — consumers are sidebar badges, stat cards, and the status pill heartbeat.

```ts
import { create } from "zustand";
import type {
  RunsSummary,
  ChatsSummary,
  KanbanSummary,
  BudgetRemaining,
  ActivityItem,
} from "@/types/dashboard";

export interface StatusStore {
  // Aggregate counts
  runs: Omit<RunsSummary, "recent"> | null;
  chats: Omit<ChatsSummary, "recent"> | null;
  kanban: KanbanSummary | null;
  budget: BudgetRemaining | null;

  // Recent items (for activity feed / sparklines)
  recentRuns: RunsSummary["recent"];
  recentThreads: ChatsSummary["recent"];
  recentActivity: ActivityItem[];

  // Metadata
  lastSyncedAt: number | null;  // Date.now() of last successful poll
  lastError: string | null;

  // Actions
  setDashboard: (snapshot: {
    runs: RunsSummary;
    chats: ChatsSummary;
    kanban: KanbanSummary;
    budget: BudgetRemaining;
    recentActivity: ActivityItem[];
  }) => void;
  setLastError: (err: string | null) => void;
  reset: () => void;
}

export const useStatusStore = create<StatusStore>((set) => ({
  runs: null,
  chats: null,
  kanban: null,
  budget: null,
  recentRuns: [],
  recentThreads: [],
  recentActivity: [],
  lastSyncedAt: null,
  lastError: null,

  setDashboard: (snapshot) =>
    set({
      runs: {
        running: snapshot.runs.running,
        waiting: snapshot.runs.waiting,
        failed: snapshot.runs.failed,
        completed: snapshot.runs.completed,
      },
      chats: {
        active: snapshot.chats.active,
        idle: snapshot.chats.idle,
        archived: snapshot.chats.archived,
      },
      kanban: snapshot.kanban,
      budget: snapshot.budget,
      recentRuns: snapshot.runs.recent,
      recentThreads: snapshot.chats.recent,
      recentActivity: snapshot.recentActivity,
      lastSyncedAt: Date.now(),
      lastError: null,
    }),
  setLastError: (err) => set({ lastError: err }),
  reset: () =>
    set({
      runs: null,
      chats: null,
      kanban: null,
      budget: null,
      recentRuns: [],
      recentThreads: [],
      recentActivity: [],
      lastSyncedAt: null,
      lastError: null,
    }),
}));
```

**What NOT to do:**
- Do NOT use React Query as the dashboard cache — the store is fed by a RQ `useQuery` (see T6 below), but consumers read from Zustand so they don't all individually subscribe to RQ with the same key (and RQ's `useQuery` would re-render every subscriber on each poll).
- Do NOT persist to localStorage — status is a session-cache.

---

### T4. `useDashboard` hook + store writer — `web/frontend/src/hooks/useDashboard.ts` (new)

**Files modified:**
- `web/frontend/src/hooks/useDashboard.ts` (new)

**Implementation:**

One thin hook that:
1. Runs a `useQuery({queryKey: ['dashboard', projectId], queryFn, refetchInterval})` with a **5s jittered interval** (per CONTEXT decisions, "5s dashboard tick").
2. On success, writes the snapshot into `useStatusStore.setDashboard`.
3. Exposes the raw RQ result for pages that want direct access to `isLoading` / `error`.

```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiClient, type ApiError } from "@/lib/apiClient";
import { useStatusStore } from "@/stores/statusStore";
import type { DashboardResponse } from "@/types/dashboard";

// 5s base with ±20% jitter => 4-6s window.
function jitteredInterval(): number {
  return 5000 + (Math.random() - 0.5) * 2000;  // ~4000-6000ms
}

export function useDashboard(
  projectId: string | null,
): UseQueryResult<DashboardResponse, ApiError> {
  const setDashboard = useStatusStore((s) => s.setDashboard);
  const setLastError = useStatusStore((s) => s.setLastError);

  const result = useQuery<DashboardResponse, ApiError>({
    queryKey: ["dashboard", projectId],
    queryFn: () =>
      apiClient.get<DashboardResponse>(
        `/dashboard?project_id=${projectId}`,
      ),
    enabled: projectId !== null,
    refetchInterval: jitteredInterval,
    refetchIntervalInBackground: false,  // don't poll when tab is hidden
    staleTime: 2000,  // brief window to coalesce rapid re-renders
  });

  useEffect(() => {
    if (result.data) {
      setDashboard({
        runs: result.data.runs_summary,
        chats: result.data.chats_summary,
        kanban: result.data.kanban_summary,
        budget: result.data.budget_remaining,
        recentActivity: result.data.recent_activity,
      });
    }
  }, [result.data, setDashboard]);

  useEffect(() => {
    if (result.error) {
      setLastError(result.error.detail);
    }
  }, [result.error, setLastError]);

  return result;
}
```

**What NOT to do:**
- Do NOT set `refetchInterval` to a fixed number — the CONTRACT explicitly says "jittered." Pass a function and RQ calls it per-tick (5.91+ supports function form).
- Do NOT update the store directly from `queryFn` — use `useEffect` watching `result.data` (matches React-18+ strict-mode double-effect safely).

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
```

---

### T5. `useAgentEvents` hook — `web/frontend/src/hooks/useAgentEvents.ts` (new)

**Files modified:**
- `web/frontend/src/hooks/useAgentEvents.ts` (new)

**Implementation:**

Exact CONTRACT signature: `useAgentEvents(runId: string): {events, status, reconnect}`.

**Design:**

- **SSE primary** — open `EventSource(/api/agents/runs/${runId}/events?since=${lastSeq})`. Listen for ALL 10 named event kinds (per CRITICAL correction #6).
- **Polling augmentation** — every 2-5s jittered, `GET /api/agents/runs/${runId}` for status/cost/turn-count telemetry. This is the primary status signal (per `polling_primary_sse_augmentation` invariant — SSE is for streaming, polling is for status).
- **Reconnect** — on EventSource `error`, the browser auto-reconnects with `Last-Event-ID`. If the server replies with a `replay_truncated` event, fall back to REST `GET /api/agents/runs/${runId}/events?since=${lastSeq}` (paginated backfill), reconcile, then SSE-resubscribe from the new latest seq.

**REUSE** the EventSource setup pattern from `web/frontend/src/hooks/useAgentEventStream.ts` (don't literally import it — copy the pattern so `useAgentEventStream.ts` can stay untouched and keep serving `PendingPromptController`).

**Shape:**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { SseEvent, SseEventKind } from "@/types/sseEvents";
import type { AgentRun } from "@/types/agents";  // if not present, define inline

const EVENT_KINDS: SseEventKind[] = [
  "assistant_text", "thinking", "tool_use", "tool_result",
  "ask_user", "permission_req", "status", "run_complete",
  "replay_truncated", "retention_warning",
];

function pollInterval(): number {
  // 2-5s jittered.
  return 2000 + Math.random() * 3000;
}

interface UseAgentEventsResult {
  events: SseEvent[];
  status: AgentRun["status"] | null;
  reconnect: () => void;
  error: string | null;
  connected: boolean;
}

export function useAgentEvents(runId: string | null): UseAgentEventsResult {
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [status, setStatus] = useState<AgentRun["status"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const lastSeqRef = useRef(0);
  const [reconnectKey, setReconnectKey] = useState(0);

  const reconnect = useCallback(() => {
    setReconnectKey((k) => k + 1);
    setError(null);
  }, []);

  // -- SSE subscription --
  useEffect(() => {
    if (!runId) return;
    const since = lastSeqRef.current;
    const url = `/api/agents/runs/${runId}/events?since=${since}`;
    const es = new EventSource(url);

    const onOpen = () => { setConnected(true); setError(null); };
    const onError = () => { setConnected(false); setError("SSE disconnected"); };

    const handlers: Array<[string, (e: MessageEvent) => void]> = EVENT_KINDS.map((kind) => {
      const handler = (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data) as SseEvent;
          lastSeqRef.current = Math.max(lastSeqRef.current, payload.seq);
          setEvents((prev) => [...prev, payload]);
          if (payload.kind === "status") {
            setStatus(payload.status);
          } else if (payload.kind === "run_complete") {
            setStatus(payload.status);
          } else if (payload.kind === "replay_truncated") {
            // Fall back to REST backfill before resuming SSE.
            void backfillRest(runId, payload.requested_since_seq, setEvents, (newSeq) => {
              lastSeqRef.current = newSeq;
              setReconnectKey((k) => k + 1);  // re-open SSE from new seq
            });
          }
        } catch (err) {
          console.warn("[useAgentEvents] parse failure", err);
        }
      };
      return [kind, handler];
    });

    es.addEventListener("open", onOpen);
    es.addEventListener("error", onError);
    for (const [kind, handler] of handlers) {
      es.addEventListener(kind, handler as EventListener);
    }

    return () => {
      es.removeEventListener("open", onOpen);
      es.removeEventListener("error", onError);
      for (const [kind, handler] of handlers) {
        es.removeEventListener(kind, handler as EventListener);
      }
      es.close();
    };
  }, [runId, reconnectKey]);

  // -- Polling (status telemetry) --
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const run = await fetch(`/api/agents/runs/${runId}`).then((r) => r.json() as Promise<AgentRun>);
        if (cancelled) return;
        setStatus(run.status);
      } catch { /* swallow */ }
      if (!cancelled) {
        timer = setTimeout(tick, pollInterval());
      }
    };
    timer = setTimeout(tick, pollInterval());

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  return { events, status, reconnect, error, connected };
}

// Helper: REST backfill on replay_truncated.
async function backfillRest(
  runId: string,
  since: number,
  appendEvents: (updater: (prev: SseEvent[]) => SseEvent[]) => void,
  onDone: (newSeq: number) => void,
) {
  // Placeholder: backend endpoint for REST backfill is not yet shipped;
  // when GET /api/agents/runs/{id}/events?format=json&since=N lands,
  // fetch it here, dedupe by seq, append, and update lastSeqRef.
  // For now, onDone with `since` is a no-op.
  onDone(since);
}
```

**Types:** if `AgentRun` is not already typed in `web/frontend/src/types/agents.ts`, create a minimal interface mirroring `AgentRunResponse` from `web/backend/app/schemas/agents.py:25-43`.

**What NOT to do:**
- Do NOT listen to the generic `message` event — all backend events use named `event:` SSE frames (see `agents.py:92-96` where `"event": evt.kind` is set). Named events need explicit `addEventListener(kind, ...)`.
- Do NOT modify `useAgentEventStream.ts` — the old hook keeps serving `PendingPromptController` unchanged.
- Do NOT use `fetch` for SSE — browsers need real EventSource for auto-reconnect + Last-Event-ID.
- Do NOT forget to bump `lastSeqRef` before append — `?since=N` only works if N is monotonic.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
```

---

### T6. `useChats` + `useChatThread` hooks — `web/frontend/src/hooks/useChats.ts` (new)

**Files modified:**
- `web/frontend/src/hooks/useChats.ts` (new)

**Implementation (per CRITICAL correction #2 and instruction #8):**

Use `@tanstack/react-query` (already in `package.json:30`) — useQuery for the list + thread detail, useMutation for create/send, `queryClient.setQueryData` to merge live SSE events into the message cache (matches `PendingPromptController.tsx:34-48` pattern).

**Contract signatures (exact):**
- `useChats() -> {threads, createThread, sendMessage}`
- `useChatThread(id) -> {thread, messages, stream}`

```ts
import { useCallback, useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiClient, type ApiError } from "@/lib/apiClient";
import { useProjectStore } from "@/stores/projectStore";
import type {
  Chat,
  ChatCreateRequest,
  ChatListResponse,
  ChatMessage,
  ChatMessageCreateRequest,
} from "@/types/chats";
import type { SseEvent } from "@/types/sseEvents";

// ---------- useChats ----------

interface UseChatsResult {
  threads: Chat[];
  isLoading: boolean;
  error: ApiError | null;
  createThread: (args: { skillName: string; title?: string }) => Promise<Chat>;
  sendMessage: (args: { chatId: string; content: string; tempId?: string }) => Promise<ChatMessage>;
  refetch: () => void;
}

export function useChats(opts?: { includeArchived?: boolean }): UseChatsResult {
  const projectId = useProjectStore((s) => s.activeProjectId);
  const qc = useQueryClient();
  const includeArchived = opts?.includeArchived ?? false;

  const listQuery = useQuery<ChatListResponse, ApiError>({
    queryKey: ["chats", projectId, includeArchived],
    queryFn: () =>
      apiClient.get<ChatListResponse>(
        `/chats?project_id=${projectId}&include_archived=${includeArchived}`,
      ),
    enabled: projectId !== null,
    staleTime: 30_000,
  });

  const createMutation = useMutation<Chat, ApiError, { skillName: string; title?: string }>({
    mutationFn: ({ skillName, title }) =>
      apiClient.post<Chat>("/chats", {
        project_id: projectId,
        skill_name: skillName,
        title,
      } satisfies ChatCreateRequest),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["chats", projectId] });
      qc.setQueryData<Chat>(["chat", created.id], created);
    },
  });

  const sendMutation = useMutation<
    ChatMessage,
    ApiError,
    { chatId: string; content: string; tempId?: string }
  >({
    mutationFn: ({ chatId, content, tempId }) =>
      apiClient.post<ChatMessage>(`/chats/${chatId}/messages`, {
        content,
        temp_id: tempId,
      } satisfies ChatMessageCreateRequest),
    onMutate: ({ chatId, content, tempId }) => {
      // Optimistic: push user message with matching temp_id into cache.
      const optimistic: ChatMessage = {
        id: `temp-${tempId}`,
        chat_id: chatId,
        seq: -1,
        role: "user",
        content,
        tool_calls: [],
        tool_use_id: null,
        agent_run_id: null,
        temp_id: tempId ?? null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<ChatMessage[]>(
        ["chat-messages", chatId],
        (prev = []) => [...prev, optimistic],
      );
    },
    onSuccess: (real, { chatId }) => {
      // Reconcile: replace the optimistic row matched by temp_id.
      qc.setQueryData<ChatMessage[]>(
        ["chat-messages", chatId],
        (prev = []) =>
          prev.map((m) => (m.temp_id === real.temp_id && m.seq === -1 ? real : m)),
      );
    },
    onError: (_err, { chatId, tempId }) => {
      // Remove the failed optimistic row (or mark as error — Wave 3 decides UI).
      qc.setQueryData<ChatMessage[]>(
        ["chat-messages", chatId],
        (prev = []) => prev.filter((m) => !(m.temp_id === tempId && m.seq === -1)),
      );
    },
  });

  return {
    threads: listQuery.data?.items ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    createThread: async ({ skillName, title }) =>
      createMutation.mutateAsync({ skillName, title }),
    sendMessage: async ({ chatId, content, tempId }) =>
      sendMutation.mutateAsync({ chatId, content, tempId }),
    refetch: () => { void listQuery.refetch(); },
  };
}

// ---------- useChatThread ----------

interface UseChatThreadResult {
  thread: Chat | null;
  messages: ChatMessage[];
  stream: { events: SseEvent[]; connected: boolean; error: string | null };
  isLoading: boolean;
  error: ApiError | null;
}

export function useChatThread(chatId: string | null): UseChatThreadResult {
  const qc = useQueryClient();

  const threadQuery = useQuery<Chat, ApiError>({
    queryKey: ["chat", chatId],
    queryFn: () => apiClient.get<Chat>(`/chats/${chatId}`),
    enabled: chatId !== null,
    staleTime: 5_000,
  });

  const messagesQuery = useQuery<ChatMessage[], ApiError>({
    queryKey: ["chat-messages", chatId],
    queryFn: () => apiClient.get<ChatMessage[]>(`/chats/${chatId}/messages`),
    enabled: chatId !== null,
    staleTime: 5_000,
  });

  // SSE live stream.
  const [streamState, setStreamState] = useState<{ events: SseEvent[]; connected: boolean; error: string | null }>({
    events: [], connected: false, error: null,
  });

  useEffect(() => {
    if (!chatId) return;
    const es = new EventSource(`/api/chats/${chatId}/events`);
    const onOpen = () => setStreamState((s) => ({ ...s, connected: true, error: null }));
    const onError = () => setStreamState((s) => ({ ...s, connected: false, error: "SSE disconnected" }));

    // Listen for all 10 kinds; on assistant_text + tool_use, nudge the messages
    // query to refetch so materialized rows appear as soon as the turn completes.
    const kinds = [
      "assistant_text", "thinking", "tool_use", "tool_result",
      "ask_user", "permission_req", "status", "run_complete",
      "replay_truncated", "retention_warning",
    ];
    const handler = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as SseEvent;
        setStreamState((s) => ({ ...s, events: [...s.events, payload] }));
        // On run_complete, refetch messages so the materialized assistant ChatMessage row appears.
        if (payload.kind === "run_complete") {
          qc.invalidateQueries({ queryKey: ["chat-messages", chatId] });
        }
      } catch { /* ignore */ }
    };
    es.addEventListener("open", onOpen);
    es.addEventListener("error", onError);
    for (const k of kinds) es.addEventListener(k, handler as EventListener);
    return () => {
      es.close();
    };
  }, [chatId, qc]);

  return {
    thread: threadQuery.data ?? null,
    messages: messagesQuery.data ?? [],
    stream: streamState,
    isLoading: threadQuery.isLoading || messagesQuery.isLoading,
    error: threadQuery.error ?? messagesQuery.error,
  };
}
```

(Add `import { useState } from "react";` at top with the other React imports.)

**What NOT to do:**
- Do NOT use `fetch` directly — use `apiClient` (wraps error handling into `ApiError`, matches existing hooks in `useSkills.ts:12`).
- Do NOT duplicate the statusStore — chat state is per-thread and lives in RQ. statusStore is for cross-page aggregates only.
- Do NOT forget `satisfies` on the POST bodies — catches type drift between frontend request types and backend Pydantic shapes.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run src/hooks/__tests__/useChats.test.ts src/hooks/__tests__/useChatThread.test.ts src/hooks/__tests__/useAgentEvents.test.ts
```

---

### T7. `LiveRegion` a11y component — `web/frontend/src/components/a11y/LiveRegion.tsx` (new)

**Files modified:**
- `web/frontend/src/components/a11y/LiveRegion.tsx` (new)
- `web/frontend/src/components/a11y/index.ts` (new — barrel export)

**Implementation:**

Visually hidden aria-live region for announcing streaming content and status changes to screen readers. Supports polite (default) and assertive (for errors). `aria-busy` toggles during token streams.

```tsx
import type { ReactNode } from "react";

export interface LiveRegionProps {
  /** aria-live mode. Default: 'polite'. Use 'assertive' for errors. */
  mode?: "polite" | "assertive";
  /** Mark the region busy during active streaming (suppresses interim reads). */
  busy?: boolean;
  /** The text to announce. Swapping this prop triggers an announcement. */
  children?: ReactNode;
}

/**
 * Visually hidden <div aria-live> for screen-reader announcements.
 * Used for streaming agent text, status pill transitions, and error messages.
 */
export function LiveRegion({ mode = "polite", busy = false, children }: LiveRegionProps) {
  return (
    <div
      aria-live={mode}
      aria-atomic="true"
      aria-busy={busy}
      className="sr-only"
    >
      {children}
    </div>
  );
}
```

```ts
// components/a11y/index.ts
export { LiveRegion, type LiveRegionProps } from "./LiveRegion";
```

**Note on `sr-only`:** Tailwind's default screen-reader-only class works out of the box with Tailwind v4 (verified via `@tailwindcss/vite` in `package.json:42`). No custom CSS needed.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
```

---

### T8. `useFocusTrap` hook — `web/frontend/src/hooks/useFocusTrap.ts` (new)

**Files modified:**
- `web/frontend/src/hooks/useFocusTrap.ts` (new)

**Implementation:**

Per CONTRACT: reused pattern from web-tool-bridge. Traps Tab/Shift+Tab within a container ref, restores focus on cleanup, supports ESC to close via callback.

```ts
import { useEffect, useRef } from "react";

export interface UseFocusTrapOptions {
  enabled?: boolean;
  onEscape?: () => void;
}

/**
 * Trap Tab and Shift+Tab within the returned ref's container. Focus is
 * restored to the previously-focused element on unmount. Pass `onEscape`
 * to handle ESC (e.g., close a modal).
 */
export function useFocusTrap<T extends HTMLElement>(
  opts: UseFocusTrapOptions = {},
): React.RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const { enabled = true, onEscape } = opts;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const previousActive = document.activeElement as HTMLElement | null;

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    function getFocusable(): HTMLElement[] {
      if (!container) return [];
      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    }

    // Focus the first focusable on mount.
    const firstFocusable = getFocusable()[0];
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      previousActive?.focus?.();
    };
  }, [enabled, onEscape]);

  return containerRef;
}
```

**What NOT to do:**
- Do NOT install the listener on `document` — the container-scoped listener avoids fighting with other modal libraries and matches standard accessibility guidance.
- Do NOT hard-focus on every render — only on mount (the effect dep array ensures this).

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run src/hooks/__tests__/useFocusTrap.test.ts
```

---

### T9. Vite SSE proxy headers — `web/frontend/vite.config.ts`

**Files modified:**
- `web/frontend/vite.config.ts` (lines 30-35)

**Implementation:**

Update the `proxy` block to preserve SSE frames through Vite's dev proxy (per CONTEXT specifics line 181). Current config (lines 30-35) has only `target + changeOrigin`; add explicit headers and disable buffering for event-stream responses.

**Reference the existing shape** (lines 12-36 verbatim before changes). After change:

```ts
server: {
  host: "0.0.0.0",
  port: 5173,
  strictPort: true,
  proxy: {
    "/api": {
      target: "http://127.0.0.1:9889",
      changeOrigin: true,
      // Preserve SSE frames (EventSource) through the dev proxy.
      // Without these, Vite's http-proxy middleware buffers the response
      // and EventSource never fires 'message'.
      configure: (proxy) => {
        proxy.on("proxyRes", (proxyRes, req) => {
          // Only mutate SSE responses so REST responses stay cache-normal.
          const isSse =
            req.url?.includes("/events") ||
            (proxyRes.headers["content-type"] ?? "").includes("text/event-stream");
          if (isSse) {
            proxyRes.headers["cache-control"] = "no-cache";
            proxyRes.headers["x-accel-buffering"] = "no";
            proxyRes.headers["connection"] = "keep-alive";
          }
        });
      },
    },
  },
},
```

**What NOT to do:**
- Do NOT set `Cache-Control: no-cache` globally — non-SSE responses benefit from normal caching.
- Do NOT drop `changeOrigin: true` — it's needed for the `127.0.0.1:9889` upstream.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
# Manual smoke test (document in the wave summary, not CI):
# npm run dev  # then curl -N http://localhost:5173/api/agents/runs/{id}/events
# should stream chunks; if it buffers for 30+ seconds, config is wrong.
```

---

### T10. Frontend tests

**Files modified:**
- `web/frontend/src/hooks/__tests__/useDashboard.test.ts` (new)
- `web/frontend/src/hooks/__tests__/useAgentEvents.test.ts` (new)
- `web/frontend/src/hooks/__tests__/useChats.test.ts` (new)
- `web/frontend/src/hooks/__tests__/useChatThread.test.ts` (new)
- `web/frontend/src/hooks/__tests__/useFocusTrap.test.ts` (new)
- `web/frontend/src/stores/__tests__/statusStore.test.ts` (new)
- `web/frontend/src/components/a11y/__tests__/LiveRegion.test.tsx` (new)

#### T10.1 — `statusStore.test.ts`

Pattern: plain Zustand unit tests (no React).

Test cases:
- `test_initial_state_is_nulls_and_empty_arrays`
- `test_setDashboard_populates_counts_and_recents`
- `test_setDashboard_updates_lastSyncedAt`
- `test_setDashboard_clears_lastError`
- `test_reset_returns_to_initial_state`
- `test_setLastError_preserves_existing_data`

#### T10.2 — `useDashboard.test.ts`

Use `@testing-library/react` `renderHook` with `QueryClientProvider`. Mock `apiClient.get` per the pattern in `web/frontend/src/pages/__tests__/AgentsPage.integration.test.tsx:12-33`.

Test cases:
- `test_fetches_dashboard_with_project_id` — query called with correct URL.
- `test_disabled_when_projectId_is_null` — `apiClient.get` NOT called.
- `test_writes_snapshot_to_statusStore_on_success` — after `waitFor(data)`, `useStatusStore.getState().runs` reflects mock.
- `test_writes_error_to_statusStore_on_failure` — mock rejects; `lastError` is set.
- `test_refetch_interval_is_jittered_4_to_6_seconds` — verify with `vi.useFakeTimers` that successive ticks land in `[4000, 6000]`.

#### T10.3 — `useAgentEvents.test.ts`

Pattern: mock `global.EventSource` (jsdom doesn't ship it). Minimal mock:

```ts
class MockEventSource {
  listeners = new Map<string, Set<EventListener>>();
  readyState = 0;
  constructor(public url: string) { /* ... */ }
  addEventListener(k: string, l: EventListener) { /* ... */ }
  removeEventListener(k: string, l: EventListener) { /* ... */ }
  close() {}
  // Test helpers:
  fire(kind: string, data: unknown) { /* dispatches to listeners */ }
}
```

Test cases:
- `test_listens_for_all_10_event_kinds` — verify `addEventListener` called with each kind.
- `test_opens_sse_with_since_0_on_first_mount`
- `test_subsequent_sse_opens_use_lastSeq` — after receiving seq=5, reconnect opens `?since=5`.
- `test_status_event_updates_status_field`
- `test_run_complete_event_updates_status_to_completed`
- `test_replay_truncated_triggers_backfill_and_resubscribe`
- `test_polls_status_via_rest_every_2_to_5_seconds` — `vi.useFakeTimers`, advance timer, assert `fetch('/api/agents/runs/{id}')` called.
- `test_reconnect_fn_reopens_sse_with_current_lastSeq`
- `test_close_on_unmount` — verify `es.close()` called.

#### T10.4 — `useChats.test.ts`

Pattern: `QueryClientProvider` wrapping + mocked `apiClient`.

Test cases:
- `test_list_fetches_from_api_chats_with_project_id`
- `test_list_honors_include_archived_flag`
- `test_disabled_when_no_project`
- `test_createThread_posts_and_invalidates_list`
- `test_createThread_seeds_thread_cache_on_success`
- `test_sendMessage_optimistically_adds_user_row` — cache contains a row with `seq=-1, temp_id=X` before POST resolves.
- `test_sendMessage_replaces_optimistic_row_on_success` — optimistic row swapped for server row by `temp_id`.
- `test_sendMessage_removes_optimistic_row_on_error`
- `test_sendMessage_returns_server_row`

#### T10.5 — `useChatThread.test.ts`

Test cases:
- `test_fetches_thread_detail`
- `test_fetches_messages`
- `test_opens_sse_on_mount_for_chat_id`
- `test_appends_streamed_events_to_stream_events_array`
- `test_invalidates_messages_on_run_complete`
- `test_closes_sse_on_unmount_or_chat_change`

#### T10.6 — `useFocusTrap.test.ts`

Pattern: `render` a container with two buttons, focus the ref, dispatch Tab / Shift+Tab / Escape.

Test cases:
- `test_focuses_first_focusable_on_mount`
- `test_tab_from_last_wraps_to_first`
- `test_shift_tab_from_first_wraps_to_last`
- `test_escape_calls_onEscape_when_provided`
- `test_restores_focus_on_cleanup`
- `test_disabled_when_enabled_false`

#### T10.7 — `LiveRegion.test.tsx`

Test cases:
- `test_renders_aria_live_polite_by_default`
- `test_renders_aria_live_assertive_when_mode_set`
- `test_aria_busy_attribute_reflects_prop`
- `test_sr_only_class_applied`
- `test_renders_children_text`

**Verification (all frontend tests):**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run
```

---

## Success Criteria

### Export coverage

| Export | Task | File |
|--------|------|------|
| `use_agent_events_hook` | T5 | `hooks/useAgentEvents.ts` |
| `use_chats_hook` (useChats + useChatThread) | T6 | `hooks/useChats.ts` |
| `accessibility_hooks` (LiveRegion + useFocusTrap) | T7, T8 | `components/a11y/LiveRegion.tsx`, `hooks/useFocusTrap.ts` |
| `vite_sse_proxy_config` | T9 | `vite.config.ts` |

### Behavioral invariants covered (hook-level)

| Invariant | Enforcement | Task |
|-----------|-------------|------|
| `polling_primary_sse_augmentation` | `useAgentEvents` polls status every 2-5s jittered; SSE delivers streaming | T5, T10.3 |
| `keyboard_accessibility` (focus trap piece) | `useFocusTrap` tests tab cycling + ESC | T8, T10.6 |
| `run_survives_tab_close` (reconnect piece) | `useAgentEvents` reopens SSE with `?since=N` | T5, T10.3 |

### Automated verification

```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit      # types compile
npx vitest run           # all unit tests pass (old + new)
```

### Deliverables checklist

- [ ] `src/types/chats.ts`, `src/types/dashboard.ts`, `src/types/sseEvents.ts`
- [ ] `src/stores/statusStore.ts`
- [ ] `src/hooks/useDashboard.ts`
- [ ] `src/hooks/useAgentEvents.ts`
- [ ] `src/hooks/useChats.ts` (exports `useChats` AND `useChatThread`)
- [ ] `src/components/a11y/LiveRegion.tsx` + `index.ts` barrel
- [ ] `src/hooks/useFocusTrap.ts`
- [ ] `vite.config.ts` SSE proxy headers
- [ ] 7 new test files, all passing
- [ ] Existing tests still pass (AgentsPage / ChatsPage integration tests remain untouched — Wave 3 rewrites them)

---

## Out of Scope for Wave 2

- Pages, router updates, `package.json` changes, `react-markdown` install — all Wave 3.
- Empty-state components — Wave 3.
- Modifying `useAgentEventStream.ts` — keep the old hook for `PendingPromptController` backwards compat.
- AgentsEmptyState / ChatsEmptyState components — Wave 3.
- `types/layout.ts` — already correct per CRITICAL research note (`ga=/agents, gc=/chats` already exists from wireframe-rollout).

---

## Coordination Notes

- **Wave 1 dependency for runtime correctness:** `useChats` / `useChatThread` / `useDashboard` call endpoints that only exist after Wave 1 ships. Types and tests can be developed in parallel; end-to-end smoke relies on Wave 1 being merged first.
- **Deferred dependency:** the REST backfill path in `useAgentEvents` calls `GET /api/agents/runs/{id}/events?format=json&since=N` which does NOT exist as a separate endpoint today. The SSE `replay_truncated` case is rare (>1000 events of gap); if Wave 1 does not ship a REST backfill endpoint, leave the `backfillRest()` helper as a documented stub and log a WARN. **Do NOT add this endpoint in Wave 2.** Raise it as a backlog item via `/rapid:backlog` if it becomes blocking.
