import { useCallback, useEffect, useRef, useState } from "react";
import type { SseEvent, SseEventKind } from "@/types/sseEvents";
import type { AgentRunStatus } from "@/types/agents";

const EVENT_KINDS: SseEventKind[] = [
  "assistant_text",
  "thinking",
  "tool_use",
  "tool_result",
  "ask_user",
  "permission_req",
  "status",
  "run_complete",
  "replay_truncated",
  "retention_warning",
];

/** 2-5s jittered polling interval. */
function pollInterval(): number {
  return 2000 + Math.random() * 3000;
}

export interface UseAgentEventsResult {
  events: SseEvent[];
  status: AgentRunStatus | null;
  reconnect: () => void;
  error: string | null;
  connected: boolean;
}

/**
 * SSE primary + polling fallback hook for a single agent run.
 *
 * - Opens an EventSource on `/api/agents/runs/{runId}/events?since=N` and
 *   listens for all 10 named event kinds.
 * - Polls `GET /api/agents/runs/{runId}` every 2-5s (jittered) for status
 *   telemetry (the primary status signal per contract).
 * - On `replay_truncated`, falls back to REST backfill then re-subscribes.
 *
 * Does NOT modify or import `useAgentEventStream` -- that hook is preserved
 * for PendingPromptController backwards compatibility.
 */
export function useAgentEvents(runId: string | null): UseAgentEventsResult {
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [status, setStatus] = useState<AgentRunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const lastSeqRef = useRef(0);
  const [reconnectKey, setReconnectKey] = useState(0);

  const reconnect = useCallback(() => {
    setReconnectKey((k) => k + 1);
    setError(null);
  }, []);

  // -- SSE subscription --
  useEffect(() => {
    if (!runId) return;
    const since = lastSeqRef.current;
    const url = `/api/agents/runs/${runId}/events?since=${since}`;
    const es = new EventSource(url);

    const onOpen = () => {
      setConnected(true);
      setError(null);
    };
    const onError = () => {
      setConnected(false);
      setError("SSE disconnected");
    };

    const handlers: Array<[string, (e: MessageEvent) => void]> =
      EVENT_KINDS.map((kind) => {
        const handler = (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data) as SseEvent;
            lastSeqRef.current = Math.max(lastSeqRef.current, payload.seq);
            setEvents((prev) => [...prev, payload]);
            if (payload.kind === "status") {
              setStatus(payload.status);
            } else if (payload.kind === "run_complete") {
              setStatus(payload.status);
            } else if (payload.kind === "replay_truncated") {
              // Fall back to REST backfill before resuming SSE.
              void backfillRest(
                runId,
                payload.requested_since_seq,
                setEvents,
                (newSeq) => {
                  lastSeqRef.current = newSeq;
                  setReconnectKey((k) => k + 1); // re-open SSE from new seq
                },
              );
            }
          } catch (err) {
            console.warn("[useAgentEvents] parse failure", err);
          }
        };
        return [kind, handler];
      });

    es.addEventListener("open", onOpen);
    es.addEventListener("error", onError);
    for (const [kind, handler] of handlers) {
      es.addEventListener(kind, handler as EventListener);
    }

    return () => {
      es.removeEventListener("open", onOpen);
      es.removeEventListener("error", onError);
      for (const [kind, handler] of handlers) {
        es.removeEventListener(kind, handler as EventListener);
      }
      es.close();
    };
  }, [runId, reconnectKey]);

  // -- Polling (status telemetry) --
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const run = await fetch(`/api/agents/runs/${runId}`).then(
          (r) => r.json() as Promise<{ status: AgentRunStatus }>,
        );
        if (cancelled) return;
        setStatus(run.status);
      } catch {
        /* swallow polling errors */
      }
      if (!cancelled) {
        timer = setTimeout(tick, pollInterval());
      }
    };
    timer = setTimeout(tick, pollInterval());

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId]);

  return { events, status, reconnect, error, connected };
}

/**
 * REST backfill on `replay_truncated`. When the SSE in-memory buffer has been
 * truncated past the client's requested `since` seq, fetch missing events via
 * REST and reconcile.
 *
 * NOTE: The REST backfill endpoint (`GET /api/agents/runs/{id}/events?format=json&since=N`)
 * is not yet shipped. This is a documented stub per the coordination notes.
 * When the endpoint lands, implement fetch + dedupe + append here.
 */
async function backfillRest(
  _runId: string,
  since: number,
  _appendEvents: (updater: (prev: SseEvent[]) => SseEvent[]) => void,
  onDone: (newSeq: number) => void,
): Promise<void> {
  // Stub: see wave-2-PLAN.md coordination notes.
  console.warn(
    "[useAgentEvents] REST backfill not yet implemented; resuming SSE from seq",
    since,
  );
  onDone(since);
}
