/**
 * TypeScript types mirroring the backend Pydantic schemas from
 * web/backend/app/schemas/dashboard.py (Wave 1 T5).
 */

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
