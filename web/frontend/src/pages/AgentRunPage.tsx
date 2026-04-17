import { useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  PageHeader,
  StatusBadge,
  SurfaceCard,
  DataTable,
  ToolCallCard,
  ErrorCard,
  AutoScrollPill,
  usePrefersReducedMotion,
  useAutoScrollWithOptOut,
  type Column,
} from "@/components/primitives";
import { LiveRegion } from "@/components/a11y";
import { useAgentRun } from "@/hooks/useAgentRuns";
import { useAgentEvents } from "@/hooks/useAgentEvents";
import { apiClient } from "@/lib/apiClient";
import type { AgentRunStatus } from "@/types/agents";
import type {
  SseEvent,
  ToolUseEvent,
  ToolResultEvent,
} from "@/types/sseEvents";

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

type BadgeTone = Parameters<typeof StatusBadge>[0]["tone"];

const STATUS_TONE: Record<AgentRunStatus, BadgeTone> = {
  running: "accent",
  waiting: "warning",
  idle: "muted",
  failed: "error",
  interrupted: "error",
  completed: "link",
  pending: "muted",
};

const STATUS_LABEL: Record<AgentRunStatus, string> = {
  running: "RUNNING",
  waiting: "WAITING",
  idle: "IDLE",
  failed: "FAILED",
  interrupted: "INTERRUPTED",
  completed: "COMPLETED",
  pending: "PENDING",
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDurationHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Telemetry table
// ---------------------------------------------------------------------------

interface TelemetryRow {
  metric: string;
  value: string;
}

const telemetryColumns: Column<TelemetryRow>[] = [
  {
    id: "metric",
    header: "Metric",
    cell: (row) => <span className="font-mono text-sm">{row.metric}</span>,
  },
  {
    id: "value",
    header: "Value",
    cell: (row) => <span className="font-mono text-sm">{row.value}</span>,
  },
];

// ---------------------------------------------------------------------------
// Activity feed helpers
// ---------------------------------------------------------------------------

interface FeedItem {
  key: string;
  kind: "tool_call" | "text" | "error";
  toolName?: string;
  argsPreview?: string;
  status?: "running" | "complete" | "error";
  argumentsBody?: string;
  resultBody?: string;
  text?: string;
  errorTitle?: string;
  errorBody?: string;
}

function buildFeed(events: SseEvent[]): FeedItem[] {
  const items: FeedItem[] = [];
  // Map tool_use_id -> { use event, result event }
  const toolMap = new Map<
    string,
    { use: ToolUseEvent; result?: ToolResultEvent }
  >();

  for (const ev of events) {
    switch (ev.kind) {
      case "tool_use": {
        toolMap.set(ev.tool_use_id, { use: ev });
        break;
      }
      case "tool_result": {
        const entry = toolMap.get(ev.tool_use_id);
        if (entry) {
          entry.result = ev;
        }
        break;
      }
      case "assistant_text": {
        items.push({
          key: `text-${ev.seq}`,
          kind: "text",
          text: ev.text,
        });
        break;
      }
      case "thinking": {
        items.push({
          key: `think-${ev.seq}`,
          kind: "text",
          text: ev.text,
        });
        break;
      }
      case "permission_req": {
        if (ev.blocked) {
          items.push({
            key: `perm-${ev.seq}`,
            kind: "error",
            errorTitle: `Permission blocked: ${ev.tool_name}`,
            errorBody: ev.reason,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  // Append tool call cards
  for (const [id, entry] of toolMap) {
    const status = entry.result
      ? entry.result.is_error
        ? "error"
        : "complete"
      : "running";

    items.push({
      key: `tool-${id}`,
      kind: "tool_call",
      toolName: entry.use.tool_name,
      argsPreview: JSON.stringify(entry.use.input).slice(0, 80),
      status: status as "running" | "complete" | "error",
      argumentsBody: JSON.stringify(entry.use.input, null, 2),
      resultBody: entry.result
        ? typeof entry.result.output === "string"
          ? entry.result.output
          : JSON.stringify(entry.result.output, null, 2)
        : undefined,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentRunPage() {
  const navigate = useNavigate();
  const { runId } = useParams<{ runId: string }>();
  const { data: run } = useAgentRun(runId ?? null);
  const { events, status: liveStatus } = useAgentEvents(runId ?? null);
  const reducedMotion = usePrefersReducedMotion();

  const feedRef = useRef<HTMLDivElement>(null);
  const feed = useMemo(() => buildFeed(events), [events]);

  const { pinned, newCount, scrollToBottom } = useAutoScrollWithOptOut({
    containerRef: feedRef,
    deps: [feed.length],
  });

  const currentStatus = liveStatus ?? run?.status ?? "pending";
  const isRunning = currentStatus === "running";

  // Keyboard shortcuts: Shift+P = pause (interrupt), Shift+S = stop (interrupt)
  useEffect(() => {
    if (!runId) return;
    const handleKey = (e: KeyboardEvent) => {
      // Guard against firing in text fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.shiftKey && e.key === "P") {
        e.preventDefault();
        void apiClient.post(`/agents/runs/${runId}/interrupt`, {
          type: "pause",
        });
      } else if (e.shiftKey && e.key === "S") {
        e.preventDefault();
        void apiClient.post(`/agents/runs/${runId}/interrupt`, {
          type: "stop",
        });
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [runId]);

  // Telemetry table data
  const telemetryRows: TelemetryRow[] = useMemo(() => {
    if (!run) return [];
    return [
      { metric: "Total cost", value: formatCost(run.total_cost_usd) },
      { metric: "Turn count", value: String(run.turn_count) },
      {
        metric: "Active duration",
        value: formatDurationHMS(run.active_duration_s),
      },
      {
        metric: "Wall-clock duration",
        value: formatDurationHMS(run.total_wall_clock_s),
      },
      { metric: "Max turns", value: String(run.max_turns) },
      { metric: "Last seq", value: String(run.last_seq) },
    ];
  }, [run]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={runId ?? "Agent Run"}
        breadcrumb={[
          { label: "RAPID", to: "/" },
          { label: "Agents", to: "/agents" },
          { label: runId ?? "Run" },
        ]}
        description={run?.skill_name ?? "Loading..."}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!runId) return;
                try {
                  const chat = await apiClient.post<{ id: string }>(
                    `/agents/runs/${runId}/chat`,
                    {},
                  );
                  navigate(`/chats/${chat.id}`);
                } catch (err) {
                  console.error("Failed to open chat:", err);
                }
              }}
              className="px-3 py-1.5 text-sm rounded border border-accent text-accent hover:bg-accent/10"
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() =>
                runId &&
                apiClient.post(`/agents/runs/${runId}/interrupt`, {
                  type: "pause",
                })
              }
              disabled={!isRunning}
              className="px-3 py-1.5 text-sm rounded border border-border text-muted hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() =>
                runId &&
                apiClient.post(`/agents/runs/${runId}/interrupt`, {
                  type: "stop",
                })
              }
              disabled={!isRunning}
              className="px-3 py-1.5 text-sm rounded border border-error text-error hover:bg-error/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stop
            </button>
          </div>
        }
      />

      {/* Status badge with optional pulse animation */}
      <div className="flex items-center gap-3">
        <StatusBadge
          label={`${STATUS_LABEL[currentStatus]}${isRunning && run ? ` ${formatDurationHMS(run.active_duration_s)}` : ""}`}
          tone={STATUS_TONE[currentStatus]}
          className={
            isRunning && !reducedMotion ? "animate-pulse" : undefined
          }
        />
        <LiveRegion mode="polite" busy={isRunning}>
          {STATUS_LABEL[currentStatus]}
          {isRunning && run
            ? ` ${formatDurationHMS(run.active_duration_s)}`
            : ""}
        </LiveRegion>
      </div>

      {/* Telemetry card */}
      <SurfaceCard elevation={1} className="p-4">
        <h2 className="text-xs text-muted uppercase tracking-wider font-semibold mb-3">
          Telemetry
        </h2>
        <DataTable
          rows={telemetryRows}
          columns={telemetryColumns}
          getRowKey={(r) => r.metric}
        />
      </SurfaceCard>

      {/* Activity feed */}
      <div>
        <h2 className="text-xs text-muted uppercase tracking-wider font-semibold mb-3">
          Activity
        </h2>
        <div
          ref={feedRef}
          className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto"
        >
          {feed.map((item) => {
            switch (item.kind) {
              case "tool_call":
                return (
                  <ToolCallCard
                    key={item.key}
                    toolName={item.toolName ?? "unknown"}
                    argsPreview={item.argsPreview}
                    status={item.status ?? "running"}
                    argumentsBody={item.argumentsBody}
                    resultBody={item.resultBody}
                  />
                );
              case "text":
                return (
                  <div
                    key={item.key}
                    className="text-sm text-fg prose prose-sm dark:prose-invert max-w-none"
                  >
                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {item.text ?? ""}
                    </Markdown>
                  </div>
                );
              case "error":
                return (
                  <ErrorCard
                    key={item.key}
                    title={item.errorTitle ?? "Error"}
                    body={item.errorBody ?? ""}
                  />
                );
              default:
                return null;
            }
          })}
        </div>
      </div>

      <AutoScrollPill
        count={newCount}
        visible={!pinned}
        onClick={scrollToBottom}
      />

      {/* NO Composer -- load-bearing per no_composer_on_run_detail invariant */}
    </div>
  );
}
