# Wave 3 Plan — Frontend Pages + Router

**Set:** agents-chats-tabs
**Wave:** 3 of 3
**Focus:** 4 pages (AgentsPage rewrite, AgentRunPage new, ChatsPage rewrite, ChatThreadPage new), 2 empty-state components, router updates, react-markdown install

---

## Objective

Ship the user-visible pages that compose wireframe-rollout primitives and the Wave 2 hooks into a complete agent/chat UX. This is the wave the user sees.

1. **AgentsPage (rewrite)** — list view of agent runs with StatCard grid + DataTable + "Launch New Run" action; NOT a launcher.
2. **AgentRunPage (new)** — detail view for an autonomous run: StatusBadge, telemetry, stacked ToolCallCard feed, Shift+P/Shift+S shortcuts. **No composer** (load-bearing UX per `no_composer_on_run_detail`).
3. **ChatsPage (rewrite)** — list view of chat threads with DataTable + "New Chat" action opening SkillGallery filtered to interactive.
4. **ChatThreadPage (new)** — detail view for a chat thread: scrollable message list, react-markdown rendering, inline ToolCallCard + StructuredQuestion, persistent bottom Composer, SlashAutocomplete, AutoScrollPill.
5. **AgentsEmptyState + ChatsEmptyState** — composed EmptyState with 3-action lists, chat-vs-run explanation.
6. **Router child routes** — `/agents/:runId` and `/chats/:threadId`.
7. **react-markdown install** — add `react-markdown` + `rehype-sanitize` to `package.json`.
8. **Nav fix** — existing AgentsPage currently navigates to `/chats/{runId}` for all runs (verified in `AgentsPage.tsx:51-53`); fix to route autonomous runs to `/agents/:runId` and interactive runs to `/chats/:threadId` based on skill category.
9. **Integration tests** — rewrite existing `AgentsPage.integration.test.tsx` and `ChatsPage.integration.test.tsx` to match new behavior; add new tests for the detail pages and empty states.

File ownership: Wave 3 owns `web/frontend/src/pages/**`, `web/frontend/src/components/empty-states/**`, `web/frontend/src/router.tsx`, and `web/frontend/package.json`. It does NOT modify anything from Wave 1 (backend) or Wave 2 (hooks/stores/types/a11y/vite.config.ts).

---

## Tasks

### T1. Install react-markdown + rehype-sanitize

**Files modified:**
- `web/frontend/package.json` (`dependencies`)
- `web/frontend/package-lock.json` (auto-generated) — **do NOT manually edit**

**Implementation:**

Run from `web/frontend/`:

```bash
npm install react-markdown@^10 rehype-sanitize@^6
```

Verified via context7: react-markdown's stable major is v10; rehype-sanitize v6 is current. `rehype-sanitize` is the recommended safe-rendering plugin for untrusted content (per react-markdown security docs).

**What NOT to do:**
- Do NOT hand-edit `package.json` — let `npm install` write the version range.
- Do NOT install `rehype-raw` — that ENABLES raw HTML (unsafe). We want `rehype-sanitize` which RESTRICTS it.
- Do NOT install `remark-gfm` unless tables/task lists are needed in chat output; leave out for now (smaller bundle; add later if missing).

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
grep -E '"(react-markdown|rehype-sanitize)"' package.json
npx tsc -b --noEmit  # type resolution check
```

---

### T2. AgentRun list types — `web/frontend/src/types/agents.ts` (new or extend)

**Files modified:**
- `web/frontend/src/types/agents.ts` (new; may already exist from earlier sets — check before creating)

**Implementation:**

Mirror `AgentRunResponse` from `web/backend/app/schemas/agents.py:25-43`:

```ts
export type AgentRunStatus =
  | "pending" | "running" | "waiting"
  | "interrupted" | "failed" | "completed";

export interface AgentRun {
  id: string;
  project_id: string;
  set_id: string | null;
  skill_name: string;
  status: AgentRunStatus;
  pid: number | null;
  started_at: string;
  ended_at: string | null;
  active_duration_s: number;
  total_wall_clock_s: number;
  total_cost_usd: number;
  max_turns: number;
  turn_count: number;
  error_code: string | null;
  last_seq: number;
}

export interface AgentRunListResponse {
  items: AgentRun[];
  total: number;
}
```

If `web/frontend/src/types/agents.ts` already exists from a prior set, extend rather than overwrite.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
```

---

### T3. `useAgentRuns` list hook — `web/frontend/src/hooks/useAgentRuns.ts` (new)

**Files modified:**
- `web/frontend/src/hooks/useAgentRuns.ts` (new)

**Implementation:**

