# Quick Task 28: Agent Chat Button + Persistent Agent Sessions

## Objective

Add "Chat" buttons to the AgentsPage and AgentRunPage so users can open a
conversational chat thread for any agent run, and make agent sessions persistent
so the Claude SDK subprocess stays alive between messages instead of being
killed and respawned per turn.

---

## Task 1 -- Backend: "find-or-create chat for run" endpoint + persistent sessions

### Files to modify

- `web/backend/app/routers/agents.py` -- add `POST /runs/{run_id}/chat`
- `web/backend/app/services/agent_service.py` -- add `find_or_create_chat_for_run`
- `web/backend/app/services/chat_service.py` -- add `find_or_create_for_run`, modify `send_message` to reuse persistent sessions
- `web/backend/app/agents/session.py` -- refactor to support multi-turn persistent mode
- `web/backend/app/agents/session_manager.py` -- keep sessions alive after `run()` completes, add idle timeout, add `continue_session` method
- `web/backend/app/models/chat.py` -- no schema changes needed (existing `active_run_id` suffices)

### Action

**1a. Backend endpoint: `POST /api/agents/runs/{run_id}/chat`**

Add a new endpoint to `agents.py` router that:
- Takes a `run_id` path parameter
- Looks up the `AgentRun` row to get `project_id` and `skill_name`
- Calls `chat_service.find_or_create_for_run(session, run_id)` which:
  - Queries `Chat` table for any thread where `active_run_id == run_id`
  - If not found, queries `ChatMessage` table for any message where `agent_run_id == run_id`, then returns that message's `chat_id`
  - If still not found, creates a new `Chat` row with `project_id`, `skill_name`, and `title` derived from skill name
- Returns `ChatResponse` (same schema as `POST /api/chats`)

Add the service function `find_or_create_for_run` in `chat_service.py`:
```
async def find_or_create_for_run(session, run_id) -> Chat:
    # 1. Check Chat.active_run_id
    # 2. Check ChatMessage.agent_run_id -> chat_id
    # 3. Create new Chat with run's project_id/skill_name
```

Add the thin facade in `agent_service.py`:
```
async def find_or_create_chat_for_run(mgr, session, run_id) -> Chat:
    run = await mgr.get_run(run_id)
    return await chat_service.find_or_create_for_run(session, run.project_id, run.skill_name, run_id)
```

**1b. Persistent agent sessions**

Refactor `AgentSession` to support a **multi-turn persistent mode**:

1. In `AgentSession`:
   - Add a `_persistent` flag (default `False`, set to `True` when used by chat)
   - Add an `_idle` asyncio.Event that is set when the session finishes processing a response but should stay alive
   - Add a `_new_query` asyncio.Event that signals a new `send_input()` arrived
   - Modify `run()`: After `ResultMessage`, if `_persistent` is True, do NOT emit `RunCompleteEvent` with terminal status. Instead, transition to idle state (set `_idle`, update DB status to "idle", await `_new_query`)
   - When `_new_query` fires, call `receive_response()` again and resume the message pump
   - Keep the existing one-shot behavior as default (backward compatible)

2. In `AgentSession.send_input()`:
   - After calling `self._client.query(text)`, set `_new_query` to wake the pump loop

3. In `AgentSessionManager._run_session()`:
   - When `_persistent` mode ends (idle timeout or explicit disconnect), THEN do the teardown (pop from `_sessions`, release set_lock, etc.)
   - Do NOT pop from `_sessions` after `session.run()` returns if the session is persistent and idle
   - Add idle timeout: start a background task that waits `IDLE_TIMEOUT_S` (configurable, default 300s / 5 min). If no new query arrives, call `session.interrupt()` and clean up

4. In `AgentSessionManager`:
   - Add `continue_session(run_id, text)` method that:
     - Checks if `run_id` is in `_sessions` and session is idle
     - If yes, calls `session.send_input(text)` which wakes the pump
     - Returns True (reused)
     - If not in `_sessions`, returns False (caller must start new run)
   - Add `_idle_timeouts: dict[UUID, asyncio.Task]` to track per-session timeout tasks
   - On new query arrival, cancel the idle timeout task and start a fresh one

5. In `chat_service.send_message()`:
   - Before starting a brand new `mgr.start_run()`, try `mgr.continue_session(chat.active_run_id, prompt)`:
     - If it returns True, the existing session received the message; skip `start_run`
     - If False (session expired/not found), do `start_run()` as before, but pass `persistent=True`
   - Modify `start_run` to accept an optional `persistent` kwarg, forwarded to `AgentSession.__init__`

6. Add `"idle"` to the `AgentRun.status` conceptual vocabulary. The DB already uses a string field so no migration is needed, but update the `_ACTIVE_STATES` tuple in `session_manager.py` to include `"idle"` so orphan sweep does not reap idle sessions.

**What NOT to do:**
- Do NOT change `AgentSession.__aexit__` behavior -- it must still call `disconnect()`. The persistent loop exits naturally, then `__aexit__` runs as normal.
- Do NOT change `EventBus.close_channel` timing -- the channel should only close when the session truly terminates (after idle timeout or explicit disconnect), not after each response.
- Do NOT modify any alembic migrations. The status field is a plain string and "idle" requires no schema change.
- Do NOT change the `ResultMessage` handling in the non-persistent (one-shot) path. The new behavior is gated behind the `_persistent` flag.

### Verification

