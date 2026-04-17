import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { Chat, ChatListResponse, ChatMessage } from "@/types/chats";

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
import { useChats } from "../useChats";

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHAT_1: Chat = {
  id: "chat-1",
  project_id: "proj-test-1",
  skill_name: "discuss-set",
  title: "Discussion",
  session_status: "active",
  created_at: "2026-04-16T10:00:00Z",
  last_message_at: "2026-04-16T10:05:00Z",
  archived_at: null,
};

const CHAT_LIST: ChatListResponse = { items: [CHAT_1], total: 1 };

const MESSAGE_1: ChatMessage = {
  id: "msg-1",
  chat_id: "chat-1",
  seq: 1,
  role: "user",
  content: "Hello",
  tool_calls: [],
  tool_use_id: null,
  agent_run_id: null,
  temp_id: "tmp-1",
  created_at: "2026-04-16T10:05:00Z",
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
  return {
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: qc }, children);
    },
    qc,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useChats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list fetches from /api/chats with project_id", async () => {
    mockGet.mockResolvedValueOnce(CHAT_LIST);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChats(), { wrapper });

    await waitFor(() => expect(result.current.threads).toHaveLength(1));
    expect(mockGet).toHaveBeenCalledWith(
      "/chats?project_id=proj-test-1&include_archived=false",
    );
  });

  it("list honors include_archived flag", async () => {
    mockGet.mockResolvedValueOnce(CHAT_LIST);
    const { wrapper } = createWrapper();

    renderHook(() => useChats({ includeArchived: true }), { wrapper });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/chats?project_id=proj-test-1&include_archived=true",
      );
    });
  });

  it("createThread posts and invalidates list", async () => {
    mockGet.mockResolvedValue(CHAT_LIST);
    mockPost.mockResolvedValueOnce(CHAT_1);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChats(), { wrapper });

    // Wait for initial list load
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    await act(async () => {
      const created = await result.current.createThread({ skillName: "discuss-set", title: "Discussion" });
      expect(created.id).toBe("chat-1");
    });

    expect(mockPost).toHaveBeenCalledWith("/chats", expect.objectContaining({
      project_id: "proj-test-1",
      skill_name: "discuss-set",
      title: "Discussion",
    }));
  });

  it("sendMessage optimistically adds user row", async () => {
    mockGet.mockResolvedValue(CHAT_LIST);
    // Delay the POST response so we can observe the optimistic state
    mockPost.mockImplementation(() => new Promise(() => {}));
    const { wrapper, qc } = createWrapper();

    const { result } = renderHook(() => useChats(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    // Pre-seed the messages cache
    qc.setQueryData(["chat-messages", "chat-1"], []);

    act(() => {
      // Fire and forget -- the promise never resolves
      void result.current.sendMessage({ chatId: "chat-1", content: "Hello", tempId: "tmp-1" });
    });

    // Check that the optimistic row is in the cache
    const cached = qc.getQueryData<ChatMessage[]>(["chat-messages", "chat-1"]);
    expect(cached).toHaveLength(1);
    expect(cached![0].seq).toBe(-1);
    expect(cached![0].temp_id).toBe("tmp-1");
    expect(cached![0].content).toBe("Hello");
    expect(cached![0].role).toBe("user");
  });

  it("sendMessage replaces optimistic row on success", async () => {
    mockGet.mockResolvedValue(CHAT_LIST);
    mockPost.mockResolvedValueOnce(MESSAGE_1);
    const { wrapper, qc } = createWrapper();

    const { result } = renderHook(() => useChats(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    // Pre-seed the messages cache
    qc.setQueryData(["chat-messages", "chat-1"], []);

    await act(async () => {
      const msg = await result.current.sendMessage({ chatId: "chat-1", content: "Hello", tempId: "tmp-1" });
      expect(msg.id).toBe("msg-1");
    });

    // Verify reconciliation replaced optimistic row
    const cached = qc.getQueryData<ChatMessage[]>(["chat-messages", "chat-1"]);
    expect(cached).toHaveLength(1);
    expect(cached![0].id).toBe("msg-1");
    expect(cached![0].seq).toBe(1);
  });

  it("sendMessage removes optimistic row on error", async () => {
    mockGet.mockResolvedValue(CHAT_LIST);
    const { ApiError } = await import("@/lib/apiClient");
    mockPost.mockRejectedValueOnce(new ApiError(500, "Server error"));
    const { wrapper, qc } = createWrapper();

    const { result } = renderHook(() => useChats(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    // Pre-seed the messages cache
    qc.setQueryData(["chat-messages", "chat-1"], []);

    await act(async () => {
      try {
        await result.current.sendMessage({ chatId: "chat-1", content: "Hello", tempId: "tmp-err" });
      } catch {
        // Expected
      }
    });

    const cached = qc.getQueryData<ChatMessage[]>(["chat-messages", "chat-1"]);
    expect(cached).toHaveLength(0);
  });

  it("sendMessage returns server row", async () => {
    mockGet.mockResolvedValue(CHAT_LIST);
    mockPost.mockResolvedValueOnce(MESSAGE_1);
    const { wrapper, qc } = createWrapper();

    const { result } = renderHook(() => useChats(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));
    qc.setQueryData(["chat-messages", "chat-1"], []);

    let returned: ChatMessage | undefined;
    await act(async () => {
      returned = await result.current.sendMessage({ chatId: "chat-1", content: "Hello", tempId: "tmp-1" });
    });

    expect(returned!.id).toBe("msg-1");
    expect(returned!.seq).toBe(1);
  });
});
