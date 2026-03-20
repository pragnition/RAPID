export interface ProjectSummary {
  id: string; // UUID as string
  name: string;
  path: string;
  status: string;
  current_milestone: string | null;
  set_count: number;
  registered_at: string; // ISO 8601 datetime
  last_seen_at: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  milestones: Record<string, unknown>[];
  metadata_json: string;
}

export interface ProjectListResponse {
  items: ProjectSummary[];
  total: number;
  page: number;
  per_page: number;
}

export interface ProjectStatusResponse {
  id: string;
  status: string;
  message: string | null;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
}

export interface ReadyResponse {
  status: string;
  database: string;
}

export interface ApiErrorDetail {
  detail: string;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}
