import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { AgentRunPage } from "../AgentRunPage";

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

// Mock useAgentEvents to return controllable events
const mockEvents: import("@/types/sseEvents").SseEvent[] = [];
vi.mock("@/hooks/useAgentEvents", () => ({
  useAgentEvents: () => ({
    events: mockEvents,
    status: "running",
    reconnect: vi.fn(),
    error: null,
    connected: true,
  }),
}));

// Mock usePrefersReducedMotion
let mockReducedMotion = false;
vi.mock("@/components/primitives/hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: () => mockReducedMotion,
}));

import { apiClient } from "@/lib/apiClient";

const mockGet = apiClient.get as Mock;
const mockPost = apiClient.post as Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_RUN = {
  id: "run-abc-123",
  project_id: "proj-test-1",
  set_id: "my-set",
  skill_name: "plan-set",
  status: "running" as const,
  pid: 999,
  started_at: "2026-01-01T10:00:00Z",
  ended_at: null,
  active_duration_s: 120,
  total_wall_clock_s: 130,
  total_cost_usd: 0.0042,
  max_turns: 100,
  turn_count: 5,
  error_code: null,
  last_seq: 10,
};

function renderPage(runId = "run-abc-123") {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/agents/${runId}`]}>
        <Routes>
          <Route path="/agents/:runId" element={<AgentRunPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentRunPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReducedMotion = false;
    mockEvents.length = 0;
    mockGet.mockImplementation((path: string) => {
      if (path.includes("/agents/runs/"))
        return Promise.resolve(MOCK_RUN);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    mockPost.mockResolvedValue({});
  });

  it("renders status badge with color and label", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/RUNNING/).length).toBeGreaterThan(0);
    });
    // The visible StatusBadge (not the sr-only LiveRegion)
    const badges = screen.getAllByText(/RUNNING/);
    const visibleBadge = badges.find(
      (el) => !el.closest('[aria-live]') && el.tagName === "SPAN",
    );
    expect(visibleBadge).toBeDefined();
    expect(visibleBadge?.closest("span")).toHaveClass("text-accent");
  });

  it("does NOT render a composer (no_composer_on_run_detail invariant)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/RUNNING/).length).toBeGreaterThan(0);
    });
    // There should be no textarea
    const textareas = document.querySelectorAll("textarea");
    expect(textareas.length).toBe(0);
  });

  it("renders telemetry table from useAgentRun", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total cost")).toBeInTheDocument();
    });
    expect(screen.getByText("$0.0042")).toBeInTheDocument();
    expect(screen.getByText("Turn count")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders tool call cards for tool_use events", async () => {
    mockEvents.push(
      {
        seq: 1,
        ts: "2026-01-01T10:00:01Z",
        run_id: "run-abc-123",
        kind: "tool_use",
        tool_name: "Read",
        tool_use_id: "tu-1",
        input: { file: "test.ts" },
      },
      {
        seq: 2,
        ts: "2026-01-01T10:00:02Z",
        run_id: "run-abc-123",
        kind: "tool_use",
        tool_name: "Write",
        tool_use_id: "tu-2",
        input: { file: "out.ts", content: "hello" },
      },
    );
    renderPage();
    await waitFor(() => {
      // Use getAllByText since "Read" might also appear in breadcrumb-like text
      const readElements = screen.getAllByText("Read");
      expect(readElements.length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Write")).toBeInTheDocument();
  });

  it("Shift+P sends interrupt request", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/RUNNING/).length).toBeGreaterThan(0);
    });

    fireEvent.keyDown(document, { key: "P", shiftKey: true });
    expect(mockPost).toHaveBeenCalledWith(
      "/agents/runs/run-abc-123/interrupt",
      { type: "pause" },
    );
  });

  it("Shift+S sends interrupt request", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/RUNNING/).length).toBeGreaterThan(0);
    });

    fireEvent.keyDown(document, { key: "S", shiftKey: true });
    expect(mockPost).toHaveBeenCalledWith(
      "/agents/runs/run-abc-123/interrupt",
      { type: "stop" },
    );
  });

  it("prefers reduced motion suppresses pulse animation", async () => {
    mockReducedMotion = true;
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/RUNNING/).length).toBeGreaterThan(0);
    });
    const badges = screen.getAllByText(/RUNNING/);
    const visibleBadge = badges.find(
      (el) => !el.closest('[aria-live]') && el.tagName === "SPAN",
    );
    expect(visibleBadge?.closest("span")?.className).not.toContain("animate-pulse");
  });

  it("live region present for status announcements", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/RUNNING/).length).toBeGreaterThan(0);
    });
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it("renders markdown in activity feed text items", async () => {
    mockEvents.push({
      seq: 1,
      ts: "2026-01-01T10:00:01Z",
      run_id: "run-abc-123",
      kind: "assistant_text",
      text: "**bold text**",
    });
    renderPage();
    await waitFor(() => {
      const strong = document.querySelector("strong");
      expect(strong).toBeInTheDocument();
      expect(strong?.textContent).toBe("bold text");
    });
  });

  it("sanitizes script tags in activity feed text items", async () => {
    mockEvents.push({
      seq: 1,
      ts: "2026-01-01T10:00:01Z",
      run_id: "run-abc-123",
      kind: "assistant_text",
      text: "Safe text <script>alert('xss')</script>",
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Safe text/)).toBeInTheDocument();
    });
    const scripts = document.querySelectorAll("script");
    expect(scripts.length).toBe(0);
  });
});
