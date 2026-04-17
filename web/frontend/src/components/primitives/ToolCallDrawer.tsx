import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ToolCallStatus } from "./ToolCallCard";

export interface ToolCallDrawerProps {
  /**
   * Status for each tool call in the order they should render. The length of
   * this array is the count shown in the summary. Use an empty array to render
   * nothing.
   */
  statuses: ToolCallStatus[];
  /**
   * The child ToolCallCard nodes. Rendered inside the expanded body in the
   * same `flex flex-col gap-2` layout the page currently uses.
   */
  children: ReactNode;
  /**
   * Force-open on first mount. Defaults to false. Independent of auto-open-
   * when-streaming (which is derived from `statuses`).
   */
  defaultOpen?: boolean;
  className?: string;
}

function MiniStatusGlyph({ status }: { status: ToolCallStatus }) {
  if (status === "running") {
    return (
      <span
        className="inline-block w-2.5 h-2.5 rounded-full border-2 border-info border-t-transparent animate-spin"
        aria-label="running"
      />
    );
  }
  if (status === "complete") {
    return (
      <span className="text-accent text-xs leading-none" aria-label="complete">
        ✓
      </span>
    );
  }
  return (
    <span className="text-error text-xs leading-none" aria-label="error">
      ✗
    </span>
  );
}

/**
 * Collapsible drawer that groups a list of ToolCallCard children under a
 * compact summary row. Auto-opens on the rising edge of any child entering
 * "running" status, but will not auto-close. Purely presentational -- does
 * not render ToolCallCards itself; callers pass them as children alongside
 * a parallel `statuses` array.
 */
export function ToolCallDrawer({
  statuses,
  children,
  defaultOpen,
  className,
}: ToolCallDrawerProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen ?? false);
  const bodyId = useId();
  const anyRunning = statuses.some((s) => s === "running");
  const prevAnyRunningRef = useRef<boolean>(anyRunning);

  useEffect(() => {
    if (anyRunning && !prevAnyRunningRef.current) {
      setOpen(true);
    }
    prevAnyRunningRef.current = anyRunning;
  }, [anyRunning]);

  if (statuses.length === 0) {
    return null;
  }

  const wrapperCls = [
    "bg-surface-1 border border-border rounded-lg overflow-hidden",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const count = statuses.length;
  const label = `${count} tool call${count === 1 ? "" : "s"}`;

  return (
    <div className={wrapperCls}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-hover cursor-pointer"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label="Toggle tool calls"
      >
        <span
          className="text-muted text-xs shrink-0 transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          aria-hidden="true"
        >
          ›
        </span>
        <span className="text-sm text-fg">{label}</span>
        <span className="flex items-center gap-1 flex-wrap ml-2">
          {statuses.map((s, i) => (
            <MiniStatusGlyph key={i} status={s} />
          ))}
        </span>
        <span className="flex-1" />
      </button>
      {open ? (
        <div
          id={bodyId}
          className="bg-surface-0 border-t border-border px-3 py-2 flex flex-col gap-2"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