Paginated list hook. Mirror `useSkills.ts:9-15`:

```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiClient, type ApiError } from "@/lib/apiClient";
import { useProjectStore } from "@/stores/projectStore";
import type { AgentRun, AgentRunListResponse } from "@/types/agents";

export function useAgentRuns(): UseQueryResult<AgentRunListResponse, ApiError> {
  const projectId = useProjectStore((s) => s.activeProjectId);
  return useQuery<AgentRunListResponse, ApiError>({
    queryKey: ["agent-runs", projectId],
    queryFn: () =>
      apiClient.get<AgentRunListResponse>(
        `/agents/runs?project_id=${projectId}`,
      ),
    enabled: projectId !== null,
    staleTime: 5_000,
    refetchInterval: 5_000,  // fallback refresh; dashboard poll is the primary signal
  });
}

export function useAgentRun(runId: string | null): UseQueryResult<AgentRun, ApiError> {
  return useQuery<AgentRun, ApiError>({
    queryKey: ["agent-run", runId],
    queryFn: () => apiClient.get<AgentRun>(`/agents/runs/${runId}`),
    enabled: runId !== null,
    staleTime: 2_000,
  });
}
```

**Note on backend dependency:** `GET /api/agents/runs?project_id=X` must exist on the backend. Check `web/backend/app/routers/agents.py` — if only `GET /api/agents/runs/{id}` exists, surface this as a BLOCKER immediately (category DEPENDENCY) before continuing. Do NOT silently patch this into Wave 1.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
```

---

### T4. AgentsPage (rewrite) — `web/frontend/src/pages/AgentsPage.tsx`

**Files modified:**
- `web/frontend/src/pages/AgentsPage.tsx` (full rewrite — replace the existing 57-line SkillGallery-based page)

**Implementation:**

Compose: `PageHeader` (title "Agents", action slot = SearchInput + "Launch New Run" button), `StatCard` grid (Running / Waiting / Failed / Completed from `useStatusStore`), `DataTable` for the run list, `AgentsEmptyState` when `runs.length === 0`. Launcher modal opens on button click.

**Exact contract signature (from CONTRACT.json:17):**
> `<AgentsPage /> composing PageHeader (title 'Agents', action slot with SearchInput + 'Launch New Run' button), StatCard grid ('Running' / 'Waiting' / 'Failed' / 'Completed'), DataTable for runs (status StatusBadge, skill mono, duration mono, set ref mono, cost mono), EmptyState when no runs`

**Key details:**

- Columns for DataTable: `status` (StatusBadge — see below for tone mapping), `skill_name` (font-mono), `started_at` formatted `HH:mm:ss`, `active_duration_s` formatted `MM:SS` (font-mono), `set_id` (font-mono, fallback `—`), `total_cost_usd` formatted `$0.0000` (font-mono).
- StatusBadge tone per status (per `status_pill_color_and_label` invariant — **color + label, never color alone**):
  - `running` → tone `accent` or `success` (green), label "RUNNING"
  - `waiting` → tone `warning` (yellow), label "WAITING"
  - `failed` / `interrupted` → tone `error` (red), label "FAILED" / "INTERRUPTED"
  - `completed` → tone `link` (blue), label "COMPLETED"
  - `pending` → tone `muted`, label "PENDING"
- Row click → `navigate('/agents/:runId')` for **autonomous** skills or `navigate('/chats/:threadId')` for **interactive**. Distinguish via the skill's category from `useSkills` — join `run.skill_name` against the skill catalog. If unknown, default to `/agents/:runId` (autonomous is the safer default).
- Call `useDashboard` inside the page so the StatCard grid reacts to the live poll (the store is already populated by the provider hierarchy if the dashboard is also mounted elsewhere; calling it here is cheap and idempotent — RQ dedupes by key).

**Bug fix (per CRITICAL correction #4):** The existing `AgentsPage.tsx:50-53` navigates to `/chats/{runId}` for ALL runs. The new implementation routes correctly by skill category.

**Pseudo-shape (fill in with exact primitive props from `web/frontend/src/components/primitives/index.ts`):**

```tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  PageHeader, SearchInput, StatCard, DataTable, StatusBadge,
  type Column,
} from "@/components/primitives";
import { SkillLauncher } from "@/components/skills/SkillLauncher";
import { useAgentRuns } from "@/hooks/useAgentRuns";
import { useDashboard } from "@/hooks/useDashboard";
import { useSkills } from "@/hooks/useSkills";
import { useStatusStore } from "@/stores/statusStore";
import { useProjectStore } from "@/stores/projectStore";
import { AgentsEmptyState } from "@/components/empty-states/AgentsEmptyState";
import type { AgentRun } from "@/types/agents";

