/**
 * Discriminated-union SSE event types mirroring
 * web/backend/app/schemas/sse_events.py.
 *
 * All 10 event kinds are represented. Use exhaustive switch/case with the
 * `kind` discriminator for type-safe event handling.
 */

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
  ts: string; // ISO-8601
  run_id: string;
}

export interface AssistantTextEvent extends BaseSseEvent {
  kind: "assistant_text";
  text: string;
}

export interface ThinkingEvent extends BaseSseEvent {
  kind: "thinking";
  text: string;
}

export interface ToolUseEvent extends BaseSseEvent {
  kind: "tool_use";
  tool_name: string;
  tool_use_id: string;
  input: Record<string, unknown>;
}

export interface ToolResultEvent extends BaseSseEvent {
  kind: "tool_result";
  tool_use_id: string;
  output: unknown;
  is_error: boolean;
}

export interface AskUserEvent extends BaseSseEvent {
  kind: "ask_user";
  prompt_id: string;
  tool_use_id: string;
  question: string;
  options: string[] | null;
  allow_free_text: boolean;
}

export interface PermissionReqEvent extends BaseSseEvent {
  kind: "permission_req";
  tool_name: string;
  tool_use_id: string;
  reason: string;
  blocked: boolean;
}

export interface StatusEvent extends BaseSseEvent {
  kind: "status";
  status:
    | "pending"
    | "running"
    | "waiting"
    | "interrupted"
    | "failed"
    | "completed";
  detail: string | null;
}

export interface RunCompleteEvent extends BaseSseEvent {
  kind: "run_complete";
  status: "completed" | "failed" | "interrupted";
  total_cost_usd: number;
  turn_count: number;
  duration_s: number;
  error_code: string | null;
  error_detail: Record<string, unknown> | null;
}

export interface ReplayTruncatedEvent extends BaseSseEvent {
  kind: "replay_truncated";
  oldest_available_seq: number;
  requested_since_seq: number;
  reason: "retention_cap" | "archived";
}

export interface RetentionWarningEvent extends BaseSseEvent {
  kind: "retention_warning";
  event_count: number;
  cap: number;
}

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
