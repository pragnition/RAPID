import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { AgentsEmptyState } from "../AgentsEmptyState";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/apiClient", () => {
  const get = vi.fn().mockResolvedValue([]);
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

function renderComponent() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AgentsEmptyState />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentsEmptyState", () => {
  it("renders title and description", () => {
    renderComponent();
    expect(screen.getByText("No agent runs yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Agents run autonomously/),
    ).toBeInTheDocument();
  });

  it("description mentions both agents and chats (distinction explanation)", () => {
    renderComponent();
    const desc = screen.getByText(/Agents run autonomously/);
    expect(desc.textContent?.toLowerCase()).toContain("agents");
    expect(desc.textContent?.toLowerCase()).toContain("chats");
  });

  it("renders three action cards", () => {
    renderComponent();
    expect(screen.getByText("/rapid:status")).toBeInTheDocument();
    expect(screen.getByText("/rapid:plan-set")).toBeInTheDocument();
    expect(screen.getByText("/rapid:execute-set")).toBeInTheDocument();
  });
});
