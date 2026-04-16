import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SkillLauncher } from "../SkillLauncher";
import type { SkillMeta, PreconditionCheckResponse } from "@/types/skills";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// We mock the apiClient module so hooks and direct calls use our stubs.
vi.mock("@/lib/apiClient", () => {
  const get = vi.fn();
  const post = vi.fn();
  const apiClient = Object.assign(vi.fn(), { get, post, delete: vi.fn(), put: vi.fn(), patch: vi.fn() });
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

import { apiClient, ApiError } from "@/lib/apiClient";

const mockGet = apiClient.get as Mock;
const mockPost = apiClient.post as Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAN_SET_META: SkillMeta = {
  name: "plan-set",
  description: "Plan all waves in a set",
  args: [
    {
      name: "set",
      type: "set-ref",
      description: "Target set name",
      required: true,
    },
    {
      name: "verbose",
      type: "bool",
      description: "Enable verbose output",
      required: false,
      default: false,
    },
  ],
  categories: ["autonomous"],
  allowedTools: "Read,Write,Bash",
  sourcePath: "/skills/plan-set/SKILL.md",
};

const OK_PRECONDITIONS: PreconditionCheckResponse = { ok: true, blockers: [] };

const BLOCKED_PRECONDITIONS: PreconditionCheckResponse = {
  ok: false,
  blockers: [
    { code: "NO_PLAN", message: "No plan exists for this set" },
    { code: "BAD_SET", message: "Invalid set reference", arg: "set" },
  ],
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: skill endpoint returns plan-set meta
    mockGet.mockImplementation((path: string) => {
      if (path.includes("/skills/plan-set")) return Promise.resolve(PLAN_SET_META);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    // Default: preconditions ok
    mockPost.mockImplementation((path: string) => {
      if (path.includes("check-preconditions"))
        return Promise.resolve(OK_PRECONDITIONS);
      if (path.includes("/agents/runs"))
        return Promise.resolve({ id: "run-123" });
      return Promise.reject(new Error(`Unexpected POST ${path}`));
    });
  });

  it("renders args from catalog fetch", async () => {
    render(
      <SkillLauncher
        skillName="plan-set"
        projectId="proj-1"
        onDispatched={vi.fn()}
        onCancel={vi.fn()}
      />,
      { wrapper },
    );

    // Wait for the skill to fully load (description appears once data arrives)
    await waitFor(() => {
      expect(screen.getByText("Plan all waves in a set")).toBeInTheDocument();
    });

    // Required arg "set" should be visible (arg label)
    expect(screen.getByText("set")).toBeInTheDocument();
  });

  it("disables submit while blockers exist", async () => {
    mockPost.mockImplementation((path: string) => {
      if (path.includes("check-preconditions"))
        return Promise.resolve(BLOCKED_PRECONDITIONS);
      return Promise.resolve({ id: "run-123" });
    });

    render(
      <SkillLauncher
        skillName="plan-set"
        projectId="proj-1"
        onDispatched={vi.fn()}
        onCancel={vi.fn()}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText("Plan all waves in a set")).toBeInTheDocument();
    });

    // Wait for precondition check to populate blockers
    await waitFor(() => {
      expect(screen.getByText("Cannot launch")).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: /launch/i });
    expect(submitBtn).toBeDisabled();
  });

  it("inline blocker renders under named arg", async () => {
    mockPost.mockImplementation((path: string) => {
      if (path.includes("check-preconditions"))
        return Promise.resolve(BLOCKED_PRECONDITIONS);
      return Promise.resolve({ id: "run-123" });
    });

    render(
      <SkillLauncher
        skillName="plan-set"
        projectId="proj-1"
        onDispatched={vi.fn()}
        onCancel={vi.fn()}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText("Plan all waves in a set")).toBeInTheDocument();
    });

    // The arg-specific blocker for "set" should appear
    await waitFor(() => {
      expect(screen.getByText("Invalid set reference")).toBeInTheDocument();
    });
  });

  it("submit posts to /api/agents/runs and fires onDispatched with run_id", async () => {
    const onDispatched = vi.fn();

    render(
      <SkillLauncher
        skillName="plan-set"
        projectId="proj-1"
        onDispatched={onDispatched}
        onCancel={vi.fn()}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText("Plan all waves in a set")).toBeInTheDocument();
    });

    // Wait for preconditions to resolve (ok)
    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /launch/i });
      expect(submitBtn).not.toBeDisabled();
    });

    const submitBtn = screen.getByRole("button", { name: /launch/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onDispatched).toHaveBeenCalledWith("run-123");
    });

    // Verify the POST was made to the correct endpoint
    const runPostCalls = mockPost.mock.calls.filter(
      (args: unknown[]) => args[0] === "/agents/runs",
    );
    expect(runPostCalls.length).toBe(1);
    const body = runPostCalls[0]![1] as Record<string, unknown>;
    expect(body.project_id).toBe("proj-1");
    expect(body.skill_name).toBe("plan-set");
  });

  it("handles 400 precondition race", async () => {
    const onDispatched = vi.fn();

    // Hard precondition check on submit returns blockers
    let callCount = 0;
    mockPost.mockImplementation((path: string) => {
      if (path.includes("check-preconditions")) {
        callCount++;
        // First calls (from debounced hook) return ok
        // The hard re-check on submit also returns ok initially
        return Promise.resolve(OK_PRECONDITIONS);
      }
      if (path.includes("/agents/runs")) {
        // But the runs endpoint returns a 400
        throw new (ApiError as unknown as new (s: number, d: string) => Error)(
          400,
          JSON.stringify({ blockers: [{ code: "RACE", message: "Set was deleted" }] }),
        );
      }
      return Promise.reject(new Error(`Unexpected POST ${path}`));
    });

    render(
      <SkillLauncher
        skillName="plan-set"
        projectId="proj-1"
        onDispatched={onDispatched}
        onCancel={vi.fn()}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByText("Plan all waves in a set")).toBeInTheDocument();
    });

    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /launch/i });
      expect(submitBtn).not.toBeDisabled();
    });

    const submitBtn = screen.getByRole("button", { name: /launch/i });
    fireEvent.click(submitBtn);

    // onDispatched should NOT have been called
    await waitFor(() => {
      expect(screen.getByText("Cannot launch")).toBeInTheDocument();
    });
    expect(onDispatched).not.toHaveBeenCalled();
  });
});
