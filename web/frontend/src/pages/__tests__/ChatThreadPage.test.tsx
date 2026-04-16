import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { ChatThreadPage } from "../ChatThreadPage";
import type { Chat, ChatMessage } from "@/types/chats";
import type { SseEvent } from "@/types/sseEvents";

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

// Mock EventSource for SSE
class MockEventSource {
  url: string;
  readyState = 1;
  close = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  constructor(url: string) {
    this.url = url;
  }
}
vi.stubGlobal("EventSource", MockEventSource);

import { apiClient } from "@/lib/apiClient";

const mockGet = apiClient.get as Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_THREAD: Chat = {
  id: "thread-1",
  project_id: "proj-test-1",
  skill_name: "discuss-set",
  title: "Test discussion",
  session_status: "active",
  created_at: "2026-01-01T10:00:00Z",
  last_message_at: "2026-01-01T11:00:00Z",
  archived_at: null,
};

const ARCHIVED_THREAD: Chat = {
  ...MOCK_THREAD,
  session_status: "archived",
  archived_at: "2026-01-01T12:00:00Z",
};

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    chat_id: "thread-1",
    seq: 1,
    role: "user",
    content: "Hello, can you help?",
    tool_calls: [],
    tool_use_id: null,
    agent_run_id: null,
    temp_id: null,
    created_at: "2026-01-01T10:00:00Z",
  },
  {
    id: "msg-2",
    chat_id: "thread-1",
    seq: 2,
    role: "assistant",
    content: "**Sure**, I can help with that.",
    tool_calls: [],
    tool_use_id: null,
    agent_run_id: null,
    temp_id: null,
    created_at: "2026-01-01T10:00:10Z",
  },
];

const XSS_MESSAGES: ChatMessage[] = [
  {
    id: "msg-xss",
    chat_id: "thread-1",
    seq: 1,
    role: "assistant",
    content: "Safe text here.\n\n<script>alert('xss')</script>\n\nMore safe text.",
    tool_calls: [],
    tool_use_id: null,
    agent_run_id: null,
    temp_id: null,
    created_at: "2026-01-01T10:00:00Z",
  },
];

function renderPage(threadId = "thread-1") {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/chats/${threadId}`]}>
        <Routes>
          <Route path="/chats/:threadId" element={<ChatThreadPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatThreadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((path: string) => {
      if (path === "/chats/thread-1")
        return Promise.resolve(MOCK_THREAD);
      if (path === "/chats/thread-1/messages")
        return Promise.resolve(MOCK_MESSAGES);
      if (path === "/skills")
        return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
  });

  it("renders composer at bottom", async () => {
    renderPage();
    await waitFor(() => {
      const textareas = document.querySelectorAll("textarea");
      expect(textareas.length).toBeGreaterThan(0);
    });
  });

  it("renders messages as markdown (bold renders as strong)", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Hello, can you help?")).toBeInTheDocument();
    });
    // The assistant message "**Sure**" should render as <strong>Sure</strong>
    const strong = document.querySelector("strong");
    expect(strong).toBeInTheDocument();
    expect(strong?.textContent).toBe("Sure");
  });

  it("rehype-sanitize strips script tags", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/chats/thread-1")
        return Promise.resolve(MOCK_THREAD);
      if (path === "/chats/thread-1/messages")
        return Promise.resolve(XSS_MESSAGES);
      if (path === "/skills")
        return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    renderPage();
    // The safe text should render
    await waitFor(() => {
      expect(screen.getByText(/Safe text here/)).toBeInTheDocument();
    });
    expect(screen.getByText(/More safe text/)).toBeInTheDocument();
    // react-markdown without rehype-raw does not parse raw HTML; rehype-sanitize
    // provides additional safety. No <script> element should be in the DOM.
    const scriptElements = document.querySelectorAll("script");
    // Filter to only scripts that contain our XSS payload
    const xssScripts = Array.from(scriptElements).filter((el) =>
      el.textContent?.includes("xss"),
    );
    expect(xssScripts.length).toBe(0);
  });

  it("archived thread disables composer and shows banner", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === "/chats/thread-1")
        return Promise.resolve(ARCHIVED_THREAD);
      if (path === "/chats/thread-1/messages")
        return Promise.resolve([]);
      if (path === "/skills")
        return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/Thread archived/),
      ).toBeInTheDocument();
    });
    const textarea = document.querySelector("textarea");
    expect(textarea).toBeDisabled();
  });
});
