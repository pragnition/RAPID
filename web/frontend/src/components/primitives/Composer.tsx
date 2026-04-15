import {
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Kbd } from "./Kbd";

export interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxHeightPx?: number;
  slashHint?: boolean;
  attachments?: ReactNode;
  actions?: ReactNode;
  className?: string;
  sendLabel?: ReactNode;
}

const MIN_HEIGHT = 22;

/**
 * Chat composer with auto-growing textarea (22→maxHeight), focus-within accent border,
 * right-aligned actions slot plus send button, and a hint strip of keyboard affordances.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
  maxHeightPx = 200,
  slashHint = true,
  attachments,
  actions,
  className,
  sendLabel = "Send",
}: ComposerProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow logic. Reset height first so shrinking works.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = `${MIN_HEIGHT}px`;
    const next = Math.min(ta.scrollHeight, maxHeightPx);
    ta.style.height = `${Math.max(MIN_HEIGHT, next)}px`;
  }, [value, maxHeightPx]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && value.trim().length > 0) onSubmit();
    }
  }

  const cls = [
    "bg-surface-1 border border-border rounded-xl p-2.5",
    "focus-within:border-accent",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className={cls}>
      {attachments ? <div className="mb-2">{attachments}</div> : null}
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={[
            "flex-1 bg-transparent outline-none resize-none",
            "text-sm text-fg placeholder:text-muted leading-snug",
          ].join(" ")}
          style={{ minHeight: MIN_HEIGHT, maxHeight: maxHeightPx }}
        />
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
        <button
          type="button"
          onClick={() => canSend && onSubmit()}
          disabled={!canSend}
          className={[
            "px-3 py-1.5 text-sm font-semibold rounded",
            canSend
              ? "bg-accent text-bg-0 hover:opacity-90"
              : "bg-surface-2 text-muted cursor-not-allowed",
          ].join(" ")}
        >
          {sendLabel}
        </button>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> send
        </span>
        <span className="flex items-center gap-1">
          <Kbd>⇧↵</Kbd> newline
        </span>
        {slashHint ? (
          <>
            <span className="flex items-center gap-1">
              <Kbd>/</Kbd> commands
            </span>
            <span className="flex items-center gap-1">
              <Kbd>@</Kbd> mention
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
