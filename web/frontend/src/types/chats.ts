/**
 * TypeScript types mirroring the backend Pydantic schemas from
 * web/backend/app/schemas/chats.py (Wave 1 T4).
 */

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
  created_at: string; // ISO-8601
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
