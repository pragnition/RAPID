import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import type { Chat, ChatMessage } from "@/types/chats";

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

type Listener = EventListener;

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, Set<Listener>>();
  readyState = 0;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Fire open on next tick
    setTimeout(() => this.fire("open", null), 0);
  }

  addEventListener(kind: string, listener: Listener) {
    if (!this.listeners.has(kind)) this.listeners.set(kind, new Set());
    this.listeners.get(kind)!.add(listener);
  }

  removeEventListener(kind: string, listener: Listener) {
    this.listeners.get(kind)?.delete(listener);
  }

  close = vi.fn();

  fire(kind: string, data: unknown) {
    const event =
      kind === "open"
        ? new Event("open")
        : kind === "error"
          ? new Event("error")
          : new MessageEvent(kind, { data: JSON.stringify(data) });
    this.listeners.get(kind)?.forEach((l) => l(event as Event));
  }
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/stores/projectStore", () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: "proj-test-1" }),
}));

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
import { useChatThread } from "../useChats";

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const THREAD: Chat = {
  id: "chat-1",
  project_id: "proj-1",
  skill_name: "discuss-set",
  title: "Discussion",
  session_status: "active",
  created_at: "2026-04-16T10:00:00Z",
  last_message_at: "2026-04-16T10:05:00Z",
  archived_at: null,
};

const MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    chat_id: "chat-1",
    seq: 1,
    role: "user",
    content: "Hello",
    tool_calls: [],
    tool_use_id: null,
    agent_run_id: null,
    temp_id: null,
    created_at: "2026-04-16T10:05:00Z",
  },
];

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
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as Record<string, unknown>).EventSource = MockEventSource;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useChatThread", () => {
  it("fetches thread detail", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/chats/chat-1") return Promise.resolve(THREAD);
      if (path === "/chats/chat-1/messages") return Promise.resolve(MESSAGES);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChatThread("chat-1"), { wrapper });

    await waitFor(() => expect(result.current.thread).not.toBeNull());
    expect(result.current.thread!.id).toBe("chat-1");
    expect(result.current.thread!.title).toBe("Discussion");
  });

  it("fetches messages", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/chats/chat-1") return Promise.resolve(THREAD);
      if (path === "/chats/chat-1/messages") return Promise.resolve(MESSAGES);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChatThread("chat-1"), { wrapper });

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].id).toBe("msg-1");
  });

  it("opens SSE on mount for chatId", () => {
    mockGet.mockImplementation(() => new Promise(() => {}));
    const { wrapper } = createWrapper();

    renderHook(() => useChatThread("chat-1"), { wrapper });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/chats/chat-1/events");
  });

  it("appends streamed events to stream.events array", async () => {
    mockGet.mockImplementation(() => new Promise(() => {}));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useChatThread("chat-1"), { wrapper });
    const es = MockEventSource.instances[0];

    // Wait for the open event to fire
    await waitFor(() => expect(result.current.stream.connected).toBe(true));

    act(() => {
      es.fire("assistant_text", {
        kind: "assistant_text",
        seq: 1,
        ts: "2026-04-16T10:06:00Z",
        run_id: "run-1",
        text: "World",
      });
    });

    expect(result.current.stream.events).toHaveLength(1);
    expect(result.current.stream.events[0].kind).toBe("assistant_text");
  });

  it("invalidates messages on run_complete", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/chats/chat-1") return Promise.resolve(THREAD);
      if (path === "/chats/chat-1/messages") return Promise.resolve(MESSAGES);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useChatThread("chat-1"), { wrapper });
    const es = MockEventSource.instances[0];

    await waitFor(() => expect(result.current.stream.connected).toBe(true));

    act(() => {
      es.fire("run_complete", {
        kind: "run_complete",
        seq: 10,
        ts: "2026-04-16T10:07:00Z",
        run_id: "run-1",
        status: "completed",
        total_cost_usd: 0.05,
        turn_count: 3,
        duration_s: 60,
        error_code: null,
        error_detail: null,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["chat-messages", "chat-1"],
    });
  });

  it("closes SSE on unmount", async () => {
    mockGet.mockImplementation(() => new Promise(() => {}));
    const { wrapper } = createWrapper();

    const { unmount } = renderHook(() => useChatThread("chat-1"), { wrapper });
    const es = MockEventSource.instances[0];

    unmount();
    expect(es.close).toHaveBeenCalled();
  });
});