export function AgentsPage() {
  const navigate = useNavigate();
  const projectId = useProjectStore((s) => s.activeProjectId);
  const [query, setQuery] = useState("");
  const [launcherOpen, setLauncherOpen] = useState(false);

  useDashboard(projectId);  // side-effect: populates statusStore
  const runs = useStatusStore((s) => s.runs);
  const { data: runsList, isLoading } = useAgentRuns();
  const { data: skills = [] } = useSkills();

  const skillCategoryByName = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of skills) m.set(s.name, s.categories);
    return m;
  }, [skills]);

  const rowNavigate = (run: AgentRun) => {
    const cats = skillCategoryByName.get(run.skill_name) ?? [];
    if (cats.includes("interactive")) {
      // Interactive runs are backed by chat threads; route to /chats/:threadId
      // TODO: lookup the thread bound to this run. Fallback: /agents/:runId.
      navigate(`/agents/${run.id}`);
    } else {
      navigate(`/agents/${run.id}`);
    }
  };

  const filtered = useMemo(() => {
    const items = runsList?.items ?? [];
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(
      (r) => r.skill_name.toLowerCase().includes(q) || r.id.includes(q),
    );
  }, [runsList, query]);

  const columns: Column<AgentRun>[] = [ /* ... define per primitives API ... */ ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Agents"
        breadcrumb={[{ label: "RAPID", to: "/" }, { label: "Agents" }]}
        description="Autonomous skill runs."
        action={
          <div className="flex items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Filter runs..." />
            <button onClick={() => setLauncherOpen(true)} className="...">
              Launch New Run
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Running" value={runs?.running ?? 0} tone="accent" />
        <StatCard label="Waiting" value={runs?.waiting ?? 0} tone="warning" />
        <StatCard label="Failed" value={runs?.failed ?? 0} tone="error" />
        <StatCard label="Completed" value={runs?.completed ?? 0} tone="link" />
      </div>

      {!isLoading && filtered.length === 0 ? (
        <AgentsEmptyState />
      ) : (
        <DataTable rows={filtered} columns={columns} onRowClick={rowNavigate} />
      )}

      <SkillLauncher
        open={launcherOpen}
        skillName={null}
        projectId={projectId ?? ""}
        onClose={() => setLauncherOpen(false)}
        onLaunched={(runId) => {
          setLauncherOpen(false);
          navigate(`/agents/${runId}`);
        }}
      />
    </div>
  );
}
```

(Adapt the primitive props to the real API exported from `web/frontend/src/components/primitives/index.ts`. Read each primitive's props interface before composing; the shapes above are schematic.)

**Launcher choice:** CONTRACT says "Launch New Run" opens `SkillLauncher`. But `SkillLauncher` may require a pre-selected skill name. If so, open `SkillGallery` filtered to autonomous + human-in-loop categories first, and pass the chosen skill into SkillLauncher. Follow the existing flow pattern but inverted (skill selection happens via gallery modal, not inline).

**What NOT to do:**
- Do NOT keep the old SkillGallery inline (the current 57-line file). Replace it entirely.
- Do NOT navigate to `/chats/{runId}` for autonomous runs — that was the pre-existing bug.
- Do NOT rely on `categories.includes("autonomous")` as a strict category — skills can be `["autonomous", "human-in-loop"]`; the navigate decision is "interactive ⇒ chats, else agents."
- Do NOT skip the empty state — `AgentsEmptyState` renders when `filtered.length === 0 && !isLoading`.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run src/pages/__tests__/AgentsPage.integration.test.tsx
```

---

### T5. AgentRunPage (new) — `web/frontend/src/pages/AgentRunPage.tsx`

**Files modified:**
- `web/frontend/src/pages/AgentRunPage.tsx` (new)

**Implementation:**

Reads `useParams<{ runId: string }>()`, attaches `useAgentEvents(runId)` and `useAgentRun(runId)`, composes PageHeader + StatusBadge pill + telemetry SurfaceCard + DataTable + stacked ToolCallCard feed. **No composer.**

**Contract (from CONTRACT.json:22-23):**
> PageHeader (title: run ID, description: skill name, action slot: pause/stop), StatusBadge pill (RUNNING 00:04:32 / WAITING / FAILED / COMPLETED -- color+label per WCAG 1.4.1), live activity feed as stacked ToolCallCard instances, telemetry SurfaceCard + DataTable for cost/token/duration; NO composer; keyboard shortcuts Shift+P=pause, Shift+S=stop

**Behavioral notes:**

