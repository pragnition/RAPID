# CONTEXT: agents-chats-tabs

**Set:** agents-chats-tabs
**Generated:** 2026-04-16
**Mode:** interactive

<domain>
## Set Boundary

This set replaces the wireframe-rollout Wave 2 placeholder routes (`/agents`, `/chats`) with fully functional list + detail pages for both autonomous agent runs and interactive chat threads. It also ships the backend chat persistence layer (Chat / ChatMessage / ChatAttachment models, chat_service.py, /api/chats endpoints), a consolidated `GET /api/dashboard` endpoint to replace multiple independent polls, and the useAgentEvents / useChats hooks that drive SSE+polling on the frontend.

**In scope:**
- 4 frontend pages: AgentsPage (list), AgentRunPage (detail), ChatsPage (list), ChatThreadPage (detail)
- Hooks: useAgentEvents (SSE primary + polling fallback), useChats, useChatThread
- Backend: chat persistence schema + Alembic migration, chat_service.py, /api/chats REST endpoints
- Consolidated `/api/dashboard` endpoint (counts + recent items, replaces 4-5 independent polls)
- Vite SSE proxy config (no-buffering headers)
- Empty-state onboarding (AgentsEmptyState, ChatsEmptyState)
- accessibility_hooks (LiveRegion, useFocusTrap)
- Sidebar nav extension (ga=/agents, gc=/chats) with reconciled shortcuts

**Out of scope (explicitly deferred — see DEFERRED.md):**
- Real ChatAttachment implementation (stub table only)
- Cross-app notification for queued structured question prompts
- In-app "Getting Started" docs destination
- Advanced keyboard shortcuts beyond Shift+P/Shift+S
- Thread archive bulk operations
</domain>

<decisions>
## Implementation Decisions

### Chat-to-Agent Session Binding

- **Session lifecycle:** Hybrid with 1-hour idle timeout. A chat thread creates one persistent AgentSession that stays alive in memory for 1h after the last user activity. After timeout, the session is garbage-collected. The next user message transparently starts a fresh run with the full conversation history from ChatMessage rows injected as context.
- **Rationale:** Matches the contract's "long-lived AgentSession" language while being pragmatic about memory. 1 hour covers natural conversation pauses (coffee, calls) without keeping sessions alive indefinitely. The transparent re-creation on expired sessions means users never see a "session expired" error — they just keep talking.

### Session Recovery After Restart

- **Decision:** Lazy recovery. Sessions are NOT proactively rebuilt on server startup. The next user message to any thread transparently creates a fresh session with history injection (same mechanism as idle-timeout recovery).
- **Rationale:** Avoids startup storms (imagine 20 active chats all trying to spin up sessions at once). Startup becomes fast and deterministic. Users experience seamless recovery because the same history-injection path handles both idle-timeout and restart cases.

### Real-time Data Flow Coordination

- **Decision:** Per-page hooks with a thin shared Zustand status store for cross-page propagation. Each page owns its polling/SSE logic (useAgentEvents for run detail, useChatThread for chat detail, direct fetches for list pages). A small Zustand `statusStore` holds aggregate counts and per-run/thread status, populated by the dashboard poll.
- **Rationale:** Per-page hooks keep each page's data flow simple and the contract's hook signatures intact. The shared Zustand status store (updated via the 5s dashboard poll) satisfies the cross-page update requirement without a global EventBus. No React Query dependency added.

### Cross-Page Update Propagation

- **Decision:** Immediate cross-page via the dashboard poll. When a run transitions state (or a new thread is created), the next 5s dashboard tick propagates the update to the Zustand status store, which is subscribed to by the sidebar badges, page-level stat cards, and any list pages currently mounted.
- **Rationale:** "Immediate" means "automatic without user action" — updates arrive within 5s without requiring navigation. This avoids the complexity of a global SSE subscription while still feeling live. The 5s cadence is acceptable because the primary surfaces for real-time (active run detail, active chat) already have their own SSE streams.

### Chat State Management

- **Store technology:** Small Zustand `statusStore` for cross-page shared status (run counts, thread counts, per-run status, per-thread session status). Page-level state (thread messages, active streaming state, composer draft) lives in local component state or page-scoped hooks using direct fetch calls.
- **Rationale:** Matches the existing pattern in this codebase (projectStore is Zustand for cross-page state; API data is direct fetches). Avoids adding React Query as a new dependency. Clean separation: shared → Zustand, local → hooks/state.

