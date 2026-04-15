export interface AutoScrollPillProps {
  count: number;
  visible: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Fixed-position pill shown when the chat pane is scrolled away from the bottom and new
 * messages arrive. Hidden when `!visible` or `count === 0`.
 */
export function AutoScrollPill({ count, visible, onClick, className }: AutoScrollPillProps) {
  if (!visible || count <= 0) return null;
  const cls = [
    "fixed left-1/2 -translate-x-1/2 bottom-24",
    "bg-surface-3 border border-accent rounded-full px-3 py-1",
    "text-xs font-mono text-fg shadow-lg",
    "hover:bg-surface-2",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" onClick={onClick} className={cls}>
      ↓ {count} new {count === 1 ? "message" : "messages"}
    </button>
  );
}