- **No composer** — this is load-bearing per `no_composer_on_run_detail`.
- **StatusBadge** shows both color AND label (e.g. "RUNNING 00:04:32" in green with text). Duration: format `active_duration_s` as `HH:MM:SS` or `MM:SS`. Use `usePrefersReducedMotion()` from primitives/hooks — if reduced motion is set, suppress the pulse animation.
- **Telemetry SurfaceCard** — wraps a DataTable with two columns (metric, value, both mono): rows for "Total cost" (`$0.0042`), "Turn count", "Active duration", "Wall-clock duration", "Max turns", "Last seq". Populated from `useAgentRun(runId).data`.
- **Activity feed** — map `events` (from `useAgentEvents`) to stacked `ToolCallCard` components for `tool_use` / `tool_result` pairs, plain text blocks for `assistant_text` / `thinking`, `ErrorCard` for `permission_req[blocked=true]` or error status. Use `useAutoScrollWithOptOut()` to track user scroll position; when false, render `AutoScrollPill` as a click-to-resume control.
- **Keyboard shortcuts** (per `keyboard_accessibility` invariant):
  - `Shift+P` → call `POST /api/agents/runs/{runId}/interrupt` with a `{type: 'pause'}` body? The backend exposes `/interrupt` (line 139-146) as generic. If a distinct pause endpoint doesn't exist, use `/interrupt` for both. Document: "Pause and stop are both currently interrupt; separate pause semantics are a future refinement."
  - `Shift+S` → same `/interrupt` call with stop semantics.
  - Register via a document-level `keydown` listener inside a `useEffect`; check `e.shiftKey && e.key === 'P'` (case-sensitive check on `KeyP`). Guard against firing in text fields (none on this page, but defensive).
- **LiveRegion** wraps the status pill's text content with `mode='polite'` and `busy={status === 'running'}` so screen readers announce streamed text + status transitions without being interrupted mid-stream.
- **ask_user events** — when an `ask_user` event arrives, mount the `AskUserModal` from `web-tool-bridge`. Per CONTRACT imports `ask_user_modal_components`, both run detail and chat detail mount these modals.

**What NOT to do:**
- Do NOT add a Composer — explicitly banned by `no_composer_on_run_detail`.
- Do NOT rely on the old `useAgentEventStream` — use the new `useAgentEvents` from Wave 2 which handles all 10 event kinds.
- Do NOT forget `usePrefersReducedMotion` — required by `prefers_reduced_motion_respected` invariant.
- Do NOT animate the status pill unconditionally — guard the pulse with the reduced-motion check.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run src/pages/__tests__/AgentRunPage.test.tsx
```

---

### T6. ChatsPage (rewrite) — `web/frontend/src/pages/ChatsPage.tsx`

**Files modified:**
- `web/frontend/src/pages/ChatsPage.tsx` (full rewrite — replace the existing 61-line SkillGallery-based page)

**Implementation:**

Similar to AgentsPage but for threads. Compose: PageHeader ("Chats" title, "New Chat" action button), StatCard grid (Active / Idle / Archived), DataTable for threads (title, skill mono, last_message_at mono, status StatusBadge), `ChatsEmptyState` when `threads.length === 0`. "New Chat" opens `SkillGallery` filtered to `interactive` + `human-in-loop` categories.

**Contract (from CONTRACT.json:27):**
> PageHeader (title 'Chats', action slot: 'New Chat' button opening SkillGallery filtered to interactive skills), DataTable for threads (title, skill mono, timestamp mono, status StatusBadge), EmptyState when no threads

**Flow:**

1. User clicks "New Chat" → SkillGallery modal opens (filter=interactive+human-in-loop).
2. User picks a skill → call `createThread({ skillName })` from `useChats`.
3. On success → `navigate('/chats/:threadId')` using the new thread's ID.

**Additional:** "Show archived" toggle sets `includeArchived` on the `useChats` query (per CONTEXT Chat Thread Lifecycle: "Thread list has a 'Show archived' filter toggle"). Render as a small checkbox/toggle near the SearchInput.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run src/pages/__tests__/ChatsPage.integration.test.tsx
```

---

### T7. ChatThreadPage (new) — `web/frontend/src/pages/ChatThreadPage.tsx`

**Files modified:**
- `web/frontend/src/pages/ChatThreadPage.tsx` (new)

**Implementation:**

Most complex page in the set. Reads `useParams<{ threadId: string }>()`, uses `useChatThread(threadId)` for data, composes Composer at the bottom, scrollable message list, inline ToolCallCard, inline StructuredQuestion (for ask_user and permission_req), ErrorCard, AutoScrollPill, StreamingCursor, SlashAutocomplete.