### Optimistic Message Rendering

- **Decision:** Optimistic. When the user sends a message, it appears instantly in the message list with a subtle "sending" indicator (dimmed opacity + timestamp placeholder). On POST response, the optimistic entry is replaced with the server version (matched by a client-generated temp ID).
- **Rationale:** Standard chat UX — users expect instant feedback. The agent response stream arrives ~200ms+ after POST, so showing the user's message instantly removes perceived latency. If POST fails, the optimistic message shows an error state with a retry button.

### Consolidated Dashboard Endpoint Shape

- **Response:** `GET /api/dashboard?project_id=X` returns counts + 5 most recent items.
  - `runs_summary`: `{running, waiting, failed, completed, recent: [{id, skill_name, status, started_at}]}` (5 items)
  - `chats_summary`: `{active, idle, archived, recent: [{id, title, skill_name, last_message_at, session_status}]}` (5 items)
  - `kanban_summary`: `{total, in_progress, blocked}` (counts only for now — full kanban data stays on kanban routes)
  - `budget_remaining`: `{daily_cap, spent_today, remaining}`
  - `recent_activity`: combined timeline of last 10 status transitions across runs + chats
- **Rationale:** Counts + recent items covers both the sidebar badge needs and the stat card + "recent activity" sections without duplicating full list endpoints. Target response time <100ms; implementation uses SQL aggregate queries + a single top-N sorted query per table.

### Dashboard Endpoint Consumers

- **Decision:** Dashboard endpoint serves: (1) sidebar badge counts, (2) page-level StatCard grids on AgentsPage and ChatsPage, (3) the Zustand statusStore (cross-page propagation). DataTable rows on list pages come from dedicated list endpoints (`GET /api/agents/runs` and `GET /api/chats`) that support pagination and filtering.
- **Rationale:** Matches the contract's "replaces 4-5 independent polls" goal without conflating concerns. The dashboard is the heartbeat for aggregate/recent data; list endpoints serve the long tail. List endpoints can cache-invalidate when the dashboard detects new items.

### Chat Message Persistence — Tool Call Storage

- **Decision:** Single ChatMessage row per assistant turn, with `tool_calls` stored as a JSON array field. Mirrors the Claude API message format: one assistant turn = one row containing text + tool_use blocks. User messages are separate rows with role='user'. Tool results are separate rows with role='tool' (referencing the `tool_use_id` from the assistant turn).
- **Rationale:** Mirrors the Claude API message structure exactly, making replay trivial (just feed rows back to the SDK in order). Simpler than splitting every content block into a row. JSON queryability is acceptable since we rarely query individual tool calls — we display full conversations.

### Streaming Token Persistence

- **Decision:** Event log + materialized message. Streaming events (assistant_text deltas, thinking, tool_use, tool_result) are written to the existing `agent_event` table as they arrive (append-only, with seq numbers). When the turn completes, a single ChatMessage row is materialized from the accumulated events.
- **Rationale:** The agent_event table already exists from agent-runtime-foundation — we reuse it for streaming audit trail. Crash-resilient: if the server dies mid-stream, the events are durable. On restart, incomplete turns can be detected (events without a terminal ChatMessage) and either materialized or discarded. Single ChatMessage per turn keeps the display model clean.

### SSE Reconnection Strategy

- **Decision:** Hybrid with gap detection. On reconnect, the client sends `?since=N` (or `Last-Event-ID` header). Server checks its in-memory buffer: if events from N onwards are available, it replays them via SSE and resumes live streaming. If the buffer has been truncated past N, the server sends a single `replay_truncated` event; the client then falls back to REST backfill (`GET /api/agents/runs/{id}/events?since=N`), reconciles state, and resumes SSE from the new latest seq.
- **Rationale:** Fast reconnect for the common case (brief network hiccup, buffer intact) while gracefully handling longer disconnects (long meetings, laptop sleep). The `replay_truncated` sentinel lets the client know to take the slower but reliable REST path without ambiguity.

### SSE Event Retention Window

