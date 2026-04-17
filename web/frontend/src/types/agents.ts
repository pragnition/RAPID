/**
 * TypeScript types mirroring the backend Pydantic schemas from
 * web/backend/app/schemas/agents.py (AgentRunResponse).
 */

export type AgentRunStatus =
  | "pending"
  | "running"
  | "waiting"
  | "idle"
  | "interrupted"
  | "failed"
  | "completed";

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
