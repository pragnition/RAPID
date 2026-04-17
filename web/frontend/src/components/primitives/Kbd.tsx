import type { ReactNode } from "react";

export interface KbdProps {
  children: ReactNode;
  className?: string;
}

/**
 * Keyboard shortcut pill. Mono, muted, bordered surface-2 background.
 */
export function Kbd({ children, className }: KbdProps) {
  const cls = [
    "inline-flex items-center bg-surface-2 border border-border rounded",
    "px-1.5 py-0.5 text-xs font-mono text-muted",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <kbd className={cls}>{children}</kbd>;
}