- **Decision:** Count-based — retain the last 1000 events per run in the in-memory buffer. Older events remain queryable via SQLite (`agent_event` table).
- **Rationale:** Bounded memory (~1MB per run for 1000 events at ~1KB each). 1000 events covers typical reconnects (a chatty run generates ~100 events/min, so ~10 minutes of buffer). Rare long-gap reconnects fall through to REST backfill without issue.

### ChatAttachment Stub Schema

- **Fields:** `id` (PK), `chat_id` (FK → chats, nullable), `message_id` (FK → chat_messages, nullable), `kind` (nullable string, backed by Python enum), `payload` (nullable JSON).
- **Rationale:** Matches the contract signature exactly. All fields except PK are nullable so v7.1 can add NOT NULL constraints (or more columns) without a table-altering migration. `kind` is a Python-level enum (`AttachmentKind.FILE`, `AttachmentKind.IMAGE`, `AttachmentKind.CODE`) stored as a string in SQLite — gives code-level type safety now, zero DB migration burden. The stub is not used by any UI or service in this set; it exists purely to reserve the table.

### Chat Thread Lifecycle States

- **States:** `active` (session alive, currently streaming or waiting), `idle` (session expired via 1h timeout, resumable on next message), `archived` (user-hidden soft-delete). No terminal "completed" state — threads are always resumable.
- **Archive UX:** Thread list has a "Show archived" filter toggle. Archive action is a button on the thread detail page header. Archiving does NOT kill the underlying session (if alive); it just hides the thread from the default list view.
- **Rationale:** Clean lifecycle that matches chat-app mental models (threads are permanent but can be hidden). "Idle" state is honest about the session being gone without implying the thread is over. Archive is a soft-delete (not hard-delete) because persisted messages are historically valuable.

### Navigation-Away Behavior

- **Decision:** Session survives. Navigating away from the chat thread page (or closing the tab) does NOT interrupt the underlying session. If the agent needs input while the user is away, the structured question queues server-side (stored in `agent_prompts` table from web-tool-bridge). When the user returns to the thread, the pending prompt renders inline in the message list.
- **Rationale:** Directly matches the contract's `run_survives_tab_close` behavioral requirement extended to chats. Consistent with the autonomous run behavior — no UX surprise when switching between agents and chats. The existing agent_prompts table supports queued prompts naturally.

### Agents vs Chats Visual Distinction

- **Decision:** Chrome-level distinction — the pages look visibly different. AgentsPage/AgentRunPage: PageHeader + StatCard grid + DataTable (list) or PageHeader + telemetry SurfaceCard + stacked ToolCallCard feed (detail). NO composer on the run detail — its absence IS the primary signal. ChatsPage/ChatThreadPage: PageHeader + DataTable (list) or PageHeader + scrollable message list + persistent bottom Composer (detail). No extra banners, badges, or accent colors needed beyond the natural layout difference.
- **Rationale:** Matches the contract's `no_composer_on_run_detail` invariant ("users know from chrome alone whether they're in chat or autonomous mode"). The composer presence/absence is load-bearing — adding explicit labels or color themes would be redundant and visually noisy.

### Cross-Navigation Between Agents and Chats

- **Decision:** One-way chat→run links. When a ChatMessage has a non-null `agent_run_id` FK (i.e., the message triggered an autonomous run), the message renders with an inline link to `/agents/:runId`. Autonomous runs on AgentRunPage do NOT link back to chats — they're presented as standalone.
- **Rationale:** Chats naturally reference runs (the FK exists for this purpose). Autonomous runs are designed to be standalone; adding a "from chat X" breadcrumb would imply chat-dependency that doesn't match their semantics. One-way linking matches the data flow (chats can spawn runs; runs don't own chats).

### Run Detail Activity Feed Layout

- **Decision:** Flat chronological feed of stacked ToolCallCard and text blocks. Newest entries at the bottom. Events are rendered in the order they arrive via SSE: tool_use → tool_result → assistant_text → thinking → tool_use → ... interleaved naturally. Auto-scroll to bottom by default, with AutoScrollPill opt-out when the user scrolls up.
- **Rationale:** Matches the contract's "live activity feed as stacked ToolCallCard instances." Feels like a terminal log — the mental model most developers already have for watching a process. Grouping by turn adds UI complexity without a clear win (turns can be very long or very short). Two-panel layouts don't work well on narrow screens and require extra click-to-inspect.

