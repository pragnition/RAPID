import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { ChatsPage } from "../ChatsPage";
import type { SkillMeta } from "@/types/skills";

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

import { apiClient } from "@/lib/apiClient";

const mockGet = apiClient.get as Mock;
const mockPost = apiClient.post as Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXECUTE_SET: SkillMeta = {
  name: "execute-set",
  description: "Execute all waves in a set",
  args: [
    { name: "set", type: "set-ref", description: "Target set", required: true },
  ],
  categories: ["autonomous"],
  allowedTools: "Read,Write,Bash",
  sourcePath: "/skills/execute-set/SKILL.md",
};

const DISCUSS_SET: SkillMeta = {
  name: "discuss-set",
  description: "Capture set implementation vision",
  args: [
    { name: "set", type: "set-ref", description: "Target set", required: true },
  ],
  categories: ["interactive"],
  allowedTools: "Read,Write",
  sourcePath: "/skills/discuss-set/SKILL.md",
};

const REVIEW: SkillMeta = {
  name: "review",
  description: "Review a completed set",
  args: [],
  categories: ["human-in-loop"],
  allowedTools: "Read",
  sourcePath: "/skills/review/SKILL.md",
};

const ALL_SKILLS: SkillMeta[] = [EXECUTE_SET, DISCUSS_SET, REVIEW];

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
      if (path === "/skills/execute-set") return Promise.resolve(EXECUTE_SET);
      if (path === "/skills/discuss-set") return Promise.resolve(DISCUSS_SET);
      if (path === "/skills/review") return Promise.resolve(REVIEW);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    mockPost.mockImplementation((path: string) => {
      if (path.includes("check-preconditions"))
        return Promise.resolve({ ok: true, blockers: [] });
      if (path.includes("/agents/runs"))
        return Promise.resolve({ id: "run-xyz-789" });
      return Promise.reject(new Error(`Unexpected POST ${path}`));
    });
  });

  it("shows interactive and human-in-loop skills by default, hides autonomous", async () => {
    renderPage();

    // Wait for skills to load
    await waitFor(() => {
      expect(screen.getByText("discuss-set")).toBeInTheDocument();
    });

    // discuss-set is interactive -- should be visible
    expect(screen.getByText("discuss-set")).toBeInTheDocument();

    // review is human-in-loop -- should be visible
    expect(screen.getByText("review")).toBeInTheDocument();

    // execute-set is autonomous -- should NOT be visible with default filters
    expect(screen.queryByText("execute-set")).not.toBeInTheDocument();
  });

  it("'All skills' toggle reveals hidden autonomous skills", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("discuss-set")).toBeInTheDocument();
    });

    // execute-set not visible initially
    expect(screen.queryByText("execute-set")).not.toBeInTheDocument();

    // Click "All skills" toggle
    const allSkillsBtn = screen.getByRole("button", { name: "All skills" });
    fireEvent.click(allSkillsBtn);

    // Now execute-set should be visible
    await waitFor(() => {
      expect(screen.getByText("execute-set")).toBeInTheDocument();
    });
  });

  it("renders 'New Chat' section heading", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("discuss-set")).toBeInTheDocument();
    });

    expect(screen.getByText("New Chat")).toBeInTheDocument();
  });

  it("clicking a skill card opens RunLauncher modal", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("discuss-set")).toBeInTheDocument();
    });

    // Click the discuss-set card
    fireEvent.click(screen.getByText("discuss-set"));

    // RunLauncher modal should open and skill detail should load,
    // showing the Launch button once data resolves
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /launch/i })).toBeInTheDocument();
    });

    // Cancel button should also be available in the modal
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});