```bash
cd /home/kek/Projects/RAPID/web/backend
# Unit tests for the new endpoint
python -m pytest tests/ -x -q -k "chat_for_run or persistent_session or continue_session" --tb=short 2>&1 | head -40

# Existing tests still pass
python -m pytest tests/ -x -q --tb=short 2>&1 | tail -10
```

### Done criteria

- `POST /api/agents/runs/{run_id}/chat` returns a `ChatResponse` (201 for new, 200 for existing)
- `chat_service.send_message` reuses an idle persistent session when available
- Idle sessions auto-disconnect after 5 minutes of inactivity
- All existing agent and chat tests still pass
- Orphan sweep does not reap idle sessions

---

## Task 2 -- Frontend: Chat buttons on AgentsPage and AgentRunPage

### Files to modify

- `web/frontend/src/pages/AgentsPage.tsx` -- add Chat action column to DataTable
- `web/frontend/src/pages/AgentRunPage.tsx` -- add Chat button in header actions
- `web/frontend/src/types/agents.ts` -- add `AgentRunStatus` "idle" if not already present

### Action

**2a. AgentsPage -- Chat action column**

Add a new column to the `columns` array in `AgentsPage.tsx`:
```tsx
{
  id: "actions",
  header: "",
  cell: (row) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // prevent row click navigation
        handleChatForRun(row.id);
      }}
      className="px-2 py-1 text-xs rounded border border-border text-muted hover:text-accent hover:border-accent transition-colors"
      title="Open chat for this run"
    >
      Chat
    </button>
  ),
}
```

Add the `handleChatForRun` function:
```tsx
const handleChatForRun = async (runId: string) => {
  try {
    const chat = await apiClient.post<{ id: string }>(`/agents/runs/${runId}/chat`, {});
    navigate(`/chats/${chat.id}`);
  } catch (err) {
    console.error("Failed to create/find chat for run:", err);
  }
};
```

Import `apiClient` at the top of the file.

**2b. AgentRunPage -- Chat button in header actions**

Add a "Chat" button next to the existing Pause/Stop buttons in the `actions` prop of `PageHeader`:
```tsx
<button
  type="button"
  onClick={async () => {
    if (!runId) return;
    try {
      const chat = await apiClient.post<{ id: string }>(`/agents/runs/${runId}/chat`, {});
      navigate(`/chats/${chat.id}`);
    } catch (err) {
      console.error("Failed to open chat:", err);
    }
  }}
  className="px-3 py-1.5 text-sm rounded border border-accent text-accent hover:bg-accent/10"
>
  Chat
</button>
```

Import `useNavigate` from `react-router` (already imported) and `apiClient` from `@/lib/apiClient` (already imported).

**2c. AgentRunStatus type**

Check if `AgentRunStatus` in `web/frontend/src/types/agents.ts` includes `"idle"`. If not, add it. Also add the status tone/label mappings in both pages for the "idle" status:
- Tone: `"muted"` (same as pending)
- Label: `"IDLE"`

**What NOT to do:**
- Do NOT add a full composer/chat UI to AgentRunPage. The "Chat" button navigates to `/chats/{threadId}` which already has the full chat UI.
- Do NOT change the row click behavior in AgentsPage. The Chat button is a separate action column, row click still goes to `/agents/{runId}`.
- Do NOT add client-side polling for session state. The SSE stream already handles live updates.

### Verification

```bash
cd /home/kek/Projects/RAPID/web/frontend
npx tsc --noEmit 2>&1 | tail -20
```

### Done criteria

- AgentsPage DataTable has a "Chat" action button in each row
- Clicking Chat calls `POST /api/agents/runs/{runId}/chat` and navigates to `/chats/{threadId}`
- AgentRunPage header has a "Chat" button that does the same
- Both pages handle the "idle" status with appropriate badge styling
- No TypeScript compilation errors

---

## Task 3 -- Integration tests + manual verification

### Files to create

- `web/backend/tests/agents/test_persistent_session.py` -- tests for persistent session lifecycle
- `web/backend/tests/test_chat_for_run.py` -- tests for the find-or-create endpoint

### Action

Write focused tests:

**3a. `test_chat_for_run.py`:**
- Test that `POST /api/agents/runs/{run_id}/chat` creates a new chat thread when none exists
- Test that calling the endpoint again for the same run returns the same chat thread (idempotent)
- Test that when a `ChatMessage` with `agent_run_id` exists, the existing chat is found via reverse lookup
- Test 404 when `run_id` does not exist

**3b. `test_persistent_session.py`:**
- Test that `AgentSession` with `persistent=True` does not call `disconnect()` after `ResultMessage`
- Test that `send_input()` on a persistent idle session resumes the message pump
- Test that idle timeout triggers disconnect after the configured interval
- Test that `continue_session()` returns True for idle sessions and False for non-existent ones
- Test backward compatibility: `persistent=False` (default) behaves exactly as before

**What NOT to do:**
- Do NOT write E2E browser tests. The manual verification step covers the UI flow.
- Do NOT mock the entire ClaudeSDKClient -- mock at the transport layer so the client logic is exercised.

### Verification

```bash
cd /home/kek/Projects/RAPID/web/backend
python -m pytest tests/test_chat_for_run.py tests/agents/test_persistent_session.py -x -v --tb=short 2>&1 | tail -30
```

### Done criteria

- All new tests pass
- All existing tests still pass
- Coverage: endpoint idempotency, session persistence, idle timeout, backward compat
