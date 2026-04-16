import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { AgentsPage } from "../AgentsPage";
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

const PLAN_SET: SkillMeta = {
  name: "plan-set",
  description: "Plan all waves in a set",
  args: [
    { name: "set", type: "set-ref", description: "Target set", required: true },
  ],
  categories: ["autonomous"],
  allowedTools: "Read,Write,Bash",
  sourcePath: "/skills/plan-set/SKILL.md",
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

const ALL_SKILLS: SkillMeta[] = [PLAN_SET, DISCUSS_SET, REVIEW];

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
    const skillsByName: Record<string, SkillMeta> = {
      "plan-set": PLAN_SET,
      "discuss-set": DISCUSS_SET,
      "review": REVIEW,
    };
    mockGet.mockImplementation((path: string) => {
      if (path === "/skills") return Promise.resolve(ALL_SKILLS);
      // Single skill fetches for launcher: /skills/{name}
      const match = path.match(/^\/skills\/(.+)$/);
      if (match && skillsByName[match[1]]) return Promise.resolve(skillsByName[match[1]]);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    mockPost.mockImplementation((path: string) => {
      if (path.includes("check-preconditions"))
        return Promise.resolve({ ok: true, blockers: [] });
      if (path.includes("/agents/runs"))
        return Promise.resolve({ id: "run-abc-123" });
      return Promise.reject(new Error(`Unexpected POST ${path}`));
    });
  });

  it("shows autonomous and human-in-loop skills by default, hides interactive", async () => {
    renderPage();

    // Wait for skills to load
    await waitFor(() => {
      expect(screen.getByText("plan-set")).toBeInTheDocument();
    });

    // plan-set is autonomous -- should be visible
    expect(screen.getByText("plan-set")).toBeInTheDocument();

    // review is human-in-loop -- should be visible
    expect(screen.getByText("review")).toBeInTheDocument();

    // discuss-set is interactive -- should NOT be visible with default filters
    expect(screen.queryByText("discuss-set")).not.toBeInTheDocument();
  });

  it("'All skills' toggle reveals hidden interactive skills", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("plan-set")).toBeInTheDocument();
    });

    // discuss-set not visible initially
    expect(screen.queryByText("discuss-set")).not.toBeInTheDocument();

    // Click "All skills" toggle
    const allSkillsBtn = screen.getByRole("button", { name: "All skills" });
    fireEvent.click(allSkillsBtn);

    // Now discuss-set should be visible
    await waitFor(() => {
      expect(screen.getByText("discuss-set")).toBeInTheDocument();
    });
  });

  it("clicking a skill card opens RunLauncher modal", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("plan-set")).toBeInTheDocument();
    });

    // Click the plan-set card
    fireEvent.click(screen.getByText("plan-set"));

    // RunLauncher modal should open and skill detail should load,
    // showing the Launch button once data resolves
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /launch/i })).toBeInTheDocument();
    });

    // Cancel button should also be available in the modal
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});
