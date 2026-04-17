import { useState, type ReactNode } from "react";

export type ToolCallStatus = "running" | "complete" | "error";

export interface ToolCallCardProps {
  toolName: string;
  argsPreview?: string;
  status: ToolCallStatus;
  durationMs?: number;
  defaultOpen?: boolean;
  argumentsBody?: ReactNode;
  resultBody?: ReactNode;
  className?: string;
}

function StatusIcon({ status }: { status: ToolCallStatus }) {
  if (status === "running") {
    return (
      <span className="inline-block w-3 h-3 rounded-full border-2 border-info border-t-transparent animate-spin" aria-label="running" />
    );
  }
  if (status === "complete") {
    return (
      <span className="text-accent font-bold" aria-label="complete">
        ✓
      </span>
    );
  }
  return (
    <span className="text-error font-bold" aria-label="error">
      ✗
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

/**
 * Collapsible tool-call card for the chat surface.
 * Head row: status icon · tool name · args preview · duration · chevron.
 * Body (when open) shows Arguments and Result in preformatted blocks on a darker surface.
 *
 * Purely presentational — no fetching, no live spinner coordination.
 */
export function ToolCallCard({
  toolName,
  argsPreview,
  status,
  durationMs,
  defaultOpen = false,
  argumentsBody,
  resultBody,
  className,
}: ToolCallCardProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const hasBody = argumentsBody !== undefined || resultBody !== undefined;
  const cls = [
    "bg-surface-1 border border-border rounded-lg overflow-hidden",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <button
        type="button"
        onClick={() => hasBody && setOpen((prev) => !prev)}
        disabled={!hasBody}
        className={[
          "w-full flex items-center gap-2 px-3 py-2 text-left",
          hasBody ? "hover:bg-hover cursor-pointer" : "cursor-default",
        ].join(" ")}
        aria-expanded={hasBody ? open : undefined}
      >
        <StatusIcon status={status} />
        <span className="font-mono text-sm text-fg">{toolName}</span>
        {argsPreview ? (
          <span className="font-mono text-xs text-muted truncate flex-1">{argsPreview}</span>
        ) : (
          <span className="flex-1" />
        )}
        {typeof durationMs === "number" ? (
          <span className="font-mono text-xs text-muted shrink-0">{formatDuration(durationMs)}</span>
        ) : null}
        {hasBody ? (
          <span
            className="text-muted text-xs shrink-0 transition-transform"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
            aria-hidden="true"
          >
            ›
          </span>
        ) : null}
      </button>
      {hasBody && open ? (
        <div className="bg-surface-0 border-t border-border px-3 py-2 flex flex-col gap-3">
          {argumentsBody !== undefined ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">
                Arguments
              </div>
              <pre className="text-xs font-mono text-fg-dim whitespace-pre-wrap break-words">
                {argumentsBody}
              </pre>
            </div>
          ) : null}
          {resultBody !== undefined ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">
                Result
              </div>
              <pre className="text-xs font-mono text-fg-dim whitespace-pre-wrap break-words">
                {resultBody}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