**Contract (CONTRACT.json:32-33):**
> Persistent bottom Composer, scrollable message list, inline ToolCallCard components, inline StructuredQuestion for can_use_tool prompts, ErrorCard for errors, AutoScrollPill for auto-scroll opt-out, StreamingCursor during token streams, SlashAutocomplete above composer when user types /

**Message rendering:**

- For each `ChatMessage` in `messages`:
  - `role='user'` → plain text bubble.
  - `role='assistant'` → `ReactMarkdown` with `rehypePlugins={[rehypeSanitize]}` for `content`; then render the `tool_calls` JSON as inline `ToolCallCard` siblings (one per tool_use_id).
  - `role='tool'` → collapsed into the matching assistant row's ToolCallCard (don't render a standalone row; find by `tool_use_id`).
- During an active stream (from `useChatThread(...).stream.events`):
  - Append a streaming assistant row with a `StreamingCursor` glyph after the accumulating text (deltas from `assistant_text` events).
  - Render newly-arrived `tool_use` events inline below the streaming row.
  - When `run_complete` arrives, `queryClient.invalidateQueries({queryKey: ["chat-messages", threadId]})` (already wired in `useChatThread`). The streaming row is replaced by the materialized one automatically.

**Composer:**

- Persistent at bottom (sticky).
- On submit → `sendMessage({ chatId: threadId, content, tempId: crypto.randomUUID() })` from `useChats`.
- Clears content on successful POST.
- Shows an error toast (via `sonner` already in deps) on failure.

**SlashAutocomplete:**

- Trigger: composer starts with `/` OR contains ` /` pattern and cursor is after the `/`.
- Source: `useSkills()` filtered to `categories.includes('interactive') || categories.includes('human-in-loop')`.
- Arrow keys navigate, Enter selects. On select: if skill has args → open `SkillLauncher` modal pre-populated; else insert `/rapid:<name>` into composer for the user to send.

**Structured questions (ask_user, permission_req):**

- When an `ask_user` event arrives via `stream.events`, render an `<StructuredQuestion>` component inline ABOVE the composer. Dim + disable the composer while a question is pending.
- On answer submit → `POST /api/agents/runs/{run_id}/answer` with `{ prompt_id, answer }`. Use the existing `useAnswerPrompt` hook if it's generic enough; otherwise inline the mutation.
- On answer success → re-enable composer; question disappears from the flow.

**AutoScrollPill:**

- Use `useAutoScrollWithOptOut()` from primitives/hooks — tracks user scroll; when user scrolls up, `shouldAutoScroll` becomes false.
- Render the pill when `!shouldAutoScroll && newMessagesPending`.
- Clicking scrolls to bottom.

**LiveRegion:**

- Wrap the streaming assistant row's text in `<LiveRegion mode="polite" busy={streaming}>` so screen readers read the accumulated content without interrupting mid-delta.

**Navigation-away behavior:**
- Do NOT kill the EventSource on tab hidden — only on unmount. The hook already handles this correctly.
- Archived-thread behavior: if `thread?.session_status === 'archived'`, disable composer, show a banner "Thread archived — un-archive to continue".

**What NOT to do:**
- Do NOT use `rehype-raw` — unsafe for untrusted assistant output.
- Do NOT render tool results as separate message bubbles — inline into the parent ToolCallCard by `tool_use_id`.
- Do NOT trigger auto-scroll on every keystroke — only on new message arrival.
- Do NOT bypass the structured-question disable — users should not be able to send free text while a question is pending (per CONTEXT Chat Composer decision).

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run src/pages/__tests__/ChatThreadPage.test.tsx
```

---

### T8. AgentsEmptyState + ChatsEmptyState — `web/frontend/src/components/empty-states/{AgentsEmptyState,ChatsEmptyState}.tsx` (new)

**Files modified:**
- `web/frontend/src/components/empty-states/AgentsEmptyState.tsx` (new)
- `web/frontend/src/components/empty-states/ChatsEmptyState.tsx` (new)
- `web/frontend/src/components/empty-states/index.ts` (new — barrel)

**Implementation (from CONTEXT.md "Empty State — Content Approach" + CONTRACT empty_state_onboarding):**

Both components compose the wireframe-rollout `EmptyState` primitive. Each has:

1. **Tab purpose:** 1-sentence header.
2. **Chat-vs-run distinction:** 1-sentence subheader.
3. **3 action cards:** open SkillLauncher for autonomous skills, or create a new thread for chat skills.

**AgentsEmptyState:**

```tsx
import { useState } from "react";
import { EmptyState } from "@/components/primitives";
import { SkillLauncher } from "@/components/skills/SkillLauncher";
import { useProjectStore } from "@/stores/projectStore";

