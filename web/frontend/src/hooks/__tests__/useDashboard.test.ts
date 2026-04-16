import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useStatusStore } from "@/stores/statusStore";
import type { DashboardResponse } from "@/types/dashboard";

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

import { apiClient } from "@/lib/apiClient";
import { useDashboard } from "../useDashboard";

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DASHBOARD: DashboardResponse = {
  runs_summary: {
    running: 1,
    waiting: 0,
    failed: 0,
    completed: 3,
    recent: [{ id: "r1", skill_name: "plan-set", status: "running", started_at: "2026-04-16T10:00:00Z" }],
  },
  chats_summary: {
    active: 2,
    idle: 0,
    archived: 1,
    recent: [{ id: "c1", title: "Chat 1", skill_name: "discuss-set", last_message_at: "2026-04-16T10:00:00Z", session_status: "active" }],
  },
  kanban_summary: { total: 5, in_progress: 2, blocked: 0 },
  budget_remaining: { daily_cap: 50, spent_today: 10, remaining: 40 },
  recent_activity: [{ kind: "run" as const, id: "r1", title: "plan-set", status: "running", ts: "2026-04-16T10:00:00Z" }],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStatusStore.getState().reset();
  });

  it("fetches dashboard with project_id", async () => {
    mockGet.mockResolvedValueOnce(DASHBOARD);

    const { result } = renderHook(
      () => useDashboard("proj-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith("/dashboard?project_id=proj-1");
  });

  it("is disabled when projectId is null", () => {
    renderHook(() => useDashboard(null), { wrapper: createWrapper() });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("writes snapshot to statusStore on success", async () => {
    mockGet.mockResolvedValueOnce(DASHBOARD);

    const { result } = renderHook(
      () => useDashboard("proj-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const state = useStatusStore.getState();
    expect(state.runs).toEqual({ running: 1, waiting: 0, failed: 0, completed: 3 });
    expect(state.chats).toEqual({ active: 2, idle: 0, archived: 1 });
    expect(state.kanban).toEqual({ total: 5, in_progress: 2, blocked: 0 });
    expect(state.budget).toEqual({ daily_cap: 50, spent_today: 10, remaining: 40 });
    expect(state.recentRuns).toHaveLength(1);
    expect(state.recentThreads).toHaveLength(1);
    expect(state.lastSyncedAt).not.toBeNull();
  });

  it("writes error to statusStore on failure", async () => {
    const { ApiError } = await import("@/lib/apiClient");
    mockGet.mockRejectedValueOnce(new ApiError(500, "Internal Server Error"));

    const { result } = renderHook(
      () => useDashboard("proj-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(useStatusStore.getState().lastError).toBe("Internal Server Error");
  });
});
