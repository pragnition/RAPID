# Quick Task 28: agent-chat-and-persistent-sessions

**Description:** Add Chat buttons to AgentsPage and AgentRunPage for chatting with any agent. Implement persistent agent sessions so the Claude SDK subprocess stays alive between messages.

**Date:** 2026-04-17
**Status:** COMPLETE
**Commits:** bc575b0, d3bcd66, b9ba6da
**Files Modified:**
- web/backend/app/agents/session.py
- web/backend/app/agents/session_manager.py
- web/backend/app/routers/agents.py
- web/backend/app/services/agent_service.py
- web/backend/app/services/chat_service.py
- web/frontend/src/pages/AgentsPage.tsx
- web/frontend/src/pages/AgentRunPage.tsx
- web/frontend/src/types/agents.ts
- web/backend/tests/test_chat_for_run.py (new)
- web/backend/tests/agents/test_persistent_session.py (new)

## Key Changes

### Backend
1. **`POST /api/agents/runs/{run_id}/chat`** — idempotent endpoint that finds or creates a chat thread for an agent run (3-level lookup: active_run_id → ChatMessage.agent_run_id → create new)
2. **Persistent sessions** — `AgentSession` now supports `persistent=True` mode: after ResultMessage, the session transitions to "idle" instead of disconnecting, and waits for new input. The Claude SDK subprocess stays alive.
3. **`continue_session(run_id, text)`** — manager method to reuse an idle persistent session instead of spawning a new process
4. **Idle timeout** — persistent sessions auto-disconnect after 5 minutes of inactivity
5. **Chat service reuse** — `send_message()` tries `continue_session()` before `start_run()`

### Frontend
1. **Chat button column** on AgentsPage DataTable (per-row)
2. **Chat button** in AgentRunPage header (next to Pause/Stop)
3. **"idle" status** added to AgentRunStatus type and badge mappings

### Investigation: Keeping agents "open"
**Answer: YES** — The `ClaudeSDKClient` from `claude_agent_sdk` is explicitly designed for multi-turn bidirectional conversations. You can call `query()` multiple times after each `receive_response()` completes. The connection stays alive until `disconnect()`. This is now implemented in the persistent session mode.