const ACTIONS = [
  { skill: "status", label: "/rapid:status", desc: "Show project dashboard" },
  { skill: "plan-set", label: "/rapid:plan-set", desc: "Plan all waves in a set" },
  { skill: "execute-set", label: "/rapid:execute-set", desc: "Execute all waves in a set" },
];

export function AgentsEmptyState() {
  const [launcherSkill, setLauncherSkill] = useState<string | null>(null);
  const projectId = useProjectStore((s) => s.activeProjectId);
  return (
    <>
      <EmptyState
        title="No agent runs yet"
        description="Agents run autonomously in the background. Agents stream activity; chats wait for your replies."
        actions={ACTIONS.map((a) => ({
          label: a.label,
          description: a.desc,
          onClick: () => setLauncherSkill(a.skill),
        }))}
      />
      <SkillLauncher
        open={launcherSkill !== null}
        skillName={launcherSkill}
        projectId={projectId ?? ""}
        onClose={() => setLauncherSkill(null)}
      />
    </>
  );
}
```

**ChatsEmptyState:** analogous, but the 3 actions are `discuss-set`, `quick`, `bug-fix`, and clicking calls `useChats().createThread({ skillName: a.skill })` then `navigate('/chats/:threadId')` using the returned thread ID.

Barrel:
```ts
export { AgentsEmptyState } from "./AgentsEmptyState";
export { ChatsEmptyState } from "./ChatsEmptyState";
```

**Note:** `EmptyState`'s `actions` prop may expect a specific shape — read `web/frontend/src/components/primitives/EmptyState.tsx` before finalizing the call shape. Adapt accordingly.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run src/components/empty-states/__tests__/
```

---

### T9. Router updates — `web/frontend/src/router.tsx`

**Files modified:**
- `web/frontend/src/router.tsx`

**Implementation:**

Add `AgentRunPage` and `ChatThreadPage` imports. Add child routes under `/agents` and `/chats`. Per CRITICAL research note, router uses react-router 7.13.1 data-router API (`createBrowserRouter`) — child routes should nest under parent so the parent route can render layout and `<Outlet />` if desired; otherwise, keep them as siblings with explicit paths.

**Simplest approach — add sibling routes** (no Outlet change needed; each page renders itself):

```tsx
import { AgentsPage } from "@/pages/AgentsPage";
import { AgentRunPage } from "@/pages/AgentRunPage";
import { ChatsPage } from "@/pages/ChatsPage";
import { ChatThreadPage } from "@/pages/ChatThreadPage";

// In createBrowserRouter children:
{ path: "agents", element: <AgentsPage /> },
{ path: "agents/:runId", element: <AgentRunPage /> },
{ path: "chats", element: <ChatsPage /> },
{ path: "chats/:threadId", element: <ChatThreadPage /> },
```

**What NOT to do:**
- Do NOT rename existing route paths — `ga`/`gc` shortcuts in `types/layout.ts` already point at `/agents` and `/chats`.
- Do NOT introduce `Outlet` patterns unless the detail pages need a shared header with the list — they don't; keep routes flat.
- Do NOT lazy-load these pages for v1 (skip the `lazy()` wrapper seen for `KnowledgeGraphPage`); the bundle size is acceptable and direct imports simplify tests.