### ToolCallCard Default Detail Level

- **Decision:** Collapsed by default. Each card shows: status icon (spinner for in-progress, checkmark for success, X for error), tool name (mono), duration (mono). A chevron toggles expansion to reveal full args + result.
- **Rationale:** Matches the contract's "expandable args+result" language. A long run can generate dozens of tool calls — collapsed cards keep the feed scannable. Users can expand the specific cards they care about. Expanded-by-default would turn the feed into a wall of text.

### Chat Composer — Structured Question Integration

- **Decision:** Inline form above composer. When the agent sends an AskUserQuestion or can_use_tool prompt, it renders as an inline StructuredQuestion component in the message list (below the triggering agent message, above the composer). The composer itself is visually dimmed and disabled — the user cannot send a free-text message until the structured question is answered or explicitly skipped. After answering, the composer returns to normal state.
- **Rationale:** Matches the contract's "inline StructuredQuestion for can_use_tool prompts" requirement. Keeps the conversation context visible (unlike a modal that covers the message history). Disabling the composer prevents accidental free-text sends that would bypass the expected structured response.

### Slash Autocomplete Behavior

- **Decision:** Popup above composer. Typing `/` at the start of an empty composer (or after whitespace) triggers a compact dropdown above the composer showing matching skills from `GET /api/skills`. Arrow keys (↑↓) navigate, Enter selects. Continuing to type filters the list (fuzzy match). Selecting a skill inserts `/rapid:<name>` into the composer. If the skill takes args, Enter opens the SkillLauncher modal pre-populated with that skill; if it doesn't, Enter sends immediately.
- **Rationale:** Matches the contract's "SlashAutocomplete above composer when user types /" specification. Popup pattern is familiar (Slack, Discord). Avoids the heavier command-palette UX which doesn't fit a chat context. Integrates with SkillLauncher for args-required skills without leaving the chat page.

### Empty State — Content Approach

- **Decision:** Hybrid. Each empty state shows: (1) a brief 1-sentence tab purpose ("Agents run autonomously in the background" / "Chat interactively with agents that need your input"), (2) a 1-sentence chat-vs-run distinction ("Agents stream activity; chats wait for your replies"), and (3) 3 clickable example action cards.
  - AgentsEmptyState actions: `/rapid:status`, `/rapid:plan-set`, `/rapid:execute-set`
  - ChatsEmptyState actions: `/rapid:discuss-set`, `/rapid:quick`, `/rapid:bug-fix`
  - Clicking an action card opens the SkillLauncher modal for that skill (or, for Chats, creates a new thread and routes there).
- **Rationale:** Matches the contract's "3-action lists" + "explains chat-vs-run distinction" requirements. Education AND action — new users get the conceptual distinction AND a low-friction path to their first run/thread.

### Empty State Persistence

- **Decision:** Zero-state only. Once the user creates their first run or thread, the empty state component is no longer rendered on that tab. There is no persistent "Getting Started" section.
- **Rationale:** Once there is content, the content is the UI. Persistent help pollutes the workspace. Help content lives in docs (see DEFERRED.md item 3 — a future docs target is needed). The empty state reappears if the user ever reaches zero items again (e.g., archives all threads).

### Claude's Discretion

- Specific color tokens for status indicators (use existing primitives from wireframe-rollout — StatusBadge, StatusDot)
- DataTable column widths, sort defaults, empty-row message copy
- Exact timing for optimistic message "sending" indicator fade-in
- Exact 1h timeout implementation (timer reset on each user/agent message vs. timer from session start)
- Dashboard endpoint response caching strategy (e.g., short-lived 1s cache)
- Alembic migration file naming and ordering (follow `0006_chat_persistence.py` pattern)
- Exact import paths and module structure within `app/services/chat_service.py`
- React component file naming within `web/frontend/src/pages/` (follow existing conventions)
- Vite proxy header names beyond the contract's "Cache-Control" and "X-Accel-Buffering" requirements
- Error message copy and tone for user-facing error states
- Keyboard navigation details beyond the contract-required Shift+P / Shift+S
</decisions>

<specifics>
## Specific Ideas

