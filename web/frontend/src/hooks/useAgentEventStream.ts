import { useEffect, useRef, useState } from "react";
import type { AskUserSseEvent } from "@/types/agentPrompt";

/**
 * Subscribe to the per-run SSE event stream for an agent run.
 *
 * When `runId` is non-null, opens an EventSource on
 * `/api/agents/runs/{runId}/events` and listens for the `ask_user` named
 * event, dispatching parsed payloads to `opts.onAskUser`. Reconnection is
 * delegated to the native EventSource spec (browser sends `Last-Event-ID`
 * automatically on reconnect, which the backend already supports).
 *
 * On `runId` change or unmount the underlying EventSource is closed.
 */
export function useAgentEventStream(
  runId: string | null,
  opts?: { onAskUser?: (evt: AskUserSseEvent) => void },
): { connected: boolean; lastError: string | null } {
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Pin the latest callback in a ref so changing it across renders does not
  // trigger EventSource teardown + resubscription.
  const onAskUserRef = useRef<typeof opts.onAskUser>(opts?.onAskUser);
  useEffect(() => {
    onAskUserRef.current = opts?.onAskUser;
  }, [opts?.onAskUser]);

  useEffect(() => {
    if (!runId) {
      setConnected(false);
      return;
    }

    const url = `/api/agents/runs/${runId}/events`;
    const es = new EventSource(url);

    const handleOpen = () => {
      setConnected(true);
      setLastError(null);
    };

    const handleError = () => {
      setConnected(false);
      setLastError("EventSource error (auto-reconnecting)");
    };

    const handleAskUser = (e: MessageEvent) => {
      const cb = onAskUserRef.current;
      if (!cb) return;
      try {
        const payload = JSON.parse(e.data) as AskUserSseEvent;
        cb(payload);
      } catch (err) {
        // Malformed payload; log to console but keep the stream alive.
        console.warn("[useAgentEventStream] failed to parse ask_user event", err);
      }
    };

    es.addEventListener("open", handleOpen);
    es.addEventListener("error", handleError);
    es.addEventListener("ask_user", handleAskUser as EventListener);

    return () => {
      es.removeEventListener("open", handleOpen);
      es.removeEventListener("error", handleError);
      es.removeEventListener("ask_user", handleAskUser as EventListener);
      es.close();
    };
  }, [runId]);

  return { connected, lastError };
}
