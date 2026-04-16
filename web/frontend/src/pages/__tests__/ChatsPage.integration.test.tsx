import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { ChatsPage } from "../ChatsPage";
import type { SkillMeta } from "@/types/skills";
import type { ChatListResponse } from "@/types/chats";

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
    runs: null,
    chats: { active: 3, idle: 1, archived: 2 },
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
  };
});

vi.mock("@/hooks/useDashboard", () => ({
  useDashboard: vi.fn(),
}));

import { apiClient } from "@/lib/apiClient";

const mockGet = apiClient.get as Mock;
const mockPost = apiClient.post as Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DISCUSS_SET: SkillMeta = {
  name: "discuss-set",
  description: "Interactive discussion",
  args: [],
  categories: ["interactive"],
  allowedTools: "Read",
  sourcePath: "/skills/discuss-set/SKILL.md",
};

const QUICK: SkillMeta = {
  name: "quick",
  description: "Quick changes",
  args: [],
  categories: ["interactive"],
  allowedTools: "Read,Write",
  sourcePath: "/skills/quick/SKILL.md",
};

const ALL_SKILLS: SkillMeta[] = [DISCUSS_SET, QUICK];

const MOCK_THREADS: ChatListResponse = {
  items: [
    {
      id: "thread-1",
      project_id: "proj-test-1",
      skill_name: "discuss-set",
      title: "Planning discussion",
      session_status: "active",
      created_at: "2026-01-01T10:00:00Z",
      last_message_at: "2026-01-01T11:00:00Z",
      archived_at: null,
    },
    {
      id: "thread-2",
      project_id: "proj-test-1",
      skill_name: "quick",
      title: "Quick fix for navbar",
      session_status: "idle",
      created_at: "2026-01-01T08:00:00Z",
      last_message_at: "2026-01-01T08:30:00Z",
      archived_at: null,
    },
  ],
  total: 2,
};

const EMPTY_THREADS: ChatListResponse = { items: [], total: 0 };

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/chats"]}>
        <ChatsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatsPage integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((path: string) => {
      if (path === "/skills") return Promise.resolve(ALL_SKILLS);
      if (path.startsWith("/chats"))
        return Promise.resolve(MOCK_THREADS);
      if (path.startsWith("/dashboard"))
        return Promise.resolve({
          runs_summary: { running: 0, waiting: 0, failed: 0, completed: 0, recent: [] },
          chats_summary: { active: 3, idle: 1, archived: 2, recent: [] },
          kanban_summary: { total: 0, in_progress: 0, blocked: 0 },
          budget_remaining: { daily_cap: 10, spent_today: 0, remaining: 10 },
          recent_activity: [],
        });
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    mockPost.mockImplementation((path: string) => {
      if (path === "/chats")
        return Promise.resolve({
          id: "thread-new",
          project_id: "proj-test-1",
          skill_name: "discuss-set",
          title: "New thread",
          session_status: "active",
          created_at: "2026-01-01T12:00:00Z",
          last_message_at: "2026-01-01T12:00:00Z",
          archived_at: null,
        });
      return Promise.reject(new Error(`Unexpected POST ${path}`));
    });
  });

  it("renders page header with New Chat button", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Chats" })).toBeInTheDocument();
    });
    expect(screen.getByText("New Chat")).toBeInTheDocument();
  });

  it("renders stat card grid from statusStore", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
    expect(screen.getByText("3")).toBeInTheDocument(); // active count
    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("renders thread table rows", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Planning discussion")).toBeInTheDocument();
    });
    expect(screen.getByText("Quick fix for navbar")).toBeInTheDocument();
  });

  it("shows empty state when no threads", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/skills") return Promise.resolve(ALL_SKILLS);
      if (path.startsWith("/chats"))
        return Promise.resolve(EMPTY_THREADS);
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
      expect(screen.getByText("No chat threads yet")).toBeInTheDocument();
    });
  });

  it("show archived toggle is present", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Show archived")).toBeInTheDocument();
    });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("New Chat button opens skill gallery filtered to interactive", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("New Chat"));
    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument();
    });
  });
});
