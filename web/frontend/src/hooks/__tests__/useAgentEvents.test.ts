import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAgentEvents } from "../useAgentEvents";

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

type EventSourceListener = (e: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, Set<EventListener>>();
  readyState = 0;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Auto-fire open on next tick
    setTimeout(() => this.fire("open", null), 0);
  }

  addEventListener(kind: string, listener: EventListener) {
    if (!this.listeners.has(kind)) {
      this.listeners.set(kind, new Set());
    }
    this.listeners.get(kind)!.add(listener);
  }

  removeEventListener(kind: string, listener: EventListener) {
    this.listeners.get(kind)?.delete(listener);
  }

  close = vi.fn();

  /** Test helper: dispatch an event to all listeners for a kind. */
  fire(kind: string, data: unknown) {
    const event = kind === "open"
      ? new Event("open")
      : kind === "error"
        ? new Event("error")
        : new MessageEvent(kind, { data: JSON.stringify(data) });
    this.listeners.get(kind)?.forEach((l) => l(event as Event));
  }
}

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as Record<string, unknown>).EventSource = MockEventSource;
  fetchSpy = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ status: "running" }),
  });
  globalThis.fetch = fetchSpy;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAgentEvents", () => {
  it("listens for all 10 event kinds", () => {
    renderHook(() => useAgentEvents("run-1"));
    const es = MockEventSource.instances[0];
    const kinds = [
      "assistant_text", "thinking", "tool_use", "tool_result",
      "ask_user", "permission_req", "status", "run_complete",
      "replay_truncated", "retention_warning",
    ];
    for (const kind of kinds) {
      expect(es.listeners.has(kind)).toBe(true);
      expect(es.listeners.get(kind)!.size).toBeGreaterThan(0);
    }
  });

  it("opens SSE with since=0 on first mount", () => {
    renderHook(() => useAgentEvents("run-1"));
    const es = MockEventSource.instances[0];
    expect(es.url).toBe("/api/agents/runs/run-1/events?since=0");
  });

  it("subsequent SSE opens use lastSeq", async () => {
    const { result } = renderHook(() => useAgentEvents("run-1"));
    const es = MockEventSource.instances[0];

    // Fire a status event with seq=5
    act(() => {
      es.fire("status", {
        kind: "status",
        seq: 5,
        ts: "2026-04-16T10:00:00Z",
        run_id: "run-1",
        status: "running",
        detail: null,
      });
    });

    // Trigger reconnect
    act(() => {
      result.current.reconnect();
    });

    // A new EventSource should be created with since=5
    const es2 = MockEventSource.instances[1];
    expect(es2.url).toBe("/api/agents/runs/run-1/events?since=5");
  });

  it("status event updates status field", () => {
    const { result } = renderHook(() => useAgentEvents("run-1"));
    const es = MockEventSource.instances[0];

    act(() => {
      es.fire("status", {
        kind: "status",
        seq: 1,
        ts: "2026-04-16T10:00:00Z",
        run_id: "run-1",
        status: "running",
        detail: null,
      });
    });

    expect(result.current.status).toBe("running");
  });

  it("run_complete event updates status to completed", () => {
    const { result } = renderHook(() => useAgentEvents("run-1"));
    const es = MockEventSource.instances[0];

    act(() => {
      es.fire("run_complete", {
        kind: "run_complete",
        seq: 10,
        ts: "2026-04-16T10:01:00Z",
        run_id: "run-1",
        status: "completed",
        total_cost_usd: 0.05,
        turn_count: 3,
        duration_s: 60,
        error_code: null,
        error_detail: null,
      });
    });

    expect(result.current.status).toBe("completed");
  });

  it("polls status via REST every 2 to 5 seconds", async () => {
    renderHook(() => useAgentEvents("run-1"));

    // Advance past the first poll interval (max 5s)
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/agents/runs/run-1");
  });

  it("reconnect fn reopens SSE with current lastSeq", () => {
    const { result } = renderHook(() => useAgentEvents("run-1"));
    const es = MockEventSource.instances[0];

    // Receive event with seq=3
    act(() => {
      es.fire("thinking", {
        kind: "thinking",
        seq: 3,
        ts: "2026-04-16T10:00:00Z",
        run_id: "run-1",
        text: "thinking...",
      });
    });

    act(() => {
      result.current.reconnect();
    });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1].url).toBe(
      "/api/agents/runs/run-1/events?since=3",
    );
  });

  it("close on unmount", () => {
    const { unmount } = renderHook(() => useAgentEvents("run-1"));
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.close).toHaveBeenCalled();
  });

  it("appends received events to events array", () => {
    const { result } = renderHook(() => useAgentEvents("run-1"));
    const es = MockEventSource.instances[0];

    act(() => {
      es.fire("assistant_text", {
        kind: "assistant_text",
        seq: 1,
        ts: "2026-04-16T10:00:00Z",
        run_id: "run-1",
        text: "Hello",
      });
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].kind).toBe("assistant_text");
  });

  it("does not open SSE when runId is null", () => {
    renderHook(() => useAgentEvents(null));
    expect(MockEventSource.instances).toHaveLength(0);
  });
});
