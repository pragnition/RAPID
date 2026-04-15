/**
 * Types for the ask-user prompt bridge (Wave 2 of web-tool-bridge).
 *
 * Mirrors the backend `AgentPrompt` model row + the SSE `ask_user` event
 * payload shipped in Wave 1.
 *
 * See:
 *   - web/backend/app/models/agent_prompt.py
 *   - web/backend/app/schemas/sse_events.py (AskUserSseEventPayload)
 *   - web/backend/app/schemas/agents.py (PendingPromptResponse)
 */

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

/**
 * SSE `ask_user` event payload. Shares the AgentPromptPayload shape and adds
 * stream-level metadata the server tags on the event envelope.
 */
export type AskUserSseEvent = AgentPromptPayload & {
  seq: number;
  ts: string;
  tool_use_id: string;
};
