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

// ---------------------------------------------------------------------------
// State View
// ---------------------------------------------------------------------------

export interface SetState {
  id: string;
  status: string;
  waves: Record<string, unknown>[];
}

export interface MilestoneState {
  id: string;
  name: string;
  sets: SetState[];
}

export interface ProjectState {
  version: number;
  project_name: string;
  current_milestone: string | null;
  milestones: MilestoneState[];
}

// ---------------------------------------------------------------------------
// Worktree View
// ---------------------------------------------------------------------------

export interface WorktreeInfo {
  set_name: string;
  branch: string;
  path: string;
  phase: string;
  status: string;
  wave: number | null;
  created_at: string | null;
  solo: boolean;
  merge_status: string | null;
  merged_at: string | null;
  merge_commit: string | null;
}

export interface WorktreeRegistry {
  version: number;
  worktrees: WorktreeInfo[];
}

// ---------------------------------------------------------------------------
// DAG View
// ---------------------------------------------------------------------------

export interface DagNode {
  id: string;
  wave: number;
  status: string;
}

export interface DagEdge {
  source: string;
  target: string;
}

export interface DagWave {
  sets: string[];
  checkpoint: Record<string, unknown>;
}

export interface DagGraph {
  nodes: DagNode[];
  edges: DagEdge[];
  waves: Record<string, DagWave>;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Codebase View
// ---------------------------------------------------------------------------

export interface CodeSymbol {
  name: string;
  kind: string;
  start_line: number;
  end_line: number;
  children: CodeSymbol[];
}

export interface CodeFile {
  path: string;
  language: string;
  symbols: CodeSymbol[];
}

export interface CodebaseTree {
  files: CodeFile[];
  languages: string[];
  total_files: number;
  parse_errors: string[];
}