- **Zustand statusStore shape** (from the cross-page decision): `{runs: {running, waiting, failed, completed}, chats: {active, idle}, recentRuns: [], recentThreads: [], budgetRemaining, lastSyncedAt}`. Subscribed to by sidebar badges, AgentsPage stat cards, ChatsPage stat cards. Updated by the dashboard poll tick.
- **Temp ID for optimistic messages**: client-generated UUID stored as `temp_id` on the optimistic ChatMessage; server's POST response returns the real row ID; reconciliation happens by matching `temp_id`.
- **1h idle timeout trigger**: reset on each user message AND each streamed agent turn completion. "Idle" = no activity for 60 minutes.
- **Archive soft-delete**: `Chat.archived_at` timestamp column; NULL = active/idle, non-NULL = archived. List queries filter by default `WHERE archived_at IS NULL`.
- **AgentsEmptyState and ChatsEmptyState** compose the wireframe-rollout `EmptyState` primitive with 3 custom action cards each. Contract says "composes wireframe-rollout Wave 1's EmptyState primitive with 3 example actions each."
- **Consolidated dashboard endpoint caching**: 1-second in-memory cache keyed by project_id to smooth over thundering-herd from multiple tabs hitting it simultaneously.
- **Vite SSE headers to add**: `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `Content-Type: text/event-stream` preservation. Prevents dev proxy from buffering SSE frames.
</specifics>

<code_context>
## Existing Code Insights

### What already exists (inherited from prior sets)

- **Routes `/agents` and `/chats` already exist** as placeholders from wireframe-rollout Wave 2. The router imports `AgentsPage` and `ChatsPage`. This set REPLACES those placeholders with real content and adds `/agents/:runId` and `/chats/:threadId` child routes.
- **Sidebar nav** (`web/frontend/src/types/layout.ts`): NAV_GROUPS already has "Execution" group with Agents (ga) and Chats (gc) entries. Shortcuts match the contract's `ga`/`gc` requirement. No nav structure changes needed.
- **All wireframe primitives exist** in `web/frontend/src/components/primitives/` with index.ts exports: PageHeader, EmptyState, StatCard, DataTable, StatusBadge, StatusDot, HealthDot, SurfaceCard, ToolCallCard, StructuredQuestion, ErrorCard, Composer, SlashAutocomplete, AutoScrollPill, StreamingCursor, Kbd, SearchInput. This set does NOT ship new primitives (per `adopts_wireframe_primitives` behavioral requirement).
- **Primitive hooks**: `usePrefersReducedMotion` and `useAutoScrollWithOptOut` are already in `web/frontend/src/components/primitives/hooks/` (absorbed during wireframe-rollout Wave 1). This set's accessibility_hooks surface is narrowed to `LiveRegion` (aria-live component) and `useFocusTrap` hook.
- **Agent models already exist**: `AgentRun`, `AgentEvent`, `AgentPrompt` SQLModel classes in `web/backend/app/models/`. This set adds `Chat`, `ChatMessage`, `ChatAttachment` as a new `web/backend/app/models/chat.py` file.
- **SSE event schema** (`web/backend/app/schemas/sse_events.py`) already provides typed discriminated union events: AssistantTextEvent, ThinkingEvent, ToolUseEvent, ToolResultEvent, AskUserEvent, PermissionReqEvent, StatusEvent, RunCompleteEvent, ReplayTruncatedEvent, RetentionWarningEvent. Chat events reuse this exact schema (chats are sessions using agent_event streams — no new event types needed).
- **Agents router** (`web/backend/app/routers/agents.py`) provides the run-side endpoints: POST/GET runs, SSE /events, POST /input, POST /interrupt, POST /answer, GET /pending-prompt. This set adds a sibling `web/backend/app/routers/chats.py` with `/api/chats` routes.
- **Skill catalog** (`web/backend/app/routers/skills.py`, `web/frontend/src/hooks/useSkills.ts`) already exists. The SlashAutocomplete consumes `GET /api/skills` directly via useSkills.
- **useAgentEventStream** hook (`web/frontend/src/hooks/useAgentEventStream.ts`) already implements SSE + Last-Event-ID replay for a single run. `useAgentEvents` (this set's hook) extends it by adding the 2-5s jittered polling fallback for status/cost telemetry and by wrapping the hybrid gap-detection logic.
- **SkillLauncher + SkillGallery + RunLauncher** (`web/frontend/src/components/skills/`) already exist from skill-invocation-ui. AgentsPage's "Launch New Run" button opens SkillLauncher. ChatsPage's "New Chat" opens SkillGallery filtered to interactive skills. Empty state action cards also open SkillLauncher.

### What's missing and this set creates

- `web/frontend/src/pages/AgentRunPage.tsx` (new)
- `web/frontend/src/pages/ChatThreadPage.tsx` (new)
- `web/frontend/src/pages/AgentsPage.tsx` (replace wireframe-rollout stub)
- `web/frontend/src/pages/ChatsPage.tsx` (replace wireframe-rollout stub)
- `web/frontend/src/components/empty-states/{AgentsEmptyState,ChatsEmptyState}.tsx` (new composed components)
- `web/frontend/src/components/a11y/LiveRegion.tsx` (new aria-live component)
- `web/frontend/src/hooks/useFocusTrap.ts` (new — reused from web-tool-bridge pattern)
- `web/frontend/src/hooks/useAgentEvents.ts` (new — wraps useAgentEventStream + polling)
- `web/frontend/src/hooks/useChats.ts` (new — list management)
- `web/frontend/src/hooks/useChatThread.ts` (new — single-thread detail)
- `web/frontend/src/stores/statusStore.ts` (new — Zustand cross-page status)
- `web/frontend/src/router.tsx` (update — add `:runId` and `:threadId` child routes)
- `web/frontend/vite.config.ts` (update — add SSE proxy headers)
- `web/backend/app/models/chat.py` (new — Chat, ChatMessage, ChatAttachment)
- `web/backend/app/schemas/chats.py` (new — request/response shapes)
- `web/backend/app/services/chat_service.py` (new — create_thread, send_message, stream_response)
- `web/backend/app/routers/chats.py` (new — /api/chats endpoints)
- `web/backend/app/routers/dashboard.py` (new — consolidated GET /api/dashboard)
- `web/backend/alembic/versions/0006_chat_persistence.py` (new — migration for chats + chat_messages + chat_attachments tables)

### Patterns to follow

- **Styling**: Tailwind + custom tokens (`text-fg`, `text-muted`, `bg-surface-1`/`2`/`3`, `border-border`, `bg-accent`, tone system). Status tones via `StatusDotTone`: accent/link/warning/error/info/muted/highlight/orange.
- **Elevation**: `bg-surface-1` (low) → `bg-surface-3` (high).
- **Hooks contract signatures** (from CONTRACT.json, exact):
  - `useAgentEvents(runId: string): {events, status, reconnect}`
  - `useChats() -> {threads, createThread, sendMessage}`
  - `useChatThread(id) -> {thread, messages, stream}`
- **Error handling**: StateError → 409; NotFoundError → 404; ValidationError → 400. Structured JSON `{error_code, message, detail}`. Frontend uses ErrorCard primitive.
- **Polling interval**: 2-5s jittered (contract says "jittered" explicitly). Implement as `baseInterval + Math.random() * jitterMs`.
- **SSE events** use the existing `serialize_event()` helper and `EVENT_KINDS` frozenset — don't add new event kinds; reuse the 10 defined.
- **SQLModel classes** follow the pattern of AgentRun/AgentEvent: timestamps (`created_at`, `updated_at`), `id` as primary key, FKs explicit.
- **Alembic migration naming**: `000N_<snake_case_description>.py` — next available is `0006`.
</code_context>

<deferred>
## Deferred Ideas

- **Real ChatAttachment implementation** — stub table only in this set; full file/image/code upload flow targeted for v7.1
- **Pending-prompt notification mechanism** — queued structured questions when user navigates away from a chat need a cross-app signal (sidebar badge, browser notification, or toast on return)
- **Getting Started docs page** — zero-state-only empty state means no in-app docs target for advanced users wanting chat-vs-run reference
- **Advanced keyboard shortcuts** — thread search, archive shortcut, keyboard-driven slash autocomplete navigation beyond the contract's Shift+P/Shift+S
- **Thread archive polish** — bulk archive, auto-archive after N days, un-archive UX workflows
</deferred>
