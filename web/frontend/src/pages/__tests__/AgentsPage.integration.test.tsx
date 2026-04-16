import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { AgentsPage } from "../AgentsPage";
import type { SkillMeta } from "@/types/skills";
import type { AgentRunListResponse } from "@/types/agents";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/apiClient", () => {
  const get = vi.fn();
  const post = vi.fn();
  const apiClient = Object.assign(vi.fn(), {
    get,
    post,
    delete: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  });
  class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.name = "ApiError";
      this.status = status;
      this.detail = detail;
    }
  }
  return { apiClient, ApiError };
});

vi.mock("@/stores/projectStore", () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: "proj-test-1" }),
}));

vi.mock("@/stores/statusStore", () => {
  let state = {
    runs: { running: 2, waiting: 1, failed: 0, completed: 5 },
    chats: null,
    kanban: null,
    budget: null,
    recentRuns: [],
    recentThreads: [],
    recentActivity: [],
    lastSyncedAt: null,
    lastError: null,
    setDashboard: vi.fn(),
    setLastError: vi.fn(),
    reset: vi.fn(),
  };
  return {
    useStatusStore: (selector: (s: typeof state) => unknown) => selector(state),
    __setState: (partial: Partial<typeof state>) => {
      state = { ...state, ...partial };
    },
  };
});

vi.mock("@/hooks/useDashboard", () => ({
  useDashboard: vi.fn(),
}));

import { apiClient } from "@/lib/apiClient";

const mockGet = apiClient.get as Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAN_SET: SkillMeta = {
  name: "plan-set",
  description: "Plan all waves",
  args: [],
  categories: ["autonomous"],
  allowedTools: "Read,Write",
  sourcePath: "/skills/plan-set/SKILL.md",
};

const DISCUSS_SET: SkillMeta = {
  name: "discuss-set",
  description: "Interactive discussion",
  args: [],
  categories: ["interactive"],
  allowedTools: "Read",
  sourcePath: "/skills/discuss-set/SKILL.md",
};

const REVIEW: SkillMeta = {
  name: "review",
  description: "Review a set",
  args: [],
  categories: ["human-in-loop"],
  allowedTools: "Read",
  sourcePath: "/skills/review/SKILL.md",
};

const ALL_SKILLS: SkillMeta[] = [PLAN_SET, DISCUSS_SET, REVIEW];

const MOCK_RUNS: AgentRunListResponse = {
  items: [
    {
      id: "run-1",
      project_id: "proj-test-1",
      set_id: "my-set",
      skill_name: "plan-set",
      status: "running",
      pid: 123,
      started_at: "2026-01-01T10:00:00Z",
      ended_at: null,
      active_duration_s: 120,
      total_wall_clock_s: 130,
      total_cost_usd: 0.0042,
      max_turns: 100,
      turn_count: 5,
      error_code: null,
      last_seq: 10,
    },
    {
      id: "run-2",
      project_id: "proj-test-1",
      set_id: null,
      skill_name: "discuss-set",
      status: "completed",
      pid: null,
      started_at: "2026-01-01T09:00:00Z",
      ended_at: "2026-01-01T09:30:00Z",
      active_duration_s: 1800,
      total_wall_clock_s: 1800,
      total_cost_usd: 0.15,
      max_turns: 50,
      turn_count: 20,
      error_code: null,
      last_seq: 50,
    },
    {
      id: "run-3",
      project_id: "proj-test-1",
      set_id: "other-set",
      skill_name: "review",
      status: "failed",
      pid: null,
      started_at: "2026-01-01T08:00:00Z",
      ended_at: "2026-01-01T08:05:00Z",
      active_duration_s: 300,
      total_wall_clock_s: 300,
      total_cost_usd: 0.005,
      max_turns: 25,
      turn_count: 3,
      error_code: "TIMEOUT",
      last_seq: 5,
    },
  ],
  total: 3,
};

const EMPTY_RUNS: AgentRunListResponse = { items: [], total: 0 };

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/agents"]}>
        <AgentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentsPage integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((path: string) => {
      if (path === "/skills") return Promise.resolve(ALL_SKILLS);
      if (path.startsWith("/agents/runs"))
        return Promise.resolve(MOCK_RUNS);
      if (path.startsWith("/dashboard"))
        return Promise.resolve({
          runs_summary: { running: 2, waiting: 1, failed: 0, completed: 5, recent: [] },
          chats_summary: { active: 0, idle: 0, archived: 0, recent: [] },
          kanban_summary: { total: 0, in_progress: 0, blocked: 0 },
          budget_remaining: { daily_cap: 10, spent_today: 1, remaining: 9 },
          recent_activity: [],
        });
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
  });

  it("renders page header with Launch New Run button", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    });
    expect(screen.getByText("Launch New Run")).toBeInTheDocument();
  });

  it("renders stat card grid from statusStore", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Running")).toBeInTheDocument();
    });
    expect(screen.getByText("2")).toBeInTheDocument(); // running count
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders data table rows from useAgentRuns", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("plan-set")).toBeInTheDocument();
    });
    expect(screen.getByText("discuss-set")).toBeInTheDocument();
    expect(screen.getByText("review")).toBeInTheDocument();
  });

  it("status badge has color and label (status_pill_color_and_label)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("RUNNING")).toBeInTheDocument();
    });
    // Running badge should have accent tone class
    const badge = screen.getByText("RUNNING");
    expect(badge.closest("span")).toHaveClass("text-accent");

    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("FAILED")).toBeInTheDocument();
  });

  it("shows empty state when no runs", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/skills") return Promise.resolve(ALL_SKILLS);
      if (path.startsWith("/agents/runs"))
        return Promise.resolve(EMPTY_RUNS);
      if (path.startsWith("/dashboard"))
        return Promise.resolve({
          runs_summary: { running: 0, waiting: 0, failed: 0, completed: 0, recent: [] },
          chats_summary: { active: 0, idle: 0, archived: 0, recent: [] },
          kanban_summary: { total: 0, in_progress: 0, blocked: 0 },
          budget_remaining: { daily_cap: 10, spent_today: 0, remaining: 10 },
          recent_activity: [],
        });
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No agent runs yet")).toBeInTheDocument();
    });
  });

  it("search input filters rows by skill name", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("plan-set")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Filter runs...");
    fireEvent.change(searchInput, { target: { value: "plan" } });

    expect(screen.getByText("plan-set")).toBeInTheDocument();
    expect(screen.queryByText("discuss-set")).not.toBeInTheDocument();
    expect(screen.queryByText("review")).not.toBeInTheDocument();
  });

  it("Launch New Run button opens gallery", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Launch New Run")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Launch New Run"));
    // Gallery modal should open with skill cards
    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument();
    });
  });
});