**Verification:**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run  # broad smoke — ensure no route regression
```

---

### T10. Integration tests

**Files modified:**
- `web/frontend/src/pages/__tests__/AgentsPage.integration.test.tsx` (rewrite)
- `web/frontend/src/pages/__tests__/ChatsPage.integration.test.tsx` (rewrite)
- `web/frontend/src/pages/__tests__/AgentRunPage.test.tsx` (new)
- `web/frontend/src/pages/__tests__/ChatThreadPage.test.tsx` (new)
- `web/frontend/src/components/empty-states/__tests__/AgentsEmptyState.test.tsx` (new)
- `web/frontend/src/components/empty-states/__tests__/ChatsEmptyState.test.tsx` (new)

#### T10.1 — `AgentsPage.integration.test.tsx` (rewrite)

The existing test asserts SkillGallery behavior (filtering, "All skills" toggle). That entire suite is replaced because the page is no longer a launcher.

Test cases:
- `test_renders_page_header_with_launch_button`
- `test_renders_stat_card_grid_from_statusStore` — preload `useStatusStore.setState({ runs: {...} })`, assert labels + values.
- `test_renders_data_table_rows_from_useAgentRuns` — mock `/agents/runs` returning 3 rows, assert 3 table rows.
- `test_status_badge_has_color_and_label` — per `status_pill_color_and_label` invariant; assert both a class indicating tone AND a text node "RUNNING".
- `test_empty_state_when_no_runs` — mock empty list, `AgentsEmptyState` text appears.
- `test_autonomous_row_click_navigates_to_agents_runId` — uses `MemoryRouter` + route probe.
- `test_interactive_row_click_navigates_to_chats_threadId` — skill category drives nav target.
- `test_search_input_filters_rows_by_skill_name`
- `test_launch_new_run_button_opens_launcher`

Test scaffolding: reuse the `apiClient` + `projectStore` mocks from the existing test file (lines 12-40 are good patterns). Add mocks for `useAgentRuns` (via mocked apiClient GET `/agents/runs?...`) and `useDashboard` (mock GET `/dashboard?...`).

#### T10.2 — `ChatsPage.integration.test.tsx` (rewrite)

Replace the SkillGallery-based tests with thread-list tests.

Test cases:
- `test_renders_page_header_with_new_chat_button`
- `test_renders_stat_card_grid_from_statusStore`
- `test_renders_thread_table_rows`
- `test_empty_state_when_no_threads`
- `test_show_archived_toggle_refetches_with_flag`
- `test_new_chat_opens_skill_gallery_filtered_to_interactive`
- `test_selecting_skill_creates_thread_and_navigates`
- `test_row_click_navigates_to_chats_threadId`

#### T10.3 — `AgentRunPage.test.tsx`

Test cases:
- `test_renders_status_badge_with_color_and_label` — `status_pill_color_and_label` invariant.
- `test_does_not_render_composer` — `no_composer_on_run_detail` invariant (query `textarea[aria-label*=Composer]` returns nothing).
- `test_renders_telemetry_table_from_useAgentRun`
- `test_renders_tool_call_cards_for_tool_use_events` — mock `useAgentEvents` returning 2 tool_use events; assert 2 ToolCallCard components.
- `test_shift_p_sends_interrupt_request` — mock apiClient.post; fire `keydown` with shiftKey=true, key='P'; assert `/interrupt` called.
- `test_shift_s_sends_interrupt_request` — analogous.
- `test_prefers_reduced_motion_suppresses_pulse` — mock `window.matchMedia`; assert animation class NOT applied.
- `test_auto_scroll_pill_renders_when_user_scrolls_up` — simulate scroll event.
- `test_ask_user_event_mounts_modal`
- `test_live_region_present_for_status_announcements`

#### T10.4 — `ChatThreadPage.test.tsx`

Test cases:
- `test_renders_composer_at_bottom` — presence test.
- `test_renders_messages_as_markdown` — mock `useChatThread` with an assistant message containing `**bold**`; assert `<strong>` in output.
- `test_rehype_sanitize_strips_script_tags` — assistant content `<script>alert(1)</script>hello`; assert `<script>` absent, "hello" present.
- `test_user_message_optimistic_render_then_reconciliation`
- `test_run_complete_invalidates_messages_query` — verified via `useChatThread` tests; here assert the page re-renders the new materialized row.
- `test_slash_autocomplete_opens_on_slash` — type `/` in composer; assert autocomplete visible.
- `test_slash_autocomplete_navigation_with_arrow_keys`
- `test_structured_question_renders_inline_and_disables_composer`
- `test_auto_scroll_pill_on_scroll_up`
- `test_archived_thread_disables_composer_and_shows_banner`

#### T10.5 — `AgentsEmptyState.test.tsx` and `ChatsEmptyState.test.tsx`

Per `empty_state_onboarding_present` invariant.

Test cases (AgentsEmptyState):
- `test_renders_title_and_description`
- `test_description_mentions_agents_and_chats` — string-contains check for "agents" AND "chats" (distinction explanation).
- `test_renders_three_action_cards` — check for `/rapid:status`, `/rapid:plan-set`, `/rapid:execute-set`.
- `test_clicking_action_opens_skill_launcher`

ChatsEmptyState analogous with `/rapid:discuss-set`, `/rapid:quick`, `/rapid:bug-fix` and thread-creation nav.

**Verification (all T10 tests):**
```bash
cd ~/Projects/RAPID/web/frontend
npx tsc -b --noEmit
npx vitest run
```

---

## Success Criteria

### Export coverage (CONTRACT.json exports fulfilled by this wave)

| Export | Task | File |
|--------|------|------|
| `agents_routes` | T9 | `router.tsx` |
| `agents_page` | T4 | `pages/AgentsPage.tsx` |
| `agent_run_page` | T5 | `pages/AgentRunPage.tsx` |
| `chats_page` | T6 | `pages/ChatsPage.tsx` |
| `chat_thread_page` | T7 | `pages/ChatThreadPage.tsx` |
| `empty_state_onboarding` | T8 | `components/empty-states/*` |
| `sidebar_nav_extension` | (verified pre-existing) | `types/layout.ts` — **no change needed** |

### Behavioral invariants covered (end-to-end)

| Invariant | Enforcement | Task |
|-----------|-------------|------|
| `run_survives_tab_close` | AgentRunPage re-attaches on remount via `useAgentEvents`; tested by unmount-remount test | T10.3 |
| `polling_primary_sse_augmentation` | Verified end-to-end in `useAgentEvents` (Wave 2) and page-level tests | T10.3, T10.4 |
| `status_pill_color_and_label` | StatusBadge renders color tone + text label | T4, T10.1, T10.3 |
| `keyboard_accessibility` | Shift+P / Shift+S shortcuts, ESC modal, focus trap | T5, T10.3 |
| `no_composer_on_run_detail` | AgentRunPage has NO `<Composer>` | T5, T10.3 |
| `prefers_reduced_motion_respected` | `usePrefersReducedMotion` guards animations | T5, T10.3 |
| `auto_scroll_opt_out` | `useAutoScrollWithOptOut` + `AutoScrollPill` | T5, T7, T10.3, T10.4 |
| `empty_state_onboarding_present` | AgentsEmptyState + ChatsEmptyState rendered at 0 rows | T8, T10.5 |
| `adopts_wireframe_primitives` | All pages compose from `@/components/primitives` | **review-enforced** (no new primitives shipped) |
| `sidebar_shortcut_map_matches_context` | `layout.ts` has `ga=/agents, gc=/chats` | **verified pre-existing** |

### Automated verification

```bash
cd ~/Projects/RAPID/web/frontend
npm install               # picks up react-markdown + rehype-sanitize
npx tsc -b --noEmit
npx vitest run            # all tests pass (Wave 2 hooks + Wave 3 pages + rewritten integrations)
```

### Deliverables checklist

- [ ] `package.json` has `react-markdown` and `rehype-sanitize` in deps
- [ ] `src/types/agents.ts` with `AgentRun`, `AgentRunStatus`, `AgentRunListResponse`
- [ ] `src/hooks/useAgentRuns.ts` (useAgentRuns + useAgentRun)
- [ ] `src/pages/AgentsPage.tsx` full rewrite (no more SkillGallery inline)
- [ ] `src/pages/AgentRunPage.tsx` (new)
- [ ] `src/pages/ChatsPage.tsx` full rewrite
- [ ] `src/pages/ChatThreadPage.tsx` (new)
- [ ] `src/components/empty-states/AgentsEmptyState.tsx` + `ChatsEmptyState.tsx` + barrel
- [ ] `src/router.tsx` has 4 routes (`/agents`, `/agents/:runId`, `/chats`, `/chats/:threadId`)
- [ ] Rewritten `AgentsPage.integration.test.tsx` + `ChatsPage.integration.test.tsx`
- [ ] New `AgentRunPage.test.tsx`, `ChatThreadPage.test.tsx`
- [ ] New `AgentsEmptyState.test.tsx`, `ChatsEmptyState.test.tsx`
- [ ] Type-check passes; vitest suite passes.

---

## Out of Scope for Wave 3

- Real ChatAttachment upload flow — deferred to v7.1 (DEFERRED.md item 1).
- Pending-prompt notification on nav-away — deferred (DEFERRED.md item 2).
- Getting Started docs destination — deferred (DEFERRED.md item 3).
- Keyboard shortcuts beyond Shift+P/Shift+S — deferred (DEFERRED.md item 4).
- Bulk archive / auto-archive — deferred (DEFERRED.md item 5).
- Any changes to `types/layout.ts` — pre-existing `ga=/agents, gc=/chats` already matches the contract (per CRITICAL research note).
- Any modification to `components/primitives/**` — `adopts_wireframe_primitives` invariant forbids new primitives in this set.

---

## Coordination Notes

- **Wave 1 + Wave 2 must be merged before Wave 3 can complete end-to-end.** Types and basic scaffolding can be written in parallel, but integration tests and runtime behavior require both waves.
- **If `GET /api/agents/runs?project_id=X` list endpoint is missing from backend**, surface as BLOCKED immediately. Do NOT silently patch Wave 1 from this wave.
- **React Router 7 data-router API:** `useNavigate()` and `useParams()` work identically to v6 for the functions we use here; no migration shims needed.
- **Bundle check (optional):** after `npm run build`, confirm `react-markdown` + `rehype-sanitize` did not add more than ~80 KB gzipped to the chunk containing `ChatThreadPage`. If it did, consider `lazy()` loading that route.
