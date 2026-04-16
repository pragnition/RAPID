import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { ChatsEmptyState } from "../ChatsEmptyState";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/apiClient", () => {
  const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
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
        <ChatsEmptyState />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatsEmptyState", () => {
  it("renders title and description", () => {
    renderComponent();
    expect(screen.getByText("No chat threads yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Chats are interactive conversations/),
    ).toBeInTheDocument();
  });

  it("description mentions both chats and agents (distinction explanation)", () => {
    renderComponent();
    const desc = screen.getByText(/Chats are interactive/);
    expect(desc.textContent?.toLowerCase()).toContain("chats");
    expect(desc.textContent?.toLowerCase()).toContain("agents");
  });

  it("renders three action cards", () => {
    renderComponent();
    expect(screen.getByText("/rapid:discuss-set")).toBeInTheDocument();
    expect(screen.getByText("/rapid:quick")).toBeInTheDocument();
    expect(screen.getByText("/rapid:bug-fix")).toBeInTheDocument();
  });
});
